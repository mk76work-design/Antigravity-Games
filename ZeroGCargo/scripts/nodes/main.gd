extends Node3D

## エントリポイント。カメラ・ライト・環境光の固定セットアップ、CargoBoardの生成、
## PlayerController/BoardView3D/HUDの結線、レベル進行の橋渡しを行う。
## カーゴが目標パッドに乗った瞬間の軽い画面振動（Sakurai Game Feelスキル準拠、H-3の"light"相当）も担う。

const LEVEL_CLEAR_DELAY_SEC := 1.0
const SHAKE_INTENSITY := 0.06
const SHAKE_OUT_DURATION := 0.05
const SHAKE_RETURN_DURATION := 0.12

var _camera: Camera3D
var _camera_base_position: Vector3 = Vector3.ZERO
var _view: BoardView3D
var _controller: PlayerController
var _hud: Hud


func _ready() -> void:
	_camera = Camera3D.new()
	add_child(_camera)

	_setup_environment()

	var light := DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-55, -30, 0)
	light.shadow_enabled = true
	add_child(light)

	_view = BoardView3D.new()
	add_child(_view)
	_view.box_landed_on_target.connect(_on_box_landed_on_target)

	_hud = Hud.new()
	add_child(_hud)

	_controller = PlayerController.new()
	add_child(_controller)
	_controller.board_updated.connect(_on_board_updated)
	_controller.level_cleared.connect(_on_level_cleared)

	_load_current_level()


## 光の当たり方で立体感を出すため、環境光を暗めに抑えて方向光とのコントラストを作る（F-1）。
## 背景はテクスチャ不要のProceduralSkyMaterialで宇宙空間らしいグラデーションにする。
func _setup_environment() -> void:
	var sky_material := ProceduralSkyMaterial.new()
	sky_material.sky_top_color = Color(0.01, 0.01, 0.05)
	sky_material.sky_horizon_color = Color(0.08, 0.07, 0.16)
	sky_material.sky_curve = 0.15
	sky_material.ground_bottom_color = Color(0.01, 0.01, 0.03)
	sky_material.ground_horizon_color = Color(0.05, 0.04, 0.09)

	var sky := Sky.new()
	sky.sky_material = sky_material

	var environment := Environment.new()
	environment.background_mode = Environment.BG_SKY
	environment.sky = sky
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	environment.ambient_light_energy = 0.6

	var world_environment := WorldEnvironment.new()
	world_environment.environment = environment
	add_child(world_environment)


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
	_camera_base_position = center + Vector3(0.0, board_span * 0.9, board_span * 0.75)
	_camera.position = _camera_base_position
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


## カーゴが目標パッドに乗った手応えとして、軽い画面振動を1回入れる（減衰つき）。
func _on_box_landed_on_target() -> void:
	var offset := Vector3(randf_range(-1.0, 1.0), 0.0, randf_range(-1.0, 1.0)) * SHAKE_INTENSITY
	var tween := create_tween()
	tween.tween_property(_camera, "position", _camera_base_position + offset, SHAKE_OUT_DURATION)
	tween.tween_property(_camera, "position", _camera_base_position, SHAKE_RETURN_DURATION)
