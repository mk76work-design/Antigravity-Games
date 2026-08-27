# Antigravity Games

Google Antigravity エージェントによって開発された、高品質なウェブゲームのコレクションです。

## 収録ゲーム

### 🎮 Emoji Climber (絵文字クライマー)
『Getting Over It』や『Jump King』にインスパイアされた、ゲキムズ物理アクションゲーム。
- **特徴**: 慣性の効いた独特な物理挙動、タメジャンプ、感情豊かな絵文字キャラクター。
- **操作方法**: 
  - `←` `→`: 移動
  - `Space` 長押し: ジャンプのタメ
  - `Space` 離す: ジャンプ（方向キーと組み合わせて斜めジャンプ）

## ツール

### 🖌️ Pixel Animator
プロンプトを渡すとAIエージェント（Claude）が高品質なドット絵アニメーションを描き、
その場で編集・プレビュー・書き出しができるスタジオツール。
- **自己チェック・自動修正**: 生成→機械的な品質チェック→AIによる画像の自己批評→
  （問題があれば）フィードバックを添えて再生成、を最大3回まで自律的に繰り返す。
  ユーザーの確認・修正回数を減らすことを最優先に設計。
- **特徴**: LLMの構造化出力でパレット＋フレームごとのピクセルグリッドを直接生成、
  ペンシル/消しゴム/スポイト/バケツによる手直し、フレーム単位の再生成、
  スプライトシートPNG・アニメーションGIF・プロジェクトJSONの書き出し。
- **APIキー不要**: Anthropic APIは使わない。ローカルにインストールした
  Claude Code CLI（`claude`コマンド）を裏で呼び出し、`claude login` 済みの
  Claude Pro/Max/Teamサブスクリプションの認証でそのまま動く。事前に
  ターミナルで `claude login` を済ませておくこと。

## 開発環境のセットアップ

各プロジェクトのディレクトリに移動し、Vite を使用して起動します。

```bash
cd EmojiClimber
npm install
npm run dev
```

```bash
cd PixelAnimator
npm install
npm run dev
```

## 技術スタック
- **Frontend**: Vanilla HTML/JS + CSS
- **Graphics**: HTML5 Canvas 2D API
- **Tooling**: Vite
- **AI**: Developed by Antigravity (Google DeepMind)
