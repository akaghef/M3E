# Brief: rapid-persistence-redesign

2026-10-24。Director による discovery。状態は**検討中**。移行先（DC39）と出し方（DC40）は akaghef の指示で保留しており、この文書は判断材料をまとめたもの。仕様の承認はまだない。

根拠資料:

- [現行の Rapid 保存経路の事実確認](./research-current-state.md)（Codex、dev-beta `d67b834`）
- [保存エンジン候補の外部調査](./research-engines.md)
- 発端は akaghef と ChatGPT の会話の export（2026-10-23〜24）。非公開の Drive へのリンクを含むので、public repo には置かない。その中の FA・WA・CA などの採番は正規の接頭辞ではないので、引用しない。用語は [Glossary](../../../docs/00_Home/Glossary.md) に従う。会話中の「Move」は reparent、「Reorder」は reorder（総称は node move）に当たる。

## Problem

研究 map が 20,150 node に増えて、画面からの保存が通らなくなった。保存状態は 7,967,381 バイトで、ブラウザは現在の状態と基準の状態をまとめて送るため、要求は推計 15,934,889 バイトになり、受信上限 10,000,000 バイトを超える。応急処置の前、研究 map への最後の書込みは 2026-10-22T17:33:30Z（日本時間 10/23 02:33）だった。これはサーバー起動時の全置換（IS132）で、利用者の画面保存が最後に成功したのは、それより前の時刻不明の時点になる。それ以降の画面での編集は保存されていない可能性が高い（推論。保存要求は計測していない）（RK13）。

容量は表面に現れた症状にすぎない。保存は map 全体の置換で、競合は全状態を比べて推測し、確定状態と revision の対応も崩れ得る。そのため、保存が「成功」したと応答していても編集が消える経路が複数ある（IS116〜IS125）。

1 回の編集にかかる量が map の総 node 数に比例するので、規模が大きくなるほど悪化する。2026-08 から Neo4j 化が繰り返し提案されたが、採用されないまま全体 JSON 方式が残った。

## Current State

詳細と file:line は [research-current-state.md](./research-current-state.md) にある。

- 保存先は SQLite の `maps` 表 1 つで、1 行が map 全体の `state_json` を持つ。journal・node ごとの revision・操作履歴はない。journal_mode は delete（WAL ではない）。同じ DB を開く複数プロセスを排他する仕組みもない。
- 書込み経路は約 27 本（ブラウザ保存、MCP、import_structure、Flash、linear-text、GraphLink、Vault の import / watch / 保存、collab の push、cloud の push / pull、backup の restore、Home の操作、起動時の移行、CLI）。ほぼすべてが「全状態を読む → 変更する → 全置換する」。確定時に revision を確かめ直すのはブラウザ保存と MCP だけ。
- 消失経路として次を確認した。
  - 競合時のマージが nodes しか扱わない（IS117）
  - 自動保存の失敗が表示されない（IS116）
  - 通知を受けると基準の時刻だけが先に進む（IS118）
  - マージ後に確定状態を取り込まない（IS119）
  - 別 tab からの受信で上書きする（IS120）
  - collab 保存が nodes しか送らない（IS121）
  - 先に全状態を読み、後で無条件に全置換する非同期処理（IS122）
  - Vault の再 import が GraphLink と linear-text を引き継がない（IS123）
  - cloud の定期 push が基準なしで上書きする（IS124）
  - SSE の取りこぼしと、通知を出さない書込み経路（IS125）
- Undo / Redo は全状態の複製。`import_structure` は node を 1 つ足すたびに全状態を複製する。外部更新は全体を再取得し、差分でなく全体を描き直す。
- Command の共通形式（[Command_Language.md](../../../docs/03_Spec/Command_Language.md) の 4.2 節）は未実装。MCP の expected_revision と Flash の重複防止キーだけが部分的にある。
- Final の実装も全 JSON 方式。cloud sync は全状態の複製を Supabase または JSON ファイルに持つ。

## Desired Outcome（要件候補。未承認）

- RQ19: data migration は workspace ごとに一度だけ行う（akaghef、2026-10-24）。
- RQ20: 1 回の編集の通信量・保存量・競合検査の量は、変更の大きさと検証に要る範囲に比例し、map の総 node 数には比例しない。export・portable snapshot の生成・初回読込みは map 全体が対象でよい。
- RQ21: 確定しなかった書込みを成功と表示しない。拒否と失敗は利用者に見える。
- RQ22: 確定前の編集は、再読み込み・通信失敗・プロセス再起動のどれでも失われない。
- RQ23: 同じ commandId を再送しても二重に適用しない。
- RQ24: 確定状態と revision は常に対で進む。通知を受けただけで基準を進めない。
- RQ25: 上記の全書き手が同じ確定経路を通る。移行後に map 全体を書き換える経路を残さない。
- RQ26: portable snapshot と journal の replay だけで復旧できる（[ADR 008](../../../docs/09_Decisions/ADR_008_Federated_Canonical_Sources.md) の Recovery Gate と同じ基準）。
- RQ27: 各 PC で offline でも編集できる。
- RQ28: GraphLink は生成時から安定した ID を持つ。Rapid occurrence と Deep entity を結ぶ entity binding を後から足しても、二度目の data migration が要らない。

## Approach（未決）

### 整理の枠組み

従来の「Neo4j 化」という一つの議題には、性質の違う 4 つの判断が混ざっていた。

1. 書込みのアルゴリズム
2. 論理レコードモデル
3. 物理エンジン
4. 正本の所有と同期

RQ19 の制約のもとで data migration の対象になるのは 2（論理レコードモデル）だけである。

| 層 | 内容 | data migration |
|---|---|---|
| 書込み経路 | Command（intent・対象・対象の base revision・commandId・provenance）→ 検証 → 1 transaction で確定 → 確定した変更と revision を返す。端末は確定前の Command を保持し、保存応答・通知・再読み込みを同じ取り込み処理に通す | 不要 |
| 論理レコードモデル | node、edge（親と兄弟順）、GraphLink、scope ごとの linear-text、属性。レコードごとの revision と、entity binding の置き場所を持つ | **この 1 回** |
| 物理エンジン | 論理レコードモデルの保存先 | portable snapshot と journal があれば、切替は replay で済む |

### DC39 移行先の候補

- **OP43**：journal と portable snapshot を正本の形式にする。読み書きの本体は SQLite の正規化テーブル。Neo4j は journal から作る materialization とし、いつでも追加でき、migration は要らない。ADR 008 はすでに Rapid が所有するレコードの materialization を認めているので、ADR 008 の変更は要らない。
  - 計測では、20,150 行で 1 行の reparent が 0.02 ms、ファイルは 1.6 MB。部分木の読取りは部分木の大きさに比例する。
- **OP44**：Rapid の正本も Neo4j に置く。
  - Node.js から使える組込みモードがないので、PC ごとに JVM サービスを常駐させるか、8/24 案のホスト交代方式（host lease）が要る。
  - Community には online backup がなく、macOS / Windows 11 は開発用途のみの対応。
  - Recovery Gate のため、journal と portable snapshot はどのみち必要になる。
  - ADR 008 の改訂が要る。
- **OP45**：SQLite の正規化テーブルだけを正本にし、journal は持たない。いちばん小さく済むが、Neo4j を正本にするなら二度目の migration が要る。RQ26 の根拠もない。
- 参考：組込みの Cypher エンジン（Kùzu の fork である LadybugDB）を正本にする案は、保存層がまだ安定していないため、一度きりの移行先としては危うい（[research-engines.md](./research-engines.md)）。

### DC40 出し方の候補

- **OP46**：書込み経路を先に、現在の保存形式のまま出す（コードの変更だけで、戻せる）。その後、data migration を 1 回だけ行う。
- **OP47**：書込み経路と data migration を 1 回の切替で出す。

### 決定済み

- DC41 = OP48（2026-10-24、akaghef）：応急処置として、全状態を送る保存経路の受信上限を引き上げ、自動保存の失敗を画面に出す。保存形式は変えない。
  - dev-beta `a128c85` に入れた。CI の Build & Test と Personal Path Check はどちらも success。通常 Beta はこの SHA から build して再起動した。
  - 全状態を送る経路の上限は 64 MiB で、超えると 413 と JSON を返す。
  - 研究 map の複製に同じ形の保存要求（15,935,121 バイト）を送ると、修正前は `EPIPE`、修正後は 200 で、node と linear-text が保たれた。
  - 通常 Beta 本体には、データを書かない要求で確認した。20 MB の不正な本文には 400、70 MB には 413 が返る。
  - 研究 map の画面編集が保存されるかは、利用者の次の編集で確かめる。
  - 64 MiB は全状態の約 32 MB まで（20,150 node の約 4 倍）の時間稼ぎで、RQ20 は満たさない。

## 判断の前に揃える材料（提案）

- PR14：論理レコードモデルの草案を作る（Codex が起草し、Director がレビューする）。OP43 と OP44 のどちらにも必要な共通の入力で、RQ28 を満たす形にする。
- PR15：約 27 本の書込み経路それぞれを、Command intent に対応付けた表にする。対応が付かない経路が、移行の範囲を決める。
- PR16：同じ Command 列を、SQLite の正規化テーブルと Neo4j の両方に研究 map 規模で適用し、計測して比べる。これは ADR 008 が求める「同一操作の比較」にあたる。計測は一時データで行い、個人の workspace は使わない。
- PR17：いま実際に必要な Deep query を棚卸しする。ADR 008 の Demand Gate（3 件）が満たせるかを確かめる。

評価の観点：AX5 正しさ（RQ21〜RQ24）、AX6 移行の回数と危険度、AX7 PC ごとの運用費用、AX8 Deep query の能力、AX9 復旧（RQ26）、AX10 複数 PC の同期と offline 編集、AX11 依存先の成熟度、AX12 編集あたりの計算量（RQ20）。

## Scope

- **In**：Rapid の保存、全書き手の確定経路、論理レコードモデル、journal、portable snapshot、一度きりの data migration（Final channel、cloud 上の複製、Vault との対応を含む）、確定した変更の差分適用。
- **Out**：多人数の Team Collaboration の一般解、CRDT、Deep の semantic graph 機能そのもの、描画の性能（外部更新の差分適用を除く）、viewer.ts の構造整理（source-restructure の範囲）。

## Boundary Candidates

- 書込み経路：Command の共通形式、サーバーでの確定、冪等な再送、端末の確定前 Command の保持、一本化した取り込み処理
- レコードの保存：スキーマ、journal、portable snapshot、移行、Fidelity Gate と Recovery Gate の検証
- 確定した変更を viewer に差分で適用する処理
- 所有者ごとの adapter（Vault、cloud sync）
- Undo（逆向きの Command、または変更前の値の保持）

## Out of Boundary

- Neo4j の Demand Gate を開くかどうか（PR17 の材料は出すが、判断は別に扱う）
- 描画アルゴリズムと Surface View

## Upstream / Downstream

- **Upstream**：ADR 004、ADR 008、[Command_Language.md](../../../docs/03_Spec/Command_Language.md)、[Data_Model.md](../../../docs/03_Spec/Data_Model.md)、[Model_State_And_Schema_V2.md](../../../docs/03_Spec/Model_State_And_Schema_V2.md)、[Channel_Release_Policy.md](../../../docs/06_Operations/Channel_Release_Policy.md)
- **Downstream**：Deep の materialization、Team Collaboration、複数 PC の同期（DP2）、外部からの大量追加（[261021 の観察](../../../docs/ideas/261021_external_scope_append_update_rate.md)）

## Existing Spec Touchpoints

- **Extends**：[Command_Language.md](../../../docs/03_Spec/Command_Language.md)（Definition only から実装へ）、[Incremental_Viewer_Updates.md](../../../docs/03_Spec/Incremental_Viewer_Updates.md)（外部更新の差分適用）、[Cloud_Sync.md](../../../docs/03_Spec/Cloud_Sync.md)、[Obsidian_Vault_Integration.md](../../../docs/03_Spec/Obsidian_Vault_Integration.md)
- **Adjacent**：`.kiro/specs/source-restructure`（viewer.ts と start_viewer.ts の分割。保存経路のファイルが重なる）
- **ADR**：ADR 004 の「論理正本は JSON document」という前提を置き換える新しい ADR が要る。ADR 004 の見直し条件には、規模の数値（node 数や要求の大きさ）がなかった。

## 未決の論点

- IS126：兄弟順の表現と、同時挿入の衝突解決規則（fractional index を使う場合の同一キー対策と再配置）
- IS127：Undo を逆向きの Command にするか、変更前の値の保持にするか
- IS128：Final channel、cloud 上の複製、Vault を、一度きりの移行にどう含めるか
- IS129：書き手を 1 プロセスに限る方法（別の server や CLI は DB を直接開けてしまう）
- IS130：Command intent と Glossary の対応。node move（reparent / reorder）、rename、delete、paste（新しい ID で複製）、scopen / unscopen は定義済み。親の挿入、親の除去、分割、統合には定義語がない
- IS131：journal の圧縮と、portable snapshot を作る頻度
- IS132：サーバーは起動のたびに、開発 map と研究 map を内容を変えないまま全置換し、`saved_at` だけを進める（2026-10-23 02:33 と 2026-10-24 21:25 の起動で確認。内容の差はない）。その結果、起動前から開いているタブの基準時刻がずれ、次の保存は競合マージに入る。そこでは nodes 以外の変更が落ちる（IS117）。起動時の書込みが要るのか、また研究 map が対象になる理由は未調査。

## Constraints

- A-sys の上位境界と ADR 008 の Constraints を優先する（同じ concern の write authority は一箇所、Neo4j の物理 store を Git 管理しない、など）。
- 自前の実装より既存ライブラリを優先する（better-sqlite3、neo4j-driver、fractional index 系、idb / Dexie）。
- 試験では個人の workspace を使わない。Beta から Final への反映は Channel_Release_Policy に従う。
- data migration は workspace ごとに一度だけ（RQ19）。
