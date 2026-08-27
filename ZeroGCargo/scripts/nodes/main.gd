extends Node3D

## エントリポイント。カメラ・ライトの固定セットアップ、CargoBoardの生成、
## PlayerController/BoardView3D/HUDの結線、レベル進行の橋渡しを行う。

const LEVEL_CLEAR_DELAY_SEC := 1.0

var _camera: Camera3D
var _view: BoardView3D
var _controller: PlayerController
var _hud: Hud


func _ready() -> void:
	_camera = Camera3D.new()
	add_child(_camera)

	var light := DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-55, -30, 0)
	add_child(light)

	_view = BoardView3D.new()
	add_child(_view)

	_hud = Hud.new()
	add_child(_hud)

	_controller = PlayerController.new()
	add_child(_controller)
	_controller.board_updated.connect(_on_board_updated)
	_controller.level_cleared.connect(_on_level_cleared)

	_load_current_level()


func _load_current_level() -> void:
	var layout: PackedStringArray = GameManager.get_current_level_layout()
	var board := CargoBoard.from_layout(layout)
	_position_camera_for_board(board)
	_controller.setup(board, _view)


## 盤面サイズに合わせて固定の斜め見下ろし平行投影カメラを配置する（ユーザー操作なし）。
## 透視投影だと小さい盤面でカメラが近づきすぎ広角レンズのような歪みが出るため、
## パズルゲームとして歪みのない Orthogonal（平行投影）を採用する。
func _position_camera_for_board(board: CargoBoard) -> void:
	var cell_size: float = BoardView3D.CELL_SIZE
	var center := Vector3(
		(board.width - 1) * cell_size * 0.5,
		0.0,
		(board.height - 1) * cell_size * 0.5
	)
	var board_span: float = max(board.width, board.height) * cell_size
	_camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	_camera.size = board_span + cell_size * 1.5
	_camera.position = center + Vector3(0.0, board_span * 0.9, board_span * 0.75)
	_camera.look_at(center, Vector3.UP)


func _on_board_updated(move_count: int) -> void:
	_hud.update_status(GameManager.get_current_level_number(), GameManager.get_total_level_count(), move_count)


func _on_level_cleared() -> void:
	_hud.show_level_cleared()
	await get_tree().create_timer(LEVEL_CLEAR_DELAY_SEC).timeout
	var has_next: bool = GameManager.advance_level()
	if has_next:
		_load_current_level()
	else:
		_hud.show_all_levels_completed()
