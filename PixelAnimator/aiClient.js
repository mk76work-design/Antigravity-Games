// aiClient.js — Anthropic API 呼び出し、プロンプト構築、レスポンス検証、自己チェックパイプライン
//
// API キーはユーザー自身のものを localStorage に保存し、ブラウザから直接
// Anthropic API を叩く（anthropic-dangerous-direct-browser-access ヘッダ使用）。
// キーは Anthropic API 以外のどこにも送信しない。
//
// 「ユーザーのチェック・修正回数を減らす」ことが最優先の設計目標。そのため
// generateWithSelfCheck() は、生成 → ヒューリスティック検証 → AIによる画像レビュー →
// （問題があれば）フィードバックを添えて再生成、を最大イテレーション回数まで
// AIエージェント自身の中で完結させ、ユーザーには基本的に最終結果だけを見せる。

import { runHeuristicChecks } from './qa.js';
import { getReviewSpritesheetBase64 } from './exporter.js';

const API_URL = 'https://api.anthropic.com/v1/messages';
const KEY_STORAGE = 'pixelAnimator.apiKey';
const MODEL_STORAGE = 'pixelAnimator.model';
const SELF_CHECK_STORAGE = 'pixelAnimator.selfCheckEnabled';
const MAX_ITERATIONS_STORAGE = 'pixelAnimator.maxIterations';
const DEFAULT_MODEL = 'claude-sonnet-5';
const DEFAULT_MAX_ITERATIONS = 3;

export function getApiKey() {
    return localStorage.getItem(KEY_STORAGE) || '';
}

export function setApiKey(key) {
    if (key) localStorage.setItem(KEY_STORAGE, key);
    else localStorage.removeItem(KEY_STORAGE);
}

export function getModel() {
    return localStorage.getItem(MODEL_STORAGE) || DEFAULT_MODEL;
}

export function setModel(model) {
    localStorage.setItem(MODEL_STORAGE, model || DEFAULT_MODEL);
}

export function getSelfCheckEnabled() {
    const v = localStorage.getItem(SELF_CHECK_STORAGE);
    return v === null ? true : v === '1';
}

export function setSelfCheckEnabled(enabled) {
    localStorage.setItem(SELF_CHECK_STORAGE, enabled ? '1' : '0');
}

export function getMaxIterations() {
    const v = Number(localStorage.getItem(MAX_ITERATIONS_STORAGE));
    return Number.isInteger(v) && v >= 1 && v <= 5 ? v : DEFAULT_MAX_ITERATIONS;
}

export function setMaxIterations(n) {
    localStorage.setItem(MAX_ITERATIONS_STORAGE, String(Math.min(5, Math.max(1, Math.round(n) || DEFAULT_MAX_ITERATIONS))));
}

// ドット絵の「品質」を左右する演出ルール。
// Documents/Sakurai_Knowledge/F_Graphics.md の思想（光と影の重視・視認性優先・
// 過剰なディテールの排除）をドット絵向けに翻案したもの。
const STYLE_GUIDE = `あなたは熟練のドット絵アニメーター（ピクセルアーティスト）です。
以下のルールを厳守して、小さな解像度でも「読める」高品質なドット絵アニメーションを設計してください。

- シルエット最優先: 輪郭だけでモチーフが分かるよう、ネガティブスペースを意識する。
- 光源を1つに決め、明部・陰影・アンビエントオクルージョン(接地影)を最小限のトーンで表現する。
- 色数は指定された上限以下に収め、同一トーン内のグラデーション（バンディング回避のための中間色）を活用する。
- ディザリングは多用しない。小さい面積では単色の方が視認性が高い。
- アニメーションはタメ（アンティシペーション）とオーバーシュートを意識し、フレーム間の動きが自然につながるようにする。
- 中心のモチーフ以外の背景・装飾は最小限にし、動きの主役から視線を逸らさない。
- 各フレームは同じキャンバスサイズ・同じパレットを使い、キャラクターの軸（重心）がガタつかないようにする。`;

function buildToolSchema(width, height, frameCount, paletteLimit) {
    return {
        name: 'emit_pixel_animation',
        description: 'ドット絵アニメーションをパレットとフレームごとのピクセルグリッドとして出力する。',
        input_schema: {
            type: 'object',
            properties: {
                concept: {
                    type: 'string',
                    description: 'このアニメーションのデザイン意図を1〜2文で説明する。',
                },
                palette: {
                    type: 'array',
                    description: `使用する色のリスト（#rrggbb形式）。最大 ${paletteLimit} 色。`,
                    items: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
                    minItems: 1,
                    maxItems: paletteLimit,
                },
                frames: {
                    type: 'array',
                    description: `アニメーションを構成するフレーム。必ずちょうど ${frameCount} 個。`,
                    minItems: frameCount,
                    maxItems: frameCount,
                    items: {
                        type: 'object',
                        properties: {
                            pixels: {
                                type: 'array',
                                description: `高さ ${height} × 幅 ${width} の2次元配列。各値は palette のインデックス（0始まり）、透明なら -1。`,
                                minItems: height,
                                maxItems: height,
                                items: {
                                    type: 'array',
                                    minItems: width,
                                    maxItems: width,
                                    items: { type: 'integer', minimum: -1 },
                                },
                            },
                        },
                        required: ['pixels'],
                    },
                },
            },
            required: ['palette', 'frames'],
        },
    };
}

function buildSingleFrameToolSchema(width, height) {
    return {
        name: 'emit_single_frame',
        description: '既存のパレットを使って、1枚のドット絵フレームをピクセルグリッドとして出力する。',
        input_schema: {
            type: 'object',
            properties: {
                pixels: {
                    type: 'array',
                    description: `高さ ${height} × 幅 ${width} の2次元配列。各値は既存パレットのインデックス、透明なら -1。`,
                    minItems: height,
                    maxItems: height,
                    items: {
                        type: 'array',
                        minItems: width,
                        maxItems: width,
                        items: { type: 'integer', minimum: -1 },
                    },
                },
            },
            required: ['pixels'],
        },
    };
}

function buildCritiqueToolSchema() {
    return {
        name: 'emit_critique',
        description: '生成されたドット絵アニメーションのスプライトシート画像を、依頼内容と品質基準に照らして評価する。',
        input_schema: {
            type: 'object',
            properties: {
                score: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 10,
                    description: '品質スコア（10が最高）。発注内容が伝わり、シルエットが読め、フレーム間の一貫性があれば7以上。',
                },
                verdict: {
                    type: 'string',
                    enum: ['approve', 'needs_fix'],
                    description: 'スコアが7以上かつ致命的な問題がなければ approve。それ以外は needs_fix。',
                },
                issues: {
                    type: 'array',
                    description: 'needs_fix の場合の具体的な修正指示のリスト。approve の場合は空配列でよい。',
                    items: {
                        type: 'object',
                        properties: {
                            problem: { type: 'string', description: '見つかった具体的な問題。' },
                            suggestion: { type: 'string', description: 'どう直すべきかの具体的な指示。' },
                        },
                        required: ['problem', 'suggestion'],
                    },
                },
            },
            required: ['score', 'verdict', 'issues'],
        },
    };
}

async function callClaude({ system, userText, tool, maxTokens = 16000 }) {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error('APIキーが未設定です。右上の「設定」からAnthropic APIキーを入力してください。');
    }

    const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
            model: getModel(),
            max_tokens: maxTokens,
            system,
            messages: [{ role: 'user', content: userText }],
            tools: [tool],
            tool_choice: { type: 'tool', name: tool.name },
        }),
    });

    if (!res.ok) {
        let detail = '';
        try {
            const errBody = await res.json();
            detail = errBody?.error?.message || JSON.stringify(errBody);
        } catch {
            detail = await res.text();
        }
        throw new Error(`Anthropic API エラー (${res.status}): ${detail}`);
    }

    const data = await res.json();
    const toolUse = data.content?.find((block) => block.type === 'tool_use' && block.name === tool.name);
    if (!toolUse) {
        throw new Error('AIエージェントの応答から構造化データを取得できませんでした。もう一度試してください。');
    }
    return toolUse.input;
}

function validateGrid(pixels, width, height, paletteLength, label) {
    if (!Array.isArray(pixels) || pixels.length !== height) {
        throw new Error(`${label}: 行数が一致しません（期待 ${height} 行）。`);
    }
    for (const row of pixels) {
        if (!Array.isArray(row) || row.length !== width) {
            throw new Error(`${label}: 列数が一致しません（期待 ${width} 列）。`);
        }
        for (const v of row) {
            if (!Number.isInteger(v) || v < -1 || v >= paletteLength) {
                throw new Error(`${label}: 不正なピクセル値 ${v} を検出しました。`);
            }
        }
    }
}

function flattenGrid(pixels, width, height) {
    const flat = new Array(width * height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            flat[y * width + x] = pixels[y][x];
        }
    }
    return flat;
}

export async function generateAnimation({ description, width, height, frameCount, paletteLimit, loopMode }) {
    const tool = buildToolSchema(width, height, frameCount, paletteLimit);
    const loopHint = {
        loop: 'このアニメーションはループ再生される。最終フレームから先頭フレームへ違和感なくつながるようにする。',
        pingpong: 'このアニメーションは往復（最終フレームまで進んだら逆再生で戻る）で再生される。',
        once: 'このアニメーションは1回だけ再生される。最後のフレームで動きが自然に収まるようにする。',
    }[loopMode] || '';

    const userText = `${STYLE_GUIDE}

# 発注内容
${description}

# 仕様
- キャンバスサイズ: 幅 ${width}px × 高さ ${height}px
- フレーム数: ちょうど ${frameCount} 枚
- パレット上限: ${paletteLimit} 色
- ${loopHint}

emit_pixel_animation ツールを使って、上記の仕様を満たすドット絵アニメーションを出力してください。`;

    const result = await callClaude({ system: STYLE_GUIDE, userText, tool });

    if (!Array.isArray(result.palette) || result.palette.length === 0) {
        throw new Error('AIエージェントの応答にパレットが含まれていません。');
    }
    if (!Array.isArray(result.frames) || result.frames.length !== frameCount) {
        throw new Error(`AIエージェントの応答のフレーム数が仕様と一致しません（期待 ${frameCount} 枚）。`);
    }

    const frames = result.frames.map((f, i) => {
        validateGrid(f.pixels, width, height, result.palette.length, `フレーム${i + 1}`);
        return flattenGrid(f.pixels, width, height);
    });

    return {
        palette: result.palette.slice(0, paletteLimit),
        frames,
        concept: result.concept || '',
    };
}

export async function regenerateFrame({ description, width, height, palette, neighborFrames, frameIndex }) {
    const tool = buildSingleFrameToolSchema(width, height);

    const paletteText = palette.map((hex, i) => `${i}: ${hex}`).join(', ');
    const neighborsText = neighborFrames
        .map(({ index, pixels }) => `フレーム${index + 1}:\n${JSON.stringify(pixels)}`)
        .join('\n\n');

    const userText = `${STYLE_GUIDE}

# 発注内容（アニメーション全体のコンセプト）
${description}

# 仕様
- キャンバスサイズ: 幅 ${width}px × 高さ ${height}px
- 使用可能なパレット（インデックス: 色）: ${paletteText}
- 透明は -1 を使う
- このアニメーションの他フレーム（参考・前後関係の一貫性を保つこと）:
${neighborsText || '（他フレームなし）'}

上記パレットのみを使い、フレーム${frameIndex + 1}を emit_single_frame ツールで再生成してください。
モチーフの位置・輪郭・色使いは他フレームとの連続性を保ってください。`;

    const result = await callClaude({ system: STYLE_GUIDE, userText, tool, maxTokens: 8000 });
    validateGrid(result.pixels, width, height, palette.length, '再生成フレーム');
    return flattenGrid(result.pixels, width, height);
}

async function critiqueAnimation({ description, width, height, frameCount, loopMode, imageBase64 }) {
    const tool = buildCritiqueToolSchema();
    const userText = [
        {
            type: 'text',
            text: `${STYLE_GUIDE}

# 元の発注内容
${description}

# 仕様
- キャンバスサイズ: ${width}px × ${height}px
- フレーム数: ${frameCount}
- ループ種類: ${loopMode}

添付画像は、生成されたドット絵アニメーションのフレームを左から右へ順番に並べたスプライトシート
（拡大表示・透明部分は市松模様）です。これを自分自身の作品として厳しく採点してください。特に:
- 発注内容のモチーフが見て分かるか
- シルエットの視認性
- フレーム間で同一モチーフとして一貫しているか（プロポーションや位置が破綻していないか）
- 指定された色数・配色の範囲内で読みやすいか

emit_critique ツールで採点結果を返してください。`,
        },
        {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: imageBase64 },
        },
    ];

    const result = await callClaude({ system: STYLE_GUIDE, userText, tool, maxTokens: 2000 });
    if (typeof result.score !== 'number' || !['approve', 'needs_fix'].includes(result.verdict) || !Array.isArray(result.issues)) {
        throw new Error('AIエージェントのレビュー応答が不正な形式です。');
    }
    return result;
}

function buildFeedbackText(reasons) {
    return reasons.map((r, i) => `${i + 1}. ${r}`).join('\n');
}

// AIエージェントが「生成 → ヒューリスティック検証 → 画像による自己レビュー →
// （必要なら）フィードバックを添えて再生成」を自律的に繰り返すパイプライン。
// ユーザーの確認・修正回数を減らすことが目的なので、途中経過は onProgress で
// ログとして流すのみとし、人間の判断は最大イテレーション到達時にのみ求める。
export async function generateWithSelfCheck({
    description,
    width,
    height,
    frameCount,
    paletteLimit,
    loopMode,
    maxIterations = DEFAULT_MAX_ITERATIONS,
    selfCheckEnabled = true,
    onProgress = () => {},
}) {
    let feedback = '';

    for (let iteration = 1; iteration <= maxIterations; iteration++) {
        onProgress({ type: 'generating', iteration, maxIterations });
        const composedDescription = feedback
            ? `${description}\n\n# 直前の生成でレビューにより指摘された問題（今回は必ず修正すること）\n${feedback}`
            : description;

        const result = await generateAnimation({
            description: composedDescription,
            width,
            height,
            frameCount,
            paletteLimit,
            loopMode,
        });
        const project = { width, height, fps: 8, loopMode, palette: result.palette, frames: result.frames };
        const base = { palette: result.palette, frames: result.frames, concept: result.concept, iterations: iteration };

        if (!selfCheckEnabled) {
            onProgress({ type: 'done', iteration, maxIterations, verdict: 'skipped' });
            return { ...base, verdict: 'skipped' };
        }

        onProgress({ type: 'heuristic-checking', iteration, maxIterations });
        const heuristicIssues = runHeuristicChecks(project);
        if (heuristicIssues.length > 0) {
            const isLast = iteration >= maxIterations;
            onProgress({ type: 'heuristic-failed', iteration, maxIterations, issues: heuristicIssues, willRetry: !isLast });
            if (!isLast) {
                feedback = buildFeedbackText(heuristicIssues);
                continue;
            }
            return { ...base, verdict: 'needs_review', reasons: heuristicIssues };
        }

        onProgress({ type: 'vision-reviewing', iteration, maxIterations });
        let critique;
        try {
            const imageBase64 = getReviewSpritesheetBase64(project);
            critique = await critiqueAnimation({ description, width, height, frameCount, loopMode, imageBase64 });
        } catch (err) {
            // 画像レビュー自体が失敗した場合は、ヒューリスティック合格をもって承認扱いにする
            // （ユーザーの手戻りを増やさないことを優先し、ここで停止させない）。
            onProgress({ type: 'vision-review-error', iteration, maxIterations, message: err.message });
            return { ...base, verdict: 'approved-heuristic-only' };
        }

        if (critique.verdict === 'approve') {
            onProgress({ type: 'done', iteration, maxIterations, verdict: 'approved', score: critique.score });
            return { ...base, verdict: 'approved', score: critique.score };
        }

        const reasons = critique.issues.map((i) => `${i.problem} → ${i.suggestion}`);
        const isLast = iteration >= maxIterations;
        onProgress({ type: 'vision-needs-fix', iteration, maxIterations, score: critique.score, issues: critique.issues, willRetry: !isLast });
        if (!isLast) {
            feedback = buildFeedbackText(reasons);
            continue;
        }
        return { ...base, verdict: 'needs_review', reasons, score: critique.score };
    }

    // ここには到達しない想定（ループ内で必ず return する）が、念のため。
    throw new Error('自己チェックパイプラインが異常終了しました。');
}
