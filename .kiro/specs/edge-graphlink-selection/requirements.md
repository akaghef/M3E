# Requirements Document

## Introduction

Connection をキーボードで選択・移動・編集できるようにする仕様草案。全 Surface View で同じ操作を提供し、選択の表示だけを各描画表現へ適合させる。`edge` は親子関係だけを意味する。GraphLink、LinkStyle、LinkPort、EdgeStyle、edge port は Glossary の意味を維持する。

**承認記録（2026-10-20, akaghef）**: 本仕様を承認。L2 / L3 / L4 は全て採用、OP40 / OP41 を確定、L3 のキーは Shift+S（LinkStyle 巡回）/ Shift+B（direction 巡回）で確定。OP42 は却下のまま。実装は tasks.md に従って開始してよい。L1 および DC35–DC38 はユーザー確定事項。

## Boundary Context

**In scope**: Navigate での Connection の選択、L2 の両端への移動、L3 の編集、L4 の表示、共通の pure function、既存描画・履歴への接続、専用データによる確認計画、DC51 の選択時 Disperse ガイド。

**Out of scope**: 親子 edge の削除による node delete / reparent、GraphLink の新規作成、relationType / attributes の編集 UI、EdgeStyle の新規編集、配置アルゴリズムの変更、renderer の GraphLink 除外・集約規則変更、Radial 本体の復元、個人 workspace の変更、Final 反映。親子 edge のポインター hit-test 追加も必須にしない。

**Adjacent expectations**: `edge-port-seam` が所有する `selectPorts → route` と `parent_child_edge_adapter`、既存 GraphLink 描画・LinkPort 編集、`lane_navigation.ts`、履歴・保存、Progressive Navigation の責務を再実装しない。Lane は兄弟順の帯、System は GraphLink の流れによる配置であり、相互に代用しない。

### Binding sources

| 正本 | 拘束 |
|---|---|
| `docs/00_Home/Glossary.md` §1 | edge / GraphLink / LinkStyle / LinkPort / EdgeStyle / edge port / Surface View の意味 |
| `docs/03_Spec/map_layout_modes.md` §1.1、意味上の分離、Lane と System の区別 | Tree / Axial / Radial / Disperse / System / Lane。Disperse は group frame、Lane は帯で親子を表現 |
| `docs/03_Spec/Data_Model.md` GraphLink、Content / Topology / Layout / Style | GraphLink の label、relationType、direction、style、attributes と Topology 不変条件。sourcePort / targetPort は Glossary と `types.ts` も併読 |
| `.kiro/steering/ui_view_taxonomy_and_ports.md` | 正規分類、既存 edge port / route の再利用、Lane と System の分離 |
| `.kiro/steering/product.md`, `structure.md`, `tech.md` | ローカル正本、shared/browser の責務分離、既存技術の再利用 |
| 本依頼の L1、DC35–DC38 | 下表の確定したキー操作。古い steering の凍結記述より、今回の全 Surface View 共通操作の明示依頼を優先 |
| `docs/06_Operations/Keybindings_Beta.md`, `Actions_Beta.md`, `beta/viewer.html` | 既存ショートカットと編集モード。実装との差は `research.md` |

### 確定事項と提案群

| 参照 | 状態 | 内容 |
|---|---|---|
| L1 | 確定 | Alt+↑ は親への親子 edge。Alt+←/→ は「描かれている線」（子への親子 edge と incoming/outgoing GraphLink）の巡回。右の初回は先頭、左の初回は末尾、両端で循環 |
| DC35 | 確定 | Alt+↓ は `children[0]` への親子 edge。子なしは選択せず理由を表示 |
| DC36 | 確定 | 巡回順は相手 node の画面上の上→下、同じ高さなら左→右。許容差と同順位処理を明示 |
| DC37 | 確定 | Lane / Disperse でも Alt+↑/↓ は親子 edge を選択し、帯・レーン名 / group frame と両端を強調。Disperse は DC51 の選択ガイドを併用し、左右巡回は GraphLink のみ |
| DC38 | 確定 | 親子 edge は選択対象。全 Surface View でキー操作を共通化 |
| DC50 | 確定（2026-10-24 akaghef） | 親子 edge と GraphLink の総称は **Connection**（線要素）。保存実体・新しいデータ型ではなく、外部接続の意味でもない（IS110 解決）。Line は EdgeStyle の `line`、Link は GraphLink / LinkStyle、Relation は関係の意味、Connector は既存の外部接続用語と衝突するため却下 |
| DC51 | 確定（2026-10-24 akaghef） | Disperse の `scatter-guide` は現在選択中の親子 edge の両端だけを結ぶ。親子 edge 未選択時は描かない。group frame は親子表現の正本を保ち、兄弟共通の枠では区別できない選択中の子をガイドで示す。Alt+←/→ の候補は GraphLink のみ（DC37 維持、IS114 解決） |
| L2 | 提案 | 素の矢印で画面方向にある端へ node 選択を移動、Esc で開始 node に戻る |
| L3 | 提案 | F2 label、既存 `[` / `]` LinkPort、GraphLink のみ Delete、LinkStyle / direction の巡回、全編集の Undo / Redo |
| L4 | 提案 | 選択対象と両端の強調、node label による関係表示、GUI に内部 ID を出さない |

OP40 と OP41 は Director 推奨の解決案（**承認済み 2026-10-20**）として本草案へ採用する。IS111 / IS112 は解決済みとし、実装の前提は本仕様の承認のみ。OP42（保存された全GraphLinkを個別に描く案）は今回の仕様では却下する。

## Product and Operations Context

関連する現行方針は `Current_Status.md` の S17（一枚絵運用）と S3（保存・復元の信頼性）。対象は `beta/` viewer の共通操作であり、OT の起動や統合実装は含まない。Topology / GraphLink / node attributes の正本は既存 map state、選択・巡回・Esc の起点は一時的な ViewState とする。

検証は pure function の unit test と実際の viewer を用いる Playwright。レビュー URL は専用データと明記したビルドを使う。モックを作る場合も「何が選択され、どちらが両端か」だけを受入対象とし、色・太さ・装飾を判定条件にしない。

## Requirements

### Requirement 1: 親子 edge の直接選択（L1 / DC35 / DC37 / DC38）

**Objective:** 利用者として、表示方式にかかわらず親子関係を操作対象として選択したい。

#### Acceptance Criteria

1. When Navigate の node 選択で Alt+↑ を入力した時、viewer shall primary node と親を結ぶ親子 edge を、両端が描画される場合に選択し、その primary node を開始 node として保持する。複数 node 選択からは primary を起点とする単一対象へ切り替える。親がない場合は Connection を選択せず、開始 node の単一選択にして「親がありません」と表示する。
2. When 同条件で Alt+↓ を入力した時、viewer shall `children[]` の先頭の子への親子 edge を、両端が描画される場合に選択する。画面上の距離や上下位置を代わりに用いない。
3. If 子が存在しない場合、viewer shall Connection を選択せず、開始 node の選択を維持し「子がありません」と表示する（DC35）。
4. Where Lane または Disperse が選ばれ両端 node が描画される場合、viewer shall 同じ親子 edge を選択し、Lane の所属レーン名・帯、または Disperse の当該親子を所有する group frame と両端 node を強調する。帯・枠を親子線で代用しない（DC37）。Disperse では選択経路によらず、選択中の親子 edge の両端だけを結ぶ `scatter-guide` を一本併用し、親子 edge 未選択時・Esc 後はガイドを描かない（DC51）。
5. While Connection が選択されている時、viewer shall Alt+↑/↓ を保持中の開始 node に対して解釈し、起点を変えず親 / 最初の子を選択し直す。対象なしの場合は開始 node 選択に戻し理由を表示する。
6. If Alt+↑/↓ の対象端 node が現在の Surface View で描画されていない場合、viewer shall Connection を選択せず、origin node の単一選択を維持・復元する。「子は折り畳まれています」「Lane では孫より深い node を描きません」「親は scope の外です」など人間向けの理由を表示し、自動展開・scope移動・別の可視childへの置換を行わない（OP41、IS112解決済み）。

### Requirement 2: 描画された Connection の巡回（L1 / DC36 / DC37）

**Objective:** 多数の線が接続する node でも、一方向に一本という制約なしに各対象へ到達したい。

#### Acceptance Criteria

1. When Alt+←/→ を入力した時、viewer shall 開始 node の子への親子 edge のうち現在線として描画されるものと、同 node に接続して renderer が現在描く incoming/outgoing GraphLink の線を、その描画単位で列挙する（OP40）。保存集合へ候補を拡張せず、除外・集約規則は変更しない。親への親子 edge は左右巡回へ含めない。
2. Where Lane / Disperse の場合、viewer shall 左右巡回に GraphLink だけを含め、帯・group frame・ガイド・集計内訳線・プレビュー装飾を含めない。
3. When 巡回を開始した時、viewer shall Alt+→ で先頭、Alt+← で末尾を選択する。継続時は次 / 前へ移動し、末尾→先頭、先頭→末尾へ循環する。
4. When 順序を計算する時、viewer shall 相手 node の画面中心の Y 昇順を基本とし、設計で定義する **6 CSS px** の行許容差で同じ高さを判定し、同じ行内は X 昇順とする。同点は種別、正本の安定した内部キーで決定する。内部キーは表示しない。
5. While 同一描画 revision で巡回する時、viewer shall 順序・開始 node を維持する。再配置・zoom・可視集合が変化した次の入力では新しい描画 snapshot から順序を再計算し、現在対象の同一性を保持して巡回を続ける。
6. If 候補がゼロなら、viewer shall 開始 node 選択を維持または復元し「選択できる線がありません」と表示する。重複する GraphLink を incoming / outgoing の両方として二重列挙しない。
7. If renderer が GraphLink を除外・集約する場合、viewer shall 描画単位を維持する。親子 edge label へ折り込まれた GraphLink は独立候補にせず、その親子 edge が表す。Lane root / レーン名への非描画 GraphLink は候補外。複数の保存 GraphLink を表す System の線は一候補とする。検証 shall fixtureごとに独立して記述した期待**描画集合**と候補を照合し、全保存GraphLinkとの一致を要求しない（OP40、IS111解決済み）。

### Requirement 3: 両端への移動と復帰（L2 提案）

**Objective:** 選択した Connection から、画面で見えている方向へ移動したい。

#### Acceptance Criteria

1. While Connection が選択されている時、viewer shall 修飾なし矢印を両端 node の画面中心を結ぶベクトルで判定する。絶対 X 差が絶対 Y 差以上なら左右、それ以外なら上下を対応方向とする。45度の同点は水平を優先する。
2. When 対応する矢印を入力した時、viewer shall その方向にある端を単一 node 選択にし、Connection 選択を解除する。GraphLink.direction や曲線の接線は移動方向に使わない。
3. If 矢印が対応しない、または中心間距離が 1 CSS px 未満の場合、viewer shall 選択とデータを変えず、通常の node navigation に入力を落とさない。
4. When 選択中に Esc を入力した時、viewer shall 開始 node の単一選択へ戻る。対象の巡回・編集で開始 node を変更しない。入力欄編集中の Esc はまず編集の取消だけを行う。
5. If 開始 node が削除・不可視化された場合、viewer shall 有効な可視先祖、なければ現在 scope の root へ戻り理由を表示する。存在しない ID を選択状態へ残さない。
6. When node 選択へ戻った後に素の矢印を入力した時、viewer shall 既存 navigation を使う。Lane down/right の行・列、レーン名、root への到達と node の F2 編集を維持する。

### Requirement 4: label と GraphLink の編集（L3 提案）

**Objective:** 選択対象を取り違えず、編集を一操作ずつ取り消せるようにしたい。

#### Acceptance Criteria

以下の編集許可は、GraphLinkの場合は単一の保存GraphLinkを表す線に限る。複数件の集約線は4.11を優先し、その編集拒否はL3の採否によらずOP40の必須契約とする。

1. When Connection 選択中に F2 を入力した時、viewer shall GraphLink は `label`、親子 edge は子 node の `attributes["m3e:edge-label"]` を全選択した入力欄で編集する。node 本文、relationType、他の属性を変更しない。
2. When 入力欄で Enter または blur により確定した時、viewer shall trim した label を保存する。空なら label を解除する。Esc は編集前の値を維持し、同一値の確定・取消では履歴を追加しない。
3. When GraphLink 選択中に `[` / `]` を入力した時、viewer shall それぞれ sourcePort / targetPort を既存順 `right → bottom → left → top → right` で巡回する。`auto` / 未指定からの初回は right。親子 edge 選択中は適用せず理由を表示し、scope navigation に落とさない。
4. When GraphLink 選択中に **Shift+S** を入力した時、viewer shall LinkStyle を `default → dashed → soft → emphasis → default` で巡回する。EdgeStyle は変更しない。
5. When GraphLink 選択中に **Shift+B** を入力した時、viewer shall direction を `none → forward → backward → both → none` で巡回する。source / target node の入替や Topology の変更は行わない。
6. When Delete を入力した時、viewer shall GraphLink 選択ならその GraphLink 一件だけを削除し開始 node に戻る。親子 edge 選択なら何も削除せず「親子 edge は Delete で削除できません」と表示する。Backspace も安全のため同じ判定を使い、node delete / scope exit に落とさない。
7. While 親子 edge が選択されている時、viewer shall Shift+S / Shift+B を無変更・理由表示とし、GraphLink 専用属性を追加しない。
8. When 実際に値が変わる編集を確定した時、viewer shall 既存の snapshot → mutation → touchDocument / autosave の経路に一回だけ乗せる。Undo / Redo で label / ports / style / direction / GraphLink の削除を往復でき、children[]、node 本文、未知の attributes を保持する。
9. While read-only の時、viewer shall 選択・L2 移動は許可し、F2 / ports / style / direction / Delete / Backspace の mutation を拒否する。既存の `[` / `]` read-only 通過規則を編集許可に流用しない。
10. While Connection 選択中、viewer shall 起点 node を暗黙の編集対象にしない。未定義の node 変更キー（Enter / Tab / Grab / cut / paste / reparent など）は理由付きで拒否し、node 選択へ明示的に戻ってから使わせる。

11. While 複数の保存 GraphLink を表す一つの線が選択されている時、viewer shall F2 / `[` / `]` / Shift+S / Shift+B / Delete / Backspace を消費して「複数の GraphLink を表す線は編集できません」と表示し、editor・port操作UIを起動せず、データも履歴も変更しない。保存GraphLinkを任意に一件選んだり、一括編集・一括削除したりしない。

### Requirement 5: 選択表示と status（L4 提案、ID 非表示は独立した必須制約）

**Objective:** 操作対象と両端の意味を、内部 ID を読むことなく確認したい。

#### Acceptance Criteria

1. While Connection が選択されている時、viewer shall 対象の線、または DC37 の表現と、両端 node を同時に識別可能にする。両端の強調を node の複数選択として保存しない。
2. When 選択対象が変わった時、viewer shall `元のnode label → 先のnode label（関係名）` を status に表示する。親子 edge は親→子と edge label、GraphLink は source→target と label / relationType を用いる。
3. If label と relationType が両方ある場合、viewer shall `（label / relationType）`、片方ならその値だけ、両方なければ `（GraphLink）` とする。親子 edge の label がなければ `（親子）` とする。direction は必要なら別の説明として付け、保存上の source→target と混同しない。
4. If node label が空または参照先が欠ける場合、viewer shall 「名称未設定」または「参照先がありません」を使い、UUID / node ID / GraphLink ID を fallback 表示しない。status・tooltip・編集欄見出し・aria-label も同じ制約に従う。
5. While 選択状態が続く時、viewer shall 選択内容を status で確認可能に保つ。一時的な操作結果の表示後も選択内容へ戻す。
6. If mock / sketch を使う場合、受入判定 shall 選択対象・両端・表示位置の意味に限定し、色・線幅の一致を要求しない。

7. While 複数の保存GraphLinkを表す線が選択されている時、viewer shall 描画された代表nodeのlabelで `元 → 先（GraphLink 3 本）` のように件数を表示する。L2では描画された両端へ移動する。集約件数表示と編集拒否はL4の採否によらずOP40の必須契約とする。

### Requirement 6: 入力境界、共通設計、Surface View ごとの検証

**Objective:** 既存の文字編集・操作を壊さず、全 Surface View に共通の契約を適用したい。

#### Acceptance Criteria

1. While input / textarea / select / contenteditable / inline editor がアクティブ、または IME 変換中の場合、viewer shall Alt+矢印を intercept / preventDefault しない。macOS の単語移動・文字選択を入力欄へ渡す。event.target と activeElement の双方、および編集セッション状態を確認する。
2. While Grab、ポインター操作、モーダルまたは Progressive Navigation がキーを所有する時、viewer shall 同じ入力で Connection 選択を同時に発火させない。Navigate の board 所有時だけ適用する。
3. When 実装する時、選択・巡回・順序・移動判定・status 整形・削除可否のロジック shall `beta/src/shared/` の pure function に置く。shared は DOM、viewer globals、Surface View 名による分岐を持たない。
4. When viewer に接続する時、実装 shall 既存の選択・描画・edge_port / edge_route・履歴を再利用し、`viewer.ts` の追加を基準版に対して **net +40 行以下**、かつ追加行総数 **120 行以下**の接続処理に制限する。計測方法は design.md に従う。
5. When ブラウザで受入確認する時、検証 shall 実装済みの **Tree、Axial、Disperse、System、Lane down、Lane right** を対象とする。少なくとも Tree / Disperse / System / Lane down / Lane right でキーボードのみの一連操作を実測する。Axialも既存fixtureを安価に利用できる場合は同じ試験を行い、省略時は具体的な理由と代替の契約検証結果を記録する。Radialは今回の完了条件に含めず、他viewで代用しない。将来のRadial実装作業が同じsnapshotを供給し「Radial の線選択確認」を自身の受入に含める（IS113）。
6. When Playwright を実行する時、検証 shall 対象 checkout の `npm run build:browser` を先に実行する。製品サーバーを使うテストでは `build:node` も実行し、個人 workspace / 4173 を使わない。
7. When レビューを依頼する時、実装担当 shall 例示 map が既に読み込まれる URL、map 名、使用 source/build、確認操作、未達項目を提示する。別worktreeの古いビルドを検証対象の完成版として渡さない。

## Issues, Resolutions and Risks

| ID | 状態 / 内容 | 本仕様での扱い |
|---|---|---|
| IS110 | 解決済み（DC50）: 総称は Connection（線要素） | Glossary に登録し、両者をまとめて扱う記述に使用。種別の対比・保存上の区別は維持 |
| IS111 | 解決済み（OP40）: 描画単位と保存単位の差 | 現在描かれる線だけを候補とする。rendererの除外・集約規則は変更しない |
| IS112 | 解決済み（OP41）: 非描画endpoint | 選択しない、origin維持、理由表示。自動展開しない |
| IS113 | 別作業: ADR_012で正本に復帰したRadialに実装入口がない | 本仕様の完了を妨げない。Radial実装作業の受入に「同じrenderer snapshotを供給し、Radial の線選択確認（Alt巡回、上下、L2、L3、両端強調）を行う」を引き継ぐ。他viewで代用しない |
| IS114 | 解決済み（DC51）: Disperse のガイドは親子 edge 選択時だけ描画 | group frame と両端を強調し、選択中の一組だけにガイドを表示。左右巡回の候補からは引き続き除外 |
| OP42 | 却下案 | 保存された全GraphLinkを個別に描く変更は今回行わない |
| OP40 | 承認済み 2026-10-20 | 描画集合と候補集合を一致させる。集約線は一候補、件数表示、編集拒否 |
| OP41 | 承認済み 2026-10-20 | Alt+↑/↓の対象端が非描画ならoriginを選択したまま理由表示 |
| RK9 | 資料・ショートカットのdrift | 実装時に照合を再実行。Shift+S / Shift+Bの既存割当は静的照合ではなし、実機は未確認 |
| RK10 | 旧node操作・履歴へ入力が落ちる危険 | 選択を一元化し、集約線も含めて拒否・履歴不変を確認 |
| RK11 | 4187が別worktreeのビルドで調査時応答なし | 新ビルドの隔離コピーと別ポートを使用 |
| RK12 | 受容した制限: どのSurface Viewも描かない保存GraphLinkはキーボードで到達できない | 描画範囲の改善を可視の後続課題として残す。本仕様の完了を妨げない |
