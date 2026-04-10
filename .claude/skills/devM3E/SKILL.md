---
name: devM3E
description: |
  M3E開発プロジェクトのオーケストレーター。エージェントとユーザー(akaghef)が協働して実装・検証・統合を回すための仕組み。
  以下の場面でトリガーする:
  - M3Eの開発タスクに着手するとき（実装、バグ修正、仕様策定、リファクタ）
  - 「devM3E」「開発」「実装して」「次のタスク」「今日の作業」と言われたとき
  - beta/ や dev-docs/ 配下のファイルを変更する作業全般
  - タスク振り分け、PR作成、ブランチ統合、daily更新を伴う作業
  - M3Eに関する設計判断や仕様議論を始めるとき
  既存のm3e-mapスキルやm3e-shortcutsスキルと組み合わせて使うメタスキル。
---

# devM3E — M3E Development Orchestrator

M3Eプロジェクトの開発サイクルを回すオーケストレーションスキル。
skill-creatorの「intent capture → draft → test → eval → iterate」ループをソフトウェア開発に適用する。

## Core Loop

```
1. Assess   — 現在地の把握（status, todo pool, daily, blocked items）
2. Plan     — タスク選定と分解（smallest deliverable first）
3. Execute  — 実装（サブエージェント分業 or インライン）
4. Verify   — 検証（テスト、ビルド、手動確認）
5. Integrate — 統合と記録（commit, daily更新, status更新）
6. Review   — ユーザーレビュー → フィードバック → 次サイクルへ
```

---

## Phase 1: Assess（現在地の把握）

セッション開始時、まず以下を読む:

| ファイル | 目的 |
|---------|------|
| `dev-docs/00_Home/Current_Status.md` | 現在のスナップショット |
| `dev-docs/06_Operations/Todo_Pool.md` | 未着手タスクプール |
| `dev-docs/daily/` 直近3日分 | 最近の作業経緯 |
| `dev-docs/tasks/todo_by_role.md` | ロール別タスク一覧 |

**出力**: 現在地サマリーを3行以内でユーザーに提示。blockedやriskがあれば先に伝える。

---

## Phase 2: Plan（タスク選定と分解）

### タスク選定基準
1. blocked解消が最優先
2. 次にTodo Poolのstate=`ready`かつ優先度の高いもの
3. ユーザーが指定したタスク

### タスク分解
タスクをTodoWriteで管理する。各タスクは:
- 1つの検証可能な成果物を生む
- 30分以内で完了見込み
- 依存関係を明示

### ロール判定
タスクの性質に応じてロールを判定する。ただし厳密な境界は設けない:

| ロール | 担当領域 | ブランチ |
|-------|---------|---------|
| visual | UI・レンダリング・CSS・SVG | dev-visual |
| data | model・controller・API・永続化 | dev-data |
| 統合 | 仕様策定・マージ・CI・文書管理 | dev-beta |

Coworkセッションでは統合ロールとして振る舞い、必要に応じてvisual/dataのサブタスクをサブエージェントに委任する。

---

## Phase 3: Execute（実装）

### サブエージェント分業パターン

skill-creatorのgrader/comparator/analyzerに倣い、以下のサブエージェントを定義する。
各エージェントの詳細は `agents/` 配下を参照。

| エージェント | 用途 | 詳細 |
|-------------|------|------|
| implementer | コード実装 | `agents/implementer.md` |
| verifier | テスト・ビルド・回帰チェック | `agents/verifier.md` |
| doc-updater | daily更新・Decision Pool追記 | `agents/doc-updater.md` |
| reviewer | 差分レビュー・spec整合チェック | `agents/reviewer.md` |

### 並列実行ルール
- 独立したタスクはサブエージェントを並列起動する
- 依存があるタスクは直列で、前段の完了を待つ
- サブエージェント起動時はワークツリー分離（`isolation: "worktree"`）を推奨

### インライン実行
軽微な変更（1ファイル20行以内）はサブエージェントを使わずインラインで実行する。

### 実装時の制約
- `beta/` が開発対象。`final/` は触らない
- **`mvp/` は完全凍結 — 読まない、書かない、参照しない。完全に無視すること**
- コミットメッセージは imperative形式
- dev-docs配下の設計文書は日本語で記述する（Documentation_Rules準拠）

---

## Phase 4: Verify（検証）

### 検証ステップ（verifierエージェント or インライン）

```bash
# 1. TypeScript コンパイル
cd beta && npx tsc --noEmit

# 2. テスト実行
npx vitest run

# 3. ビルド確認
npm run build

# 4. Playwright E2E（該当する場合）
npx playwright test
```

### 検証結果の扱い
- 全パス → Phase 5へ
- 失敗あり → 原因分析 → Execute に戻る（TodoWriteでタスク追加）
- flaky → 再実行して確認。2回以上失敗なら修正対象

### ベンチマーク（オプション）
パフォーマンスに影響するタスクでは、変更前後の比較を行う:
- ビルドサイズ差分
- レンダリング時間
- テストカバレッジ変動

結果は `devM3E-workspace/benchmarks/` に保存し、`scripts/aggregate_results.py`で集計する。

---

## Phase 5: Integrate（統合と記録）

### 更新完了の定義（Documentation_Rules準拠）

以下4条件を**すべて**満たして初めて「完了」:

1. **コミット済み** — 変更がgit commitされている
2. **日記追記済み** — M3E ドキュメント `daily-YYMMDD` に作業ログを追記（+ md バックアップ）
3. **マップタスク更新済み** — `dev M3E/tasks` の doing/ready/done-today を REST API で更新
4. **status更新済み** — `Current_Status.md` を必要に応じて更新（統合ロールのみ）

### 記録の二層構造

| 永続ログ（作業日記） | M3E ドキュメント `daily-YYMMDD` | 追記のみ、改変しない |
| 揮発タスク | マップ `dev M3E/tasks` のノード | doing/ready/blocked を自由に書き換え |
| バックログ | `Todo_Pool.md` | pooled/blocked のみ。doing/ready はマップで管理 |

### doc-updaterエージェントの責務

| 対象 | 書く内容 |
|------|---------|
| `daily/YYMMDD.md` | 今日の作業内容・成果・決定事項 |
| `Decision_Pool.md` | 設計判断が出た場合 |
| `Todo_Pool.md` | 新規発見タスクのプール |
| `Current_Status.md` | スナップショット更新（統合ロール時のみ） |

### PRマージ後の必須手順

PRが dev-beta にマージされたら、以下を**必ず**実行する:

```bash
cd beta && npm run build   # dist を最新ソースで再ビルド
```

beta サーバーが起動中なら再起動も必要:
```bash
# サーバー再起動（ポート4173）
taskkill /PID <beta_pid> /F
cd beta && M3E_PORT=4173 node dist/node/start_viewer.js
```

**Why:** dist が古いままだとマージした変更がブラウザに反映されない。04-10 にこれが原因でデータ不整合が発生した。

### ブランチ統合フロー
1. 担当ブランチへpush
2. `/pr-beta` skill でPR作成（差分分析・タイトル生成・daily確認を自動化）
3. `/pr-review` skill でレビュー・マージ・事後処理（spec整合・検証・status更新・rebase指示）
4. マージ後、担当ブランチをrebase

---

## Auto Map Sync（ワーカー進捗のマップ自動反映）

**ワーカーの状態が変化するたびに、マップの以下3箇所を更新する。**
これは devM3E オーケストレーターの常時義務であり、省略不可。

### トリガー条件（強制 — 省略不可）

以下のイベント発生時、**必ず** `/map-update` を実行する。ユーザーに言われる前にやること:

- ワーカー（サブエージェント）の完了通知を受け取った時 → Agent Status + Strategy 進捗
- ワーカーに新タスクをアサインした時 → Agent Status (working)
- PR がマージされた時 → Now の完了タスク削除 + Strategy 進捗ノート
- 設計判断が確定した時 → 該当ノードに記録
- ワーカーの状態が変わった時（idle→working, working→done 等）

### 更新対象

| 対象 | マップ上の場所 | 更新内容 |
|------|--------------|---------|
| **Agent Status** | `DEV > Agent Status` | 各ロールの現在タスク・状態(working/idle/done) |
| **Strategy** | `DEV > strategy > {カテゴリ}` | タスクの進捗ノート追加、完了タスク削除 |
| **Today's Goal** | `DEV > strategy > 04-XX Today's Goal` | 各目標の達成状況を反映 |

### 更新手法
`/map-update` スキルを呼び出すか、直接 `tmp/map_update.mjs` スクリプトを生成・実行する。

### Vision ツリー
`DEV > Vision` にプロダクトビジョン（Flash/Rapid/Deep）を保持。
大きな設計判断やロードマップ変更があった場合のみ更新する。

---

## Phase 6: Review（ユーザーレビュー）

### フィードバック収集
skill-creatorのeval viewerパターンに倣い、作業結果をユーザーに提示する:

1. **差分サマリー** — 変更ファイル一覧と概要（`git diff --stat`）
2. **検証結果** — テスト/ビルドのpass/fail
3. **判断ポイント** — 設計上の選択とその理由
4. **次のアクション候補** — Todo Poolから次に取り組むべきタスク2-3件

### ユーザーの応答パターン
- **LGTM / 空フィードバック** → 次のタスクへ進む
- **修正指示** → Execute に戻る
- **方針変更** → Decision Pool に記録してPlan に戻る
- **完了宣言** → セッション終了手順へ

---

## Progressive Disclosure（3層ローディング）

skill-creatorに倣い、情報を3層に分ける:

| 層 | 内容 | 読むタイミング |
|----|------|--------------|
| L1: SKILL.md | このファイル。ループ全体の流れ | skill トリガー時（常に） |
| L2: agents/ | 各サブエージェントの詳細指示 | サブエージェント起動時 |
| L3: references/ | M3Eのアーキテクチャ・spec・運用ルール索引 | 特定の判断が必要な時 |

---

## Whiteboard（マップ共有ホワイトボード）

M3Eマップを開発の共有思考空間として使う。m3e-map skill の REST API 経由で読み書きする。

### 使い方

マップのルート直下に `_wb` folder を作り、その配下で作業する:

```
_wb [folder]
├── tasks [folder]     ← Todo Pool と同期するタスクボード
│   ├── doing / ready / done
├── design [folder]    ← 設計議論の構造化
├── brainstorm [folder]← アイデア発散→収束
└── scratch [folder]   ← 一時メモ
```

### Core Loop との統合

| フェーズ | ホワイトボードの役割 |
|---------|-------------------|
| Assess | `_wb/tasks` を読んで進捗可視化 |
| Plan | タスク選定時に `_wb/tasks` のstatus確認、新タスクを `ready` に追加 |
| Execute | 実装中の設計メモを `_wb/design` に書く |
| Verify | 検証結果のサマリーを `_wb/scratch` に一時記録 |
| Integrate | タスクを `done` に移動、Todo Pool と sync |
| Review | `_wb/design` の議論ツリーをユーザーに見せる |

### トリガー

- セッション開始時: `_wb` が無ければ whiteboard agent が init を実行
- タスク完了時: whiteboard agent が `tasks/doing → tasks/done` のノード移動を実行
- 設計議論時: ユーザーが「マップに書いて」「マップ見せて」と言った時
- ブレスト時: ユーザーが「アイデア出し」「発散して」と言った時

詳細は `agents/whiteboard.md` を参照。

---

## Reference Files

| ファイル | 読むタイミング |
|---------|-------------|
| `references/architecture_index.md` | アーキテクチャ判断が必要な時 |
| `references/spec_index.md` | 仕様確認が必要な時 |
| `references/operations_quickref.md` | 運用ルールの確認が必要な時 |
| `agents/implementer.md` | コード実装をサブエージェントに委任する時 |
| `agents/verifier.md` | テスト・ビルド検証をサブエージェントに委任する時 |
| `agents/doc-updater.md` | ドキュメント更新をサブエージェントに委任する時 |
| `agents/reviewer.md` | 差分レビューをサブエージェントに委任する時 |
| `agents/whiteboard.md` | マップをホワイトボードとして読み書きする時 |

---

## セッション開始手順

1. Assess phase を実行して現在地を把握
2. ユーザーに現状サマリーと推奨タスクを提示
3. ユーザーの指示 or 合意を得てPlan → Execute → Verify → Integrate → Review

### セッション終了手順

1. 未コミットの変更がないか確認
2. daily note の最終更新
3. Todo Pool に残タスクを追記
4. Current_Status の更新（統合ロール時）

---

## Cowork固有の注意

- サブエージェントは利用可能。並列起動を活用する
- ブラウザ/ディスプレイは不可。検証結果はテキストで報告する
- ファイル出力は `/sessions/.../mnt/M3E/` 配下に直接書く
- m3e-map skillと併用してREST API経由のノード操作も可能
- `--static` オプションでHTML出力が必要な場合はcomputer://リンクで提供

## Claude Code / Copilot環境での使い方

このスキルの知識はCLAUDE.mdやAGENTS.mdにも反映されている。
Claude CodeやCopilot環境では:
- セッション開始ゲート（`/setrole`）を実行してロールを確定
- worktree分離でvisual/dataを並列作業
- PRベースの統合フローを厳密に守る
