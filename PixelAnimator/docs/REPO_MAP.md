# Pixel Animator — モジュールマップ

> 最終更新: 2026-08-26

## モジュール依存関係

```
main.js
├── state.js       ← createEmptyProject(), ProjectStore
├── aiClient.js    ← generateAnimation(), regenerateFrame(), getApiKey()/setApiKey(),
│                     getModel()/setModel()
├── renderer.js    ← drawFrame(), renderPaletteStrip(), renderFrameStrip()
├── animator.js    ← Animator
├── editor.js      ← PixelEditor
└── exporter.js    ← exportSpritesheetPng(), exportAnimatedGif(), exportProjectJson(),
                      parseProjectJson()
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
- `regenerateFrame({ description, width, height, palette, neighborFrames, frameIndex })`
  → 1フレーム分の `pixels`（フラット配列）
  - `emit_single_frame` ツールを使い、既存パレット・隣接フレームとの一貫性を保って
    1枚だけ再生成する。
- `STYLE_GUIDE` — ドット絵の品質ルール（シルエット優先・光源統一・色数厳守など）を
  system prompt として全呼び出しに付与。

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
- `exportSpritesheetPng(project)` — 等倍・横並びのスプライトシートPNG
- `exportAnimatedGif(project)` — gifenc による透過対応アニメーションGIF
- `exportProjectJson(project)` / `parseProjectJson(text)` — プロジェクトの保存/復元
