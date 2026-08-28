// core.js — 環境非依存のプロンプト構築・スキーマ検証・自己チェックパイプライン本体。
//
// DOM・fetch・localStorageに一切依存しない。ブラウザ側（aiClient.js）からも、
// Node製CLI（server/agentCore.js 経由）からも、この同じロジックを共有する。
// 呼び出し元は `callClaude({ system, userText, tool, maxTokens }) -> Promise<object>`
// と、自己レビュー用に `renderReviewImage(project) -> string(base64 PNG)` を注入する。
//
// これにより「AIエージェントが人間の手を介さず、ブラウザなしで一気通貫に
// ドット絵アニメーションを作成・自己検証・自己修正できる」ことを、
// ブラウザUIとCLIの両方で同一の保証（同じ品質ルール・同じ自己チェックロジック）
// のもとに実現する。

import { runHeuristicChecks } from './qa.js';

export const DEFAULT_MODEL = 'claude-sonnet-5';
export const DEFAULT_MAX_ITERATIONS = 3;

// ドット絵の「品質」を左右する演出ルール。
// Documents/Sakurai_Knowledge/F_Graphics.md の思想（光と影の重視・視認性優先・
// 過剰なディテールの排除）をドット絵向けに翻案したもの。
//
// 目標クオリティ: スーパーファミコン(16bit)時代のRPG/アクションゲームの
// キャラクタースプライト水準。単色べた塗り＋1色シャドウの「ファミコン以下」の
// 品質ではなく、複数階調のシェーディングとカラーリニアートを使いこなす、
// 当時のトップクラスのドッターが手がけたスプライトに匹敵する仕上がりを狙う。
//
// 最優先事項: 「ちゃんとドット絵に見えること」。技術的にスキーマを満たしていても、
// ランダムなノイズの寄せ集めのように見えたり、意図が読めない配置になっていては
// 意味がない。この一点を他の何よりも重視すること。
export const STYLE_GUIDE = `あなたは熟練のドット絵アニメーター（ピクセルアーティスト）です。
目標は「スーパーファミコン(16bit)時代の高品質なキャラクタースプライト」に匹敵する
仕上がりです。技術仕様（サイズ・フレーム数・色数）を満たすことよりも、この見た目の
説得力を最優先してください。

## 「ドット絵らしく見える」ための絶対ルール（最優先）
- 孤立したピクセル（隣接する4方向のどこにも同じ・近い色がない1px単独の点）を作らない。
  これは最も「ドット絵に見えない・ノイズっぽい」原因になる。意図的なハイライトの1点は
  例外だが、それ以外の孤立ピクセルは禁止。
- 塗り面は最低でも2〜3ピクセル程度のまとまった塊で構成し、線は連続したピクセルの並びで
  描く（ギザギザに途切れた線や、飛び石状の配置は不可）。
- シルエットの輪郭線は「意図的な階段状（ピクセル特有のジグザグ）」にし、なめらかに
  見せようとして中間色を無秩序に足さない（アンチエイリアスのかけすぎはドット絵らしさを壊す）。
- 各パーツ（頭・胴体・手足・装飾など）は面としてまとまり、全体で1つの塊として
  シルエットが読めること。バラバラのパーツの寄せ集めに見えてはいけない。

## スーパーファミコン水準のシェーディング（クオリティの核心）
「ファミコン以下」に見える最大の原因は、1色ベタ塗り＋1トーンの影だけで済ませてしまう
ことです。以下を徹底し、単色フラットな塗りを避けてください。
- 主要な色（肌・服・髪・装飾等）はそれぞれ**最低3〜4階調**で構成する:
  最明部(ハイライト) → ベーストーン → シャドウ → 深いシャドウ/アンビエントオクルージョン。
  「明るい面・普通の面・暗い面」を単純に塗り分けるのではなく、球体や円柱を意識して
  光源からの距離に応じてなだらかに階調を変化させ、立体感（フォルムシェーディング）を出す。
- 輪郭線は原則として黒一色にしない。**カラーリニアート（selective outlining）**を基本とし、
  各パーツの色相を保ったまま彩度・明度を落とした濃い色を輪郭線に使う（例: 赤い服の輪郭は
  黒ではなく暗い赤茶）。純粋な黒は、目・瞳孔・最も深い影・パーツ同士の境界を強調したい
  箇所などキーとなる部分にのみ使う。
- ハイライトは光源方向に沿って一貫させ、面ごとの向き（正面/側面/上面）で強さを変える。
  金属・革・布などの質感差も、ハイライトの鋭さ（点状か面状か）で描き分けるとよい。
- 大きな面のグラデーションでバンディングが目立つ場合は、荒すぎないパターン化した
  ディザリング（市松や斜めパターン）を階調の境目に薄く使ってよい。ただし16px四方以下の
  小さなキャンバスや、小さなパーツには使わない（潰れて汚く見えるため）。
- 接地影・アンビエントオクルージョン（パーツ同士が重なる部分の陰）を必ず入れ、
  キャラクターが平面ではなく立体として地面に立っている説得力を出す。

## アニメーションの質（12原則を意識する）
- タメ（アンティシペーション）: 動作の直前に逆方向へわずかに沈み込む・溜めるフレームを
  入れ、動きの予備動作を表現する。
- フォロースルー・追従: 髪・マント・耳・武器・装飾など体の主要部位より軽い/柔らかい
  パーツは、本体の動きに1〜2フレーム遅れてついてくるようにし、単純な剛体の平行移動に
  しない。
- イーズイン/イーズアウト: 動きの始まりと終わりは変化量を小さく、中間は変化量を大きくし、
  一定速度の機械的な動きに見せない（フレーム数が許す範囲で）。
- 推奨フレーム数の目安: 待機(idle)は呼吸や瞬きが伝わる3〜4枚以上、歩行は片脚ずつの
  接地・振り出しが分かる6〜8枚、攻撃等の一撃動作はタメ・発生・持続・戻りが分かる
  4枚以上を目安にする（指定されたフレーム数の範囲内で、動きの説得力を最大化すること）。
- 重心（頭・胴体の基準位置）は指定された動き以外でガタつかせない。フレーム間で
  意図しない左右・上下のドリフトを起こさない。

## その他の演出ルール
- シルエット最優先: 輪郭だけでモチーフが分かるよう、ネガティブスペースを意識する。
- 色数は指定された上限以下に収める。上記のシェーディング階調を優先的に色数へ割り当てる
  （装飾の細部より、主要パーツの階調を充実させることを優先する）。
- 中心のモチーフ以外の背景・装飾は最小限にし、動きの主役から視線を逸らさない。
- 各フレームは同じキャンバスサイズ・同じパレットを使う。`;

export function buildToolSchema(width, height, frameCount, paletteLimit) {
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

export function buildSingleFrameToolSchema(width, height) {
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

export function buildCritiqueToolSchema() {
    return {
        name: 'emit_critique',
        description: '生成されたドット絵アニメーションのスプライトシート画像を、依頼内容と品質基準に照らして評価する。',
        input_schema: {
            type: 'object',
            properties: {
                pixelArtAuthenticity: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 10,
                    description: '最重要項目。「本物のレトロゲーム/インディーゲームのドット絵スプライトに見えるか」の評価（10が最高）。孤立ノイズピクセル・意図が読めない配置・アンチエイリアスのかけすぎで輪郭がぼやけている・パーツがバラバラに見える、などがあれば厳しく減点する。技術仕様（サイズ/フレーム数/色数）を満たしていても、これが低ければ全体は不合格。',
                },
                shadingQuality: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 10,
                    description: 'スーパーファミコン(16bit)水準のシェーディング表現力の評価（10が最高）。主要パーツ（肌・服・髪等）に最低3〜4階調のグラデーション（ハイライト/ベース/シャドウ/深いシャドウ）があるか、輪郭線が黒一色べったりではなくカラーリニアート（色相を保った暗い輪郭）を使えているか、光源に沿った立体的な陰影（フォルムシェーディング）になっているかを厳しく評価する。単色ベタ塗り＋1トーンの影だけの「ファミコン以下」の表現は低評価にすること。',
                },
                score: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 10,
                    description: '品質スコア（10が最高）。発注内容が伝わり、シルエットが読め、フレーム間の一貫性があれば7以上。',
                },
                verdict: {
                    type: 'string',
                    enum: ['approve', 'needs_fix'],
                    description: 'pixelArtAuthenticity・shadingQuality・score の3つ全てが7以上かつ致命的な問題がなければ approve。いずれか1つでも7未満なら needs_fix。',
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
            required: ['pixelArtAuthenticity', 'shadingQuality', 'score', 'verdict', 'issues'],
        },
    };
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

function parseAnimationResult(result, { width, height, frameCount, paletteLimit }) {
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

// キャラクターセット（同一キャラの複数アクション）を作る際、既に確定した基準デザイン
// （1枚のリファレンスポーズ）を後続のアクション生成に見せて、配色・プロポーション・
// 画風の一貫性を保たせるためのブロック。reference が渡されなければ何も付与しない。
function buildReferenceBlock({ palette, pixels, width, height } = {}) {
    if (!palette || !pixels) return '';
    const rows = [];
    for (let y = 0; y < height; y++) rows.push(pixels.slice(y * width, (y + 1) * width));
    const paletteText = palette.map((hex, i) => `${i}: ${hex}`).join(', ');
    return `

# キャラクターの基準デザイン（必ず一貫性を保つこと）
これは同一キャラクターの別アクションです。以下の基準ポーズと同じ配色・プロポーション・
画風を維持してください。パレットは基本的にそのまま使い、新色は必要最小限にとどめること
（描くモチーフ自体は基準ポーズをそのままなぞるのではなく、指定されたアクションの動きに
合わせて自然に変形・動かしてよい）。
基準パレット（インデックス: 色）: ${paletteText}
基準ポーズのピクセルグリッド（幅${width}×高さ${height}、palette index、透明は-1）:
${JSON.stringify(rows)}`;
}

export async function generateAnimation({ description, width, height, frameCount, paletteLimit, loopMode, reference, callClaude }) {
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
- ${loopHint}${buildReferenceBlock(reference)}

emit_pixel_animation ツールを使って、上記の仕様を満たすドット絵アニメーションを出力してください。`;

    const result = await callClaude({ system: STYLE_GUIDE, userText, tool });
    return parseAnimationResult(result, { width, height, frameCount, paletteLimit });
}

// 直前の生成結果（実際のピクセルデータ）を「正解」として渡し、指摘された問題だけを
// 直させる。フィードバックのテキストだけを頼りに白紙から再生成すると、直したはずの
// 箇所が直らず同じ指摘を繰り返す・関係ない箇所まで変わってしまう、という実機テストで
// 観測された問題への対処。ピクセル単位の正確な現状を見せることで、修正を的確にする。
export async function refineAnimation({ description, width, height, frameCount, paletteLimit, loopMode, palette, frames, issues, callClaude }) {
    const tool = buildToolSchema(width, height, frameCount, paletteLimit);
    const paletteText = palette.map((hex, i) => `${i}: ${hex}`).join(', ');
    const framesText = frames
        .map((flat, i) => {
            const rows = [];
            for (let y = 0; y < height; y++) rows.push(flat.slice(y * width, (y + 1) * width));
            return `フレーム${i + 1}:\n${JSON.stringify(rows)}`;
        })
        .join('\n\n');
    const issuesText = issues.map((s, i) => `${i + 1}. ${s}`).join('\n');

    const userText = `${STYLE_GUIDE}

# 元の発注内容
${description}

# 仕様
- キャンバスサイズ: 幅 ${width}px × 高さ ${height}px
- フレーム数: ちょうど ${frameCount} 枚
- パレット上限: ${paletteLimit} 色

# 現在のパレット（インデックス: 色）
${paletteText}

# 現在の全フレーム（修正前・実際のピクセルデータ。0始まりのpalette index、透明は-1）
${framesText}

# 修正すべき問題点
${issuesText}

上記の「現在の全フレーム」を出発点として、指摘された問題点だけをピクセル単位で修正してください。
- 問題点に関係しないピクセルはできる限りそのまま維持すること（無関係な描き直しはしない）。
- パレットも基本的にそのまま使うこと。どうしても必要な場合のみ新しい色を追加してよい（上限 ${paletteLimit} 色）。
- 「フレーム間の一貫性がない」という指摘への対処として、フレームをほぼ同一にして誤魔化すのは禁止。
  それでは動き自体が消え、発注内容の要求（アニメーションとして動きが見えること）を満たせなくなる。
  一貫性は保ちつつも、フレーム間で意図した動き（重心・輪郭・影の変化など）が明確に分かる状態を維持すること。
- 修正後の完全なアニメーション（全${frameCount}フレーム）を emit_pixel_animation ツールで出力すること。`;

    const result = await callClaude({ system: STYLE_GUIDE, userText, tool });
    return parseAnimationResult(result, { width, height, frameCount, paletteLimit });
}

export async function regenerateFrame({ description, width, height, palette, neighborFrames, frameIndex, callClaude }) {
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

export async function critiqueAnimation({ description, width, height, frameCount, loopMode, imageBase64, callClaude }) {
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
（拡大表示・透明部分は市松模様）です。これを自分自身の作品として厳しく採点してください。
**最優先で確認すること（この2点だけで合否が決まると言ってよい）:**
1. **pixelArtAuthenticity** — 本物のドット絵ゲームのスプライトに見えるか。孤立したノイズ
   ピクセル、意図の読めない配置、輪郭のぼやけ、パーツがバラバラに見える、といった問題が
   ないか拡大して細部まで確認すること。
2. **shadingQuality** — スーパーファミコン(16bit)水準のシェーディングになっているか。
   主要パーツに3〜4階調のグラデーションがあるか、輪郭線が黒一色べったりでなくカラー
   リニアートになっているか、光源に沿った立体的な陰影か。単色ベタ塗り＋1トーンの影
   だけの「ファミコン以下」の表現になっていないか厳しく見ること。

それに加えて:
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
    if (
        typeof result.pixelArtAuthenticity !== 'number'
        || typeof result.shadingQuality !== 'number'
        || typeof result.score !== 'number'
        || !['approve', 'needs_fix'].includes(result.verdict)
        || !Array.isArray(result.issues)
    ) {
        throw new Error('AIエージェントのレビュー応答が不正な形式です。');
    }

    // モデルがプロンプトの指示（3つとも7以上でなければapproveしない）を守らなかった場合の
    // 保険として、コード側でも同じ基準を強制する。
    if (result.verdict === 'approve' && (result.pixelArtAuthenticity < 7 || result.shadingQuality < 7 || result.score < 7)) {
        result.verdict = 'needs_fix';
        if (result.issues.length === 0) {
            result.issues = [{
                problem: `品質評価が低いにもかかわらず承認判定でした（pixelArtAuthenticity: ${result.pixelArtAuthenticity}/10, shadingQuality: ${result.shadingQuality}/10, score: ${result.score}/10）。`,
                suggestion: '孤立したノイズピクセル・意図の読めない配置・輪郭のぼやけがないか、また主要パーツに3〜4階調のグラデーションとカラーリニアートがあるか見直し、スーパーファミコン水準のスプライトに見えるよう整えてください。',
            }];
        }
    }

    return result;
}

// AIエージェントが「生成 → ヒューリスティック検証 → 画像による自己レビュー →
// （必要なら）直前の実データを基にした修正」を自律的に繰り返すパイプライン。
// 人間の確認・修正回数を減らすことが目的なので、途中経過は onProgress で
// ログとして流すのみとし、判断は最大イテレーション到達時にのみ求める。
//
// 2回目以降のイテレーションは、白紙から「フィードバック文つき説明」で再生成するのではなく、
// 直前のピクセルデータをそのまま渡して問題点だけ直させる refineAnimation() を使う。
// 実機テストで、テキストの指摘だけを頼りに毎回描き直すと同じ問題（フレーム間の重心ズレ等）
// を再現し続けてしまうことが分かったため、正確な現状を見せて的確に直させる方式にした。
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
    reference,
    callClaude,
    renderReviewImage,
}) {
    let priorResult = null;
    let issuesToFix = null;

    for (let iteration = 1; iteration <= maxIterations; iteration++) {
        onProgress({ type: 'generating', iteration, maxIterations });

        const result = priorResult && issuesToFix
            ? await refineAnimation({
                description,
                width,
                height,
                frameCount,
                paletteLimit,
                loopMode,
                palette: priorResult.palette,
                frames: priorResult.frames,
                issues: issuesToFix,
                callClaude,
            })
            : await generateAnimation({ description, width, height, frameCount, paletteLimit, loopMode, reference, callClaude });

        priorResult = result;
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
                issuesToFix = heuristicIssues;
                continue;
            }
            return { ...base, verdict: 'needs_review', reasons: heuristicIssues };
        }

        onProgress({ type: 'vision-reviewing', iteration, maxIterations });
        let critique;
        try {
            const imageBase64 = await renderReviewImage(project);
            critique = await critiqueAnimation({ description, width, height, frameCount, loopMode, imageBase64, callClaude });
        } catch (err) {
            // 画像レビュー自体が失敗した場合は、ヒューリスティック合格をもって承認扱いにする
            // （手戻りを増やさないことを優先し、ここで停止させない）。
            onProgress({ type: 'vision-review-error', iteration, maxIterations, message: err.message });
            return { ...base, verdict: 'approved-heuristic-only' };
        }

        if (critique.verdict === 'approve') {
            onProgress({ type: 'done', iteration, maxIterations, verdict: 'approved', score: critique.score, pixelArtAuthenticity: critique.pixelArtAuthenticity, shadingQuality: critique.shadingQuality });
            return { ...base, verdict: 'approved', score: critique.score, pixelArtAuthenticity: critique.pixelArtAuthenticity, shadingQuality: critique.shadingQuality };
        }

        const reasons = critique.issues.map((i) => `${i.problem} → ${i.suggestion}`);
        const isLast = iteration >= maxIterations;
        onProgress({ type: 'vision-needs-fix', iteration, maxIterations, score: critique.score, pixelArtAuthenticity: critique.pixelArtAuthenticity, shadingQuality: critique.shadingQuality, issues: critique.issues, willRetry: !isLast });
        if (!isLast) {
            issuesToFix = reasons;
            continue;
        }
        return { ...base, verdict: 'needs_review', reasons, score: critique.score, pixelArtAuthenticity: critique.pixelArtAuthenticity, shadingQuality: critique.shadingQuality };
    }

    // ここには到達しない想定(ループ内で必ず return する)が、念のため。
    throw new Error('自己チェックパイプラインが異常終了しました。');
}
