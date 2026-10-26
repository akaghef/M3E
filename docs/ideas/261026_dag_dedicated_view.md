# DAG 専用の View

最終更新: 2026-10-26  
status: idea（akaghef の構想。今後の参考として残す。採否と着手時期は未定）

## 契機

Lean 形式化のまとめを M3E で保持する dogfood（[運用手順](../06_Operations/Dogfood_Lean_Formalization.md)）で、段の依存 DAG を GraphLink で張り、Lane view で表示した。Lane はレーンと兄弟順序で配置を決め、GraphLink を配置の入力にしないため、依存の流れ（前提から後続へ）は線の束としてしか読めなかった。akaghef は「DAG は DAG 専用の View を作るべき」と判断した。SortedTaskView で以前に試みたが、確立していない。

## System との重なり

[Surface View 仕様](../03_Spec/map_layout_modes.md)の「Lane と System の区別」では、GraphLink が表す流れの向きに沿って node を段に振り分ける配置（elkjs の `layered`、dagre など）を System 側の方式と定めている。DAG 専用の View を作るには、まず System との区別を決める必要がある。

- System の主眼は構造・責務・接続で、subtype は containment / module / architecture である。箱・境界・モジュールの投影が中心で、依存の段そのものを主に読ませる View ではない。
- DAG の View は、前提から後続への段（層）、並行に着手できる集合、クリティカルパスを読ませることが主眼になる。
- 配置の入力が GraphLink の向きである点は、両者で共通している。

## SortedTaskView が定着しなかった理由

旧 SortedTaskView（[REST writer の履歴](../legacy/m3e-map-rest/scripts/sort-task-render_map.mjs.txt)）は、DAG の段を木の深さに対応させて保存した。段 L の node の親には前提の一つ（クリティカルパス上のものを優先）を選んで所有関係にし、残りの依存だけを GraphLink（`depends-on`）にした。

この方式は、配置の都合で永続 Topology（親子 `edge` による所有）を書き換える。「View の切替は永続 Topology を変えない」という原則に反し、データが DAG を見るための形に縛られて、ほかの View と共有できない。所有関係の親が依存の一つから機械的に選ばれるので、親子 `edge` の意味も失われる。確立しなかった根本の原因はここにあると考える。

DAG 専用の View では、依存はすべて GraphLink で持ち、段・並行集合・クリティカルパスは表示時に計算する導出値として扱い、永続データに保存しない。

## 案

### System の subtype として作る（推奨）

段の配置は GraphLink だけから計算し、所有関係（木）には触れない。既存の 6 種の分類（Tree / Axial / Radial / Disperse / System / Lane）を保ったまま追加できる。System の既存 subtype との違い（段を主に読ませること）を subtype の定義として書く必要がある。

### 7 番目の Surface View として新設する

分類と Glossary の変更を伴う。System との判定基準を、Lane と System の判定（孫 node 間の GraphLink を全て外しても座標が変わらないなら Lane）と同等の観察できる性質として定める必要がある。

## 受入の例

`M:(研究)> PJ261015 Lean形式化 >> 最遠までの道のり（段と横断トラック）` に、レーン 3 本、段 18、依存の GraphLink 20 本（必須 14、再利用 4、代替経路 2）がある。データは View に依存しない形で保存されているので、そのまま DAG の View の受入例として使える。

## 未決

- System の subtype と新しい Surface View のどちらにするか。
- 依存の種類（必須・再利用・代替経路）で段の計算を変えるか。再利用や代替経路を段の制約に含めるか、線として描くだけにするか。
- 閉路があった場合の扱い（DAG でない入力の検出と表示）。
- Lane のレーン（親 node の兄弟順序）と DAG の段を同時に見せるか。見せる場合、どちらが配置を決めるか。
- MCP から Surface View を選ぶ操作がない（2026-10-26 の Feedback）。AI agent が「この scope は DAG で読む」という表示意図を整えられるようにするか。
