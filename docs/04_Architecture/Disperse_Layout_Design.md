# Disperse Layout Design

最終更新: 2026-08-23

Status: working-agreement（決定 = [Decision_Pool 2026-08-23-003](../06_Operations/Decision_Pool.md)）

Surface View 正本: [map_layout_modes.md](../03_Spec/map_layout_modes.md)

## 1. 目的（正本の再掲）

> **Disperse**: 空間的な近さやクラスタで読む。主眼は関係密度・分布・近接。

**tree は Disperse の配置ではなく group の階層を担う。** collapse が graph の縮約になり、粗視化のレベルを人間が選べる。tree の深さが繰り込みの梯子になる。

## 2. 現行実装との差分

Disperse は **2実装に割れており、どちらも目的を満たしていない**。

| | `layout_port.ts` の Disperse 分岐 | viewer の `runScatterSimulation()` |
|---|---|---|
| 実体 | leaf を Y に等間隔、depth を X に送る | 自前の力学シミュレーション |
| 反復 | なし（1パス） | 無限（収束条件なし、frame ごとに1反復） |
| 衝突 | なし | 中心間距離のみ。半径の和を使っておらず重なりを防げない |
| ノード寸法 | `w` だけ採用し `h` を捨てる（正方形に置換） | 実測 box ではなく node 数と depth から半径を生成 |
| group | なし | なし |
| edge の影響 | なし | バネあり |
| 決定論 | あり（`seed` option は未使用） | frame 数が外部時刻依存で保証なし |

- `layout_port` 側は **Tree を横倒しにしたもの**。近接も密度も表現していない。縦長になるのは症状ではなく正体（Y は leaf 数に線形比例）。
- viewer 側は **d3-force の劣化自作**。速度とバネはあるが、焼きなまし・衝突・決定論の規律が欠けている。

「自作しない」規則の最も強い論拠がここにある。自作した結果が既に劣化コピーとして存在している。

## 3. ライブラリ選択肢（思想で比較）

### OP1: d3-force — 柔らかい力を合成して冷ましながら落ち着かせる

各ノードを速度を持つ粒子とみなす。バネ（edge）、電荷的斥力、中心引力、円の衝突を**独立した力として合成**し、毎 tick 速度に足し込む。全体の `alpha`（温度）を徐々に冷まして止める＝焼きなまし。

思想の核: **すべては綱引き。保証はなく傾向だけがある。**

- 衝突が**円**。矩形の非重複を保証できない
- group という概念がなく、力を自作して真似る
- → M3E の要件（矩形・group）と思想が合わない

### OP2: ELK (elkjs) — 読める図を構造から決定論的に組む

Eclipse モデリング世界出身。中心は**層化（Sugiyama）レイアウト**で、ノードを層に割り当て交差を減らし edge を直交ルーティングする。**compound（ノードが中にグラフを持つ）が native**。force オプションもあるが本業ではない。

思想の核: **点群を散らすのではなく、読むべき図を組む。**

- 包含構造は native で扱える
- ただし思想の重心が層化された図。「近接と密度で読む」という Disperse の主眼とは向きが違う
- 既存決定 [2026-06-06-001](../06_Operations/Decision_Pool.md) の elkjs 優先指定は `Axial.subtype=pipeline` / `System.subtype=architecture`（層化された図）の文脈であり、Disperse には射程が及んでいない

### OP3: WebCola — 制約を宣言して満たす解を解く（採用）

「押す力」ではなく**制約を書く**。「この2つは X 方向に N px 以上離れる」「この group の member は境界内に留まる」「**矩形同士は重ならない**」。stress majorization + gradient projection で制約を満たしたまま最小化する。IPSep-CoLa の研究系譜。

思想の核: **傾向ではなく保証。group と矩形の非重複が第一級。**

## 4. 決定: WebCola

要件は3つ — **矩形**が重ならない / **group** が第一級 / **collapse で縮約**できる。WebCola はこれとほぼ一対一で対応する。

| 要件 | d3-force | ELK | WebCola |
|---|---|---|---|
| 矩形の非重複 | 円のみ | 副次的 | **第一級** |
| group | 自作 | compound あり | **第一級** |
| 近接・密度が主眼 | 合う | 向きが違う | **合う** |

**既知のリスク**: WebCola は開発が停滞気味。思想の適合と保守性は別問題であり、採用時に認識しておく。

## 5. renderer との分離

描画は既存の自前 WebGL projection（`beta/src/browser/webgl_projection.ts`、branch `codex/webgl-rendering-projection-phase1`）を使う。

```text
layout（WebCola・headless・座標のみ） → LayoutResult → WebGL projection → 描画
```

sigma.js / cosmograph のような **renderer 一体型ライブラリは採らない**。自前 WebGL と二重になる。

WebGL なら大 N を描けるので、将来 force を worker で回して座標を stream する構成が取れる。

## 5.1 Disperse の edge は port を使わない

**Disperse では edge port 選択を行わない。node 中心どうしを結ぶ線分でよい。**

- port（矩形のどの辺から出るか）は Tree / Axial のように **depth 軸の向きが決まっている layout** で意味を持つ。Disperse は direction を持たず、node は任意方向に散る。
- したがって `selectPorts` を通す必要がない。`EdgeStyle` は `line` / `curve` / `force-link` を使う（正本の Disperse は `orthogonal` を持たない）。
- 実装上も、Disperse で `branchPortSide` を要求すると例外になる（2026-08-23 に lab が白飛びした原因）。**directionless であることを型と経路の両方で担保する。**

## 5.2 lab は分けない

Disperse は layout seam の一 mode であり、**専用 lab を分けず `layout-lab` に統合する**。Mode=Disperse を選んだときに Disperse 固有のコントロール（subtype / collapse / footprint / edge 集約）が出る形にする。

## 6. seam lab で決める layout の問い（未決定）

実装より先に、**Disperse がどう見えるべきか**を lab 上で決める。以下は lab のコントロールとして出し、目視で決定する。

1. **group 境界を描くか** — `cluster` で group の枠を可視化するのか、空間的な寄り／離れだけで表現するのか
2. **group 間の分離量** — `space`（tight/normal/loose）が効くべき軸はここか
3. **collapse 時の super-node の footprint** — 子孫の面積を反映するのか、固定サイズか
4. **縮約時の edge 集約規則** — 多重 edge を1本に束ねるか、太さで重みを出すか、group 内部で完結する edge は消すか

## 関連

- [map_layout_modes.md](../03_Spec/map_layout_modes.md) — Surface View 正本、Disperse の目的と subtype 定義
- [Decision_Pool](../06_Operations/Decision_Pool.md) — 2026-08-23-002（目的と粗視化）/ 2026-08-23-003（WebCola 採用）
- [Glossary §1.7](../00_Home/Glossary.md) — depth 軸 / breadth 軸
