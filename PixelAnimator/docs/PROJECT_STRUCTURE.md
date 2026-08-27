# Pixel Animator — プロジェクト構造

> 最終更新: 2026-08-27

## ディレクトリ構成

```
PixelAnimator/
├── index.html          ← エントリーポイント（3カラムUI + 設定ダイアログ + エージェントログ）
├── style.css           ← UI・ダークテーマ
├── package.json        ← Vite 設定・依存関係（gifenc）
├── vite.config.js       ← 開発サーバーに /api/claude, /api/claude/health を生やすプラグイン
├── server/
│   └── claudeApi.js     ← ローカルの `claude` CLI を子プロセスとして呼び出すプロキシ（Node専用）
├── state.js             ← プロジェクトの状態管理・Undo/Redo履歴（ProjectStore）
├── aiClient.js          ← プロンプト構築・スキーマ検証・自己チェックパイプライン（ブラウザ側）
├── qa.js                ← 生成結果のヒューリスティック（機械的）品質チェック
├── renderer.js          ← Canvas描画（フレーム・パレット・サムネイル）
├── animator.js          ← 再生キャンバスのアニメーションループ（FPS制御）
├── editor.js             ← ピクセル編集（ペンシル/消しゴム/スポイト/バケツ）
├── exporter.js           ← PNG/GIF/JSON 書き出し・JSON読み込み・自己レビュー用画像生成
├── main.js               ← 全モジュールの配線・イベントハンドリング・エージェントログ表示
└── docs/                ← ドキュメント
    ├── PROJECT_STRUCTURE.md
    ├── REPO_MAP.md
    └── LESSONS_LEARNED.md
```

## コンセプト

プロンプトを入力すると、AIエージェント（Claude）がドット絵アニメーションを
「パレット + フレームごとのピクセルグリッド」という構造化データとして描き、
アプリ側が Canvas 2D 上でレンダリング・アニメーション再生する。
画像生成モデルは使わず、LLMの構造化出力でピクセル配列を直接出力させる方式を
採用している。

**最優先の設計目標は「ユーザーの確認・修正回数を減らすこと」**。そのため生成は
1回きりではなく、AIエージェント自身が

1. 生成する（`emit_pixel_animation` 相当の構造化出力）
2. 機械的なヒューリスティック検証を行う（`qa.js` — 空白フレーム・パレット未使用・
   フレーム間の不整合などをコード側で機械的に検出）
3. 自分の描いた絵をスプライトシート画像として自分自身にレビューさせる
   （`emit_critique` 相当、画像を読ませての自己批評）
4. 問題があれば、指摘事項をフィードバックとして次の生成プロンプトに織り込んで
   再生成する

というループを最大イテレーション回数（デフォルト3回、設定で1〜5回に変更可）まで
自律的に繰り返す（`generateWithSelfCheck()`）。ユーザーには進行状況が
「エージェントログ」としてリアルタイムに流れるだけで、判断を求めるのは
上限回数に達しても合格しなかった場合のみ。

生成後はアプリ内のドット絵エディタでそのまま手直しでき、スプライトシートPNG /
アニメーションGIF / プロジェクトJSON として書き出せる。

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| 描画 | Vanilla Canvas 2D |
| ビルド・開発サーバー | Vite 7.3（カスタムミドルウェアプラグイン付き） |
| フォント | Google Fonts (Outfit, JetBrains Mono) |
| AI | ローカルの **Claude Code CLI**（`claude`コマンド）を子プロセスとして呼び出し（構造化出力 `--json-schema` / 画像は一時ファイル経由でReadツールに読ませる） |
| GIFエンコード | gifenc（ビルド時にバンドル、外部CDN不使用） |

## AIの呼び出し方式（APIキー不要・サブスクリプション直結）

Anthropic APIキーは一切使わない。ユーザーがターミナルで `claude login` 済みの
**Claude Pro / Max / Team サブスクリプション**の認証（OAuth）をそのまま利用する。

```
ブラウザ (aiClient.js)
  → fetch('/api/claude', {model, system, userText, tool})
  → Vite開発サーバーのミドルウェア (vite.config.js)
  → server/claudeApi.js が execFile('claude', [...]) で子プロセス起動
      -p "<プロンプト>"
      --output-format json
      --json-schema '<tool.input_schema>'
      --model <選択したモデル>
      --system-prompt "<STYLE_GUIDE>"
      --disable-slash-commands
      （画像がある場合: --allowedTools Read --add-dir <一時ディレクトリ> --permission-mode dontAsk）
  → claude CLI の stdout（JSON）の structured_output を取り出し、
    Anthropic Messages API の tool_use と同じ形 { content: [{type:'tool_use', name, input}] }
    に整形してブラウザへ返す
```

- ブラウザは子プロセスを起動できないため、この処理は**Viteの開発サーバーが動いている間のみ**
  動作する（＝ `npm run dev` で起動して使うツール。`npm run build` の静的出力だけでは
  AI生成機能は動かない）。
- 画像入力（自己レビュー用のスプライトシート）は、base64をサーバー側で一時ファイルに書き出し、
  Claude Code CLIの `Read` ツール経由で読ませることで実現している（OSの一時ディレクトリに
  書き出し、呼び出し後に必ず削除する）。
- CLI本体が見つからない／未ログインの場合は、設定ダイアログの「CLI接続を確認」または
  起動時の自動チェックでエラーメッセージとともに知らせる（`checkClaudeCliHealth()`）。

自己チェックのON/OFFと最大イテレーション回数、モデル選択は `localStorage`
（`pixelAnimator.selfCheckEnabled` / `pixelAnimator.maxIterations` / `pixelAnimator.model`）
に保存する。
