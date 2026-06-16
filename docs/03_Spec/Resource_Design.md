# Resource Design

## 目的

この文書は M3E における「Resource（資源）」概念の設計仕様を定義する。
Resource とは、プロジェクトの資源（時間・お金・人数・その他）を集中管理し、
ツリー構造内で整合性を保ちながら可視化・集計するための仕組みである。

---

## 0. 現行マップのリソース概念調査

設計に先立ち、`tmp_map.json` (196 ノード) を全走査し、
「資源」に相当する情報が含まれるノードを洗い出した。

### 0.1 既存 attributes の使用パターン

現行マップでは attributes に以下の 3 キーのみが使われている。

| attribute key | 使用数 | 用途 |
|---------------|--------|------|
| `status` | 57 ノード | タスクの進捗状態 (done, ready, planned, pooled, idea, etc.) |
| `priority` | 13 ノード | 優先度 (P1, P2, P3, P4) |
| `agent` | 37 ノード | 担当エージェント (claude, visual, data, manage, etc.) |

Resource 専用の attributes はまだ存在しない。

### 0.2 リソースに該当する概念の分類

マップ内に散在するリソース概念を以下のカテゴリに分類した。

#### A. 時間系リソース

| 概念 | 存在場所 | 現在の表現方法 |
|------|----------|----------------|
| フェーズ (Phase 1, Phase 2, Phase 3) | strategy 配下の各機能ノード | text に "Phase N" を含む |
| status の時間的進行 | strategy 全体 | attributes.status = done/ready/planned/idea |
| 期限・デッドライン | 明示的なノードなし | **未管理** |
| スプリント / イテレーション | 明示的なノードなし | **未管理** |

**観察**: フェーズは text に埋め込まれており、構造化されていない。期限の概念は完全に欠落している。

#### B. 金銭系リソース

| 概念 | 存在場所 | 現在の表現方法 |
|------|----------|----------------|
| Budget / Cost | strategy > Resource > "Budget / Cost" | テキストノードのみ (値なし) |
| API コスト (LLM) | AI Integration 配下 | 暗黙的 (usage.totalTokens はレスポンスに含まれるが永続化されない) |

**観察**: 予算概念はノード名として存在するが、数値データは一切保持されていない。

#### C. 人的リソース

| 概念 | 存在場所 | 現在の表現方法 |
|------|----------|----------------|
| チームメンバー | team > member 配下 | テキストノード (mac-Codex, mac-Claude-Pro) |
| エージェントロール | team > old 配下 | details/note に role 記述 (akaghef=manager, Claude=general dev, etc.) |
| 担当割り当て | strategy 全ノード | attributes.agent = "claude", "visual", "data" 等 |
| Headcount / Roles | strategy > Resource > "Headcount / Roles" | テキストノードのみ (値なし) |

**観察**: 担当割り当て (`agent` attribute) は最も構造化されたリソース情報。ただし稼働率・キャパシティの概念はない。

#### D. キャパシティ・優先度系

| 概念 | 存在場所 | 現在の表現方法 |
|------|----------|----------------|
| 優先度 (P1-P4) | strategy 配下 13 ノード | attributes.priority |
| Capacity Planning | strategy > Resource > "Capacity Planning" | テキストノードのみ (値なし) |
| ステータス分布 | strategy 全体 | done:13, ready:13, planned:9, idea:11, pooled:5, etc. |

**観察**: 優先度は attributes として構造化済み。キャパシティの数値管理は存在しない。

### 0.3 既存の strategy > Resource サブツリー

```
[strategy]
  +-- ...
  +-- Resource                    (n_res_1775645677276_1)
        +-- Time Management       (placeholder, 子ノードなし)
        +-- Budget / Cost         (placeholder, 子ノードなし)
        +-- Headcount / Roles     (placeholder, 子ノードなし)
        +-- Capacity Planning     (placeholder, 子ノードなし)
```

4 つの placeholder ノードが既に存在するが、いずれも空で数値データを持たない。
これは Resource 機能の「予約領域」としての骨格が既に用意されていることを意味する。

### 0.4 調査結論

1. **最も構造化されている**: agent (担当割り当て) と priority (優先度) --- attributes に値あり
2. **骨格のみ存在**: Resource サブツリーの 4 カテゴリ --- ノードはあるが数値データなし
3. **完全に欠落**: 期限、予算額、稼働率、キャパシティの数値管理
4. **暗黙的に存在**: フェーズ概念 (text に埋め込み)、API コスト (レスポンスに一時的に含まれる)

この調査結果に基づき、以下の設計では:
- 既存の `agent` / `priority` attributes は Resource システムとは独立して維持する
- Resource サブツリーの 4 カテゴリ (Time, Budget, Headcount, Capacity) を設計の出発点とする
- 現在欠落している数値管理 (期限、予算額、稼働率) を Resource エンティティで構造化する

---

## 1. 設計判断: attributes 埋め込み vs 独立エンティティ

### 結論: SSOT (Single Source of Truth) パターンを採用する

Resource は独立エンティティとして AppState に集中管理する。
各ノードは Resource の値を直接持たず、Resource エンティティへの ID 参照と
そのノード固有の配分量 (allocation) のみを保持する。

#### attributes 直接埋め込みを採用しない理由

1. **情報が散らばる** --- 同じ Resource の定義（名前・単位・上限）がノードごとに重複する
2. **定義変更時の不整合** --- 単位名や上限を変えたとき全ノードを走査・更新する必要がある
3. **型安全性がない** --- `Record<string, string>` では数値型・通貨型・時間型の区別ができない
4. **集計ロジックの根拠がない** --- どの attribute が rollup 対象かを構造的に判断できない

#### SSOT パターンの方針

- **Resource 定義はドキュメントに 1 箇所** --- `AppState.resources` に Resource エンティティ集合を持つ
- **ノードは参照のみ** --- `TreeNode.allocations` に `{ resourceId, amount }` のペアを持つ
- **定義の変更は 1 箇所で完結** --- 名前・単位・上限の変更が全ノードに即時反映される
- **ロールアップは導出値** --- 子孫の allocation 合計は読み込み時に計算し、永続化しない

---

## 2. データモデル案

### 2.1 基本型

```typescript
/** 資源の種類。将来追加可能な union 型 */
type ResourceType = "time" | "money" | "headcount" | "custom";

/** 通貨コード (ISO 4217 サブセット) */
type CurrencyCode = "JPY" | "USD" | "EUR";

/** 時間単位 */
type TimeUnit = "hours" | "days" | "weeks";
```

### 2.2 Resource (独立エンティティ --- SSOT の正本)

```typescript
interface Resource {
  /** 一意識別子 (例: "res_budget_001") */
  id: string;
  /** 表示名 (例: "開発予算", "工数") */
  label: string;
  /** 資源の種類 */
  type: ResourceType;
  /** 単位 (money の場合の通貨、time の場合の単位、headcount は "人" 固定) */
  unit: CurrencyCode | TimeUnit | "人" | string;
  /** 小数点以下の表示桁数 (既定: 0) */
  precision: number;
  /** ドキュメント全体の総上限。null は無制限 */
  totalCapacity: number | null;
  /** ロールアップ方式 */
  rollupMode: "sum" | "max" | "none";
  /** 分配ルール (リソース型ごとに固有のルールを持つ) */
  distributionRule: DistributionRule;
  /** 予約領域のルートノード ID (strategy マップ内の対応ノード) */
  reservedNodeId?: string;
}
```

### 2.3 DistributionRule (リソース型ごとの分配ルール)

各 Resource はその種類に応じた固有の分配ルールを持つ。
共通インターフェースを定義し、型ごとの固有ルールをプラグイン的に拡張できる設計とする。

```typescript
/** 分配ルールの共通インターフェース */
type DistributionRule =
  | TimeDistributionRule
  | MoneyDistributionRule
  | HeadcountDistributionRule
  | CustomDistributionRule;

/** 時間リソースの分配ルール */
interface TimeDistributionRule {
  kind: "time";
  /** 期限ベースの分配を有効にするか */
  deadlineEnabled: boolean;
  /** カレンダー連動 (将来拡張: 外部カレンダーとの連携) */
  calendarSync: "none" | "read-only" | "bidirectional";
  /** 基準日 (プロジェクト開始日。ISO 8601) */
  baseDate?: string;
  /** 期限日 (ISO 8601) */
  deadline?: string;
}

/** 金銭リソースの分配ルール */
interface MoneyDistributionRule {
  kind: "money";
  /** 消化率トラッキングを有効にするか */
  burnRateTracking: boolean;
  /** 予算配分方式 */
  allocationMode: "fixed" | "proportional";
  /** 予算期間 (ISO 8601 期間表記。例: "P3M" = 3ヶ月) */
  budgetPeriod?: string;
}

/** 人的リソースの分配ルール */
interface HeadcountDistributionRule {
  kind: "headcount";
  /** 稼働率トラッキングを有効にするか (100% = フルタイム) */
  utilizationTracking: boolean;
  /** ロール制約を有効にするか (将来: 特定ロールのみ割当可能) */
  roleConstraints: boolean;
  /** 許可するロール一覧 (roleConstraints = true の場合) */
  allowedRoles?: string[];
}

/** カスタムリソースの分配ルール (最小限の設定のみ) */
interface CustomDistributionRule {
  kind: "custom";
  /** 自由記述の分配メモ */
  description?: string;
}
```

**設計意図**: `kind` フィールドで discriminated union を構成し、
TypeScript の型ガードで安全に分岐できる。
新しいリソース型を追加するときは、新しい `*DistributionRule` インターフェースと
対応する `ResourceType` 値を追加するだけでよい。

**Beta MVP での実装範囲**: Beta では全ての DistributionRule を `kind` と最小限のフィールドで作成し、
高度な機能 (カレンダー連動、消化率トラッキング、稼働率トラッキング) は Post-Beta で実装する。
Beta での分配ルールは rollupMode と totalCapacity による基本的な集計・上限チェックのみ。

### 2.4 ResourceAllocation (ノードからの参照)

```typescript
interface ResourceAllocation {
  /** 参照先の Resource ID */
  resourceId: string;
  /** このノードに直接割り当てた量 */
  amount: number;
  /** このノード固有の上限 (null は Resource.totalCapacity に委譲) */
  capacity: number | null;
}
```

### 2.5 AppState への統合

```typescript
interface AppState {
  rootId: string;
  nodes: Record<string, TreeNode>;
  links?: Record<string, GraphLink>;
  /** Resource 定義の集合 (SSOT) */
  resources?: Record<string, Resource>;
}

interface TreeNode {
  // ... 既存フィールド ...
  attributes: Record<string, string>;
  /** この node の Resource 配分 (Resource ID 参照) */
  allocations?: ResourceAllocation[];
}
```

### 2.6 ロールアップ計算結果 (非永続化)

```typescript
interface ResourceRollup {
  resourceId: string;
  /** このノード自身の allocated amount */
  allocated: number;
  /** 子孫の allocation 合計 (自身を含まない) */
  childrenTotal: number;
  /** allocated + childrenTotal */
  total: number;
  /** このノードの capacity (ノード固有 or Resource.totalCapacity) */
  effectiveCapacity: number | null;
  /** total > effectiveCapacity */
  overAllocated: boolean;
}

/** ノードID -> Resource ごとの rollup マップ */
type RollupMap = Record<string, Record<string, ResourceRollup>>;
```

### 2.7 永続化方式

#### 方式 A: AppState 直接拡張 (推奨)

`AppState.resources` を optional フィールドとして追加する。
GraphLink (`links`) と同じパターンに従い、既存データとの後方互換性を維持する。

```json
{
  "rootId": "n_root",
  "nodes": {
    "n_root": {
      "id": "n_root",
      "text": "Project Alpha",
      "allocations": [],
      "..."
    },
    "n_backend": {
      "id": "n_backend",
      "text": "Backend",
      "allocations": [
        { "resourceId": "res_budget", "amount": 150000, "capacity": 200000 },
        { "resourceId": "res_hours", "amount": 60, "capacity": null }
      ],
      "..."
    }
  },
  "links": {},
  "resources": {
    "res_budget": {
      "id": "res_budget",
      "label": "開発予算",
      "type": "money",
      "unit": "JPY",
      "precision": 0,
      "totalCapacity": 500000,
      "rollupMode": "sum"
    },
    "res_hours": {
      "id": "res_hours",
      "label": "工数",
      "type": "time",
      "unit": "hours",
      "precision": 1,
      "totalCapacity": 200,
      "rollupMode": "sum"
    }
  }
}
```

#### 方式 B: attributes 経由の暫定実装

Beta MVP では AppState スキーマの変更を最小限にするため、
Resource データを attributes に JSON シリアライズして格納する暫定方式も選択肢とする。

```
root node:
  attributes["resource:__definitions"] = JSON.stringify(resources)

each node:
  attributes["resource:__allocations"] = JSON.stringify(allocations)
```

この場合でも、アプリケーション層では SSOT のデータモデル (Resource / ResourceAllocation) を使い、
attributes との変換は serialize/deserialize 層で吸収する。

#### 方式の選択基準

- **方式 A** は schema v2 移行と同時に実施する場合に自然
- **方式 B** は schema v1 を維持したまま最速で MVP を出す場合に有効
- どちらを選んでも、アプリケーション層の API は同一 (Resource / ResourceAllocation 型で操作)

---

## 3. 予約領域 (Reserved Subtree) としての Resource

### 3.1 概念

Resource は、マップ内の通常のノードツリーに「予約領域」としてサブツリーを持つ。
strategy マップの `Resource` 配下がこれに該当する。

この設計は M3E の「ホワイトボード」パターンに倣う。
M3E のマップは開発の共有思考空間として機能しており、
`dev M3E` (旧 `_wb`) フォルダ配下に `tasks`, `strategy`, `design` 等の
予約サブツリーが存在する。Resource もこのパターンの一つとして位置づける。

予約領域のノードは通常ノードと異なり、Resource に特化した自動処理が走る。
具体的には:
- **自動集計**: 子ノードの allocation 合計を親ノードに rollup する
- **分配チェック**: totalCapacity に対する消化量を自動計算する
- **上限アラート**: capacity 超過を自動検出して警告を出す
- **参照先への反映**: ノードの allocation 変更時に rollup を再計算する

### 3.2 ホワイトボードパターンとの整合

M3E マップの予約サブツリー構造:

```
Root
+-- (ユーザーの既存ツリー)
+-- dev M3E [folder]           <- 開発ホワイトボード
    +-- tasks [folder]         <- タスクボード
    +-- strategy [folder]      <- ロール・アサイン状態
    |   +-- ...
    |   +-- Resource [folder]  <- *** Resource 予約領域 ***
    |       +-- Time Management
    |       +-- Budget / Cost
    |       +-- Headcount / Roles
    |       +-- Capacity Planning
    +-- design [folder]        <- 設計判断
    +-- brainstorm [folder]    <- ブレスト
    +-- scratch [folder]       <- 一時メモ
```

Resource の読み書きは `tmp_map.json` の直接編集ではなく、
M3E の REST API (`GET/POST /api/docs/{docId}`) 経由で行う。
ホワイトボード agent と同様に、API 経由でマップ全体を取得し、
Resource サブツリーを操作してから保存する。

### 3.3 予約領域の識別方法

予約領域であることを識別するために、以下の2つの仕組みを併用する。

1. **Resource.reservedNodeId**: Resource エンティティが strategy マップ内の対応ノード ID を保持する
2. **attributes による識別**: 予約領域のルートノードに `resource:reserved = "true"` を設定する

```
strategy > Resource (resource:reserved = "true")
  +-- Time Management    (reservedNodeId for time resource)
  +-- Budget / Cost      (reservedNodeId for money resource)
  +-- Headcount / Roles  (reservedNodeId for headcount resource)
  +-- Capacity Planning  (summary view, 全 Resource の集約表示)
```

予約領域配下のノードは:
- 通常の text 編集・構造操作 (add, delete, reparent) が可能
- Resource に特化した自動処理が追加で走る
- viewer で特別な表示 (Resource バッジ、集計サマリ) が適用される

### 3.4 予約領域の振る舞い

| 操作 | 通常ノード | 予約領域ノード |
|------|-----------|---------------|
| テキスト編集 | 通常処理 | 通常処理 |
| ノード追加 | 通常処理 | 通常処理 + allocation 初期化 |
| ノード削除 | 通常処理 | 通常処理 + rollup 再計算 |
| reparent | 通常処理 | 通常処理 + rollup 再計算 |
| allocation 変更 | --- | rollup 再計算 + capacity チェック |
| 表示 | 通常表示 | 通常表示 + Resource バッジ |

### 3.5 リソース型ごとの固有処理

各リソース型は共通の Resource インターフェースに加え、
DistributionRule によって固有の処理をプラグイン的に持つ。

#### 時間リソース (type: "time")

- **分配方式**: 期限ベース --- baseDate から deadline までの期間を子ノードに分配
- **固有の集計**: 開始日・終了日の最早/最遅を親ノードに伝播 (将来: ガントチャート連動)
- **カレンダー連動**: 外部カレンダー (Google Calendar 等) との同期 (将来拡張)
- **Beta MVP**: rollupMode: "sum" による単純な時間合計のみ

#### 金銭リソース (type: "money")

- **分配方式**: 予算配分 --- totalCapacity を子ノードに固定額 or 比率で配分
- **固有の集計**: 消化率 (burnRate = 実績 / 予算) の自動計算
- **期間管理**: 月次・四半期ごとの予算消化トラッキング (将来拡張)
- **Beta MVP**: rollupMode: "sum" による単純な金額合計のみ

#### 人的リソース (type: "headcount")

- **分配方式**: アサインベース --- メンバーを子ノードに割り当て
- **固有の集計**: 稼働率 (utilization = 割当合計 / キャパシティ) の自動計算
- **ロール制約**: 特定のロール (engineer, designer 等) のみ割当可能にする制約 (将来拡張)
- **Beta MVP**: rollupMode: "sum" による単純な人数合計のみ

#### カスタムリソース (type: "custom")

- **分配方式**: ユーザー定義 --- rollupMode のみで制御
- **固有の集計**: なし (sum/max/none の基本集計のみ)
- **Beta MVP**: 基本集計のみ

---

## 4. 整合性ルール

### 4.1 SSOT 不変条件

1. **Resource 定義はドキュメントに 1 箇所のみ存在する** --- `resources` コレクション内に正本がある
2. **ノードは Resource ID で参照する** --- 同じ Resource の定義を複数ノードに分散させない
3. **存在しない Resource への参照は不正** --- `allocation.resourceId` は `resources` 内の有効な ID でなければならない
4. **Resource 削除時は参照も除去する** --- Resource を削除したら、全ノードの該当 allocation を除去する

### 4.2 親子間ロールアップ

ロールアップは読み取り時に算出する非永続化の計算値である。

**sum モード** (既定):
```
rollup(node, resId).childrenTotal =
  sum( child.allocation[resId].amount + rollup(child, resId).childrenTotal )
  for each child
```

**max モード**:
```
rollup(node, resId).childrenTotal =
  max( child.allocation[resId].amount + rollup(child, resId).childrenTotal )
  for each child
```

**none モード**:
```
rollup(node, resId).childrenTotal = 0
```

ロールアップの計算:
- ツリーの leaf から root へ向かってボトムアップで計算する
- `collapsed` 状態でも計算は常に全ノードに対して行う
- alias ノードはロールアップ対象外 (Beta)

### 4.3 上限チェック (Capacity Validation)

```
effectiveCapacity(node, resId) =
  node.allocation[resId].capacity ?? Resource[resId].totalCapacity

overAllocated(node, resId) =
  rollup(node, resId).total > effectiveCapacity(node, resId)
```

上限超過は **警告** であり、保存を拒否する **エラー** ではない。
既存の `validate()` には影響しない。
Resource 専用の検証関数を別途提供する。

```typescript
interface ResourceWarning {
  nodeId: string;
  resourceId: string;
  message: string;
  severity: "info" | "warning" | "error";
  total: number;
  effectiveCapacity: number;
}

function validateResources(state: AppState): ResourceWarning[];
```

### 4.4 参照整合性チェック

```typescript
function validateResourceRefs(state: AppState): string[] {
  // 全ノードの allocations が有効な Resource ID を参照しているか検証
  // 孤立した参照があればエラーメッセージを返す
}
```

この関数は `validate()` から呼び出すか、独立して呼び出すかを実装時に判断する。
Resource が optional フィールドである限り、`validate()` への統合は resource 存在時のみ発動するガード付きとする。

### 4.5 競合検出

Cloud Sync や Collab で同一ノードの allocation を同時編集した場合:
- allocation 値は last-write-wins (既存の node 保存と同じ扱い)
- Resource 定義の競合も last-write-wins
- 競合解決の特別ロジックは Beta では追加しない
- 将来の command ベース変更履歴で、Resource 変更を個別 command として追跡可能にする

### 4.6 reparent 時の挙動

- ノードが別の親に移動しても、そのノードの allocation は変わらない
- 移動元・移動先の親チェーンでロールアップが自動的に再計算される
- 永続データの更新は不要 (ロールアップは導出値)

### 4.7 delete 時の挙動

- ノード削除時、そのノードと子孫の allocation は消失する
- Resource 定義は削除されない (他ノードが参照している可能性がある)
- 親チェーンのロールアップは再計算で自動的に反映される

---

## 5. UI/UX 方針

### 5.1 ノード上の Resource 表示 (テキストベースワイヤーフレーム)

通常の node 表示に Resource バッジを追加する。
表示名・単位は SSOT の Resource 定義から取得する。

```
+--------------------------------------------+
| [Project Alpha]                             |
|                                             |
|  開発予算: 300,000 / 500,000 JPY [====--]  |
|  工数:     120 / 200 h           [===---]  |
|  チーム:   5 / 8 人              [===---]  |
+--------------------------------------------+
   |
   +-- [Backend]
   |   開発予算: 150,000 JPY  工数: 60h  チーム: 3人
   |
   +-- [Frontend]
       開発予算: 100,000 JPY  工数: 40h  チーム: 2人
       (!) 開発予算: 合計 150,000 > 上限 100,000
```

### 5.2 表示モード

| モード | 表示内容 | 用途 |
|--------|----------|------|
| **compact** | allocated のみ、1行サマリ | 通常編集時 |
| **detail** | allocated / capacity + バー + rollup | Resource 管理時 |
| **hidden** | Resource 非表示 | 思考整理に集中する時 |

表示モードは ViewState (非永続化) として管理する。

### 5.3 Resource 定義パネル (ドキュメントレベル)

```
+-- Resource Definitions --------------------+
|                                            |
|  Document: Project Alpha                   |
|                                            |
|  [1] 開発予算                              |
|      Type: money  Unit: JPY               |
|      Total Capacity: [ 500,000 ]          |
|      Rollup: sum                          |
|                                            |
|  [2] 工数                                  |
|      Type: time   Unit: hours             |
|      Total Capacity: [ 200 ]              |
|      Rollup: sum                          |
|                                            |
|  [+ Add Resource Definition]               |
+--------------------------------------------+
```

### 5.4 Resource 配分パネル (ノードレベル)

```
+-- Resource Allocation ---------------------+
|                                            |
|  Node: [Backend]                           |
|                                            |
|  開発予算 (JPY):                           |
|    Amount:   [  150,000  ]                 |
|    Capacity: [  200,000  ] (optional)      |
|    Rollup:   150,000 (自動計算)            |
|                                            |
|  工数 (hours):                             |
|    Amount:   [  60  ]                      |
|    Capacity: [  80  ] (optional)           |
|    Rollup:   60 (自動計算)                 |
|                                            |
|  [+ Assign Resource]  [Save]  [Cancel]     |
+--------------------------------------------+
```

### 5.5 超過アラート表示

- 超過ノードは赤色のバッジまたはアイコンで示す
- ツリー表示で親ノードに超過の伝播を表示する (親自身が超過していなくても、子に超過があればインジケータを出す)
- 超過ノード一覧をフィルタできるビューを将来提供する

### 5.6 操作フロー

1. `AppState.resources` から Resource 定義を読み込み
2. 各ノードの `allocations` を ResourceAllocation として取得
3. ボトムアップでロールアップを計算 -> RollupMap を生成
4. 表示モードに応じてレンダリング (Resource 定義の label/unit を参照)
5. 編集時は allocation の amount/capacity を更新
6. Resource 定義の変更は definitions パネルから行う (全ノードに即時反映)
7. 保存は通常の `POST /api/docs/{docId}` で行う

---

## 6. Strategy マップのサブノード構成最終案

Resource 管理のためのサブノード構成を以下に定める。
これは「strategy マップ」テンプレートとして、ユーザーが新規プロジェクトを作成する際の推奨構成である。

Resource 定義は `AppState.resources` に SSOT として存在し、
ノードツリーの中には allocation (参照 + 量) のみが置かれる。

```
AppState.resources:
  res_budget  = { label: "開発予算", type: "money", unit: "JPY", totalCapacity: 500000 }
  res_hours   = { label: "工数",     type: "time",  unit: "hours", totalCapacity: 200 }
  res_team    = { label: "チーム",   type: "headcount", unit: "人", totalCapacity: 8 }

[Project Root]
  |
  +-- [Goals]          ... 目標定義 (allocation なし)
  |     +-- Goal 1
  |     +-- Goal 2
  |
  +-- [Resources]      ... 説明用サブツリー (nodeType: folder)
  |     |               ... Resource 定義の一覧をユーザーが確認する場所
  |     |               ... 実データは AppState.resources に存在
  |     +-- [Budget Overview]
  |     +-- [Timeline Overview]
  |     +-- [Team Overview]
  |
  +-- [Workstreams]    ... 実作業の分解 (allocation を配分する場所)
  |     +-- [Backend]
  |     |     allocations: [
  |     |       { resourceId: "res_budget", amount: 150000, capacity: 200000 },
  |     |       { resourceId: "res_hours",  amount: 60,     capacity: null },
  |     |       { resourceId: "res_team",   amount: 3,      capacity: null }
  |     |     ]
  |     +-- [Frontend]
  |           allocations: [
  |             { resourceId: "res_budget", amount: 100000, capacity: null },
  |             { resourceId: "res_hours",  amount: 40,     capacity: null },
  |             { resourceId: "res_team",   amount: 2,      capacity: null }
  |           ]
  |
  +-- [Risks]          ... リスク管理 (allocation なし)
        +-- Risk 1
        +-- Risk 2
```

### 構成の設計原則

1. **Resource 定義は AppState.resources に集中** --- ノードツリーには定義を埋め込まない (SSOT)
2. **Resources フォルダは参照・説明用** --- ユーザーが Resource 一覧を概観する場所であり、データの正本ではない
3. **Workstreams は配分の場所** --- 各作業ノードに allocation (参照 + 量) を設定する
4. **ロールアップは Workstreams から上へ集計** --- Project Root で全体の使用状況が見える
5. **Goals と Risks は allocation を持たない** --- 将来的に GraphLink で関連付ける

### nodeType との関係

- Resources フォルダは `nodeType: "folder"` を推奨する (scope 分離のため)
- Workstreams 配下のノードは `nodeType: "text"` で allocation を持つ
- allocation は全ての実体ノード (text, image, folder) が持てる
- alias ノードは allocation を持たない (Beta)

---

## 7. MVP スコープと将来拡張の線引き

### 7.1 Beta MVP (最小機能)

| 機能 | 含む/含まない | 理由 |
|------|:---:|------|
| Resource / ResourceAllocation の型定義 | 含む | shared/types.ts への追加のみ |
| AppState.resources (SSOT コレクション) | 含む | links と同パターン、optional で後方互換 |
| TreeNode.allocations (ID 参照方式) | 含む | SSOT の核心部分 |
| ボトムアップ rollup 計算 | 含む | ツリー走査のみ、副作用なし |
| `validateResources()` 警告関数 | 含む | validate() とは分離、保存を拒否しない |
| 参照整合性チェック (孤立参照の検出) | 含む | SSOT パターンの基本保証 |
| compact モードの Resource バッジ表示 | 含む | viewer への最小追加 |
| Resource 定義パネル (基本) | 含む | SSOT 管理の入口 |
| Resource 配分パネル (基本) | 含む | allocation 編集の UI |
| REST API への Resource 専用エンドポイント | 含まない | 既存 docs API で AppState ごと操作 |
| detail モードのバー表示 | 含まない | compact で MVP は成立する |
| 超過ノードのフィルタビュー | 含まない | 警告表示で MVP は成立する |
| Resource テンプレート自動生成 | 含まない | 手動設定で MVP は成立する |

### 7.2 将来拡張 (Post-Beta)

| 機能 | フェーズ | 備考 |
|------|----------|------|
| REST API `GET /api/docs/{docId}/resources` | Resource 需要確認後 | 集計済みデータの専用エンドポイント |
| Gantt ビュー / カレンダービュー | Deep 帯域実装時 | Resource の時間軸可視化 |
| AI による Resource 最適化提案 | AI subagent 拡張時 | 超過検出 -> 再配分提案 |
| cross-document Resource 集約 | multi-doc 対応時 | 複数プロジェクトの横断集計 |
| Resource history (変更履歴) | command ベース実装後 | Resource 変更を個別 command として追跡 |
| Collab での Resource ロック | Collab v2 | 同一 Resource の同時編集制御 |
| Resource テンプレートライブラリ | UX 成熟後 | プロジェクト類型ごとの初期設定 |

---

## 8. 実装フェーズのタスク分割

### Phase 1: shared (型定義・コアロジック)

| # | タスク | 担当 | 成果物 |
|---|--------|------|--------|
| 1.1 | Resource, ResourceAllocation, ResourceRollup 型定義 | data | `beta/src/shared/types.ts` に追加 |
| 1.2 | Resource ID 生成関数 | data | `beta/src/shared/resource_utils.ts` 新規 |
| 1.3 | rollup 計算関数 (buildRollupMap) | data | `beta/src/shared/resource_utils.ts` |
| 1.4 | validateResources() 警告関数 | data | `beta/src/shared/resource_utils.ts` |
| 1.5 | validateResourceRefs() 参照整合性チェック | data | `beta/src/shared/resource_utils.ts` |
| 1.6 | (暫定) attributes <-> Resource serialize/deserialize | data | `beta/src/shared/resource_utils.ts` |
| 1.7 | unit test (rollup・警告・参照整合性) | data | `beta/tests/unit/resource_utils.test.ts` |

### Phase 2: data (モデル層統合)

| # | タスク | 担当 | 成果物 |
|---|--------|------|--------|
| 2.1 | AppState に resources optional フィールド追加 | data | `beta/src/shared/types.ts` |
| 2.2 | TreeNode に allocations optional フィールド追加 | data | `beta/src/shared/types.ts` |
| 2.3 | RapidMvpModel に Resource CRUD メソッド追加 | data | `beta/src/node/rapid_mvp.ts` |
| 2.4 | RapidMvpModel に allocation 操作メソッド追加 | data | `beta/src/node/rapid_mvp.ts` |
| 2.5 | validate() に参照整合性チェックを統合 (resource 存在時のみ) | data | `beta/src/node/rapid_mvp.ts` |
| 2.6 | Resource 操作の unit test | data | `beta/tests/unit/resource_model.test.ts` |
| 2.7 | REST API spec 更新 (Resource データ構造の文書化) | data | `docs/03_Spec/REST_API.md` |

### Phase 3: visual (UI 表示)

| # | タスク | 担当 | 成果物 |
|---|--------|------|--------|
| 3.1 | compact モードの Resource バッジ描画 | visual | `beta/src/browser/viewer.ts` |
| 3.2 | Resource 定義パネル UI | visual | `beta/src/browser/viewer.ts` |
| 3.3 | Resource 配分パネル UI | visual | `beta/src/browser/viewer.ts` |
| 3.4 | 超過ノードの警告アイコン表示 | visual | `beta/src/browser/viewer.ts` |
| 3.5 | Resource 表示モード切替 (compact/hidden) | visual | `beta/src/browser/viewer.ts` |
| 3.6 | visual regression test | visual | `beta/tests/visual/` |

### Phase 4: 統合テスト

| # | タスク | 担当 | 成果物 |
|---|--------|------|--------|
| 4.1 | E2E: Resource 定義 -> 配分 -> 保存 -> reload | data + visual | `beta/tests/` |
| 4.2 | Freeplane .mm import/export での Resource 往復テスト | data | `beta/tests/` |
| 4.3 | Cloud Sync での Resource 同期テスト | data | `beta/tests/` |
| 4.4 | Resource 削除時の参照整合性テスト | data | `beta/tests/` |

### 依存関係

```
Phase 1 (shared) --> Phase 2 (data) --> Phase 4 (統合テスト)
Phase 1 (shared) --> Phase 3 (visual) --> Phase 4 (統合テスト)
```

Phase 2 と Phase 3 は並行作業可能。

---

## 9. 既存コードへの影響分析

### 影響が小さい (optional フィールド追加のみ)

- `AppState` --- `resources?: Record<string, Resource>` を追加 (`links` と同パターン)
- `TreeNode` --- `allocations?: ResourceAllocation[]` を追加
- `SavedDoc` --- AppState 経由で自動的に含まれる (version 1 のまま)

### 影響なし (変更不要)

- `RapidMvpModel.validate()` --- Resource 存在時のみ参照整合性チェックを追加 (既存チェックに影響なし)
- `RapidMvpModel.saveToFile()` / `saveToSqlite()` --- JSON.stringify で自動的に永続化
- `RapidMvpModel.loadFromFile()` / `loadFromSqlite()` --- fromJSON で resource/allocations を読み込み
- `start_viewer.ts` の既存エンドポイント --- AppState ごと読み書きするため変更不要
- `cloud_sync.ts` --- AppState ごと同期するため変更不要
- `collab.ts` --- scope push は nodes 単位だが、resource 定義はドキュメントレベル

### 追加が必要

- `beta/src/shared/types.ts` --- Resource, ResourceAllocation, ResourceRollup 型定義
- `beta/src/shared/resource_utils.ts` --- rollup 計算・検証ロジック (新規ファイル)
- `beta/src/node/rapid_mvp.ts` --- Resource CRUD + allocation 操作メソッド
- `beta/src/browser/viewer.ts` --- Resource バッジ表示 (visual 担当)

### 後方互換性

- `resources` と `allocations` は optional フィールドのため、既存データはそのまま読み込める
- Resource 機能を使わないドキュメントには一切の影響がない
- `_normalizeNode()` で `allocations` の正規化を追加する (undefined -> 空配列への変換等)

### Freeplane .mm との関係

- `.mm` フォーマットには Resource の直接的な対応概念がない
- import 時: Resource データは生成されない (allocations も空)
- export 時: Resource 定義と allocations は attributes として `.mm` に書き出す可能性がある (将来検討)
- import/export の往復で Resource データが失われることは許容する (M3E 固有機能のため)

---

## 10. 設計上の決定事項と保留事項

### 決定事項

1. SSOT パターンを採用 --- Resource 定義はドキュメントに 1 箇所
2. ノードは ID 参照 --- 値の埋め込みではなく resourceId で参照
3. ロールアップは導出値 --- 永続化しない
4. 上限超過は警告 --- 保存を拒否しない
5. AppState への optional フィールド追加 --- links と同パターン

### 保留事項 (manager 判断待ち)

1. **永続化方式の最終選択** --- 方式 A (AppState 直接) と方式 B (attributes 経由) のどちらで MVP を出すか
2. **schema version** --- resources 追加で version を 2 に上げるか、1 のまま optional で進めるか
3. **Collab での Resource 定義の排他制御** --- scope lock とは別に document-level lock が必要か
4. **MCP ツールへの Resource 操作追加** --- AI から Resource を操作させるか

---

## 関連文書

- データモデル: [./Data_Model.md](./Data_Model.md)
- State 分離と Schema v2: [./Model_State_And_Schema_V2.md](./Model_State_And_Schema_V2.md)
- REST API: [./REST_API.md](./REST_API.md)
- Band Spec: [./Band_Spec.md](./Band_Spec.md)
- Scope and Alias: [./Scope_and_Alias.md](./Scope_and_Alias.md)
- Cloud Sync: [./Cloud_Sync.md](./Cloud_Sync.md)
- ホワイトボード仕様: `.claude/skills/devM3E/agents/whiteboard.md`
- devM3E スキル: `.claude/skills/devM3E/SKILL.md` (Whiteboard セクション)

---

## 変更履歴

- 2026-04-08: 初版作成 (data agent)
- 2026-04-08: SSOT パターンに全面改訂 --- attributes 埋め込み方式から独立エンティティ + ID 参照方式へ変更 (data agent, manager 指示による)
- 2026-04-08: マップ調査結果 (Section 0)、予約領域設計 (Section 3)、DistributionRule (Section 2.3) を追加 (data agent, manager 指示による)
