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

- PR14：論理レコードモデルの草案を作る。OP43 と OP44 のどちらにも必要な共通の入力で、RQ28 を満たす形にする。→ 草案は [draft-record-model.md](./draft-record-model.md)（2026-10-25、Claude の調査エージェントが起草、Director がレビュー済み、未承認）。
- PR15：書込み経路それぞれを Command intent に対応付けた表にする。対応が付かない経路が、移行の範囲を決める。→ 草案は [draft-write-path-commands.md](./draft-write-path-commands.md)（同上）。サーバー・プロセス側 63 行、ブラウザ操作 61 行。
- PR16：同じ Command 列を、SQLite の正規化テーブルと Neo4j の両方に研究 map 規模で適用し、計測して比べる。これは ADR 008 が求める「同一操作の比較」にあたる。計測は一時データで行い、個人の workspace は使わない。
  - → 結果は [bench-pr16-results.md](./bench-pr16-results.md)（2026-10-25）。
    - 1 回の編集の確定時間の p50（20,150 node → 201,491 node）は、全 JSON の現行方式が 52 → 769 ms で、map の大きさにほぼ比例して増える。
    - 草案のレコードモデルではほぼ横ばいで、SQLite（DELETE）が 0.32 → 0.38 ms、Neo4j が 5.9 → 7.1 ms。
    - 3 歩先までの近傍は Neo4j が約 2 倍速く、1 点の読取りと map 全体の読込みは SQLite が速い。
    - 同じ Command 列を適用すると、どのエンジンの最終状態も兄弟順キーまで一致した。
- PR17：いま実際に必要な Deep query を棚卸しする。ADR 008 の Demand Gate（3 件）が満たせるかを確かめる。
  - → 結果は [pr17-deep-query-inventory.md](./pr17-deep-query-inventory.md)（2026-10-26）。**Demand Gate は満たしていない。**
    - 4 条件（source をまたぐ、実際の運用から出た、固定されている、Neo4j が要る理由がある）をすべて満たす問い合わせは 0 件だった。
    - 実需は 1〜2 歩の「探す」問いで、grep・file の読取り・LLM で答えられていた。
    - 現在のデータには、map をまたぐ構造化された関係が 0 件しかない。Deep の制約はエンジンではなく、同一性と関係のデータが欠けていることである。

### PR14・PR15 の草案レビュー（2026-10-25、Director）

用語、追跡 ID、個人のパス、主張の裏付けを確認した。

- PR14 で直したのは節番号の参照 2 か所だけ。
- 次の 2 点はコードで確かめた。
  - 起動時に `ensureMap` が研究 map を全置換する（start_viewer.ts `startServer`）。
  - 保存前の `syncMapModelStateFromRuntime` が、全 node 分の空の配置値を作る（viewer.ts）。
- PR15 の intent は、Command_Language.md 4 節の定義語（`assert`、`rename`、`reparent`、`bind`、`delete`、`set-attribute`、`unset-attribute`、`set-type`、`clone`、`view`、`load`、`export`、`history`）と、Glossary の `scopen` / `unscopen` に収まっている。

2 つの草案の未決事項（PR14 の 15 問、PR15 の 20 問）を重複なくまとめると、次のとおり。括弧内は各草案の未決事項の番号。

- IS133：定義語がない。
  - 確定の通し番号、record 単位の変更、所属が解決しない付随レコード、型定義外の field を保持する欄（PR14 の 1）
  - Command intent のない操作（PR14 の 10、PR15 の 3・6）。選択した node 群の上に親を挿入する、同名の子へ合流させながら追加する、部分木を差し替える、map 全体を置換・復元する、外部の canonical source から作り直す、map 行の作成・複製・削除・属性変更、canonical owner の宣言と解除、GraphLink の端点の付け替え、linear-text の更新と削除、Layout と Surface View の設定の保存、注釈の追加と削除、競合時に相手側を採る、取り込んだ内容から新しい map を作る。
  - collapse は `view` に分類されているのに保存されている。
- IS134：何を正本 data とし、何を導出値または表示状態とするか。対象は scopes と surfaces の記録、Layout・Surface View・collapse・linear-text の表示設定、保持された scope の label、top-level に混入した `selectedId` / `scopeId`、map 行の属性の変更を journal に通すか（PR14 の 5・6・8、PR15 の 1・2・20）。
- IS135：親子 edge の label（研究 map の node の 78%）を edge のレコードに置くか、attribute に置くか。reparent したときの扱い（PR14 の 2、PR15 の 4）。
- IS136：attribute を独立したレコードにするか、node のレコードに含めるか（PR14 の 3）。
- IS137：移行時の孤立データと型定義外の値。所属が解決しない linear-text（63 key、868 KB）、folder でない node を指す linear-text、孤立した surface、型定義外の key、`nodeType: "leaf"`（PR14 の 4・5・7、PR15 の 9・10）。
- IS138：ID の一意性の範囲（map 内か workspace 内か）。実データでは map ID 3 件、node ID 1,148 件、GraphLink ID 74 件が、map や workspace をまたいで重複している。Rapid の SourceId、本文を含む node ID の扱い（PR14 の 12・15、PR15 の 11）。
  - PR17 の実データでは、map ID・node ID・GraphLink ID が複写で引き継がれ、workspace をまたいで重複している。map をまたぐ alias は表現できず、map をまたぐ構造化された関係は 0 件だった。ID の一意性の範囲は後から変えると移行になるので、DC39 と一緒に決める必要がある。
- IS139：delete と同時編集の規則。delete で linear-text・注釈・配置値を同じ transaction に含めるか（PR15 の 5・8・9）。
- IS140：冪等キーを node の attribute（Flash の重複防止キー）から commandId に移すか。MCP で応答を失ったときに、確定したかをどこで確かめるか（PR15 の 7）。
- IS141：linear-text を差分で journal に記録するか。1 値の最大は 848 KB ある（PR14 の 11）。
- IS142：複数 PC。journal を map ごとに持つか workspace ごとに持つか、端末ごとの採番、Syncthing による `data.sqlite` 全体の同期をやめるか、端末ごとに違う値（Vault のパスなど）の置き場所、cloud sync を移行範囲に含めるか（PR14 の 13、PR15 の 19。IS128 と関連）。
- IS143：移行後に古い版を締め出す。古い実装は `maps` 表が見つからないと空の表を作り、`launch.sh` は DB がなければ seed を複写する。そのため、同期された PC で古い版が動くと、正本が二重にできる（PR14 の 14、PR15 の 15）。
- IS144：未実装の Schema v2（Model_State_And_Schema_V2.md）を、この移行で置き換えるか。RQ19 のもとでは、後でもう一度変える機会がない（PR14 の 9）。
- IS145：Concreteness Axis の level ごとの編集を Command にするか（PR15 の 13）。
- IS146：collab の経路、使われていない REST の経路、UI からの取り込みをどうするか（PR15 の 16・17・18）。
- IS147：エンジンを問わず、再帰や可変長の問い合わせには、実行計画を固定する試験が要る。
  - PR16 で、SQLite の再帰 CTE は結合の順序を固定しないと、16,400 node の部分木の読取りに約 9 秒かかった。
  - Neo4j の可変長の pattern は、始点を固定しないと全 node から展開して 2.6 秒かかった。
- IS148：計画の map の `m3e:stable-id` 付き 20 node と `planning-ref` の GraphLink 32 本は、`docs/semantic` の entity と REFS の関係と同じ内容である。同じ関係が Final の map、Beta の複写、`docs/semantic` の 3 か所に別々に保存されていて、つなぐ鍵は命名規約だけである（PR17）。ADR 008 の「canonical owner は一つ」に反するので、移行でどれを正本にするかを決める。
- 外部の変更を取り込んだ後の Undo の範囲（PR15 の 14）は IS127 に含める。起動時の書き直しをやめること（PR15 の 12）は IS132 に含める。

PR15 は、IS116〜IS132 にない「成功扱いで編集が消える」危険を 19 件挙げた（[draft-write-path-commands.md](./draft-write-path-commands.md) 5.5 節）。主なものは次のとおり。

- 応答と通知の savedAt が、DB に保存した値と違う経路が 8 本ある。
- Undo と Redo が、外部の変更を取り込む前の全状態に戻す。
- linear-text の Apply が、children を位置で対応させる。
- Vault の live 連携で、Obsidian 側の変更を捨てる。
- GraphLink の REST 追加が、再送で重複する。
- 閲覧しているだけの tab が、全 node 分の配置値を書く。

PR18：保存形式を変えずに、移行より先に直せる不具合。どちらも DC39 と DC40 の結果に関係なく必要で、移行前のデータの汚れを減らす。

- 起動時の全置換（IS132）
- 閲覧しているだけの tab が全 node 分の空の配置値を書くこと。実データでは合計 5.3 MB ある。

→ 2026-10-25 に akaghef の指示で直した。dev-beta `4861dac`。CI の Build & Test と Personal Path Check はどちらも success。通常 Beta はこの SHA から build して再起動した。

- 起動処理の `ensureMap` は、既存の map に何もしない。初回の生成と旧 ID からの移行だけを行う（Data_Runtime_Layout の初期生成ポリシー）。
- 保存前の同期処理は、中身のある配置値だけを書く。基準は読込み時の `sanitizeSurfaceNodeViews` と同じ。
- 回帰試験は `beta/tests/unit/startup_ensure_map.test.js` と `beta/tests/unit/surface_node_views_sync.test.ts`。どちらも、修正前のコードで失敗することを確かめた。
- 稼働中のデータの複製で、修正前と修正後を比べた。
  - 起動時に書き直された map：修正前は開発と研究、修正後はなし。
  - 研究 map を 1 件編集して保存した後の配置値：修正前は 20,151 件（すべて空）。修正後は 0 件で、保存済みだった空の 3,751 件も消えた。
- 通常 Beta の再起動の前後で、開発 map と研究 map の `saved_at` は変わらなかった。
- 稼働中の workspace には、空の配置値が 178,413 件残っている（全 179,524 件中）。各 map を次に保存したときに消える。
- 最初の push では、pre-push の preflight の test が 1 回 FAIL した。再実行では全件 PASS し、どの試験だったかはログが残らず特定できなかった。負荷で揺れる試験がある可能性がある。

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
- IS132：サーバーは起動のたびに、開発 map と研究 map を内容を変えないまま全置換し、`saved_at` だけを進める（2026-10-23 02:33 と 2026-10-24 21:25 の起動で確認。内容の差はない）。その結果、起動前から開いているタブの基準時刻がずれ、次の保存は競合マージに入る。そこでは nodes 以外の変更が落ちる（IS117）。原因は、起動時に既存の map にも `renameMap` を呼んでいたこと。研究 map の ID は固定値として埋め込まれている。PR18 で直した（`4861dac`）。Final の実装（final/src）には同じ処理が残っていて、Channel_Release_Policy に従った Final の更新で直る。

## Constraints

- A-sys の上位境界と ADR 008 の Constraints を優先する（同じ concern の write authority は一箇所、Neo4j の物理 store を Git 管理しない、など）。
- 自前の実装より既存ライブラリを優先する（better-sqlite3、neo4j-driver、fractional index 系、idb / Dexie）。
- 試験では個人の workspace を使わない。Beta から Final への反映は Channel_Release_Policy に従う。
- data migration は workspace ごとに一度だけ（RQ19）。
