# 草案: Rapid の論理レコードモデル

2026-10-25。brief の PR14 に当たる草案。Director の委任を受けた調査エージェントが起草した。**未承認**。DC39（移行先）と DC40（出し方）は未決のままとし、この草案は OP43・OP44 のどちらでも成り立つように書く。両者で形が変わる箇所は 10 節にまとめる。

- 表記: **事実** は照会結果またはコードの確認結果（根拠を付ける）。**提案** は起草者の案。
- コードの行番号は dev-beta `da2cdb4` 時点。viewer.ts は作業中に行番号がずれたので、関数名を併記する。
- 実データの照会はすべて `sqlite3.connect('file:'+p+'?mode=ro', uri=True)` による読み取りのみ。`maps` 表の全行（3 workspace、50 map）の `state_json` を Python で走査し、field 名・件数・バイト数だけを集計した。node の本文・map の内容・個人のパスは記載しない。
- workspace は次の 3 つ。表では B / F / T と略す。
  - B: Beta の個人 workspace（`Akaghef-personal`。開発 map と研究 map を含む）
  - F: Final の個人 workspace（`Personal`。`m3e.conf` で Final channel が参照する）
  - T: team workspace
- この文書は追跡 ID を新しく振らない。既存の RQ・IS・OP・DC は brief.md の番号を指す。

## 0. 要約

1. data migration の対象は「論理レコード」と、その portable snapshot の形式である。保存エンジン（SQLite / Neo4j）には依存させない。
2. レコード種別は 10 種。map・node・edge（親と兄弟順）・attribute・GraphLink・scope の付随設定・linear-text・Surface View の保存設定・Surface View ごとの node 配置値・注釈（annotation）。alias は node の一種として扱い、scope の範囲は folder node から導出する。
3. 兄弟順は fractional index のキーで表す（`fractional-indexing` を使う）。順序は `(親, キー, 子の nodeId)` で一意に決まる。キーを割り当てるのは確定を行う側で、journal には割り当てた結果のキーを記録する。
4. revision は record ごとに持ち、値は「その record を最後に変更した map の確定の通し番号」とする。client は通し番号の位置を基準として保持し、取りこぼした分は journal から取り寄せる。
5. journal entry は Command envelope（Command_Language 4.2 節）に、map の通し番号、record ごとの base revision、record 単位の変更（変更前と変更後の値）を加えたもの。Undo・replay・冪等な再送・同期・materialization は、すべてこの変更を入力にする。
6. 実データの約 2 割は、読込み時に導出または破棄される値である（1.4 節・8 節）。これを正本に持ち込まない。保存状態の合計 30.5 MB のうち、空の node 配置値だけで 5.3 MB ある。
7. entity binding は後から足すレコード種別として扱う。node と GraphLink の ID を変えないこと、レコード種別を後から追加できる形にしておくことで、二度目の migration は要らなくなる（RQ28）。

## 1. 実データの事実

### 1.1 規模

| 項目 | B | F | T | 根拠 |
|---|---:|---:|---:|---|
| map 行 | 27 | 12 | 11 | `SELECT … FROM maps` |
| `state_json` 合計 | 27.8 MB | 2.2 MB | 0.44 MB | 同上（UTF-8 バイト） |
| node | 40,108 | 4,411 | 1,199 | `nodes` の件数 |
| うち folder / alias | 1,752 / 991 | 153 / 0 | 36 / 2 | `nodeType` |
| 未定義の `nodeType` | 0 | `leaf` 216（うち 19 は子あり） | 欠落 1 | types.ts:1 の union 外 |
| attribute の項目 | 63,054（key 231 種） | 9,973（56 種） | 130（16 種） | `attributes` の項目数。全体で 258 種 |
| 親子 edge の label（`m3e:edge-label`） | 15,863 | 103 | 0 | 研究 map の node の 78% |
| GraphLink | 505 | 152 | 18 | `links` |
| `scopes` の記録 | 1,284 | 126 | 40 | |
| `surfaces` の記録 | 1,307 | 133 | 50 | |
| `nodeViews` の項目 / うち空でない | 179,529 / 1,111 | 10,197 / 1,146 | 1,303 / 121 | |
| `linearNotesByScope` の key | 273 | 114 | 40 | 1 件の最大は 848,304 バイト |
| 注釈 | 32（pen 29、text 3） | 9 | 3 | |
| 兄弟数の最大 | 646 | 50 | 15 | 646 は研究 map |
| 木の深さの最大 | 16 | 18 | 12 | |

### 1.2 不変条件の実測（違反数）

- 木: 違反 0。対象は 45,718 node。確認した項目は次のとおり。
  - `parentId` と `children[]` が相互に一致する
  - 子は重複しない
  - 親は 1 つ
  - root から到達できる
  - 循環がない
- alias: 違反 0。対象は 993 件。
  - target はすべて存在し、target が alias のものはない
  - 子を持つ alias はない
  - access はすべて `read`、`isBroken` はすべて false
- GraphLink: 違反 0。対象は 675 件。端点はすべて存在し、self link と alias を端点とするものはない。map 内で ID の重複はない。
- 導出値の古さ（違反ではないが、正本に持ち込むと害になるもの）:
  - B の `scopes` のうち 350 件は root node が存在しない。対応する `surfaces` も 350 件あるが、空でない node 配置値は 0 件。
  - B の 61 件は、key（`scope:<存在する folder>`）と `id`（`scope:<存在しない node>`）が一致しない。
  - `relationIds` の参照 11,108 件のうち 10,431 件は存在しない GraphLink を指す。
  - folder なのに `scopes` の記録がないものが、B に 646、F に 34 ある。
- linear-text の key:
  - 存在しない node を指すもの: B 27、F 33、T 3（計 868 KB）
  - folder でも root でもない node を指すもの: B 29、F 17、T 3（計 309 KB）
  - どちらも利用者が書いた本文である。

### 1.3 型定義にない値

- attribute の値は文字列とは限らない。型定義は `Record<string,string>`（types.ts:20）。
  - null 1,022（`xmind:class`・`m3e:layout`）
  - bool 513（`collapsed`）
  - 数値 136
  - 配列 2
- 型定義にない node の field（B と F）:
  - `type` 10（うち 8 は `nodeType` と食い違う）
  - `aliasOf` 13（すべて `targetNodeId` と同値）
  - `createdAt` 11、`updatedAt` 12、`notes` 11
  - `scopeId` 5（Data_Model.md は永続化を禁じている）
- 型定義にない top-level の key:
  - `savedAt`（B 1、F 1。F は null）、`selectedId` 1、`scopeId` 1
  - `exportedAt` / `sourceDb` / `sourceDocSavedAt` 各 2（T）
- `maps.source` の 1 件は `kind: "backup-json"` で、`MapSource` 型（home_types.ts:36、obsidian のみ）にない。
- ID の衝突:
  - 同じ workspace の別々の map で node ID が重なる: B 1,148、F 150、T 84
  - GraphLink ID の重なり: B 74
  - 別の workspace で map ID が重なる: 3 / 46
  - 主因は Home の複製で、JSON をそのまま複写している（rapid_mvp.ts の duplicate）。
  - node ID には自然言語の文字列を含むものがある（import 由来）。

### 1.4 導出値が溜まる仕組み（コード）

- **事実**: 読込み時の正規化（viewer.ts `sanitizeMapModelState` 2578〜）は次のように動く。
  - scope は root と folder から作り直す。
  - `relationIds` は GraphLink から計算し直す（2635〜）。
  - root の存在しない scope と、無効な scope に属する surface は捨てる。
  - `label` は最初の値を保持し続ける（2646）。
- **事実**: `sanitizeSurfaceNodeViews`（2554〜）は、空の配置値と、存在しない node の配置値を捨てる。
  - 一方、保存前の `syncMapModelStateFromRuntime`（2670〜、2716）は、現在の surface に map の**全 node** 分の配置値を `{}` で作る。
  - その結果、4,005 node の map が 721 surface・156,449 項目（すべて空）・4.5 MB を抱えている。この map の保存状態は 9.9 MB で、研究 map の 8.0 MB より大きい。
- **事実**: server 側の `RapidMvpModel.fromJSON` / `toJSON`（rapid_mvp.ts:833〜）は、未知の field を含めて全体を保持する。
  - そのため MCP や import の経路では、古い導出値も型定義外の field も残り続ける。
- **事実**: workspace のフォルダは Syncthing の共有フォルダである。
  - `.stfolder` があり、`.stignore` で `*.sqlite-wal`・`*.sqlite-shm`・`*.sqlite-journal`・`**/backups/` を除外している。
  - `data.sqlite` は 1 つのファイルとして PC 間で同期される。

## 2. レコード種別

全レコードの共通事項（**提案**）:

- key は map の中で一意にし、map をまたぐ場合は `mapId` を前に付ける（1.3 の衝突のため）。
- `rev` を持つ。
- 型定義にない field を、そのまま JSON で保持する欄を持つ。名前は未定（11 節の 5）。
- 欠けている field は既定値として読む。新しい field の追加は data migration なしで行える（追加だけを許す）。

| 種別 | key | 主な field | canonical owner | 由来（現行） |
|---|---|---|---|---|
| map | `mapId` | 次の 3 行のとおり | M3E-local source | `maps` 行と top-level |
| | | `rootNodeId`、`tags`、`archived`、`pinned`、`source`（MapSource） | | |
| | | linear の表示設定（`linearTextFontScale`、`linearPanelWidth`） | | |
| | | 最終確定時刻 | | |
| node（Rapid occurrence） | `(mapId, nodeId)` | `nodeType`（開いた文字列）、`text`、`details`、`note`、`link`、`collapsed` | 同上。Vault に結び付いた map は 7.3 | `nodes[*]` |
| | | alias の場合: `targetNodeId`、`aliasLabel`、`access`、`targetSnapshotLabel`、`isBroken` | | |
| edge（親子＋兄弟順） | `(mapId, 子の nodeId)` | `parentId`、兄弟順キー、`label`（11 節の 2） | 同上 | `parentId` と `children[]`。`m3e:edge-label` |
| attribute | `(mapId, 持ち主の種別, 持ち主の ID, key)` | `value`（型付きの JSON 値） | 持ち主に従う | node と GraphLink の `attributes` |
| GraphLink | `(mapId, linkId)` | `sourceNodeId`、`targetNodeId`、`relationType`、`label`、`direction`、`style`、`color`、`sourcePort`、`targetPort` | 同上 | `links[*]` |
| scope の付随設定 | `(mapId, scope の root nodeId)` | `primarySurfaceId`、保持された `label`、旧 `id`（食い違う 61 件） | 同上 | `scopes[*]` の非導出部分 |
| linear-text | `(mapId, scope の root nodeId)` | `text` | 同上 | `linearNotesByScope` |
| Surface View の保存設定 | `(mapId, surfaceId)` | 所属 scope の root nodeId、`kind`、`layout`、`displayRootId`、`surfaceView` | 同上 | `surfaces[*]` |
| Surface View ごとの node 配置値 | `(mapId, surfaceId, nodeId)` | `x`、`y`、`flowCol`、`flowRow`、`shape` | 同上 | `surfaces[*].nodeViews`（空でないものだけ） |
| 注釈 | `(mapId, annotationId)` | `kind`（pen / text）、scope の root nodeId、形状、色、太さ、`createdAt` | 同上 | `annotations` |
| 予約: entity binding | 未定 | 7 節 | 未定（Federated_Semantic_Source 18 節） | なし |

補足:

- `version`（1 で一定）は保存形式の版として map の外に持つ。
- `nodeType` は列挙型にしない。`leaf` と欠落 1 件があるため（11 節の 7）。
- `text` は alias でも残す。953/991 件は target の本文の複写で、削除時には snapshot の表示にも使う（rapid_mvp.ts:171）。
- attribute の値は null・bool・数値・配列を含む。
- scope の範囲（所属）は保存しない。folder と root から導出する（Data_Model.md「scope 導出ルール」）。
- linear-text の key が解決しない場合も残す（11 節の 4）。
- 注釈の `scopeId` は scope の root nodeId で、`scope:` は付かない（rapid_mvp.ts:532）。

### 2.1 種別ごとの判断（提案）

- **edge を node と別のレコードにする**
  - 改名・collapse（node の変更）と reorder・reparent（edge の変更）が同時に来ても、互いを競合にしないため。
  - key は子の nodeId と 1 対 1 に決まるので、edge 用の新しい ID は作らない。
  - root は edge を持たない。物理的に node と同じ行に置くことは妨げない。
- **attribute を独立したレコードにする**
  - agent による状態値の書込み（`m3e:status`、`workflow.*`）と、human の本文編集を別の revision にするため。
  - `set-attribute` / `unset-attribute` の intent（Command_Language 4 節）が 1 行の更新に収まる。
  - property graph の Property にもそのまま対応する（Glossary 1.1）。
- **scope は導出し、付随設定だけを保存する**
  - 範囲・`rootNodeIds`（全 1,450 件が長さ 1）・`relationIds` は、読込み時に作り直される導出値である。
  - 利用者の選択として残るのは `primarySurfaceId` だけ。
  - 保持された `label` は読み手がない（viewer では書くだけで、MCP の payload に出る）が、現在の本文と食い違うものが 408 件あるので、可逆性のために残す。
- **Surface View**
  - 保存値（`kind` / `layout` が旧語彙の `mindmap` 3 件などを含む）は書き換えずに持つ。
  - 正規の Surface View への正規化は今どおり読む側で行う。Surface View は brief の Out of Boundary なので。
  - 空でない配置値だけをレコードにする。

### 2.2 不変条件（確定時に検査する）

| 対象 | 規則 | 出典 |
|---|---|---|
| 木 | root は edge を持たない。root 以外の node は edge をちょうど 1 つ持つ。親は存在する。循環しない。root から到達できる | Model_State_And_Schema_V2 2.4 |
| 兄弟順 | 同じ親の下で `(兄弟順キー, nodeId)` が全順序になる。キーは空でない | 3 節 |
| alias | target は実体ノード（alias 以外）だけ。子を持たない。target が欠けたら `isBroken` と `targetSnapshotLabel` が揃う | Data_Model、Scope_and_Alias |
| GraphLink | 端点は実在する実体ノード。self link は禁止。端点の node を delete したら GraphLink も同じ確定で delete する | Data_Model「Graph-level Link」 |
| scope | 範囲は最も近い folder 祖先、なければ root から導出する。alias は folder にしない。scopen / unscopen は `nodeType` の変更だけで表す | Data_Model、rapid_mvp.ts `setScopeBoundary` |
| 付随レコード | scope の付随設定・linear-text・Surface View・注釈が指す scope root は、folder か root であることが望ましい。そうでない場合は削除せず「所属未解決」として扱う（下記） | 1.2 の実測 |
| Surface View の node 配置値 | node と Surface View が存在する。空の値は保存しない | viewer.ts `sanitizeSurfaceNodeViews` |
| 権限 | authority を跨ぐ reparent は通常の確定にしない | Federated_Semantic_Source 8 節 |

「所属未解決」は、ADR 008 の referential state（`missing` / `tombstoned`）に近い状態である。ただし referential state は materialized record の語として定義されている。正規語は 11 節の 1 で扱う。

## 3. 兄弟順

| 観点 | 整数位置 | 双方向連結リスト（prev / next） | fractional index のキー |
|---|---|---|---|
| reorder・reparent で書く量 | 移動元と移動先の兄弟をすべて振り直す（最大 646 行） | 3〜5 行 | 1 行 |
| 同時挿入 | 必ず衝突する | 同じ位置への挿入で列が分岐し、壊れやすい（循環・断片化） | 同じキーが生じ得る。`nodeId` で順位を決め、確定側で割り当て直す |
| journal の replay | 振り直しの全行を記録する必要がある | 前後の参照を記録する。途中の欠落に弱い | 結果のキーを記録すれば決定的 |
| 読出し | `ORDER BY pos` | 列を辿る必要がある（SQL では兄弟列ごとに再帰） | `ORDER BY (key, nodeId)`。索引で済む |
| 再配置 | 不要 | 不要 | 同じ隙間への挿入が続くとキーが伸びる。まれに兄弟をまとめて割り当て直す |
| 既存ライブラリ | 不要 | なし | `fractional-indexing` 4.0.0（CC0）、`fractional-indexing-jittered`（CC0）、LexoRank |

**提案**:

- `fractional-indexing`（rocicorp）を採用する。根拠は research-engines.md 4 節。
- **キーは確定する側だけが作る。**
  - Command は位置を兄弟の nodeId で示す（直前の兄弟、直後の兄弟、または末尾）。
  - 確定側がその時点の兄弟からキーを作り、journal にはそのキーを記録する。
  - これにより replay と別エンジンでの再構築は、キーの生成方法に関係なく決定的になる。
  - 既存の `reorderInsertionIndex`（shared/reorder_insertion.ts）は兄弟の ID で解決しているので、そのまま入力に使える。
- 順序は `(parentId, key, nodeId)` で比べる。キーは ASCII で、比較は BINARY 照合（SQLite）とコードポイント順（Neo4j）で一致する。
- offline の端末（RQ27）が仮のキーを作る場合は、jittered 版で衝突を減らす。合流するときの確定側が割り当て直す。
- 再配置は、1 つの親の兄弟をまとめて割り当て直す Command にする。その変更は journal に残す。発動する条件（例: キーの長さが閾値を超えたとき）は未定。
- migration では、各親の `children[]` の順に `generateNKeysBetween(null, null, n)` でキーを付ける。最大の n は 646。
- Concreteness Axis は別の兄弟順を持っている。`m3e:concreteness:order:<level>` という数値の attribute で（concreteness_axis.ts:42〜46）、level ごとの別の親子関係を表す。これは attribute のまま残す。実データでは 0 件。

## 4. revision

**提案**:

- map は、確定するたびに 1 ずつ増える整数（以下「確定の通し番号」）を持つ。正規語は 11 節の 1。
- 各レコードの `rev` は、そのレコードを最後に変更した確定の通し番号とする。移行で作られたレコードは 0。
- 削除したレコードも、通し番号の付いた変更として journal に残る。
- **確定状態と revision を対で進める（RQ24）。**
  - 確定の応答と通知は、必ず `(通し番号, 変更したレコードと新しい rev)` を返す。
  - client が基準として保持するのは「適用済みの最後の通し番号」と、手元のレコードの `rev` である。
  - 変更を適用したときにだけ基準を進める。通知を受けただけでは進めない（IS118 を構造的に防ぐ）。
- **競合の判定（提案）**
  - Command は、読んだレコードごとの `rev` を base として送る。
  - 一致すれば確定する。
  - 一致しなければ、base から現在までの journal から該当レコードの変更を引き、この Command が触る field と交わるかを見る。交わらなければ確定し、交われば競合として拒否する（RQ21）。
  - この判定の手間は、そのレコードの変更数に比例し、map の総 node 数には比例しない（RQ20）。
- **取りこぼしからの再開**（client に必要なもの）
  1. 適用済みの最後の通し番号
  2. 確定前の Command（commandId 付き）。端末側に永続化する（IndexedDB の `idb` または Dexie。brief Constraints）
  - 再開時は、まず「その番号より後の journal」を取得する。
  - 保持期間を過ぎていれば、portable snapshot（または必要な scope 分のレコード）とその通し番号以降の journal を取得する。
  - その後、確定前の Command を同じ commandId で再送する。重複したものは元の結果を返す（RQ23）。
- 置き換えるもの:
  - MCP の `expected_revision`（保存状態全体の SHA-256、rapid_mvp.ts:1536）
  - ブラウザの `baseSavedAt`
  - cloud sync の `mapVersion`
  - 時刻（`saved_at`）は確定時刻として残すが、比較には使わない。

## 5. journal entry

| field | 内容 | 用途 | 4.2 節との関係 |
|---|---|---|---|
| `mapId`, 確定の通し番号 | 確定の順序 | replay、再開、materialization の進捗 | **追加** |
| `commandId` | 再送でも変わらない ID（ULID または UUIDv7。`uuid` 14 は間接依存として入っている） | 冪等な再送（`(mapId, commandId)` で一意） | 既存 |
| `intent` | Command intent | 監査、Undo、同期での再適用 | 既存。不足は下記 |
| `targetRef` | 主対象。複数対象の Command では一覧か要約 | 監査、表示 | 既存。複数対象の書き方が未定義 |
| `actor` | agent（AI agent または human）、bot、system と識別情報 | 監査、表示 | 既存 |
| `provenance` | 上流の Command、source event、import の束、Flash job、端末・session | 因果、echo の検出 | 既存 |
| base revisions | レコードの key ごとの `rev` | 競合の判定 | **拡張**（4.2 節は単一の `baseRevision`） |
| `approvalState` | Rapid の直接の確定では approved | proposal journal との区別 | 既存。Rapid での意味が未定義 |
| 確定時刻、確定した端末 | server の時計と端末の識別 | 複数 PC、監査 | **追加** |
| 形式の版 | journal の形式の版 | 後方互換 | **追加** |
| 変更の一覧 | レコードごとに 1 要素。内訳は次の行 | replay、Undo、materialization | **追加** |
| （内訳） | 種別と key、作成 / 更新 / 削除、変更前と変更後の `rev` | | |
| （内訳） | 変更前の値（更新では変えた field だけ、削除では全体） | | |
| （内訳） | 変更後の値（更新では変えた field だけ、作成では全体） | | |

使い方:

- **replay**: 変更後の値を、変更前の `rev` と一致するときだけ適用する。intent を実行し直さないので、エンジンが違っても決定的になる。
  - 一致しないときは journal の破損として扱い、処理を止める。
  - すでに変更後の `rev` に達していれば飛ばす。これで中断後の再開が冪等になる。
- **Undo**: 変更前と変更後を入れ替えた新しい Command を作り、base は変更後の `rev` とする。逆向きの Command と変更前の値の保持のどちらを選んでも（IS127）、この形で足りる。
- **同期・offline**: 他の端末の entry の変更前の `rev` が手元と合わなければ、intent と兄弟の位置指定から再適用する。
- **materialization**: Neo4j などへの反映は、変更の一覧を通し番号の順に読む。その進捗は source descriptor の `lastIndexedRevision`（Federated_Semantic_Source 4 節）に当たる。
- 拒否した Command は journal に入れない。journal は確定の履歴とし、拒否は呼び出し側に返す（RQ21）。

4.2 節に対して足りないもの（**事実**＋**提案**）:

- 通し番号、record ごとの base、変更の一覧、確定した端末、形式の版がない（上の表）。
- 未定義の intent:
  - linear-text の更新
  - Surface View の保存設定と node 配置値の更新
  - 注釈の作成・削除
  - map の情報の更新（tags / pin / archive / source / rename）
  - 兄弟の再配置
  - 移行の起点
  - IS130 の 4 種（`groupSelected` に当たる親の挿入を含む）
- collapse は `view`（「canonical graph write ではない」）に分類されているが、`collapsed` は保存される（Model_State_And_Schema_V2 2.2）。この食い違いの扱いを決める必要がある。
- linear-text の 1 値は最大 848 KB ある。自動保存（700 ms）のたびに前後の全文を記録すると journal が膨らむ。
  - 閾値を超える text field は差分（patch）で記録する案がある。既存ライブラリの例は diff-match-patch や jsdiff。採否と閾値は未定。
- Flash の重複防止キー（`m3e:flashImportKey`、673 件）は、node の attribute を全件走査して照合している（mcp_service.ts:410）。
  - commandId による重複排除に置き換えられるが、attribute は data なので残す。

## 6. portable snapshot

**提案**（Glossary の portable snapshot、ADR 008 の Recovery Gate）:

- **単位と形式**: map ごとに 1 つの JSON Lines ファイル。
  - 1 行目は header。形式の版、`mapId`、source の識別、通し番号、作成時刻、種別ごとの件数を持つ。
  - 2 行目以降は 1 行に 1 レコード（種別、key、`rev`、値）。
  - 最後の行は、種別ごとの SHA-256 と全体の SHA-256 を持つ。
  - journal も同じ規約の JSON Lines で、通し番号の範囲ごとに区切る。
- **決定性**: 各行は RFC 8785（JCS）で正規化する。既存の実装を使う（例: npm の `canonicalize`。版と保守状況は未確認）。
  - 行の順は、種別の固定順（2 節の表の順。後から足す種別は末尾）と、その中での key のバイト順。
  - 同じ通し番号の同じレコードからは、同じバイト列ができる。
  - JCS は数値を ECMAScript の規則で書き出すので、実データの `linearTextFontScale = 1.2000000000000002` もそのまま往復する。
- **入れないもの**:
  - エンジン内部の ID（SQLite の rowid、Neo4j の elementId）
  - 導出値（`children[]`、scope の範囲、`relationIds`）
  - cache、空の node 配置値
- **再構築の手順**（Recovery Gate の実証）:
  1. 空のエンジンを用意する。
  2. snapshot のレコードを `rev` 付きで読み込み、通し番号を S に設定する。
  3. S より後の journal を 5 節の replay 規則で適用する。
  4. 2.2 節の不変条件を検査する。
  5. 再構築したエンジンから同じ通し番号で snapshot を作り、元のエンジンの snapshot と SHA-256 が一致することを確かめる。
  - backup / restore は補助としてのみ使う。
- **置き場所**: エンジンのファイルとは別の failure domain に置く（ADR 008 Constraints）。
  - Syncthing は `backups/` を除外しているので、PC 間で共有する snapshot と journal の置き場所は、同期の設計（DP2）と一緒に決める。
  - 作る頻度と journal の保持期間は IS131。

## 7. Deep への備え（RQ28）

### 7.1 identity

- **事実**: GraphLink の ID は生成時に一度だけ作られ、改名・reparent・reorder では変わらない。paste は新しい ID を作る（rapid_mvp.ts `copySubtree`）。map 内での重複は 0 件。
- **事実**: ID は map をまたぐと衝突する（1.3）。
- **提案**:
  - migration では node・GraphLink・annotation・surface の ID を**一切振り直さない**。attribute の値（`sourceNodeId`、`m3e:binds-to`、`blueprint:*` など）が ID を参照しているため。
  - 大域の identity は `SourceId + LocalEntityId`（Federated_Semantic_Source 5 節）とする。
  - Rapid 側の SourceId は「workspace と map の組」を写すものにする。具体的な表現は 11 節の 12。
- Neo4j の relationship ID（elementId）は再構築すると変わる。GraphLink の identity は必ず `(SourceId, linkId)` の property で持つ。

### 7.2 entity binding を後から足す場所

- **提案**:
  - entity binding は独立したレコード種別とする。少なくとも、Rapid occurrence の参照 `(SourceId, nodeId)`、Deep entity の参照、`rev`、provenance、owner を持つ。
  - node と GraphLink のレコードには何も足さない。多対多（Federated_Semantic_Source RQ4）なので、node の field にすると表現できない。
  - この追加に migration が要らないための条件は 3 つ。
    1. journal の変更と snapshot が、レコード種別の開いた集合を受け入れる（未知の種別は読み飛ばさずに保持する）。
    2. node の delete が journal に残る。binding 側は、参照先が `tombstoned` かどうかを journal から判定できる。
    3. 7.1 の identity を変えない。
- **事実**: binding に関係しそうな値が attribute にすでにある。
  - `m3e:entity` 16、`m3e:entity-id` 2、`m3e:binding-id` 17、`m3e:binds-to` 8、`m3e:stable-id` 40、`m3e:binding-anchor` 3
  - scope bind 用の別 schema（scope_binding.ts:147〜242。`binding_entity` / `binding_member`）もあるが、ライブの DB には作られていない。
  - これらは attribute として保持し、意味の変換は Deep の Command として後で行う。scope bind と entity binding は別の概念（Glossary）。
- authority root の印（Federated_Semantic_Source 8 節。field 名は未定）は、scope の付随設定か node に field を足す形で後から追加できる。

### 7.3 Vault との対応

- **事実**: Vault に結び付いた map（`MapSource.kind = "obsidian"`）では、Live の正本は Vault の Markdown である（`VaultWatchStatus.sourceOfTruth = "vault-md"`、types.ts）。
- **事実**: 再 import は GraphLink と linear-text を引き継がない（IS123）。
- **提案**: map のレコードに canonical owner（M3E-local か、Obsidian-backed か）を明示する。
  - Obsidian-backed の map の node は、source-materialized の扱いになる。
  - `source.path` は端末ごとに異なる絶対パスなので、PC 間で同期すると誤る（11 節の 13）。

## 8. 移行の対応表

件数は B / F / T。「捨てる」「導出」は、どれも現在の読込み時の正規化がすでに行っているか、読み手がないことを確認したものに限る。

| 現行の field | 移行先 | 判断 | 件数（B / F / T） |
|---|---|---|---|
| `maps.id` | map の key | そのまま。ULID 以外の形式も残す | 27 / 12 / 11 |
| `maps.version` | 保存形式の版（map の外） | 導出（全行 1） | — |
| `maps.saved_at` | map の最終確定時刻、snapshot の header | 文字列のまま（ミリ秒のない 1 行を含む） | 全行 |
| `tags` / `archived` / `pinned` / `source` | map | そのまま。`backup-json` の 1 件も残す | 2・0・1・0 / 0・1・2・0 / 2・0・1・1 |
| `rootId` | map の `rootNodeId` | そのまま | 全 map |
| `nodes[*]` の本体 | node | そのまま。`nodeType` は文字列のまま | 40,108 / 4,411 / 1,199 |
| `parentId` と `children[]` | edge（兄弟順キー） | `children[]` は書き出すときに導出する | 40,081 / 4,399 / 1,188 |
| `attributes[*]` | attribute（型付き JSON） | そのまま | 63,054 / 9,973 / 130 |
| `attributes["m3e:edge-label"]` | edge の `label`（案）または attribute | 11 節の 2 | 15,863 / 103 / 0 |
| alias の field | node | そのまま | 991 / 0 / 2 |
| node の `type`・`aliasOf`・`createdAt`・`updatedAt`・`notes`・`scopeId` | node の型定義外の欄 | 残す（11 節の 5） | 計 57 / 5 / 0 |
| `links[*]` | GraphLink | そのまま | 505 / 152 / 18 |
| `links[*].attributes` | attribute（持ち主は GraphLink） | そのまま | 14 / 0 / 0 |
| `scopes[*].primarySurfaceId`・`label`・食い違う `id` | scope の付随設定 | 残す | 934 / 126 / 40 |
| `scopes[*]` で root のないもの | — | 捨てる（viewer が読込み時に捨てる。空でない配置値は 0 件） | 350 / 0 / 0 |
| `scopes[*].rootNodeIds`・`relationIds` | — | 導出 | 1,284 / 126 / 40 |
| `surfaces[*]` で scope が有効なもの | Surface View の保存設定 | そのまま（旧語彙を含む） | 957 / 133 / 50 |
| `surfaces[*]` で scope が無効なもの | — | 捨てる（同上） | 350 / 0 / 0 |
| `nodeViews` の空でない値 | Surface View ごとの node 配置値 | そのまま | 1,111 / 1,146 / 121 |
| `nodeViews` の空の値と、存在しない node の値 | — | 捨てる（`sanitizeSurfaceNodeViews` と同じ）。約 5.3 MB | 178,418 / 9,051 / 1,182 |
| `linearNotesByScope` | linear-text | すべて残す。所属が解決しないものも残す（11 節の 4） | 273 / 114 / 40 |
| `annotations` | 注釈 | そのまま | 32 / 9 / 3 |
| `linearTextFontScale`・`linearPanelWidth` | map の表示設定 | 数値はそのまま | 26・5 / 12・3 / 9・3 |
| top-level の `savedAt`・`selectedId`・`scopeId`・`exportedAt`・`sourceDb`・`sourceDocSavedAt` | map の型定義外の欄 | 残す。`selectedId` と `scopeId` は ViewState の混入（11 節の 5） | 3 / 1 / 6 |
| `backups/*.sqlite`・`conflict-backups`・`cloud-sync`・`audit/*.jsonl`・`flash-jobs`・seed DB | — | その場では変換しない。旧形式の入力として、import の Command で取り込む | IS128 |

### 8.1 可逆性の検証（提案）

- M を移行（旧 JSON → レコード）、L を旧形式への書き出し（レコード → AppState 形の JSON）とする。
- N は「宣言した導出・破棄」だけを旧 JSON に適用する関数で、上の表の「捨てる」「導出」の行をそのまま実装する。
  - 空の node 配置値を捨てる
  - root のない scope と、それに属する surface を捨てる
  - `relationIds` を viewer の規則で計算し直す
  - `rootNodeIds` を root に揃える
  - `nodeType` が欠けていれば `"text"` とみなす
  - edge-label を移す場合は、その逆写像
- 判定（map ごと。すべて一致したら合格）:
  1. `N(旧) ≡ L(M(旧))`
     - object の key の順は無視し、配列の順は区別する。
     - 数値は IEEE 倍精度として比較し、文字列はバイト単位で比較する。
  2. N が取り除いた件数が、8 節の表の件数と規則ごとに一致する（想定外の欠落を検出する）。
  3. 読み手での同値性。次の 2 つで、旧と `L(M(旧))` の結果が同じになる。
     - viewer の `ensureDocShape`（関数をそのまま呼ぶ）
     - server の `RapidMvpModel.fromJSON(...).toJSON()`
  4. `M(旧)` から作った portable snapshot で再構築し、もう一度作った snapshot とバイト単位で一致する（6 節）。
  5. 2.2 節の不変条件の違反数が、移行の前後で同じ（実データでは 0）。
- 試験は workspace の一時的な複製で行う。個人の workspace には書かない。
- 実際の移行は「問題の件数が 0 のときだけ切り替え、旧 DB は消さずに archive する」（CLAUDE.md の破壊的操作の規則）。
- **残る危険**: `Object.keys(nodes)` の順に依存するコードがあると、object の key の順を無視した比較では検出できない。Concreteness Axis は木の順から計算し直していることを確認した（concreteness_axis.ts `projectConcreteness`）。それ以外は未調査。

## 9. 物理の素描（エンジン中立性を示すためだけ）

### 9.1 SQLite

```sql
-- すべて (map_id, …) の複合主キー、WITHOUT ROWID
map(map_id PK, head_seq, root_node_id, owner_kind, tags_json, archived, pinned, source_json, prefs_json, extra_json, committed_at, rev)
node(map_id, node_id, node_type, text, details, note, link, collapsed,
     alias_target, alias_label, alias_access, alias_snapshot_label, alias_is_broken, extra_json, rev)
edge(map_id, child_id, parent_id, order_key TEXT COLLATE BINARY, label, rev)
attribute(map_id, owner_kind, owner_id, key, value_json, rev)
graph_link(map_id, link_id, source_id, target_id, relation_type, label, direction, style, color, source_port, target_port, extra_json, rev)
scope_setting(map_id, scope_root_id, primary_surface_id, label, legacy_id, rev)
linear_text(map_id, scope_root_id, text, rev)
surface(map_id, surface_id, scope_root_id, kind, layout, display_root_id, surface_view_json, rev)
surface_node_view(map_id, surface_id, node_id, x, y, flow_col, flow_row, shape, rev)
annotation(map_id, annotation_id, kind, scope_root_id, body_json, rev)
journal(map_id, seq, command_id, intent, actor_json, provenance_json, base_json, effects_json, committed_at, origin, PRIMARY KEY(map_id, seq), UNIQUE(map_id, command_id))
-- 索引: edge(map_id, parent_id, order_key, child_id)  兄弟の並びと部分木の再帰 CTE
--       node(map_id, alias_target)                     target を delete したときの broken 化
--       graph_link(map_id, source_id), graph_link(map_id, target_id)  端点の delete に連動
--       attribute(map_id, key, owner_id)                key ごとの照会（Flash の重複防止キーなど）
```

- OP43 では、レコードと journal を同じ transaction で確定する。
- WAL にすると、Syncthing が除外している `-wal` に確定済みのデータが残る時間ができる。そのため、SQLite のファイルを丸ごと同期する今の運用は使えなくなる（11 節の 13）。

### 9.2 Neo4j

- `(:Map {key, headSeq})`
- `(:Node {key: "<SourceId>/<nodeId>", nodeType, text, …, rev})`
  - nodeType を Label にするか Property にするかは adapter の判断（Glossary 1.1）。
- edge: `(child)-[:CHILD_OF {orderKey, label, rev}]->(parent)`
  - 子が親を 1 つだけ持つ制約は、relationship の制約では表せない。Command の検証で守る。
- GraphLink: `(s)-[:GRAPH_LINK {key, linkId, relationType, …, rev}]->(t)`
  - relationship の property に一意制約が使えるかは edition で異なる。使えなければ GraphLink を node として持つ。
- attribute:
  - Neo4j の property は null を保持できず（null を設定すると property が消える）、入れ子の配列も持てない。
  - 実データには null が 1,022 件ある。property に直接置くと可逆でなくなる。
  - そのため attribute は JSON 文字列として持つか、`(:Attr {key, valueJson})` の node として持つ。
  - 照会のために、scalar の写しを property として併置してよい。
- 兄弟順キーの比較は文字列のコードポイント順で、ASCII のキーなら SQLite と一致する。部分木の取得は可変長 path。

## 10. OP43 と OP44 で変わる箇所

| 箇所 | OP43（journal と snapshot が正本の形式。SQLite で実行し、Neo4j は materialization） | OP44（Rapid の正本が Neo4j） |
|---|---|---|
| レコード種別・key・rev・journal entry・snapshot | 共通（2〜6 節） | 共通 |
| journal と確定の原子性 | 同じ SQLite の transaction | journal は別の failure domain に要る（ADR 008）。次の手順で原子性を補う。 |
| | | 1. journal に先に書く |
| | | 2. Neo4j で確定し、`headSeq` を進める |
| | | 3. 再起動時は `rev` を見て replay（5 節の冪等な規則） |
| 通し番号の採番 | map の行 | `:Map` の property を transaction 内で更新する |
| attribute の値 | `value_json` | JSON 文字列か attribute の node が要る（9.2） |
| 親を 1 つに限る、GraphLink の一意性 | 主キー | Command の検証、または edition に依存する制約 |
| Neo4j 上の Rapid レコードの役割 | source-materialized（ADR 008 の範囲内） | canonical。ADR 008 の Review trigger「M3E-owned accepted graph 以外への拡張」に当たり、改訂が要る |
| Recovery Gate | snapshot＋journal（同じ形式） | 同じ。Community には online backup がないので、なおさら必須 |

## 11. Director への未決事項

1. 正規語がない概念が 4 つある。名付けが要るか、既存語で足りるかを決めてほしい。
   - 「map ごとの確定の通し番号」
   - 「journal entry 内のレコード単位の変更（変更前と変更後の値）」
   - 「付随レコードの所属が解決しない状態」（referential state は materialized record の語）
   - 「型定義にない field の保持欄」
2. `m3e:edge-label` の置き場所。
   - 案 A: edge レコードの `label` に移す。GraphLink の `label` と対になり、Neo4j の relationship property とも一致する。研究 map の 15,753 件が対象。
   - 案 B: attribute に残す。viewer と selection adapter の参照を変えずに済む。
   - どちらでも可逆性は保てる。
3. attribute を独立したレコードにする提案（2.1 節）の採否。node のレコードの一部にすると行数は減るが、agent と human の同時の書込みが同じ revision で競合する。
4. 所属が解決しない linear-text（63 key、868 KB）と、folder でない node に付いた linear-text（49 key、309 KB）を残すか。既定案は残すこと。
5. 型定義外の field を、保持欄に入れて残すか捨てるか。
   - node: `type` 10、`aliasOf` 13、`createdAt` / `updatedAt` / `notes` 計 34、`scopeId` 5
   - top-level: `savedAt` 2、`selectedId` 1、`scopeId` 1、import の由来 6
   - 既定案は全部残し、ViewState の混入（`selectedId`、`scopeId`）だけを捨てる候補として示すこと。
6. scope の保持された `label`（現在の本文と食い違うものが 408 件。読み手はない）を残すか、本文から導出するか。
7. 未定義の `nodeType` `leaf`（F に 216 件、うち 19 件は子あり）を実体ノードとして扱うか、`text` に寄せるか。Data_Model の「新しい nodeType を追加するときの規則」に照らして判断が要る。
8. Surface View の旧語彙（`mindmap`・`scatter`・`logic-chart`・`timeline`）を、移行時に正規の Surface View の設定へ書き換えるか。既定案は書き換えずに保持すること。map_layout_modes 11 節の正規化は読む側に残す。
9. この移行で Model_State_And_Schema_V2 の v2（`type`・`content`・`meta`、`createdAt` / `updatedAt` を MUST とする）を置き換えるか。
   - v2 は実装されていない。RQ19 があるので、後から v2 の移行を別に行うことはできない。
   - 作成時刻と更新時刻は journal から得られる。ただし移行より前の値は不明で、移行時刻で埋めると事実でない値になる。
10. 5 節の未定義の intent の扱い。
    - linear-text、Surface View、注釈、map の情報、再配置、移行の起点、IS130
    - `view` に分類されているが保存される collapse
11. linear-text の journal を差分で記録するか。その閾値とライブラリ。
12. Rapid 側の SourceId を何にするか。
    - 案: workspace ID と map ID の組。ID は衝突する（map 3 件、node 1,148 件、GraphLink 74 件）。
    - 移行時に新しく採番する案もあるが、既存の参照との対応表が要る。
13. 複数の PC で使う場合（RQ27）。
    - journal を map ごとにするか workspace ごとにするか。端末ごとの番号を持つか。
    - Syncthing による `data.sqlite` の丸ごと同期をやめて、journal と snapshot を同期の単位にするか。
    - Vault の `source.path` のように端末ごとに異なる値を、どのレコードに置くか。
14. 移行後に旧版がどう失敗するか（DC40 に関わる）。
    - 旧版のコードは `maps` 表がなければ空の表を作り（rapid_mvp.ts `openSqlite`）、DB がなければ seed を複写する（scripts/beta/launch.sh:134〜138）。
    - したがって、移行した DB を同期先の PC の旧版が開くと、黙って二重の正本ができ得る。
    - 旧版に確実に失敗させる印（例: 書込みを拒む trigger を付けた `maps` 表を残す）が要る。
15. 本文を含む node ID（import 由来）が、journal・snapshot・Neo4j の key に入ることを許容するか。classification（ADR 008 の Exposure Gate）に関わる。

## 付記: 予想外だった実データ

- 研究 map より大きい map がある。4,005 node で保存状態は 9.9 MB あり、その 45% は空の node 配置値である。原因は `syncMapModelStateFromRuntime` で、現在の surface に map の全 node 分の `{}` を書く。保存形式とは関係なく、書込み経路の不具合として扱える。
- `scopes` の記録の多くは古い。
  - B の 1,284 件のうち 350 件は root が存在しない。
  - `relationIds` の参照の 94% は存在しない GraphLink を指す。
  - folder の約 4 割には記録がない（B では 1,557 件中 646 件）。
  - viewer が読込みのたびに作り直しているので、表示上は問題にならない。
- attribute の値に null・bool・数値・配列がある。型定義と書込みの境界の検査（`isGraphLinkAttributes` は GraphLink だけ）を抜けている。
- node ID・GraphLink ID・map ID は、map や workspace をまたぐと一意でない。
- workspace のフォルダは Syncthing の共有フォルダで、SQLite のファイルを丸ごと同期している。
- Final の workspace には、未定義の `nodeType` `leaf` が 216 件ある。
