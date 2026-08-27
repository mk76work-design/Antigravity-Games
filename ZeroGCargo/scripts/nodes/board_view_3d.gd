class_name BoardView3D
extends Node3D

## CargoBoard（core/ロジック）の状態を読み取り、プリミティブ形状のみで3D表示する。
## 手描きアセット（テクスチャ・3Dモデル）は一切使用しない。
## 個々の見た目（壁・床・目標・カーゴ・プレイヤー）は`PrimitiveShapes`の複合プリミティブに委譲し、
## 本スクリプトは盤面状態とTweenアニメーションの橋渡しに専念する。
## 床・壁・目標パッドはレベル読込時に一度だけ構築し、プレイヤー・カーゴは
## 移動のたびに位置差分だけをTweenで補間する（正しさの担保はcore/のGUTテストが担う）。

signal box_landed_on_target

const CELL_SIZE := 1.0
const WALL_HEIGHT := 1.0
const FLOOR_HEIGHT := 0.1
const FLOOR_TOP := FLOOR_HEIGHT * 1.4  # ベース+インセットパネル分を含めた床の実際の高さ
const HEIGHT_STEP := 0.4  # CargoBoardの高さ1段あたりのワールドY方向の距離
const RISER_THICKNESS := 0.08
const BOX_SIZE := 0.8
const TARGET_SIZE := 0.55
const TARGET_HEIGHT := 0.08
const PLAYER_SIZE := 0.7
const MOVE_TWEEN_DURATION := 0.12
const SQUASH_DURATION := 0.08
const TARGET_PULSE_DURATION := 0.9
const TARGET_PULSE_MIN_ENERGY := 0.4
const TARGET_PULSE_MAX_ENERGY := 1.6

const COLOR_FLOOR_A := Color(0.22, 0.22, 0.26)
const COLOR_FLOOR_A_INSET := Color(0.27, 0.27, 0.32)
const COLOR_FLOOR_B := Color(0.19, 0.19, 0.23)
const COLOR_FLOOR_B_INSET := Color(0.24, 0.24, 0.29)
const COLOR_WALL := Color(0.1, 0.1, 0.12)
const COLOR_BOX := Color(1.0, 0.55, 0.1)
const COLOR_BOX_ON_TARGET := Color(0.25, 0.85, 0.35)
const COLOR_TARGET := Color(0.2, 0.75, 0.4)
const COLOR_PLAYER := Color(0.2, 0.55, 1.0)
const COLOR_RISER := Color(0.15, 0.15, 0.19)

var _static_root: Node3D = null
var _player_mesh: Node3D = null
var _player_grid_pos: Vector2i = Vector2i.ZERO
var _box_meshes: Dictionary = {}  # Vector2i(現在位置) -> Node3D(カーゴのroot)
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
				var wall := PrimitiveShapes.make_wall(CELL_SIZE, WALL_HEIGHT, COLOR_WALL)
				wall.position = _grid_to_world(pos, 0.0)
				_static_root.add_child(wall)
			else:
				var is_a: bool = (x + y) % 2 == 0
				var base_color: Color = COLOR_FLOOR_A if is_a else COLOR_FLOOR_B
				var inset_color: Color = COLOR_FLOOR_A_INSET if is_a else COLOR_FLOOR_B_INSET
				var floor_tile := PrimitiveShapes.make_floor(CELL_SIZE, FLOOR_HEIGHT, base_color, inset_color)
				floor_tile.position = _grid_to_world(pos, _elevation(board, pos))
				_static_root.add_child(floor_tile)

	_add_elevation_risers(board)

	for target_pos in board.get_target_positions():
		_add_target_marker(board, target_pos)

	for box_pos in board.get_box_positions():
		var color: Color = COLOR_BOX_ON_TARGET if board.is_target(box_pos) else COLOR_BOX
		var built: Dictionary = PrimitiveShapes.make_cargo_crate(BOX_SIZE, color)
		var root: Node3D = built["root"]
		root.position = _grid_to_world(box_pos, FLOOR_TOP + _elevation(board, box_pos))
		root.set_meta("primary_mesh", built["primary_mesh"])
		add_child(root)
		_box_meshes[box_pos] = root

	_player_grid_pos = board.get_player_position()
	_player_mesh = PrimitiveShapes.make_player_robot(PLAYER_SIZE, COLOR_PLAYER)
	_player_mesh.position = _grid_to_world(_player_grid_pos, FLOOR_TOP + _elevation(board, _player_grid_pos))
	add_child(_player_mesh)


## 移動後に呼ぶ。プレイヤー・カーゴのうち実際に位置が変わったものだけをTweenで動かす。
func sync(board: CargoBoard) -> void:
	var new_player_pos: Vector2i = board.get_player_position()
	if new_player_pos != _player_grid_pos:
		var delta: Vector2i = new_player_pos - _player_grid_pos
		_player_mesh.look_at(_player_mesh.global_position + Vector3(delta.x, 0.0, delta.y), Vector3.UP)
		_player_grid_pos = new_player_pos
		_tween_to(_player_mesh, _grid_to_world(new_player_pos, FLOOR_TOP + _elevation(board, new_player_pos)))

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
		var root: Node3D = _box_meshes[moved_from]
		_box_meshes.erase(moved_from)
		_box_meshes[moved_to] = root
		_tween_box_move(root, _grid_to_world(moved_to, FLOOR_TOP + _elevation(board, moved_to)))
		var landed_on_target: bool = board.is_target(moved_to)
		_set_box_color(root, COLOR_BOX_ON_TARGET if landed_on_target else COLOR_BOX)
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


func _set_box_color(root: Node3D, color: Color) -> void:
	var primary_mesh: MeshInstance3D = root.get_meta("primary_mesh")
	var box_mesh: BoxMesh = primary_mesh.mesh
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
	for root in _box_meshes.values():
		root.queue_free()
	_box_meshes.clear()
	if _player_mesh != null:
		_player_mesh.queue_free()
		_player_mesh = null


func _grid_to_world(pos: Vector2i, height_y: float) -> Vector3:
	return Vector3(pos.x * CELL_SIZE, height_y, pos.y * CELL_SIZE)


## 指定マスの高さ（段差）をワールドY座標のオフセットに変換する。
func _elevation(board: CargoBoard, pos: Vector2i) -> float:
	return board.get_height(pos) * HEIGHT_STEP


## 高さの異なる床が隣接する境界に、段差の側面を埋めるライザーを配置する。
## 各セルはRIGHT/DOWNの2方向だけを調べることで、同じ境界を二重に処理しない。
func _add_elevation_risers(board: CargoBoard) -> void:
	for y in board.height:
		for x in board.width:
			var pos := Vector2i(x, y)
			if board.is_wall(pos):
				continue
			_add_riser_if_needed(board, pos, Vector2i(1, 0))
			_add_riser_if_needed(board, pos, Vector2i(0, 1))


func _add_riser_if_needed(board: CargoBoard, pos: Vector2i, direction: Vector2i) -> void:
	var neighbor: Vector2i = pos + direction
	if neighbor.x < 0 or neighbor.x >= board.width or neighbor.y < 0 or neighbor.y >= board.height:
		return
	if board.is_wall(neighbor):
		return
	var elevation_a: float = _elevation(board, pos)
	var elevation_b: float = _elevation(board, neighbor)
	if is_equal_approx(elevation_a, elevation_b):
		return

	var low: float = min(elevation_a, elevation_b)
	var high: float = max(elevation_a, elevation_b)
	var edge_center: Vector3 = (_grid_to_world(pos, 0.0) + _grid_to_world(neighbor, 0.0)) * 0.5
	edge_center.y = (low + high) * 0.5

	var size: Vector3
	if direction.x != 0:
		size = Vector3(RISER_THICKNESS, high - low, CELL_SIZE)
	else:
		size = Vector3(CELL_SIZE, high - low, RISER_THICKNESS)

	_static_root.add_child(PrimitiveShapes.make_box(size, COLOR_RISER, edge_center))


## 目標パッドを生成し、明るさをループで上下させるパルス発光を付与する（F-2: 判定の強調）。
func _add_target_marker(board: CargoBoard, target_pos: Vector2i) -> void:
	var built: Dictionary = PrimitiveShapes.make_target_pad(TARGET_SIZE, TARGET_HEIGHT, COLOR_TARGET)
	var root: Node3D = built["root"]
	var primary_mesh: MeshInstance3D = built["primary_mesh"]
	root.position = _grid_to_world(target_pos, FLOOR_TOP + _elevation(board, target_pos))
	_static_root.add_child(root)

	var box_mesh: BoxMesh = primary_mesh.mesh
	var mat: StandardMaterial3D = box_mesh.material
	mat.emission_energy_multiplier = TARGET_PULSE_MIN_ENERGY

	var tween := create_tween()
	tween.set_loops()
	tween.tween_property(mat, "emission_energy_multiplier", TARGET_PULSE_MAX_ENERGY, TARGET_PULSE_DURATION)
	tween.tween_property(mat, "emission_energy_multiplier", TARGET_PULSE_MIN_ENERGY, TARGET_PULSE_DURATION)
	_target_pulse_tweens.append(tween)
