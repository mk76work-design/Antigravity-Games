# Godot Engine ルール

## バージョン情報
- 対象バージョン: Godot 4.3 (GDScript 2.0)
- 最終更新: 2026-08-26

---

## 推奨パターン

### プロジェクト構成
```
game/
├── project.godot
├── scenes/
│   ├── main.tscn
│   └── ui/...
├── scripts/
│   ├── core/            # ノードに依存しない純粋ロジック (RefCounted)
│   │   └── board_state.gd
│   ├── nodes/           # シーンツリーに紐づく制御スクリプト
│   │   └── board_view.gd
│   └── autoload/
│       └── game_manager.gd
├── tests/
│   └── unit/            # GUTユニットテスト
└── addons/
    └── gut/              # Godot Unit Test
```

### ロジックとビューの分離（最重要 — ヘッドレス検証のため）
```gdscript
# ✅ 推奨: 純粋ロジックはNodeに依存しないRefCountedクラスに実装する
class_name BoardState
extends RefCounted

var grid: Array = []

func move(direction: Vector2i) -> bool:
    # グリッド操作のみ。Node/シーンツリーに触れない
    return true
```
理由: シーンツリーに依存しないロジックは `godot --headless` 上でレンダラやNodeを起動せずに直接インスタンス化してテストできる。目視確認なしで正しさを検証する方針と一致する。

### 型付きGDScript
```gdscript
# ✅ 推奨: 型ヒントを必ず付与する
var score: int = 0
func add_score(points: int) -> void:
    score += points
```
理由: 静的型付けにより実行前に型エラーを検出でき、ハルシネーションによる型不整合を防ぐ。

### シグナルによる疎結合
```gdscript
# ✅ 推奨: Node/UI間の通信はシグナルで行う
signal move_completed(new_grid: Array)
signal level_cleared

func _on_move_requested(direction: Vector2i) -> void:
    if board_state.move(direction):
        move_completed.emit(board_state.grid)
```

### プリミティブメッシュのみで3D表現（手描きアセット不要）
```gdscript
# ✅ 推奨: BoxMesh/CSGBox3D + StandardMaterial3Dの単色のみで表現する
var box := CSGBox3D.new()
box.size = Vector3(0.9, 0.9, 0.9)
var mat := StandardMaterial3D.new()
mat.albedo_color = Color(1.0, 0.55, 0.1) # 例: 荷物=オレンジ
box.material = mat
add_child(box)
```

### Autoload（シングルトン）の節度ある利用
```gdscript
# ✅ 許容: 責務を限定したAutoloadは許容する（例: 現在のレベル番号、シーン遷移）
extends Node
# project.godot の [autoload] に登録して使用
var current_level: int = 0
```
理由: JS版ルールの「グローバル変数禁止」は無秩序な`var`乱用を指す。Godotの Autoload は明示的登録・型付けされたシングルトンであり、責務を限定すれば許容する。ゲームの中核状態（グリッド等）はAutoloadに置かず、`core/`のロジッククラスに閉じ込める。

---

## 禁止パターン

### ❌ ゲームルールを `_process`/`_input` に直接書く
```gdscript
# ❌ 禁止: 当たり判定やルールを_process内に直接記述
func _process(delta):
    if Input.is_action_just_pressed("move_up") and grid[y-1][x] == 0:
        grid[y][x] = 0
        grid[y-1][x] = 1
```
理由: シーンツリーに強く依存し、ヘッドレスでの単体テストが不可能になる。`core/`のクラスに委譲すること。

### ❌ 深い相対パスの `get_node()` 直書き乱用
```gdscript
# ❌ 禁止
$"../../UI/HUD/ScoreLabel".text = str(score)
```
理由: シーン構造の変更に弱く壊れやすい。`@onready var` + `%UniqueName`（Scene Unique Node）や export変数、signalで参照を渡すこと。

### ❌ 型なしGDScript
```gdscript
# ❌ 禁止: 型ヒントを省略した緩い記述
var data
func calc(a, b):
    return a + b
```
理由: 実行時まで型エラーに気づけず、誤った型のままコード生成が進むハルシネーション温床になる。

### ❌ 他ノードの内部状態への直接書き換え
```gdscript
# ❌ 禁止
get_tree().get_root().get_node("Main/Player").health -= 10
```
理由: 依存関係が不透明になる。シグナルまたはpublicメソッド経由でカプセル化すること。

---

## ヘッドレス実行 / 自動テスト

### GUT (Godot Unit Test) の利用
```bash
# ✅ 推奨: ヘッドレスでユニットテストを一括実行
godot --headless --path . -s addons/gut/gut_cmdln.gd -gdir=res://tests/unit -gexit
```
- 3D描画やユーザー入力を一切介さず、`core/`配下の純粋ロジッククラスをテストする
- コンテナ環境（ディスプレイなし）における自己検証はこの方式を第一手段とする

### スクリーンショットによる目視確認（あくまで補助的手段）
```bash
# 参考: Xvfb + ソフトウェアレンダラでの起動（ベストエフォート、成功を保証しない）
xvfb-run -a --server-args="-screen 0 1280x720x24" \
  ./godot --path . --rendering-driver opengl3
```
- GPU/ディスプレイの無い環境では常に成功する保証はない
- 最終的な軽い目視確認用の補助手段とし、正しさの一次判定はGUTのアサーションに委ねる

---

## パフォーマンスガイドライン
| 項目 | 推奨値 |
|------|--------|
| 目標FPS | 60 FPS |
| メッシュ | 低ポリプリミティブ（CSGまたはBoxMesh/SphereMesh）を使い、インポート済み3Dモデルは使用しない |
| マテリアル | StandardMaterial3Dのalbedo_colorのみで表現し、テクスチャ読み込みを避ける |
| インスタンス化 | 同一形状オブジェクトを多数配置する場合は MultiMeshInstance3D を検討する |
| 物理 | パズルロジックは物理エンジンに依存せずグリッド座標で管理し、見た目の移動のみTweenで補間する |
