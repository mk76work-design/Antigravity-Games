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
- **特徴**: LLMのtool useでパレット＋フレームごとのピクセルグリッドを直接生成、
  ペンシル/消しゴム/スポイト/バケツによる手直し、フレーム単位の再生成、
  スプライトシートPNG・アニメーションGIF・プロジェクトJSONの書き出し。
- **APIキー**: ユーザー自身のAnthropic APIキーを設定ダイアログから登録（`localStorage`にのみ保存）。

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
