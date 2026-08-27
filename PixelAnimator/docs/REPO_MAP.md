# Pixel Animator — モジュールマップ

> 最終更新: 2026-08-27

## モジュール依存関係

```
core.js（環境非依存の本体ロジック・DOM/fetch/localStorage不使用）
├── qa.js  ← runHeuristicChecks()
└── export: buildToolSchema(), buildSingleFrameToolSchema(), buildCritiqueToolSchema(),
            generateAnimation(), refineAnimation(), regenerateFrame(), critiqueAnimation(),
            generateWithSelfCheck(), STYLE_GUIDE, DEFAULT_MODEL, DEFAULT_MAX_ITERATIONS
            （すべて callClaude を、generateWithSelfCheck はさらに renderReviewImage も
             引数として受け取る＝呼び出し側が実行環境に応じた実装を注入する）

cli.js（★AIエージェント向けCLIエントリポイント）
├── server/agentCore.js ← core.js に Node向けの callClaude/renderReviewImage を注入
│   ├── server/claudeApi.js ← handleClaudeApi() をインプロセスで直接呼ぶ（HTTP不使用）
│   │     ↓ execFile('claude', [...])
│   │   ローカルの Claude Code CLI（Pro/Max/Teamサブスクリプション認証）
│   └── server/pngRender.js ← renderReviewImageBase64()（Canvas不使用、pngjsで直接PNG生成）
└── server/pngRender.js ← buildNativeSpritesheetPng(), buildAnimatedGif()（出力ファイル用）

main.js（ブラウザUI・人間の手直し用）
├── state.js       ← createEmptyProject(), ProjectStore
├── aiClient.js    ← core.js に ブラウザ向けの callClaude/renderReviewImage を注入
│   ├── core.js（上記と同じものを共有）
│   ├── exporter.js ← getReviewSpritesheetBase64() （aiClient内部から呼ばれる）
│   └── fetch('/api/claude', ...) / fetch('/api/claude/health')
│         ↓ （Vite開発サーバーのミドルウェア。vite.config.js）
│       server/claudeApi.js ← handleClaudeApi(), checkClaudeCliHealth()
├── renderer.js    ← drawFrame(), renderPaletteStrip(), renderFrameStrip()
├── animator.js    ← Animator
├── editor.js      ← PixelEditor
└── exporter.js    ← exportSpritesheetPng(), exportAnimatedGif(), exportProjectJson(),
                      parseProjectJson(), getReviewSpritesheetBase64()
```

`server/` 配下と `core.js`・`qa.js` はNode専用またはDOM非依存。`cli.js` はこれらだけで
完結し、ブラウザ・Vite開発サーバーを一切必要としない。`aiClient.js`・`renderer.js`・
`animator.js`・`editor.js`・`exporter.js`・`main.js`・`state.js` はブラウザ専用（DOM前提）。

## 主要クラス・関数

### `core.js`（環境非依存の本体ロジック）
- `generateAnimation({ description, width, height, frameCount, paletteLimit, loopMode, reference?, callClaude })`
  → `{ palette, frames, concept }`
  - `emit_pixel_animation` 相当のJSON Schemaを注入された `callClaude` に渡し、
    パレット配列とフレームごとの2次元ピクセルグリッドを取得・検証・フラット化する。
  - 単発の生成関数。通常はこれを直接使わず `generateWithSelfCheck()` 経由で呼ぶ。
  - `reference`（省略可）: `{ palette, pixels, width, height }`。渡すと、既に確定した
    別アニメーション（基準ポーズ等）と同じ配色・プロポーションを保つよう
    プロンプトに埋め込む（`buildReferenceBlock()`）。`cli.js character` サブコマンドが
    キャラクター一貫性を保つために使う。
- `refineAnimation({ description, width, height, frameCount, paletteLimit, loopMode, palette, frames, issues, callClaude })`
  → `{ palette, frames, concept }`
  - 直前の実ピクセルデータをそのまま見せ、指摘箇所だけをピクセル単位で修正させる。
    白紙から再生成するより収束が速いことを実機検証済み（詳細は LESSONS_LEARNED.md）。
- `regenerateFrame({ description, width, height, palette, neighborFrames, frameIndex, callClaude })`
  → 1フレーム分の `pixels`（フラット配列）
  - `emit_single_frame` 相当のスキーマを使い、既存パレット・隣接フレームとの一貫性を
    保って1枚だけ再生成する（ブラウザUIで「このフレームだけ再生成」を押したときに使用）。
- `critiqueAnimation({ description, width, height, frameCount, loopMode, imageBase64, callClaude })`
  → `{ pixelArtAuthenticity, score, verdict, issues }`
  - `emit_critique` 相当のスキーマを使い、スプライトシート画像をClaude CLIの
    Readツール経由で読ませて自己採点させる。
  - `pixelArtAuthenticity`（1〜10）は「本物のドット絵スプライトに見えるか」の最優先評価軸。
    `pixelArtAuthenticity` と `score` の**両方**が7以上でなければ `approve` にならない
    （プロンプトでモデルに指示し、さらにコード側でも
    `verdict==='approve' && (pixelArtAuthenticity<7 || score<7)` の場合は
    強制的に `needs_fix` へ上書きする二重のガード）。
- `generateWithSelfCheck({ description, width, height, frameCount, paletteLimit, loopMode, maxIterations, selfCheckEnabled, onProgress, reference?, callClaude, renderReviewImage })`
  → `{ palette, frames, concept, iterations, verdict, score?, reasons? }`
  - **メインの生成エントリポイント。** 「生成→ヒューリスティック検証→画像による
    自己批評→（必要なら）直前データを見せての修正」を `maxIterations` 回まで
    自律的に繰り返す。`onProgress(event)` で各ステップの状況
    （`generating` / `heuristic-checking` / `heuristic-failed` / `vision-reviewing` /
    `vision-needs-fix` / `vision-review-error` / `done`）を通知する。
  - `reference`（省略可）は初回の `generateAnimation` 呼び出しにのみ渡される
    （2回目以降の `refineAnimation` は直前の実データ自体がすでに参照として機能するため不要）。
  - `verdict` は `approved`（自己チェック合格）/ `approved-heuristic-only`
    （画像レビューが失敗したためヒューリスティック合格のみで確定）/
    `needs_review`（上限到達、確認が必要）/ `skipped`（自己チェック無効）。
- `buildToolSchema()`/`buildSingleFrameToolSchema()`/`buildCritiqueToolSchema()` — 各構造化
  出力のJSON Schema。`STYLE_GUIDE` — ドット絵の品質ルール（system promptとして全呼び出しに付与）。

### `cli.js`
2つのサブコマンドを持つ。共通ヘルパー: `buildOnProgress()`（進行状況ログ整形）,
`writeProjectFiles()`（PNG/GIF/JSON書き出し）, `parsePositiveInt()`/`parseLoopMode()`（引数検証）。

- **`generate`** — 単発のアニメーションを1本生成。`--prompt`/`--out` が必須、その他は
  `--width`/`--height`/`--frames`/`--palette`/`--loop`/`--fps`/`--model`/
  `--max-iterations`/`--no-self-check`/`--quiet`。
  stdout には実行結果のJSON（`verdict`/`score`/`iterations`/`reasons`/`concept`/`files`）
  のみを出力し、進行状況ログは全て stderr に流す。
  終了コード: `0`=合格またはスキップ、`1`=実行時エラー、`2`=要確認（`needs_review`）。

- **`character`** — 同一キャラクターの複数アクションセットをまとめて生成。
  `--description`/`--actions`（カンマ区切り）/`--out-dir` が必須。`--frames` は
  単一値（全アクション共通）またはカンマ区切り（`--actions`と同数、アクションごとに
  フレーム数を変える）のどちらでも指定できる。
  1. まず `generateWithSelfCheck({ frameCount: 1, loopMode: 'once', ... })` で
     基準ポーズ（1枚絵）を確定させ、`<out-dir>/reference.png`（+`.json`、GIFは書き出さない）
     として保存する。
  2. 各アクションについて、確定した基準ポーズを `reference` として
     `generateWithSelfCheck()` に渡しながら生成し、`<out-dir>/<action>.png/.gif/.json`
     として保存する（アクションごとに独立した自己チェックループが走る）。
  3. 全体のサマリー（基準デザインの結果 + 各アクションの結果）を
     `<out-dir>/character.json` に書き出し、同じ内容をstdoutにも出力する。
  終了コード: `0`=全て合格、`1`=いずれかのアクションで実行時エラー、
  `2`=エラーはないが1件以上 `needs_review`。

### `server/agentCore.js`
- `generateWithSelfCheck({ model, ...params })` — `core.generateWithSelfCheck()` に
  `callClaude`（`handleClaudeApi()` をインプロセスで直接呼ぶ）と
  `renderReviewImage`（`pngRender.js` の `renderReviewImageBase64`）を注入して呼び出す。

### `server/pngRender.js`（Node専用、Canvas不使用）
- `buildNativeSpritesheetPng(project)` → `Buffer`（等倍・透過ありのPNG、pngjsで直接生成）
- `renderReviewImageBase64(project)` → `Promise<string>`（拡大・市松模様背景付き、
  自己レビュー画像入力用。exporter.jsのCanvas版と同じレイアウトロジック）
- `buildAnimatedGif(project)` → `Buffer`（gifenc、透過対応）

### `server/claudeApi.js`
- `handleClaudeApi({ model, system, userText, tool, maxTokens }, { signal })`
  → `{ content: [{ type: 'tool_use', name, input }] }`
  - `execFile('claude', [...])` で子プロセスを起動。HTTP経由（ブラウザから）でも
    `agentCore.js` からのインプロセス呼び出し（CLI経由）でも共通で使われる。
- `checkClaudeCliHealth()` → `{ available, version? , message? }`

### `qa.js`
- `runHeuristicChecks({ width, height, palette, frames, loopMode })` → `string[]`（問題点の文章リスト）
  - API呼び出し不要で即座に判定できる問題を検出: 全フレーム空白、パレット未使用過多、
    フレームがほぼ空白、隣接フレームの差分がほぼゼロ（3%未満・フレーム同一化による
    「一貫性の指摘」誤魔化しを含む）または大きすぎる、ループ指定時の始点・終点の不整合。
- `pixelDiffRatio(a, b)` → 2つのフレーム（フラット配列）間で値が異なるピクセルの割合。

---

以下はブラウザUI専用のモジュール（`core.js`・`qa.js`・`server/`とは独立）。

### `aiClient.js`（ブラウザアダプタ）
- `checkCliHealth()` → `{ available, version?, message? }`（`/api/claude/health` を叩く）
- `generateWithSelfCheck(params)` / `regenerateFrame(params)` — `core.js` に
  fetchベースの `callClaude` とCanvasベースの `renderReviewImage` を注入して呼び出す薄いラッパー。
- `getModel()`/`setModel()`, `getSelfCheckEnabled()`/`setSelfCheckEnabled()`,
  `getMaxIterations()`/`setMaxIterations()` — 設定値の `localStorage` 永続化。

### `ProjectStore` (state.js)
- プロジェクト状態: `{ width, height, fps, loopMode, palette, frames }`
  - `frames` は `Int` 値（パレットindex、-1=透明）のフラット配列（`width*height`）の配列
- `onChange(fn)` — 状態変化の購読
- `snapshotBeforeEdit()` / `undo()` / `redo()` — 1ストローク単位のUndo/Redo
- `setPixel(index, value)` / `commitEdit()` — 編集中の書き込みと確定
- `duplicateFrame(i)` / `deleteFrame(i)` / `replaceFrame(i, pixels)`

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

### `exporter.js`（ブラウザ版、Canvas使用）
- `exportSpritesheetPng(project)` — 等倍・横並びのスプライトシートPNG（ダウンロード）
- `getReviewSpritesheetBase64(project)` — 拡大・市松模様背景付きのスプライトシートを
  base64 PNGとして返す（ダウンロードはしない）。`server/pngRender.js` のNode版と同じレイアウト。
- `exportAnimatedGif(project)` — gifenc による透過対応アニメーションGIF
- `exportProjectJson(project)` / `parseProjectJson(text)` — プロジェクトの保存/復元
