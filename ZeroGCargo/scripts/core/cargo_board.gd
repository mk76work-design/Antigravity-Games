class_name CargoBoard
extends RefCounted

## 無重力貨物ステーションの盤面ロジック（Node非依存 / ヘッドレスGUTテスト対象）。
## 座標系: Vector2i(x, y) の x=列, y=行。UP は y-1（画面奥/上方向）とする。
## 高さ（段差）を持つ床にも対応する: プレイヤーは1段差までなら昇り降りできるが、
## カーゴは同じ高さの床同士でしか押し出せない（段差を越えて押せない）。
## エレベーター/ポータルは「2マスをペアで結ぶワープタイル」として実装する:
## プレイヤーがどちらかのマスに移動すると、高さ・距離に関わらずもう一方へ即座に転送される
## （移動先マスへの通常の1段差ルールは適用された上で転送される）。カーゴは通過できない。

const UP := Vector2i(0, -1)
const DOWN := Vector2i(0, 1)
const LEFT := Vector2i(-1, 0)
const RIGHT := Vector2i(1, 0)

const WARP_TYPE_ELEVATOR := "elevator"
const WARP_TYPE_PORTAL := "portal"

var width: int = 0
var height: int = 0
var walls: Dictionary = {}
var targets: Dictionary = {}
var boxes: Dictionary = {}
var heights: Dictionary = {}  # Vector2i -> int（未指定マスは高さ0）
var warps: Dictionary = {}  # Vector2i -> Vector2i（転送先。ペアの両側に相互登録）
var warp_types: Dictionary = {}  # Vector2i -> String（表示用。WARP_TYPE_*）
var player: Vector2i = Vector2i.ZERO


## レベルレイアウト（ASCII風文字列配列）からCargoBoardを構築する。
## 記号: '#'=壁 '.'=床(高さ0) '@'=プレイヤー初期位置 '$'=カーゴ '*'=目標パッド
## '1'〜'9'=床（その数字の高さ）。カーゴ・目標パッド・プレイヤー初期位置は高さ0扱い。
## 'E'=エレベーターパッド（レベル内にちょうど2個でペアになる）
## 'T'=ポータルパッド（同様にちょうど2個でペアになる）
static func from_layout(layout: PackedStringArray) -> CargoBoard:
	var board := CargoBoard.new()
	board.height = layout.size()
	var elevator_positions: Array = []
	var portal_positions: Array = []
	for row_index in layout.size():
		var row: String = layout[row_index]
		board.width = max(board.width, row.length())
		for col_index in row.length():
			var pos := Vector2i(col_index, row_index)
			var ch: String = row[col_index]
			match ch:
				"#":
					board.walls[pos] = true
				"@":
					board.player = pos
				"$":
					board.boxes[pos] = true
				"*":
					board.targets[pos] = true
				"E":
					elevator_positions.append(pos)
				"T":
					portal_positions.append(pos)
			if ch.is_valid_int() and ch != "0":
				board.heights[pos] = ch.to_int()
	board._link_warp_pair(elevator_positions, WARP_TYPE_ELEVATOR)
	board._link_warp_pair(portal_positions, WARP_TYPE_PORTAL)
	return board


## 同種のワープ記号がちょうど2個あれば相互に転送先として登録する。
func _link_warp_pair(positions: Array, warp_type: String) -> void:
	if positions.size() != 2:
		return
	var a: Vector2i = positions[0]
	var b: Vector2i = positions[1]
	warps[a] = b
	warps[b] = a
	warp_types[a] = warp_type
	warp_types[b] = warp_type


func is_wall(pos: Vector2i) -> bool:
	return walls.has(pos)


func is_box(pos: Vector2i) -> bool:
	return boxes.has(pos)


func is_target(pos: Vector2i) -> bool:
	return targets.has(pos)


## 指定マスの高さ（段差）。未指定なら0。
func get_height(pos: Vector2i) -> int:
	return heights.get(pos, 0)


func is_warp(pos: Vector2i) -> bool:
	return warps.has(pos)


func get_warp_positions() -> Array:
	return warps.keys()


## ワープの種別（WARP_TYPE_ELEVATOR / WARP_TYPE_PORTAL）。ワープでなければ空文字列。
func get_warp_type(pos: Vector2i) -> String:
	return warp_types.get(pos, "")


func get_player_position() -> Vector2i:
	return player


func get_box_positions() -> Array:
	return boxes.keys()


func get_target_positions() -> Array:
	return targets.keys()


## direction には UP/DOWN/LEFT/RIGHT 定数を渡す。
## プレイヤーの移動（カーゴがあれば押し出しを試行）に成功した場合 true を返す。
## 壁・盤面外・押し出し不能・段差制約違反の場合は盤面を変更せず false を返す。
## 移動先がエレベーター/ポータルパッドの場合、移動完了後にペア先へ即座に転送される。
func move(direction: Vector2i) -> bool:
	var next_pos: Vector2i = player + direction
	if is_wall(next_pos):
		return false
	# プレイヤーは1段差までなら昇り降りできる（それ以上の段差は通行不可）
	if absi(get_height(next_pos) - get_height(player)) > 1:
		return false
	if is_box(next_pos):
		var box_next_pos: Vector2i = next_pos + direction
		if is_wall(box_next_pos) or is_box(box_next_pos) or is_warp(box_next_pos):
			return false
		# カーゴは同じ高さの床同士でしか押し出せない（段差を越えて押せない）
		if get_height(box_next_pos) != get_height(next_pos):
			return false
		boxes.erase(next_pos)
		boxes[box_next_pos] = true
	player = next_pos
	if is_warp(player):
		player = warps[player]
	return true


## 全てのカーゴが目標パッド上にあればクリアとする。
func is_cleared() -> bool:
	if boxes.size() != targets.size():
		return false
	for box_pos in boxes.keys():
		if not targets.has(box_pos):
			return false
	return true
