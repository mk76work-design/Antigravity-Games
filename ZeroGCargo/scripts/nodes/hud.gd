class_name Hud
extends CanvasLayer

## レベル番号・手数・クリア表示のみを担当するUI。ノードはコードで構築する
## （手描きレイアウト作成を避け、テキストベースで完結させるため）。
## Sakurai Presentationスキルの原則（文字サイズは大きめ、重要な情報は視覚的に強調）に基づき、
## 半透明パネル背景とCLEAR表示のポップ演出を付与する。

const STATUS_FONT_SIZE := 28
const CLEARED_FONT_SIZE := 40
const PANEL_PADDING := Vector2(16, 12)
const CLEARED_POP_DURATION := 0.25

var _status_panel: Panel
var _status_label: Label
var _cleared_label: Label


func _ready() -> void:
	_status_panel = _create_panel(Vector2(16, 16), Vector2(360, 48))
	add_child(_status_panel)

	_status_label = Label.new()
	_status_label.position = PANEL_PADDING
	_status_label.add_theme_font_size_override("font_size", STATUS_FONT_SIZE)
	_status_panel.add_child(_status_label)

	_cleared_label = Label.new()
	_cleared_label.position = Vector2(16, 76)
	_cleared_label.add_theme_font_size_override("font_size", CLEARED_FONT_SIZE)
	_cleared_label.add_theme_color_override("font_color", Color(0.35, 0.95, 0.5))
	_cleared_label.visible = false
	_cleared_label.pivot_offset = Vector2(0, CLEARED_FONT_SIZE * 0.5)
	add_child(_cleared_label)


func update_status(level_number: int, total_levels: int, move_count: int) -> void:
	_status_label.text = "Level %d / %d   Moves: %d" % [level_number, total_levels, move_count]
	_cleared_label.visible = false


func show_level_cleared() -> void:
	_show_cleared_text("CLEAR!")


func show_all_levels_completed() -> void:
	_show_cleared_text("ALL LEVELS CLEARED!")


func _show_cleared_text(text: String) -> void:
	_cleared_label.text = text
	_cleared_label.visible = true
	_cleared_label.scale = Vector2(0.4, 0.4)
	var tween := create_tween()
	tween.set_trans(Tween.TRANS_BACK)
	tween.set_ease(Tween.EASE_OUT)
	tween.tween_property(_cleared_label, "scale", Vector2.ONE, CLEARED_POP_DURATION)


func _create_panel(pos: Vector2, size: Vector2) -> Panel:
	var panel := Panel.new()
	panel.position = pos
	panel.size = size
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.05, 0.05, 0.08, 0.55)
	style.corner_radius_top_left = 8
	style.corner_radius_top_right = 8
	style.corner_radius_bottom_left = 8
	style.corner_radius_bottom_right = 8
	panel.add_theme_stylebox_override("panel", style)
	return panel
