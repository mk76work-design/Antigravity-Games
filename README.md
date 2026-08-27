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
AIエージェントがドット絵・ドット絵アニメーションの作成を一気通貫で行うためのツール。
**主役はAIエージェントで、人間はCLIが出した結果を軽く確認・手直しするだけ**という
設計思想。
- **CLI（推奨・AIエージェント向け）**: `node cli.js generate --prompt "..." --out ...`
  1回で、生成→機械的品質チェック→画像による自己批評→自己修正までブラウザなしで完結し、
  完成したPNG/GIF/JSONをディスクに書き出す。stdoutは機械可読なJSON、進行状況はstderr。
- **自己チェック・自動修正**: 生成→機械的な品質チェック→AIによる画像の自己批評→
  （問題があれば）直前の実ピクセルデータを見せての修正、を最大3回まで自律的に繰り返す。
- **ブラウザUI（人間の手直し用）**: `npm run dev` で起動。CLIが出したJSONを読み込んで
  ペンシル/消しゴム/スポイト/バケツで軽く手直しし、再書き出しできる。
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

# AIエージェント向け: ブラウザ不要でCLIから直接生成
node cli.js generate --prompt "剣を構えた侍の待機モーション" --width 32 --frames 8 --out ./output/samurai_idle

# 人間の手直し用: ブラウザUI
npm run dev
```

## 技術スタック
- **Frontend**: Vanilla HTML/JS + CSS
- **Graphics**: HTML5 Canvas 2D API
- **Tooling**: Vite
- **AI**: Developed by Antigravity (Google DeepMind)
