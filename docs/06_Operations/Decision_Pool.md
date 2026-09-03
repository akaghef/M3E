# Decision Pool

会話や作業中に出た判断を、正式文書に昇格する前にためる場所。
新しい項目を上に追加する。

---

## 2026-08-29-001

- Date: 2026-08-29
- Topic: Agent Orrery — 公開範囲の緩和 / 色規約 / vault 往復 A / field 単位所有権 / Agent Card / connector
- Status: accepted
- Decision:
  - **session 本文の公開制限を緩和する（DC18）。** これは akaghef の目が行き届いている PC 全体の情報を集約するツールであり、`Title` / `msg` の生テキストを M3E map に出してよい。A-sys `data-classes.md` の fail-closed 分類は、A-sys が個人のメール・ノートを抱える文脈のものであって、自分の agent の session を自分で観測する文脈には適用しない。残す境界は「map を M3E の外へ配布・公開・共有する経路を作るときに改めて判断する」の1点のみ。
  - **色は7色の統一規約に従う（DC19）。** 正本 `.kiro/steering/color_semantics.md`。**map 全体の規約であり agent 固有ではない。** 青=正常稼働 / 黄=判断待ち / オレンジ=停滞・要注意 / 緑=完了 / 赤=異常 / 灰=アーカイブ / 白=未配色。色数を増やさず、表せない区別は文字・形・線種で表す。lifecycle state 10種はこの7色へ写像する（`unobservable`=白、`disconnected`=赤、`completed`=緑）。
  - **vault 往復は「同じ map を保つ」（DC20、A 案）。** export → 編集 → import は同じ node を更新する。`md_writer` / `md_reader` が既に持つ `m3e.nodeId` 方式を vault 経路へ適用する。現行実装は毎回新規採番であり、**Orrery に限らず vault 往復するすべての map で node 同一性が失われている**。Agent Orrery とは独立のデータ整合性の欠陥として本 ADR のスコープ内で直す。
  - **所有権は node 単位ではなく field 単位（DC21）。** body=人 / `m3e:actor.*`=connector（毎観測で上書き）/ `m3e:role.*`=人（connector は初回のみ提案）/ Realm・Name=connector / prefix なし attribute=人。node 全体に持ち主を1つ割り当てる設計では「connector が生やした node に人が書き足す」が解けない。**Agent Card に出るものは全部 connector のもの、カードに出ない本文が人のもの。**
  - **Agent Card の表示要素（DC22）。** icon / Realm, Role, Name / Title / msg / model, time, state。icon は Role 層に付ける。`Realm` を出し `team` は出さない。`time` は表示時に計算し保存しない。外枠は attention（色・太さ）+ Actor 多重度（重なり）を提案、最終決定は seam lab で目視。
  - **用語: `connector`。** backend で session データと M3E データをつなぐスクリプトをこう呼ぶ（akaghef 命名）。旧称「観測スクリプト」「observer」は使わない。
- Why: Codex draft と Director が A-sys の fail-closed 分類を過剰適用し、`msg` が読めないカードを要求していた。attention routing の判断に使えないため可読性を優先する。色は規約が存在せず spec ごとに決まる恐れがあったため map 全体の規約として先に固定した。vault 往復 A は akaghef 決定（「A 側に決定する。ある程度大胆な変更を加えて良い」）。field 単位所有権は、node 単位 provenance では「connector が生やした node に人が書き足す」が上書きか放置の二択にしかならないため。
- Next: Codex 2本を dispatch 済み — (1) `codex/vault-node-identity` で vault 往復の identity 保存を実装、(2) `codex/agent-orrery-map` で requirements を DC1〜DC22 へ改訂。`model` 名が実データから取得可能かは (2) で調査させる。残る未解決は IS5（agmsg endpoint の session 解決）、IS8（replay の扱い）、IS9（未配置の受け皿の表現）、IS13（edge type 語彙）、IS14（attention の観測条件）、IS15（human agent への lifecycle 適用）。
- Source: 2026-08-29 akaghef「なぜ session 情報の漏洩を懸念するのかがよくわからない…漏洩の懸念は完全に過剰」「色に関しては規約を統一したいため、規約に追加してほしい」「A 側に決定する。ある程度大胆な変更を加えて良い」「バックエンドでセッションデータと M3E データをつなぐ役割のスクリプトをコネクタと呼ぶことにする」、および Agent Card の手描き設計
- Promoted: [../09_Decisions/ADR_011_Agent_Orrery_As_M3E_Map.md](../09_Decisions/ADR_011_Agent_Orrery_As_M3E_Map.md) / [../../.kiro/steering/color_semantics.md](../../.kiro/steering/color_semantics.md)

## 2026-08-27-001

- Date: 2026-08-27
- Topic: Agent Orrery 設計の改訂（2026-08-26-001 を更新）
- Status: accepted
- Decision:
  - **plugin kernel は今回作らない。ただし後から抽出できる形にする。** `260808_agent_mapping_plugin_boundary.md` の AC1〜AC5（Surface / Schema / Command / Event / Adapter registration）を後から抽出できるよう、agent 固有の語彙・状態・描画規則を viewer 本体に直接埋め込まない。ADR_009 §3 の凍結の解除条件を「実需 query 3件」から「抽出可能性の確保」へ置き換える。
  - **粒度は2層ではなく3層。** Role / Contract（永続・Authoring Map）+ Actor Instance（runtime）+ Telemetry（ephemeral・正本に混ぜない）。`Role CRUD` と `Actor CRUD` を別操作として扱う（Delete Role = 組織再編、Delete Actor = プロセス終了）。
  - **scope owns binding, plugin owns realization.** Role は実行体ではなく `callable-ref`（`hermes://` / `codex://` / `exec://`）への binding を持つ。Role の記述に runtime 実装の知識を入れない。Role を node と scope のどちらで持つかは IS11 で決める。
  - **UX の中心は agent 一覧ではなく Attention Routing。** 目的は監視 dashboard ではなく externalized executive function。自走 agent は薄く、人間への attention が立ったものだけ前景化する。人間と全 agent を常時 edge で結ばない。「人間の判断待ち」は state の一つではなく最上位の軸として扱う。
  - **edge に type を持たせ、edge-type 射影を初回から入れる。** 全 edge を常時表示しない。prototype が既に 89 nodes / 163 links であり、Goal Graph 同居で確実にスパゲッティ化するため後回しにできない。「同じ map に置く ≠ 同じ hierarchy に押し込む」。
  - **agmsg との境界を6条で規定（DC16）。** agmsg の agent は destination であって Role ではない。team は transport 境界であって project ではない。delivery state（`queued/delivered/read/handled/failed`）と agent lifecycle state を別体系にする。unread は attention ではない。read-only 観測は agmsg の SQLite を直接読み、`inbox` / `watch` / `check-inbox`（read cursor と `read_at` を変更する）を使わない。agmsg が既に持つもの（destination identity、roster、inbox/history、read cursor、delivery state、watcher/actas lock、spawn/despawn）を Orrery 側で作り直さない。また agmsg message には provenance が無い（35件中 `session_id` column なし、`thread` 0/35、`message_id` 0/35）ことを前提にする。DC7 の「polling しない」は M3E 自身の session 観測に対する規定であり、agmsg 内部の5秒 polling は対象外。
  - **Role は node / scope の二択ではない（DC17）。** Role の定義域は **role 定義 scope**（role 一覧がそこにある）、Role の実体はその scope 内の **node**（`callable-ref` binding を持つ）、agent からの参照は agent node の**属性**であり構造上は agent node 配下の **alias node** が Role 実体を指す。その alias は通常 agent node に **collapse** されて見える。Role ごとに個別のネットワークが集計・射影される。既存の scope / alias 仕様（実体ノードは単一 scope 所属、他 scope からの再利用は alias 経由のみ、alias は read-only 参照ノード）の素直な適用。
  - **今回の主語は Agent、完成形の主語は PJ。** 最終形は Why(GOA) → What(Work) → Who(Org) → Now(Runtime) → With what(Resource) を typed edge で接続し、任意の稼働 agent から Actor → Role → Task → Objective → Goal を逆に辿れる状態。GOA 側の語彙定義は今回行わない。
- Why: 2026-08-26-001 は ADR_009（2026-07-19）を根拠に plugin を out-of-process と確定したが、その後に akaghef から提示された設計会話2本（2026-08-08 / 2026-08-24）はいずれも「M3E 側に受け口を作る」方向を向いていた。**最も古い ADR を最新の意思として扱っていた**ため改訂する。3層分割・Role/Actor CRUD 分離・attention routing・typed edge 射影は 08-08 の会話に含まれていたが、26-001 の時点では入力に無く欠落していた。
- Next: agmsg の思想と実データ構造を調査中（IS12）。agent が個体か宛先か役割か、team が何かが DC3 の3層と衝突しないかを確認してから requirements draft を再発注する。worktree `agent-orrery-map` は作成済み、初回 draft は前提不足のため発注を取り消した。
- Source: 2026-08-27 akaghef「設計会話を話し忘れてたので追加」（`docs/ideas/260808_agent_mapping_plugin_boundary.md`）、および「agmsg の思想はチェックすべき」
- Promoted: [../09_Decisions/ADR_011_Agent_Orrery_As_M3E_Map.md](../09_Decisions/ADR_011_Agent_Orrery_As_M3E_Map.md)

## 2026-08-26-001

- Date: 2026-08-26
- Topic: Agent Orrery を M3E の map として実装する
- Status: accepted
- Decision:
  - **`plugin` は out-of-process に確定。** viewer 内 plugin API（`renderNode` 等）は作らない。agent node の管理は out-of-process スクリプトが行い、`CodexAppServer` による M3E 駆動（実装済み）を使う。M3E の背後にエージェント1体が総合判断を持つ。
  - **Orrery は map のデータであり Surface View ではない。** Surface View は ADR_010 の4種のまま。Tree でも Disperse でもいずれの view mode でも見られる。既定は Disperse の force。
  - **node 粒度は「役割」。** project node 配下に agent（役割）node を置いて担当を可視化し、session は子 node または属性として束ねる。ADR_009 §2 の `Agent = Session 1:1` は**観測層の粒度としてのみ**維持し、map の node 粒度には適用しない。map には agent 機能を持つ node と普通の node が混在する。
  - **初期は read-only。** 既存の会話セッションを観測して node を生やす。node は固定であり mutation の対象ではない。操作は役割配置 / メッセージ送信 / 確認 / セッションを開く。
  - **「終了」と「観測不能」を別ステータスにし、どちらも node を残す。**
  - **Goal Graph を同スコープに含む。** agent に対応しない node を inner node として同じ map に置く。
  - **polling せず、agent セッションのファイル変更検知で観測する。** ただし現行 prototype の Claude セッション過剰カウントを M3E へ移す前に精査する。
  - **provenance（誰がこの node を生やしたか）は day-1 で入れる。** データ置き場自体は後決めでよい。
  - **project 配下への配置は規則ではなくエージェントが判断する。** 観測スクリプトは未配置の受け皿に node を生やすだけ。cwd / gitBranch はヒントとして渡す。（使える手がかりが `cwd` のみで粒度が混在しており、repo と project も 1:1 ではないため。DC10 の「役割配置」がここで実体を持つ）
  - **state 語彙は M3E 側で一本化して切り直す。** backend 9種 / UI 10種の二重体系は引き継がない。「正常終了」「観測不能」「切断」を分離し、live projection が生成しない `speaking` / `listening` / `negotiating` は採用しない。
  - **コードの canonical owner は M3E repo。** prototype は参照実装として引き継ぎ、dedup / state 判定 / projection 生成は M3E 側で書き直す。プロセスとしては out-of-process のまま。
  - スコープ外: port / anchor、trace 保存、L1〜L4 介入操作、WebGL 前提の LOD 設計。
- Why: ADR_009 は凝集先・Disperse 解釈・out-of-process plugin を決めたが、plugin 契約 / runtime 観測契約 / map 登録手続きが未確定だった。そこへ引き継いだ設計会話（viewer 内 capability plugin 前提）が入り、`plugin` が二義になっていた。node 粒度を役割にするのは、session 単位だと resume / fork / subagent による JSONL 分裂がそのまま node 増殖になるため（prototype の Claude 過剰カウントがその症状）。provenance だけ後決めにできないのは、script が生やす node と人が書く node が混在する map で、所有者の区別が事後に復元できないため。
- Next: IS1 / IS2 / IS3 / IS7 は解決済み（Claude 過剰カウントの原因は fork / clone lineage を session ID 単位で別登録していたこと。7 family / 22 files が registry 上 19 ID、logical family 換算で12件の余剰）。残る IS4（描画要素語彙）、IS5（agmsg endpoint 解決）、IS6（公開範囲）、IS8（replay の扱い）、IS9（未配置の受け皿の表現）、IS10（provenance の具体形）は spec 段階で決める。次は Codex に requirements draft を発注する。
- Source: 2026-08-26 akaghef「agent mapping の M3E plugin 化を施行する。map のひとつを agent orrery として稼働する」および UD1〜UD15 への回答、稼働中 prototype の画面（AGENTS 88 / 89 nodes / 163 links / 72.0h window）
- Promoted: [../09_Decisions/ADR_011_Agent_Orrery_As_M3E_Map.md](../09_Decisions/ADR_011_Agent_Orrery_As_M3E_Map.md)

## 2026-08-25-001

- Date: 2026-08-25
- Topic: Radial Surface View を廃止し Tree へ畳む
- Status: accepted
- Decision:
  - **Surface View 正本は `Tree / Axial / Disperse / System` の4種**とする。Radial を廃止する。
  - 旧「Mind Map」「`balanced-tree`」は **Tree の両側 preset**（`direction: left/right`）として扱う。
  - 現況のコード・UI・seam lab から Radial / 内部 mode key `mindmap` の実体を削除する。**残す痕跡は git 履歴と ADR_010 のみ。**
  - 保存スキーマ上の legacy 値としての読み取り互換は維持し、Tree の両側 preset へ移行する。移行実装は D2 に合わせる。
- Why: canon の Radial は `clockwise / counterclockwise / balanced` という角度系を規定していたが、**実装は一度も角度配置を持たず**、direction は Tree と同じ `left/right` / `left` / `right` だった。実ブラウザで描画すると両側 Tree そのものであり、port 選択の経路も Tree と共有されていた。固有の幾何を持たないまま実体を共有し、同じものに名前が2つある状態だった。`03d1fc3` で Tree の direction 規則が Radial へ流入し接続線がノード矩形を貫通した不具合は、この重複の症状（Logic Chart = Tree preset では同条件で発生しない）。
- Next: viewer / PN / adapter / edge port / seam lab / テストから Radial を削除。`map_layout_modes.md` の正本規定を4種へ改訂。非正本のアルゴリズムカタログと legacy スキーマ節の `balanced-tree` は履歴として残す。
- Source: 2026-08-25 akaghef「OP2に決断。残骸は履歴とADRだけでいいので、現況からはRadialは消し去って。seam labも含め」
- Promoted: [../09_Decisions/ADR_010_Radial_Surface_View_Removal.md](../09_Decisions/ADR_010_Radial_Surface_View_Removal.md)

## 2026-08-23-003

- Date: 2026-08-23
- Topic: Disperse の layout engine に WebCola を採用
- Status: working-agreement
- Decision:
  - **Disperse の layout engine は WebCola**（cola.js）。理由は思想の適合であり、ベンチマークによる選定ではない（akaghef 指示「実測はしない。思想で決める」）。
  - 要件3つ（**矩形の非重複** / **group が第一級** / **collapse で縮約**）に対し、WebCola は制約ベースで「傾向でなく保証」を与え、矩形非重複と group を第一級に持つ。ほぼ一対一で対応する。
  - **d3-force は不採用**: 衝突が円で矩形の非重複を保証できず、group を自作することになる。
  - **elkjs は不採用**: compound は native だが思想の重心が層化（Sugiyama）された図であり、「近接と密度で読む」Disperse の主眼と向きが違う。既存決定 2026-06-06-001 の elkjs 優先は `Axial.subtype=pipeline` / `System.subtype=architecture` の文脈で、Disperse には射程が及ばない。
  - **renderer 一体型ライブラリ（sigma.js / cosmograph 等）は採らない**。描画は既存の自前 WebGL projection を使い、layout は headless で座標のみ返す。
  - 既知リスク: WebCola は開発が停滞気味。思想の適合と保守性は別問題として認識する。
  - **実装より先に layout を決める**（akaghef 指示「レイアウトを決めるのが seam lab の優先だ」）。group 境界の描画有無 / group 間分離量 / collapse 時の super-node footprint / 縮約時の edge 集約規則の4点は、seam lab のコントロールとして出し目視で決定する。
- Why: 自作は既に劣化コピー（viewer の `runScatterSimulation`）として存在しており、規律（焼きなまし・衝突・決定論）を欠いている。ライブラリ選定を実測で行うと、決めたい対象（どう見えるべきか）ではなく数値に引きずられる。
- Next: `disperse-lab` を seam lab として立て、上記4問をコントロールとして出す。受け入れ条件は `synthetic-100-varied-boxes` で 重なり0 / アスペクト比上限 / 充填率下限。
- Source: 2026-08-23 akaghef「web colaに決定して、まとめて、seam labとして実装を作り上げてください」
- Promoted: [../04_Architecture/Disperse_Layout_Design.md](../04_Architecture/Disperse_Layout_Design.md)

## 2026-08-23-002

- Date: 2026-08-23
- Topic: Disperse の目的と、tree を group 階層として使う粗視化設計
- Status: working-agreement
- Decision:
  - Disperse の主眼は正本どおり **空間的近接・クラスタ・関係密度**（[map_layout_modes.md](../03_Spec/map_layout_modes.md) 意味上の分離）。
  - **tree は Disperse の配置ではなく group の階層を担う。** collapse が graph の縮約になり、粗視化レベルを人間が選べる。tree の深さ = 繰り込みの梯子。
  - 力学配置の対象は **collapse 状態で縮約された可視グラフ**。collapse した部分木は 1 super-node へ縮約し、edge は super-node へ集約する。
  - subtype `cluster` は tree の group に対応づける。
  - **現行実装は Disperse ではない**: `layout_port.ts` の Disperse 分岐は leaf を Y に等間隔で並べ depth を X に送る rank-flow tree seed（横倒しの Tree）。近接・密度を一切表現していない。「直す」ではなく「未実装なので実装する」が正しい認識。
  - **rank-flow seed を残して衝突緩和だけ足す案は目的違反として却下**（整った Tree が増えるだけ）。
  - **自作しない**。力学配置・group 対応 layout は既製ライブラリに寄せる（全体規則 + Decision 2026-06-06-001「新規の大規模 graph layout を自作しない」）。group / compound 対応が選定基準に入る。
  - Disperse は `layout_port.ts` の seed と viewer の `runScatterSimulation()`（収束条件なし）に **二重実装**されている。Tree と同様に単一 seam へ寄せる。
- Why: 目的（近接・密度）を定義しないままパラメータ調整すると、Tree の別表現を作り込むだけになる。tree を group 階層に使う設計は M3E の spine をそのまま多重解像度の梯子に転用でき、collapse という既存操作が粗視化の操作子になる。
  - **粗視化の操作子は既存の collapse をそのまま使う**（Disperse 専用のレベル概念を別に持たない）。
  - **subtype の対応**（正本 line 67 の「自由配置・クラスタ・力学配置」に対応）: `scatter`=自由配置（座標は人が置く。計算しない）/ `cluster`=tree group を空間的まとまりとして見せる / `force`=edge の張力と斥力で座標を決める。**各 subtype の定義文は正本に未記載**（列挙のみ）。
  - **renderer と layout を分離する**: 描画は既存の自前 WebGL projection（`beta/src/browser/webgl_projection.ts`、branch `codex/webgl-rendering-projection-phase1`、735行、外部ライブラリなし）をそのまま使う。layout は **headless で座標だけ返すライブラリ**に限る。sigma.js / cosmograph のような renderer 一体型は自前 WebGL と二重になるため採らない。
  - ライブラリ候補は group 対応を基準に: `webcola`（group が第一級）/ `elkjs`（compound、既存決定 2026-06-06-001 で優先指定）。`d3-force` は平坦なので今回は不利。
- Next: subtype は `force` 1本から着手する案を検討。`space` を Disperse に通す（密度が主眼である以上、本質パラメータ）。`MapSurface` に `subtype` / `space` が無く kind が legacy `scatter` のため migration が要る。受け入れ条件は `synthetic-100-varied-boxes` で 重なり0 / アスペクト比上限 / 充填率下限。WebGL なら大 N を描けるので、force を worker で回し座標を stream する構成を検討できる。
- Source: 2026-08-23 akaghef「そもそもDisperseはどういう目的か？」「groupの階層をtreeで記述しておくと、collapseで粗視化が自然にできる。graphの縮約がよくわかる」+ Codex read-only 診断
- Promoted: [../03_Spec/map_layout_modes.md](../03_Spec/map_layout_modes.md)（意味上の分離に「Disperse と tree の関係（粗視化）」を追加）

## 2026-08-23-001

- Date: 2026-08-23
- Topic: layout 用語の統合（direction 一語化、`both` 廃止、space と数値の一本化）
- Status: working-agreement
- Decision:
  - **`direction` は1語**。値は `left/right` / `left` / `right` / `up/down` / `up` / `down`（+ view 固有: Radial の clockwise / counterclockwise / balanced、System の free）。
  - **`both` は廃止**。分かりにくいため、水平両側 = `left/right`、垂直両側 = `up/down` と明示する。
  - `branchDirection` は廃語。`direction` へ統合する（コードが正本を2語に割った drift）。
  - **`space` は1語**（tight / normal / loose）。`density` は廃語。`spacing{nodeGap,levelGap,padding}` は `space` の展開値であり、独立入力チャネルにしない。
- Why: 正本 [map_layout_modes.md](../03_Spec/map_layout_modes.md) に元から1語で定義されていたが、実装が `LayoutDirection`/`LayoutBranchDirection`、`LayoutDensity`/`spacing` に分割し drift した。`density` の `balanced` は Radial の `direction=balanced` と衝突していた。
- 実測（layout-lab, 2026-08-23）: Tree では nodeGap 14→200 も density balanced→spacious も `2579 x 882` で不変。同設定で Radial は `3454 x 4384`。原因は [layout_port.ts:254](../../beta/src/shared/layout_port.ts) 等の `config.mode === "tree" ? LAYOUT.columnGap : config.columnGap` ハードコード分岐。**最優先 view の Tree で間隔設定が無効**。
- Next: 用語確認フェーズ完了後にコード reconcile（`branchDirection`/`density` 廃止、Tree ハードコード撤去、`space`→数値の一本化）。`direction` 変更後に `branchSide` が再計算されない件も同時に扱う。
- Source: 2026-08-23 akaghef 指示「bothは分かりにくい。bothをleft/right, up/downとせよ」「gapとdensityがダブってそう。数値と連動するようにすべき」
- Promoted: [../03_Spec/map_layout_modes.md](../03_Spec/map_layout_modes.md), `.kiro/steering/ui_view_taxonomy_and_ports.md`

## 2026-07-19-001

- Date: 2026-07-19
- Topic: general graph editor の Surface View 帰属（Disperse。System は別系譜のまま凍結）
- Status: working-agreement
- Decision:
  - **general graph editor（一般 property graph の編集 UI）は Disperse に載せる**。新しい Surface View 名は増やさない（steering 拘束規則1）。
  - **System view は LangGraph 的 system diagram の系譜**（PJ04 / MDD / Template System 線）であり、general graph editor とは全く別物。**凍結を維持**する。general graph 需要を理由に System を解凍しない。
  - これは 2026-07-18-002（Tree 最優先 / Disperse 最大エフォート / 他凍結）と整合: general graph editor は Disperse 主戦場の中身になる。
  - コンセプト正本 = playground 成果物群: LLM Graph Conversation Protocol（`04_Architecture/`、Phase 0 / federated 版）+ Agent Orrery（`docs/tasks/agent_network_dashboard_reference_260707/`）。
- Why: System と general graph は「ノードとエッジがある」見た目が似るだけで、System = 実行系 diagram（LangGraph 的 flow）、general graph editor = 知識・関係の property graph 編集と意味論が異なる。混ぜると表示意味が衝突する（2026-06-06-001 の教訓と同型）。
- Next: spec 設計は Federated_Semantic_Source + ADR_008 + LLM Graph Conversation Protocol（graph ops / owner routing）前提。表示・編集は Disperse(force-link) + `@xyflow/react` / `elkjs` 優先（2026-06-06-001 準拠）。kiro-discovery で枠切り後、Codex に spec ドラフト dispatch。
- Source: 2026-07-19 akaghef 指示「system diagramはlanggraph的な方向性なので(ぜんぜん違う 凍結したままにする)、disperseが正しい」
- Promoted: （未）

## 2026-07-18-003

- Date: 2026-07-18
- Topic: S16 — federated canonical source と Neo4j role の concern 分離
- Status: accepted-for-phase-0
- Decision:
  - repository、Obsidian、M3E-local、external provider は durable concern ごとに局所 canonical source を持ち、同じ concern の canonical owner は一つにする。
  - 外部 source が所有する content / assertion を Neo4j に載せた record は materialization とする。
  - M3E が所有する accepted Deep entity / assertion は、activation gate 通過後の Neo4j canonical runtime 対象とする。portable recovery evidence を別 failure domain に維持する。
  - proposal、pending assertion、ownership transfer は journal を canonical source とし、Mermaid / TOON は会話用 projection とする。
  - UI、human、AI、bot、CI の確定 write は共通 Command boundary で owner へ route する。M3E-owned accepted graph だけが Neo4j owner adapter に到達する。
  - Rapid occurrence と Deep entity は別 identity とし、many-to-many entity binding で接続する。
  - Neo4j shadow は、実運用由来の cross-source query 3 件を input、expected result、source revision 付きで固定するまで開始しない。
  - SQLite は M3E-native Rapid local persistence として継続し、PostgreSQL / collaboration state / global graph を別 concern として選定する。
- Why: 単一 SQLite へ repository 情報を複製すると Git / bot / CI から正本が見えず、双方 write で dual-canon になる。一方、Neo4j を全 source content の唯一の正本にすると局所 ownership、diff、offline recovery、provider responsibility を失う。既存の「Neo4j 正本」判断は M3E-owned accepted graph concern に限定すれば両立する。
- Next: repository-local semantic source の file-read use case を先に実証し、3 件の query evidence が揃った時点で Neo4j deployment / edition / canonical-subgraph recovery ADR を起票する。Principle への昇格は現時点では行わない。
- Source: 2026-07-18 の本スレッド、PR #74、Claude Fable review、同日 Decision `2026-07-18-001`
- Promoted: [../01_Vision/Strategy.md](../01_Vision/Strategy.md), [../03_Spec/Federated_Semantic_Source.md](../03_Spec/Federated_Semantic_Source.md), [../04_Architecture/Federated_Semantic_Graph.md](../04_Architecture/Federated_Semantic_Graph.md), [../04_Architecture/LLM_Graph_Conversation_Protocol.md](../04_Architecture/LLM_Graph_Conversation_Protocol.md), [../09_Decisions/ADR_008_Federated_Canonical_Sources.md](../09_Decisions/ADR_008_Federated_Canonical_Sources.md)

## 2026-07-18-002

- Date: 2026-07-18
- Topic: Surface View の投資優先度（Tree → Disperse、他は凍結）
- Status: working-agreement
- Decision:
  - **Tree = 最優先**。ほぼ出来ているので、仕上げ（完成度・検証固定）に最初のリソースを充てる。
  - **Disperse = 次点。最大のエフォートを割く**主戦場。
  - **Axial / Radial / System = 放置（凍結）**。新規の実装・spec・検証投資をしない。non-regression（既存挙動を壊さない）だけ守る。
  - 検証直積（Development_System.md §2.4）の第3軸はこの優先度で剪定する: golden 表・lab・目視ゲートの対象行は Tree / Disperse のみ。凍結 view のセルは台帳上 `frozen` として明示し、空欄と区別する。
- Why: 5 view 全部に検証・実装投資すると直積が爆発する。価値が集中している Tree（主力・完成間近）と Disperse（次の主戦場）に絞ることで、乗算→加算の分解が実効化する。
- Next: 検証マトリクス台帳・seam spec 起案時は Tree / Disperse 行のみ展開。凍結 view に触る変更が必要になったら Decision_Pool で解凍を判断。
- Source: 2026-07-18 akaghef 指示「Treeを最優先(ほぼ出来てる)、Disperseを次(一番エフォート割く)。他は放置。という思想も刻んで」
- Promoted: [../06_Operations/Development_System.md](Development_System.md) §2.4 / `.kiro/steering/ui_view_taxonomy_and_ports.md` 拘束規則4

## 2026-07-18-001

- Date: 2026-07-18
- Topic: LLM ↔ property graph の会話プロトコル（Neo4j 正本 / Mermaid+TOON projection / graph ops 正規化）
- Status: working-agreement
- Decision:
  - Neo4j を正本、Mermaid + TOON を会話用 projection とする（Neo4j → context projection → LLM edit → graph operations → Neo4j）。
  - LLM の出力を Mermaid や TOON そのものとして保存せず、必ず graph operation（`ops{op,target,key,value}`）へ正規化してから DB に反映する。
  - 役割: CR1 Mermaid=局所 topology（認知的構造把握）/ CR2 TOON=属性・provenance・state・schema / CR3 Neo4j=完全な property graph と query / CR4 graph ops=会話→DB の正規化境界。
  - 会話 context は全グラフでなく `Expand(V_focus, k, relation filter)` の k-hop 部分グラフを射影する。
  - Mermaid edge label を識別子として解析しない。edge ID はコメント（`%% edge:E41`）等で明示する。
  - この構成では JSON を会話面から排除する合理性がある。
  - Scope note (`2026-07-18-003`): `Neo4j 正本` は M3E-owned accepted Deep graph concern に限定する。Git / Obsidian / provider-owned record は materialization、proposal / pending transfer は journal、Mermaid + TOON は `context projection` とする。
- Why: これはファイルフォーマットでなく LLM と property graph の間の会話プロトコル。projection を正本化すると往復で drift するため、正規化境界（ops）を唯一の書き込み経路にする。
- Next: M3E データ層 / agent graph 系の新規 spec はこのプロトコルを前提に設計する。
- Source: 2026-07-18 akaghef 指針（stow 指示）
- Promoted: [../04_Architecture/LLM_Graph_Conversation_Protocol.md](../04_Architecture/LLM_Graph_Conversation_Protocol.md)
## 2026-06-06-001

- Date: 2026-06-06
- Topic: pipeline / system graph UI reference asset の M3E 取り込み
- Status: working-agreement
- Decision:
  - X post の可視化 UI は、Markdown renderer ではなく、M3E の pipeline / system graph surface 参考 asset として扱う。
  - 適用先は `Axial.subtype=pipeline` と `System.subtype=architecture`。新しい Surface View 名は増やさない。
  - M3E へ移植する要素は typed card、port、left-to-right flow、selected-path focus、right inspector、minimap、trace replay。
  - 実装に進む場合は `@xyflow/react` + `elkjs` を優先し、新規の大規模 graph layout を自作しない。
  - 既定の Rapid tree viewer は置換しない。dark palette / saturated node color は system / workflow surface 限定の候補とする。
- Why: 大規模 AI system を文書だけで追うより、GraphSpec / Contract Tree / Run trace を可視化する surface として有用だが、既存の calm Rapid tree 方針と混ぜると表示意味が衝突するため。
- Next: read-only preview route で AppState + GraphSpec から flow UI を表示する adapter を切り出す。実装時は selection inspector と label overlap の Playwright 検証を先に置く。
- Source: https://x.com/GianMattya/status/2062294853464265004 とこのスレッドでの UI 取り込み指示
- Promoted: [../04_Architecture/Pipeline_UI_Reference.md](../04_Architecture/Pipeline_UI_Reference.md), [../03_Spec/map_layout_modes.md](../03_Spec/map_layout_modes.md)

## 2026-04-14-001

- Date: 2026-04-14
- Topic: batch review (17 件) の決定と両立案採用
- Status: working-agreement
- Decision:
  - **Cloud Sync**: auth=email magic link (OAuth 追加は未決) / Q2 DTO=`shared/types.ts` / Q3 conflict=scope-level (subtree 単位で CRDT 差し替え可能な抽象を残す / 未解決) / Q4 Supabase=既存プロジェクト / Q5 暗号化=**user 明示要求まで放置** (no encryption initially)
  - **Alias Impl**: Q1 write-alias scope = everything incl metadata (将来 per-alias mode toggle で独立保持も両立) / Q2 named wrappers = skip (reparentNode + deleteNode で足りる) / Q3 scoped-API × alias = API 引数で挙動制御 (default 可視、引数で隠す)
  - **Markdown Viewer**: 基本方針=**軽量** (見出し・強調のみ、表なし、フォントサイズ切替) / Q1 lib=hand-written renderer 継続 / Q2 Mermaid=`beta/public/vendor/mermaid.min.js` vendor / Q3 preview=ノード属性 `markdown:true` で opt-in
  - **Red Team**: Q1 branch=`dev-red` ベース + `audit/<date>-<domain>` トピック併用 / Q2 autonomy=read-only audit / Q3 初回 scope=full security sweep (CSRF / LAN / 偽装 / 入力検証 / 公開URL / Supabase / APIキー)
  - **Rapid Deep Binding**: Q1 domain=hierarchical (`math.topology.knot`) / Q2 role=固定リスト (object/representation/move/invariant/theorem/method) / Q3 syntactic=専用テーブル / Q4 span=char offset (v1、将来 token range 昇格) / Q5 encoder=明示ボタンのみ
  - **Node Decoration**: 保存キー=`attributes['m3e:style']` / swatch=mlx 配色 (importance=yellow tints / urgency=blue tints) / color matrix=mlx Method 2 + ステータス色 (未実行=緑 / 完了=グレー) の重ね合わせ / precedence=view-mode 切替 (`U*I view`=mlx 自動 / 通常=手動) ← 未解決 / hotkey=ノード編集モード内で `r`/`b`/`g` 単打 + テンキーで U*I 一発入力 (要追加議論) ← 未解決
  - **Link API**: Q1 API shape=dedicated REST endpoints / Q2 duplicate=allow / Q3 self-link=allow (ループ描画ロジックは follow-up)
- Why: 17 件の review Q を一括解決し、実装を止めずに dispatch を継続するため。両立可能な選択肢は片方を排除せず per-mode / per-arg トグルで将来拡張を残す設計にした
- Next: map の `reviews/*/Qn` に `selected="yes"` 反映済 (22 Q 削除 + 未解決 5 件残置)。for-akaghef サマリ [../for-akaghef/260414_review_options_summary.md](../for-akaghef/260414_review_options_summary.md) 参照。Node Decoration の未解決 2 件は U*I view mode 実装時に再議論
- Source: 2026-04-14 の batch レビュー会話、PR #48-#53 dispatch
- Promoted: （未）

## 2026-04-14-002

- Date: 2026-04-14
- Topic: X (Twitter) を Tech Radar として M3E に取り込む方針
- Status: working-agreement
- Decision:
  - 用途 = akaghef が like/bookmark した投稿から新ツール情報を吸い上げ、M3E への統合適合性を評価 (adopt/trial/assess/hold rating)
  - 公式 X MCP は**存在しない** → community `chrislee973/twitter-bookmark-mcp` サイドカー経由で P1 実装 (credential は MCP 側、M3E は API key を持たない)
  - P2 以降は X API v2 直接 (~$5/月, PPU tier)。scraping は ToS リスクで却下
  - Entity 抽出 = haiku で post→tool 名抽出、sonnet で統合適合性評価
  - Storage = map primary (`DEV/Tech Radar/<tool>`)、SQLite cache
  - Poll = P1 manual trigger、P2 は 6h cron
  - Scope = P1 bookmarks のみ、likes は P2
- Why: X が akaghef のツール発見チャネルであり、手動コピペを自動化する価値が高い
- Next: Q1-Q7 を map `reviews/X Tech Radar/` に pool 済。codex brief [../../backlog/codex-x-tech-radar.md](../../backlog/codex-x-tech-radar.md) 作成済。P1 実装は Q レビュー後に codex dispatch
- Source: 2026-04-14 PR #53 の team 設計作業
- Promoted: [../03_Spec/x_tech_radar.md](../03_Spec/x_tech_radar.md)

---

## 2026-04-02-002

- Date: 2026-04-02
- Topic: Linear 変換 UI は Tree 右側パネルで提供する
- Status: working-agreement
- Decision: Rapid では Tree の右側に current scope 用 Linear テキストパネルを配置し、Tree 選択と行選択を同期する。Linear 編集は即時反映せず Apply 時に一括反映し、失敗時は fail-closed で中断する。
- Why: 構造と文章の対応を見やすくしつつ、曖昧入力による部分破壊を防ぐため
- Next: parser/reconcile の回帰テストを追加して誤変換の再発を防止する
- Source: 2026-04-02 の UI 仕様確定と実装作業
- Promoted: [../03_Spec/Linear_Tree_Conversion.md](../03_Spec/Linear_Tree_Conversion.md)

## 2026-04-02-001

- Date: 2026-04-02
- Topic: Linear <-> Tree 変換を scope 基準で設計する
- Status: working-agreement
- Decision: 正本は Tree のまま維持し、Linear は入出力インターフェースとして扱う。既定の変換単位は `currentScopeId` の部分木とし、L1（インデント）を可逆優先、L2（Markdown）を準可逆として段階導入する。
- Why: 入力速度を上げつつ、主構造（親子）と認知境界（scope）を壊さないため
- Next: L1 export/import の最小実装と round-trip テストを追加する
- Source: 2026-04-02 の Linear/Tree 変換ビジョン確認
- Promoted: [../03_Spec/Linear_Tree_Conversion.md](../03_Spec/Linear_Tree_Conversion.md)

## 2026-04-01-003

- Date: 2026-04-01
- Topic: graph-level `Link` の Beta 実装前提仕様
- Status: working-agreement
- Decision: `Link` は `Edge` と別の overlay relation として `AppState.links` に保持し、node-level `link` 文字列とは分離する。`Link` は layout に参加せず、source/target node ID を参照し、broken endpoint を含む状態は保存時に拒否する。
- Why: 構造木と非木関係線を混同せず、将来の relation line 実装を最小データ構造から始められるようにするため
- Next: `03_Spec/Data_Model.md` と import/export 境界文書へ graph-level `Link` の型と保存制約を追加する
- Source: このスレッドでの `Link` 実装状況確認と仕様追記依頼
- Promoted: [../03_Spec/Data_Model.md](../03_Spec/Data_Model.md), [../03_Spec/Import_Export.md](../03_Spec/Import_Export.md)

## 2026-04-01-002

- Date: 2026-04-01
- Topic: `scope` / `alias` 仕様の訂正
- Status: working-agreement
- Decision: target 実体 delete は alias 残存を理由に拒否せず、alias 側を broken 状態へ遷移させて表示名を `元の名前 (deleted)` とする。alias には write 権限設定を持てるようにし、同一 scope 内 alias も許可する。
- Why: delete を過度に阻害せず参照喪失を分かりやすく残し、将来の alias 経由編集や同一 scope 内参照の用途を塞がないため
- Next: `03_Spec/Scope_and_Alias.md` の delete / 権限 / 同一 scope 制約を訂正し、Beta model での最小表現に落とす
- Source: このスレッドでの仕様修正指示
- Promoted: [../03_Spec/Scope_and_Alias.md](../03_Spec/Scope_and_Alias.md)

## 2026-04-01-001

- Date: 2026-04-01
- Topic: `scope` と `alias` の Beta 実装前提仕様
- Status: working-agreement
- Decision: `folder` は子 scope の入口ノードとして扱い、実体ノードは単一 scope 所属、他 scope からの再利用は `alias` 経由のみとする。`alias` は read-only 参照ノードで、`alias -> alias` は禁止し、対象実体の削除は alias 解消前は拒否する。
- Why: 認知境界を UI とモデルの両方で一貫して扱い、複製による整合崩壊と削除事故を防ぐため
- Next: `03_Spec/Scope_and_Alias.md` を Beta 実装に使える粒度へ拡張し、後続で model/save-load への反映単位を切り出す
- Source: このスレッドでの `scope` / `alias` 仕様整理依頼
- Promoted: [../03_Spec/Scope_and_Alias.md](../03_Spec/Scope_and_Alias.md)

## 2026-03-30-004

- Date: 2026-03-30
- Topic: MVP テストレイヤーと CI 段階導入方針の運用基準化
- Status: working-agreement
- Decision: MVP 期間は Test and CI/CD Guide を基準として、Model/SaveLoad/Layout-HitTest を優先しつつ CI Stage A を先行導入する
- Why: 操作品質の検証とデータ安全性の検証を分離して運用し、壊れ込みの早期検知を可能にするため
- Next: Stage A の最小 CI ジョブを実装し、PR 前ゲートを運用に組み込む
- Source: このスレッドでのテスト/CICD 文書拡充依頼
- Promoted: [Test_and_CICD_Guide.md](./Test_and_CICD_Guide.md)

## 2026-03-30-003

- Date: 2026-03-30
- Topic: Freeplane-first から独自描画エンジン方針へ転換
- Status: accepted
- Decision: Freeplane は参考実装および `.mm` 互換入力形式として扱い、描画エンジンと操作系は M3E 側で自作する
- Why: M3E 固有の研究思考支援 UI は Freeplane の外側の補助レイヤーではなく、表示と操作の設計そのものに宿るため
- Next: MVP 定義、方針文書、ADR を独自描画前提へ更新する
- Source: このスレッドでの方針転換の会話
- Promoted: [../09_Decisions/ADR_003_Freeplane_Informed_Custom_Engine.md](../09_Decisions/ADR_003_Freeplane_Informed_Custom_Engine.md)

## 2026-03-30-001

- Date: 2026-03-30
- Topic: 会話ベースの決定を集約する文書運用を先に作る
- Status: accepted
- Decision: 会話で出た決定や仮決めは、まず `06_Operations/Decision_Pool.md` に記録してから、必要に応じて `Spec` `Architecture` `ADR` へ昇格させる
- Why: 開発初期は会話量に対して正式文書化が追いつきにくく、決定の散逸と重複が起こりやすいため
- Next: 以後の会話判断はこのプールへ記録し、反映先ができたら `Promoted` を更新する
- Source: このスレッドでの運用方針決定
- Promoted: [Documentation_Rules.md](./Documentation_Rules.md)

## 2026-03-30-002

- Date: 2026-03-30
- Topic: SVG を先に使う方針
- Status: working-agreement
- Decision: MVP 立ち上げでは SVG を優先候補とし、レイアウト・モデル・描画を分離した構成で進める
- Why: 初期実装速度と UI デバッグ容易性を優先しつつ、将来の Canvas 移行余地を残すため
- Next: `04_Architecture` 側に描画インターフェースの境界を整理する
- Source: このスレッドでの MVP 実装方針の会話
- Promoted: -
