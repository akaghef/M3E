# Requirements Document

## Project Description (Input)

**viewer-filter — 案F2**。同じ map を読みながら、表示する対象を選ぶ選択 UI（以下フィルタ）を使い、対象外を薄くして関係を比較する。Layout と保存内容は変えない。

**現状:** 専用の操作 UI はない。`ImportanceViewMode` は `all` 固定で、Inspector から操作する機能ではない。GraphLink の confidence による描画判定もない。今回の草案は既存機能の単純な移設ではなく、操作できる表示条件の追加である。

**変更すること:** viewer 上段の独立したグループに各軸の現在値を置き、選択肢は chip のメニューで開く。対象外の node / GraphLink / edge を opacity で薄くし、status bar に一致数を常時表示する。

> Status: 2026-10-20、Director 審査前の仕様草案。確定条件と akaghef 確認待ちの仕様案を区別する。今回の成果物は本ディレクトリの文書と提供済み mock の commit のみ。Phase 0 完了前に製品実装を始めない。

## Boundary Context

| 区分 | 範囲 |
|---|---|
| 今回 | `requirements.md` / `design.md` / `tasks.md` と提供済み mock 2ファイル。日本語の仕様、ソース根拠、検証計画 |
| 承認後の最初の実装範囲 | 確度・重要度・scope の3軸、解除、濃淡、永続表示の件数。既存 viewer / WorkbenchApp / renderer を利用 |
| 対象外 | 時間・文字列、軸の動的追加、EDGE AUDIT の候補ペア導出、保存 schema / API、Inspector の再設計、独自 renderer / server、Radial の新規実装、WebGL 対応 View の拡張、Final |
| 所有者 | Director が未決への回答・実装承認を記録し、本流統合・push・通常 Beta 検証を担当する |

正規語は [Glossary](../../../docs/00_Home/Glossary.md)、[Surface View](../../../docs/03_Spec/map_layout_modes.md)、[Data Model](../../../docs/03_Spec/Data_Model.md) に従う。edge は親子関係のみ。GraphLink と混同しない。scope は構造境界であり、A-sys の Domain の固定リストを持ち込まない。浮くメニューは Panel として既存の上段 UI に接続する。

本件は同じ map 上で関係を読み分けるための表示操作で、観測・保存・scope の所有権を追加しない。追跡 ID は IS90〜IS109 / OP30〜OP39 を使う（Director 割当）。

## Mock Contract and Deviations

[FilterChips.dc.html](mock/FilterChips.dc.html) は bar / menu の構造、[FilterSurface.dc.html](mock/FilterSurface.dc.html) は A-sys を Lane で表示したときの濃淡と status bar の参考とする。色、角丸、寸法、opacity の特定数値、線の装飾は受け入れ条件にしない。mock は実装や試験 fixture の代替ではない。

mock にある「＋ 軸を追加」（時間・文字列）は最初の実装範囲に含めず、ボタンも出さない。EDGE AUDIT は除外し、TO-BE を絞らない値・既定値にする案を採る。mock の解除先 `audit` と active 判定は転用しない。Facet / Domain は scope へ置き換え、重要度を追加する。mock の Domain ごとの手書き集合、候補関係、描画順変更、枠色変更は移植しない。最初の実装では一致時の従来描画を保ち、非一致時の opacity だけを変更する。

## Requirements

### 確定した受け入れ条件

**条件1:** 実装済みの全 Surface View（Tree、Axial、Logic Chart の既存実装経路、System、Disperse、Lane）で、フィルタ有無による全 node 座標と全 GraphLink / edge の経路の差はゼロである。SVG / WebGL の両経路に同じ条件を課す。現状 WebGL がない View は SVG で検証し、対応拡張をこの条件のために行わない。Logic Chart は正本上 Tree の preset であり、新しい正規分類を追加しない。

**条件2:** 複数の軸は AND で組み合わせる。軸を追加選択して Layout の入力、寸法、兄弟順序、collapse、force simulation を変更せず、再配置・force の起動や再起動を発生させない。

**条件3:** A-sys の Facet（Domain を選ぶ）は、M3E では「scope で絞る」とする。

**条件4:** 案F2として bar を viewer の上段、左 top bar と右 top bar の間の水平中央に、独立したグループとして置く。`WorkbenchApp` から `TopBar` の隣に新しい browser module を mount する。

**条件5:** 軸ごとに chip を1つ置き、軸名・現在値・下向き chevron を表示する。選択肢の全体は chip から開いたメニューだけに表示する。絞らない値以外を選択した chip は active と視認できる。

**条件6:** chip の click でその直下にメニューを開き、再 click で閉じる。同時に開くメニューは1つ。Escape で閉じる。

**条件7:** 単一選択軸は radio 行で、各行にラベルと意味を1行で示す。選択すると直ちに適用して閉じる。段階的に対象が広がる軸では、選択値より狭い行に「含む」を付ける。

**条件8:** 複数選択軸は「すべて」行、区切り、値ごとの checkbox 行、閉じるボタンを持つ。変更を即時適用し、メニューは開いたままとする。「すべて」は選択集合を空にする。

**条件9:** 「解除」で全軸をそれぞれの絞らない値へ戻す。

**条件10:** 非一致の node / GraphLink / edge は opacity で薄くする。非表示・削除・移動しない。一致するものは従来どおり描画する。既存の色・線種・矢印・ラベル・選択・hit target を保持し、選択後の差分描画でも濃淡が失われない。

**条件11:** いずれかの軸が active の間、status bar に「node 一致数/描画数 · GraphLink 一致数/描画数」を永続表示する。`setStatus()` を経由せず、2.5秒後も消えない。一時メッセージの表示・消去で件数を消さない。

**条件12:** 実際の button と menu の意味を持つ要素を使い、`aria-haspopup`、`aria-expanded`、`menuitemradio` / `menuitemcheckbox`、`aria-checked` を実状態と同期する。keyboard だけで開閉・選択・解除ができる。Tab / Shift+Tab、Enter / Space、上下移動、Escape と chip への focus 復帰を検証する。

**条件13:** `beta/src/browser/viewer.ts` は実装前より増やさない（実装後の正味行数 <= 実装前）。草案基準は17,274行。判定は純粋 module、UI と濃淡の処理は別 browser module に置き、viewer は状態・描画データの受渡しと共通 scene への呼出に限定する。無関係なコード移動や行圧縮で行数を満たさない。

**条件14:** opacity は祖先 group だけでなく WebGL capture 対象の各 primitive に到達させる。フィルタ変更時に capture / tile cache を更新し、SVG だけが変わる状態を合格にしない。選択差分にも同じ濃淡を再適用する。

### 仕様案の受け入れ条件（すべて akaghef 確認待ち）

以下は Director 提案を採用候補として具体化したもの。確定済みとは扱わない。

**条件15:** 確度は GraphLink.attributes.confidence を読む。CURRENT「確認済みの関係だけ」は `system-evidenced` のみ、TO-BE「図に書いた関係すべて」は全 GraphLink を対象とし、後者を絞らない値・既定値とする。欠落は `declared` 相当。未知の文字列も CURRENT には一致せず TO-BE には含む。属性を書き換えない。CURRENT 中は確度に一致する描画対象 GraphLink の端点を1つも持たない node を薄くする。EDGE AUDIT は対象外。

**条件16:** 重要度は node 自身の既存 score を用い、「すべて」（絞らない・既定）/「高以上」（`high-plus`、score >= 2）/「高のみ」（`high-only`、score >= 3）。属性の優先順は `importance` → `priority` → `重要度`。子孫の一致による先祖救済や root の特例は設けない。現在操作できない `ImportanceViewMode` と分岐を新 module に置き換える。なお既存 score 2 は「中」であり、「高以上」というラベルと閾値の対応は確認が必要である。

**条件17:** scope は複数選択。値は現在の Surface View の描画 node が所属する scope の集合。node の最も近い先祖 scope 境界を所有 scope とし、それがない場合は現在の root scope とする。境界 node 自身は親側の scope に所属し、現在の root scope の node 自身だけは現在の scope に所属する。空集合はすべてに一致、複数 scope の選択は同一軸内ではいずれかへの所属で一致する。2 scope 未満なら chip を disabled とし「この表示に scope が1つしかありません」を理由として表示する。`isNodeInScope()` をこの判定に転用しない。

**条件18:** node は active な全 node 軸と、確度 active 時の端点条件をすべて満たした場合に一致する。GraphLink は確度と両端 node の一致を満たす場合に一致する。親子 edge は両端の一致で判定する。端点条件は最終 GraphLink 一致結果から再帰的に求めず、確度だけで先に判定した GraphLink から求める。

**条件19:** 状態は viewer session ごとに持ち、保存しない。map が変わると全軸を絞らない値へ戻し、メニューを閉じる。再読込でも既定値で始める。

## 未決

- IS90（akaghef 確認待ち）: 確度の2値・既定値・欠落値と未知値・CURRENT の端点条件、EDGE AUDIT の除外（条件15）。
- IS91（akaghef 確認待ち）: 重要度のラベルと閾値、自身だけの判定、操作不能な旧状態の撤去（条件16）。既存 score 2 は「中」なので、Director 案はラベルを「すべて／中以上（score >= 2）／高以上（score >= 3）」に改める。
- IS92（akaghef 確認待ち）: scope の値集合・最も近い先祖による所有・境界 node 自身の扱い・disabled 理由（条件17）。
- IS93（Director 決定、異議があれば akaghef）: node / GraphLink / edge の AND と端点条件の評価順は条件18のとおり。
- IS94（Director 決定、異議があれば akaghef）: session 限定と map 変更時の reset（条件19）。同一 map 内の scope / Surface View 切替では選択を維持し、scope 候補が2未満の間はその軸を非適用とする。
- IS95（akaghef 確認待ち）: `フィルタ` の Glossary 登録。現行 Glossary に項目がないため、承認までは冒頭の説明を使い、この作業では Glossary を変更しない。
- IS96（Director 決定、異議があれば akaghef）: 描画数は画面外も含む現在の scene の node 本体と実際に描画した GraphLink を各1件とする。Lane 見出し・System preview・NETWORK・alias・代表端点への集約は design.md の境界案のとおり。
- IS97（akaghef 確認待ち）: mock の「＋ 軸を追加」（時間・文字列）を最初の実装範囲から外す。

## Verification and Handoff

条件1〜14を固定し、条件15〜19と上記の境界案は Phase 0 で回答を記録する。試験は [tasks.md](tasks.md) に従い、独立した fixture 期待値と画面を照合する。mock の自身との比較や試験合格だけを通常 Beta の受け入れにしない。今回の文書 commit は実装・統合・稼働確認を意味しない。
