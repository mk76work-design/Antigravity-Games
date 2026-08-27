// qa.js — 生成されたドット絵アニメーションの機械的な品質チェック（ヒューリスティック）
//
// AIエージェントが自分の出力を自律的に検証・修正できるよう、
// API呼び出しなしで即座に判定できる問題を洗い出す。
// ここで検出した問題文はそのまま次の生成プロンプトへのフィードバックとして使う。

export function pixelDiffRatio(a, b) {
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) diff++;
    }
    return diff / a.length;
}

export function runHeuristicChecks({ width, height, palette, frames, loopMode }) {
    const issues = [];
    const total = width * height;

    // 1. パレット使用率
    const used = new Set();
    frames.forEach((f) => f.forEach((v) => { if (v !== -1) used.add(v); }));
    if (used.size === 0) {
        issues.push('すべてのフレームが空（透明）です。モチーフが全く描かれていません。');
    } else {
        const unusedCount = palette.length - used.size;
        if (unusedCount > Math.max(1, Math.ceil(palette.length * 0.5))) {
            issues.push(`パレット${palette.length}色のうち${unusedCount}色がどのフレームでも使われていません。宣言した色数に見合った塗り分けをしてください。`);
        }
    }

    // 2. フレームごとの空白率（描き忘れ検出）
    frames.forEach((f, i) => {
        const transparentCount = f.reduce((n, v) => (v === -1 ? n + 1 : n), 0);
        const ratio = transparentCount / total;
        if (ratio > 0.97) {
            issues.push(`フレーム${i + 1}がほぼ空白です（透明率${Math.round(ratio * 100)}%）。モチーフをきちんと描いてください。`);
        }
    });

    // 3. フレーム間の一貫性（変化なし・ほぼ変化なし / 変化しすぎ）
    // 「ほぼ変化なし」は実機テストで観測された失敗パターン: 画像レビューで
    // 「フレーム間の一貫性を保て」という指摘に対し、AIがフレームをほぼ同一にする
    // ことで帳尻を合わせてしまい、動き自体が消えてしまうケースがあった。
    // これをAPI呼び出し不要のヒューリスティックで安く早期に検出する。
    const NEAR_DUPLICATE_THRESHOLD = 0.03;
    for (let i = 0; i < frames.length - 1; i++) {
        const diff = pixelDiffRatio(frames[i], frames[i + 1]);
        if (diff < NEAR_DUPLICATE_THRESHOLD) {
            issues.push(`フレーム${i + 1}とフレーム${i + 2}がほぼ同一です（差分${(diff * 100).toFixed(1)}%）。これではアニメーションとして動きがほぼ見えません。輪郭・重心・影のいずれかで明確な変化をつけてください（フレームを同一にして「一貫性」の指摘を回避するのは不可）。`);
        } else if (diff > 0.85) {
            issues.push(`フレーム${i + 1}とフレーム${i + 2}の差分が大きすぎます（${Math.round(diff * 100)}%のピクセルが変化）。同一モチーフの自然な動きになるよう調整してください。`);
        }
    }

    // 4. ループ時の始点・終点のつながり
    if (loopMode === 'loop' && frames.length > 1) {
        const wrapDiff = pixelDiffRatio(frames[frames.length - 1], frames[0]);
        if (wrapDiff > 0.85) {
            issues.push(`ループ再生の指定ですが、最終フレームと先頭フレームの差分が大きすぎます（${Math.round(wrapDiff * 100)}%）。ループがつながるように調整してください。`);
        }
    }

    return issues;
}
