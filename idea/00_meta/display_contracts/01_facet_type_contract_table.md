# Facet Type 契約表

`facet` は PJ ごとに設計するが、毎回ゼロから書く必要はない。
ここでは `.claude/skills/sub-pj/references/overview.md` の facet type を基準に、
M3E での **display 契約の決め打ち default** を表で揃える。

## 共通表示チャネル

| チャネル | 何に使うか | 基本原則 |
|---|---|---|
| `depth` | 主軸、進行方向 | その facet で最も先に人間が読み取るべき軸を置く |
| `row / breadth` | 同段比較、並列 | 同じ stage / 同じ粒度のものを横に並べる |
| `anchor` | 大量 sibling の整理 | 意味を増やさず reviewability を上げるときだけ使う |
| `fill color` | 一番見たい量 | importance / confidence / status のどれか 1 軸を優先 |
| `border color` | fill の第2軸 | urgency / risk / certainty のような補助軸 |
| `text color` | 例外的強調 | 通常は固定。常用しない |
| `GraphLink` | tree 外の関係 | depth 主軸を壊さない補助線に限定する |
| `scope` | 文脈の隔離 | 隔離が本質のときだけ使う。比較を優先するなら `unscoped` |
| `collapse` | 読み込み量の制御 | 展開の既定は review 目的に合わせる |

## Facet Type ごとの決め打ち default

| facet type | 何を表すか | `parent-child` の意味 | `depth` default | `row / breadth` default | `GraphLink` default | `anchor` default | `scope` default | `fill` default | `border` default | `collapse` default |
|---|---|---|---|---|---|---|---|---|---|---|
| 実装構造 | クラス、モジュール、ファイル内部 | 所有・内包・構成 | 外→内 | 同階層要素比較 | 実依存、参照 | fan-out が大きいとき module/prefix anchor | scoped 寄り | status / completion | risk / instability | 深い階層は folded |
| 処理フロー | 時系列処理手順、呼出しチェーン | 主処理骨格 | **処理順 / 時間順** | 同段並列、分岐 | 補助依存、戻り、例外 | 原則 off、必要時のみ | unscoped 寄り | criticality / step importance | runtime risk | 主線は open |
| 依存グラフ | import、参照、前提 | spanning tree 的骨格 | 依存方向 | 同深度前提群 | 非 tree 依存 | source 密集時のみ | unscoped 寄り | centrality / importance | proof / maturity | source 周辺は open |
| 概念モデル | ドメイン概念と関係 | 主題→下位概念 or 抽象→具体 | 抽象度 | 同レベル概念比較 | 類似、対立、関連 | 強く有効 | unscoped 寄り | conceptual importance | uncertainty / contested | anchor は open |
| 型・階層 | 継承、分類、is-a | 上位分類→下位分類 | 抽象→具体 | 同分類比較 | 横断分類、例外 | 原則 off | scoped でも可 | category weight | exception / edge case | 深い枝は folded |
| マッピング | 2 世界の対応 | 左世界→右世界の対応単位 | 対応の粗粒→細粒 | 同候補比較 | 対応線そのもの | 文脈ごとに有効 | dual-scope か unscoped | confidence of mapping | ambiguity | 対応候補は open |
| データフロー | データ変換、ETL、計算グラフ | 変換骨格 | 変換順 | 並列入力/出力 | 共有データ、制御依存 | 入出力束ねで有効 | unscoped 寄り | transformation criticality | data quality risk | main path open |
| 検証 | テスト、ground truth、benchmark | spec→test→result | 検証順 | 同条件比較 | failure cause、traceability | suite 単位で有効 | scoped でも可 | test severity | confidence / flakiness | suite open, details folded |
| 設計 | API、アーキテクチャ、選択肢 | 設計論点→案→根拠 | 上位設計→詳細 | 同案比較 | trade-off、参照 | 論点クラスタで有効 | unscoped 寄り | importance | urgency / risk | 論点 open |
| タスク管理 | 作業、進捗、マイルストーン | goal→task→subtask | 計画粒度 / フェーズ順 | 同優先度比較 | blocker、依存 | フェーズ / 文脈 anchor 強く有効 | unscoped 寄り | difficulty / impact | urgency | doing 周辺 open |

## color の決め打ち原則

| facet type | Q / leaf / main node の `fill` | `border` | anchor 色 |
|---|---|---|---|
| 処理フロー | criticality | runtime risk | neutral |
| 依存グラフ | importance / centrality | maturity / proof status | neutral |
| reviews 的な設計・判断 | importance | urgency | neutral |
| option / mapping candidate | confidence | ambiguity / risk | none |
| タスク管理 | difficulty / impact | urgency | neutral |

補足:

- `fill` は「まず目に入ってほしい軸」に使う
- `border` は第2軸まで
- 3軸目以降を色に押し込まない

## row / breadth の決め打ち原則

| 状況 | `row / breadth` の意味 |
|---|---|
| 処理フロー | 同じ stage の並列処理 |
| 依存グラフ | 同深度の独立前提 |
| reviews / 設計 | 同一問いの選択肢比較 |
| 概念モデル | 同レベル概念の比較 |
| タスク管理 | 同フェーズ・同優先帯 |

## anchor の発火原則

| 使う | 使わない |
|---|---|
| 低凝集の大量 sibling | 系列として読むべき sibling |
| 文脈でバッチレビューしたい | anchor が新しい意味段に誤読される |
| unscoped のまま整理したい | 原構造がすでに十分強い |
| 集合を chunk にしたい | 連番や時系列の主線を壊す |

## scope の決め打ち原則

| `unscoped` に寄せる場合 | `scoped` に寄せる場合 |
|---|---|
| 比較・横断レビューが主目的 | 文脈隔離が主目的 |
| anchor と色で十分整理できる | subtree 単位で独立読みしたい |
| cross-link が多い | 階層を独立に運用したい |

## 使い方

1. PJ 固有 facet を 1 つ決める
2. どの `facet type` に一番近いかを選ぶ
3. まずこの表の default を採用する
4. 足りないところだけ PJ 固有契約として上書きする

これで「毎回ゼロから色・row・anchor・scope を決める」状態を避けられる。
