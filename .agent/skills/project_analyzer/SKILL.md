---
name: "Project Analyzer"
description: "プロジェクト構造を自動スキャンし、各ゲームプロジェクトの docs/ 内に PROJECT_STRUCTURE.md と REPO_MAP.md を自動生成・自動更新する。"
---

# Project Analyzer スキル

Aiderの「Repo Map」概念とスタンフォード大学ACEフレームワークの「Curator」役割に基づき、
**各ゲームプロジェクト内**の構造を自動的にスキャンし、以下のドキュメントを生成・更新する：

| ドキュメント | 配置先 | 目的 | 生成方法 |
|------------|--------|------|---------| 
| `PROJECT_STRUCTURE.md` | `<game>/docs/` | ディレクトリ構成と各ファイルの役割 | スクリプト自動生成 |
| `REPO_MAP.md` | `<game>/docs/` | 関数・クラスシグネチャの軽量マップ | スクリプト自動生成 |
| `LESSONS_LEARNED.md` | `<game>/docs/` | 開発中の教訓の蓄積 | エージェントが差分追記 |
| `GAME_REGISTRY.md` | ルート直下 | 全ゲームの一覧と概要 | スクリプト自動生成 |

---

## ドキュメント配置の設計思想

> ゲーム固有のドキュメントは、各ゲームプロジェクトの `docs/` ディレクトリに配置する。
> ルート直下には全ゲーム横断のドキュメント（`GAME_REGISTRY.md`）のみを配置する。

```
Antigravity-Games/
├── GAME_REGISTRY.md              ← 全ゲーム横断（ルートに配置）
│
├── WaterBalloonTetris/
│   ├── docs/                     ← ゲーム固有ドキュメント
│   │   ├── PROJECT_STRUCTURE.md
│   │   ├── REPO_MAP.md
│   │   └── LESSONS_LEARNED.md
│   ├── index.html
│   └── ...
│
└── AnotherGame/
    ├── docs/
    │   ├── PROJECT_STRUCTURE.md
    │   ├── REPO_MAP.md
    │   └── LESSONS_LEARNED.md
    └── ...
```

---

## 核心原則：Delta Updates（差分更新）

> **ドキュメントを全体的に書き直してはならない。常に差分追記（追加・削除・部分修正）のみを行う。**

全体書き直しは「簡潔さのバイアス（Brevity Bias）」を引き起こし、
過去に蓄積した重要な教訓やアーキテクチャの知見が失われる
「コンテキストの崩壊（Context Collapse）」の原因となる。

### 許可される操作
- ✅ 新しいセクションの**追加**
- ✅ 既存エントリの**部分修正**（該当箇所のみ）
- ✅ 不要になった情報の**削除**（該当箇所のみ）

### 禁止される操作
- ❌ ファイル全体を新しい内容で**上書き**
- ❌ 過去の教訓セクションの**省略・要約**

---

## 使用方法

### PROJECT_STRUCTURE.md の生成・更新（ゲームプロジェクト単位）

```powershell
# ゲームプロジェクトに対して実行（docs/ に出力される）
powershell -ExecutionPolicy Bypass -File .agent/skills/project_analyzer/scripts/analyze_project.ps1 -ProjectRoot "c:\Users\pusap\work\Antigravity-Games\WaterBalloonTetris"
```

### REPO_MAP.md の生成・更新（ゲームプロジェクト単位）

```powershell
powershell -ExecutionPolicy Bypass -File .agent/skills/project_analyzer/scripts/generate_repo_map.ps1 -ProjectRoot "c:\Users\pusap\work\Antigravity-Games\WaterBalloonTetris"
```

> **Repo Mapとは**: Aiderが提唱した概念。全コードを読み込む代わりに、
> 関数・クラスのシグネチャのみを抽出した軽量マップをLLMに送信する。
> LLMはこのマップを見て、どのファイルのどの関数を編集すべきかを判断し、
> 必要なファイルだけをオンデマンドで要求する。
> **コンテキスト消費を劇的に削減し、推論精度を向上させる。**

### GAME_REGISTRY.md の生成・更新（プロジェクトルート全体）

```powershell
powershell -ExecutionPolicy Bypass -File .agent/skills/project_analyzer/scripts/update_game_registry.ps1 -ProjectRoot "c:\Users\pusap\work\Antigravity-Games"
```

---

## エージェントへの指示

### 開発開始時（Planner役割 — Context Sync）
1. 対象ゲームの `docs/PROJECT_STRUCTURE.md` を読み込んでプロジェクト構造を理解する
2. 対象ゲームの `docs/REPO_MAP.md` を読み込んで関数・クラスの依存関係を把握する
3. 対象ゲームの `docs/LESSONS_LEARNED.md` を読み込んで過去の教訓を参照する
4. 存在しない場合は上記のスクリプトを実行して生成する

### 開発完了時（Curator役割 — State Persistence）

ACEフレームワークのCurator役割として、以下の3ステップを実行する：

```
1. 構造ファイルの再生成（スクリプト実行 — ゲームプロジェクトに対して）
   → docs/PROJECT_STRUCTURE.md, docs/REPO_MAP.md

2. 教訓の差分追記（手動 — Delta Updatesルール厳守）
   → docs/LESSONS_LEARNED.md に追記

3. 引き継ぎ事項の追記
   → docs/LESSONS_LEARNED.md の末尾に「未来のエージェントへの引き継ぎ」を追記

4. ゲームレジストリの更新（プロジェクトルートに対して）
   → GAME_REGISTRY.md
```

### LESSONS_LEARNED.md の初期テンプレート

新規ゲーム作成時、`docs/LESSONS_LEARNED.md` を以下の内容で初期化する：

```markdown
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

> 開発を進めるにつれ、ここに教訓が蓄積されていきます。
```

### LESSONS_LEARNED.md への追記フォーマット

```markdown
### [YYYY-MM-DD] [ゲーム名] - [教訓タイトル]
- **問題**: （発生した問題の具体的な説明）
- **原因**: （根本原因の分析）
- **解決策**: （採用した解決策）
- **教訓**: （今後のプロジェクトに活かすべき一般化された知見）
- **関連ファイル**: （該当するファイルパス）
```

### 引き継ぎ事項の追記フォーマット

```markdown
### 🔄 引き継ぎ事項 (YYYY-MM-DD)
> [次のセッションで最初に確認すべきこと、未解決の問題、注意点を1〜2行で記述]
```

---

## 自動更新のタイミング

| タイミング | 対象 | スクリプト実行先 |
|----------|------|----------------|
| 新規ゲーム作成後 | 全ファイル | ゲームプロジェクトディレクトリ |
| ファイル構成変更後 | `PROJECT_STRUCTURE.md` + `REPO_MAP.md` | ゲームプロジェクトディレクトリ |
| バグ修正・設計変更後 | `LESSONS_LEARNED.md` | 手動差分追記 |
| 大規模リファクタリング後 | 全ファイル | ゲームプロジェクトディレクトリ |

---

## オンデマンドロードの原則

エージェントが全ファイルをコンテキストにロードする必要はない。
以下の優先順位で必要なファイルのみをロードする：

1. **常にロード**: `docs/REPO_MAP.md`（軽量マップ、コンテキスト消費最小）
2. **タスク開始時にロード**: `docs/LESSONS_LEARNED.md`（過去の教訓）
3. **必要時のみロード**: `docs/PROJECT_STRUCTURE.md`（全体構造）
4. **コード編集時のみロード**: 対象の個別ソースファイル
