# Concreteness Axis

通常のmapをlevel 0とする仮想z軸。`j`でlevelを1増やし（奥）、`k`で1減らす（手前）。xy平面のnode移動は方向キーで行う。level移動はscopeへの出入りや親nodeへの移動とは別の操作。

## 表示とscope

負方向へ1段進むと、現在levelのscopeが普通のnodeになり、scopeの包含関係がそのlevelのTreeの親子関係になる。最初のlevel −1はShift+Rのscope一覧と同じ構造を通常のSurface Treeで表示する。node群をscopenすれば、そのlevelにもscopeを作れる。次のkではそのscopeがnodeになる。この処理を再帰的に適用する。

正のlevelでは、level 0のscope境界を外側から1段ずつ展開する。同じTree描画・選択・編集を用いる。これ以上展開・集約する対象がない場合はその旨を表示する。

levelごとの親子関係はlevel 0の親子関係から独立する。例えばlevel −1で元の異なる親の下にあったscopeをgroupingしても、元の親子関係は変更しない。本文・ラベルなどの内容は同じnodeとして共有する。

## 保存

現在のlevelはViewState。level切替だけではmapを変更しない。

追加のscope境界・親子関係・順序は既存nodeのattributesに必要時だけ保存する。level情報のない既存mapはlevel 0として読み、一括migrationを行わない。nodeの識別子と本文を複製した別mapを保存しない。

- `m3e:concreteness:created-level`: 負のlevelで追加したnodeのlevel。
- `m3e:concreteness:scope:<level>`: そのlevelでのscope境界。
- `m3e:concreteness:parent:<level>` / `order:<level>`: そのlevelで編集した親と兄弟順序。
- `m3e:concreteness:collapsed:<level>`: そのlevelでの折り畳み。

追加nodeも既存の保存Treeには接続するが、作成levelより具体的な表示には混ぜない。保存するのは元の内容と追加属性であり、現在の表示用Treeを元データへ上書きしない。Undo/Redoも非表示の内容を含む元データを対象とする。

従来のSystem previewのdetail設定は別の表示機能。以前のPJ04のL0〜L5案は、このlevelの定義には適用しない。

コピー・JSON / FreeMind出力は、選択したTreeとそれが表す元のscope内部を含む。共同編集の非zero level保存には、元のmap全体に及ぶ変更を扱うため既存のroot scope lockを必要とする。
