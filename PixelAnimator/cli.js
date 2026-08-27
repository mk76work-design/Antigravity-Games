#!/usr/bin/env node
// cli.js — AIエージェントがブラウザを介さず直接ドット絵アニメーションを生成するための
// コマンドラインインターフェース。
//
// このツールの主目的は「AIエージェント自身がドット絵・ドット絵アニメーションの作成を
// 一気通貫で行えるようにする」こと。人間はブラウザUI（npm run dev）で軽い手直しや
// 最終確認をするだけでよく、生成・自己検証・自己修正はこのCLI一本で完結する。
//
// 使い方:
//   node cli.js generate --prompt "<説明>" --out <出力先パスの接頭辞> [オプション]
//
// stdout には機械可読なJSON結果だけを出力する（人間向けの進行状況ログは全てstderr）。
// 終了コード: 0=自己チェック合格（またはスキップ）、1=実行時エラー、
//            2=生成は完了したが自己チェックを通過できず要確認（needs_review）。

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

生成すると <out>.png（等倍スプライトシート）, <out>.gif（アニメーションGIF）,
<out>.json（プロジェクトデータ、ブラウザ版で読み込み・手直し可能）を書き出す。

オプション:
  --prompt <text>              必須。どんなアニメーションが欲しいかの説明。
  --out <path>                 必須。出力ファイルの接頭辞。
  --width <px>                 キャンバス幅（デフォルト 24）
  --height <px>                キャンバス高さ（デフォルト --width と同じ）
  --frames <n>                 フレーム数（デフォルト 6）
  --palette <n>                パレット上限色数（デフォルト 12）
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
`);
}

async function main() {
    const [, , command, ...rest] = process.argv;

    if (command !== 'generate') {
        printUsage();
        process.exitCode = command ? 1 : 0;
        return;
    }

    let values;
    try {
        ({ values } = parseArgs({
            args: rest,
            options: {
                prompt: { type: 'string' },
                out: { type: 'string' },
                width: { type: 'string', default: '24' },
                height: { type: 'string' },
                frames: { type: 'string', default: '6' },
                palette: { type: 'string', default: '12' },
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

    const width = Number(values.width);
    const height = Number(values.height || values.width);
    const frameCount = Number(values.frames);
    const paletteLimit = Number(values.palette);
    const loopMode = values.loop;
    const fps = Number(values.fps);
    const model = values.model;
    const maxIterations = Number(values['max-iterations']);
    const selfCheckEnabled = !values['no-self-check'];

    if (!['loop', 'pingpong', 'once'].includes(loopMode)) {
        fail(`--loop は loop / pingpong / once のいずれかを指定してください（指定値: ${loopMode}）。`);
        return;
    }
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
        fail('--width / --height は正の整数で指定してください。');
        return;
    }
    if (!Number.isInteger(frameCount) || frameCount < 1) {
        fail('--frames は1以上の整数で指定してください。');
        return;
    }

    const onProgress = values.quiet ? () => {} : (event) => {
        const tag = `[${event.iteration}/${event.maxIterations}]`;
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
                log(`📝 ${tag} 自己採点 ${event.score}/10 → 修正: ${event.issues.map((i) => i.problem).join(' / ')}`);
                break;
            case 'done':
                if (event.verdict === 'approved') log(`✅ ${tag} 自己チェック合格（スコア ${event.score}/10）。`);
                break;
        }
    };

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
            onProgress,
        });
    } catch (err) {
        fail(err.message || String(err));
        return;
    }

    const project = { width, height, fps, loopMode, palette: result.palette, frames: result.frames };

    const outDir = path.dirname(path.resolve(values.out));
    await mkdir(outDir, { recursive: true });

    const pngPath = `${values.out}.png`;
    const gifPath = `${values.out}.gif`;
    const jsonPath = `${values.out}.json`;

    await writeFile(pngPath, buildNativeSpritesheetPng(project));
    await writeFile(gifPath, buildAnimatedGif(project));
    await writeFile(jsonPath, JSON.stringify({ type: 'pixel-animator-project', version: 1, ...project }, null, 2));

    const summary = {
        verdict: result.verdict,
        score: result.score ?? null,
        iterations: result.iterations,
        reasons: result.reasons ?? [],
        concept: result.concept,
        width,
        height,
        frameCount,
        paletteLimit,
        loopMode,
        fps,
        files: {
            png: path.resolve(pngPath),
            gif: path.resolve(gifPath),
            json: path.resolve(jsonPath),
        },
    };

    process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
    if (result.verdict === 'needs_review') {
        process.exitCode = 2;
    }
}

main().catch((err) => {
    fail(err.stack || err.message || String(err));
});
