# 📚 LESSONS_LEARNED.md

> このファイルはACEフレームワークのCurator役割により管理される。
> 開発中に発見したバグ、設計上の問題、回避策を蓄積し、AIエージェントの推論精度を向上させる。

---

## ⚠️ 更新ルール（Delta Updates 厳守）

- ✅ 新しい教訓は **末尾に追記** する
- ✅ 既存の教訓は **部分修正のみ** 許可
- ❌ このファイルを **全体的に書き直してはならない**
- ❌ 過去の教訓を **省略・要約してはならない**

---

## 教訓一覧

### [2026-08-27] [Zero-G Cargo] - パズルレベルは必ずソルバーで可解性を機械検証する
- **問題**: 手計算でSokoban風パズルのレベルレイアウトを設計したところ、Lv1・Lv3・Lv5が実は詰み（押す方向に必要なプレイヤー位置が壁で塞がれている等）になっており、クリア不可能だった。
- **原因**: 「押す側のマスが壁でないか」「押した先が壁でないか」を頭の中だけで検算すると見落としが起きやすい。
- **解決策**: PythonでBFSソルバー（`sokoban_solver.py`、開発時のみ使用しリポジトリには含めない）を書き、全レベルの可解性と最短手順を機械的に検証してからレベルデータを確定した。検証済み手順はGUTテスト（`test_cargo_board_win_condition.gd`）にも埋め込み、CIのように毎回再検証する。
- **教訓**: パズルゲームのレベルデザインは「ロジックを実装したらBFS/DFSで解けるか自動検証する」を標準工程にすること。目視確認に頼らない本プロジェクトの方針とも一致する。
- **関連ファイル**: `scripts/core/level_data.gd`, `tests/unit/test_cargo_board_win_condition.gd`

### [2026-08-27] [Zero-G Cargo] - Godot 4.3: サイズの異なる要素を持つconst Array[TypedArray]がクラッシュする
- **問題**: `const LEVEL_SOLUTIONS: Array[PackedStringArray] = [["DOWN"], ["RIGHT","RIGHT",...]]` のように要素ごとに長さの異なる配列をconstのタイプ付き配列に入れたところ、実行時に `Index p_index = 0 is out of bounds (size() = 0)` でエンジンごとクラッシュした。
- **原因**: Godot 4.3.stable のGDScriptにおける、ネストした型付き配列のconst評価（コンパイル時の配列変換）に関する既知の不具合と推測される。要素数1個の配列だけの状態では発生せず、長さの異なる2個目の要素を追加すると発生した。
- **解決策**: 該当の配列宣言を `const` から `var`（クラス直下でstatic的に使う場合は `static var`）に変更したところクラッシュが解消した。
- **教訓**: Godot 4.3で「要素の長さが不揃いなネスト型付き配列」を`const`で宣言するのは避け、`var`/`static var`を使う。挙動が怪しい場合はまず`const`を疑う。
- **関連ファイル**: `scripts/core/level_data.gd`, `tests/unit/test_cargo_board_win_condition.gd`, `.agent/skills/engine_rules/rules/godot_rules.md`

### [2026-08-27] [Zero-G Cargo] - ヘッドレス環境でも実は3Dスクリーンショットが撮れる
- **問題**: 開発コンテナにディスプレイが無く、3D表示の目視確認ができないという前提でGUTユニットテストのみに検証を頼る計画にしていた。
- **原因**: `--headless` 実行はダミーレンダラで描画自体を行わないが、コンテナにXvfb（仮想ディスプレイ）とMesa/llvmpipe（ソフトウェアOpenGL）が入っていることを見落としていた。
- **解決策**: `xvfb-run -a --server-args="-screen 0 1280x720x24" ./godot --path . --rendering-driver opengl3 --resolution 1280x720 --quit-after N` で実際にゲーム画面をソフトウェアレンダリングし、`get_viewport().get_texture().get_image().save_png(...)` でPNG保存できることを確認した。これを使い、小さいグリッドでの透視投影(Perspective)カメラの歪みに気づき、Orthogonal（平行投影）カメラへ修正できた。
- **教訓**: 「ディスプレイが無い=目視確認は絶対不可能」と決めつけず、Xvfb+ソフトウェアレンダラの利用可否を最初に確認する。可能なら最終的な軽い目視確認に積極的に使ってよい（ただし正しさの一次判定はGUTのアサーションに委ねる方針は変えない）。
- **関連ファイル**: `scripts/nodes/main.gd`（カメラ設定）, `.agent/skills/engine_rules/rules/godot_rules.md`

### [2026-08-27] [Zero-G Cargo] - 合成入力(InputEventAction)によるシーン統合テストが有効
- **問題**: GUTの`core/`ユニットテストだけでは、実際の`Main.tscn`実行時にキー入力→`PlayerController`→`CargoBoard`→`GameManager`のレベル進行までが正しく結線されているかまでは検証できない。
- **解決策**: `Input.parse_input_event()` で `InputEventAction`（`ui_up/down/left/right`）を合成入力し、ヘッドレスのまま `Main.tscn` を実際に実行して全5レベルを自動で解かせ、レベル番号が1→5まで正しく進行することを確認した（GUT自身の `input_sender.gd` と同じ手法）。
- **教訓**: Node/シーンツリーに依存する統合部分（入力〜表示〜進行）は、`core/`ロジックのユニットテストとは別に、合成入力による使い捨てスクリプトで一度は実機（ヘッドレス）検証するとよい。検証用スクリプトは`project.godot`の`[autoload]`に一時的に追加し、検証後は必ず削除・復元すること。
- **関連ファイル**: `scripts/nodes/player_controller.gd`, `scripts/autoload/game_manager.gd`

### [2026-08-27] [Zero-G Cargo] - カーゴ/プレイヤー移動をTween補間に変更（差分更新方式）
- **問題**: 初期実装では移動のたびに盤面全体のMeshInstance3Dを破棄・再生成しており、瞬間移動になっていた。
- **解決策**: `BoardView3D`を「レベル読込時に一度だけ構築する静的ジオメトリ(`load_level`)」と「プレイヤー・カーゴの位置差分だけをTweenで補間する`sync`」に分離した。カーゴはSokobanのルール上1手で最大1個しか動かないため、移動前後の位置集合の差分（消えた1マス・増えた1マス）だけを検出すれば、どのメッシュをどこへ動かすか一意に特定できる。
- **教訓**: 「1手で変化する要素が高々1個」という盤面ロジックの性質を利用すると、フル再構築ではなく軽量な差分更新+アニメーションに素直に置き換えられる。実機（Xvfb+スクリーンショット）でCLEAR表示・カーゴの緑色変化・手数表示まで正しいことを確認済み。
- **関連ファイル**: `scripts/nodes/board_view_3d.gd`, `scripts/nodes/player_controller.gd`

### [2026-08-27] [Zero-G Cargo] - 手描きアセット無しでも「見た目のブラッシュアップ」は可能
- **問題**: プリミティブ形状のみ・単色マテリアルのみという制約下で、見た目が単調（フラットな床、目立たない目標パッド、手応えの無い移動）になっていた。
- **解決策**: `sakurai_presentation`/`sakurai_game_feel`スキルの原則をそのままコードに落とし込んだ。(1) 床をチェッカー柄の2色に分けるだけで空間の広がりが分かりやすくなる、(2) `StandardMaterial3D.emission_enabled`+Tweenループで目標パッドをパルス発光させ判定を強調、(3) カーゴ移動時に一瞬スケールを潰す(スクイーズ)Tweenを追加し押した手応えを表現、(4) `WorldEnvironment`で背景色と環境光を暗めに設定しDirectionalLightの`shadow_enabled`をONにして陰影のコントラストを出す、(5) HUDに半透明`Panel`(StyleBoxFlatの角丸)を敷き、CLEAR表示に`TRANS_BACK`イージングのスケールポップを付けた。
- **教訓**: 「アセット制作不要」という制約は「見た目を作り込めない」という意味ではない。色・発光・スケールアニメーション・環境光といったコードだけで完結する要素の組み合わせでも、視認性と手応えは大きく改善できる。実装後は必ずXvfb+スクリーンショットで実際の色味・演出を目視確認すること（数値だけでは分からない）。
- **関連ファイル**: `scripts/nodes/board_view_3d.gd`, `scripts/nodes/main.gd`, `scripts/nodes/hud.gd`

---

### 🔄 引き継ぎ事項 (2026-08-27)
> Phase 1〜5に加え、見た目のブラッシュアップ（チェッカー床、目標パッドのパルス発光、カーゴのスクイーズ演出、環境光/影、HUDの半透明パネル＋CLEARポップ）も完了。GUTテスト10/10パス、ヘッドレス起動smoke test、合成入力による全5レベルの統合テスト、Xvfbスクリーンショットでの目視確認まで完了済み。残っている軽微な項目: 効果音（未実装、任意）、`Documents/walkthrough.md`は汎用の運用手順書でありZero-G Cargo固有の追記は不要と判断し見送った。次回は新機能追加やレベル追加の依頼があればそこから着手してよい。
