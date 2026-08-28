extends GutTest

## CargoBoard: エレベーター('E')・ポータル('T')ワープタイルの検証。

## プレイヤー(1,1) -> 床(2,1) -> エレベーター(3,1) はペア先(5,1)へ転送される。
const ELEVATOR_LAYOUT: PackedStringArray = [
	"#######",
	"#@.E.E#",
	"#######",
]

## プレイヤー(1,1) -> 床(2,1) -> ポータル(3,1) はペア先(5,1)へ転送される。
const PORTAL_LAYOUT: PackedStringArray = [
	"#######",
	"#@.T.T#",
	"#######",
]

## カーゴ(2,1)をエレベーター(3,1)へ押し出そうとしても失敗するレイアウト。
const BLOCKED_PUSH_LAYOUT: PackedStringArray = [
	"#####",
	"#@$E#",
	"#.E.#",
	"#####",
]


func test_stepping_onto_elevator_teleports_to_paired_position() -> void:
	var board := CargoBoard.from_layout(ELEVATOR_LAYOUT)
	board.move(CargoBoard.RIGHT)  # (1,1) -> (2,1)
	var moved := board.move(CargoBoard.RIGHT)  # (2,1) -> (3,1)エレベーター -> (5,1)へ転送

	assert_true(moved)
	assert_eq(board.get_player_position(), Vector2i(5, 1), "ペア先のエレベーターへ転送されるはず")


func test_stepping_onto_portal_teleports_to_paired_position() -> void:
	var board := CargoBoard.from_layout(PORTAL_LAYOUT)
	board.move(CargoBoard.RIGHT)  # (1,1) -> (2,1)
	var moved := board.move(CargoBoard.RIGHT)  # (2,1) -> (3,1)ポータル -> (5,1)へ転送

	assert_true(moved)
	assert_eq(board.get_player_position(), Vector2i(5, 1), "ペア先のポータルへ転送されるはず")


func test_get_warp_type_reports_correct_type() -> void:
	var elevator_board := CargoBoard.from_layout(ELEVATOR_LAYOUT)
	var portal_board := CargoBoard.from_layout(PORTAL_LAYOUT)

	assert_eq(elevator_board.get_warp_type(Vector2i(3, 1)), CargoBoard.WARP_TYPE_ELEVATOR)
	assert_eq(portal_board.get_warp_type(Vector2i(3, 1)), CargoBoard.WARP_TYPE_PORTAL)
	assert_eq(elevator_board.get_warp_type(Vector2i(2, 1)), "", "ワープでないマスは空文字列のはず")


func test_cargo_cannot_be_pushed_onto_warp_tile() -> void:
	var board := CargoBoard.from_layout(BLOCKED_PUSH_LAYOUT)
	var moved := board.move(CargoBoard.RIGHT)

	assert_false(moved, "カーゴをワープタイルへ押し出すことはできないはず")
	assert_eq(board.get_player_position(), Vector2i(1, 1), "位置は変化しない")
	assert_true(board.is_box(Vector2i(2, 1)), "カーゴは元の位置のまま")
