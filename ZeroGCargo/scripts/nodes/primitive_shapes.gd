class_name PrimitiveShapes
extends RefCounted

## 手描きアセット無しで「3Dらしさ」を出すための複合プリミティブ生成ファクトリ。
## 全て MeshInstance3D + BoxMesh + StandardMaterial3D の組み合わせのみで構成する。
## 色変更・発光アニメーションが必要な要素は {"root": Node3D, "primary_mesh": MeshInstance3D}
## の Dictionary を返し、呼び出し側は primary_mesh.mesh.material 経由で更新する。

const COLOR_WALL_TRIM := Color(0.55, 0.6, 0.68)
const COLOR_WALL_GLOW := Color(0.3, 0.75, 1.0)
const COLOR_TARGET_RING := Color(0.08, 0.08, 0.1)
const COLOR_CRATE_CAP := Color(0.55, 0.3, 0.05)
const COLOR_ROBOT_HEAD := Color(0.85, 0.9, 0.95)
const COLOR_ROBOT_EYE := Color(0.9, 0.95, 1.0)


## 単一のBoxMesh+単色マテリアルを持つMeshInstance3Dを生成する（親には追加しない）。
static func make_box(size: Vector3, color: Color, local_pos: Vector3 = Vector3.ZERO) -> MeshInstance3D:
	var mesh_instance := MeshInstance3D.new()
	var box_mesh := BoxMesh.new()
	box_mesh.size = size
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	box_mesh.material = mat
	mesh_instance.mesh = box_mesh
	mesh_instance.position = local_pos
	return mesh_instance


## 壁: 本体(濃色) + 上部トリム(明色) + 中腹の発光ラインで宇宙ステーションの通路感を出す。
static func make_wall(cell_size: float, wall_height: float, base_color: Color) -> Node3D:
	var root := Node3D.new()

	var body_height: float = wall_height * 0.8
	root.add_child(make_box(Vector3(cell_size, body_height, cell_size), base_color, Vector3(0, body_height * 0.5, 0)))

	var trim_height: float = wall_height * 0.15
	var trim_y: float = body_height + trim_height * 0.5
	root.add_child(make_box(Vector3(cell_size * 1.02, trim_height, cell_size * 1.02), COLOR_WALL_TRIM, Vector3(0, trim_y, 0)))

	var glow_mesh := make_box(
		Vector3(cell_size * 1.01, wall_height * 0.06, cell_size * 1.01), COLOR_WALL_GLOW, Vector3(0, wall_height * 0.55, 0)
	)
	var glow_mat: StandardMaterial3D = glow_mesh.mesh.material
	glow_mat.emission_enabled = true
	glow_mat.emission = COLOR_WALL_GLOW
	glow_mat.emission_energy_multiplier = 1.2
	root.add_child(glow_mesh)

	return root


## 床タイル: ベース + 一回り小さい明るめのインセットパネルで「板張り」感を出す。
static func make_floor(cell_size: float, floor_height: float, base_color: Color, inset_color: Color) -> Node3D:
	var root := Node3D.new()
	root.add_child(make_box(Vector3(cell_size, floor_height, cell_size), base_color, Vector3(0, floor_height * 0.5, 0)))

	var inset_margin: float = cell_size * 0.12
	var inset_height: float = floor_height * 0.4
	root.add_child(
		make_box(
			Vector3(cell_size - inset_margin, inset_height, cell_size - inset_margin),
			inset_color,
			Vector3(0, floor_height + inset_height * 0.5, 0)
		)
	)
	return root


## 目標パッド: 濃色のリング状ベース + パルス発光するパッド本体（呼び出し側でTween制御）。
static func make_target_pad(size: float, height: float, color: Color) -> Dictionary:
	var root := Node3D.new()
	root.add_child(make_box(Vector3(size * 1.3, height * 0.5, size * 1.3), COLOR_TARGET_RING, Vector3(0, height * 0.25, 0)))

	var pad_mesh := make_box(Vector3(size, height, size), color, Vector3(0, height * 0.5 + height * 0.5, 0))
	var mat: StandardMaterial3D = pad_mesh.mesh.material
	mat.emission_enabled = true
	mat.emission = color
	root.add_child(pad_mesh)

	return {"root": root, "primary_mesh": pad_mesh}


## カーゴ: 本体 + 一回り小さい蓋(キャップ)で「輸送コンテナ」らしさを出す。色変更対象は本体。
static func make_cargo_crate(size: float, color: Color) -> Dictionary:
	var root := Node3D.new()
	var body_height: float = size * 0.75
	var body_mesh := make_box(Vector3(size, body_height, size), color, Vector3(0, body_height * 0.5, 0))
	root.add_child(body_mesh)

	var cap_height: float = size * 0.22
	root.add_child(
		make_box(Vector3(size * 0.92, cap_height, size * 0.92), COLOR_CRATE_CAP, Vector3(0, body_height + cap_height * 0.5, 0))
	)

	return {"root": root, "primary_mesh": body_mesh}


## プレイヤー: 胴体 + 頭 + 前面の目(発光)の簡易ロボット。目の向きで移動方向を表現する。
static func make_player_robot(size: float, color: Color) -> Node3D:
	var root := Node3D.new()

	var body_height: float = size * 0.7
	root.add_child(make_box(Vector3(size * 0.8, body_height, size * 0.8), color, Vector3(0, body_height * 0.5, 0)))

	var head_size: float = size * 0.5
	var head_y: float = body_height + head_size * 0.5
	root.add_child(make_box(Vector3(head_size, head_size, head_size), COLOR_ROBOT_HEAD, Vector3(0, head_y, 0)))

	var eye_mesh := make_box(
		Vector3(head_size * 0.5, head_size * 0.25, head_size * 0.1),
		COLOR_ROBOT_EYE,
		Vector3(0, head_y, -head_size * 0.5)
	)
	var eye_mat: StandardMaterial3D = eye_mesh.mesh.material
	eye_mat.emission_enabled = true
	eye_mat.emission = COLOR_ROBOT_EYE
	eye_mat.emission_energy_multiplier = 1.5
	root.add_child(eye_mesh)

	return root
