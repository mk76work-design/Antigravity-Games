extends GutTest

## CargoBoard: クリア判定、および全5レベルの解手順による可解性検証。
## 各レベルの手順は Python製BFSソルバーで事前に機械検証済みの最短解を用いる。

## プレイヤー(1,1) -> カーゴ(1,2) -> 目標(1,3) が縦一列に並ぶレイアウト。
## DOWN移動でカーゴを目標に押し込める。
const NOT_CLEARED_LAYOUT: PackedStringArray = [
	"####",
	"#@.#",
	"#$.#",
	"#*.#",
	"####",
]

const DIRS: Dictionary = {
	"UP": CargoBoard.UP,
	"DOWN": CargoBoard.DOWN,
	"LEFT": CargoBoard.LEFT,
	"RIGHT": CargoBoard.RIGHT,
}

## BFSソルバー(sokoban_solver.py)で検証済みの各レベルの最短クリア手順
## 注意: Godot 4.3には要素サイズが異なるネストした`const Array[PackedStringArray]`
## リテラルでメモリ破損を起こすエンジン側の不具合があるため、意図的に`const`ではなく`var`にしている。
var LEVEL_SOLUTIONS: Array[PackedStringArray] = [
	["DOWN"],
	["RIGHT", "RIGHT", "DOWN", "DOWN", "LEFT", "RIGHT", "UP", "UP", "LEFT", "LEFT", "DOWN", "RIGHT"],
	["RIGHT", "DOWN", "UP", "RIGHT", "RIGHT", "DOWN"],
	["RIGHT", "DOWN", "UP", "RIGHT", "RIGHT", "DOWN", "LEFT", "DOWN", "DOWN"],
	["RIGHT", "DOWN", "UP", "RIGHT", "DOWN", "UP", "RIGHT", "DOWN"],
]


func test_is_cleared_false_when_box_not_on_target() -> void:
	var board := CargoBoard.from_layout(NOT_CLEARED_LAYOUT)

	assert_false(board.is_cleared())


func test_is_cleared_true_when_box_already_on_target() -> void:
	var board := CargoBoard.from_layout(NOT_CLEARED_LAYOUT)
	# ASCIIレイアウトは1マス1記号のため「カーゴが最初から目標上にある」状態は
	# 盤面データを直接書き換えて再現する（is_cleared()自体の判定ロジック検証が目的）。
	var target_pos: Vector2i = board.get_target_positions()[0]
	board.boxes.clear()
	board.boxes[target_pos] = true

	assert_true(board.is_cleared())


func test_is_cleared_true_after_pushing_box_onto_target() -> void:
	var board := CargoBoard.from_layout(NOT_CLEARED_LAYOUT)
	board.move(CargoBoard.DOWN)

	assert_true(board.is_cleared())


func test_all_levels_are_solvable_with_verified_sequence() -> void:
	assert_eq(LevelData.get_level_count(), LEVEL_SOLUTIONS.size(), "レベル数と解手順の数が一致していること")

	for level_index in LevelData.get_level_count():
		var board := CargoBoard.from_layout(LevelData.get_level(level_index))
		var solution: PackedStringArray = LEVEL_SOLUTIONS[level_index]

		for direction_name in solution:
			var moved := board.move(DIRS[direction_name])
			assert_true(
				moved,
				"Lv%d: 手順 '%s' は有効な移動のはず" % [level_index + 1, direction_name]
			)

		assert_true(
			board.is_cleared(),
			"Lv%d: 検証済み手順の実行後はクリア状態になるはず" % [level_index + 1]
		)
