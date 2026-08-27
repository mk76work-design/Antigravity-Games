# Pixel Animator — プロジェクト構造

> 最終更新: 2026-08-27

## ディレクトリ構成

```
PixelAnimator/
├── index.html          ← エントリーポイント（3カラムUI + 設定ダイアログ + エージェントログ）
├── style.css           ← UI・ダークテーマ
├── package.json        ← Vite 設定・依存関係（gifenc）
├── state.js            ← プロジェクトの状態管理・Undo/Redo履歴（ProjectStore）
├── aiClient.js         ← Anthropic API 呼び出し・プロンプト構築・スキーマ検証・自己チェックパイプライン
├── qa.js               ← 生成結果のヒューリスティック（機械的）品質チェック
├── renderer.js         ← Canvas描画（フレーム・パレット・サムネイル）
├── animator.js         ← 再生キャンバスのアニメーションループ（FPS制御）
├── editor.js           ← ピクセル編集（ペンシル/消しゴム/スポイト/バケツ）
├── exporter.js         ← PNG/GIF/JSON 書き出し・JSON読み込み・自己レビュー用画像生成
├── main.js             ← 全モジュールの配線・イベントハンドリング・エージェントログ表示
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

**最優先の設計目標は「ユーザーの確認・修正回数を減らすこと」**。そのため生成は
1回きりではなく、AIエージェント自身が

1. 生成する（`emit_pixel_animation`）
2. 機械的なヒューリスティック検証を行う（`qa.js` — 空白フレーム・パレット未使用・
   フレーム間の不整合などをコード側で機械的に検出）
3. 自分の描いた絵をスプライトシート画像として自分自身にレビューさせる
   （`emit_critique`、Claudeの画像入力を使った自己批評）
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
| ビルド | Vite 7.3 |
| フォント | Google Fonts (Outfit, JetBrains Mono) |
| AI | Anthropic Messages API（tool use / 構造化出力 / 画像入力）、ブラウザから直接呼び出し |
| GIFエンコード | gifenc（ビルド時にバンドル、外部CDN不使用） |

## APIキーの扱い

Anthropic API キーはユーザー自身のものを `localStorage`（`pixelAnimator.apiKey`）
にのみ保存し、Anthropic API 以外のどこにも送信しない。バックエンドサーバーは
持たず、`anthropic-dangerous-direct-browser-access` ヘッダを付けてブラウザから
直接 `https://api.anthropic.com/v1/messages` を呼び出す。

自己チェックのON/OFFと最大イテレーション回数も同様に `localStorage`
（`pixelAnimator.selfCheckEnabled` / `pixelAnimator.maxIterations`）に保存する。
