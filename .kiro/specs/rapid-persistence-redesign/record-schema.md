# レコードのスキーマ（第 2 段の設計）

2026-11-19 更新（初版 2026-11-16）。状態: 設計中。2026-11-19 の freeze v1（format 2）で確定したものは、2 節の末尾にまとめた。brief の決定（Neo4j を到達形とする、data migration は workspace ごとに一度だけ）の対象になる形を定める。

- 用語は [Glossary](../../../docs/00_Home/Glossary.md) に従う。
- 本書の ID（DA は決定、IB は未決の論点、FA は確かめた事実）は、本書を書いた会話の中の住所である。他の文書の番号とは連番にしていない。初版の IA・PA の番号は、この版で DA・IB に置き換えた。
- [draft-record-model.md](./draft-record-model.md)（2026-10-25 の草案）と [brief.md](./brief.md) を土台にし、食い違う場合は本書が優先する（兄弟順キーを作る側、通し番号の範囲、確定の境界）。
- 件数は、断りがなければ 2026-11-16 の退避コピー（3 workspace、69 map、2,126 scope、50,706 node）を読み取り専用で数えた値。
- 2026-11-17 に、外部の model（GPT-6 Pro）へ設計の批判的なレビューを依頼した。その指摘のうち採ったものは本文に入れ、根拠を「レビュー」と記した。

## 1. 整理の軸

「migration が要る」と言われてきたものは三種類に分かれる。

| 種類 | 例 | 扱い |
|---|---|---|
| 形と識別を変える | レコードの種別、key、ID | 一度きりの migration に載せる |
| 値を書き換えるだけ | 旧い語彙の値、文字列に詰めた設定、役割の設定 | migration では一字も変えずに運び、後で Command で直す。journal に残る |
| コードの名前だけ | `RapidMvpModel`、`docId` | データに触れない。いつでもできる |

本書が決めるのは一つ目だけ。Neo4j 上の持ち方（6 節）は、レコードの形と識別を保って変更する。

## 2. 決定（akaghef）

### 形

- **DA1 edge と relationType**: 線の総称 edge をレコードの種別にする。parent edge と relation edge はその部分集合。`relationType` は edge に置き、parent edge も持つ。表示する文字列は `label` で、`relationType` とは別の欄にする。
  - Glossary は edge を線の総称として定義し、`relationType` は parent edge と relation edge の双方が持つ関係種別とする。
- **DA6 正本の木と alias**: 正本の配置は木とする。どの node も親はちょうど一つ（root を除く）で、権限、削除の範囲、既定の並び順はこの木で決まる。scope への所属は、木と、parent edge が持つ scope の ID で決まる（DA59 で改めた。初版は「この木だけで決まる」）。別の場所から使うときは alias を置く。alias は参照先の所属を変えない。木以外のトポロジーは、この木に alias と、役割つきの relation edge を重ねたものとして読む。
  - 帰結: parent edge も relation edge も自分の ID を持つ。
  - 使い分け: その場所に子として並べたいなら alias、関係があることだけ示すなら relation edge。
- **DA21 edge は端点になれる**: edge は、他の edge の端点になれる。parent edge と relation edge の双方を、線そのものについて述べる対象として参照できる。
- **DA7 nodeType と details**: `nodeType` をスキーマの分岐にする。node のレコードは全種別で同じ最小の形にし、種別ごとの内容は details のレコードに置く。map の表示に要るのは node と edge だけで、details は必要になったときに読む。種別を後から足すのは、details の形の定義を足すだけで、既存のデータを変換しない。
- **DA5 Surface View の旧い語彙**: 旧い語彙（`scatter`・`mindmap`・`logic-chart`・`timeline`）は、migration では書き換えずに運ぶ。対応が決まった時点で Command で直す。

### scope

- **DA4 scope のレコード**: scope の境界は、scope のレコードがあることで表す。scopen は scope のレコードを作ること、unscopen は消すこと。node の種別は変わらない。`nodeType` から `folder` をなくし、scope の意味の「folder」を保存データ・コード・文書から払拭する（ファイルシステムのフォルダの意味は対象外）。
- **DA16 scope は自分の ID を持つ**: scope の key は root の node の ID ではなく、scope 自身の ID とする。root は scope のレコードの欄になる。権限・linear-text・Surface View の保存設定は、scope の寿命に従う。unscopen してからもう一度 scopen すると、別の scope になる（レビュー）。
- **DA17 root の所属**: scope の root の node は、自分の scope の頂点として現れる。ふつうに属するのは親から来る parent edge が載る scope で、そこでは root である scope すべてへの入口になる（DA59・DA60 で読み替えた）。
- **DA26 scope の名前**: scope の名前は、scope のレコードの欄 `label` に持てる。欄が無ければ root の node のラベルを名前とする（DA61 で改めた。初版は「常に root のラベル、欄を持たない」）。migration では、保存されている scope の `label` は運ばない（今の表示は root のラベルなので、運ぶと名前が変わる）。
- **DA8 scope の大きさの目安**: 30 node 以下を基本とし、それが多数つながって全体を成す形を目指す。画面に収まって効率がよいのは 200 node まで。1,000 node を超えると可視性がほぼ無い。超えた scope は通知するだけで、書き込みは拒まない。

### scope は面（2026-11-17、akaghef）

scope は、複雑な対象を一枚の面で切り出したものと読む。木の部分木を囲う境界という初版の読みは、その特殊な場合（scope の root の子が全部その scope に載る場合）になる。

例: scope C_p と C_c があり、node X が両方に現れる。X の子のうち Y_p は C_p に、Y_c は C_c に載る。C_p に居るときは X > Y_p が見え、C_c に居るときは X > Y_c が見える。

- **DA59 parent edge は scope の ID を持つ**: parent edge は、自分が載る scope の ID を必ず持つ。どの面に載るかは他から導く値ではなく一次の事実で、親が誰かとは別の事実である。
  - scope を描くときは、その scope の ID を持つ parent edge を引き、両端の node を集める。木をたどらない。
  - node がふつうに属する scope は、親から来る parent edge の scope。map の root は root の scope に属する。
  - 子孫も、それぞれの parent edge の scope に従う。Y_p の下は C_p に、Y_c の下は C_c に載る（別の scope の ID を持つ parent edge で、さらに別の面へ移ることはある）。
  - 書き込みの量: scopen・unscopen・面をまたぐ移動で書き換わるのは、元の面に載っている parent edge だけで、その下にある別の面の parent edge は変わらない。2026-11-17 の写し（1,877 scope）で、1 つの面に載る parent edge は中央値 10、99 パーセンタイル 212、最大 1,141。部分木全体（最大 20,149）にはならない。
- **DA60 一つの node から複数の面を開ける**: 一つの node が、複数の scope の root になれる（同じ対象を別の切り口で見せる）。初版の不変条件「一つの node が root になる scope は一つまで」は撤廃した。
- **DA61 scope の名前**: DA26 を参照。同じ node から開いた面どうしを区別するために使う。
- **DA62 relation edge は scope の ID を持たない**: 両端が同じ面にある relation edge はその面に載る。両端の面が違う relation edge はどちらの面にも載らず、両端が見えている面でだけ描く。どれも両端から導く。

担当の判断（2026-11-17。上の決定の帰結として決めた。承認時に見直せる）:

- **DA56 子を足す先**: X に子を足すと、足した agent が居る scope の子になる。C_p に居れば C_p に、C_c に居れば C_c に載る。
- **DA57 兄弟順**: X の子は、どの面に載るかによらず、1 本の兄弟順キーを共有する。unscopen すると、一列に並んだ普通の子に戻る。
- **DA58 unscopen**: scope C を消すと、C の ID を持つ parent edge は、C の root の親から来る parent edge の scope に付け替える。DA47 の消すもの（linear-text と Surface View の保存設定）と同じ確定で行う。
- **DA63 scope は自分の ID で指す**: URL、Command、内部の参照は、scope を root の node の ID ではなく scope の ID で指す。root が同じ scope が複数あると、node の ID では区別できない。
- **DA64 scopen の既定**: scopen は新しい scope を作り、X の子のうち X がふつうに属する面に載っている parent edge（とその下の、同じ面に載る parent edge）を新しい scope へ付け替える。今までの scopen と同じ結果になる。付け替える子を選んで渡すこともできる。X がすでに別の面の root でも同じ規則で作る。
- **DA65 面をまたぐ移動は移動の一種**（akaghef、2026-11-17「移動の一種でよい」）: X の子を X の scope の内と外（X がふつうに属する面）の間で付け替えるのは、親を変えない移動として扱う。書き換わるのはその子の parent edge の scope だけ。

アプリ側の第 1 段（2026-11-17。一つの node から開ける面は一つのまま）:

- 現行の木の状態では、parent edge の scope を node の欄 `edgeOutsideScope: true`（親は scope の root で、parent edge は親がふつうに属する面に載る）で表す。親の scope の root の ID を持たせないのは、祖先を scopen・unscopen すると古くなるため。store へは変換時に parent edge の `scopeId` に直す（`beta/src/shared/scope_plane.ts`）。
- viewer: scope X に居ないとき、X の外に置いた子は X の横に見え、X に入ると見えない。X に居ないときに X へ足した子は X の外に置く（DA56）。Shift+F で選んだ子を X の内と外の間で移す（DA65）。unscopen で印を消す（DA58）。
- MCP: `move` の `outside_scope: true` で X の外へ置く。**DA56 からの逸脱**: MCP の create は居る scope を知らないので、既定で X の内に置く。外に置くときは作ってから `move` する。
- 一つの node から複数の面を開くこと（DA60）、scope の ID での指し方（DA63）、入口の見せ方（IB66）は第 2 段。部分的にしか子を読まない scope の表示（scope view）では、その親の parent edge の書き換えを断る。

### rev と時刻と発行者

- **DA2 時刻を持たない**: node に作成時刻・更新時刻を持たせない。持つのは `rev`（そのレコードを最後に変えた確定の通し番号）だけ。時刻と発行者は「確定の表」（通し番号 → 確定時刻・発行者。確定 1 回につき 1 行）から引く。journal の保持対象外の確定記録を削減してもこの表は残す。
  - 理由: 数学の map は 100 万 node 規模を見込む。全 node に時刻を持たせると、ほぼ誰も読まない値が node の数だけ増える。
  - 手放すもの: 「いつ作ったか」は、journal の保持範囲より前は引けない（DA13）。
- **DA29 rev の粒度**: node のラベルと attribute は、node 単位の一つの `rev` で管理する。attribute ごとには分けない。edge と details は独立したレコードで、それぞれ `rev` を持つ。
- **DA13 作成者を別に持たない**: 「誰が作ったか」を node に持たせない。最後に変えた確定の発行者だけが引ける。
- **DA14 発行者は必須**: 確定には必ず発行者を記録する。発行者は、サーバが認証済みの接続から決める。画面や AI agent の自己申告は使わない。
- **DA25 アカウント**: 認証の単位をアカウントと呼ぶ（アカウントに当たる）。発行者はアカウントである。
- **DA15 既にある ID を使う**: アカウントの識別には、既にある外部の ID（Discord の ID など）を使う。発行者の識別に node の ID は使わない（DA14 の初版の後半を改めた）。
- **DA33 アカウントと Actor Instance**: AI agent では Actor Instance 一つがアカウント一つ、human ではその人一人がアカウント一つである。Actor Instance は登録のときに鍵を受け取り、それで認証する。session の ID は、確定の表に任意で残す。
- **DA34 権限は Role に与える**: 権限はアカウントに直接与えず、Role に与える。Actor Instance が生まれる前に設定できる。Team は M3E の語にしない。
- **DA36 agent の node の実体は一つ**: agent の一覧の map がある場合、agent の node の実体はそこに一つだけ置く。ほかの scope に現れる姿は、その実体を指す alias とする（DA6 を agent にも当てる）。初版の「互いに独立した実体」（DA35）を改めた。
- **DA37 アカウントは map の外で管理する**: アカウントにかかわること（認証の鍵、外部の ID、担う Role）は、map ではなく専用の画面と機構で管理する。map の node が無くてもアカウントは存在する。map 上の Role への alias は表示である。
- **DA38 語は「アカウント」**: 認証の単位を「アカウント」と呼ぶ。「アカウント」は使わない。
  - Glossary への追加が要る: アカウント。Role と Actor Instance は用語の文書（`.kiro/steering/agent_orrery_terminology.md`）から Glossary へ上げる。

### 欄の省略

- **DA3 既定値を保存しない**: node の決まった欄（`nodeType`、`collapsed`）は、既定値と同じなら保存しない。欄が無ければ既定値として読む。既定値は凍結する。
- **DA12 null は保存しない**: 値が null の attribute は、欄が無いものとして扱う（1,022 件）。Neo4j は null を property として持てない。
- **DA19 空文字の attribute は残す**: 値が空文字の attribute（327 件。`modifier` 119 件など）は、値として残す。省略は、その欄で意味が永久に同じと決めた値だけに限る（レビュー）。
- **DA18 collapsed**: 当面 node に保存する。agent ごとの表示状態へ移すのは、後からできる。

### relationType

- **DA22 名前が識別子**: `relationType` の値は `x:y` の形の名前とする（例: `rdfs:subClassOf`）。この名前が識別子で、変えない。
- **DA28 名前には必ず接頭辞を付ける**（akaghef、2026-11-18。初版の「接頭辞の無い名前も保存してよい」を改めた）: relationType の名前、拡張の定義の名前、attribute の key は、すべて接頭辞を付ける。M3E の組み込みは `m3e:`、定義を用意せずにその場で作る名前は必ず `misc:`。接頭辞の無い名前が乱雑に増えるのを防ぐため。移行で運んだ接頭辞の無い名前はそのまま残し、新しく作ることだけを禁じる。最初の定義は `m3e:consist-of` と `m3e:detail` になる（DA53 を読み替える）。
- **DA23 表示ラベルは定義に置く**: 表示ラベルと説明は、relationType の定義のレコードに置く。表示を変えるときは、定義の 1 件だけを書き換える。
- **DA24 線の表示**: edge の `label` が無いときは、relationType の定義の表示ラベルを表示する。それも無ければ、何も表示しない。

### 実行時

- **DA30 正本と実用の構造を分ける**: 親子関係と兄弟順は parent edge と兄弟順キーで保存する。利用のたびに走査・取得・整列することはせず、scope ごとの整列済みの木をキャッシュする。
- **DA31 scope に居る間は一つの木だけを編集する**: agent が scope に居る間（その scope を見ている間）、その木をメモリ上で直接編集する。編集中の木とは別にキャッシュを持って二重に更新することはしない。
- **DA32 再訪時はキャッシュを使う**: 有効なキャッシュがある scope へ戻ったときは、その木を再利用する。正本への保存は、scope の退出を待たずに行う。
- **DA9 変更の通知は軽くする**: 通常は「どの scope か、通し番号、変わった node の ID の一覧」だけを、その scope に居る agent に送る。受けた側が、自分が編集している node やその祖先に関係するかを判定し、関係するときだけ詳細を取る（例: 編集中の node の親が消された）。
- **DA20 alias の参照先の変更**: alias の参照先のラベルが変わったら、alias がある scope にも通知する。
- **DA10 居ることは保存しない**: 「どの agent がどの scope に居るか」は、サーバのメモリだけに持つ。map 上の agent の node は、通常の node として保存する。
- **DA11 複数の scope に居てよい**: 一つの agent が、同時に複数の scope に居てよい。
- **DA27 兄弟順キーを作る側**: 兄弟順キーは、手元の端末も作ってよい。二つの端末が同じ隙間に入れたときは、キーと `connectionId` の組で順を決める。二人が入れた列が交互に混ざることがある。brief の「確定する側だけが作る」を上書きする。

「居る」は agent（AI agent と human）が scope を見ていることを指す。node は scope に「属する」。

### 担当の決め打ち（2026-11-17。akaghef の指示「ある程度決め打ちの仕様で進めて検証まで」による。個別の承認は未了）

どれも推奨として示していた案である。承認時に見直せるよう、ここにまとめる。移行を実行する前に akaghef が確認する。

- **DA39 note と link**（IB1）: `note` と `link` は details に入れる。node のレコードは ID・型・ラベル・`collapsed`・attribute だけになる。
- **DA40 型定義に無い欄**（IB2）: 仕様が保存を禁じた `scopeId`、表示状態の混入（`selectedId`）、行の保存時刻の写し、参照先と全件同値の `aliasOf` は捨てる。それ以外は、レコードの「型定義に無い欄」の置き場（`extra`）にそのまま残す。`nodeType: "leaf"` は `text` に寄せる。
- **DA41 HTML を載せる型**（IB3）: 型は立てる。中身は登録済みの component の種類と設定だけで、生の HTML は載せない。migration では該当データが無いので、何も作らない。
- **DA42 agent の状態と伝言**（IB4）: details に保存しない。サーバのメモリに持つ。migration では、現行の attribute `m3e:agent` を一字も変えずに運ぶ（1 節の原則）。
- **DA43 surfaceId**（IB8）: 種別を含まない ID に振り直す。旧 ID との対応表を残す。
- **DA44 relation edge の port**（IB9）: 値が無いことを自動とする。`auto` という値は保存しない。
- **DA45 ID を振り直す範囲**（IB10）: 重複しているものと本文を含む ID だけを振り直し、旧 ID と新 ID の対応表を migration の成果物として残す。対応表の key は（workspace, map, 種別, 旧 ID）とする。
- **DA46 migration の対象**（IB11）: この Mac の 3 workspace。Final と cloud 上の複製は対象外。
- **DA47 unscopen**（IB19）: scope のレコードと一緒に、その linear-text と Surface View の保存設定を同じ確定で消す。Undo（逆向きの Command）で戻せる。
- **DA48 アカウントの欄**（IB44）: ID、種別（AI agent / human）、表示名、外部の ID の一覧、担う Role の一覧。migration では、発行者が記録されていない過去の分を表す「移行」というアカウントを一つ作る。
- **DA49 定義の無い relationType**（IB47）: 書ける。定義の無い名前の一覧は引けるようにする。
- **DA50 map をまたぐ alias**（IB48）: 形の上では認める（参照先は workspace で一意な ID）。参照先が無い alias は、壊れた alias として残し、確定時の検査は「新しく作る・付け替える alias」にだけ掛ける。
- **DA51 代理**（IB36）: 記録しない。必要になったら確定の表に欄を足す（欄の追加は migration にならない）。
- **DA52 権限**（IB37）: 今回の形には入れない。scope のレコードに後から欄を足す。
- **DA53 最初の relationType の定義**（IB24）: `consist-of`、`detail`、`rdfs:subClassOf`、`rdf:type` の四つと、接頭辞 `rdf`・`rdfs` の対応を入れる。既存の edge には付けない。

### freeze v1（2026-11-19、akaghef「全部推奨で」）

on-disk format に効くものを確定し、format 2 とした。仕様の本文は [DB 仕様書](../../../docs/03_Spec/Database_Spec.md)、根拠の原稿は物理量と拡張の土台の session の freeze v1 原稿である。

- Neo4j が durability authority（永続する現在状態）と semantic authority（invariant の検査と query）を担い、map の表示も Neo4j の問い合わせから出す。journal は Neo4j の `Commit` node に置く端末と remote の交換記録である。端末は remote から clone して復旧し、remote は定期 export で保全する。[ADR 014](../../../docs/09_Decisions/ADR_014_Journal_Canonical_And_Neo4j_Engine.md) に従う。
- journal は workspace に一本で、remote の sequencer が `seq` を振る。未確定の Command は端末ごとの outbox に積む。
- journal の envelope に `touched`（実差分の出たレコードと event kind）と `provenance` を足す。HLC と base revision は持たない。`seq`・`committedAt`・`issuer`・`touched` は、どの format でも意味を変えない。
- schemaVersion は Neo4j の `Head.format` に持ち、clone / export の header にも渡す。journal の各確定には持たない。format の切り替え点の seq を保持し、そこより前の journal の upcasting はしない。
- journal の保持対象外の確定記録は、Neo4j の現在状態、再送結果、名前付き snapshot、定期 export の保全を検証して削減する。snapshot は Neo4j の状態であり、別の snapshot ファイルと journal の archive は置かない。減衰する量の累積 `{v[k], t}` と来歴は Neo4j の record に持つ。
- 兄弟順は fractional indexing で、同じ親の下で `ord` は一意。同時の move は `seq` の順の LWW、cycle を作る move は拒否、interleaving を防ぐ。
- 拡張: `extensionDef` のレコード（`name` と `version` が key）、node と edge の `extensions`（`name@version` の集合）、重ねられる、外しても値を残す、agent も定義できる、意味上の分類も拡張にする。parent edge に `relationType`・`attributes`・`extensions` の欄を足す。描画の宣言を定義に持たせる。
- 拡張の欄の型の語彙は `string`・`int`・`float`・`bool`・`enum`・`time`・`timeExp`・`nodeRef`・`accountRef`・`list<T>`。canonical な時刻は ISO 8601 の UTC 文字列（ミリ秒、末尾 `Z`）で、cache と Neo4j は epoch ミリ秒の整数も持つ。

## 3. 確定の仕組み（担当の判断。レビューを受けて初版を直した）

akaghef の個別の承認はまだ受けていない。

- **確定の境界**: 1 Command を 1 回の Neo4j の write transaction で確定する。Neo4j から読んだ状態で検査し、record の変更・`Commit`・`CommandResult`・`Head.seq` を同じ transaction で書く。確定後に応答する。非同期の適用や、確定済み・未反映という状態は無い。
- **直列化**: workspace ごとに、検査の開始から確定までを 1 件ずつ順に処理する。同時に処理すると、「A を B の子に」と「B を A の子に」がどちらも変更前の木で検査を通り、循環ができる。
- **通し番号は workspace で一本**: 初版は map ごとだった。node を別の map へ移すと、その `rev` が別の map の別の確定を指してしまう。確定する側は workspace ごとに一つなので、一本にできる。
- **再送**: 同じ ID の再送には最初の結果を返す。同じ ID で中身が違う依頼は拒否する。依頼には「どの通し番号を基準にしたか」を載せ、journal の保持範囲より古い基準の依頼は、取り直しをさせてから受ける（消した node が再送で復活するのを防ぐ）。
- **適用した番号と受け取った番号を分ける**: 通知を受けただけで中身を取っていない部分は、「古い」と印を付けて持つ。キャッシュの番号を進めるのは、実際に適用したところまで。
- **大きな操作**: 100 万 node の取り込みは、どの scope からもたどれない部分木として複数の Command に分ける。各 Command は 1 回の Neo4j の write transaction で確定し、最後の Command が root を親につないで公開する（DB 仕様書 14 節）。
- **変えた欄だけを当てる**: 検査を通した後、依頼の変更後のレコードを丸ごと書かず、変えた欄だけを現在のレコードに当てる（第 1 段で実装済み）。欄の削除は「変更前にあって変更後に無い」で表す（同）。

## 4. レコードの種別

database の物理表現から独立した論理の形。移行入力・export・clone payload の直列化では、この単位で 1 行になる。snapshot はある seq の時点の Neo4j の状態である。

| 種別 | key | field | 現行での置き場 |
|---|---|---|---|
| map | `mapId` | `rootNodeId`、tag・archive・pin、Vault との結び付き、linear-text の表示設定 | `maps` の行と top-level |
| node | `nodeId` | `nodeType`（既定 `text`）、`text`（map に載るラベル）、`collapsed`（既定 false）、attribute、`rev` | `nodes[*]` |
| details | `nodeId` | 種別ごとの形（5 節）、形の版の番号、`rev` | `nodes[*].details` ほか |
| edge | `connectionId` | `kind`（`edge` は parent edge、`GraphLink` は relation edge）、`source`、`target`、`relationType`、`label`、attribute、`rev`。parent edge は兄弟順キーと、載る scope の ID（DA59）。relation edge は向き・線種・色・port | `parentId` と `children[]`、`m3e:edge-label`、`links[*]` |
| scope | `scopeId` | `rootNodeId`、`label`（任意。DA61）、`primarySurfaceId`、`rev`。権限の置き場（将来） | `nodeType: "folder"` と `scopes[*]` |
| linear-text | `scopeId` | `text`、`rev` | `linearNotesByScope` |
| Surface View の保存設定 | `surfaceId` | 所属 scope、種別、Layout、向きと間隔、`rev` | `surfaces[*]` |
| 配置値 | `surfaceId`・`nodeId` | `x`、`y`、`flowCol`、`flowRow`、`shape` | `surfaces[*].nodeViews` の空でない値 |
| 注釈 | `annotationId` | 種別（pen / text）、scope、形状、色、太さ | `annotations` |
| relationType の定義 | 名前（DA22） | 表示ラベル、説明、読む向き（親 → 子か、子 → 親か） | 無し（新設） |
| 接頭辞の対応 | 接頭辞 | 指す URI | 無し（新設） |
| アカウント | アカウントの ID | 外部の ID、表示名ほか（IB44） | 無し（新設） |
| 確定の表 | 通し番号 | 確定時刻、発行者（アカウント）、session の ID（任意） | 第 1 段の `command_log` の一部 |

- attribute は、持ち主（node または edge）のレコードの一部で、独立した `rev` を持たない（DA29）。snapshot と Command では 1 件ずつ扱う。
- relationType の定義に「読む向き」が要る理由: parent edge は親から子へ向くが、`rdfs:subClassOf` は子から親へ読み、`consist-of` は親から子へ読む。この欄が無いと、RDF へ書き出すときに主語と目的語が逆になる。
- 接頭辞の対応があれば、snapshot を Turtle として書き出せる。

### 親子の表し方

`children[]` は保存しない。親子関係は parent edge が持つ。

```
edge  kind `edge`（parent edge）   親 root → 子 a   兄弟順キー "a0"
edge  kind `edge`（parent edge）   親 root → 子 b   兄弟順キー "a1"
```

- ある node の子: `source` がその node の parent edge を集め、兄弟順キーで並べる。
- ある node の親: `target` がその node の parent edge（ちょうど 1 本）。
- 兄弟順キーは並べるためだけの値で、文字列として比べる。間に入れるときは前後のキーの間のキーを作り、他の兄弟のキーは変えない（fractional index）。
- メモリ上の木は、子の並び（配列）を持ってよい。正本はキー、実行時は配列、という分担になる。

### 保存しないもの

- 導出値: `children[]`、node と relation edge の scope への所属（parent edge の scope から導く）、`rootNodeIds`、`relationIds`、`label` が無い scope の名前（DA26）
- 表示状態: 選択、camera、編集中の状態、どの agent がどの scope に居るか（DA10）
- 既定値と同じ決まった欄（DA3）、null の attribute（DA12）
- 作成時刻・更新時刻・作成者（DA2、DA13）
- 空の配置値、root の無い scope とその Surface View

### 不変条件（確定時に検査する）

- root 以外の node は、入ってくる parent edge をちょうど 1 本持つ。root は持たない。parent edge は循環しない。
- 同じ親の下で（兄弟順キー, `connectionId`）が全順序になる。
- alias は実体の node だけを指す。alias は子を持てる（子は、その alias が載る面での子。DB 仕様書 12.2）。alias から alias は不可。
- edge の端点は実在する。端点を消したら、その edge も同じ確定で消す。
- scope の root は実在する node。alias は scope の root になれない。一つの node が複数の scope の root になってよい（DA60）。
- parent edge の scope は実在する。parent edge（親 a → 子 b、scope S）について、a が S の root であるか、a の親から来る parent edge の scope が S である。これで、一つの scope に載る parent edge は、その root を頂点とする 1 本の木になる。検査は parent edge ごとに局所で済む。
- root の scope の root は map の root で、この scope は消せない。
- `connectionId` は parent edge と relation edge をまたいで一意。edge を record の node にし、Neo4j の `(ws, rk)` の一意制約と、確定する transaction の検査で保証する（6 節）。
- 検査は触った周辺だけで行う（親の付け替えなら、新しい親の祖先をたどって循環を見る）。map 全体は走査しない。

## 5. nodeType と details

種別を新しく立てる基準: **details の形か、構造上の拘束が他と違うときだけ**。分類の違いだけなら attribute にする。

| 種別 | details に載るもの | 状態 |
|---|---|---|
| `text` | Markdown の本文 | 基本形。47,429 件（旧 `folder` 2,066 件と `leaf` 216 件を含めると 49,711 件） |
| `alias` | 無し。参照先、`aliasLabel`、`access` を持つ | 994 件。子を持てず参照先が必須。`aliasLabel` があるのは 39 件 |
| `agent` | agent の種類、icon、model、役割。指すアカウント | 現行は attribute `m3e:agent` に JSON を文字列で詰めている。11 件 |
| `image` | 画像への参照 | 仕様に定義があるが、データ 0 件、実装ほぼ無し。形は実装時に決める |

種別にしないもの:

- 補題・定義・定理など（attribute `kind` に 437 件）: 形は同じで分類だけが違う。Deep の entity の型になる。
- task・状態（`m3e:status` 713 件）: どの種別にも付く attribute。
- 表（tabular）: 子 node の見せ方であって内容ではない。

現行の `details` は 6,696 件にあり、1 行の平文 5,268、複数行の平文 1,110、Markdown・数式の記法あり 276、JSON らしいもの 41、HTML らしいもの 1。長さの中央値は 59 字。`text` の details を Markdown の本文とすれば、そのまま収まる。

## 6. Neo4j 上の持ち方（レコードの形と識別を保つ）

| 論理のレコード | Neo4j での持ち方 |
|---|---|
| map | node（ラベル `Map`） |
| node | node（ラベル `M3eNode`）。`id` に一意制約。`mapId` に索引 |
| details | 別の node（ラベル `Details`）。`M3eNode` から 1 本の線で結ぶ |
| parent edge | relationship（型 `EDGE`、親 → 子）。property に `id`、兄弟順キー、`scopeId`（索引）、`relationType`、`label`、`rev` |
| relation edge | relationship（型 `LINK`）。property に `id`、`relationType`、`label`、向き・線種・色・port、`rev` |
| alias の参照先 | relationship（型 `ALIAS_OF`、alias → 参照先）。参照先から alias を逆にたどれる（DA20 の通知先） |
| attribute | 持ち主の node または relationship の property。key に接頭辞を付ける |
| scope | 別の node（ラベル `Scope`）。root の `M3eNode` と 1 本の線で結ぶ |
| linear-text、Surface View の保存設定、注釈 | 別の node。scope と結ぶ |
| 配置値 | relationship（`Surface` → `M3eNode`）。property に座標 |
| 確定の表、適用済みの位置、依頼の ID の記録 | 別の node。反映と同じ transaction で書く（レビュー） |

設計上の選択:

- **親子と関係線を relationship の型で分ける。** `EDGE` だけをたどれば木になる。`relationType` は property にする。Neo4j は relationship の型を後から変えられないため。
- **attribute を別の node にしない。** 100 万 node の map で数百万の小さな node が増えるため。同じ node への同時の書き込みは、Command が運ぶ変更前の値と現在の値を field 単位で比べ、触った field が重なるときだけ拒否する（第 1 段の確定関数と同じ方式）。
- **attribute の値の型。** 文字列・数値・真偽は Neo4j の値のまま、それ以外は JSON の文字列にして別の接頭辞の property に置く。実データに 2 の 53 乗を超える整数は無い。
- **Neo4j 内部の ID は外に出さない。** 参照は必ず自前の `id` で行う。

未確認（実機 2026.10.2 で確かめる）:

- **FA51** レビューの記述: relationship の property への索引は 4.3 以降、一意制約は 5.7 以降で Community でも使える。property の存在・型の制約は Enterprise だけ。Community は利用者用の database が一つ。
- DA21 のために edge を node として持つ必要があるか（relationship は他の線の端点になれない）。全部を node にするか、端点にされたものだけにするか。
- 100 万 node の取り込みの所要時間と、`EDGE` だけをたどる読み込みの速度。
- 索引に載せる値の長さの上限（レビューの記述では範囲索引が約 8 KB、文字列索引が約 32 KB）。
- scope に属する node の集合を引く問い合わせの速度。遅ければ、所属を導出値として node に持たせる（snapshot には入れない）。

## 7. 現行からの移し方

| 現行 | 行き先 | 扱い |
|---|---|---|
| `nodes[*]` の `text`・`collapsed` | node | 移す |
| `nodes[*]` の `details` | details | 移す |
| `nodeType: "folder"` | 種別 `text` と scope のレコード。`scopeId` を新しく振る | 移す（DA4、DA16） |
| `parentId` と `children[]` | parent edge のレコード。ID を新しく振る。scope の ID は今の規則で計算して付ける: parent edge（a → b）の scope は、a 自身または a の祖先のうち最も近い scope の root が持つ scope（今は全部の子が内側に入るので、これで今の見え方と一致する） | 移す（DA59） |
| `attributes["m3e:edge-label"]`（15,971 件、32 種類の値） | parent edge の `label`。`relationType` は未設定のまま | 移す。役割の設定は後で Command |
| その他の `attributes[*]` | attribute。null は落とす（DA12）。空文字は残す（DA19） | 移す |
| alias の field | node と、参照先への線 | 移す |
| `links[*]` | relation edge のレコード | 移す |
| `linearNotesByScope` | linear-text。所属が解決しないものも残す | 移す |
| `scopes[*].primarySurfaceId` | scope | 移す |
| `surfaces[*]`、`nodeViews` の空でない値、`annotations` | それぞれのレコード | 移す |
| node ごとの「誰が作ったか」の attribute（会話の ID、model、生成時刻など） | そのまま attribute | 値は変えない。整理は後で Command |
| 既定値と同じ決まった欄、`scopes[*].label` | — | 保存しない（DA3、DA26） |
| `scopes[*].rootNodeIds`・`relationIds` | — | 導出 |
| 空の配置値、root の無い scope とその Surface View | — | 捨てる |
| Surface View の旧い語彙、scope の root に置かれた Layout の設定、装飾の旧 attribute、文字列に詰めた JSON | そのまま | 値は変えない（DA5 と 1 節） |

第 1 段の `command_log` は旧い形で書かれているので、新しいレコードには再生できない。migration の時点を通し番号 0 とし、そこから新しい journal を始める。旧い記録は保管に回す。

移行の合否:

- 旧い形 → 新しい形 → 旧い形への書き戻しが、上の表の「保存しない」「導出」「捨てる」を差し引いて元と一致する。
- 往復とは独立に、元データを別の方法で走査して対応を確かめる。往路と復路が同じ誤解をしていると、往復は一致してしまう（レビュー）。
- 端末の Neo4j を remote から clone して復旧し、remote の Neo4j を定期 export から復旧する試験を通す。
- 切替の時点で旧い側の書き込みを止める手順を定める。
- 問題が 0 件のときだけ切り替え、旧い DB は消さずに保管する。

## 8. 実データで確かめたこと

scope の大きさ（2,126 scope）:

| 指標 | node 数 |
|---|---|
| 中央値 | 11 |
| 90 パーセンタイル | 30 |
| 99 パーセンタイル | 219 |
| 最大 | 1,141 |

- 30 node 以下の scope は、scope の 90.1%、node の 49.5%。201〜1,000 node の scope が 27、1,000 超が 1。
- 一つの親の子の数の最大は 646。木の深さの最大は 18。
- alias の 52%（994 件中 514 件）と relation edge の 26%（985 件中 257 件）が、別の scope を指している。
- 一つの参照先を指す alias は最大 5 件（上限ではなく実測）。
- 例（map「codex-pn-verify-5」の scope「test1」、26 node）:
  - root のラベルは「test1」だが、scope のレコードは別のラベルを持っている（DA26 で運ばない）。
  - AI agent が作った 4 node が、それぞれ 9 個の attribute で会話の ID・model・生成時刻を持っている。新しい形では、確定の表の 1 行になる。
  - 親子（動物 → 哺乳類 → ヒト）は全部 `rdfs:subClassOf` に当たり、`consist-of` でも `detail` でもない。個体を置く場合は `rdf:type` になる。

## 9. 未決

形に入るので、migration の前に決めるもの。

- **IB1 note と link の置き場**: `note`（907 件）と `link`（355 件）を details に入れ、node のレコードを ID・種別・ラベル・`collapsed` だけにするか。推奨は入れること。
- **IB2 型定義にない field**: 推奨は、仕様が保存を禁じた `scopeId`、表示状態の混入（`selectedId`）、行の保存時刻の写し、参照先と全件同値の `aliasOf` を捨て、取り込み元の時刻・`notes`・取り込みの由来を「型定義にない field を入れる欄」に残すこと。`nodeType: "leaf"`（216 件）は `text` に寄せる。
- **IB3 HTML を載せる種別**: 仕様は「raw HTML / raw CSS は node data に保存しない」と定めている。推奨は、種別は立て、中身は登録済みの component の種類とその設定にすること。
- **IB4 agent の details に載せる実行時の値**: 状態や伝言のように頻繁に変わる値を、details に保存するか。
- **IB8 Surface View の ID**: ID に種別の名前が埋まっている（`surface:<node>:<kind>`）。推奨は、migration で種別を含まない ID に振り直すこと。
- **IB9 relation edge の port の auto**: 推奨は「値が無い＝自動」に統一すること。
- **IB10 ID を振り直す範囲**: 推奨は、重複しているものと本文を含む ID だけを振り直し、旧 ID と新 ID の対応表を migration の成果物として残すこと。
- **IB11 migration の対象範囲**: 推奨は、この Mac の 3 workspace を対象にし、Final と cloud 上の複製は対象外とすること。個人の workspace に残る試験用の map は、前もって保管に回す。
- **IB66 入口の見せ方**: X が複数の面の root のとき（DA60）、X がふつうに属する面で入口をどう見せ、どう選ばせるか。意味は「X は自分が root である面すべてへの入口を持つ」。配置は GUI の手順の 3 段目で決める。
- **IB19 scope の構造を変える操作**（DA58 で unscopen の付け替えを、DA47 で消すものを決めた）: unscopen したとき、その scope の linear-text と Surface View の保存設定を消すか、親の scope へ移すか。scopen・unscopen・scope をまたぐ移動は、変わっていない多数の node の所属を変えるので、旧い scope と新しい scope の両方のキャッシュを無効にする。scope どうしを「scope という役割の線」でつながったグラフと読む案（担当の読み。未確認）。
- **IB44 アカウントの中身**: アカウントが持つ欄。一つのアカウントに外部の ID を複数結び付けられるか。
- **IB48 map をまたぐ alias**: agent の一覧が別の map にあると、alias が map をまたいで実体を指す。参照先の map を消すときの扱いと、参照先を読む権限の扱い。
- **IB36 代理**: AI agent が human の依頼で書いたとき、依頼した側を記録するか。
- **IB37 権限の持ち方**: scope に置く権限の形。Role を単位にする（DA34）。
- **IB47 語彙に無い relationType**: 定義のレコードが無い名前を edge に書けるか（拒否するか、書かせて後で定義を足すか）。

形に入らないので、migration の後でよいもの。

- **IB24 relationType の語彙**: 最初に定義する名前と、32 種類のラベルとの対応。
- **IB25 混在を防ぐ規約**: 対象と説明の混在を防ぐ規約の強さ。新しい parent edge に役割を必須にするか。
- **IB26 detail と details**: edge の役割 `detail`、node の details、attribute `kind` の `detail`（42 件）・`subdetail`（11 件）の使い分けと名前。
- **IB28 長いラベル**: 長いラベル（200 字超 1,729 件、複数行 371 件）を details へ移す整理。
- **IB29 同じ関係の重複**: 同じ関係が Final の map、Beta の複写、`docs/semantic` の 3 か所にある件。この migration では扱わない。
- **IB35 node ごとの「誰が」の attribute の整理**: 7 節でそのまま運んだものを、確定の表へ寄せて消すか。

実行時の構造にかかわるもの。

- **IB15 キャッシュの有効性の判定**: scope ごとに「その scope に影響した最後の確定の通し番号」を持つ。journal を scope で引ける索引が要る。
- **IB16 scope をまたぐ参照**: scope の木だけを読み込むと、参照先のラベルが手元に無い。参照先の最小限の情報を一緒に取る形。通知は DA20 で決めた。
- **IB17 scope のつながりの索引**: どの scope がどの scope の中にあるかを、木を走査せずに引く。
- **IB18 編集を Command として直接出す**: 第 1 段の画面は、基準の状態の写しと現在の状態の差分から Command を作っている。これは木を二つ持つ形で、DA31 と合わない。Undo も逆向きの Command にする。
- **IB20 scope をまたぐ機能**: 検索、map 全体の node 数、linear-text の書き出し、Deep の問い合わせは、サーバへの問い合わせにする。
- **IB21 「編集中」の範囲**: DA9 で詳細を取りに行く条件（編集中の node、その祖先、ほかに何を含めるか）。
- **IB23 キャッシュの置き場と上限**: 画面のメモリだけか、端末に残すか。保持する量の上限と捨てる順序。
- **IB31 全体保存の経路**: 全体保存を使う書き込みの経路が約 60 残っている。Command の経路へ移す。
- **IB40 大きな取り込みを隠す方法**: Community は database が一つなので、別の database で作って切り替える方法が使えない。実機で測って決める。

## 10. 検証の記録（2026-11-17）

### 変換と逆変換

形式と変換規則は [snapshot-format.md](./snapshot-format.md)。実装は `beta/src/shared/record_model/`、CLI は `beta/src/node/snapshot_cli.ts`。合否の検査は実装と別に書いた（`scripts/migration/judge_snapshot.py`、`judge_restore.py`。実装した側には検査を読ませていない）。

2026-11-16 の退避コピーを複製したもの（3 workspace、69 map）に対して実行した結果:

| workspace | node | connection | scope | details | 変換の検査 | 逆変換の検査 |
|---|---|---|---|---|---|---|
| team_swingby | 3,004 | 3,055 | 68 | 775 | 問題 0 | 問題 0 |
| A98E… | 4,853 | 5,032 | 181 | 1,130 | 問題 0 | 問題 0 |
| REMH… | 42,849 | 43,535 | 1,877 | 5,477 | 問題 0 | 問題 0 |

- 変換の所要時間は、最大の workspace で 1.2 秒。
- 逆変換した 69 map は、アプリ自身の読み込みと検証（`RapidMvpModel.fromJSON` と `validate`）で誤り 0 件。
- 検査が壊れたデータを見逃さないことを、わざと壊した snapshot 21 種と、壊した逆変換の結果 19 種で確かめた。全部検出した。
- 振り直した ID は、node が約 2,000 件（別の map との重複 1,613、形の不適合 388）、relation edge が 209 件。振り直した ID を値の中に含む attribute は 0 件。
- 契約を直した点が一つある: annotation の `kind`（`pen` / `text`）がレコードの `kind` と衝突するため、`annotationKind` に改めた。実装側が見つけ、検査の最初の実行で 44 件の不一致として現れた。規則の欠陥であり、実装に合わせて基準を緩めたものではない。

### Neo4j（Community 2026.10.2、使い捨ての instance、合成データ）

二つの独立した測定（Codex の子の第 1 便と、別の担当）が一致した点:

- 線の property への一意制約・範囲索引・文字列索引は Community で作れる。property の存在・型・key の制約は Enterprise だけ。
- 型の違う線（`EDGE` と `LINK`）に別々の一意制約を作っても、同じ ID を両方に 1 回ずつ書ける。ID の無い線も作れる。
- 索引に載る値の上限は UTF-8 のバイト数で、範囲索引と一意制約が 8,164、文字列索引が 32,766。超えた書き込みは拒否される。
- null の代入は property の削除になる。型の混ざった配列、null を含む配列、入れ子は拒否される。
- 線は、他の線の端点になれない（構文の型エラー）。

規模（100 万 node と 100 万本の親子）:

| 項目 | 結果 |
|---|---|
| 分割取り込み（1 万件ずつ） | 30〜40 秒 |
| 全部を 1 回の transaction | 確定で失敗（メモリの上限）。75 万組は成功、87.5 万組は失敗（既定のメモリ設定） |
| scope に属する node を引く | 11 node で 0.01〜0.04 ms、1,141 node で 0.3〜1.1 ms（サーバ内）。1 回ずつ問い合わせると往復で 1.5〜7 ms |
| 親の付け替えの循環検査（18 段） | 0.01〜0.02 ms |
| 646 個の子を順に並べる | 0.3〜0.5 ms |
| ID の索引が無い場合 | どの問い合わせも 180〜610 ms（索引は必須） |
| 10 万 node の部分木の削除 | 1 回で 3.2〜4.6 秒、1 万件ずつで 2.2〜2.5 秒 |
| 850 KB の文字列 | 書き込み 44〜72 ms、読み出し 4〜19 ms |

edge を node として持つ形（線が線の端点になれる形）は、線として持つ形に比べて、問い合わせが 1.1〜2 倍、保存の大きさが 1.14 倍だった。どちらも実用の範囲に収まる。

- **DA54 Neo4j 上では edge を node として持つ**（担当の決め打ち）。DA21 を満たせること、ID の一意制約を一つにできること（種別をまたいだ一意が守れる）が理由。Neo4j 上の持ち方は、レコードの意味と識別を保って変更する。6 節の表は、この決定で読み替える。

### Neo4j への取り込みと読み戻し（実データの snapshot）

実装は `beta/src/node/neo4j_store/`、CLI は `beta/src/node/neo4j_store_cli.ts`。全レコードを node として持ち、edge も node にする（DA54）。値は、Neo4j がそのまま持てるものは property に、それ以外は JSON の文字列にして別の接頭辞の property に置く。

上の表の snapshot を、使い捨ての instance に取り込み、読み戻して、元のファイルと比べた結果:

| workspace | レコード | 大きさ | 取り込み | 読み戻し | 元との比較 |
|---|---|---|---|---|---|
| team_swingby | 7,513 | 1.4 MB | 5.2 秒（初回。起動直後） | 0.2 秒 | バイト単位で一致 |
| A98E… | 12,981 | 2.9 MB | 1.5 秒 | 0.2 秒 | バイト単位で一致 |
| REMH… | 100,268 | 28.1 MB | 7.0 秒 | 0.9 秒 | バイト単位で一致 |

- Neo4j から直接数えた件数（最大の workspace）: node 42,849、edge 43,535、scope 1,877。変換の検査が数えた値と一致する。親が二つある node は 0 件。
- これで、SQLite → snapshot → Neo4j → snapshot → 現行の形、の全区間で値が保たれることを、実データの複製で確かめた。
- 確かめていないこと: 取り込みの途中で失敗した場合の扱い（分割して書くので、書き込み済みの分が残る。空にしてからやり直す）。複合 key の連結が衝突する場合（実データでは起きなかった。起きれば取り込みが止まる）。子を順に並べる問い合わせは 50 ms かかった（edge の種別に索引が無いため。調整が要る）。

### 監査で見つかった、仕様に残る問題

仕様とコードの突き合わせ（二つの独立した担当）から。migration の形には影響しないが、第 2 段の実装で決める必要がある。

- **IB49 map の最終更新**: 確定の表は map を持たないので、Home の並び（現行は `maps.saved_at`）が作れない。削除は残るレコードの `rev` に現れない。確定の表に、触った map の一覧を持たせる案。
- **IB50 ID の再利用と Undo**: 「消した ID は再利用しない」と「Undo は逆向きの Command」が衝突する。第 1 段の逆変更は、同じ key で作り直している。Undo による復活だけを例外にする案。
- **IB51 Surface View の一意性**: 「scope と種別で一つ」は、現行の ID の作り方だけが保証している。ID から種別を外す（DA43）と保証が消えるので、不変条件に足す。
- **IB52 primarySurfaceId の競合**: 表示を切り替えるたびに書き換わる。二人が同じ scope に居ると、欄の競合で拒否が起きる。agent ごとの表示状態へ移す候補（DA18 の `collapsed` と同じ扱い）。
- **IB53 具体度の軸**: `concreteness_axis.ts` は、level ごとの親・順・scope 境界を attribute の値に node の ID で持つ。不変条件が届かず、ID を振り直すと壊れる。現行データには該当の attribute が 0 件なので、今回の migration では問題にならない。
- **IB54 map の複製**: `duplicateMap` は `state_json` を丸写しするので、全 ID が二つの map に重複する。現行データの重複 1,613 件はここから来ている。第 2 段では複製時に ID を振り直す。
- **IB55 全体保存に落ちる条件**: Command の経路があっても、collab が有効なとき、Vault を監視しているとき、「Use Local」、基準が無いとき、の四つで全体保存に落ちる。発行者は端末の自己申告のまま（DA14 は未実装）。
- **IB56 未確定の Command の保持**: brief の要求（再読込・通信失敗・再起動後も未確定の編集を保つ）が、移行後の仕様に書かれていない。第 1 段はメモリの変数だけで、再読込で消える。
- **IB57 確定と読み込み**: 確定は Neo4j の write transaction なので、未反映の確定は生じない。応答後の読み込みはその状態を Neo4j から返し、再送には最初の結果を返す。
- **IB58 1 回の Command の中の複数の付け替え**: 「触った周辺だけ」の検査を変更 1 件ずつに当てると、同じ Command の中の「A を B の下へ」「B を A の下へ」を見逃す。Command の全変更を当てた後の状態で検査する。
- **IB59 edge を消すときの連鎖**: edge が他の edge の端点になれるので、node を消すと、接する線、その線に接する線、と連鎖する。閉包を同じ確定で消すか、参照が残る削除を拒否するかを決める。

IB31（全体保存の経路）の件数は、実際には `saveToSqlite*` の呼び出しが 22、`state_json` を直接書く SQL が 2、`maps` の行を直接書く SQL が 9 だった。「約 60」は古い棚卸しの行数で、誤りだった。

## 11. 残る問題

- **規模。** 保存は変更分だけになったが、画面は map 全体を読み込む。scope 単位の木とキャッシュに変えるのは、画面の作り直しを伴う別の仕事になる（IB18）。
- **移行の照合。** 意図して変える点（7 節）が増えるほど、想定外の欠落を見逃す余地が増える。形の変換だけを載せる原則（1 節）を守る。
- **種別と版。** details の形を種別ごとに持つので、形の変更の規則が種別の数だけ要る。
- **識別の寿命。** アカウントを消したとき、確定の表の発行者をどう表示するか。名前を変えたとき、過去の履歴の表示も変わる（レビュー）。
- **scope の意味の「folder」の払拭。** 保存データは migration で、コードは第 2 段のモデルの書き直しで、文書は一斉置換で消す。戻らないように、push 前の検査に項目を入れる。
