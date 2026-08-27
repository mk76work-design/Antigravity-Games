class_name PlayerController
extends Node

## キー入力(標準の ui_up/down/left/right アクション)を受け取り、CargoBoard.move()を呼ぶ。
## ロジック本体は持たず、CargoBoardとBoardView3Dの橋渡しに責務を限定する。

signal board_updated(move_count: int)
signal level_cleared

var board: CargoBoard = null
var view: BoardView3D = null
var move_count: int = 0


func setup(new_board: CargoBoard, new_view: BoardView3D) -> void:
	board = new_board
	view = new_view
	move_count = 0
	view.render(board)
	board_updated.emit(move_count)


func _unhandled_input(event: InputEvent) -> void:
	var direction := Vector2i.ZERO
	if event.is_action_pressed("ui_up"):
		direction = CargoBoard.UP
	elif event.is_action_pressed("ui_down"):
		direction = CargoBoard.DOWN
	elif event.is_action_pressed("ui_left"):
		direction = CargoBoard.LEFT
	elif event.is_action_pressed("ui_right"):
		direction = CargoBoard.RIGHT
	else:
		return
	_try_move(direction)


func _try_move(direction: Vector2i) -> void:
	if board == null or view == null:
		return
	var moved: bool = board.move(direction)
	if not moved:
		return
	move_count += 1
	view.render(board)
	board_updated.emit(move_count)
	if board.is_cleared():
		level_cleared.emit()
