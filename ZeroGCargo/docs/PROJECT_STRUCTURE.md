# 📂 PROJECT_STRUCTURE.md

> 手動作成（`project_analyzer` のPowerShellスクリプトはLinux環境で未対応のため）
> 最終更新: 2026-08-27

---

## ディレクトリツリー

```
ZeroGCargo/
├── project.godot
├── scenes/
│   └── Main.tscn              # エントリシーン（root: Node3D, script=main.gd）
├── scripts/
│   ├── core/                  # Nodeに依存しない純粋ロジック（GUTテスト対象）
│   │   ├── cargo_board.gd
│   │   └── level_data.gd
│   ├── nodes/                 # シーンツリーに紐づく制御スクリプト
│   │   ├── main.gd
│   │   ├── board_view_3d.gd
│   │   ├── player_controller.gd
│   │   └── hud.gd
│   └── autoload/
│       └── game_manager.gd    # Autoload登録済み（project.godot [autoload]）
├── tests/
│   └── unit/
│       ├── test_cargo_board_move.gd
│       ├── test_cargo_board_push.gd
│       └── test_cargo_board_win_condition.gd
├── addons/
│   └── gut/                   # GUT (Godot Unit Test) 9.3.0, GitHubより導入
└── docs/
    ├── implementation_plan.md
    ├── PROJECT_STRUCTURE.md（本ファイル）
    ├── REPO_MAP.md
    └── LESSONS_LEARNED.md
```

---

## ファイル種別サマリー

| 拡張子 | ファイル数 | 合計行数 | 備考 |
|--------|----------|---------|------|
| .gd | 10 | 580 | 全ファイル300行以内 |
| .tscn | 1 | 6 | Main.tscn（最小構成、ノードはコードで構築） |
| .godot | 1 | - | project.godot |

---

## 全ファイル一覧（.gd）

| パス | 行数 | 責務 |
|------|------|------|
| `scripts/core/cargo_board.gd` | 90 | 盤面ロジック本体（RefCounted） |
| `scripts/core/level_data.gd` | 59 | 5レベル分のレイアウト定義 |
| `scripts/nodes/main.gd` | 71 | エントリポイント、カメラ/結線 |
| `scripts/nodes/board_view_3d.gd` | 79 | 3Dプリミティブ表示 |
| `scripts/nodes/player_controller.gd` | 48 | 入力受付 |
| `scripts/nodes/hud.gd` | 36 | UI表示 |
| `scripts/autoload/game_manager.gd` | 36 | レベル進行管理（Autoload） |
| `tests/unit/test_cargo_board_move.gd` | 35 | 移動ロジックのGUTテスト |
| `tests/unit/test_cargo_board_push.gd` | 50 | 押し出しロジックのGUTテスト |
| `tests/unit/test_cargo_board_win_condition.gd` | 76 | クリア判定・全レベル可解性のGUTテスト |

---

## アーキテクチャメモ

- **ロジックとビューの分離**: `core/`（`CargoBoard`, `LevelData`）はNode/シーンツリーに一切依存しないため、`godot --headless -s addons/gut/gut_cmdln.gd -gdir=res://tests/unit -gexit` で描画なしにアサーション検証できる。ディスプレイの無い開発コンテナでも正しさを担保できるのはこの分離のおかげ。
- **表示層は薄く保つ**: `board_view_3d.gd` は `CargoBoard` の状態を読み取って `MeshInstance3D`/`BoxMesh` を再構築するだけで、ゲームルールを一切持たない。
- **全5レベルの可解性はPython製BFSソルバー（開発時のみ使用、リポジトリには含めない）で事前検証**し、検証済み手順を `test_cargo_board_win_condition.gd` の `LEVEL_SOLUTIONS` に埋め込んでGUTでも機械的に再検証している。
