class_name CargoBoard
extends RefCounted

## 無重力貨物ステーションの盤面ロジック（Node非依存 / ヘッドレスGUTテスト対象）。
## 座標系: Vector2i(x, y) の x=列, y=行。UP は y-1（画面奥/上方向）とする。

const UP := Vector2i(0, -1)
const DOWN := Vector2i(0, 1)
const LEFT := Vector2i(-1, 0)
const RIGHT := Vector2i(1, 0)

var width: int = 0
var height: int = 0
var walls: Dictionary = {}
var targets: Dictionary = {}
var boxes: Dictionary = {}
var player: Vector2i = Vector2i.ZERO


## レベルレイアウト（ASCII風文字列配列）からCargoBoardを構築する。
## 記号: '#'=壁 '.'=床 '@'=プレイヤー初期位置 '$'=カーゴ '*'=目標パッド
static func from_layout(layout: PackedStringArray) -> CargoBoard:
	var board := CargoBoard.new()
	board.height = layout.size()
	for row_index in layout.size():
		var row: String = layout[row_index]
		board.width = max(board.width, row.length())
		for col_index in row.length():
			var pos := Vector2i(col_index, row_index)
			match row[col_index]:
				"#":
					board.walls[pos] = true
				"@":
					board.player = pos
				"$":
					board.boxes[pos] = true
				"*":
					board.targets[pos] = true
	return board


func is_wall(pos: Vector2i) -> bool:
	return walls.has(pos)


func is_box(pos: Vector2i) -> bool:
	return boxes.has(pos)


func is_target(pos: Vector2i) -> bool:
	return targets.has(pos)


func get_player_position() -> Vector2i:
	return player


func get_box_positions() -> Array:
	return boxes.keys()


func get_target_positions() -> Array:
	return targets.keys()


## direction には UP/DOWN/LEFT/RIGHT 定数を渡す。
## プレイヤーの移動（カーゴがあれば押し出しを試行）に成功した場合 true を返す。
## 壁・盤面外・押し出し不能な場合は盤面を変更せず false を返す。
func move(direction: Vector2i) -> bool:
	var next_pos: Vector2i = player + direction
	if is_wall(next_pos):
		return false
	if is_box(next_pos):
		var box_next_pos: Vector2i = next_pos + direction
		if is_wall(box_next_pos) or is_box(box_next_pos):
			return false
		boxes.erase(next_pos)
		boxes[box_next_pos] = true
	player = next_pos
	return true


## 全てのカーゴが目標パッド上にあればクリアとする。
func is_cleared() -> bool:
	if boxes.size() != targets.size():
		return false
	for box_pos in boxes.keys():
		if not targets.has(box_pos):
			return false
	return true
