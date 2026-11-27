# 保存の再設計 要件一覧（format 2）

この文書は、2026-11-27 時点の決定を、実装者と受入者が同じリストで確認するための要件だけを集めたものである。出典は `docs/03_Spec/Database_Spec.md`、`.kiro/specs/rapid-persistence-redesign/` の `sync-requirements.md`、`sync-principles.md`、`operation-algebra-requirements.md`、`record-schema.md`、`snapshot-format.md`、`quantities-requirements.md`、`implementation-log.md` の決定済み項目、`docs/09_Decisions/ADR_014_Journal_Canonical_And_Neo4j_Engine.md` である。用語は `docs/00_Home/Glossary.md` に従う。

【決定】と【仮決め】は要件である。出典が推奨を示していた未決は、その推奨で確定したものとして書く。12.5 の順序付き index、KB5、QB4 は要件にせず、14 にだけ置く。二つの出典が食い違うときは両方を書き、「食い違い」と出典を付ける。状態は、`beta/src/shared/record_model/`、`beta/src/node/record_store/`、`beta/src/node/neo4j_store/`、`beta/src/node/mcp_service.ts` を見た結果である。実装済みと一部には、そのコードのファイルと行を付ける。

## 1 保存の形とレコード

### R1.1
永続する現在状態は各端末と remote の Neo4j に置く。端末は remote の clone で復旧し、remote は database 全体の定期 export で保全する。
- 出典: ADR 014 Decision 1、Database_Spec.md 1節、neo4j-database-design.md
- 状態: 未実装（Neo4j を database にする実装中）。
- 受入: 端末の Neo4j を remote の clone から、remote の Neo4j を定期 export から戻し、内容と管理状態が一致する。

### R1.2
各端末の Neo4j が map の表示・不変条件の検査・全ての query を担う。検査と確定は同じ Neo4j の write transaction で行う。
- 出典: ADR 014 Decision 1・2、Database_Spec.md 1節・8節、neo4j-database-design.md
- 状態: 未実装（Neo4j を database にする実装中）。
- 受入: map の読取りも Command の検査も Neo4j から行われ、非同期の反映待ちは生じない。

### R1.3
journal は workspace に一本で、remote の sequencer が全順序を付ける。Neo4j の `Commit` node に保持し、端末と remote の間で確定順に交換する。
- 出典: Database_Spec.md 2節、ADR 014 Decision 4、Glossary.md journal
- 状態: 未実装（Neo4j を database にする実装中）。
- 受入: 端末を増やしても workspace の確定系列は一本で、journal のファイルを作らない。

### R1.4
remote を置くとき、workspace ごとに remote はちょうど一つであり、その sequencer が `seq` の全順序を付ける。
- 出典: ADR 014 Decision 4、Database_Spec.md 2節、sync-principles.md「remote と local」
- 状態: 一部。一つの store が一つの `seq` を進める（`store.ts:1248`、`store.ts:1332-1341`）。remote の選択と単一性を守るプロセスは、この範囲のコードには無い。
- 受入: 同じ workspace で二つの確定器が同時に `seq` を進めると、二本目は確定できない。通し番号は map ごとではなく workspace で連続する。

### R1.5
階層を示すとき、保存の入れ物は workspace、その中の知識の単位は map、面は scope、要素は node である。
- 出典: Database_Spec.md 2節、Glossary.md workspace / map / scope / node
- 状態: 実装済み（`beta/src/shared/record_model/types.ts:17-111`）
- 受入: snapshot のレコードが、この四つ以外の入れ物を親として持たない。

### R1.6
ID を発行するとき、node・edge・scope・Surface View の保存設定・注釈の ID は map と workspace をまたいで一意であり、作った後に変えず、意味を埋め込まず、消した ID は Undo 以外で再利用しない。
- 出典: ADR 014 Decision 7、Database_Spec.md 2節、record-schema.md IB50（仕様 2節が採用）
- 状態: 一部。生存中の共有 ID の重複は確定時に拒否する（`store.ts:1262-1268`）。消した ID の再利用禁止は、この検査には無い。
- 受入: 別 map の生存 ID を新しい node に使うと拒否される。削除した ID で新しい node を作ると拒否され、その削除の Undo だけが同じ ID を戻す。

### R1.7
移行で ID を振り直すとき、移行は接頭辞と `sha256("<workspace>|<map>|<種別>|<種>")` の先頭 24 桁で決定的に作り、対応を `idMap` に残す。接頭辞は node が `n_`、edge が `c_`、scope が `s_`、Surface View が `v_`、注釈が `a_` である。
- 出典: Database_Spec.md 2節、snapshot-format.md 3.1、record-schema.md DA45
- 状態: 実装済み（`beta/src/node/record_store/id_alias.ts:21-24`、`id_alias.ts:50`）
- 受入: 同じ入力を二度変換すると ID と `idMap` が一致する。

### R1.8
レコードを書くとき、種別と key の組がレコードの識別であり、移行入力・export・clone payload の 1 行が 1 レコードである。永続する状態は Neo4j に置く。
- 出典: Database_Spec.md 3節、snapshot-format.md 1節
- 状態: 実装済み（`beta/src/shared/record_model/jsonl.ts:36-43`）
- 受入: 同じ store に同じ key の record を二つ作れず、重複した key の輸送・export の行は取り込まない。

### R1.9
輸送・export の header は `kind: "snapshot"`、`format`、`workspaceId`、`seq` を持つ。snapshot は Neo4j の状態という役割であり、別の database ファイルではない。
- 出典: Database_Spec.md 3.1・7節、snapshot-format.md
- 状態: 未実装（Neo4j を database にする実装中）。
- 受入: clone / export から対象の状態と format が分かり、journal の切り替え点より前を新形式へ書き換えない。

### R1.10
レコードの種別を増やすとき、format 2 は `map`、`node`、`details`、`connection`、`scope`、`linearText`、`surface`、`nodeView`、`annotation`、`relationTypeDef`、`prefix`、`lock`、`namedSnapshot`、`grant`、`account`、`commit`、`idMap`、`extensionDef` を持つ。
- 出典: Database_Spec.md 3.1
- 状態: 一部。`lock`、`namedSnapshot`、`grant`、`extensionDef` は型に無い（`types.ts:223-238`）。それ以外の種別はある。
- 受入: 各種別が仕様の key で一意に読め、知らない種別の行を黙って落とさない。

### R1.11
node を保存するとき、node は親・子・作成時刻・更新時刻・作成者を持たず、`nodeType` と `collapsed` は既定値（`text`、false）と同じなら書かない。
- 出典: Database_Spec.md 3.2、record-schema.md DA2・DA3・DA13、snapshot-format.md 2節
- 状態: 実装済み（`types.ts:41-54`。時刻欄は型に無い）
- 受入: 既定の node の行に `nodeType` と `collapsed` が無く、読み戻すと `text` と false になる。

### R1.12
alias を保存するとき、node の欄 `alias` は `target`、`label`、`access`（read または write）、`snapshotLabel`、`broken` を持ち、参照先がちょうど一つであることは欄であることで守られる。
- 出典: Database_Spec.md 3.2・12.2、snapshot-format.md 2節
- 状態: 実装済み（`types.ts:33-39`）
- 受入: alias の行だけで参照先が分かり、同一性のための別 edge レコードは無い。

### R1.13
attribute を保存するとき、attribute は持ち主のレコードの一部で独立した `rev` を持たず、null は書かず、空文字・false・0 は残し、欄が無いことは未設定であり 0 ではない。
- 出典: Database_Spec.md 3.3、record-schema.md DA12・DA19・DA29
- 状態: 実装済み（`types.ts:50`、`jsonl.ts:31-33`）
- 受入: null の key は行に無く、空文字の key は残る。未設定の key を 0 として返さない。

### R1.14
parent edge を書くとき、`type` は `edge`、`source` と `target` は node、`ord` と `scopeId` は必須であり、format 2 では `relationType`、`attributes`、`extensions` も持つ。
- 出典: Database_Spec.md 3.4、record-schema.md DA1・DA59、freeze v1
- 状態: 一部。`ord` と `scopeId` はある（`types.ts:67-78`）。`relationType`、`attributes`、`extensions` は parent edge の型に無い。relation edge の `relationType` と `attributes` はある（`types.ts:81-97`）。
- 受入: format 2 の parent edge が三つの欄を往復し、relation edge は `ord` を持たない。

### R1.15
兄弟順キーを発行するとき、`ord` は `fractional-indexing` の base62 の key であり、code unit 順で比べ、末尾は `0` にならない。
- 出典: Database_Spec.md 3.4、operation-algebra-requirements.md 8節
- 状態: 実装済み（`beta/src/shared/record_model/order_key.ts:1-18`）
- 受入: 生成した key がこの文法を満たし、文字列比較が並びと一致する。無効な base36 の key は読み込み時に振り直される。

### R1.16
子を読むとき、読み手は `source` がその node の parent edge を `ord` で並べ、子の配列は保存しない。
- 出典: Database_Spec.md 3.4・11節、record-schema.md「親子の表し方」
- 状態: 実装済み。子配列は connection レコードに無い（`types.ts:67-78`）。
- 受入: snapshot に子の配列が無く、同じ parent edge から同じ順が再現する。

### R1.17
scope を表すとき、境界は scope のレコードがあることで表し、node の型には出さない。名前は `label` であり、無ければ root の node のラベルである。
- 出典: Database_Spec.md 3.5、record-schema.md DA4・DA16・DA26・DA61
- 状態: 実装済み（`types.ts:102-111`）
- 受入: scope の key は root の node の ID ではなく scope 自身の ID である。`label` が無い scope の表示名は root のラベルと一致する。

### R1.18
一つの node が複数の scope の root になるとき、remote はそれを許し、参照は scope の ID で行う。
- 出典: Database_Spec.md 3.5、record-schema.md DA60・DA63
- 状態: 一部。不変条件は複数 root を許す（`invariants.ts:130`）。アプリが一つの node から一つの面だけを開く制限は、Database_Spec.md 3.5 が「まだ」と書くとおり、この store の外である。
- 受入: 同じ node を root とする scope を二つ確定でき、node の ID だけではどちらを指すか決まらない。

### R1.19
relationType の名前を書くとき、名前は接頭辞付きで、一度使った名前は変えず、表示ラベル・説明・読む向きは `relationTypeDef` に置く。定義が無くても名前は書ける。
- 出典: Database_Spec.md 3.6、record-schema.md DA22・DA23・DA28・DA49
- 状態: 一部。定義レコードの型はある（`types.ts:176-183`）。定義の無い名前を store が拒否する検査は無い。新しい名前の接頭辞検査は MCP だけである（`mcp_service.ts:498-499`）。
- 受入: 定義の無い `misc:` の名前が確定し、後から定義を足せる。接頭辞の無い新しい名前は拒否される。

### R1.20
最初から入れる定義を書くとき、移行は `m3e:consist-of`、`m3e:detail`、`rdfs:subClassOf`、`rdf:type` と、接頭辞 `rdf`・`rdfs` の対応を入れ、既存の edge には付けない。
- 出典: Database_Spec.md 3.6、snapshot-format.md 3.5、record-schema.md DA53（DA28 により名前は接頭辞付き）
- 状態: 実装済み（`beta/src/shared/record_model/to_snapshot.ts` の初期レコード生成。snapshot-format 3.5 と同じ並び）
- 受入: 変換直後の snapshot にこの四定義と二接頭辞があり、既存 edge の `relationType` は変換で埋まらない。

### R1.21
アカウントを保存するとき、アカウントは map の外にあり、`accountKind` は `ai-agent`、`human`、`system` のいずれかで、権限はアカウントではなく Role に与え、AI agent は Actor Instance ごとに一つ、human はその人ごとに一つである。
- 出典: Database_Spec.md 3.7、record-schema.md DA25・DA33・DA34・DA37・DA48
- 状態: 一部。レコード型はある（`types.ts:192-200`）。Role へ権限を与える機構は、この範囲のコードには無い。
- 受入: map が無くてもアカウントの行が読め、発行者はその ID を指す。

### R1.22
名前を新しく作るとき、relationType、拡張の定義、attribute の key は接頭辞を必ず付け、その場の名前は `misc:` であり、移行で運んだ接頭辞の無い名前は残して新設だけを禁じる。
- 出典: Database_Spec.md 3.8、record-schema.md DA28
- 状態: 一部。MCP は新しい relationType と、node にまだ無い attribute の key を拒否する（`mcp_service.ts:499`、`mcp_service.ts:668`）。store の確定と viewer の入力は検査しない（Database_Spec.md 3.8 が viewer 未実施と書くのと一致）。
- 受入: MCP からの新規の無接頭辞名は拒否され、既存の無接頭辞 key の更新は通る。アプリ内の別経路から無接頭辞名を書くと、その経路も拒否する。

### R1.23
`rev` を付けるとき、`rev` はそのレコードを最後に変えた確定の `seq` であり、`commit`、`idMap`、`nodeView`、輸送・export の header は持たない。`nodeView` は属する Surface View の `rev` に従う。
- 出典: Database_Spec.md 3.1、snapshot-format.md 2節
- 状態: 実装済み（`types.ts:136`、`types.ts:202-220`。put の `rev` は確定番号 `store.ts:1232`）
- 受入: 触っていないレコードの `rev` は増えず、`nodeView` の行に `rev` が無い。

### R1.24
知らない欄を読むとき、読み手は `extra` に入った欄を捨てない。
- 出典: Database_Spec.md 3.1、record-schema.md DA40、snapshot-format.md 2節
- 状態: 実装済み（`types.ts:29`、`to_snapshot.ts` の `collectExtra`）
- 受入: 型に無い欄が往復のあと `extra` に残る。

### R1.25
保存しないものを書くとき、書き手は子の配列、導出した所属、`label` の無い scope の名前、選択、camera、編集中の状態、どの agent がどの scope に居るか、作成時刻・更新時刻・作成者、既定値と同じ欄、null の attribute、空の配置値をレコードにしない。
- 出典: Database_Spec.md 11節、record-schema.md DA10・「保存しないもの」
- 状態: 実装済み（これらの欄は `types.ts` の該当レコードに無い。選択などは snapshot 変換で落とす `to_snapshot.ts:60`）
- 受入: snapshot を検索して、これらの欄がレコード本体に無い。

### R1.26
SQLite を扱うとき、SQLite は正本ではなく書き出しの形式の一つである。
- 出典: ADR 014 Decision 2、Database_Spec.md 1節
- 状態: 未実装。通常の Beta は SQLite 上の map 全体 JSON のままである（Database_Spec.md 0節）。export 専用の書き出しは、指定した四ディレクトリには無い。
- 受入: 正本の復旧手順が SQLite ファイルを必要としない。SQLite は export の出力としてだけ現れる。

### R1.27
scope の大きさを扱うとき、remote は 1,000 node を超えても書き込みを拒まず、超えたことだけを通知する。
- 出典: record-schema.md DA8
- 状態: 未実装。store にこの通知は無い。
- 受入: 1,001 node の scope が確定し、通知が別に届く。

### R1.28
Surface View の旧い語彙を移行するとき、移行は `scatter`、`mindmap`、`logic-chart`、`timeline` を書き換えずに運ぶ。
- 出典: record-schema.md DA5、snapshot-format.md 3.4
- 状態: 実装済み（`to_snapshot.ts` は surface の種別をそのまま写す）
- 受入: 旧い語彙の surface が変換後も同じ文字列である。

### R1.29
線の表示を決めるとき、表示は `label`、無ければ relationType の定義の表示ラベル、それも無ければ何も出さない。
- 出典: Database_Spec.md 3.4、record-schema.md DA24
- 状態: 未実装。store はこの表示規則を適用しない。
- 受入: 三つの状態で、画面の線の文字がこの順と一致する。

### R1.30
map の最終更新を示すとき、読み手は `touched` の `mapId` からキャッシュとして求め、レコードには持たない。
- 出典: Database_Spec.md 14節
- 状態: 未実装。`commit` レコードに map は無く（`types.ts:202-208`）、このキャッシュも無い。
- 受入: Home の並びが、レコードに保存した時刻ではなく、最後にその map を `touched` した確定から決まる。

## 2 不変条件

### R2.1
Command を確定するとき、remote は最終状態で不変条件を検査し、一つでも破るなら部分効果を公開も確定もしない。
- 出典: Database_Spec.md 4節、operation-algebra-requirements.md 3節
- 状態: 一部。破ると journal へ書く前に拒否する（`store.ts:1275-1280` の `refuse` は `append` より前）。検査は map 全体である（`store.ts:1272-1276`）。
- 受入: 循環を作る Command のあと、Neo4j の record と `Commit` が変わっていない。

### R2.2
root 以外の node を確定するとき、remote はその node に入る parent edge がちょうど 1 本であることを要求し、map の root には 0 本であることを要求する。
- 出典: Database_Spec.md 4節 1、record-schema.md「不変条件」、sync-requirements.md R2.1
- 状態: 実装済み（`invariants.ts:81-88`）
- 受入: 親が 0 本または 2 本の非 root は拒否される。root に入る parent edge も拒否される。

### R2.3
parent edge を確定するとき、remote は循環が無いことを、Command 内の付け替えを全部当てた後の状態で検査する。
- 出典: Database_Spec.md 4節 2 と末尾、operation-algebra-requirements.md 3節
- 状態: 一部。循環検査はある（`invariants.ts:90-106`）。最終状態に対して行う（`store.ts:1236-1276`）。触った周辺だけ、にはなっていない。
- 受入: 同じ Command の中の「A を B の下へ、B を A の下へ」が確定しない。片方ずつ見ると通る順序でも、最終状態で拒否される。

### R2.4
alias を確定するとき、remote は `target` が alias でない実在の node であることを要求し、alias から alias を拒否し、alias の子は許す。
- 出典: Database_Spec.md 4節 3、12.2、Glossary.md alias、record-schema.md「不変条件」
- 状態: 一部。alias でない実在 node への参照は検査する（`invariants.ts:108-116`）。子がいる alias は拒否する（`invariants.ts:111`）。これは次の食い違いの実装側である。
- 受入: alias の下に子を確定でき、その子は参照先の子にはならない。alias を指す alias は拒否される。

### R2.5
食い違い。Database_Spec.md 3.2、4節、12.2 と Glossary.md の alias は、alias が子を持てるとする。Database_Spec.md 10.1 は、alias は子を持てず参照先が必須だから芯の種類として残す、と書く。
- 出典: 上記
- 状態: 実装は 10.1 の側である（`invariants.ts:111`）。
- 受入: 正とする文面を一つに決めたあと、その文面のテストが通る。10.1 を残すなら子のある alias は拒否、12.2 を残すなら子は面の子として残る。

### R2.6
edge の端点を消すとき、remote は端点が実在しない状態を確定せず、端点を消す確定は、その edge も同じ確定で消す。
- 出典: Database_Spec.md 4節 4
- 状態: 一部。端点の実在は検査する（`invariants.ts:119-127`）。消す側が同じ確定に edge の削除を含めないときの自動の連鎖は無い。
- 受入: 端点だけを消す Command は拒否される。node と、それを端点とする edge を同じ Command で消すと確定する。

### R2.7
scope の root を確定するとき、remote は root が実在する node であり alias ではないことを要求する。root の scope の root は map の root であり、その scope は消せない。
- 出典: Database_Spec.md 4節 5、record-schema.md「不変条件」
- 状態: 一部。alias と実在は検査する（`invariants.ts:130-135`）。root scope を消せない検査は `invariants.ts` に無い。
- 受入: alias を root にする Command と、map の root scope を消す Command が拒否される。

### R2.8
parent edge を確定するとき、remote は実在する scope の ID を要求し、親がその scope の root であるか、親に入る parent edge の scope が同じであることを要求する。
- 出典: Database_Spec.md 4節 6、record-schema.md DA59
- 状態: 実装済み（`invariants.ts:137-158`）
- 受入: 面の途中で scope が飛ぶ parent edge は拒否される。一つの scope の parent edge を集めると、その root を頂点とする一本の木になる。

### R2.9
edge の ID を確定するとき、remote は parent edge と relation edge をまたいで `connectionId` が一意であることを要求する。
- 出典: Database_Spec.md 4節 7
- 状態: 実装済み（`invariants.ts:40-44` の重複 key）
- 受入: 同じ ID の parent edge と relation edge は同時に存在できない。

### R2.10
付随レコードを確定するとき、remote は details、linear-text、Surface View の保存設定、配置値、注釈が、指している node または scope の実在を要求する。
- 出典: Database_Spec.md 4節 8
- 状態: 実装済み（`invariants.ts:160-197`）
- 受入: 存在しない scope を指す surface は拒否される。

### R2.11
兄弟順を確定するとき、remote は同じ親の下で `ord` が一意であることを要求する。
- 出典: Database_Spec.md 4節 9、operation-algebra-requirements.md 8節
- 状態: 未実装。`invariants.ts` は `ord` の重複を見ていない。
- 受入: 同じ親に同じ `ord` を二本書く Command は拒否される。

### R2.12
拡張を確定するとき、remote は定義がある拡張について required の欄と型を検査し、定義が無い拡張の値は残して検査しない。
- 出典: Database_Spec.md 4節 10、10.3、10.4
- 状態: 未実装。`extensions` も定義レコードも型に無い。
- 受入: required が欠けた付与は拒否され、知らない定義の値は残る。

### R2.13
検査の範囲を決めるとき、remote は触った周辺だけで検査し、map 全体は走査しない。全体走査は試験の参照器だけが使う。
- 出典: Database_Spec.md 4節末尾、operation-algebra-requirements.md 3節 3、record-schema.md「不変条件」
- 状態: 未実装。事実が変わる確定は map の全レコードを検査する（`store.ts:1272-1276`、`invariants.ts:27`）。
- 受入: 1 件の label 変更の検査が、map の node 数に比例して全件を歩かない。参照器の全件検査と結果が一致する。

### R2.14
relation edge の重複を確定するとき、remote は同一端点・同一 relationType の重複を不変条件では禁じない。
- 出典: operation-algebra-requirements.md 10節、implementation-log.md の 2026-11-22 の決定（Database_Spec には不変条件として無い）
- 状態: 実装済み。重複を拒む検査が `invariants.ts` に無い。
- 受入: 同じ両端・同じ relationType の relation edge を二本確定できる。link 操作の便宜で抑止しても、relink で重複ができた確定は不変条件違反にならない。

### R2.15
Surface View の ID から種別を外したとき、remote は同じ scope と種別の組に保存設定が一つであることを不変条件にする。
- 出典: record-schema.md DA43 と IB51（推奨は不変条件に足すこと。2026-11-22 の確定により採用）
- 状態: 未実装。
- 受入: 同じ scope に同じ `surfaceKind` の surface を二件作ると拒否される。

### R2.16
alias の循環を検査するとき、remote は alias を別の node として数え、実体の子孫の下にその実体の alias を置くことを禁じない。描画は参照先の子を展開しない。
- 出典: Database_Spec.md 12.2
- 状態: 未実装。循環検査は parent edge だけをたどる（`invariants.ts:90-99`）ので、この区別自体は parent edge の検査では現れない。alias の子は R2.4 の実装が拒否する。
- 受入: 実体の子孫の下に、その実体を指す alias を置いた面が確定し、面の描画が循環しない。

## 3 書き込みと確定（Command・競合・再送・LWW/CAS）

### R3.1
保存へ書き込むとき、すべての書き手は Command だけを通し、移行後に map 全体を書き直す経路を残さない。
- 出典: ADR 014 Decision 3、Database_Spec.md 5.1
- 状態: 一部。Command 経路はある（`store.ts:704`）。全体書き直し `saveWholeMap` が残る（`store.ts:749`）。
- 受入: 移行後の製品経路から `saveWholeMap` 相当を呼ぶと拒否される。1 回の編集の入力量が map の総 node 数に比例しない。

### R3.2
Command を受けるとき、remote は出した側の ID、基準、意図、レコードごとの変更前と変更後を要求し、発行者は Command に書かせず、認証済みの接続から決める。
- 出典: Database_Spec.md 5.1、record-schema.md DA14、ADR 014 Decision 3
- 状態: 一部。`commandId` と `changes` は必須に近い（`store.ts:707-709`）。発行者は呼び出し引数であり、Command の `actor` 申告から作る（`legacy_api.ts:183-187`）。
- 受入: 接続の認証主体と違う `actor` を書いても、journal の `issuer` は認証主体になる。

### R3.3
確定を進めるとき、workspace の確定器は Command を 1 件ずつ、検査から確定まで通す。
- 出典: Database_Spec.md 5.2 規則 1・2、record-schema.md「確定の仕組み」
- 状態: 実装済み。store は一つのプロセスが同期的に `commitMapCommand` を実行する（`store.ts:4-6`、`store.ts:704`）。
- 受入: 互いに循環する二つの Command を同時に入れても、両方が変更前の状態で通らない。

### R3.4
通常の欄を確定するとき、remote は欄ごとの compare-and-set を行い、現在値が変更前と一致すれば適用し、変更後と一致すれば実差分なしとし、どちらでもなければ conflict にする。途中で値が一周して元に戻っていても、現在値が変更前なら通す。
- 出典: Database_Spec.md 5.2 規則 3、14節、sync-requirements.md R7.1、sync-principles.md「merge の価値観」
- 状態: 一部。変更前と現在の不一致は CONFLICT になる（`store.ts:1216-1223`）。現在値が変更後と一致する場合を実差分なしとして成功させる分岐は、この関数には無い。
- 受入: 前提 `a` 変更後 `b` について、現在 `a` なら `b`、現在 `b` なら実差分なし、現在 `c` なら conflict。`a→x→a` のあと現在 `a` なら適用される。

### R3.5
検査を通した Command を当てるとき、remote は変えた欄だけを当て、欄の削除は変更前にあって変更後に無いことで表す。
- 出典: Database_Spec.md 5.2 規則 4、record-schema.md「確定の仕組み」
- 状態: 実装済み（`store.ts:1211-1223` は `applyChangesReduced`。差分適用は `beta/src/node/record_store/apply_reduced.ts:23`）
- 受入: 触っていない attribute が、同じ node の別欄の更新で消えない。

### R3.6
確定するとき、remote は workspace で一本の `seq` を 1 進め、触ったレコードの `rev` をその番号にする。
- 出典: Database_Spec.md 5.2 規則 5
- 状態: 実装済み（`store.ts:1248-1249`）
- 受入: 連続する二つの確定の `seq` が 1 違い、触ったレコードの `rev` がその `seq` と一致する。

### R3.7
確定の境界は remote の Neo4j の write transaction の確定である。record の変更・`Commit`・`CommandResult`・`Head.seq` を同じ transaction で書く。
- 出典: Database_Spec.md 5.2・6.1、sync-requirements.md R5.2・R5.3、neo4j-database-design.md
- 状態: 未実装（Neo4j を database にする実装中）。
- 受入: transaction の確定前に停止すれば部分的な確定は残らず、確定後の応答喪失では同じ commandId の再送に元の結果が返る。

### R3.8
成功の応答は Neo4j の write transaction の確定後に返す。
- 出典: Database_Spec.md 5.2・6.1、sync-requirements.md R5.2・R5.3、neo4j-database-design.md
- 状態: 未実装（Neo4j を database にする実装中）。
- 受入: 成功の応答の直後の Neo4j の読みが、その確定より古い値を返さない。

### R3.9
確定点と成功の応答は Neo4j の write transaction に対応する。journal の別ファイルへの fsync と非同期の Neo4j 適用は置かない。
- 出典: Database_Spec.md 5.2・6.1、sync-requirements.md R5.2・R5.3、neo4j-database-design.md
- 状態: 未実装（Neo4j を database にする実装中）。
- 受入: record と `Commit` が同じ transaction で確定し、確定済み・未適用という状態が無い。

### R3.10
次の Command は、workspace の `Head` を lock した Neo4j の write transaction 内で record を読み検査する。
- 出典: Database_Spec.md 5.2・6.1、sync-requirements.md R5.2・R5.3、neo4j-database-design.md
- 状態: 未実装（Neo4j を database にする実装中）。
- 受入: `0→1` の確定後の Command は `1` を含む Neo4j の状態で評価される。

### R3.11
確定そのものが Neo4j の transaction なので、journal より Neo4j が遅れる状態も、遅れを根拠とする受付制限も無い。
- 出典: Database_Spec.md 5.2・6.1、sync-requirements.md R5.2・R5.3、neo4j-database-design.md
- 状態: 未実装（Neo4j を database にする実装中）。
- 受入: Neo4j の transaction が失敗したときは確定せず、成功した確定に非同期の反映待ちが生じない。

### R3.12
scope をまたぐ移動の Command を受けたとき、remote は未対応として確定せず、同じ scope の中の移動は通常どおり確定する。
- 出典: Database_Spec.md 5.2 規則 8、sync-requirements.md R2.4、operation-algebra-requirements.md 9節
- 状態: 未実装。未対応であることを理由にする拒否は、指定したコードに無い。
- 受入: S の node を T の部分木へ移す Command が確定されず、理由が scope をまたぐ移動の未対応と分かる。S も T も変わらない。

### R3.13
同じ node への同時の move を確定するとき、remote は `seq` の順で後の有効な move を採り、循環を作る move は拒否する。基準にした兄弟が消えていたら、右隣の直前、左隣の直後、末尾の順で位置を決める。
- 出典: Database_Spec.md 3.4・5.2 規則 9、operation-algebra-requirements.md 8節、Database_Spec.md 14節
- 状態: 未実装。move も欄の CAS で拒否されうる（`store.ts:1216-1223`）。消えた兄弟の三段解決は無い。
- 受入: 「x を a の前」のあと「x を b の後」が確定すると、並びは後者になる。循環する move は拒否される。offline の挿入は、その間に入った兄弟を消さずに隙間へ入る。

### R3.14
位置以外の欄を確定するとき、remote は LWW ではなく CAS で判定し、outbox から届いた基準の古い move だけを LWW で受ける。ロックの判定は別に行う。
- 出典: Database_Spec.md 14節
- 状態: 一部。CAS はある（`store.ts:1216-1223`）。move の LWW は無い（R3.13）。
- 受入: 古い基準の label 更新は conflict になり、古い基準の move は後勝ちで入る。

### R3.15
兄弟順キーが衝突したとき、remote は後から確定する側のキーだけを作り直し、両 node を残し、衝突だけを理由に conflict・作成拒否・利用者通知をしない。非対象の兄弟は再採番しない。
- 出典: sync-requirements.md R7.5、sync-principles.md「merge の価値観」、operation-algebra-requirements.md 8節、Database_Spec.md 3.4
- 状態: 未実装。
- 受入: 二つの local が同じ親・同じキーで別の子を push すると、両方が存在し、確定後のキーは衝突せず、再生後も同じ順になる。利用者への通知は無い。

### R3.16
食い違い。record-schema.md DA27 は、端末がキーを作ってよく、同じ隙間ではキーと `connectionId` の組で順を決め、列が交互に混ざることがある、とする。operation-algebra-requirements.md 8節と Database_Spec.md 3.4 は、ID による tie-break と非対象の再採番を禁じ、交わらないブロックを混ぜない。sync-principles.md は、端末がキーを作る DA27 を保ったうえで、remote が後着のキーを作り直す、とも書く。
- 出典: 上記
- 状態: キー生成は実装済み（`order_key.ts:40-45` の `keysBetween`）。衝突時の remote の作り直しは未実装。
- 受入: 正とする規則を一つにしたあと、同じ隙間への二つのブロックが交互にならないこと、または DA27 の交互を許すこと、のどちらかの試験が通る。

### R3.17
再送を判定するとき、remote は `(workspaceId, commandId)` を鍵にし、保持期間内は成功・実差分なし・確定的拒否の最初の結果を返し、同じ鍵で中身が違う依頼は拒否し、既知の結果の照合を古い基準の検査より先に行う。
- 出典: operation-algebra-requirements.md 5節、Database_Spec.md 5.3、sync-requirements.md R4.2・R4.5
- 状態: 一部。成功した Command は map と `commandId` で覚え、中身が違うと `SAME_ID_DIFFERENT_CONTENT` を返す（`store.ts:299-300`、`store.ts:711-720`）。workspace 全体の鍵ではなく、拒否の結果は覚えない。
- 受入: 別 map の同じ `commandId` が二重実行されない。拒否された Command を、前提が変わったあとで同じ ID で送っても、最初の拒否が返る。中身が違う再送は状態を変えない。

### R3.18
再送の記録を保持するとき、remote は workspace 単位で、再送が来うる期間を scope の保持期間より長く持つ。
- 出典: sync-principles.md「過去の情報の残し方」、sync-requirements.md R4.5
- 状態: 一部。直近 100,000 件の ID と hash を `commit-index.json` に残す（`store.ts:75`、`store.ts:888-894`）。時間では切っていない。
- 受入: 保持期間を超えても、再送窓の中の同じ ID は二重適用されない。期限後に結果が確認できなければ、未処理とは断定しない。

### R3.19
基準が journal の保持範囲より古い Command を受けたとき、remote は状態を取り直させてから受け、消した node を再送で復活させない。
- 出典: Database_Spec.md 5.3、record-schema.md「確定の仕組み」
- 状態: 未実装。
- 受入: journal の保持範囲より前の基準を持つ Command は、取り直しを求める結果になり、適用されない。

### R3.20
結果が確認できない再送期限後の Command を復帰するとき、local はそれを保留し、自動で新しい ID を付けて再発行しない。
- 出典: sync-requirements.md R4.6・R6.9
- 状態: 未実装。outbox が無い。
- 受入: snapshot の再取得、再起動、再接続のあとにも、元の ID と結果不明が残り、新 ID の Command が勝手に出ない。

### R3.21
Undo を評価するとき、remote は元 Command の確定効果を復元する 1 Command として扱い、`rev` は戻さず新しい `seq` へ進め、後続変更と衝突したら初版では Undo 全体を拒否する。
- 出典: operation-algebra-requirements.md 4節
- 状態: 未実装。逆操作を特別扱いする経路は、指定したコードに無い。
- 受入: Undo のあと `seq` は増え、元の値が戻る。後続が同じ欄を変えていたら、Undo は全体が拒否され、部分的には戻らない。

### R3.22
Undo の証拠を検査するとき、remote は元 Command が実際に作った値が残っていることを要求し、現在値の一致だけでは巻き戻さない。
- 出典: sync-requirements.md R7.3、sync-principles.md「merge の価値観」
- 状態: 未実装。
- 受入: A が `a→b`、B が `b→c→b` のあと、現在が `b` でも A の Undo は取り消さない。別欄だけが変わり、対象欄に A の値が残るなら、node の `rev` が増えただけでは拒否しない。

### R3.23
食い違い。Database_Spec.md 5.3 は、Undo を逆向きの Command を出すことで行う、と書く。operation-algebra-requirements.md 4節は、Undo を逆の operation molecule ではなく確定差分の復元で定義する、と書く。
- 出典: 上記
- 状態: どちら専用の実装も無い。
- 受入: 正とする定義で、group の逆が dissolve であるだけでは Undo にならないこと、または逆 Command で足りること、のどちらかを試験する。

### R3.24
実差分なしになった Command を記録するとき、remote はその Command を値を作った証拠として扱わない。
- 出典: sync-requirements.md R7.2
- 状態: 未実装（R3.4 の実差分なしが未実装）。
- 受入: B の `a→b` のあと A が同じ `a→b` を送ると、A の Undo で B の変更は消えない。

### R3.25
削除を評価するとき、remote は削除する側が観測した対象集合を基準にし、未観測の追加や所属変更を巻き込むなら削除全体を conflict にする。
- 出典: sync-requirements.md R2.5、sync-principles.md「merge の価値観」、Database_Spec.md 5.4（node 削除は record 単位）
- 状態: 未実装。
- 受入: 部分木 P の削除を準備したあと、別端末が子 X を確定すると、P の削除は全体が conflict になり、X は残る。

### R3.26
一部の attribute だけを読んだ client が書くとき、remote は読んでいない attribute を消さず、読んでいない key と同じ key の作成は CONFLICT のままにし、projection の応答には省いた key の名前だけを返す。
- 出典: Database_Spec.md 5.4（仮決めを確定）
- 状態: 一部。差分に無い attribute は消えない（`apply_reduced.ts` の欄単位適用、`store.ts:1216`）。省いた key の名前を返す projection 応答は無い。
- 受入: 読んでいない key の作成が CONFLICT になり、応答にその key 名があり値は無い。client が更新に切り替えると確定できる。

### R3.27
読んでいない attribute を持つ node を消すとき、remote は record 単位の delete として受け、照合するのは node の `rev` だけであり、Undo は record の pre-image で戻す。
- 出典: Database_Spec.md 5.4
- 状態: 未実装。
- 受入: 一部の attribute を読んでいない client の削除が、`rev` の一致だけで確定し、読んでいない attribute も消える。Undo で行全体が戻る。

### R3.28
並べ替えを確定するとき、remote は node の存在と所属を並べ替えの副作用で変えず、同じ対象の競合する並べ替えは後の確定を採り、削除済み対象の並べ替えは node を復活させない。
- 出典: sync-requirements.md R7.4、sync-principles.md「merge の価値観」
- 状態: 未実装。
- 受入: 旧い兄弟一覧に基づく並べ替えより前に子 X が確定していても、並べ替え後に X は残る。対象を消したあとの並べ替えは node を戻さない。

### R3.29
宣言された依存が reject、park、または未確認のとき、remote はその依存を必要とする後続 Command を実行しない。
- 出典: sync-requirements.md R4.4
- 状態: 未実装。Command に依存の欄を処理するコードは、指定範囲に無い。
- 受入: A が park されると、A に依存する B と C は実行されず、独立な D は確定できる。

### R3.30
解釈できない Command を受けたとき、remote は推測して実行せず、状態を変えず、未対応箇所を返す。
- 出典: sync-requirements.md R4.7、operation-algebra-requirements.md 16節は実装者が保存方式を選べるが保証は変えない
- 状態: 一部。形の異常は `INVALID_COMMAND` になる（`store.ts:707-709`、`store.ts:1220-1221`）。未対応の比較パスを特定して返す契約は無い。
- 受入: 未対応の schema を送ると、どの箇所が未対応かが返り、他の欄は変わらない。

### R3.31
未定義の merge case を受けたとき、remote は自動解決を推測せず、その Command と依存を実行せず人の判断へ返す。
- 出典: sync-requirements.md R7.7、sync-principles.md「merge の価値観」
- 状態: 未実装。操作の種類ごとの表はコードに無い。
- 受入: 表で空にしたマスは LWW や一括上書きにならず、独立な Command だけが処理される。構造検査に反する組合せは通らない。

### R3.32
conflict を解くとき、remote は影響する全 scope の現在の権限を持つ編集者の解決を、原作者でなくても受け、解決を別の Command として記録する。
- 出典: sync-requirements.md R3.6・R7.6、sync-principles.md「merge の価値観」
- 状態: 未実装。
- 受入: 片方の scope だけの権限では確定しない。両方の権限を持つ別の編集者の解決 Command は確定できる。元の Command の中身を書き換える方法では解決できない。

### R3.33
replay するとき、remote は確定時の差分、生成した ID、兄弟順キー、解決結果をそのまま適用し、intent から位置解決や ID 生成をやり直さない。
- 出典: operation-algebra-requirements.md 6節、sync-requirements.md R5.4、Database_Spec.md 6節（`ops` は post-image）
- 状態: 一部。journal は `ops` の post-image を持つ（`store.ts:1295-1297`）。開くときにその行を適用する（`store.ts:497-513`）。未確定の依頼だけを再解決する経路は、outbox が無いので無い。
- 受入: 衝突解消の規則を変えたあとで replay しても、確定済みのキーと ID は変わらない。

### R3.34
一つの Command を適用するとき、remote は変更を不可分に扱い、巨大 Command の部分反映を公開しない。
- 出典: sync-requirements.md R4.3、operation-algebra-requirements.md 3節 4
- 状態: 一部。1 件の `append` が 1 行である（`store.ts:1337`）。100 万 node を複数 Command に分ける隠し取り込み（Database_Spec.md 14節）は未実装。
- 受入: transaction の途中で落とすと、復旧後は未確定なら変更前、確定済みなら Command 全体のあとになる。

### R3.35
operation の意味を定義するとき、製品 Model の操作は operation molecule であり、その意味はレコード 1 件への 7 種の operation atom の列で定まる。Command はその順序付き列である。アカウントと確定の表は対象外である。
- 出典: operation-algebra-requirements.md 1節・2節・15節
- 状態: 未実装。store は atom へ展開せず、クライアントの `changes` を適用する。
- 受入: 直接評価、atom 展開、確定差分の三経路が、同じ基準状態で同じ製品 Model になる。公開操作と全レコード種別がこの列で表せる。

### R3.36
作成・削除・復活を適用するとき、remote は不存在の版を含めて冪等にする。
- 出典: operation-algebra-requirements.md 6節 4
- 状態: 未実装。
- 受入: 同じ削除を二度適用しても結果が同じであり、復活の再送が別 node を作らない。

### R3.37
独立と証明できない二つの Command を受けたとき、remote はそのことだけを理由に拒否せず、順序の競合は兄弟順の合流規則に従う。独立と証明できた二つは、どちらの順でも同じ結果になる。
- 出典: operation-algebra-requirements.md 7節
- 状態: 未実装。読み取り依存による独立判定は無い。
- 受入: 書き込み範囲が重ならず読み取り依存も無い二 Command を逆順に確定すると、結果が一致する。証明できない組は拒否理由にならない。

### R3.38
子を足すとき、足した agent が居る scope の子になる。MCP の create は居る scope を知らないので、既定では対象がふつうに属する面の内側に置き、外へ置くときは作ったあと move する。
- 出典: record-schema.md DA56 と、その節が書く MCP の逸脱
- 状態: 一部。MCP の move は `outside_scope` を受ける（`mcp_service.ts:571`）。create が居る scope を知って内側を選ぶ実装は、この分岐には無い。
- 受入: 画面で scope C に居て子を足すと、その子の parent edge の scope は C である。MCP の create の既定は内側であり、外は move で移る。

### R3.39
scopen するとき、remote は新しい scope を一つ作り、選んだ 1 node の、その node がふつうに属する面に載る直接の枝の閉包を新しい scope へ移す。複数対象の列挙は拒否する。
- 出典: record-schema.md DA64、operation-algebra-requirements.md 9節、Database_Spec.md 3.5
- 状態: 一部。MCP は intent を `scopen` にする（`mcp_service.ts:61`）。閉包の付け替えと複数対象の拒否は、store の不変条件側には専用規則が無い。
- 受入: 結果が viewer の有無で変わらない。任意の部分集合を指定した scopen は拒否される。

### R3.40
unscopen するとき、remote は対象 scope を scope の ID で指定し、その scope の parent edge を root の親から来る parent edge の scope へ付け替え、linear-text と Surface View の保存設定を同じ確定で消す。処分方針が無い注釈や、既定でない Surface View の設定が残るなら拒否する。
- 出典: Database_Spec.md 3.5、record-schema.md DA47・DA58、operation-algebra-requirements.md 9節（仮決めを確定）
- 状態: 未実装。専用の拒否と同時削除は store に無い。
- 受入: 注釈が残った unscopen は拒否される。明示した移管または削除を同じ Command に含めると確定し、別の scope へ自動では合流しない。Undo で scope と付随が戻る。

### R3.41
scope の移動だけでは、remote は relationType を変えず、推論しない。
- 出典: operation-algebra-requirements.md 9節（仮決めを確定）
- 状態: 未実装。
- 受入: unscopen の前後で、範囲内の relation edge の `relationType` が同じである。

### R3.42
代理で書いたことを記録するとき、remote は代理の欄を持たない。
- 出典: record-schema.md DA51（推奨を確定）
- 状態: 実装済み。`commit` に代理の欄は無い（`types.ts:202-208`）。
- 受入: snapshot と journal に、依頼した human を別欄として必須にする項目が無い。

### R3.43
大きな取り込みを確定するとき、remote は 100 万 node を、どの scope からもたどれない部分木として複数 Command に分け、最後の Command が root を親へつなぐまで読み込みに出さない。
- 出典: Database_Spec.md 14節、record-schema.md「確定の仕組み」
- 状態: 未実装。
- 受入: つなぐ前の中間 Command の node が、面の読みにも検索にも出ない。最後の Command のあとでだけ現れる。

### R3.44
branch を作らない方針のとき、remote は workspace の確定系列を一つに限定し、競合を別 branch の確定として処理しない。
- 出典: sync-requirements.md R1.4、sync-principles.md「remote と local」、ADR 014 Decision 4
- 状態: 未実装。branch を作るコードは無いが、競合を未解決状態として残す機構も無い。
- 受入: 二つの local が同じ欄を別の値へ編集して push すると、未解決の conflict が残り、第二の確定系列はできない。

## 4 journal・snapshot・export・retention

### R4.1
journal は Neo4j の `Commit` node に保持する。1 件は 1 確定で、状態の保存先ではない。JSON は push / pull / clone の wire format と export に用いる。format と切り替え点の seq は `Head` に持つ。
- 出典: Database_Spec.md 6節・7節、neo4j-database-design.md
- 状態: 未実装（Neo4j を database にする実装中）。
- 受入: pull が指定した seq より後の `Commit` を順に返し、journal ファイルに依存しない。

### R4.2
journal の行を書くとき、remote は `seq`、`committedAt`、`issuer`、`sessionId`、`commandId`、`mapId`、`intent`、`actor`、`changes`、`changesHash`、`ops`、`touched`、`provenance` を持ち、map の削除・改名・一覧の欄だけの変更では `mapOp` と `newMapId` を持つ。
- 出典: Database_Spec.md 6節
- 状態: 一部。これらのうち `touched` と `changesHash` と `ops` は書く（`store.ts:1287-1336`）。`sessionId` を行へ写す処理は、この代入には無い。
- 受入: 確定行から Command の ID、発行者、変更、post-image、触ったレコードが復元できる。

### R4.3
`touched` を書くとき、remote は `ops` と pre-image の差から決定的に作り、client の申告は受けず、`rev` だけの差と、計算で求まる値だけが変わった子孫は入れず、rk の文字列順で重複させない。
- 出典: Database_Spec.md 6節
- 状態: 実装済み（`journal_archive.ts:101-119`。`rev` は比較から除外 `journal_archive.ts:87`）
- 受入: 同じ `ops` から同じ `touched` が出る。client が送った event kind では上書きできない。

### R4.4
event kind を付けるとき、remote は `m3e:create`、`m3e:delete`、`m3e:content`、`m3e:attribute`、`m3e:reparent`、`m3e:order`、`m3e:extension`、`m3e:target` を使い、知らない kind を読む側は無視する。parent edge の付け替えと兄弟順は別の kind である。
- 出典: Database_Spec.md 6節、3.2
- 状態: 一部。create、delete、attribute、extension、content は出る（`journal_archive.ts:81-94`）。付け替えと `ord` と scope の `rootNodeId` は一つの `m3e:structure` である（`journal_archive.ts:54-57`、`journal_archive.ts:91`）。`m3e:target` は出ない。
- 受入: `ord` だけの変更が `m3e:order` になり、親の変更が `m3e:reparent` になる。ロック判定が兄弟順を構造の削除と取り違えない。

### R4.5
`provenance` を書くとき、remote は `{items, truncated?}` だけを残し、要素は `{mode, rk, rev}`、`mode` は `observed` または `declared`、同じ rk は最初の 1 件、100 件を超えたら `truncated: true` にする。形の合わない item は `INVALID_COMMAND` で断る。
- 出典: Database_Spec.md 6節
- 状態: 実装済み（`provenance.ts:10-52`、`store.ts:735-739`）
- 受入: 101 件目で `truncated` が付き、壊れた item では確定しない。`{contextId, tool}` だけの古い形は journal に残らない。

### R4.6
`changes` と `ops` を両方書くことを、replay の決定性を確かめる試験ができるまでやめない。
- 出典: Database_Spec.md 6節（仮決めを確定）
- 状態: 実装済み（`store.ts:1292-1297`）
- 受入: 確定行に送られた変更と post-image の両方がある。試験が通ったあとで `ops` をやめる変更は、別の明示の format 判断になる。

### R4.7
途中停止からの回復は Neo4j の transaction log が担う。pull の受信は seq の連続と世代を検査する。
- 出典: Database_Spec.md 6節、neo4j-database-design.md
- 状態: 未実装（Neo4j を database にする実装中）。
- 受入: transaction の部分適用を公開せず、欠番や世代不一致の配送を取り込まない。

### R4.8
現在状態は Neo4j に保持し、journal を畳み込む log compaction と journal の archive は置かない。
- 出典: Database_Spec.md 6節、neo4j-database-design.md 10節
- 状態: 未実装（Neo4j を database にする実装中）。
- 受入: 通常の保存と起動で `snapshot.jsonl` を書き直さず、journal の archive を作らない。

### R4.9
Neo4j の現在状態を journal の行数に応じて別の snapshot ファイルに書き直す処理は置かない。
- 出典: Database_Spec.md 6節、neo4j-database-design.md 10節
- 状態: 未実装（Neo4j を database にする実装中）。
- 受入: 確定件数が増えても JSON Lines の compaction が起動しない。

### R4.10
schemaVersion を上げるとき、Neo4j の状態を移行し、`Head` に format と切り替え点の seq を保存する。切り替え点より前の journal の upcasting はしない。
- 出典: Database_Spec.md 6節・7節、record-schema.md
- 状態: 未実装（Neo4j を database にする実装中）。
- 受入: clone / export の header が切り替え点を示し、移行前の確定記録を新しい format で解釈しない。

### R4.11
保持対象外の確定記録を削減する前に、Neo4j の現在状態、必要な履歴・再送結果・名前付き snapshot・定期 export の保全を検証し、問題があれば削減しない。
- 出典: Database_Spec.md 6節、sync-requirements.md R8.7
- 状態: 未実装（Neo4j を database にする実装中）。
- 受入: 検証に失敗した場合は確定記録を削減せず、有効な再送結果と名前付き snapshot を失わない。

### R4.12
名前付き snapshot は Neo4j にその seq の時点の状態として保持し、履歴期限だけで削減しない。
- 出典: Database_Spec.md 12.4、sync-requirements.md R8.5
- 状態: 未実装（Neo4j を database にする実装中）。
- 受入: 名前付き snapshot の状態を Neo4j から取得でき、削除は確認つきの明示操作だけで起きる。

### R4.13
journal の保持対象外の確定記録は保持条件を検証して削減する。現在状態は Neo4j にあり、hot journal と archive のファイルは置かない。
- 出典: Database_Spec.md 6節、Glossary.md journal
- 状態: 未実装（Neo4j を database にする実装中）。
- 受入: 履歴の削減後も現在状態が Neo4j に残り、遅れた local は remote の clone で取り直せる。

### R4.14
scope の `retention` が `{ms?, bytes?}` のとき、remote はその scope の履歴を、先に達した上限から手放す。`ms` が無いときの既定は 30 日（2,592,000,000 ミリ秒）である。現在の状態と未解決 conflict は履歴期限で消さない。
- 出典: Database_Spec.md 6節、sync-requirements.md R8.1、sync-principles.md「過去の情報の残し方」
- 状態: 未実装。scope の型に `retention` は無い（`types.ts:102-111`）。
- 受入: 短い時間上限と容量上限を別々に先に到達させると、過去の履歴だけが削減対象になり、今の node は残る。

### R4.15
食い違い。Database_Spec.md 6節は、欄が無いときの履歴の `ms` を 30 日とする。sync-principles.md「過去の情報の残し方」と sync-requirements.md K12 は、30 日を目安とし、使ってから決めるまで規定値にしない、と書く。
- 出典: 上記
- 状態: どちらの既定値もコードに無い。
- 受入: 正とする既定で、欄の無い scope の履歴が 30 日で手放されるか、手放されないかが分かれる。

### R4.16
複数 scope に関わる履歴を計上するとき、remote は関わる scope のうち最も長い保持期間で残し、単独で破棄できる容量と共有履歴の容量を分けて示す。
- 出典: sync-principles.md「過去の情報の残し方」、sync-requirements.md R8.3
- 状態: 未実装。
- 受入: 長い側の義務が残る記録は、短い側の上限到達では消えない。表示上、共有分を短い側の単独容量に混ぜない。

### R4.17
Deep の履歴を残すとき、remote は版をすべては残さず、Rapid と同じ時間と容量の上限に従い、昇格のときに名前付き snapshot を残す。
- 出典: Database_Spec.md 12.1・12.6 KB2
- 状態: 未実装。
- 受入: Deep の scope でも、上限を超えた過去の journal は削減対象になる。昇格の名前付き snapshot はその対象に入らない。

### R4.18
食い違い。sync-requirements.md R8.5 と sync-principles.md「過去の情報の残し方」は、Deep が版をすべて残し、時間と容量の既定を無制限とし、廃止を retraction として残す、とする。Database_Spec.md 12.1 は、Deep も全版は残さず、名前付き snapshot で昇格時点を残す、とする。
- 出典: 上記
- 状態: どちらも未実装。
- 受入: 正とする側で、三つの版を作ったあとに確定記録の削減が過去版を消すか残すかが分かれる。

### R4.19
node そのものを期限で消す設定は、履歴の保持とは別の明示的な有効化がある scope にだけ付ける。
- 出典: sync-principles.md「過去の情報の残し方」
- 状態: 未実装。
- 受入: 履歴期限だけでは node が消えない。明示を有効にした scope だけで、期限による node の削除が起きる。

### R4.20
保持期間の短縮を行うとき、remote は確認つきの明示の操作としてだけ受け、過去を即座に黙って捨てない。
- 出典: sync-principles.md「過去の情報の残し方」、sync-requirements.md R8.4 の前提
- 状態: 未実装。
- 受入: 確認の無い短縮 Command は確定しない。確認のあとで、短縮後の上限より古い履歴が削減対象になる。

### R4.21
copy の来歴と、長く残す provenance を置くとき、書き手は journal ではなく record 側に置き、保持対象外の確定記録の削減で失わない。
- 出典: Database_Spec.md 6節、operation-algebra-requirements.md 11節（仮決めを確定）、quantities-requirements.md Q1（推奨を確定。全期間の出来事と出所の参照。本文の復元は別保証）
- 状態: 未実装。journal の `provenance` はあるが、record 側の来歴欄は型に無い。
- 受入: 保持対象外の確定記録を削減したあとでも、copy の元、基準の `seq`、方式、ID 対応がレコードから読める。本文そのものの復元は、この要件の不合格にしない。

### R4.22
減衰する量の累積を置くとき、snapshot は尺度ごとの `{v[k], t}` を状態として持つ。
- 出典: Database_Spec.md 6節・7節・9節
- 状態: 未実装。snapshot の行にこの欄は無い。
- 受入: journal を 90 日分消したあとでも、同じ評価時刻の減衰値が、消す前と一致する。

### R4.23
複製は Neo4j の整合した到達地点の状態を clone / export として取り出す。ファイルを database として複製しない。
- 出典: Database_Spec.md 1節・6節、neo4j-database-design.md
- 状態: 未実装（Neo4j を database にする実装中）。
- 受入: 別の確定が並行しても clone / export の record と `Head.seq` が同じ時点を表す。

### R4.24
再送の判定は Neo4j の `CommandResult` node に commandId・hash・対象 map の集合・元の結果・seq を保持し、`Head` に最後の seq を保持する。
- 出典: Database_Spec.md 5.3・6.1、neo4j-database-design.md
- 状態: 未実装（Neo4j を database にする実装中）。
- 受入: clone / export から再送の判定と最後の seq が戻り、有効な結果を件数上限だけで落とさない。

### R4.25
確定の時刻・発行者・任意の sessionId を Neo4j の record に保持する。journal の保持対象外の変更内容を削減しても、残すと決めた確定の時刻と発行者は保持する。
- 出典: Database_Spec.md 3.7、record-schema.md DA2
- 状態: 未実装（Neo4j を database にする実装中）。
- 受入: 確定記録の削減後も、残すと決めた時刻と発行者を Neo4j から引ける。

### R4.26
移行入力・export・clone payload の行を並べるとき、書き手は `kind`、次に key の文字列順とし、値が無い欄と null は書かない。行の順序に意味は無い。
- 出典: Database_Spec.md 7節、snapshot-format.md 1節
- 状態: 実装済み（`jsonl.ts:11-28`、`jsonl.ts:31-33`）
- 受入: 同じレコード集合の二度の書き出しがバイト単位で一致する。

### R4.27
復旧の到達地点は保全された Neo4j の定期 export と確定記録の範囲で示す。保持を確認していない時点の PITR を保証しない。
- 出典: Database_Spec.md 6節、sync-requirements.md R5.1
- 状態: 未実装（Neo4j を database にする実装中）。
- 受入: 定期 export からの復旧で到達地点と欠けた可能性のある範囲を示す。

### R4.28
未送信・結果不明・park・取り込み待ちの Command を local が持つとき、local は履歴の保持期限を理由に outbox の内容、依存、結果照合を捨てない。
- 出典: sync-requirements.md R8.2
- 状態: 未実装。outbox が無い。
- 受入: 履歴期限を超えて再起動しても、各 Command の内容と状態が残る。容量不足のとき、完了済みの local commit を黙って消して空きを作らない。

### R4.29
確定記録を削減する前に、Neo4j の現在状態、復旧・再送窓・保証中の履歴・名前付き snapshot・定期 export を保全する。
- 出典: Database_Spec.md 6節、sync-requirements.md R8.7
- 状態: 未実装（Neo4j を database にする実装中）。
- 受入: export の途中で停止しても検証済み export は残り、必要な状態が欠ければ確定記録を削減しない。

## 5 Neo4j

### R5.1
レコードを Neo4j に置くとき、すべてのレコードをラベル `Rec` と種別ラベルの node 一つにし、edge も node にする。
- 出典: Database_Spec.md 8.1、record-schema.md DA54
- 状態: 実装済み（`beta/src/node/neo4j_store/encoding.ts:39-57`）
- 受入: parent edge が他の edge の端点になれる。ID の一意が一つの制約で守られる。

### R5.2
property を書くとき、Neo4j は `rk`（`<kind>|<key>`）、`kind`、`id`、元の欄順 `o`、そのまま持てる値の `f_`、それ以外の JSON の `j_`、attribute の `a_` と `aj_` と `ao`、`extra` の `x_` と `xj_` と `xo` を使う。名前が使えないときだけレコード全体を `j` に置く。
- 出典: Database_Spec.md 8.2
- 状態: 実装済み（`encoding.ts:78-81`、`encoding.ts:185`）
- 受入: 取り込みと読み戻しが、元の snapshot とバイト単位で一致する。

### R5.3
数値を書くとき、Neo4j は安全な範囲の整数を Integer、それ以外を Float にし、読み込みの境界で 2^53−1 以下であることを確かめる。
- 出典: Database_Spec.md 8.2
- 状態: 実装済み（`encoding.ts:105`、`encoding.ts:114`）
- 受入: 2^53 を超える整数を Integer のまま数値へ戻さない。元の JSON の文字列に戻る。

### R5.4
時刻を書くとき、Neo4j は canonical な ISO 8601 の文字列に加えて、epoch ミリ秒の整数を持つ。
- 出典: Database_Spec.md 8.2・10.7
- 状態: 未実装。`encoding.ts` は時刻専用の第二 property を足していない。
- 受入: 同じ時刻で範囲検索ができ、文字列の形も canonical のまま読み戻る。

### R5.5
拡張の名前を写すとき、Neo4j は `extensions` の名前の集合を node のラベルにも書く。
- 出典: Database_Spec.md 8.2・10.4
- 状態: 未実装。`KIND_LABELS` は種別だけで、拡張名のラベルは無い（`encoding.ts:41-57`）。
- 受入: `m3e:nodeType:task` を持つ node が、そのラベルで引ける。

### R5.6
索引を作るとき、Neo4j は `rk` の一意制約、`id`、および `f_source`、`f_target`、`f_rootNodeId`、`f_nodeId`、`f_scopeId`、`f_surfaceId`、`f_mapId` を索引にする。
- 出典: Database_Spec.md 8.2
- 状態: 実装済み（`beta/src/node/neo4j_store/apply.ts:48-51` の `REFERENCE_PROPERTIES` と `ensureSchema`）
- 受入: 索引が無いときの 180〜610 ms 級の全走査に戻らない。索引の値の上限は UTF-8 で 8,164 バイト、文字列索引は 32,766 バイトであり、超えた書き込みは拒否される。

### R5.7
relationship を作るとき、Neo4j は `SOURCE`、`TARGET`、`ROOT`、`OF`、`IN`、`ON`、`PLACES`、`ALIAS_OF`、`IN_MAP` を問い合わせ用に作り、読み戻しの正本には使わない。
- 出典: Database_Spec.md 8.3
- 状態: 実装済み（`encoding.ts:59`、`encoding.ts:134`）
- 受入: relationship を消して node の property だけから snapshot を書き戻すと、元と一致する。

### R5.8
store ごとの最後の確定位置は Neo4j の `Head.seq` に持ち、record の変更と `Commit` と同じ write transaction で更新する。
- 出典: Database_Spec.md 8.3、neo4j-database-design.md
- 状態: 未実装（Neo4j を database にする実装中）。
- 受入: record・`Commit`・`Head.seq` が同時に確定し、journal より Neo4j が遅れない。

### R5.9
Neo4j の内部 ID を外へ返すとき、remote は返さない。参照は自前の ID だけを使う。
- 出典: Database_Spec.md 2節、record-schema.md 6節
- 状態: 実装済み。外部の key は `rk` と `id` である（`encoding.ts` の `recordRk`）。
- 受入: API の応答に Neo4j の内部 ID が無い。

### R5.10
端末の Neo4j の破損は remote から clone して復旧する。remote の Neo4j は database 全体の定期 export で保全する。
- 出典: Database_Spec.md 1節、neo4j-database-design.md 8節
- 状態: 未実装（Neo4j を database にする実装中）。
- 受入: clone / export で内容と管理状態が戻り、JSON の状態ファイルを database として使わない。

### R5.11
製品として同梱する JVM の方式、組込み系への切替、export した SQLite を読む閲覧専用 mode は、この一覧の要件にしない。
- 出典: ADR 014 Decision 2（製品化時に別途決定。推奨は無い）
- 状態: 未実装
- 受入: 14 の未決として残り、実装者が同梱方式を選んで合格にしない。

## 6 拡張と型

### R6.1
node の芯を分けるとき、構造の拘束が違う芯はプレーンと alias の二つであり、task や agent は芯を変えずに重ねる拡張である。
- 出典: Database_Spec.md 10.1・10.4
- 状態: 未実装。`nodeType` が種別の分岐のままである（`types.ts:46-47`）。
- 受入: 拡張の付け外しで node の ID と本文が変わらない。alias とプレーンの間の変更は拒否される。

### R6.2
format 2 で `nodeType` を残すとき、remote はそれを描画器の選択子として残し、`extensions` との統合は次の format の bump まで行わない。
- 出典: Database_Spec.md 3.2（仮決めを確定）
- 状態: 一部。`nodeType` は残っている（`types.ts:46-47`）。`extensions` はまだ無い。
- 受入: format 2 の snapshot に `nodeType` と `extensions` が両立し、format 番号は 2 のままである。

### R6.3
拡張の定義を書くとき、名前は「接頭辞:分類:名前」の三段、分類は `nodeType`、`parentEdge`、`relationEdge` であり、レコード `extensionDef` の key は `name` と `version` である。同じ名前と版で中身が違う定義は CONFLICT であり、`misc:` も例外にしない。
- 出典: Database_Spec.md 10.2、quantities-requirements.md R18（仮を確定）
- 状態: 未実装。
- 受入: 同じ `name@version` の第二の中身が CONFLICT になる。relationType の名前は三段にしない。

### R6.4
拡張の欄の値を置くとき、remote は attribute に置き、key は定義名に `/` と欄名を足したものとし、key に版は入れない。
- 出典: Database_Spec.md 10.3
- 状態: 未実装。
- 受入: `m3e:nodeType:task/status` が attribute として読め、定義の v2 を足しても v1 の値を読み替えない。版の移行は値を書き換える明示の Command である。

### R6.5
拡張の付与を確定するとき、remote は required がそろうまで有効にせず、そろわない Command を拒否する。解除しても名前空間の値は残し、有効な拡張とは区別する。
- 出典: Database_Spec.md 10.4、quantities-requirements.md R16（仮を確定）
- 状態: 未実装。
- 受入: 必須欄が欠けた付与の応答は、有効になったとは返さない。外したあと値が残り、再度付けると元の値で有効になる。

### R6.6
拡張を適用するとき、remote は適用時点の定義の版に固定し、知らない定義と値も残す。agent を含む誰でも定義できる。権限の検査は後で足す。
- 出典: Database_Spec.md 10.2・10.3、quantities-requirements.md R17（仮を確定）
- 状態: 未実装。
- 受入: 定義の v2 を足しても、v1 で適用した node の意味が変わらない。未知の `extensionDef` を消さない。

### R6.7
最初の拡張を入れるとき、`m3e:nodeType:task` は `status`（`open`、`in_progress`、`blocked`、`done`、`dropped`。required、既定 `open`）、`assignee`（`list<nodeRef>`）、`due`（time）、`priority`（int。小さいほど高い）、`doneCondition`（string）を持ち、待ち合わせは relationType `m3e:blocks` の relation edge である。
- 出典: Database_Spec.md 10.5
- 状態: 未実装。
- 受入: 既定の task の `status` が `open` であり、列挙外の `status` は拒否される。`m3e:blocks` を作ったことを、読んだことや支持と同一視しない。

### R6.8
極性の拡張を入れるとき、`m3e:parentEdge:polarity` の `value` は `preserve`（既定）か `invert` であり、key は `m3e:parentEdge:polarity/value` である。
- 出典: Database_Spec.md 10.5、quantities-requirements.md R15
- 状態: 未実装。
- 受入: 欄が無い parent edge の極性は `preserve` として計算される。`invert` 以外の文字列は拒否される。

### R6.9
描画の宣言を定義に置くとき、定義は描画に読む attribute の key と、intrinsic size の決め方（文字の行、固定、attribute の値）を持ち、server もそれを読む。
- 出典: Database_Spec.md 10.6
- 状態: 未実装。
- 受入: scope の読み出しが、宣言にある attribute だけを返せる。宣言の無い node type はプレーンとして描き、値は捨てない。

### R6.10
node type が描くとき、描けるのは読む attribute、矩形の内側、内容から決まる intrinsic size だけであり、選択の枠、畳んだ子の数、alias と lock の印、drop 先、hit test、edge の接続位置、layout が決める位置には触れない。
- 出典: Database_Spec.md 10.6
- 状態: 未実装。
- 受入: measure と draw が pure function であり、入力が芯、宣言した attribute、位置、共通の状態だけである。measure は DOM を測らず、draw より前に答える。

### R6.11
一つの node に拡張が重なるとき、矩形の内側を描く node type は一つだけであり、残りは共通の側が印として並べる。
- 出典: Database_Spec.md 10.6（仮決めを確定）
- 状態: 未実装。
- 受入: task と別の node type を同時に持つ node で、内側の描画が一つであり、もう一方は印である。

### R6.12
`m3e:` 以外の接頭辞の node type を描くとき、描画は宣言と用意した部品の組み合わせだけで決まり、その node type はコードを持てない。
- 出典: Database_Spec.md 10.6（仮決めを確定）
- 状態: 未実装。
- 受入: `misc:` の node type に実行可能な描画コードを登録しても、server はそれを実行しない。

### R6.13
拡張の欄の型を検査するとき、remote は `string`、`int`、`float`、`bool`、`enum`、`time`、`timeExp`、`nodeRef`、`accountRef`、`list<T>` だけを許し、拡張の欄だけを schema-on-write とし、それ以外の attribute は schema-on-read とする。
- 出典: Database_Spec.md 3.3・10.7
- 状態: 未実装。
- 受入: `int` に 1.5 を書くと拒否される。拡張でない attribute の数値は型違反にならない。`nodeRef` は参照先が無くても保存でき、broken として扱われる。

### R6.14
時刻の canonical な形を書くとき、書き手は `YYYY-MM-DDTHH:mm:ss.sssZ` とし、`seq` と `rev` は絶対値が 2^53−1 以下の整数である。
- 出典: Database_Spec.md 10.7・6節
- 状態: 一部。`committedAt` は呼び出し側の時計の ISO 文字列である（`store.ts:123`、`store.ts:1286`）。ミリ秒と末尾 `Z` の検査は store に無い。
- 受入: 末尾が `Z` でない時刻や、ミリ秒の無い時刻は、拡張の欄と `committedAt` の両方で拒否される。

### R6.15
意味上の分類を持つとき、Principle、Vision、Strategy、Goal、Task などは `m3e:nodeType:<分類>` の拡張として持つ。
- 出典: Database_Spec.md 10.2
- 状態: 未実装。
- 受入: 分類だけの違いが、新しいレコード種別を増やさない。

### R6.16
接頭辞を Turtle へ書くとき、`m3e:` は `urn:m3e:` を、`misc:` は `urn:m3e:misc:` を指す。
- 出典: Database_Spec.md 14節
- 状態: 未実装。`prefix` レコードの型はあるが、この二つの URI を組み込みで書く処理は指定範囲に無い。
- 受入: 書き出した Turtle で、この二つの接頭辞がこの URI に展開される。

### R6.17
HTML を載せる種別を作るとき、中身は登録済みの component の種類と設定だけであり、生の HTML は載せない。移行では該当データが無いので何も作らない。
- 出典: record-schema.md DA41（推奨を確定）
- 状態: 未実装。
- 受入: 生の HTML 文字列を node の本文として保存する Command は拒否される。現行データの変換で、この種別の行が勝手に増えない。

### R6.18
agent の実行時の状態と伝言を保存するとき、remote は details に入れず、サーバのメモリに持つ。移行は attribute `m3e:agent` を一字も変えずに運ぶ。
- 出典: record-schema.md DA42（推奨を確定）
- 状態: 一部。変換は未知の attribute を残す（`to_snapshot.ts` の attribute 処理）。実行時状態を details から排除する専用検査は無い。
- 受入: 移行後の `m3e:agent` の文字列が変換前と一致する。伝言を details に書く Command は拒否される。

### R6.19
計算で求まる値の定義の名前は、`m3e:derived:<名前>` とし、その値はレコードに保存しない。
- 出典: Database_Spec.md 14節・9節
- 状態: 未実装。
- 受入: 極性や体積の現在値が snapshot のレコード欄に無く、定義名はこの接頭辞で引ける。減衰の累積は R4.22 のとおり例外である。

## 7 帯域・射影・書き戻し・named snapshot

### R7.1
帯域を保存するとき、保存される帯域は Rapid と Deep だけであり、Flash のまま保存される段階は無く、取り込んだものは Rapid になる。
- 出典: Database_Spec.md 12.1
- 状態: 未実装。
- 受入: Flash の入口から入った node が、保存後の scope の `band` では `rapid` である。Flash 用の第三の保存段階は無い。

### R7.2
Rapid と Deep を区別するとき、違いは保持の方針ではなく構造であり、scope は `band`（`rapid` または `deep`）を持つ。射影で作った面の `band` は必ず `rapid` である。射影で作られていない scope は、作るときに `band` を指定し、Flash から取り込んだものと手で作ったものは `rapid`、昇格で体系に入ったものは `deep` である。
- 出典: Database_Spec.md 12.1・12.6 KB1
- 状態: 未実装。`ScopeRecord` に `band` は無い（`types.ts:102-111`）。
- 受入: `projection` の有無だけでは帯域が決まらない。射影の scope に `band: deep` を書くと拒否される。

### R7.3
同じ実体を面をまたいで置くとき、実体は正本の面に一つだけ置き、他の面では alias を置く。一つの実体を指す alias はいくつあってもよい。
- 出典: Database_Spec.md 12.2、record-schema.md DA6
- 状態: 一部。alias の `target` はある（`types.ts:33-39`）。「正本の面に一つ」という検査は `invariants.ts` に無い。
- 受入: 同じ実体の二つ目の非 alias node は拒否される。面をまたぐ「同じもの」の問い合わせは、ラベルではなく `target` で集まる。

### R7.4
参照先を消したとき、alias は `broken` として残り、`target` の ID を保持し、子は消さない。同じ identity が復活し、その間に alias の `target` が別のものへ変わっていなければ再解決する。変わっていたら古い参照へ戻さない。
- 出典: Database_Spec.md 12.2、operation-algebra-requirements.md 10節
- 状態: 一部。`broken` の欄はある（`types.ts:38`）。削除時に自動で `broken` にする処理は、指定範囲の不変条件には無い（端点が消えると R2.6 で拒否される側）。
- 受入: 参照先の削除のあと alias の行が残り、`broken` が真であり、子が残る。Undo で同じ ID が戻ると、`target` を書き換えていない alias だけが再び解決する。

### R7.5
alias の `access` が read のとき、remote は参照先の実体の内容の編集を止め、alias の下に子を足すことは止めない。
- 出典: Database_Spec.md 12.2
- 状態: 未実装。
- 受入: read の alias 経由の本文更新は拒否され、その alias への子の追加は確定する。

### R7.6
射影を作るとき、入力は切り出す範囲（起点と深さ、または実体の集まり）と、木として読む関係（ある面の parent edge、または `reads` に従う relationType）であり、出力は新しい scope である。
- 出典: Database_Spec.md 12.3
- 状態: 未実装。
- 受入: 一つの Command で scope、alias、parent edge が揃って確定する。途中の面だけが公開されない。

### R7.7
射影の scope が持つとき、`projection` は `from`、`range`、`mode`（`observe` または `work`）、`work` のときだけの `baseSeq`、`dissolved` を持つ。
- 出典: Database_Spec.md 12.3・3.1
- 状態: 未実装。
- 受入: 観測用の面に `baseSeq` が無く、作業の面には射影時点の `seq` がある。

### R7.8
観測用のフィルタの面を保存するとき、remote は alias と parent edge のレコードを保存せず、scope と `projection` だけを保存し、木は読むたびに体系から求める。この面では構造の編集を受けない。
- 出典: Database_Spec.md 12.3・12.6 KB7
- 状態: 未実装。
- 受入: `mode` が `observe` の scope に対する move、追加、削除が拒否される。体系側の関係を変えると、次の読みの木が変わる。畳んだ状態は、実体の ID を鍵として Surface View の保存設定側にある。

### R7.9
作業の面に alias でない node を足すとき、remote はそれを、昇格するまでその面だけの Rapid の node として許す。
- 出典: Database_Spec.md 12.3
- 状態: 未実装。
- 受入: 作業の面だけに存在する node が、書き戻し前は Deep の実体を増やさない。

### R7.10
範囲に alias が入った射影を作るとき、新しい alias の `target` は元の alias の実体であり、alias を指す alias は作らない。射影した面をさらに射影しても参照は 1 段のままである。
- 出典: Database_Spec.md 12.3・12.2
- 状態: 未実装。
- 受入: 二段目の射影の `target` が、一段目の alias の ID ではなく実体の ID である。

### R7.11
関係が木にならない実体を射影するとき、remote は親ごとに alias を作る。兄弟の順は、元が parent edge なら元の `ord`、relation edge なら実体の ID の順である。
- 出典: Database_Spec.md 12.3
- 状態: 未実装。
- 受入: 親を二つ持つ実体が、面の中に二つの alias として現れ、relation edge 由来の兄弟が ID の文字列順である。

### R7.12
書き戻しを受けるとき、remote は対象を `projection.mode` が `work` の scope に限り、観測用のフィルタは書き戻すものを持たないものとして拒否する。
- 出典: Database_Spec.md 12.4
- 状態: 未実装。
- 受入: `observe` の scope への書き戻し Command が拒否される。

### R7.13
書き戻しの差分を適用するとき、remote は alias 間の parent edge の差分と `projection.dissolved` を、12.4 の表どおり体系側の move、relation edge の作り直し、関係の削除、または無変更へ写す。面から外したこと（OC1）は体系側を変えない。
- 出典: Database_Spec.md 12.4
- 状態: 未実装。
- 受入: 付け替え、追加、面から外す、関係を解く、兄弟の並べ替え、alias でない node の追加、alias の下の非 alias の子、の七つの行が、表の結果と一致する。並べ替えの書き戻しは、元が parent edge のときだけ `ord` を写す。

### R7.14
書き戻しの競合を判定するとき、remote は `projection.baseSeq` より後に体系側の同じ関係が変わっていた項目を `CONFLICT` で拒否し、位置も LWW ではなく CAS で扱う。他の項目の扱いを、その拒否で全部巻き戻すかは、Command の不可分性（R3.34）に従う。
- 出典: Database_Spec.md 12.4・5.2
- 状態: 未実装。
- 受入: 古い `baseSeq` の書き戻しが、変わった関係の項目を `CONFLICT` にし、変わっていない項目の結果が仕様の不可分性と一致する。

### R7.15
書き戻しが確定したとき、remote は `projection.baseSeq` をその `seq` へ進め、作業の面は残す。
- 出典: Database_Spec.md 12.4・12.6 KB4
- 状態: 未実装。
- 受入: 書き戻しのあと同じ面で続けて作業でき、次の差分の基準が新しい `seq` である。要らなくなった面は人の削除でだけ消える。

### R7.16
書き戻しが確定したとき、remote は確定後の状態を指す名前付き snapshot を作り、`namedSnapshot` のレコードと、その seq の時点の状態として Neo4j に保持する。欄は `id`、`name`、`seq`、`scopeId`、`reason`、`rev` である。
- 出典: Database_Spec.md 12.4・3.1・12.6 KB9
- 状態: 未実装。
- 受入: 書き戻しの `seq` の状態が Neo4j にあり、保持期限で消えない。削除は `namedSnapshot` を消す確認つきの操作だけで起き、消したときにその状態の保持を解除する。

### R7.17
すでに実在する Deep entity に結ぶとき、remote はその node を、その実体を `target` とする alias に変え、ID、面の中の位置、子を保つ。結びを外すときは alias でない node に戻す。別の binding レコードは置かない。一つの node が結べる実体は一つである。
- 出典: Database_Spec.md 12.4・12.6 KB8
- 状態: 未実装。
- 受入: 結びの前後で node の ID と子が同じであり、`alias.target` だけが増える。二つ目の実体への結びは拒否される。

### R7.18
昇格で同じ実体を指す node を二つ作らないとき、Command は node ごとに、新しい Deep entity にするか、すでにある実体へ結ぶか、まだ昇格しないか、を指定する。指定の無い結びは行わない。同じ実体かどうかの判断は人か AI agent が行い、system は候補を示してよいが自動では結ばない。
- 出典: Database_Spec.md 12.1・12.4
- 状態: 未実装。
- 受入: 判断が Command として残り、誤りは結びを外す Command で直る。自動で二つ目の実体が alias にならない。

### R7.19
意味のある状態の違い（as-is と to-be、在籍の前と後）を残すとき、書き手は版の履歴に頼らず、別の面か有効期間としてデータを置く。
- 出典: Database_Spec.md 12.1
- 状態: 未実装。
- 受入: 同じ node の二つの意味状態を、journal の過去行を読まずに現在のレコードから区別できる。

### R7.20
書き戻しの対象を決めるとき、対象は射影で作った新しい面だけである。すでにある面の中へ alias を置くことは alias の作成であり、書き戻しの対象にしない。`projection` は scope の欄のままで、alias のレコードに基準の欄は足さない。
- 出典: Database_Spec.md 12.8
- 状態: 未実装。
- 受入: 部分木の射影が新しい面を作り、その面だけが書き戻せる。既存の面への alias 追加では `baseSeq` が動かない。

### R7.21
時点の写しを残すとき、remote は実体の複製では表さず、明示的な状態か、`namedSnapshot` の `id` への参照で表す。
- 出典: Database_Spec.md 12.8、12.1
- 状態: 未実装。
- 受入: 「ある時点の担当」を新しい ID の node として複製せずに参照でき、参照先の名前付き snapshot が読める。

## 8 消す操作とコピー

### R8.1
消す操作を受けるとき、remote は出した時点の Command の種類で意味を決め、面の状態や alias の有無から後で読み替えない。当てはまらない操作は拒否し、理由と当てはまる操作を返す。
- 出典: Database_Spec.md 12.7
- 状態: 未実装。MCP の delete は一つの種類である（`mcp_service.ts:16`、`mcp_service.ts:58`）。
- 受入: 同じ見た目の「消す」が、Command の種類が違うと結果が違う。拒否の応答に、使うべき操作名がある。

### R8.2
面から外す（OC1）を alias に対して確定するとき、remote はその alias を消し、体系側と他の面の alias を変えない。alias でない node への OC1 は拒否する。
- 出典: Database_Spec.md 12.7
- 状態: 未実装。
- 受入: タスクの面から人の alias を外しても、組織の面の実体は残る。実体への OC1 は拒否され、OC3 か OC4 を案内する。

### R8.3
関係を解く（OC2）を確定するとき、射影した面では alias を消し、解いた親子を `projection.dissolved` に載せる。正本の面では、行き先を指定した move として受ける。親の無い node は作らない。
- 出典: Database_Spec.md 12.7
- 状態: 未実装。
- 受入: 作業の面で解いた親子が `dissolved` に残り、書き戻しまで体系側の関係は残る。正本の面で行き先の無い OC2 は拒否される。

### R8.4
実体を終える（OC3）を確定するとき、remote は node を消さず、`valid.to` に終了時刻を入れ、他の面の alias を生きたまま残す。`valid.from` と `valid.to` が無いことは、期間の指定が無く今も在ることと読む。元に戻すのは `valid.to` を消す Command である。
- 出典: Database_Spec.md 12.7 QB1、3.2
- 状態: 未実装。`NodeRecord` に `valid` は無い（`types.ts:41-54`）。
- 受入: 終了後も node と alias と子が残り、`valid.to` が canonical な時刻である。format 番号は上がらない。

### R8.5
`valid.to` を埋める確定の `touched` に、終えることを表す event kind を出す。仕様の例は `m3e:end` である。
- 出典: Database_Spec.md 12.7、3.2
- 状態: 未実装（`journal_archive.ts:81-94` にこの kind は無い）。
- 受入: OC3 の行の `touched` に終了の kind があり、ロック判定がそれを構造の変更として見られる。

### R8.6
実体を取り消す（OC4）を確定するとき、remote は node と、それを端点とする関係を消し、他の面の alias を同じ Command の中で `broken` にし、alias の子は巻き込まない。今の delete は OC4 に当たり、alias に対する今の delete は OC1 に当たる。
- 出典: Database_Spec.md 12.7 QB2
- 状態: 未実装。
- 受入: OC4 のあと、他の面の alias が `broken` で残り、その子は残る。`broken` は OC4 の結果と、参照先がまだ届いていない場合だけを表す。

### R8.7
OC3 または OC4 を alias から出したとき、対象は参照先の実体であり、remote は `access` が write のときだけ受ける。
- 出典: Database_Spec.md 12.7
- 状態: 未実装。
- 受入: read の alias からの OC4 は拒否される。write の alias からの OC4 は参照先を消す。

### R8.8
正本の面を移す操作（OC5）は、今は置かない。scope をまたぐ move の保留が解けるまで、remote はこの操作を受けない。
- 出典: Database_Spec.md 12.7 QB3、5.2 規則 8
- 状態: 実装済み。OC5 の Command は無い。
- 受入: 正本の位置を alias のあった面へ移す Command が、未対応として拒否される。

### R8.9
子を消すとき、node を消す操作は、その面での子孫も消し、alias の子は参照先を消しても消さない。
- 出典: Database_Spec.md 12.7
- 状態: 一部。現行の delete は部分木を消す意図を MCP が持つ（`mcp_service.ts` の delete）。参照先の削除と alias の子の分離は未実装。
- 受入: OC4 のあと、他の面の alias の子が残る。同じ面の子孫は、その面の node 削除では消える。

### R8.10
作業の面で、元が面の parent edge である関係を解いたとき、書き戻しは実体を、それが属する面の root の直下へ move する。専用の置き場は作らない。元が relation edge なら、その relation edge を消す。
- 出典: Database_Spec.md 12.7 QB5、12.4
- 状態: 未実装。
- 受入: 書き戻し後、解いた実体の親が面の root であり、別の保管用 node は増えていない。

### R8.11
コピーの意味を決めるとき、Command の種類が同一性（出現を増やすか、実体を複製するか）と時間（独立か、時点の写しか）を決め、引数が範囲、範囲の中の alias の扱い、置き先を決める。attribute と `collapsed` は常に写す。物理的な共有は意味を変えない。
- 出典: Database_Spec.md 12.8 JA1〜JA7、operation-algebra-requirements.md 11節
- 状態: 未実装。
- 受入: 同じ選択に対して、出現を増やす Command と実体を複製する Command の結果が違う。写した後も元に追従する第三の選択は無い。

### R8.12
出現を増やす範囲が node 一つ、部分木、scope のとき、結果はそれぞれ alias の作成、部分木の射影、面の射影である。実体を複製する同じ三範囲は、shallow copy、deep copy、scope copy である。
- 出典: Database_Spec.md 12.8、operation-algebra-requirements.md 11節
- 状態: 未実装。
- 受入: 表の六マスが、それぞれ新しい ID を作るか alias を作るかで区別できる。

### R8.13
範囲の中の alias の引数を省いたとき、remote は alias のまま写し、写した先も同じ実体を指す。写さない扱いと、参照先の実体も複製する扱いは、引数で選べる。
- 出典: Database_Spec.md 12.8 QD2（決定）
- 状態: 未実装。
- 受入: 引数を省いた deep copy のあと、範囲内の alias の `target` が元と同じ実体である。

### R8.14
範囲の外への参照を写すとき、範囲の中どうしは写した先へ付け替え、外を指す alias の `target` は共有し、境界をまたぐ relation edge は写さない。範囲の中の scope は中まで写す。shallow copy は選んだ node だけで、scope copy は同じ root の別の方向の scope を含めない。
- 出典: operation-algebra-requirements.md 11節（仮決めを確定）、Database_Spec.md 12.8 JA4・JA5
- 状態: 未実装。
- 受入: deep copy のあと、外側の実体を編集すると写した側の共有参照から見える。境界の relation edge は写った側に無い。

### R8.15
出現を増やす操作の置き先が別の workspace のとき、remote は拒否する。実体を複製する操作を使い、来歴に元の workspace と実体を残す。
- 出典: Database_Spec.md 12.8
- 状態: 未実装。
- 受入: 別 workspace への alias 作成が拒否され、複製は新しい ID になり、来歴が残る。

### R8.16
実体を複製したとき、remote は来歴に元、基準の通し番号、方式、ID 対応を残し、方式には選んだ引数の値を含める。出現を増やしたときは `target` が記録なので、別の来歴を持たない。他の面にある alias は複製に付いてこない。
- 出典: Database_Spec.md 12.8、operation-algebra-requirements.md 11節
- 状態: 未実装。
- 受入: journal の保持対象外の確定記録を削減したあとでも来歴が読め、人が後から引数の値を確認できる。複製先の実体は、元の実体が他の面に持っていた alias を持たない。

### R8.17
貼り付けのとき、remote は alias と relation edge の付随情報と `collapsed` を写す。
- 出典: Database_Spec.md 12.8 QD5、operation-algebra-requirements.md 11節
- 状態: 未実装。Database_Spec.md 12.8 は、現行の実装がこれらを落とす、と書く。
- 受入: 貼り付け後の alias の `access` と `collapsed` が、写す前と一致する。

### R8.18
食い違い。Database_Spec.md 12.8 と operation-algebra-requirements.md 11節は、貼り付けで alias、relation edge の付随、`collapsed` を写す、とする。両者が引用する Multi_Select の記述は、貼り付けでそれらを落とす、とする。
- 出典: Database_Spec.md 12.8、operation-algebra-requirements.md 11節、`docs/04_Architecture/Multi_Select.md`（両出典が食い違い先として名指し）
- 状態: Database_Spec.md 12.8 が「実装は、まだ落とす」と書く。指定範囲の copy 実装は未着手。
- 受入: 正とする側を決めたあと、貼り付け結果の `collapsed` が残るか消えるかが、その文面と一致する。

### R8.19
コピーの入口を分けるとき、出現を増やす copy と実体を複製する copy は別の入口であり、貼り付けは copy した時点の意味をそのまま行う。置き先が同じ面か別の面かで意味を変えない。clipboard は選んだ同一性を持ち、貼り付けの Command はその意味を種類として持つ。
- 出典: Database_Spec.md 12.8
- 状態: 未実装。
- 受入: 同じ面への貼り付けと別の面への貼り付けで、copy 時に選んだ種類が変わらない。

### R8.20
引数を省いたときの値は、仕様で一つに決まり、GUI、MCP、CLI で違わない。禁止の組み合わせは、どの入口からでも同じ理由で拒否する。MCP と CLI はすべての引数を受け、人の入口は少数の概念に絞る。
- 出典: Database_Spec.md 12.8
- 状態: 未実装。
- 受入: 出現を増やす × 別 workspace が、GUI からでも MCP からでも同じ理由で拒否される。省いた JA3 は R8.13 の値になる。

### R8.21
dissolve で、条件や根拠の行き先が無い中間 node を崩すとき、remote は拒否する。本文だけへの join で数値と単位の attribute が消えるときも拒否する。中身の無い中間 node 自身の色と配置の削除は、操作の仕様として明示して許す。
- 出典: operation-algebra-requirements.md 12節（仮決めを確定）
- 状態: 未実装。
- 受入: 根拠の relation edge を持つ中間 node の dissolve が拒否される。色と配置だけの中間 node の dissolve は、その削除を結果に明示して確定する。

### R8.22
group の対象が異なる親にまたがるとき、remote は拒否する。split は明示したリストの範囲を固定する。
- 出典: operation-algebra-requirements.md 13節
- 状態: 未実装。
- 受入: 二人の親の子を一つの group にすると拒否される。split の範囲外の兄弟は動かない。

### R8.23
ViewState だけの変化を書くとき、書き手は Model、journal、他者の選択や camera を変えない。見え方に依存する依頼は、具体的な値へ解決してから送る。
- 出典: operation-algebra-requirements.md 14節、Database_Spec.md 11節
- 状態: 一部。選択と camera はレコードに無い（R1.25）。依頼を具体値へ解決してから送る保証は、store には無い。
- 受入: camera の移動が journal の行を増やさない。畳み状態に依存する依頼が、解決前の ViewState を Command に含めない。

### R8.24
relation edge の向きを正規化するとき、端点を交換する操作は端点ごとの port も交換し、効果と逆に含める。両端を同時に付け替える relink を持つ。
- 出典: operation-algebra-requirements.md 10節
- 状態: 未実装。
- 受入: 端点を交換した Undo が、port も元に戻す。relink が一本の Command で両端を替える。

### R8.25
同じ実体を二つの方向に置くとき、書き手は alias を使い、alias の子はその面の子であって、子孫を共有して両方向に展開する仕組みにはしない。
- 出典: operation-algebra-requirements.md 9節、Database_Spec.md 12.2
- 状態: 未実装（alias の子が拒否される。R2.4）。
- 受入: 組織の面の子と、タスクの面の alias の子が、別の parent edge の集合である。

## 9 ロックと grant

### R9.1
ロックを保存するとき、remote はレコード `lock` を作り、key は対象の rk であり、外すときはレコードを消す。node や scope の欄にはしない。所有者の欄は置かない。
- 出典: Database_Spec.md 3.2、sync-requirements.md R2.6
- 状態: 未実装。
- 受入: ロックの掛け外しで対象 node の `rev` が内容の CAS のために進まない。誰が掛けたかは、掛けた Command の `issuer` と `actor` から分かる。

### R9.2
ロックを判定するとき、remote は確定のときの `touched` で行い、Command の種類では行わない。ロック中の対象が `m3e:delete` で現れるか、対象の parent edge が変わる確定を拒否する。拒否の理由は `LOCKED` であり、push の結果で `commandId` ごとに返す。
- 出典: Database_Spec.md 3.2、sync-requirements.md R2.6
- 状態: 未実装。拒否コードに `LOCKED` は無い（`store.ts:91`）。
- 受入: dissolve、join、祖先の削除、unscopen、Undo、取り込みのどれで対象が消えても、同じ `LOCKED` が返る。

### R9.3
ロックが掛かっているとき、remote は対象を消すことと、対象の parent edge の付け替えを止め、内容の編集、子の追加、兄弟順、祖先を別の親へ移すことは止めない。子孫には継承しない。祖先の削除が対象を巻き込むときも止めないでは済ませず、その Command を確定しない。
- 出典: sync-requirements.md R2.6、Database_Spec.md 3.2・12.7、sync-principles.md「merge の価値観」
- 状態: 未実装。
- 受入: root のロック中は root の削除が拒否され、ロックを外したあと通常の規則で評価される。ロックした node の子の削除、内容の編集、子の追加、兄弟順の変更、親を別の親へ移すことは確定する。親を消して対象が消える Command は確定しない。

### R9.4
ロックは出現ごとに付く。実体を終える操作と取り消す操作は、その実体の node と、それを指すすべての alias のどれかがロック中なら確定しない。ロックされていない出現を面から外す操作は、他の出現がロック中でも確定する。
- 出典: Database_Spec.md 12.7 QG1、sync-requirements.md R2.6
- 状態: 未実装。
- 受入: 出現 A がロック中のとき、出現 B から実体を終える Command は拒否され、B だけを面から外す操作は確定する。

### R9.5
作業の面での組み替えは下書きなので、参照先の実体がロックされていても alias の move は受ける。書き戻しのときに、ロックされた実体を動かす項目をロックを理由に拒否し、他の項目は、不可分性と両立する範囲で扱う。
- 出典: Database_Spec.md 12.7
- 状態: 未実装。
- 受入: 作業の面上の move が確定し、書き戻しの該当項目だけが `LOCKED` になる。

### R9.6
ロックを掛ける・外すのは、その scope を編集できる human である。外すときは確認を一回挟むだけで、承認は要らない。特定の人しか外せないロックは作らない。掛ける Command と外す Command は journal に確定し、Undo できる。ロックは対象に付き、掛けた人が権限を失っても残る。
- 出典: Database_Spec.md 3.2、sync-requirements.md R2.6、sync-principles.md「merge の価値観」
- 状態: 未実装。
- 受入: 掛けた本人以外の、その scope を編集できる human が外せる。掛けた人の編集権限を外したあともロックは残り、ほかの編集者が外せる。

### R9.7
AI agent はロックを掛けられる。外せるのは、その scope の有効な `m3e:unlock` の許可があるときだけである。
- 出典: Database_Spec.md 3.2、sync-requirements.md R2.6・R2.7
- 状態: 未実装。
- 受入: 許可の無い AI agent の解除が拒否される。human の解除は許可レコードを要求しない。

### R9.8
許可を保存するとき、レコード `grant` の欄は `scopeId`、`principal`（`{account: accountRef}`）、`capability`、`grantedBy`、任意の `expiresAt`、`rev` である。ロックを外す許可の capability は `m3e:unlock` である。付与も取り消し（レコードの削除）も Command である。
- 出典: Database_Spec.md 3.2、sync-requirements.md R2.7
- 状態: 未実装。
- 受入: 許可の行から、scope、相手のアカウント、種類、許可した human、期限が読める。

### R9.9
許可の効力を判定するとき、remote は確定の時点で期限内であり、許可した human がその scope を今も編集できることを要求する。期限は確定の `committedAt` で判定する。許可は与えた scope だけに効き、入れ子の scope へ継承しない。解除 Command の `issuer` が `grantedBy` と一致することは求めない。
- 出典: Database_Spec.md 3.2、sync-requirements.md R2.7
- 状態: 未実装。
- 受入: 期限後、許可した human の編集権限を外したあと、取り消しのあと、の三つの解除が拒否される。子 scope のロックは、親 scope の許可では外れない。

### R9.10
許可の来歴を追うとき、誰が許可していたかは journal の保持期間だけ追える。
- 出典: sync-requirements.md R2.7
- 状態: 未実装。
- 受入: 取り消し後、journal の保持期間の中では付与 Command が読め、保持対象外になったあとには読めなくてよい。

### R9.11
ロックは権限の代わりではない。権限の判定は別に行う。
- 出典: Database_Spec.md 3.2、sync-principles.md「merge の価値観」
- 状態: 未実装。
- 受入: ロックが無いことだけで、権限の無い編集者が書けるようにはならない。ロックがあっても、内容の編集の権限は通常の認可に従う。

## 10 同期（remote・outbox・push/pull・minSeq）

### R10.1
local の commit を完了通知するとき、local は Command の内容、`commandId`、依存を Neo4j の `Outbox` node に transaction で保存してから通知し、永続化に失敗した操作を完了にしない。outbox の 1 件は `{commandId, baseSeq, command, createdAt}` であり、`baseSeq` は作った時点で端末が知っていた最後の通し番号である。
- 出典: Database_Spec.md 2節、sync-requirements.md R4.1、ADR 014 Decision 4
- 状態: 未実装。指定範囲に outbox は無い。
- 受入: Neo4j の transaction の確定後・通知前に停止して再起動すると、同じ ID・内容・依存が復元される。容量不足で Neo4j の transaction が失敗すると、完了通知は出ず、未保存と分かる。

### R10.2
Command を端末の状態へ当てるとき、local は当てる前に outbox へ追記し、再読込や再起動のあと、残った Command を同じ `commandId` で送り直す。
- 出典: Database_Spec.md 2節
- 状態: 未実装。
- 受入: 再起動後に未送信件数が減らず、新しい ID に化けない。

### R10.3
送り方は HTTP の push と pull の一本である。push は outbox の Command を送り、`commandId` ごとの確定の通し番号か拒否の理由を受け取る。pull は指定した `seq` より後の journal を受け取る。Syncthing と `data.sqlite` 丸ごとの同期は使わない。
- 出典: ADR 014 Decision 5、sync-principles.md「remote と local」、Database_Spec.md 2節
- 状態: 未実装。指定範囲に push / pull の HTTP は無い。
- 受入: ファイルを丸ごと渡す同期経路が、確定の応答も拒否も返さないまま状態を変えない。push の結果が Command ごとに分かれる。

### R10.4
同期は手動である。local は local commit を理由に自動の push も pull も始めない。
- 出典: sync-requirements.md R6.1、sync-principles.md「remote と local」
- 状態: 未実装。
- 受入: online のまま同期操作をせずに待つと、remote の journal は増えない。明示の push のあとで初めて Command が remote に現れる。

### R10.5
接続状態を表示するとき、viewer は workspace ごとに、push・pull 可能、remote 到達不能、到達するが同期を拒否される状態を区別し、未送信件数を別の軸で示す。
- 出典: sync-requirements.md R1.1、sync-principles.md「remote と local」
- 状態: 未実装。
- 受入: workspace S の remote を切断し、T は到達できるが権限拒否にする。S は到達不能、T は同期拒否と表示される。未送信件数をゼロにしても、接続状態の判定は変わらない。

### R10.6
閲覧専用端末として動くとき、viewer は clone を作らず remote への問い合わせで読み、編集 Command を発行しない。
- 出典: ADR 014 Decision 5、sync-requirements.md R1.2
- 状態: 未実装。
- 受入: remote 切断後の新しい問い合わせは利用不能になり、local clone への切替や編集受付は起きない。

### R10.7
server、database、viewer は同じ端末に同居し、編集の確定 loop に network を挟まない。遠い server への接続は閲覧に限る。
- 出典: ADR 014 Decision 5
- 状態: 未実装。store は同じプロセスで確定できる（`store.ts:704`）が、同居を強制する構成は指定範囲に無い。
- 受入: 編集の確定が、remote への往復を待たずに local の outbox まで終わる。閲覧専用端末だけが遠い server を読む。

### R10.8
leader の移譲と remote の移動は明示の操作だけであり、自動 failover は作らない。remote が止まっていても local は commit を続けられる。
- 出典: ADR 014 Decision 4、sync-principles.md「remote と local」、sync-requirements.md R9.3
- 状態: 未実装。
- 受入: remote を止めても local commit が outbox に残る。移動先の検証が終わるまで、移動先を確定先として有効化しない。

### R10.9
remote を作り直すとき、届くすべての local から連続していて検証済みの最長の部分を集め、新しい履歴 ID と世代を発行し、古い remote には二度と書かせない。どこまで保全を確認できたかを画面に出す。
- 出典: sync-principles.md「remote と local」、sync-requirements.md R9.1・R5.1・R9.2
- 状態: 未実装。
- 受入: 旧 remote と旧 client を分断したまま新世代だけを発行すると、切替は完了しない。fencing のあと、旧側から新しい有効な確定が生じない。local ごとの最大番号だけでは完全な復旧と表示しない。

### R10.10
remote の保存媒体を失ったとき、remote は復旧した地点と、欠けたかもしれない確定の範囲を示し、欠けが無いと確認できない復旧を完全な復旧と表示しない。二媒体での保全は持たない。
- 出典: Database_Spec.md 5.2、sync-requirements.md R5.1、sync-principles.md「remote と local」、ADR 014 の確定点
- 状態: 未実装。
- 受入: 確定 101 の Neo4j の transaction を完了したあと、どの local も pull しないうちに媒体を失うと、「100 まで復旧、101 以降は欠けた可能性がある」と表示される。

### R10.11
受信内容を検証するとき、local は正しい remote が提示した履歴 ID、世代、到達地点を基準に、欠損、破損、取り違えを検出する。正当な番号の欠番が、非公開 scope の更新に由来することだけを理由に同期を失敗させない。
- 出典: sync-requirements.md R1.3
- 状態: 未実装。
- 受入: 同じ到達地点の応答について、途中の除去、内容の変更、別履歴への置換は検証が失敗する。remote 自身の矛盾の検出と、権限外 scope の更新量の秘匿は、この要件の不合格にしない。

### R10.12
読み込みが `minSeq` を受けたとき、remote はその番号以上の確定済み状態を Neo4j から返す。確定は Neo4j の transaction であり、非同期の反映を待つ状態は無い。再送には確定済みの結果を返す。
- 出典: Database_Spec.md 14節、neo4j-database-design.md
- 状態: 未実装（Neo4j を database にする実装中）。
- 受入: 確定した seq を minSeq として読み出すと、同じ確定を含む状態が返る。

### R10.13
権限を判定するとき、remote は pull と確定の両方を現在の権限で認可し、過去に clone や編集できたことを代用にしない。権限の単位は scope であり、認可は保存層ではなく提供層が行う。
- 出典: ADR 014 Decision 6、sync-requirements.md R3.1、sync-principles.md「権限」
- 状態: 未実装。指定範囲の store は scope の ACL を見ていない。
- 受入: 権限を失効させたあとの pull は新しい内容を返さず、書込権限を失った Command は確定しない。失効前の outbox は、それだけを理由に消えない。

### R10.14
食い違い。ADR 014 Decision 6 は、複製の単位を workspace とする。sync-principles.md「権限」は、複製の単位を scope とし、local は権限のある scope だけを clone する、と書く。sync-requirements.md R6.5 は、配送時に scope と開示権限を適用する。
- 出典: 上記
- 状態: どちらも未実装。store は workspace ディレクトリ単位である（`store.ts:3-5`）。
- 受入: 正とする単位で、S だけを許された端末の保存内容に T の本文が無いか、workspace 全体が届くかが分かれる。viewer の非表示だけでは合格にしない。

### R10.15
人または AI agent の問い合わせを処理するとき、local は保持する権限状態で可視範囲を適用し、端末内にデータがあることを開示許可とみなさない。
- 出典: sync-requirements.md R3.2
- 状態: 未実装。
- 受入: S だけを閲覧できる AI agent への、T を明示した問い合わせ、検索、関連取得が、T の内容を返さない。viewer の非表示設定の解除では迂回できない。

### R10.16
offline で権限失効をまだ受信していないとき、local は取得済み内容の利用と local commit を続けられ、それらが remote で確定できるとは表示しない。
- 出典: sync-requirements.md R3.5、sync-principles.md の Q4 に対応する決定
- 状態: 未実装。
- 受入: 切断中の local commit が outbox に残る。再接続後は現在の権限で拒否され得る。切断中に閲覧できたことは、権限試験の失敗にしない。

### R10.17
relation edge を表示・配送するとき、remote は両端が同じ scope にあるものだけを可視化の対象とし、両端の scope が違うものの内容は配送しない。履歴の格納先は source 側の scope である。
- 出典: Database_Spec.md 3.4、sync-requirements.md R3.4（仮決めを確定）、sync-principles.md「権限」
- 状態: 未実装。relation edge は scope の ID を持たない（`types.ts:81-97`）が、配送時のフィルタは無い。
- 受入: source が S、target が T の edge は、S と T の両方を読める主体にも label が届かない。履歴は S の保持に計上される。

### R10.18
参照先が現在の複製に無いとき、local は未取得、削除済み、権限外を混同せず、判定不能であることだけを理由に参照元を削除も移動もしない。開示不可の理由は利用者へ漏らさない。
- 出典: sync-requirements.md R6.8、sync-principles.md の推奨（参照先の欠けを許す。2026-11-22 の確定により採用）
- 状態: 未実装。
- 受入: 未 clone の T を指す alias が残る。後から T を取得すると、参照元への編集 Command を足さずに参照が解決する。

### R10.19
scope の snapshot または確定記録を取り込むとき、local は scope 内の順序と hash 鎖を、履歴 ID、世代、scope の ID、基点、到達地点に対応付けて検証する。要求した到達地点に届いていなければ同期完了としない。
- 出典: sync-requirements.md R6.6、sync-principles.md「権限」が導出として書く scope ごとの番号と hash 鎖
- 状態: 未実装。
- 受入: 中間の欠落、順序の交換、別 scope の混入は取り込まれない。古い prefix だけが返った場合、既存の検証済み状態は維持され、同期完了にはならない。

### R10.20
所有または権限に関わる一確定を、複数 scope の断片として取り込むとき、local は必要な可視部分が揃うまで途中状態を通常状態として公開せず、同じ `commandId` の別断片を重複として捨てない。
- 出典: sync-requirements.md R6.7
- 状態: 未実装。
- 受入: S から T への移動で T 側が先に着いても、node が二つの親を持つ状態を通常表示しない。両断片の再送で二重適用されない。

### R10.21
必要な確定記録が保持対象外になった scope を更新するとき、local はその scope の検証済み snapshot を基点に取り直し、outbox を保全したまま前提と元の結果を再照合する。古すぎる判定は scope ごとに行う。
- 出典: sync-requirements.md R6.9、sync-principles.md「過去の情報の残し方」、ADR 014 Decision 5
- 状態: 未実装。
- 受入: 保持期間より長く停止した local が、再取得後も未送信と結果不明の Command を残す。古い前提値を黙って現在値へ変えない。

### R10.22
push を始めるとき、remote は要求全体の世代、履歴 ID、hash 鎖に関する abort 条件を、最初の Command の確定前に検証する。
- 出典: sync-requirements.md R6.2
- 状態: 未実装。
- 受入: 複数 Command の末尾に不正な検証情報があると、先頭の Command も確定しない。

### R10.23
abort 条件を通過した push を処理するとき、remote は Command ごとに結果を確定し、ある Command の conflict や reject だけを理由に独立した Command を止めない。
- 出典: sync-requirements.md R6.3
- 状態: 未実装。
- 受入: A が conflict、B が A に依存、C が独立なら、A は conflict、B は未実行、C は確定となり、結果が ID に対応する。

### R10.24
push の途中で停止、通信断、fencing が起きたとき、remote は既に成立した確定を維持し、未確定部分と区別して照会できる。
- 出典: sync-requirements.md R6.4
- 状態: 一部。1 件のファイル追記は fsync する（`store.ts:1338-1348`）。複数 Command の push を途中で分けるプロトコルは無い。
- 受入: 二件目の確定後、三件目の前に停止すると、復旧後に二件は一度だけ成立し、三件目は確定済みと偽らない。

### R10.25
remote の Neo4j で確定済みで、local がまだ pull していない間の push 結果は、確定の通し番号である。
- 出典: Database_Spec.md 14節
- 状態: 未実装。push が無い。local の `commitMapCommand` は成功時に `seq` を返す（`store.ts:1320`）。
- 受入: push の成功応答に通し番号があり、拒否には理由のコードがある。

### R10.26
編集状態を表示するとき、viewer は local 保存済み、remote 確定済み、local 取り込み済み、結果不明、park または reject による未実行を区別し、取り込み前に意図を表示から消さない。
- 出典: sync-requirements.md R10.3
- 状態: 未実装。
- 受入: push の成功を受けても取り込みを遅らせると、編集が消えず取り込み待ちと分かる。取り込んだあと一度だけ確定表示へ移る。

### R10.27
同期・復旧・競合の状態を問い合わせられたとき、remote は権限の範囲内で、Neo4j の確定地点、local の pull の到達地点、scope ごとの到達地点、Command の結果、依存による停止理由、resolution、実行主体と端末、容量計測の範囲を返す。権限外の本文は診断へ出さない。
- 出典: sync-requirements.md R10.4
- 状態: 未実装。
- 受入: 適用停止、応答喪失、依存の park、媒体喪失のそれぞれで、確定済みと適用済みと未確認が区別できる。

### R10.28
remote の clone から local を新しく成立させるとき、local は新しい端末 ID を使い、復元した Command の ID、内容、依存は維持する。
- 出典: sync-requirements.md R9.4
- 状態: 未実装。
- 受入: 定期 export から復旧した remote を clone して二つの local を作ると、端末 ID は異なり、保全して戻した Command の ID は変わらない。

### R10.29
client が互換範囲外のとき、local は push を止め、outbox の原内容を保全したまま更新し、意味や前提が変わる変換を同じ Command の再送として実行しない。
- 出典: sync-requirements.md R9.5
- 状態: 未実装。
- 受入: 旧 client の未送信 Command が、更新の失敗後も原内容のまま残る。意味が変わる変換は同じ ID で実行されない。

### R10.30
schema、merge、権限、保持の規則を変えるとき、remote は過去の確定を新規則で黙って再解釈せず、保持対象の履歴について従来の確定結果を復元できる。
- 出典: sync-requirements.md R9.6、operation-algebra-requirements.md 6節
- 状態: 一部。replay は保存した `ops` を使う（R3.33）。規則オブジェクトを版ごとに持つ機構は無い。
- 受入: 仮決めの規則を変えたあと、変更前の snapshot と journal の replay が、元の確定値と解決結果を返す。現在状態を新規則へ変える必要があれば、別の明示の変更として識別できる。

### R10.31
crypto-shredding の成功を通知するとき、remote は管理対象内の消去対象を復号不能にし、旧 snapshot や backup からの復旧で再び読める状態にしない。取り出し済みの平文の回収は保証しない。
- 出典: sync-requirements.md R8.8・R9.7
- 状態: 未実装。
- 受入: 消去前の snapshot から復旧しても、消去対象は読めない。消去状態を確認できない復旧は完了しない。消去の単位と鍵の配置は 14 に残り、実装者が単位を決めて合格にしない。

### R10.32
大量投入が続いているとき、remote は対話 Command を優先し、後から来る大量投入だけによって対話 Command を無期限に追い越させず、実行中 Command の不可分性と依存順序を維持する。
- 出典: sync-requirements.md R10.2
- 状態: 未実装。確定は到着順の一本である（`store.ts:704`）。
- 受入: 大量投入を途切れさせずに独立した小さな対話 Command を入れると、実行中と必要な先行依存の完了後に対話 Command が処理される。待ちの原因を確認できる。

### R10.33
性能を測定するとき、測定は dataset、node 数、本文量、Command の種類と大きさ、outbox 件数、並列度、機材、回線を固定して記録し、楽観表示、local 永続化、remote 確定、local 取り込みを別々に測る。失敗や保留を、成功時の待ち時間だけから除外しない。
- 出典: sync-requirements.md R10.1
- 状態: 未実装。
- 受入: 同じ条件で再試行できる測定記録が得られる。

### R10.34
復旧対象に、内容に加えて権限、未解決 conflict、必要な Command 結果、世代、履歴 ID、端末の失効、消去の状態を含める。
- 出典: Database_Spec.md 5.2、sync-requirements.md R5.5
- 状態: 未実装。Neo4j を database にする実装と、管理状態を含めた clone / export の検証が必要である。
- 受入: 端末の Neo4j を remote の clone から、remote の Neo4j を定期 export から復旧すると、失効した権限と失効した端末が復活しない。未解決 conflict が残る。

### R10.35
Neo4j の状態を clone / export として公開するとき、対象範囲・履歴 ID・世代・到達地点・検証情報を特定でき、未完成の payload を有効な復旧基点にしない。
- 出典: sync-requirements.md R5.6、neo4j-database-design.md
- 状態: 未実装（Neo4j を database にする実装中）。
- 受入: 途中で停止した payload からの復旧は完了せず、完全な payload からは対応する状態を Neo4j に復元できる。

### R10.36
二つの scope にまたがる変更には、両方の scope への書き込み権限が要る。
- 出典: sync-principles.md「権限」
- 状態: 未実装。
- 受入: 片方の権限しか無い編集者の、両 scope を触る Command が確定しない。

### R10.37
権限の変更も journal に記録する。外したあとの local には消去を指示するが、すでに渡ったデータの回収は保証しない。
- 出典: sync-principles.md「権限」
- 状態: 未実装。
- 受入: 権限を外す Command が journal に残り、再接続した local が対象 scope の新しい内容を受け取らない。切断中に既に持っていた平文の消去完了は、R10.31 の範囲を超えて要求しない。

### R10.38
死んだ端末を登録から外すのは、明示の操作だけである。
- 出典: sync-principles.md「過去の情報の残し方」
- 状態: 未実装。
- 受入: 長く接続が無いことだけでは端末登録が消えず、明示の操作のあとで失効が復旧状態に含まれる。

### R10.39
journal と outbox は Neo4j の `Commit` node と `Outbox` node に置く。JSON は push / pull / clone の wire format と export に用いる。
- 出典: sync-principles.md「データの形」、neo4j-database-design.md
- 状態: 未実装（Neo4j を database にする実装中）。
- 受入: 状態の保存と再送が JSON Lines ファイルに依存しない。

## 11 計算で求まる値と減衰の累積

### R11.1
正本から計算で求まる値を扱うとき、remote はそれを正本のレコードに入れず、確定のときに計算して手元にキャッシュし、agent は読むだけで計算を待たない。Neo4j にも置く。
- 出典: Database_Spec.md 9節
- 状態: 未実装。
- 受入: 極性、活動、体積の現在値が snapshot の対象レコードに無く、読み取り API が値を返す。agent が計算方法を送らなくても読める。

### R11.2
時間で減る値を読むとき、読み手は最後に確定したときの値と時刻から、掛け算 1 回で今の値を出す。
- 出典: Database_Spec.md 9節
- 状態: 未実装。累積の保存が無い（R4.22）。
- 受入: 同じ `{v[k], t}` と評価時刻から、二度の読みが同じ値になる。

### R11.3
各量を返すとき、意味、定義の版、対象範囲、パラメータ、基準にした確定の位置、評価時刻、欠測の有無を識別でき、観測した事実、推定、目標を区別し、未観測を 0 と返さない。
- 出典: quantities-requirements.md 2節・R1
- 状態: 未実装。
- 受入: 定義や観測範囲が違う値を、同じ意味の値として返さない。欠測の応答が 0 ではない。

### R11.4
node の書かれる頻度を数えるとき、remote は node か自身の details に実際の差分を与えた確定を node ごとに 1 件と数え、node と details を同時に変えても 1 件であり、再送、拒否、作り直し、`rev` だけの差分では増えない。計算で求まる値だけが変わった子孫には足さない。減衰には確定時刻を使う。
- 出典: quantities-requirements.md R4、Database_Spec.md 6節
- 状態: 一部。`touched` が `rev` だけの差を除く（`journal_archive.ts:87`、`journal_archive.ts:115`）。頻度のカウンタは無い。
- 受入: 履歴削減なし、途中で履歴削減、履歴削減後にキャッシュを捨てる、の三経路で、同じ定義と評価時刻の頻度が一致する。

### R11.5
内容の変更と確認の申告を、別の出来事として保存する。確認は、対象とした内容の版に結び付く。
- 出典: quantities-requirements.md R5（仮を確定）
- 状態: 未実装。
- 受入: 内容を変えない確認が履歴削減後に残る。v1 を読んだあとに v2 ができても、v1 の確認を v2 の確認とみなさない。

### R11.6
scope の書かれる頻度を出すとき、出来事は当時の所属先に計上し、node を移しても移動前の scope の出来事を移動先へ付け替えない。
- 出典: quantities-requirements.md R6（仮を確定）
- 状態: 未実装。
- 受入: S で起きた確定が、node を T へ移したあとも S の頻度に残る。

### R11.7
更新の目標を持つとき、node ごとに目標は一つであり、間隔と充足条件（内容の変更、確認、どちらでも）を指定できる。既定の充足条件は内容の変更である。未設定、休止、正の間隔を区別する。
- 出典: quantities-requirements.md R7・Q2（推奨を確定）、Database_Spec.md 6節の `m3e:target`
- 状態: 未実装。
- 受入: 内容の変更を求める目標は、確認だけでは満たされない。目標を作る、変える、休止するだけでは、内容の変更時刻は進まない。

### R11.8
遅れ具合を返すとき、目標の版、最後の対象の出来事、評価時刻と対応させる。基準の出来事が不明なら遅れ具合も不明である。古い目標で計算した値を、新しい目標の値として返さない。
- 出典: quantities-requirements.md R8（仮を確定）
- 状態: 未実装。
- 受入: 目標の間隔を変えた直後の遅れが、新しい目標の版として識別できる。

### R11.9
出所の自動の候補は「返したことを観測した」候補として記録し、明示の出典は申告として記録する。実際の取得元と、取得した版を持つ。再送や復元で候補を取り直さない。alias を通して本文を取ったとき、alias の場所だけを取得元にしない。
- 出典: quantities-requirements.md R9（仮を確定）、Database_Spec.md 6節の observed / declared
- 状態: 一部。確定の `provenance.items` は observed と declared を残す（`mcp_service.ts:317-336`）。取得元を alias と実体で分ける記録は無い。
- 受入: 同じ Command の再送で observed の件数が増えない。alias 経由の読みの取得元が、参照先の実体と版である。

### R11.10
出所の公開を分けるとき、共有の側には明示の出典だけを出し、自動の候補と個人の足跡は本人と任された agent だけが見る。同じ map を見られることだけでは、閲覧の行動を公開しない。
- 出典: quantities-requirements.md R10・Q3（推奨の 2 番目を確定）
- 状態: 未実装。
- 受入: 共有の読み手の応答に、自動候補と個人の足跡が無い。共有の範囲を後で変えても、同じ方針が当たる。

### R11.11
出所を 100 件に切るとき、順序は、採用してよい候補を決める、版を含めて重複を除く、明示の出典を優先する、100 件に切る、である。切ったときは不完全とする。非公開の候補が増えても、公開する一覧と件数は変わらない。
- 出典: quantities-requirements.md R11（仮を確定）、Database_Spec.md 6節（journal の provenance は別に 100 件）
- 状態: 一部。journal の `provenance` は 100 件で切る（`provenance.ts:10`、`provenance.ts:48`）。公開用の出所一覧の順序は無い。
- 受入: 101 件目で不完全の印が付く。非公開候補を足しても、公開一覧の件数は変わらない。

### R11.12
足跡を集計するとき、届いた端末の分を合算し、観測期間、対象の端末、欠測を識別できる。同じ集計を 2 回受けても倍にならない。未接続や記録の喪失を「読まれていない」と扱わない。
- 出典: quantities-requirements.md R12（仮を確定）
- 状態: 未実装。
- 受入: 同じ端末の同じ期間の報告を二度入れても足跡が倍にならない。欠測がゼロ閲覧と区別できる。

### R11.13
参照を数えるとき、今ある参照の数と、参照が作られた回数を区別し、関係の型、向き、作った主体を識別する。
- 出典: quantities-requirements.md R13
- 状態: 未実装。
- 受入: 作る、消す、作る、のあと、今ある数は 1、作られた回数は 2 である。

### R11.14
体積を数えるとき、面への構造上の所属から数え、返す構造と同じ確定の位置に揃える。折りたたみ、画面の移動、遅延読み込みでは変わらない。
- 出典: quantities-requirements.md R14（仮を確定）、Database_Spec.md 9節、Glossary.md 体積
- 状態: 未実装。
- 受入: 同じ `seq` で、畳んだ状態を変えても体積が同じである。

### R11.15
有効な極性を計算するとき、map の root からの主木の経路上で、反転する parent edge の数の偶奇とする。alias は置かれた位置の符号を持ち、参照先の符号は別に取れる。scope だけを開いても同じ node の符号は変わらない。一般の論理式の否定までは保証しない。
- 出典: Database_Spec.md 9節・10.5、quantities-requirements.md R15
- 状態: 未実装。
- 受入: 同じ node を別の scope から読んでも符号が同じである。祖先の反転で子孫の有効な極性が変わっても、その子孫を実際の差分の一覧には足さない。

### R11.16
本文と、本文から取り出した欄のどちらを運用に使うかを決め、取り出した元の版を追える。本文だけを変えたあと、古い欄を「今の本文から取り出した」と扱わない。
- 出典: quantities-requirements.md R19（仮を確定）、Database_Spec.md 10.4
- 状態: 未実装。
- 受入: 本文を更新したあと、抽出欄の版が本文の版より古いと分かる。

### R11.17
agent に任せる範囲を検査するとき、目標の変更だけを、対象と許す間隔の範囲付きで任せ、task の解除と定義の変更は既定では任せない。汎用の attribute 更新、一括の変更、取り込み、Undo でも、この権限を回り込めない。
- 出典: quantities-requirements.md R20・Q4（推奨を確定）
- 状態: 未実装。
- 受入: 範囲外の間隔への目標変更が拒否される。attribute の一括更新で task の拡張が外れない。

### R11.18
温度を出すとき、選択肢、確率の出所、正規化を定めた選択問題だけに出し、それ以外は未定義とする。全 scope に自動で集めない。
- 出典: quantities-requirements.md R21（仮を確定）、Database_Spec.md 9節（式は未決だったが、出す条件は Q の推奨で確定）
- 状態: 未実装。
- 受入: 選択問題でない node の温度が「未定義」であり、0 ではない。

### R11.19
食い違い。quantities-requirements.md Q5 の推奨は、同時 16 の読みで、通常の面（約 10 node）の p95 が 200 ms 以内、最大の面（約 1,100 node）の p95 が 1 秒以内、統計の遅れが 60 秒以内、とする。sync-requirements.md R10.1 と K14 は、数値目標は未決であり、未承認の数値を合否基準にしない、とする。2026-11-22 の「推奨で確定」は Q5 を要件側へ寄せるが、R10.1 の文面は残っている。
- 出典: 上記。検証規模の前提は quantities-requirements.md R22（100 万 node、面は通常 10、最大約 1,100、十数の同時読み）
- 状態: 未実装。指定範囲にこの計測は無い。
- 受入: 正とする側が Q5 なら、上記の p95 を超えた測定は不合格である。正とする側が R10.1 なら、この数値を合否に使った報告は不合格である。

### R11.20
scope ごとの整列済みの木を実行時に持つとき、利用のたびに正本を走査して整列し直すことはせず、agent が scope に居る間はその木を直接編集し、有効なキャッシュがある scope へ戻ったときは再利用する。正本への保存は scope の退出を待たない。
- 出典: record-schema.md DA30・DA31・DA32
- 状態: 未実装。store は確定のたびに map の射影を作り直す（`store.ts:1234-1241`）。
- 受入: 同じ scope に居る間の編集が、別のキャッシュを二重に更新しない。退出前の確定が journal に残る。

### R11.21
変更の通知を送るとき、通常は scope、通し番号、変わった node の ID の一覧だけを、その scope に居る agent へ送る。alias の参照先のラベルが変わったら、alias がある scope にも通知する。どの agent がどの scope に居るかは保存しない。一つの agent は同時に複数の scope に居てよい。
- 出典: record-schema.md DA9・DA20・DA10・DA11
- 状態: 一部。居ることはレコードに無い（R1.25）。scope 単位の軽い通知は、指定範囲の store には無い。MCP は参加の event をメモリに持つ（`mcp_service.ts:30`）。
- 受入: 通知の通常形に本文が無く、関係する node のときだけ詳細を取りに行ける。再起動後に「誰がどの scope に居たか」は復元されない。

### R11.22
適用した番号と受け取った番号を分けるとき、通知を受けただけで中身を取っていない部分は古いと印を付け、キャッシュの番号を進めるのは実際に適用したところまでである。
- 出典: record-schema.md「確定の仕組み」
- 状態: 未実装。
- 受入: 通知だけを受けた cache の番号が、中身を適用する前に進まない。

## 12 MCP と API の入口

### R12.1
MCP の書き込みを受けるとき、入口は `m3e_context`、`m3e_get`、`m3e_create`、`m3e_update`、`m3e_delete`、`m3e_feedback` であり、未知の tool は拒否する。
- 出典: Database_Spec.md 6節が MCP の参加を出所の源とする。実装の入口は `mcp_service.ts:16`
- 状態: 実装済み（`mcp_service.ts:16`、`mcp_service.ts:358`）
- 受入: 一覧に無い tool 名が `UNKNOWN_TOOL` になり、状態が変わらない。

### R12.2
MCP が store の上で確定するとき、observed は参加が見せられた record の read set であり、rk と読んだ時点の `rev` を持つ。見せられたものは、`m3e_get` が返したページの node（details を含む）と relation edge、および変更の event が本文を見せた node である。
- 出典: Database_Spec.md 6節
- 状態: 実装済み（`mcp_service.ts:299-310`、`mcp_service.ts:449`、`mcp_service.ts:261`、`mcp_service.ts:273`、`store.ts:605` の `shownRecords`）
- 受入: get のページ外の node が、その get を理由に observed へ入らない。本文を見せた変更 event の node は入る。

### R12.3
read set を参加ごとに持つとき、新しい順に 10,000 件まで残す。
- 出典: Database_Spec.md 6節
- 状態: 実装済み（`mcp_service.ts:24`、`mcp_service.ts:307-309`）
- 受入: 10,001 件目を見せると、最も古い rk が read set から落ちる。

### R12.4
確定のときに observed を作るとき、読んだあとで他の発行者が書き換えた record と、消えた record は外し、自分で書き換えた record は読んだ時点の `rev` のまま残す。
- 出典: Database_Spec.md 6節
- 状態: 実装済み（`mcp_service.ts:330-334`、`mcp_service.ts:37` の `ownSeqs`）
- 受入: 他者の確定で `rev` が進んだ rk が items に無く、自分の確定で進んだ rk は読んだ `rev` のまま残る。

### R12.5
declared を作るとき、中身は copy の出所の subtree だけであり、並びは declared が先、次に observed を新しく読んだ順である。上限 100 件はこの順で埋める。
- 出典: Database_Spec.md 6節
- 状態: 実装済み（`mcp_service.ts:517-518`、`mcp_service.ts:329-334`）
- 受入: copy の確定で、出所の subtree の rk が observed より前に並ぶ。出所を明示する別引数は、この要件では要求しない（仕様が「まだ無い」と書く範囲）。

### R12.6
SQLite の上で動くとき、`provenance.items` は空になる。道具の名前は残さず、`intent` は残る。
- 出典: Database_Spec.md 6節
- 状態: 実装済み（`mcp_service.ts:319` は store が無いと空の items を返す。intent は `mcp_service.ts:57-64`）
- 受入: store が無い参加の確定で items が空であり、journal または Command の intent は残る。

### R12.7
MCP が新しい relationType または、node にまだ無い attribute の key を受けるとき、接頭辞が無ければ拒否し、既にある key の更新と削除は受け付ける。
- 出典: Database_Spec.md 3.8
- 状態: 実装済み（`mcp_service.ts:50-51`、`mcp_service.ts:499`、`mcp_service.ts:668`）
- 受入: `misc:` の無い新しい key が `INVALID_ARGUMENT` になり、既存の無接頭辞 key の更新は受理される。

### R12.8
Command の ID を MCP が受けるとき、空でなく 200 文字以内の文字列だけを任意の `command_id` として通す。
- 出典: Database_Spec.md 5.1 の再送鍵。長さの検査は `mcp_service.ts:52-55`
- 状態: 一部。MCP は任意の `command_id` を検査する（`mcp_service.ts:457`）。store 側の再送鍵は map 単位である（R3.17）。
- 受入: 空の `command_id` が拒否される。同じ ID の再送が R3.17 の結果を返す。

### R12.9
細かいコピーと削除の引数を人が手で打たないときでも、MCP と CLI は JA1〜JA7 と OC1〜OC4 の引数をすべて受ける。人の入口は少数の概念に絞る。
- 出典: Database_Spec.md 12.8、12.7 の入口の節
- 状態: 未実装。MCP の create / update / delete の引数に、これらの軸は無い（`mcp_service.ts:453`）。
- 受入: MCP が同一性、範囲、JA3、置き先を指定でき、省いた値は R8.20 と一致する。

### R12.10
発行者を MCP の確定に書くとき、サーバが認証済みの接続から決め、画面や AI agent の自己申告は使わない。
- 出典: Database_Spec.md 5.1、record-schema.md DA14
- 状態: 未実装。`issuerOf` は Command の `actor` を使う（`legacy_api.ts:183-187`）。
- 受入: MCP の引数に書いた actor と、接続の認証主体が違うとき、journal の `issuer` は認証主体である。

### R12.11
通常の Beta の永続・検査・query・map の表示は Neo4j を用いる。launcher と server を含む利用経路で確認する。
- 出典: Database_Spec.md 0節、neo4j-database-design.md
- 状態: 未実装（Neo4j を database にする実装中）。
- 受入: 通常の Beta が Neo4j を読み書きし、`snapshot.jsonl`・`journal.jsonl` とメモリ上の record 集合を状態の保存先にしない。

## 13 移行（format 1→2、base snapshot）

### R13.1
現行の SQLite から snapshot を作るとき、入力は workspace の `maps` の各行であり、`state_json` は現行の AppState である。
- 出典: snapshot-format.md 3節、record-schema.md 7節
- 状態: 実装済み（`to_snapshot.ts:123`）
- 受入: 行の `id`、`tags`、`archived`、`pinned`、`source` と `state_json` 以外を、変換の意味の入力にしない。

### R13.2
ID を振り直すとき、対象は node、relation edge、注釈であり、map を ID の文字列順に、各種別の中では現行 ID の文字列順に見る。振り直すのは、既に使った ID、64 文字を超える ID、`[A-Za-z0-9_.:-]` 以外を含む ID だけである。parent edge、scope、surface の ID は常に新しく作る。
- 出典: snapshot-format.md 3.1、record-schema.md DA45
- 状態: 実装済み（`to_snapshot.ts:39-40` と ID 生成）
- 受入: 当たらない ID は元のままである。同じ入力の二度の変換が一致する。

### R13.3
node と details を分けるとき、本文、note、link のどれかがあるときだけ details を作り、空文字は書かない。`note` と `link` は details に置く。
- 出典: snapshot-format.md 3.2、record-schema.md DA39（推奨を確定）、Database_Spec.md 14節
- 状態: 実装済み（`types.ts:56-65`、`to_snapshot.ts` の details 生成）
- 受入: 本文も note も link も空の node に details の行が無い。note が node の欄に残らない。

### R13.4
現行の nodeType を写すとき、scope の境界を型で表していた値と `leaf` と欄なしは `text` として書き落とす。`alias` と `image` はそのまま残し、それ以外の未知の値もそのまま残す。
- 出典: snapshot-format.md 3.2、record-schema.md DA4・DA40
- 状態: 実装済み（`to_snapshot.ts` の nodeType 写像）
- 受入: 変換後の node に、scope の境界を意味する nodeType の値が残らない。`leaf` が `text` になる。

### R13.5
捨てる欄は、node の `scopeId` と `aliasOf`、表示状態の `selectedId`、行の保存時刻の写し、参照先と全件同値の `aliasOf` である。それ以外の未知の欄は `extra` に残す。`m3e:edge-label` は parent edge の `label` へ移し、attribute からは落とす。
- 出典: snapshot-format.md 3.2・3.4、record-schema.md DA40
- 状態: 実装済み（`to_snapshot.ts:37`、`to_snapshot.ts:60`）
- 受入: 変換後の node に `selectedId` が無く、edge の label が旧 attribute と一致する。

### R13.6
parent edge の `scopeId` を決めるとき、親から祖先へたどり、最初に出会う map の root または、scope の境界だった node の scope を付ける。`ord` は同じ親の子の並びから、厳密に増加する key として作る。親の子配列に無い子は、配列の後ろへ ID 順で並べる。配列にあるが実在しない ID は捨てる。
- 出典: snapshot-format.md 3.3、record-schema.md 7節
- 状態: 実装済み（`to_snapshot.ts` の connection 生成、`order_key.ts:184` の `assignOrderKeys`）
- 受入: 変換後の面の見え方が、変換前の「root の子は全部その scope の中」と一致する。同じ親の `ord` が重複しない。

### R13.7
relation edge の port が `auto` のとき、移行は値を書かない。値が無いことを自動とする。型定義に無い欄は `extra` に入れる。
- 出典: snapshot-format.md 3.3、record-schema.md DA44
- 状態: 実装済み（`types.ts:95-96` は任意。変換が `auto` を落とす）
- 受入: 変換後の行に `sourcePort: "auto"` が無い。読み戻すと自動として扱われる。

### R13.8
scope を作るとき、map の root と、scope の境界だった node ごとに一つ作る。現行の scope のうち root が実在しないものと、この規則で scope にならないものは、その surface と配置値ごと捨てる。保存されている scope の label は運ばない。
- 出典: snapshot-format.md 3.4、record-schema.md DA26
- 状態: 実装済み（`to_snapshot.ts` の scope 生成）
- 受入: 実在しない root の scope が snapshot に無い。運んだあとの表示名が root のラベルと一致する。

### R13.9
linear-text の key が scope の root を指さないとき、`orphanKey` に元の key を一字も変えずに残す。空文字の値は書かない。解決する anchor があるときは `anchorNodeId` も入れる。
- 出典: snapshot-format.md 3.4
- 状態: 実装済み（`types.ts:113-122`）
- 受入: 孤立した linear-text が消えず、空文字のエントリは行にならない。

### R13.10
注釈の現行の `kind` は `annotationKind` に改める。`scopeId` が解決しなければ欄を落とし、元の値を `extra.scopeId` に残す。
- 出典: snapshot-format.md 2節・3.4
- 状態: 実装済み（`types.ts:157-158`）
- 受入: 注釈の行の識別子 `kind` が `annotation` のままであり、pen と text の区別が `annotationKind` にある。

### R13.11
移行の発行者が無い過去を表すため、アカウント `acct_migration`（`accountKind` は `system`、表示名は「移行」）と、`seq` が 0 の `commit` を一つ入れる。
- 出典: snapshot-format.md 3.5、Database_Spec.md 3.7、record-schema.md DA48
- 状態: 実装済み（`to_snapshot.ts:38` の `MIGRATION_ACCOUNT_ID`）
- 受入: 変換直後の発行者がこのアカウントを指す。

### R13.12
逆変換を作るとき、snapshot から現行の AppState を作り直せ、許す差は、捨てると書いたもの、scope の root を境界の型へ戻すこと、欄なしと既定値の違い、振り直した ID、surface の ID を旧 ID へ戻さないこと、だけである。
- 出典: snapshot-format.md 4節、record-schema.md 7節
- 状態: 実装済み（`beta/src/shared/record_model/from_snapshot.ts:49`）
- 受入: 実装とは別に書いた検査が、現行の SQLite と snapshot を読んで問題 0 件である。往復の一致だけを合格にしない。

### R13.13
合否を判定するとき、変換の実装とは別に書いた検査が snapshot-format の 3節を一つずつ確かめ、問題が 0 件のときだけ切り替え、旧い DB は消さずに保管する。
- 出典: snapshot-format.md 5節、record-schema.md 7節
- 状態: 一部。検査の置き場は snapshot-format が `scripts/migration/judge_snapshot.py` と書く。指定した四ディレクトリの中には、その検査は無い。
- 受入: 問題が 1 件でもあると旧い DB が残り、切り替えが完了しない。

### R13.14
移行の対象は、この Mac の 3 workspace であり、Final と cloud 上の複製は対象外である。個人の workspace に残る試験用の map は、前もって保管に回す。
- 出典: record-schema.md DA46（推奨を確定）
- 状態: 未実装。変換関数は workspace を引数に取るだけで、対象の限定はコードに無い（`to_snapshot.ts:123`）。
- 受入: 移行手順が Final と cloud の複製を読まない。試験用の map を保管へ移す手順が、変換の前にある。

### R13.15
第 1 段の `command_log` は新しい journal へ再生しない。移行の時点を `seq` 0 とし、そこから新しい journal を始める。旧い記録は保管に回す。
- 出典: record-schema.md 7節
- 状態: 未実装。新しい journal を空から始める手順は、指定範囲の変換関数には無い。
- 受入: 移行直後の snapshot の `seq` が 0 であり、旧い command log の行が新しい journal に無い。

### R13.16
format を切り替えるとき、Neo4j の状態と `Head.format`・切り替え点の seq を更新し、切り替え点より前の journal の upcasting はしない。format 2 で足す record と欄の意味は維持する。
- 出典: Database_Spec.md 6節・7節、record-schema.md
- 状態: 未実装（Neo4j を database にする実装中）。
- 受入: clone / export の header から切り替え点が分かり、別の snapshot ファイルを書かずに状態を移行できる。

### R13.17
等しい `ord` は移行前のデータにだけ起こりうる。その間へ入れる Command は、等しい key を持つ兄弟の振り直しを同じ Command に含める。これは、非対象の兄弟を再採番しない規則の唯一の例外である。以前の base36 の key は読み込んだ時点で振り直す。
- 出典: Database_Spec.md 3.4、operation-algebra-requirements.md 8節
- 状態: 一部。新しい key の生成は base62 である（`order_key.ts:6-7`）。等しい key の兄弟を同じ Command で振り直す処理は、指定範囲に無い。
- 受入: 等しい `ord` の間へ入れる Command が、その兄弟の振り直しを含まないと拒否される。含めると、他の兄弟の key は変わらない。

### R13.18
map を複製するとき、複製は全 ID を振り直し、二つの map に同じ node の ID を残さない。
- 出典: record-schema.md IB54（監査が「第 2 段では複製時に ID を振り直す」と書く。推奨として確定）
- 状態: 未実装。`storeDuplicateMap` は状態をそのまま `saveWholeMap` する（`legacy_api.ts:172-176`）。
- 受入: 複製後の二つの map で、node、edge、注釈の ID が重ならない。

### R13.19
切替の時点で、旧い側の書き込みを止める手順を定め、問題が 0 件のときだけ切り替える。
- 出典: record-schema.md 7節
- 状態: 未実装。
- 受入: 切替中に旧い SQLite へ書いた変更が、新しい snapshot に黙って欠けることがない。欠ける場合は切替が完了しない。

## 14 未決

ここに書くものは要件ではない。実装も受入の合格条件もしない。

### U14.1
面の中を扱う順序付き index を足すかは、計測してから決める。永続・map の表示・全ての検査と query は Neo4j が担い、別の database への分割は要件にしない。
- 出典: Database_Spec.md 12.5・13節、implementation-log.md の 2026-11-22 の記録

### U14.2
facet（Glossary.md では、PJ 直下の第一階層の scope であり、意味単位として凝集しているもの）と、Database_Spec.md 12.1 の「一つの側面」を同じ語で呼ぶかは、Glossary の側で決める。保存の形には影響しない。
- 出典: Database_Spec.md 12.6 KB5、13節

### U14.3
消す操作（OC1〜OC4）を、どの鍵とどのメニューに割り当てるかは、配置を決める段階で決める。保存の形には影響しない。コピーの入口を分けること自体は R8.19 の要件であり、どの鍵をどの意味に当てるかは、同じ配置の段階まで未決である。
- 出典: Database_Spec.md 12.7 QB4、12.8「操作の入口」

### U14.4
出典が推奨を置かず、未定のままにしているもの。2026-11-22 の「推奨で確定」では埋められない。

- 入れ子の scope の権限で、祖先の拒否と子の許可のどちらを優先するか。全体を非公開にして一部を公開する使い方がある。受入条件は協議の後に書く。
  - 出典: sync-requirements.md R3.3、sync-principles.md「権限」、sync-requirements.md Q7
- 継承による保持期間の短縮の規則。R10 側の「短縮は確認つきの明示操作」は R4.20 として要件であり、継承の中身は R3.3 と合わせて未定である。
  - 出典: sync-requirements.md R8.4
- 一般の scope 権限の具体表。unlock の `grant` は R9.8 の要件である。それ以外の許可の形は、今回のレコードには入れないとだけ書いてある。
  - 出典: record-schema.md DA52・IB37、sync-requirements.md K5
- crypto-shredding の消去単位、鍵の共有単位、鍵の backup、offline 復元を許す条件。成功時の挙動は R10.31 の要件である。
  - 出典: sync-requirements.md K4・R8.8
- 単一 Command と push の最大 byte 数、変更対象数、依存数。
  - 出典: sync-requirements.md K10
- 操作の種類ごとの merge 表のうち、Database_Spec.md 14節の「位置は LWW、それ以外は CAS」と、R3.25 の観測集合削除と、R3.31 の未定義は人へ返す、で埋まらないマス。
  - 出典: sync-requirements.md K6・R7.7
- 容量計測に database、snapshot、共有履歴、二媒体、local outbox のどれを含めるか。
  - 出典: sync-requirements.md K9
- 完全な復旧を認定する inventory と、通常の remote 移動で履歴 ID を維持する条件。最大番号だけでは認定しない、という挙動は R10.9 の要件である。
  - 出典: sync-requirements.md K8
- Neo4j の製品同梱方式。R5.11 と同じ未決である。
  - 出典: ADR 014 Decision 2
- 複数の面の root である node を、ふつうに属する面でどう入口として見せるか。意味は「自分が root である面すべてへの入口を持つ」までが決まり、配置は GUI の手順で決める。
  - 出典: record-schema.md IB66
- edge が他の edge の端点であるときの削除の連鎖を、同じ確定で閉包ごと消すか、参照が残る削除を拒否するか。端点が実在しない状態を確定しないことは R2.6 の要件である。連鎖のどちらを自動で行うかは未定である。
  - 出典: record-schema.md IB59

---

## 15 食い違いの解決

本文で「食い違い」と書いた項目は、次のとおりに解く。原則は、2026-11-22 の「推奨で確定」に沿い、新しく、より個別に決めた側を正とすることである。正としなかった側の文書は、その文書の書き手が後で揃える。揃うまで、実装と受け入れはこの節に従う。

| 項目 | 正とする側 | 内容 |
|---|---|---|
| R1.3 | Database_Spec.md 2 節、ADR 014 Decision 4、sync-principles.md | journal は workspace に一本で、全順序は remote の sequencer が付ける。Neo4j の `Commit` node に置き、端末ごとの local outbox は `Outbox` node に置く |
| R2.5 | Database_Spec.md 3.2・4 節・12.2、Glossary | alias は子を持てる。10.1 の「alias は子を持てない」は、芯の種類を分ける理由を「参照先が必須であること」だけに直す |
| R3.9 | Database_Spec.md 5.2 規則 6 と 14 節 | 確定点は Neo4j の write transaction の確定である。成功の応答は確定後に返す。非同期の適用や journal より Neo4j が遅れる状態は無い |
| R3.16 | Database_Spec.md 3.4、operation-algebra-requirements.md 8 節 | key は確定する側が作る。ID による tie-break と、対象でない兄弟の振り直しはしない。ブロックは混ぜない。record-schema.md DA27 はこれに揃える |
| R3.23 | 両方（同じものの二つの言い方として読む） | Undo は、新しい Command を出して行う。その変更の一覧は、確定した差分の pre-image から作る（逆の molecule を組み立て直さない） |
| R4.13 | Database_Spec.md 6 節 | journal は Neo4j の `Commit` node に置き、保持対象外の確定記録は必要な状態の保全を検証して削減する。log compaction と journal の archive は置かない |
| R4.15 | Database_Spec.md 6 節 | scope の `retention.ms` が無いときの既定は 30 日（2,592,000,000）である |
| R4.18 | Database_Spec.md 12.1・12.4、sync-requirements.md R8.5（3d46acb 以降の版） | Deep も全版は残さない。昇格のときに `namedSnapshot` を残す |
| R8.18 | Database_Spec.md 12.8、operation-algebra-requirements.md 11 節 | 貼り付けは、範囲の中の alias、範囲の中で閉じた relation edge、`collapsed` を写す。Multi_Select.md を揃える |
| R10.14 | 両方（単位の違うものとして読む） | durability は Neo4j が担い、journal の確定系列は workspace に一本である。端末への配送と clone は scope 単位で、開示の権限を適用する（R6.5） |
| R11.19 | quantities-requirements.md Q5 | 同時 16 の読みで、通常の面（約 10 node）の p95 が 200 ms 以内、最大の面（約 1,100 node）の p95 が 1 秒以内、統計の遅れが 60 秒以内を、目標とする。合否の基準にするのは、計測の仕組みができてからである |

## 16 状態の欄について

各要件の「状態」は、dev-beta a17caba の時点でコードを読んで付けた。format 2 の土台（extensionDef、`extensions`、parent edge の `relationType` と `attributes`、不変条件 3 の改訂・9・10、format 1 から 2 への移行、Neo4j の拡張の label と epoch ミリ秒）は、その後に実装した。該当する要件の状態は、実装の各段の受け入れで更新する。
