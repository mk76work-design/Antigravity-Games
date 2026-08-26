# 🎮 ゲーム設計計画書 — Zero-G Cargo

> `game_dev_workflow` スキルの Step 2（設計計画書出力）に基づき作成。
> レビュー・承認後にのみ実装を開始する（Vibe Coding禁止）。

---

## 1. ゲームコンセプト

| 項目 | 内容 |
|------|------|
| ゲームタイトル | Zero-G Cargo（ゼログラビティ・カーゴ） |
| ジャンル | 3Dパズル（倉庫番/Sokoban系） |
| 概要 | 無重力の宇宙貨物ステーションで、ロボットが浮遊するカーゴ（荷物）を押して、すべて目標パッドに固定するパズルゲーム。 |
| ターゲットプラットフォーム | デスクトップ（Godotエクスポート、将来的にWeb/HTML5エクスポートも視野） |
| 操作方法 | キーボード（矢印キー / WASD）でグリッド1マス単位の移動・押し出し |

### なぜこのジャンル・技術構成か
- **3D + アート制作不要**: 見た目はGodot標準のプリミティブ（`CSGBox3D`など）と単色`StandardMaterial3D`のみで構成し、テクスチャ・3Dモデル・ドット絵などの手作業アセット制作を一切必要としない。
- **目視確認への依存を最小化**: ゲームルールは「グリッド配列 + 座標」のみで完結する決定論的ロジックであるため、盤面状態を`core/`の純粋ロジッククラスに切り出し、GUT（Godot Unit Test）でヘッドレス実行のままアサーション検証できる。開発コンテナにディスプレイが無い制約と相性が良い。

---

## 2. ゲーム仕様

### コアメカニクス
- ステージは `N x M` のグリッドで構成される（壁・床・カーゴ・目標パッド・プレイヤーの5種のセル状態）
- プレイヤーは上下左右いずれか1マスに移動する
- 移動先にカーゴがあり、その先（同方向のもう1マス）が空床または目標パッドであれば、カーゴを1マス押し出しながらプレイヤーも移動する
- 移動先またはカーゴの押し出し先が壁、または盤面外の場合は移動不可（状態は変化しない）
- カーゴが目標パッドの上に乗ると「固定」状態になる（色が変化する）

### 勝利条件 / クリア条件
- 全てのカーゴが対応する目標パッドの上に乗った時点でそのレベルはクリア
- クリア後、次レベルへ自動遷移（最終レベルクリアでエンディング表示）

### 難易度設計
- 5ステージ構成（最小実装スコープ）。ステージが進むごとにグリッドサイズとカーゴ数を段階的に増加させる
  - Lv1: 4x4, カーゴ1個（操作練習）
  - Lv2: 5x5, カーゴ2個
  - Lv3: 6x6, カーゴ2個 + 通路が限定された壁配置
  - Lv4: 6x6, カーゴ3個
  - Lv5: 7x7, カーゴ3個（デッドロックになりうる配置を含む上級構成）
- レベルデータはコード内の文字列配列（ASCII風レイアウト）として `core/level_data.gd` に定義する

---

## 3. 技術設計

### 技術スタック
| 要素 | 技術 |
|------|------|
| エンジン | Godot 4.3 |
| 言語 | GDScript 2.0（型付き） |
| レンダリング | 標準3Dレンダラ + `CSGBox3D`/`BoxMesh` + `StandardMaterial3D`（単色、テクスチャなし） |
| 物理エンジン | なし（グリッド座標によるロジック管理。見た目の滑らかな移動のみ`Tween`で補間） |
| テスト | GUT (Godot Unit Test) — ヘッドレス実行 |
| オーディオ | 任意（Phase 5でGodot標準の`AudioStreamPlayer` + 効果音のみ。BGMは対象外） |

### ファイル構成
```
ZeroGCargo/
├── project.godot
├── scenes/
│   ├── Main.tscn              # エントリシーン（レベル読込・シーン遷移）
│   ├── BoardView3D.tscn       # 3D盤面表示（Camera3D固定視点 + DirectionalLight3D）
│   └── ui/
│       └── HUD.tscn           # レベル番号・手数・クリア表示
├── scripts/
│   ├── core/                  # Nodeに依存しない純粋ロジック（GUT対象）
│   │   ├── cargo_board.gd     # グリッド状態・移動/押し出し/クリア判定
│   │   └── level_data.gd      # レベルレイアウト定義（定数配列）
│   ├── nodes/                 # シーンツリーに紐づく制御スクリプト
│   │   ├── board_view_3d.gd   # CargoBoardの状態からプリミティブを生成・更新
│   │   ├── player_controller.gd # 入力受付 → CargoBoard.move() 呼び出し
│   │   └── hud.gd
│   └── autoload/
│       └── game_manager.gd    # 現在レベル番号・レベル一覧・シーン遷移のみを担当
├── tests/
│   └── unit/
│       ├── test_cargo_board_move.gd
│       ├── test_cargo_board_push.gd
│       └── test_cargo_board_win_condition.gd
├── addons/
│   └── gut/                   # GitHub (bitwes/Gut) から導入
└── docs/
    ├── implementation_plan.md（本ファイル）
    ├── PROJECT_STRUCTURE.md    （Phase 5で自動生成）
    ├── REPO_MAP.md             （Phase 5で自動生成）
    └── LESSONS_LEARNED.md      （Phase 5で作成、以後差分追記）
```

### 主要クラス / モジュール
| クラス名 | 種別 | 責務 |
|----------|------|------|
| `CargoBoard` | `RefCounted` (core) | グリッド状態の保持、移動・押し出し・壁判定・クリア判定。Node非依存でGUT直接テスト可能 |
| `LevelData` | 静的データ | 5ステージ分のASCIIレイアウト定義 |
| `BoardView3D` | `Node3D` | `CargoBoard`の状態を購読し、プリミティブメッシュを生成・Tween移動 |
| `PlayerController` | `Node` | キー入力を方向ベクトルに変換し`CargoBoard.move()`を呼ぶ、結果をシグナルで通知 |
| `HUD` | `CanvasLayer` | レベル番号・手数・クリアパネル表示 |
| `GameManager`（Autoload） | `Node` (singleton) | 現在のレベルインデックス管理、レベル間のシーン遷移のみ |

### 座標・カメラ仕様
- 盤面は `Vector2i(x, y)` のグリッド座標を `Vector3(x, 0, y)` にマッピングして3D配置する（Y軸は常に0固定、上下移動なし）
- カメラは斜め見下ろし固定角度（例: 位置 `(grid_center.x, 8, grid_center.z + 6)`、`look_at(grid_center, Vector3.UP)`）とし、ユーザーによる視点操作は行わない
- 入力方向（↑↓←→）とグリッド軸（x, y）の対応をコード内コメントとdocsに明記し、直感との齟齬を防ぐ

---

## 4. 実装手順

### Phase 1: 基盤構築
- [ ] Godotプロジェクト作成（`project.godot`、`--headless`起動確認）
- [ ] GUTアドオンの導入（GitHubから取得し`addons/gut/`に配置、ヘッドレスでの空実行確認）
- [ ] `Main.tscn` / `BoardView3D.tscn` の雛形作成（固定カメラ・ライトのみ、床グリッドなし）

### Phase 2: コアロジック（テスト駆動）
- [ ] `core/level_data.gd` にLv1のASCIIレイアウトを定義
- [ ] `core/cargo_board.gd` 実装: 初期化・移動・押し出し・壁判定・クリア判定
- [ ] `tests/unit/test_cargo_board_move.gd` ほか: 移動/押し出し/クリア判定のGUTテストを実装しつつロジックを検証
- [ ] `godot --headless -s addons/gut/gut_cmdln.gd -gdir=res://tests/unit -gexit` が全件パスすることを確認

### Phase 3: 3D表示
- [ ] `nodes/board_view_3d.gd`: `CargoBoard`の状態から壁・床・カーゴ・目標パッド・プレイヤーをプリミティブとして生成
- [ ] カーゴ・プレイヤーの移動を`Tween`で補間（瞬間移動ではなく滑らかに）
- [ ] カーゴが目標パッドに乗った際のマテリアル色変化（例: オレンジ→緑）

### Phase 4: 入力・UI・レベル進行
- [ ] `nodes/player_controller.gd`: 入力アクション定義（`ui_up/down/left/right`等）→`CargoBoard.move()`
- [ ] `autoload/game_manager.gd`: レベル一覧・現在インデックス管理、クリア時に次レベルへ遷移
- [ ] `nodes/hud.gd`: レベル番号・手数カウンタ・クリアパネル表示

### Phase 5: レベルデザイン・QA・ドキュメント更新
- [ ] Lv2〜Lv5のレイアウトを`level_data.gd`に追加し、各レベルのクリア可能性をGUTテスト（解の手順を1系列アサート）で検証
- [ ] 全GUTテストスイートの最終実行・パス確認（正しさの一次判定）
- [ ] （ベストエフォート）`xvfb-run` + ソフトウェアレンダラでの起動を試行し、可能であれば最終スクリーンショットを1枚取得して簡易目視確認。失敗した場合はその旨を明記し、GUTのテスト結果を根拠として完了とする
- [ ] `project_analyzer`スキルのスクリプトが対応していない場合は手動で `docs/PROJECT_STRUCTURE.md` / `docs/REPO_MAP.md` / `docs/LESSONS_LEARNED.md` を作成
- [ ] ルートの `GAME_REGISTRY.md` にZero-G Cargoを登録
- [ ] `walkthrough.md`（該当する場合）に実装内容を追記

---

## 5. リスクと対策

| リスク | 対策 |
|--------|------|
| コンテナ環境にGPU/ディスプレイが無く3D描画を目視確認できない | 正しさの一次判定をGUTのヘッドレスユニットテストに置き、`core/`ロジックを100%カバーする。表示層(`board_view_3d.gd`)はプリミティブ生成のみに責務を絞り複雑さを抑える |
| GUTアドオンの導入がネットワーク越し（GitHub）になる | 事前にgithub.comへの到達性を確認済み。取得できない場合はGodot標準の`assert()`＋独自の最小テストランナーで代替する |
| 3Dカメラ・座標系の勘違いで操作感が直感と逆になる | 入力方向とグリッド軸の対応を本ドキュメントとコードコメントの両方に明記し、Phase 2のテストで移動方向自体もアサーションで固定する |
| レベルデザインが手詰まり（デッドロック）状態を含んでしまう | 各レベルについて「クリアまでの操作列」をGUTテストとして用意し、実際にその手順でクリアできることを機械的に保証する |
