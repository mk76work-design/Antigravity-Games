extends GutTest

## CargoBoard: カーゴの押し出しロジックの検証

const PUSH_LAYOUT: PackedStringArray = [
	"#####",
	"#@$.#",
	"#...#",
	"#####",
]

const BLOCKED_BY_WALL_LAYOUT: PackedStringArray = [
	"####",
	"#@$#",
	"####",
]

const BLOCKED_BY_BOX_LAYOUT: PackedStringArray = [
	"#####",
	"#@$$#",
	"#####",
]


func test_push_moves_box_and_player() -> void:
	var board := CargoBoard.from_layout(PUSH_LAYOUT)
	var moved := board.move(CargoBoard.RIGHT)

	assert_true(moved, "押し出し可能な場合は成功するはず")
	assert_eq(board.get_player_position(), Vector2i(2, 1))
	assert_true(board.is_box(Vector2i(3, 1)), "カーゴは1マス先に移動しているはず")
	assert_false(board.is_box(Vector2i(2, 1)), "元の位置にカーゴは残らない")


func test_push_fails_when_box_front_is_wall() -> void:
	var board := CargoBoard.from_layout(BLOCKED_BY_WALL_LAYOUT)
	var moved := board.move(CargoBoard.RIGHT)

	assert_false(moved, "カーゴの先が壁なら押し出せない")
	assert_eq(board.get_player_position(), Vector2i(1, 1))
	assert_true(board.is_box(Vector2i(2, 1)), "カーゴは元の位置のまま")


func test_push_fails_when_box_front_is_another_box() -> void:
	var board := CargoBoard.from_layout(BLOCKED_BY_BOX_LAYOUT)
	var moved := board.move(CargoBoard.RIGHT)

	assert_false(moved, "カーゴの先に別のカーゴがあれば押し出せない")
	assert_true(board.is_box(Vector2i(2, 1)))
	assert_true(board.is_box(Vector2i(3, 1)))
