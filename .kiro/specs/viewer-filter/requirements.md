# Requirements Document

## Project Description (Input)

**viewer-filter — 案F2**。同じ map を読みながら、表示する対象を選ぶ選択 UI（以下フィルタ）を使い、対象外を薄くして関係を比較する。Layout と保存内容は変えない。

**現状:** 専用の操作 UI はない。`ImportanceViewMode` は `all` 固定で、Inspector から操作する機能ではない。GraphLink の confidence による描画判定もない。今回の草案は既存機能の単純な移設ではなく、操作できる表示条件の追加である。

**変更すること:** viewer 上段の独立したグループに各軸の現在値を置き、選択肢は chip のメニューで開く。対象外の node / GraphLink / edge を opacity で薄くし、status bar に一致数を常時表示する。

> Status: 2026-10-20、Director レビュー済み草案（259889b）を akaghef の決定で改訂。今回の変更は3仕様文書と Glossary の2行のみ。製品実装・mock 変更は行わない。

## Boundary Context

| 区分 | 範囲 |
|---|---|
| 今回 | `requirements.md` / `design.md` / `tasks.md` と Glossary の2行。日本語の仕様、ソース根拠、検証計画 |
| 承認後の最初の実装範囲 | 実現段階・重要度・緊急度・所属の4軸、解除、濃淡、永続表示の件数。既存 viewer / WorkbenchApp / renderer を利用 |
| 対象外 | 時間・文字列、軸の動的追加、EDGE AUDIT の候補ペア導出、保存 schema / API、Inspector の再設計、独自 renderer / server、Radial の新規実装、WebGL 対応 View の拡張、Final |
| 所有者 | 今回の担当は仕様改訂を codex/viewer-filter に commit。後続実装は別途承認する |

正規語は [Glossary](../../../docs/00_Home/Glossary.md)、[Surface View](../../../docs/03_Spec/map_layout_modes.md)、[Data Model](../../../docs/03_Spec/Data_Model.md) に従う。edge は親子関係のみ。GraphLink と混同しない。scope は構造境界であり、A-sys の Domain の固定リストを持ち込まない。浮くメニューは Panel として既存の上段 UI に接続する。

本件は同じ map 上で関係を読み分けるための表示操作で、観測・保存・scope の所有権を追加しない。追跡 ID は IS90〜IS109 / OP30〜OP39 を使う（Director 割当）。

## Mock Contract and Deviations

[FilterChips.dc.html](mock/FilterChips.dc.html) は bar / menu の構造、[FilterSurface.dc.html](mock/FilterSurface.dc.html) は A-sys を Lane で表示したときの濃淡と status bar の参考とする。色、角丸、寸法、opacity の特定数値、線の装飾は受け入れ条件にしない。mock は実装や試験 fixture の代替ではない。

mock にある「＋ 軸を追加」（時間・文字列）は最初の実装範囲に含めず、ボタンも出さない。EDGE AUDIT は除外し、TO-BE を絞らない値・既定値にする。mock の解除先 `audit` と active 判定は転用しない。Facet / Domain は node の所属 attributes で表し、重要度・緊急度を追加する。mock の Domain ごとの手書き集合、候補関係、描画順変更、枠色変更は移植しない。最初の実装では一致時の従来描画を保ち、非一致時の opacity だけを変更する。

## Requirements

### 確定した受け入れ条件

**条件1:** 実装済みの全 Surface View（Tree、Axial、Logic Chart の既存実装経路、System、Disperse、Lane）で、フィルタ有無による全 node 座標と全 GraphLink / edge の経路の差はゼロである。SVG / WebGL の両経路に同じ条件を課す。現状 WebGL がない View は SVG で検証し、対応拡張をこの条件のために行わない。Logic Chart は正本上 Tree の preset であり、新しい正規分類を追加しない。

**条件2:** 複数の軸は AND で組み合わせる。軸を追加選択して Layout の入力、寸法、兄弟順序、collapse、force simulation を変更せず、再配置・force の起動や再起動を発生させない。

**条件3:** A-sys の CROSS-DOMAIN VIEW は node の所属 attributes で絞る（IS92）。scope 軸は設けない。

**条件4:** 案F2として bar を viewer の上段、左 top bar と右 top bar の間の水平中央に、独立したグループとして置く。`WorkbenchApp` から `TopBar` の隣に新しい browser module を mount する。

**条件5:** 登録済みの全軸に常に chip を1つ置き、軸名・現在値・下向き chevron を表示する。選択肢の全体は chip から開いたメニューだけに表示する。絞らない値以外を選択した有効な chip は active と視認できる。描画対象の node / GraphLink に当該軸の attributes が一つもなければ disabled にし、理由「この map には値がありません」を常時読める形で示す（IS99）。

**条件6:** chip の click でその直下にメニューを開き、再 click で閉じる。同時に開くメニューは1つ。Escape で閉じる。

**条件7:** 単一選択軸は radio 行で、各行にラベルと意味を1行で示す。選択すると直ちに適用して閉じる。段階的に対象が広がる軸では、選択値より狭い行に「含む」を付ける。

**条件8:** 複数選択軸は「すべて」行、区切り、値ごとの checkbox 行、閉じるボタンを持つ。変更を即時適用し、メニューは開いたままとする。「すべて」は選択集合を空にする。

**条件9:** 「解除」で全軸をそれぞれの絞らない値へ戻す。

**条件10:** 非一致の node / GraphLink / edge は opacity で薄くする。非表示・削除・移動しない。一致するものは従来どおり描画する。既存の色・線種・矢印・ラベル・選択・hit target を保持し、選択後の差分描画でも濃淡が失われない。

**条件11:** いずれかの軸が active の間、status bar に「node 一致数/描画数 · GraphLink 一致数/描画数」を永続表示する。`setStatus()` を経由せず、2.5秒後も消えない。一時メッセージの表示・消去で件数を消さない。

**条件12:** 実際の button と menu の意味を持つ要素を使い、`aria-haspopup`、`aria-expanded`、`menuitemradio` / `menuitemcheckbox`、`aria-checked` を実状態と同期する。keyboard だけで開閉・選択・解除ができる。Tab / Shift+Tab、Enter / Space、上下移動、Escape と chip への focus 復帰を検証する。

**条件13:** `beta/src/browser/viewer.ts` は実装前より増やさない（実装後の正味行数 <= 実装前）。草案基準は17,274行。判定は純粋 module、UI と濃淡の処理は別 browser module に置き、viewer は状態・描画データの受渡しと共通 scene への呼出に限定する。無関係なコード移動や行圧縮で行数を満たさない。

**条件14:** opacity は祖先 group だけでなく WebGL capture 対象の各 primitive に到達させる。フィルタ変更時に capture / tile cache を更新し、SVG だけが変わる状態を合格にしない。選択差分にも同じ濃淡を再適用する。

### 決定に基づく受け入れ条件

**条件15:** 実現段階は GraphLink.attributes.confidence を読む。CURRENT「動作を確認した関係だけ」は `system-evidenced` のみ、TO-BE「採用した設計（図に書いた関係すべて）」は全 GraphLink を対象とする。TO-BE の値は `all`（絞らない・既定）。欠落は `declared` 相当、未知文字列も CURRENT には一致せず TO-BE には含む。保存値を書き換えない。CURRENT 中はこの軸に一致する描画 GraphLink の端点を1つも持たない node を薄くする。EDGE AUDIT は対象外。

**条件16:** 「attributes の値で絞る軸」を共通の仕組みとする。定義は対象（node / GraphLink）、attributes key(s)、値の順序または複数選択、表示名、各値のラベルと1行の意味、絞らない値を持つ。定義表は全 map 共通の checked-in shared module（`beta/src/shared/view_filter_axes.ts`）に置く。map 別設定・利用者の編集 UI はない。重要度は `importance` → `priority` → `重要度` の nullish 優先で既存 score を再利用し、低=1 / 中=2 / 高=3 / 緊急=4、整数文字列と既存の英語表記を維持する。空文字を次の key へ落とさず、欠落・不明は0。「すべて」（絞らない）/「中以上」（>=2）/「高以上」（>=3）とし、広い段階は狭い段階を「含む」。緊急度も同じ尺度・選択肢とし、既存設計の `attributes.urgency` を使う（design.md の調査根拠）。node 自身だけで判定し、先祖/root の救済をしない。`ImportanceViewMode` は撤去し、score を shared module へ移す。viewer.ts の正味行数を増やさない。

**条件17:** 所属は node の `attributes.domain` にあるカンマ区切りの名前を複数選択する。attributes は string→string とし配列を保存しない。各名前を trim し、空要素を捨て、重複を除く。候補は描画 node に存在する名前の distinct 集合。選択集合が空なら「すべて」（絞らない）、それ以外は名前が一つでも選択集合に含まれる node が一致する。欠落・空文字の node は選択中には一致しない。候補が1つでも使用可能。所属が一致していれば GraphLink のない node も一致する。

**条件18:** フィルタなしの描画集合を固定する。B＝有効な全 node 軸（重要度・緊急度・所属）に一致する node。L＝実現段階に一致し、両端が B に属する GraphLink。node は B に属し、かつ CURRENT が有効なら L の端点であるときに一致する。GraphLink は L に属するときに一致する。親子 edge は両端 node の一致で判定する。計算はこの1回で終え、反復しない。CURRENT が無効なら、所属などの node 軸に一致した孤立 node も一致する。

**条件19:** 状態は viewer session 限定で保存しない。map 変更で全軸を絞らない値に戻しメニューを閉じ、再読込でも既定値で始める。同一 map の scope / Surface View 切替では選択を保持し、現在の描画集合で再評価する。値のない軸は disabled の間は非適用・非 active とし、内部選択は保持する。値が戻れば再適用する。候補が変わっても選択を自動消去しない。

## 決定記録（2026-10-20）

| ID | 決定者 | 決定 |
|---|---|---|
| IS90 | akaghef | 表示名は「実現段階」。保存キー confidence、CURRENT / TO-BE、欠落・未知値、端点条件、EDGE AUDIT 除外は条件15 |
| IS91 | akaghef | 重要度専用の仕組みを廃し、attributes の値で絞る共通の軸定義表と4軸を採用（条件16〜17） |
| IS92 | akaghef | 以前の決定（元の番号20）の「Facet は scope で絞る」を「所属 attributes で絞る」へ変更。scope 軸・scope 所有の判定は不採用。既存決定の変更を本仕様の割当内の IS92 で追跡する |
| IS93 | Director | 条件18の評価順と AND。所属だけでは「残る GraphLink の端点であること」を node に要求しない。CURRENT の端点条件は node 軸に一致した両端を持つ GraphLink から求め、A-sys の CURRENT × Domain と同じ結果にする |
| IS94 | Director | session 限定、map 変更 reset、同一 map 内で選択保持（条件19） |
| IS95 | akaghef | Glossary の GUI 表に「フィルタ」「実現段階」を指定の定義で追加 |
| IS96 | Director | design.md の描画数・一致数の境界を採用。scope 固有の行・規則は削除 |
| IS97 | akaghef | 「＋ 軸を追加」はこの範囲では表示しない |
| IS99 | Director | 登録済み全軸の chip を常設し、描画対象に当該 attributes がなければ disabled と理由「この map には値がありません」を表示 |

## 未決

なし。緊急度には既存設計の直接キー `urgency` が見つかったため、新規キー提案の IS98 は起票しない。実装の開始承認は本改訂とは別。

## Verification and Handoff

条件1〜19と上記の決定を検証計画の基準とする。試験は [tasks.md](tasks.md) に従い、製品の判定関数から独立した期待値と画面を照合する。A-sys の孤立 node に関する差分も明示して検査する。今回の文書 commit は実装・統合・稼働確認を意味しない。
