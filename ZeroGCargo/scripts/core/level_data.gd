class_name LevelData
extends RefCounted

## レベルレイアウトの定義（ASCII風の文字列配列）。
## 記号の意味:
##   '#' 壁 / '.' 床 / '@' プレイヤー初期位置 / '$' カーゴ / '*' 目標パッド
##   カーゴが目標パッド上にある初期配置は表現しない（全レベル、カーゴは床上から開始する）
## 注意: Godot 4.3には行数の異なるネストした`const Array[PackedStringArray]`リテラルで
## メモリ破損を起こすエンジン側の不具合があるため、意図的に`const`ではなく`static var`にしている。
static var LEVELS: Array[PackedStringArray] = [
	# Lv1: 3x4, カーゴ1個（操作練習。プレイヤーの真下にカーゴ、その下に目標）
	[
		"#@#",
		"#$#",
		"#*#",
		"###",
	],
	# Lv2: 5x5, カーゴ2個
	[
		"#####",
		"#@..#",
		"#.$*#",
		"#*$.#",
		"#####",
	],
	# Lv3: 6x5, カーゴ2個（縦一列に押し込む練習）
	[
		"######",
		"#@...#",
		"#.$.$#",
		"#.*.*#",
		"######",
	],
	# Lv4: 6x6, カーゴ3個
	[
		"######",
		"#@...#",
		"#.$.$#",
		"#.*.*#",
		"#..$.#",
		"##.*##",
	],
	# Lv5: 7x4, カーゴ3個（横一列・上級構成）
	[
		"#######",
		"#@....#",
		"#.$$$.#",
		"#.***.#",
		"#######",
	],
]


static func get_level_count() -> int:
	return LEVELS.size()


static func get_level(index: int) -> PackedStringArray:
	return LEVELS[index]
