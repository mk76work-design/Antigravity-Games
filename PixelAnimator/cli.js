#!/usr/bin/env node
// cli.js — AIエージェントがブラウザを介さず直接ドット絵アニメーションを生成するための
// コマンドラインインターフェース。
//
// このツールの主目的は「AIエージェント自身がドット絵・ドット絵アニメーションの作成を
// 一気通貫で行えるようにする」こと。人間はブラウザUI（npm run dev）で軽い手直しや
// 最終確認をするだけでよく、生成・自己検証・自己修正はこのCLI一本で完結する。
//
// サブコマンド:
//   generate    単発のアニメーションを1本生成する。
//   character   同一キャラクターの複数アクション（idle/walk/attack等）を、
//               配色・プロポーションの一貫性を保ちながらまとめて生成する。
//
// stdout には機械可読なJSON結果だけを出力する（人間向けの進行状況ログは全てstderr）。
// 終了コード: 0=自己チェック合格（またはスキップ）、1=実行時エラー、
//            2=生成は完了したが自己チェックを通過できず要確認（needs_review が1件以上）。

import { parseArgs } from 'node:util';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { generateWithSelfCheck } from './server/agentCore.js';
import { buildNativeSpritesheetPng, buildAnimatedGif } from './server/pngRender.js';
import { DEFAULT_MODEL, DEFAULT_MAX_ITERATIONS } from './core.js';

function log(...args) {
    console.error(...args);
}

function fail(message) {
    console.error(`エラー: ${message}`);
    process.exitCode = 1;
}

function printUsage() {
    console.error(`Pixel Animator CLI — AIエージェント向けドット絵アニメーション生成ツール

使い方:
  node cli.js generate --prompt "<説明>" --out <出力先パスの接頭辞> [オプション]
  node cli.js character --description "<キャラの外見>" --actions idle,walk,attack --out-dir <出力先ディレクトリ> [オプション]

--- generate ---
1本のアニメーションを生成する。<out>.png（等倍スプライトシート）, <out>.gif（GIF）,
<out>.json（プロジェクトデータ、ブラウザ版で読み込み・手直し可能）を書き出す。

オプション:
  --prompt <text>              必須。どんなアニメーションが欲しいかの説明。
  --out <path>                 必須。出力ファイルの接頭辞。
  --width <px>                 キャンバス幅（デフォルト 32。スーパーファミコン級の
                                 密度のシェーディングを狙うなら32px以上を推奨）
  --height <px>                キャンバス高さ（デフォルト --width と同じ）
  --frames <n>                 フレーム数（デフォルト 6）
  --palette <n>                パレット上限色数（デフォルト 16。主要パーツごとに
                                 3〜4階調のグラデーションを持たせるための目安）
  --loop <loop|pingpong|once>  ループ種類（デフォルト loop）
  --fps <n>                    再生FPS、JSON書き出し用（デフォルト 8）
  --model <name>                使用モデル（デフォルト ${DEFAULT_MODEL}）
  --max-iterations <n>         自己チェックの最大やり直し回数（デフォルト ${DEFAULT_MAX_ITERATIONS}）
  --no-self-check               自己チェックを無効化し、1回の生成だけで終了する
  --quiet                       進行状況ログ(stderr)を抑制する

例:
  node cli.js generate \\
    --prompt "剣を構えた侍が待機して時々まばたきする、青系の配色" \\
    --width 32 --frames 8 --loop loop \\
    --out ./output/samurai_idle

--- character ---
まず基準ポーズ（1枚絵）を生成し、それを土台に複数アクションのアニメーションを
配色・プロポーションを保ったまま連続生成する。<out-dir>/reference.png と
<out-dir>/<action>.png/.gif/.json、<out-dir>/character.json（全体サマリー）を書き出す。

オプション（generateと共通のものは同じ意味）:
  --description <text>         必須。キャラクターの外見・世界観の説明。
  --actions <a,b,c>             必須。カンマ区切りのアクション名（例: idle,walk,attack）。
  --frames <n または n,n,n>      フレーム数。単一値なら全アクション共通、
                                 カンマ区切りなら --actions と同じ数だけ個別指定。
  --out-dir <path>              必須。出力先ディレクトリ。
  --concurrency <n>              基準ポーズ確定後、アクションを何件まで同時生成するか
                                 （デフォルト 2、最大 4。並列数を上げすぎるとローカルの
                                 claude CLI呼び出しが不安定になる場合がある）。
  --width / --height / --palette / --loop / --fps / --model / --max-iterations /
  --no-self-check / --quiet     generate と同じ（全アクションに共通適用）。

例:
  node cli.js character \\
    --description "青い甲冑を着た戦士、赤いマント" \\
    --actions idle,walk,attack --frames 4,8,6 \\
    --width 32 --palette 16 \\
    --out-dir ./output/warrior
`);
}

function buildOnProgress({ quiet, logPrefix = '' }) {
    if (quiet) return () => {};
    return (event) => {
        const tag = `${logPrefix}[${event.iteration}/${event.maxIterations}]`;
        switch (event.type) {
            case 'generating':
                log(`🪄 ${tag} 生成中...`);
                break;
            case 'heuristic-checking':
                log(`🔍 ${tag} 機械的な品質チェック中...`);
                break;
            case 'heuristic-failed':
                log(`⚠️  ${tag} 問題を検出: ${event.issues.join(' / ')}`);
                break;
            case 'vision-reviewing':
                log(`👁  ${tag} 画像として自己レビュー中...`);
                break;
            case 'vision-review-error':
                log(`⚠️  ${tag} 画像レビューに失敗: ${event.message}`);
                break;
            case 'vision-needs-fix':
                log(`📝 ${tag} 自己採点 ${event.score}/10（ドット絵らしさ ${event.pixelArtAuthenticity}/10、シェーディング ${event.shadingQuality}/10）→ 修正: ${event.issues.map((i) => i.problem).join(' / ')}`);
                break;
            case 'done':
                if (event.verdict === 'approved') log(`✅ ${tag} 自己チェック合格（スコア ${event.score}/10、ドット絵らしさ ${event.pixelArtAuthenticity}/10、シェーディング ${event.shadingQuality}/10）。`);
                break;
        }
    };
}

async function writeProjectFiles(outPrefix, project, { writeGif = true } = {}) {
    const outDir = path.dirname(path.resolve(outPrefix));
    await mkdir(outDir, { recursive: true });

    const pngPath = `${outPrefix}.png`;
    const jsonPath = `${outPrefix}.json`;
    await writeFile(pngPath, buildNativeSpritesheetPng(project));
    await writeFile(jsonPath, JSON.stringify({ type: 'pixel-animator-project', version: 1, ...project }, null, 2));

    const files = { png: path.resolve(pngPath), json: path.resolve(jsonPath) };
    if (writeGif) {
        const gifPath = `${outPrefix}.gif`;
        await writeFile(gifPath, buildAnimatedGif(project));
        files.gif = path.resolve(gifPath);
    }
    return files;
}

function parsePositiveInt(value, label) {
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0) {
        throw new Error(`${label} は正の整数で指定してください（指定値: ${value}）。`);
    }
    return n;
}

function parseLoopMode(value) {
    if (!['loop', 'pingpong', 'once'].includes(value)) {
        throw new Error(`--loop は loop / pingpong / once のいずれかを指定してください（指定値: ${value}）。`);
    }
    return value;
}

// items を最大 limit 件まで同時実行しつつ順番に処理する。結果は items と同じ順序で返す
// （worker の完了順ではない）。1件の失敗が他を止めないよう、呼び出し側で
// worker 内のエラーを結果値として捕捉すること（例外を投げっぱなしにしない）。
async function runWithConcurrency(items, limit, worker) {
    const results = new Array(items.length);
    let nextIndex = 0;
    async function runNext() {
        while (nextIndex < items.length) {
            const i = nextIndex++;
            results[i] = await worker(items[i], i);
        }
    }
    const workerCount = Math.max(1, Math.min(limit, items.length));
    await Promise.all(Array.from({ length: workerCount }, runNext));
    return results;
}

// ── generate ──

async function runGenerateCommand(rest) {
    let values;
    try {
        ({ values } = parseArgs({
            args: rest,
            options: {
                prompt: { type: 'string' },
                out: { type: 'string' },
                width: { type: 'string', default: '32' },
                height: { type: 'string' },
                frames: { type: 'string', default: '6' },
                palette: { type: 'string', default: '16' },
                loop: { type: 'string', default: 'loop' },
                fps: { type: 'string', default: '8' },
                model: { type: 'string', default: DEFAULT_MODEL },
                'max-iterations': { type: 'string', default: String(DEFAULT_MAX_ITERATIONS) },
                'no-self-check': { type: 'boolean', default: false },
                quiet: { type: 'boolean', default: false },
            },
        }));
    } catch (err) {
        printUsage();
        fail(err.message);
        return;
    }

    if (!values.prompt || !values.out) {
        printUsage();
        fail('--prompt と --out は必須です。');
        return;
    }

    let width, height, frameCount, paletteLimit, loopMode;
    try {
        width = parsePositiveInt(values.width, '--width');
        height = parsePositiveInt(values.height || values.width, '--height');
        frameCount = parsePositiveInt(values.frames, '--frames');
        paletteLimit = parsePositiveInt(values.palette, '--palette');
        loopMode = parseLoopMode(values.loop);
    } catch (err) {
        fail(err.message);
        return;
    }

    const fps = Number(values.fps);
    const model = values.model;
    const maxIterations = Number(values['max-iterations']);
    const selfCheckEnabled = !values['no-self-check'];

    let result;
    try {
        result = await generateWithSelfCheck({
            description: values.prompt,
            width,
            height,
            frameCount,
            paletteLimit,
            loopMode,
            model,
            maxIterations,
            selfCheckEnabled,
            onProgress: buildOnProgress({ quiet: values.quiet }),
        });
    } catch (err) {
        fail(err.message || String(err));
        return;
    }

    const project = { width, height, fps, loopMode, palette: result.palette, frames: result.frames };
    const files = await writeProjectFiles(values.out, project);

    const summary = {
        verdict: result.verdict,
        score: result.score ?? null,
        pixelArtAuthenticity: result.pixelArtAuthenticity ?? null,
        shadingQuality: result.shadingQuality ?? null,
        iterations: result.iterations,
        reasons: result.reasons ?? [],
        concept: result.concept,
        width,
        height,
        frameCount,
        paletteLimit,
        loopMode,
        fps,
        files,
    };

    process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
    if (result.verdict === 'needs_review') {
        process.exitCode = 2;
    }
}

// ── character（同一キャラの複数アクションセット） ──

async function runCharacterCommand(rest) {
    let values;
    try {
        ({ values } = parseArgs({
            args: rest,
            options: {
                description: { type: 'string' },
                actions: { type: 'string' },
                'out-dir': { type: 'string' },
                width: { type: 'string', default: '32' },
                height: { type: 'string' },
                frames: { type: 'string', default: '6' },
                palette: { type: 'string', default: '16' },
                loop: { type: 'string', default: 'loop' },
                fps: { type: 'string', default: '8' },
                model: { type: 'string', default: DEFAULT_MODEL },
                'max-iterations': { type: 'string', default: String(DEFAULT_MAX_ITERATIONS) },
                'no-self-check': { type: 'boolean', default: false },
                concurrency: { type: 'string', default: '2' },
                quiet: { type: 'boolean', default: false },
            },
        }));
    } catch (err) {
        printUsage();
        fail(err.message);
        return;
    }

    if (!values.description || !values.actions || !values['out-dir']) {
        printUsage();
        fail('--description と --actions と --out-dir は必須です。');
        return;
    }

    const actions = values.actions.split(',').map((s) => s.trim()).filter(Boolean);
    if (actions.length === 0) {
        fail('--actions には最低1つのアクション名を指定してください。');
        return;
    }

    const frameSpec = values.frames.split(',').map((s) => s.trim());
    let frameCounts;
    try {
        if (frameSpec.length === 1) {
            const n = parsePositiveInt(frameSpec[0], '--frames');
            frameCounts = actions.map(() => n);
        } else {
            if (frameSpec.length !== actions.length) {
                throw new Error(`--frames をカンマ区切りで指定する場合、--actions と同じ数（${actions.length}個）にしてください（指定: ${frameSpec.length}個）。`);
            }
            frameCounts = frameSpec.map((v) => parsePositiveInt(v, '--frames'));
        }
    } catch (err) {
        fail(err.message);
        return;
    }

    let width, height, paletteLimit, loopMode;
    try {
        width = parsePositiveInt(values.width, '--width');
        height = parsePositiveInt(values.height || values.width, '--height');
        paletteLimit = parsePositiveInt(values.palette, '--palette');
        loopMode = parseLoopMode(values.loop);
    } catch (err) {
        fail(err.message);
        return;
    }

    const fps = Number(values.fps);
    const model = values.model;
    const maxIterations = Number(values['max-iterations']);
    const selfCheckEnabled = !values['no-self-check'];
    const quiet = values.quiet;
    const outDir = values['out-dir'];

    let concurrency;
    try {
        concurrency = parsePositiveInt(values.concurrency, '--concurrency');
    } catch (err) {
        fail(err.message);
        return;
    }
    if (concurrency > 4) {
        log(`⚠️  --concurrency は最大4までにクランプします（指定: ${concurrency}）。ローカルのClaude CLI呼び出しを大量に並列起動すると不安定になる場合があります。`);
        concurrency = 4;
    }

    // 1. 基準ポーズ（1枚絵）を確定させる。
    log(`\n=== 基準デザインを生成中 ===`);
    let refResult;
    try {
        refResult = await generateWithSelfCheck({
            description: `${values.description}\n\nこれはキャラクターの基準ポーズ（1枚絵）です。以降、この見た目・配色・プロポーションを保ったまま複数のアクションアニメーションを作成します。特徴が伝わる自然な立ち姿にしてください。`,
            width,
            height,
            frameCount: 1,
            paletteLimit,
            loopMode: 'once',
            model,
            maxIterations,
            selfCheckEnabled,
            onProgress: buildOnProgress({ quiet, logPrefix: '[基準] ' }),
        });
    } catch (err) {
        fail(`基準デザインの生成に失敗しました: ${err.message || err}`);
        return;
    }

    const referenceProject = { width, height, fps, loopMode: 'once', palette: refResult.palette, frames: refResult.frames };
    const referenceFiles = await writeProjectFiles(path.join(outDir, 'reference'), referenceProject, { writeGif: false });

    const reference = { palette: refResult.palette, pixels: refResult.frames[0], width, height };

    // 2. 基準デザインを見せながら、各アクションを生成する（最大 concurrency 件まで並列）。
    //    1件の失敗（実機ではCLIタイムアウト等が実際に発生した）が他のアクションを
    //    巻き込まないよう、各workerは例外を投げずに結果オブジェクトとして返す。
    log(`\n=== ${actions.length}個のアクションを生成中（並列数: ${concurrency}） ===`);
    const actionResults = await runWithConcurrency(actions, concurrency, async (action, i) => {
        const frameCount = frameCounts[i];
        log(`🪄 [${action}] 開始（${i + 1}/${actions.length}）`);

        let result;
        try {
            result = await generateWithSelfCheck({
                description: `${values.description}\n\nアクション: 「${action}」の動きを表現するドット絵アニメーションです。`,
                width,
                height,
                frameCount,
                paletteLimit,
                loopMode,
                model,
                maxIterations,
                selfCheckEnabled,
                reference,
                onProgress: buildOnProgress({ quiet, logPrefix: `[${action}] ` }),
            });
        } catch (err) {
            return { action, error: err.message || String(err) };
        }

        const project = { width, height, fps, loopMode, palette: result.palette, frames: result.frames };
        const files = await writeProjectFiles(path.join(outDir, action), project);

        return {
            action,
            verdict: result.verdict,
            score: result.score ?? null,
            pixelArtAuthenticity: result.pixelArtAuthenticity ?? null,
            shadingQuality: result.shadingQuality ?? null,
            iterations: result.iterations,
            reasons: result.reasons ?? [],
            concept: result.concept,
            frameCount,
            files,
        };
    });

    const anyError = actionResults.some((r) => r.error);
    const anyNeedsReview = actionResults.some((r) => r.verdict === 'needs_review');

    const summary = {
        description: values.description,
        width,
        height,
        paletteLimit,
        loopMode,
        fps,
        reference: {
            verdict: refResult.verdict,
            score: refResult.score ?? null,
            pixelArtAuthenticity: refResult.pixelArtAuthenticity ?? null,
            shadingQuality: refResult.shadingQuality ?? null,
            iterations: refResult.iterations,
            concept: refResult.concept,
            files: referenceFiles,
        },
        actions: actionResults,
    };

    const summaryPath = path.join(outDir, 'character.json');
    await writeFile(summaryPath, JSON.stringify(summary, null, 2));
    summary.files = { summary: path.resolve(summaryPath) };

    process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
    if (anyError) {
        process.exitCode = 1;
    } else if (anyNeedsReview) {
        process.exitCode = 2;
    }
}

async function main() {
    const [, , command, ...rest] = process.argv;

    if (command === 'generate') {
        await runGenerateCommand(rest);
        return;
    }
    if (command === 'character') {
        await runCharacterCommand(rest);
        return;
    }

    printUsage();
    process.exitCode = command ? 1 : 0;
}

main().catch((err) => {
    fail(err.stack || err.message || String(err));
});
