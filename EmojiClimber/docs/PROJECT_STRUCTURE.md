# Emoji Climber — プロジェクト構造

> 最終更新: 2026-02-23

## ディレクトリ構成

```
EmojiClimber/
├── index.html          ← エントリーポイント
├── style.css           ← UI・ダークテーマ
├── package.json        ← Vite 設定
├── config.js           ← 全物理定数・ゲーム設定
├── main.js             ← ゲームループ・初期化・統合
├── input.js            ← 入力管理（先行入力バッファ・コヨーテタイム）
├── player.js           ← プレイヤー（状態機械・タメジャンプ・表情・変形）
├── physics.js          ← カスタム物理エンジン（AABB衝突・重力・摩擦・斜面）
├── level.js            ← レベルデータ（5ゾーン足場配置）
├── renderer.js         ← Canvas描画（絵文字・地形・背景・パーティクル）
├── camera.js           ← カメラ追従（Lerp・減衰付き振動）
├── ui.js               ← HUD（高度計・タメゲージ・タイマー・煽りメッセージ）
└── docs/               ← ドキュメント
    ├── PROJECT_STRUCTURE.md
    ├── REPO_MAP.md
    └── LESSONS_LEARNED.md
```

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| 描画 | Vanilla Canvas 2D |
| ビルド | Vite 7.3 |
| フォント | Google Fonts (Outfit) |
| 物理 | カスタムエンジン |
