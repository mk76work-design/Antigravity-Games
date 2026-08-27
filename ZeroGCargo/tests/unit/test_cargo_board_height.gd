extends GutTest

## CargoBoard: 高さ（段差）に関する移動・押し出し制約の検証。

## プレイヤー(1,1)h0 -> 床(2,1)h1(1段差) -> 床(3,1)h2(隣とは1段差なので昇れる)
const STEP_LAYOUT: PackedStringArray = [
	"#####",
	"#@12#",
	"#####",
]

## プレイヤー(1,1)h0 -> 床(2,1)h0 -> 床(3,1)h2 が直接隣接（2段差、昇れない）
const DIRECT_TWO_STEP_LAYOUT: PackedStringArray = [
	"#####",
	"#@.2#",
	"#####",
]

## プレイヤー(1,1)h0 が (2,1)h0 のカーゴを (3,1)h1 へ押そうとするが、
## 高さが異なるため押し出せないレイアウト。
const HEIGHT_BLOCKED_PUSH_LAYOUT: PackedStringArray = [
	"#####",
	"#@$1#",
	"#####",
]


func test_player_can_step_up_one_height_level() -> void:
	var board := CargoBoard.from_layout(STEP_LAYOUT)
	var moved := board.move(CargoBoard.RIGHT)

	assert_true(moved, "1段差の昇りは成功するはず")
	assert_eq(board.get_player_position(), Vector2i(2, 1))


func test_player_cannot_cross_two_height_levels_at_once() -> void:
	var board := CargoBoard.from_layout(DIRECT_TWO_STEP_LAYOUT)
	board.move(CargoBoard.RIGHT)  # (1,1)h0 -> (2,1)h0
	var moved := board.move(CargoBoard.RIGHT)  # (2,1)h0 -> (3,1)h2 は2段差で失敗するはず

	assert_false(moved, "2段差以上の移動は失敗するはず")
	assert_eq(board.get_player_position(), Vector2i(2, 1), "位置は変化しない")


func test_get_height_reads_digit_from_layout() -> void:
	var board := CargoBoard.from_layout(STEP_LAYOUT)

	assert_eq(board.get_height(Vector2i(1, 1)), 0)
	assert_eq(board.get_height(Vector2i(2, 1)), 1)
	assert_eq(board.get_height(Vector2i(3, 1)), 2)


func test_push_fails_when_destination_height_differs() -> void:
	var board := CargoBoard.from_layout(HEIGHT_BLOCKED_PUSH_LAYOUT)
	var moved := board.move(CargoBoard.RIGHT)

	assert_false(moved, "カーゴの押し出し先の高さが異なる場合は押し出せないはず")
	assert_eq(board.get_player_position(), Vector2i(1, 1), "位置は変化しない")
	assert_true(board.is_box(Vector2i(2, 1)), "カーゴは元の位置のまま")
