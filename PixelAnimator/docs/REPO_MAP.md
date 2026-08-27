# Pixel Animator — モジュールマップ

> 最終更新: 2026-08-27

## モジュール依存関係

```
main.js
├── state.js       ← createEmptyProject(), ProjectStore
├── aiClient.js    ← generateWithSelfCheck(), regenerateFrame(),
│                     getApiKey()/setApiKey(), getModel()/setModel(),
│                     getSelfCheckEnabled()/setSelfCheckEnabled(),
│                     getMaxIterations()/setMaxIterations()
│   ├── qa.js       ← runHeuristicChecks() （aiClient内部から呼ばれる）
│   └── exporter.js ← getReviewSpritesheetBase64() （aiClient内部から呼ばれる）
├── renderer.js    ← drawFrame(), renderPaletteStrip(), renderFrameStrip()
├── animator.js    ← Animator
├── editor.js      ← PixelEditor
└── exporter.js    ← exportSpritesheetPng(), exportAnimatedGif(), exportProjectJson(),
                      parseProjectJson(), getReviewSpritesheetBase64()
```

## 主要クラス・関数

### `ProjectStore` (state.js)
- プロジェクト状態: `{ width, height, fps, loopMode, palette, frames }`
  - `frames` は `Int` 値（パレットindex、-1=透明）のフラット配列（`width*height`）の配列
- `onChange(fn)` — 状態変化の購読
- `snapshotBeforeEdit()` / `undo()` / `redo()` — 1ストローク単位のUndo/Redo
- `setPixel(index, value)` / `commitEdit()` — 編集中の書き込みと確定
- `duplicateFrame(i)` / `deleteFrame(i)` / `replaceFrame(i, pixels)`

### `aiClient.js`
- `generateAnimation({ description, width, height, frameCount, paletteLimit, loopMode })`
  → `{ palette, frames, concept }`
  - `emit_pixel_animation` ツールを forced tool_choice で呼び出し、
    パレット配列とフレームごとの2次元ピクセルグリッドを取得・検証・フラット化する。
  - 単発の生成関数。通常はこれを直接使わず `generateWithSelfCheck()` 経由で呼ぶ。
- `regenerateFrame({ description, width, height, palette, neighborFrames, frameIndex })`
  → 1フレーム分の `pixels`（フラット配列）
  - `emit_single_frame` ツールを使い、既存パレット・隣接フレームとの一貫性を保って
    1枚だけ再生成する（ユーザーが手動で「このフレームだけ再生成」を押したときに使用）。
- `critiqueAnimation({ description, width, height, frameCount, loopMode, imageBase64 })`
  → `{ score, verdict, issues }` （内部関数・非export）
  - `emit_critique` ツールを使い、スプライトシート画像をClaudeの画像入力として渡して
    自己採点させる。
- `generateWithSelfCheck({ description, width, height, frameCount, paletteLimit, loopMode, maxIterations, selfCheckEnabled, onProgress })`
  → `{ palette, frames, concept, iterations, verdict, score?, reasons? }`
  - **メインの生成エントリポイント。** 「生成→ヒューリスティック検証→画像による
    自己批評→（必要なら）フィードバックを添えて再生成」を `maxIterations` 回まで
    自律的に繰り返す。`onProgress(event)` で各ステップの状況
    （`generating` / `heuristic-checking` / `heuristic-failed` / `vision-reviewing` /
    `vision-needs-fix` / `vision-review-error` / `done`）を通知する。
  - `verdict` は `approved`（自己チェック合格）/ `approved-heuristic-only`
    （画像レビューAPIが失敗したためヒューリスティック合格のみで確定）/
    `needs_review`（上限到達、ユーザー確認が必要）/ `skipped`（自己チェック無効）。
- `getSelfCheckEnabled()`/`setSelfCheckEnabled()`, `getMaxIterations()`/`setMaxIterations()`
  — 自己チェックのON/OFFと最大イテレーション回数（1〜5、既定3）を `localStorage` で管理。
- `STYLE_GUIDE` — ドット絵の品質ルール（シルエット優先・光源統一・色数厳守など）を
  system prompt として全呼び出しに付与。

### `qa.js`
- `runHeuristicChecks({ width, height, palette, frames, loopMode })` → `string[]`（問題点の文章リスト）
  - API呼び出し不要で即座に判定できる問題を検出: 全フレーム空白、パレット未使用過多、
    フレームがほぼ空白、隣接フレームの差分が0（変化なし）または大きすぎる、
    ループ指定時の始点・終点の不整合。
- `pixelDiffRatio(a, b)` → 2つのフレーム（フラット配列）間で値が異なるピクセルの割合。

### `PixelEditor` (editor.js)
- `setTool('pencil'|'eraser'|'eyedropper'|'bucket')` / `setColor(index)` / `setCellSize(px)`
- `redraw()` — 現在フレームをグリッド線付きで再描画
- `floodFill(startIndex)` — バケツツールの塗りつぶし
- `onColorPicked` — スポイト選択時のコールバック

### `Animator` (animator.js)
- `setProject(project)` / `play()` / `pause()` / `toggle()`
- `loop(now)` — `requestAnimationFrame` ベースのFPS制御ループ
- `advance()` — `loopMode`（loop / pingpong / once）に応じたフレーム送り

### `renderer.js`
- `drawFrame(canvas, pixels, width, height, palette, cellSize)`
- `renderPaletteStrip(container, palette, activeIndex, onSelect)`
- `renderFrameStrip(container, project, currentFrame, onSelect)`

### `exporter.js`
- `exportSpritesheetPng(project)` — 等倍・横並びのスプライトシートPNG（ダウンロード）
- `getReviewSpritesheetBase64(project)` — 拡大・市松模様背景付きのスプライトシートを
  base64 PNGとして返す（ダウンロードはしない）。AIの自己レビュー（`emit_critique`への
  画像入力）専用。シート全体の幅が一定以内に収まるよう拡大率を動的に決める。
- `exportAnimatedGif(project)` — gifenc による透過対応アニメーションGIF
- `exportProjectJson(project)` / `parseProjectJson(text)` — プロジェクトの保存/復元
