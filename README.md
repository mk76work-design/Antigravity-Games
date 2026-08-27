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

### 🎮 Zero-G Cargo（ゼログラビティ・カーゴ）
無重力の宇宙貨物ステーションを舞台にした3Dパズル（倉庫番/Sokoban系）ゲーム。
- **特徴**: `MeshInstance3D`+単色マテリアルのみで構成し、手描きアセット制作が不要な3D表現。ゲームルールをNode非依存のロジッククラスに分離し、GUT (Godot Unit Test) でヘッドレス検証可能。
- **操作方法**:
  - `↑` `↓` `←` `→`: 移動（カーゴがあれば押し出し）

## 開発環境のセットアップ

### Webゲーム（EmojiClimber, WaterBalloonTetris）
各ゲームのディレクトリに移動し、Vite を使用して起動します。

```bash
cd EmojiClimber
npm install
npm run dev
```

### Godotゲーム（Zero-G Cargo）
[Godot Engine 4.3](https://godotengine.org/) でプロジェクトを開くか、CLIでテスト・実行します。

```bash
cd ZeroGCargo
godot --headless -s addons/gut/gut_cmdln.gd -gdir=res://tests/unit -gexit  # ユニットテスト実行
godot .  # エディタで開く
```

## 技術スタック
- **Frontend**: Vanilla HTML/JS + CSS
- **Graphics**: HTML5 Canvas 2D API
- **Game Engine**: Godot 4.3 (GDScript)
- **Tooling**: Vite, GUT (Godot Unit Test)
- **AI**: Developed by Antigravity (Google DeepMind)
