# 🎮 GAME_REGISTRY.md

> 自動生成ドキュメント — 最終更新: 2026-02-23 10:02:01
> 
> このファイルは `.agent/skills/project_analyzer/scripts/update_game_registry.ps1` によって自動生成されます。

---

## 登録済みゲーム一覧

| # | タイトル | ディレクトリ | HTML | JS | CSS | サイズ (KB) |
|---|---------|------------|------|----|----|-----------|
| 1 | **ウォーターバルーンテトリス** | `WaterBalloonTetris` | 1 | 97 | 1 | 21189 |

> ⚠️ 上表は `update_game_registry.ps1`（HTML/JS/CSSを集計するWebゲーム向けスクリプト、Linux環境では未実行）による自動生成。
> Godotプロジェクトはスクリプト対象外のため、以下に手動で追記する。

| # | タイトル | ディレクトリ | エンジン | .gd | .tscn |
|---|---------|------------|---------|-----|-------|
| 2 | **Zero-G Cargo** | `ZeroGCargo` | Godot 4.3 | 13 | 1 |

---

## ゲーム詳細メモ

> エージェントはここに、各ゲームの概要・技術的特徴・既知の問題などを手動で追記してください。

### Zero-G Cargo（Godot 4.3）
- **ジャンル**: 3Dパズル（無重力貨物ステーション舞台の倉庫番/Sokoban系）
- **見た目**: `MeshInstance3D` + `BoxMesh` + 単色 `StandardMaterial3D` の複合プリミティブのみ（テクスチャ・3Dモデル制作は不要）。壁=本体+トリム+発光ライン、床=ベース+インセットパネル、目標=発光パルスパッド、カーゴ=コンテナ風、プレイヤー=ロボット風＋移動方向への向き変更。背景はProceduralSkyMaterialによる宇宙空間風グラデーション。
- **アーキテクチャ**: ゲームルール（`scripts/core/cargo_board.gd`）をNode非依存の`RefCounted`クラスに分離し、GUT (Godot Unit Test) でヘッドレスのままアサーション検証する構成。ディスプレイの無い開発コンテナ向けの方針。床には「高さ(段差)」属性があり、プレイヤーは1段差まで昇降可能・カーゴは同じ高さの床でしか押せない（Lv6で使用）。エレベーター(Lv7)・ポータル(Lv8)は「2マスペアのワープタイル」として共通実装（表示テーマのみ異なる）。
- **テスト**: `godot --headless --path . -s addons/gut/gut_cmdln.gd -gdir=res://tests/unit -gexit` で18/18テストパス（全8レベルの可解性を検証済み手順で機械検証）。
- **既知の注意点**: Godot 4.3で要素サイズの異なる`const Array[TypedArray]`がクラッシュする不具合を発見・回避済み（詳細: `ZeroGCargo/docs/LESSONS_LEARNED.md`、`.agent/skills/engine_rules/rules/godot_rules.md`）。

