class_name BoardView3D
extends Node3D

## CargoBoard（core/ロジック）の状態を読み取り、プリミティブ形状のみで3D表示する。
## 手描きアセット（テクスチャ・3Dモデル）は一切使用しない。
## 床・壁・目標パッドはレベル読込時に一度だけ構築し、プレイヤー・カーゴは
## 移動のたびに位置差分だけをTweenで補間する（正しさの担保はcore/のGUTテストが担う）。
## 視認性・手応え演出（Sakurai Presentation/Game Feelスキル準拠）:
## 床のチェッカー柄、目標パッドのパルス発光、カーゴ移動時のスクイーズ演出を行う。

signal box_landed_on_target

const CELL_SIZE := 1.0
const WALL_HEIGHT := 1.0
const FLOOR_HEIGHT := 0.1
const BOX_SIZE := 0.8
const TARGET_SIZE := 0.6
const TARGET_HEIGHT := 0.05
const PLAYER_SIZE := 0.7
const MOVE_TWEEN_DURATION := 0.12
const SQUASH_DURATION := 0.08
const TARGET_PULSE_DURATION := 0.9
const TARGET_PULSE_MIN_ENERGY := 0.4
const TARGET_PULSE_MAX_ENERGY := 1.6

const COLOR_FLOOR_A := Color(0.22, 0.22, 0.26)
const COLOR_FLOOR_B := Color(0.19, 0.19, 0.23)
const COLOR_WALL := Color(0.1, 0.1, 0.12)
const COLOR_BOX := Color(1.0, 0.55, 0.1)
const COLOR_BOX_ON_TARGET := Color(0.25, 0.85, 0.35)
const COLOR_TARGET := Color(0.2, 0.75, 0.4)
const COLOR_PLAYER := Color(0.2, 0.55, 1.0)

var _static_root: Node3D = null
var _player_mesh: MeshInstance3D = null
var _player_grid_pos: Vector2i = Vector2i.ZERO
var _box_meshes: Dictionary = {}  # Vector2i(現在位置) -> MeshInstance3D
var _target_pulse_tweens: Array = []


## レベル読込時に一度だけ呼ぶ。床・壁・目標パッドを含め全て再構築する。
func load_level(board: CargoBoard) -> void:
	_clear()
	_static_root = Node3D.new()
	add_child(_static_root)

	for y in board.height:
		for x in board.width:
			var pos := Vector2i(x, y)
			if board.is_wall(pos):
				_add_static_box(_grid_to_world(pos, WALL_HEIGHT * 0.5), Vector3(CELL_SIZE, WALL_HEIGHT, CELL_SIZE), COLOR_WALL)
			else:
				var checker_color: Color = COLOR_FLOOR_A if (x + y) % 2 == 0 else COLOR_FLOOR_B
				_add_static_box(_grid_to_world(pos, FLOOR_HEIGHT * 0.5), Vector3(CELL_SIZE, FLOOR_HEIGHT, CELL_SIZE), checker_color)

	for target_pos in board.get_target_positions():
		_add_target_marker(target_pos)

	for box_pos in board.get_box_positions():
		var color: Color = COLOR_BOX_ON_TARGET if board.is_target(box_pos) else COLOR_BOX
		var box_mesh_instance := _create_mesh_instance(
			_grid_to_world(box_pos, FLOOR_HEIGHT + BOX_SIZE * 0.5), Vector3(BOX_SIZE, BOX_SIZE, BOX_SIZE), color
		)
		add_child(box_mesh_instance)
		_box_meshes[box_pos] = box_mesh_instance

	_player_grid_pos = board.get_player_position()
	_player_mesh = _create_mesh_instance(
		_grid_to_world(_player_grid_pos, FLOOR_HEIGHT + PLAYER_SIZE * 0.5),
		Vector3(PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE),
		COLOR_PLAYER
	)
	add_child(_player_mesh)


## 移動後に呼ぶ。プレイヤー・カーゴのうち実際に位置が変わったものだけをTweenで動かす。
func sync(board: CargoBoard) -> void:
	var new_player_pos: Vector2i = board.get_player_position()
	if new_player_pos != _player_grid_pos:
		_player_grid_pos = new_player_pos
		_tween_to(_player_mesh, _grid_to_world(new_player_pos, FLOOR_HEIGHT + PLAYER_SIZE * 0.5))

	var new_box_positions: Array = board.get_box_positions()
	var new_box_set: Dictionary = {}
	for pos in new_box_positions:
		new_box_set[pos] = true

	var moved_from: Vector2i = Vector2i(-1, -1)
	var moved_to: Vector2i = Vector2i(-1, -1)
	for old_pos in _box_meshes.keys():
		if not new_box_set.has(old_pos):
			moved_from = old_pos
	for new_pos in new_box_positions:
		if not _box_meshes.has(new_pos):
			moved_to = new_pos

	if moved_from != Vector2i(-1, -1) and moved_to != Vector2i(-1, -1):
		var mesh_instance: MeshInstance3D = _box_meshes[moved_from]
		_box_meshes.erase(moved_from)
		_box_meshes[moved_to] = mesh_instance
		_tween_box_move(mesh_instance, _grid_to_world(moved_to, FLOOR_HEIGHT + BOX_SIZE * 0.5))
		var landed_on_target: bool = board.is_target(moved_to)
		_set_box_color(mesh_instance, COLOR_BOX_ON_TARGET if landed_on_target else COLOR_BOX)
		if landed_on_target:
			box_landed_on_target.emit()


## 予備動作なしの単純な移動用Tween（プレイヤーに使用）。
func _tween_to(node: Node3D, target_position: Vector3) -> void:
	var tween := create_tween()
	tween.tween_property(node, "position", target_position, MOVE_TWEEN_DURATION)


## 押し出されたカーゴ用: 移動と同時に進行方向へスクイーズ→復元する（G-1: 発生→フォロースルー）。
func _tween_box_move(node: Node3D, target_position: Vector3) -> void:
	var tween := create_tween()
	tween.tween_property(node, "position", target_position, MOVE_TWEEN_DURATION)
	tween.parallel().tween_property(node, "scale", Vector3(1.15, 0.8, 1.15), SQUASH_DURATION)
	tween.tween_property(node, "scale", Vector3.ONE, MOVE_TWEEN_DURATION - SQUASH_DURATION)


func _set_box_color(mesh_instance: MeshInstance3D, color: Color) -> void:
	var box_mesh: BoxMesh = mesh_instance.mesh
	var mat: StandardMaterial3D = box_mesh.material
	mat.albedo_color = color


func _clear() -> void:
	for tween in _target_pulse_tweens:
		if is_instance_valid(tween):
			tween.kill()
	_target_pulse_tweens.clear()
	if _static_root != null:
		_static_root.queue_free()
		_static_root = null
	for mesh_instance in _box_meshes.values():
		mesh_instance.queue_free()
	_box_meshes.clear()
	if _player_mesh != null:
		_player_mesh.queue_free()
		_player_mesh = null


func _grid_to_world(pos: Vector2i, height_y: float) -> Vector3:
	return Vector3(pos.x * CELL_SIZE, height_y, pos.y * CELL_SIZE)


func _add_static_box(world_pos: Vector3, size: Vector3, color: Color) -> void:
	var mesh_instance := _create_mesh_instance(world_pos, size, color)
	_static_root.add_child(mesh_instance)


## 目標パッドを生成し、明るさをループで上下させるパルス発光を付与する（F-2: 判定の強調）。
func _add_target_marker(target_pos: Vector2i) -> void:
	var mesh_instance := _create_mesh_instance(
		_grid_to_world(target_pos, FLOOR_HEIGHT + TARGET_HEIGHT * 0.5),
		Vector3(TARGET_SIZE, TARGET_HEIGHT, TARGET_SIZE),
		COLOR_TARGET
	)
	var box_mesh: BoxMesh = mesh_instance.mesh
	var mat: StandardMaterial3D = box_mesh.material
	mat.emission_enabled = true
	mat.emission = COLOR_TARGET
	mat.emission_energy_multiplier = TARGET_PULSE_MIN_ENERGY
	_static_root.add_child(mesh_instance)

	var tween := create_tween()
	tween.set_loops()
	tween.tween_property(mat, "emission_energy_multiplier", TARGET_PULSE_MAX_ENERGY, TARGET_PULSE_DURATION)
	tween.tween_property(mat, "emission_energy_multiplier", TARGET_PULSE_MIN_ENERGY, TARGET_PULSE_DURATION)
	_target_pulse_tweens.append(tween)


## 親を持たないMeshInstance3Dを生成する（呼び出し側で add_child する）。
func _create_mesh_instance(world_pos: Vector3, size: Vector3, color: Color) -> MeshInstance3D:
	# 静的なプリミティブ形状のみで良いため、実行時にブール演算が走るCSGBox3Dではなく
	# 軽量な MeshInstance3D + BoxMesh を使用する。
	var mesh_instance := MeshInstance3D.new()
	var box_mesh := BoxMesh.new()
	box_mesh.size = size
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	box_mesh.material = mat
	mesh_instance.mesh = box_mesh
	mesh_instance.position = world_pos
	return mesh_instance
