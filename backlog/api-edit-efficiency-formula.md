# API編集効率の定式化

チャットでのmath rendering限界対策でmd化。AlgLibMoveで "API編集#効率" を議論する際の共通語彙として。

## 基本定義

$$
E_{\text{API}} = \frac{\Delta V_{\text{intent}}}{C_{\text{cost}}}
$$

- $\Delta V_{\text{intent}}$: 意図した変更が成立した量 (valuable delta)
- $C_{\text{cost}}$: その変更にかかったコスト

## 分子: 有効変更量

$$
\Delta V_{\text{intent}} = \sum_{i \in \text{edits}} w_i \cdot s_i \cdot r_i
$$

- $w_i$: 編集 $i$ の重要度重み
- $s_i \in \{0,1\}$: 成功フラグ (post-condition を満たしたか)
- $r_i \in [0,1]$: 保持率 (後続編集で巻き戻されずに残った割合)

## 分母: コスト

$$
C_{\text{cost}} = \alpha T_{\text{tok}} + \beta N_{\text{call}} + \gamma L_{\text{lat}} + \delta R_{\text{retry}}
$$

- $T_{\text{tok}}$: 入出力トークン総数
- $N_{\text{call}}$: tool call 回数
- $L_{\text{lat}}$: 累積レイテンシ
- $R_{\text{retry}}$: 失敗リトライ数
- $\alpha, \beta, \gamma, \delta$: 環境依存係数

## 派生指標

**ワンショット率**:
$$
\rho_1 = \frac{|\{i : s_i = 1 \wedge \text{attempts}_i = 1\}|}{|\text{edits}|}
$$

**編集あたり情報効率**:
$$
\eta = \frac{\Delta V_{\text{intent}}}{T_{\text{tok}}}
$$

**実効スループット**:
$$
\Phi = \frac{\sum_i s_i \cdot r_i}{L_{\text{lat}}}
$$

## 正規化形 (比較用)

$$
\widehat{E}_{\text{API}} = \frac{\sum_i w_i s_i r_i}{\sum_i w_i} \cdot \frac{1}{\log(1 + C_{\text{cost}})}
$$

- 分子: 成功加重平均 ($[0,1]$)
- 分母: 対数スケールでコスト項を抑える
- ベンチ横断で $\widehat{E}_{\text{API}} \in [0,1]$ 近辺に収まる

## 議論の発端

- AlgLibMoveの作業効率を測る語彙として「API編集#効率」が必要
- チャット上で $\LaTeX$ が読みにくいのでmd化
- 具体測定の前段として、まず定義を共有するのが目的

## Open points

- $w_i$ (編集重要度) をどう機械的に決めるか — LOC? ファイル種別? 影響範囲?
- $r_i$ (保持率) の観測窓 — コミット単位? セッション単位? N日後?
- 係数 $\alpha,\beta,\gamma,\delta$ の初期値 — トークン課金レート基準で正規化?

*2026-04-15*
