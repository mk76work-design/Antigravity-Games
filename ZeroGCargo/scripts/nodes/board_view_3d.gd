class_name BoardView3D
extends Node3D

## CargoBoard（core/ロジック）の状態を読み取り、プリミティブ形状のみで3D表示する。
## 手描きアセット（テクスチャ・3Dモデル）は一切使用しない。
## MVPでは移動のたびに全プリミティブを再構築する（正しさの担保はcore/のGUTテストが担う）。

const CELL_SIZE := 1.0
const WALL_HEIGHT := 1.0
const FLOOR_HEIGHT := 0.1
const BOX_SIZE := 0.8
const TARGET_SIZE := 0.6
const TARGET_HEIGHT := 0.05
const PLAYER_SIZE := 0.7

const COLOR_FLOOR := Color(0.22, 0.22, 0.26)
const COLOR_WALL := Color(0.1, 0.1, 0.12)
const COLOR_BOX := Color(1.0, 0.55, 0.1)
const COLOR_BOX_ON_TARGET := Color(0.25, 0.85, 0.35)
const COLOR_TARGET := Color(0.2, 0.75, 0.4)
const COLOR_PLAYER := Color(0.2, 0.55, 1.0)

var _dynamic_root: Node3D = null


## 盤面全体を再構築して表示する。初期表示・移動後の更新の両方で呼び出す。
func render(board: CargoBoard) -> void:
	_clear()
	_dynamic_root = Node3D.new()
	add_child(_dynamic_root)

	for y in board.height:
		for x in board.width:
			var pos := Vector2i(x, y)
			if board.is_wall(pos):
				_add_box(_grid_to_world(pos, WALL_HEIGHT * 0.5), Vector3(CELL_SIZE, WALL_HEIGHT, CELL_SIZE), COLOR_WALL)
			else:
				_add_box(_grid_to_world(pos, FLOOR_HEIGHT * 0.5), Vector3(CELL_SIZE, FLOOR_HEIGHT, CELL_SIZE), COLOR_FLOOR)

	for target_pos in board.get_target_positions():
		_add_box(
			_grid_to_world(target_pos, FLOOR_HEIGHT + TARGET_HEIGHT * 0.5),
			Vector3(TARGET_SIZE, TARGET_HEIGHT, TARGET_SIZE),
			COLOR_TARGET
		)

	for box_pos in board.get_box_positions():
		var color: Color = COLOR_BOX_ON_TARGET if board.is_target(box_pos) else COLOR_BOX
		_add_box(_grid_to_world(box_pos, FLOOR_HEIGHT + BOX_SIZE * 0.5), Vector3(BOX_SIZE, BOX_SIZE, BOX_SIZE), color)

	_add_box(
		_grid_to_world(board.get_player_position(), FLOOR_HEIGHT + PLAYER_SIZE * 0.5),
		Vector3(PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE),
		COLOR_PLAYER
	)


func _clear() -> void:
	if _dynamic_root != null:
		_dynamic_root.queue_free()
		_dynamic_root = null


func _grid_to_world(pos: Vector2i, height_y: float) -> Vector3:
	return Vector3(pos.x * CELL_SIZE, height_y, pos.y * CELL_SIZE)


func _add_box(world_pos: Vector3, size: Vector3, color: Color) -> void:
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
	_dynamic_root.add_child(mesh_instance)
