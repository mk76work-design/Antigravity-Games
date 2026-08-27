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

---

### 🔄 引き継ぎ事項 (2026-08-27)
> Phase 1〜4（プロジェクト基盤・コアロジック・3D表示・入力/UI/レベル進行）は実装済みで、GUTテスト10/10パス、ヘッドレス起動smoke test・Xvfbスクリーンショット確認も済み。次回はPhase 5残タスク（`GAME_REGISTRY.md`登録は完了済み、`walkthrough.md`への追記が未対応）と、余裕があればカーゴ/プレイヤー移動のTween補間（現状は瞬間再構築のみ）に着手するとよい。
