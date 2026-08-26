# Pixel Animator — プロジェクト構造

> 最終更新: 2026-08-26

## ディレクトリ構成

```
PixelAnimator/
├── index.html          ← エントリーポイント（3カラムUI + 設定ダイアログ）
├── style.css           ← UI・ダークテーマ
├── package.json        ← Vite 設定・依存関係（gifenc）
├── state.js            ← プロジェクトの状態管理・Undo/Redo履歴（ProjectStore）
├── aiClient.js          ← Anthropic API 呼び出し・プロンプト構築・スキーマ検証
├── renderer.js         ← Canvas描画（フレーム・パレット・サムネイル）
├── animator.js         ← 再生キャンバスのアニメーションループ（FPS制御）
├── editor.js           ← ピクセル編集（ペンシル/消しゴム/スポイト/バケツ）
├── exporter.js         ← PNG/GIF/JSON 書き出し・JSON読み込み
├── main.js             ← 全モジュールの配線・イベントハンドリング
└── docs/               ← ドキュメント
    ├── PROJECT_STRUCTURE.md
    ├── REPO_MAP.md
    └── LESSONS_LEARNED.md
```

## コンセプト

プロンプトを入力すると、AIエージェント（Claude）がドット絵アニメーションを
「パレット + フレームごとのピクセルグリッド」という構造化データとして描き、
アプリ側が Canvas 2D 上でレンダリング・アニメーション再生する。
画像生成モデルは使わず、LLMのツールユース（Structured Output）でピクセル配列を
直接出力させる方式を採用している。

生成後はアプリ内のドット絵エディタでそのまま手直しでき、スプライトシートPNG /
アニメーションGIF / プロジェクトJSON として書き出せる。

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| 描画 | Vanilla Canvas 2D |
| ビルド | Vite 7.3 |
| フォント | Google Fonts (Outfit, JetBrains Mono) |
| AI | Anthropic Messages API（tool use / 構造化出力）、ブラウザから直接呼び出し |
| GIFエンコード | gifenc（ビルド時にバンドル、外部CDN不使用） |

## APIキーの扱い

Anthropic API キーはユーザー自身のものを `localStorage`（`pixelAnimator.apiKey`）
にのみ保存し、Anthropic API 以外のどこにも送信しない。バックエンドサーバーは
持たず、`anthropic-dangerous-direct-browser-access` ヘッダを付けてブラウザから
直接 `https://api.anthropic.com/v1/messages` を呼び出す。
