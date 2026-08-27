# Pixel Animator — プロジェクト構造

> 最終更新: 2026-08-27

## コンセプト（重要: 主役はAIエージェント、人間ではない）

このツールの一番の目的は「ドット絵・ドット絵アニメーションの作成が苦手なAIエージェント
自身が、ブラウザや人間の手を介さず、生成から自己検証・自己修正までを一気通貫で
完結できるようにすること」。**人間（またはそれを操作する上位エージェント）の役割は
最終確認や軽い手直しだけ**という位置づけで設計している。そのため:

- **`cli.js` がメインのインターフェース。** AIエージェントは `node cli.js generate ...`
  を1回叩くだけで、生成・機械的品質チェック・画像による自己批評・自己修正まで
  すべて自動で完結し、完成したアセット（PNG/GIF/JSON）がディスクに書き出される。
  ブラウザもVite開発サーバーも不要。
- **`node cli.js character ...`** は、同一キャラクターの複数アクション（idle/walk/attack等）
  を配色・プロポーションの一貫性を保ったまま連続生成する。先に基準ポーズ（1枚絵）を
  確定させ、各アクションの生成時にその基準デザインをプロンプトへ埋め込む
  （`core.js` の `reference` 機構）ことで一貫性を担保している。
- ブラウザUI（`npm run dev`）は、CLIが吐き出したJSONを読み込んで人間が軽く手直し・
  最終確認するための**セカンダリな用途**という位置づけ。
- CLIとブラウザは同じ自己チェックロジック・同じ品質ルールを`core.js`から共有しており、
  どちらから使っても結果の質は変わらない。

## ディレクトリ構成

```
PixelAnimator/
├── cli.js                ← ★AIエージェント向けCLIエントリポイント（ブラウザ不要）
├── core.js                ← 環境非依存の本体ロジック（プロンプト構築・自己チェックループ）
│                             ブラウザ側・CLI側の両方から共有される、いわば「頭脳」部分
├── qa.js                  ← 生成結果のヒューリスティック（機械的）品質チェック
│                             （core.js から使われる。DOM非依存でCLI/ブラウザ共通）
├── server/
│   ├── claudeApi.js        ← ローカルの `claude` CLI を子プロセスとして呼び出す
│   │                          （HTTP経由でもcli.js からのインプロセス呼び出しでも使う）
│   ├── agentCore.js         ← core.js のNode向けアダプタ（cli.js が使う）
│   └── pngRender.js         ← Canvas無しでPNG/GIFを組み立てる（pngjs + gifenc）
│
├── index.html              ← ブラウザUI（人間向け・セカンダリ）
├── style.css
├── vite.config.js           ← 開発サーバーに /api/claude, /api/claude/health を生やすプラグイン
├── state.js                 ← プロジェクトの状態管理・Undo/Redo履歴（ProjectStore、ブラウザ専用）
├── aiClient.js               ← core.js のブラウザ向けアダプタ（fetch + Canvas + localStorage）
├── renderer.js                ← Canvas描画（フレーム・パレット・サムネイル、ブラウザ専用）
├── animator.js                ← 再生キャンバスのアニメーションループ（ブラウザ専用）
├── editor.js                  ← ピクセル編集（ペンシル/消しゴム/スポイト/バケツ、ブラウザ専用）
├── exporter.js                ← PNG/GIF/JSON 書き出し・読み込み（Canvas版、ブラウザ専用）
├── main.js                    ← ブラウザUIの配線・イベントハンドリング
│
├── package.json               ← 依存関係（gifenc, pngjs）・bin（pixelanimator）
└── docs/
    ├── PROJECT_STRUCTURE.md
    ├── REPO_MAP.md
    └── LESSONS_LEARNED.md
```

**依存の向き**: `core.js` は `qa.js` にのみ依存し、DOM・fetch・localStorage・Node組み込み
モジュールのいずれにも依存しない。`aiClient.js`（ブラウザ）と `server/agentCore.js`（Node）は
それぞれ `core.js` に `callClaude` と `renderReviewImage` を注入することで、
同じロジックを異なる実行環境で動かしている。

## 自己チェックループの中身

1. 生成する（`emit_pixel_animation` 相当の構造化出力）
2. 機械的なヒューリスティック検証を行う（`qa.js` — 空白フレーム・パレット未使用・
   フレーム間の不整合・「一貫性の指摘をフレーム同一化で誤魔化す」退化などをコード側で検出）
3. 自分の描いた絵をスプライトシート画像として自分自身にレビューさせる
   （`emit_critique` 相当、画像を読ませての自己批評）
4. 問題があれば、直前の実ピクセルデータをそのまま見せて指摘箇所だけを直させる
   （`refineAnimation` — 白紙から描き直すより収束が速いことを実機検証済み）

というループを最大イテレーション回数（デフォルト3回、1〜5回で変更可）まで自律的に
繰り返す（`core.js` の `generateWithSelfCheck()`）。判断を人間・上位エージェントに
委ねるのは上限回数に達しても合格しなかった場合のみ。

## AIの呼び出し方式（APIキー不要・サブスクリプション直結）

Anthropic APIキーは一切使わない。ターミナルで `claude login` 済みの
**Claude Pro / Max / Team サブスクリプション**の認証（OAuth）をそのまま利用する。

### CLI経由（推奨・AIエージェント向け）

```
cli.js
  → server/agentCore.js（core.jsにインプロセスのcallClaude/renderReviewImageを注入）
  → server/claudeApi.js の handleClaudeApi() を直接関数呼び出し（HTTPを介さない）
  → execFile('claude', [...]) で子プロセス起動
  → 完成したアセットを server/pngRender.js（pngjs + gifenc、Canvas不使用）でPNG/GIFに変換し、
    <out>.png / <out>.gif / <out>.json としてディスクに書き出す
  → 実行結果（verdict/score/iterations/files）をJSONとしてstdoutに出力
```

### ブラウザ経由（人間の手直し用）

```
ブラウザ (aiClient.js)
  → fetch('/api/claude', {model, system, userText, tool})
  → Vite開発サーバーのミドルウェア (vite.config.js)
  → server/claudeApi.js が execFile('claude', [...]) で子プロセス起動
  → claude CLI の stdout（JSON）の structured_output を取り出し、
    Anthropic Messages API の tool_use と同じ形 { content: [{type:'tool_use', name, input}] }
    に整形してブラウザへ返す
```

いずれの経路でも `claude` CLIへの実引数は共通:
`-p "<プロンプト>" --output-format json --json-schema '<tool.input_schema>' --model <モデル>
--system-prompt "<STYLE_GUIDE>" --disable-slash-commands`
（画像がある場合は `--allowedTools Read --add-dir <一時ディレクトリ> --permission-mode dontAsk`
を追加し、一時ファイル経由でReadツールに画像を読ませる）。

- CLI本体が見つからない／未ログインの場合は、分かりやすいエラーメッセージで知らせる
  （`checkClaudeCliHealth()`。ブラウザ版は設定ダイアログの「CLI接続を確認」でも確認可能）。
- ブラウザ側の自己チェックON/OFF・最大イテレーション回数・モデル選択は `localStorage`
  （`pixelAnimator.selfCheckEnabled` / `pixelAnimator.maxIterations` / `pixelAnimator.model`）
  に保存する。CLI側は毎回コマンドライン引数で指定する（`--model` / `--max-iterations` /
  `--no-self-check`）。

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| CLI・生成本体 | Node.js（ブラウザ・DOM不使用） |
| ブラウザUI描画 | Vanilla Canvas 2D |
| ビルド・開発サーバー | Vite 7.3（カスタムミドルウェアプラグイン付き） |
| フォント | Google Fonts (Outfit, JetBrains Mono) |
| AI | ローカルの **Claude Code CLI**（`claude`コマンド）を子プロセスとして呼び出し |
| PNGエンコード（CLI/Node側） | pngjs（純粋JS、ネイティブ依存・DOM不使用） |
| GIFエンコード | gifenc（ブラウザ・Node両対応、外部CDN不使用） |
