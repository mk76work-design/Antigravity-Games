# 🗺️ REPO_MAP.md

> 手動作成（`project_analyzer` のPowerShellスクリプトはLinux環境で未対応のため）
> 最終更新: 2026-08-27

---

## `scripts/core/cargo_board.gd` — `class_name CargoBoard extends RefCounted`
Node非依存の盤面ロジック。座標系は `Vector2i(x, y)`（x=列, y=行）。

| メンバ | シグネチャ | 説明 |
|--------|-----------|------|
| 定数 | `UP/DOWN/LEFT/RIGHT: Vector2i` | 移動方向 |
| `from_layout` | `static (layout: PackedStringArray) -> CargoBoard` | ASCIIレイアウトから盤面を構築 |
| `is_wall` / `is_box` / `is_target` | `(pos: Vector2i) -> bool` | セル種別判定 |
| `get_player_position` | `() -> Vector2i` | |
| `get_box_positions` / `get_target_positions` | `() -> Array` | |
| `move` | `(direction: Vector2i) -> bool` | 移動・押し出しを試行。成功時true |
| `is_cleared` | `() -> bool` | 全カーゴが目標パッド上か |

## `scripts/core/level_data.gd` — `class_name LevelData extends RefCounted`
| メンバ | シグネチャ | 説明 |
|--------|-----------|------|
| `LEVELS` | `static var Array[PackedStringArray]` | 5レベル分のレイアウト（`const`にすると4.3のエンジン不具合でクラッシュするため`static var`） |
| `get_level_count` | `static () -> int` | |
| `get_level` | `static (index: int) -> PackedStringArray` | |

## `scripts/nodes/main.gd` — `extends Node3D`（Main.tscnのroot）
| メンバ | シグネチャ | 説明 |
|--------|-----------|------|
| `_ready` | | カメラ・環境光・ライト・BoardView3D・HUD・PlayerControllerを生成し結線 |
| `_setup_environment` | `() -> void` | `WorldEnvironment`で背景色・環境光を設定（F-1: 光と陰影のコントラスト） |
| `_load_current_level` | `() -> void` | `GameManager` から現レベルを取得しCargoBoardを構築 |
| `_position_camera_for_board` | `(board: CargoBoard) -> void` | 盤面サイズに応じた固定Orthogonalカメラ配置 |
| `_on_level_cleared` | `() -> void` | クリア表示 → 次レベル読込 or 全クリア表示 |
| `_on_box_landed_on_target` | `() -> void` | カーゴが目標に乗った際の軽い画面振動（H-3: light相当） |

## `scripts/nodes/board_view_3d.gd` — `class_name BoardView3D extends Node3D`
| メンバ | シグネチャ | 説明 |
|--------|-----------|------|
| `load_level` | `(board: CargoBoard) -> void` | レベル読込時に一度だけ全体を構築（チェッカー床・壁・発光目標・カーゴ・プレイヤー） |
| `sync` | `(board: CargoBoard) -> void` | 移動後の差分（プレイヤー位置・移動したカーゴ1個）だけをTweenで補間更新、着地時にスクイーズ演出 |
| シグナル | `box_landed_on_target` | カーゴが目標パッドに乗った瞬間に発火（main.gdの画面振動トリガー） |

## `scripts/nodes/player_controller.gd` — `class_name PlayerController extends Node`
| メンバ | シグネチャ | 説明 |
|--------|-----------|------|
| `setup` | `(board: CargoBoard, view: BoardView3D) -> void` | |
| `_unhandled_input` | `(event: InputEvent) -> void` | `ui_up/down/left/right` を方向に変換 |
| シグナル | `board_updated(move_count: int)`, `level_cleared` | |

## `scripts/nodes/hud.gd` — `class_name Hud extends CanvasLayer`
| メンバ | シグネチャ | 説明 |
|--------|-----------|------|
| `update_status` | `(level_number: int, total_levels: int, move_count: int) -> void` | |
| `show_level_cleared` / `show_all_levels_completed` | `() -> void` | 半透明パネル＋スケールのポップ演出（Tween, TRANS_BACK） |

## `scripts/autoload/game_manager.gd` — Autoload `GameManager`
| メンバ | シグネチャ | 説明 |
|--------|-----------|------|
| `current_level_index` | `int` | |
| `get_current_level_layout` | `() -> PackedStringArray` | |
| `advance_level` | `() -> bool` | 次レベルがあればtrue |
| シグナル | `level_changed(level_index: int)`, `all_levels_completed` | |

## テスト（`tests/unit/`）
| ファイル | 主なテスト |
|---------|-----------|
| `test_cargo_board_move.gd` | 床への移動、壁での停止 |
| `test_cargo_board_push.gd` | カーゴの押し出し、壁/別カーゴによる押し出し失敗 |
| `test_cargo_board_win_condition.gd` | クリア判定、**全5レベルの検証済み手順によるクリア可能性** |
