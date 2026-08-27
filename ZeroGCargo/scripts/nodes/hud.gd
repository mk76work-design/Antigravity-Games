class_name Hud
extends CanvasLayer

## レベル番号・手数・クリア表示のみを担当するUI。ノードはコードで構築する
## （手描きレイアウト作成を避け、テキストベースで完結させるため）。

var _status_label: Label
var _cleared_label: Label


func _ready() -> void:
	_status_label = Label.new()
	_status_label.position = Vector2(16, 16)
	_status_label.add_theme_font_size_override("font_size", 24)
	add_child(_status_label)

	_cleared_label = Label.new()
	_cleared_label.position = Vector2(16, 56)
	_cleared_label.add_theme_font_size_override("font_size", 32)
	_cleared_label.visible = false
	add_child(_cleared_label)


func update_status(level_number: int, total_levels: int, move_count: int) -> void:
	_status_label.text = "Level %d / %d   Moves: %d" % [level_number, total_levels, move_count]
	_cleared_label.visible = false


func show_level_cleared() -> void:
	_cleared_label.text = "CLEAR!"
	_cleared_label.visible = true


func show_all_levels_completed() -> void:
	_cleared_label.text = "ALL LEVELS CLEARED!"
	_cleared_label.visible = true
