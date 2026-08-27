extends Node

## 責務を「現在のレベル番号管理」「レベル一覧の提供」のみに限定したAutoload（シングルトン）。
## 盤面ロジック(CargoBoard)そのものはここに置かず、Main側で保持する。

signal level_changed(level_index: int)
signal all_levels_completed

var current_level_index: int = 0


func get_current_level_layout() -> PackedStringArray:
	return LevelData.get_level(current_level_index)


func get_current_level_number() -> int:
	return current_level_index + 1


func get_total_level_count() -> int:
	return LevelData.get_level_count()


## 次のレベルへ進む。全レベルクリア済みなら false を返す。
func advance_level() -> bool:
	if current_level_index + 1 >= LevelData.get_level_count():
		all_levels_completed.emit()
		return false
	current_level_index += 1
	level_changed.emit(current_level_index)
	return true


func reset_to_first_level() -> void:
	current_level_index = 0
	level_changed.emit(current_level_index)
