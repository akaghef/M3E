# M3E Data Structure Pure Brief

このノートは会話ログから抽出した設計判断の高純度版。正式仕様ではなく、次に `docs/03_Spec/` へ昇格させるための種。

## 結論

M3E のデータ構造は、保存形式・LLM通信形式・表示形式を分離するのが筋がよい。

- 正本: 内部モデル / JSON document model / SQLite persistence layer
- LLM入力: TOON風の圧縮 Context DTO
- LLM出力: Command Patch DTO
- 表示: Mermaid / Hash / Line / Indented text は表示面であり、正本ではない
- 検証: 変更は必ず `Model.apply(command)` 相当の入口で Validate / Repair を通す

TOONを正本にする設計は危険。TOONはLLM context用の projection であり、正本との差分反映は Command Patch を介すべき。

## 境界

### SSOT境界

保存・検証・Undo/Redo・migration の責任は正本側に置く。会話ログでは「論理正本は JSON document model」「Rapid MVP の永続化は SQLite」という線が繰り返し出ている。

SQLiteは正本そのものというより永続化層。実装上は JSON blob / relational index / packed core column の混合がありうる。

### 通信境界

LLMに渡すものは `M3E.Context.v1`。JSONそのままではキー反復がうるさいので、TOON風の表形式で圧縮する。

ただし、LLMから返させるものは Context 全体ではなく `M3E.Command.v1`。この区別が重要。

### 表示境界

Hash / Line / Mermaid / Mermaid edge label は、ユーザー・LLM・レビュー用の表示フォーマット。データ構造の正本ではない。

Hashで親子が明らかな場合、`parent` のような構造情報を属性に重複させない。属性として持つべきなのは、構造から読めない `polarity`, `dependability`, `status`, `confidence` など。

## 最小モデル

最低限の中核はこの分割で足りる。

- `nodes`: 実体。id, kind, label, content pointer
- `tree` or `edges`: 主親子構造。parent/child/order
- `links`: 非木構造の補助線。source/target/type
- `attrs`: 可変属性。node/link/edge を対象に key/type/value
- `scopes`: 見え方と編集境界。folder world と alias 制約を含む
- `commands`: mutation の正規入口
- `reports`: validation / repair / diff の返却

## 属性設計

属性は二層に分ける。

- 固定高頻度属性: packed core column, e.g. `core_i64`
- 可変低頻度属性: `attrs(target_id, key, type, value)`

`parent` や `depth` は構造から分かるなら属性に入れない。入れるなら cache / projection と明示する。

固定領域に入れる候補は、構造から導けず、検索・表示・LLM制御で頻出するもの。

- node kind
- polarity
- status
- priority
- dependability
- confidence
- scope role
- visibility
- source kind
- lock state

## 次に固めるべきもの

1. `M3E.Context.v1` の列セットと辞書圧縮規約
2. `M3E.Command.v1` の op 語彙
3. `core_i64` の bit lane と enum vocabulary
4. `attrs` の型体系と value encoding
5. `Validate / Repair / Report` の失敗時プロトコル
6. JSON document model と SQLite table/index の対応
