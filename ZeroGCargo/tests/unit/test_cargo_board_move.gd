extends GutTest

## CargoBoard: 基本移動（押し出し無し）の検証

const SIMPLE_LAYOUT: PackedStringArray = [
	"####",
	"#@.#",
	"#..#",
	"####",
]


func test_player_moves_into_empty_floor() -> void:
	var board := CargoBoard.from_layout(SIMPLE_LAYOUT)
	var moved := board.move(CargoBoard.RIGHT)

	assert_true(moved, "床への移動は成功するはず")
	assert_eq(board.get_player_position(), Vector2i(2, 1))


func test_player_cannot_move_into_wall() -> void:
	var board := CargoBoard.from_layout(SIMPLE_LAYOUT)
	var moved := board.move(CargoBoard.UP)

	assert_false(moved, "壁への移動は失敗するはず")
	assert_eq(board.get_player_position(), Vector2i(1, 1), "壁にぶつかったら位置は変化しない")


func test_player_cannot_move_outside_board() -> void:
	# プレイヤーを盤面左端(x=1)に置いたまま更に左は壁 -> 盤面外相当の扱い
	var board := CargoBoard.from_layout(SIMPLE_LAYOUT)
	var moved := board.move(CargoBoard.LEFT)

	assert_false(moved)
	assert_eq(board.get_player_position(), Vector2i(1, 1))
