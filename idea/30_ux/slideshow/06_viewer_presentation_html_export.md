# Viewer Presentation View と HTML Export

DaveJ 型の architecture-flow UI を参考に、M3E の通常ビューを壊さず「presentation view」と「standalone HTML export」を増やす案。
ここでは採否を決めず、PR2/PR3 の違いと評価軸だけをプールする。

## 前提

- node 座標は固定する。
- step / flow に応じて変わるのは link / edge / highlight / progress。
- progress bar は 1段または2段。2段の場合は上位 flow と下位 step を分ける。
- map の見た目確認はスクリーンショットで検証する。
- 独立 HTML が M3E と別レンダラになると edge routing が壊れやすい。

## 選択肢

| ID | 選択肢 | 目的 | 主な利用場面 | 実装の正本 | HTML 出力 |
|---|---|---|---|---|---|
| PR2 | Viewer Presentation View | M3E viewer の表示モードとして DaveJ 型 tour を追加する | 日常レビュー、demo、map 内 presentation | beta viewer / shared graph rendering | 直接の主目的ではない |
| PR3 | Shared HTML Renderer | PR2 と同じ見た目を standalone HTML artifact に出す | 共有、記録、外部提示、オフライン閲覧 | PR2 と共通 renderer + tour spec | 主目的 |

## PR2 / PR3 詳細比較

| 観点 | PR2: Viewer Presentation View | PR3: Shared HTML Renderer |
|---|---|---|
| 位置づけ | M3E のビュー選択肢を増やす | M3E view を HTML artifact として固定する |
| ユーザー体験 | M3E 内で map をそのまま presentation に切り替える | ブラウザで単体再生できる demo / handoff を作る |
| DaveJ 型 UI | 右側に flow list / steps、中央に固定 node map | 同じ UI を standalone HTML に焼き出す |
| node 座標 | 既存 map layout を使うため固定しやすい | export 時に座標を snapshot として固定する |
| edge 描画 | 既存 viewer の routing / marker / clipping を流用できる | 共通 renderer 化しないと edge が消える・ずれる危険がある |
| link 変化 | selected flow に応じて active edges を切り替える | 同じ tour spec から active edges を切り替える |
| progress bar | viewer overlay として 1段/2段を表示 | export HTML に同じ progress state を含める |
| 編集への復帰 | presentation 中でも元 map / node に戻れる | 基本は read-only。編集復帰は link back 扱い |
| コメント / verdict | M3E の reviews / decisions と接続しやすい | export では snapshot 表示に留めるのが自然 |
| 共有性 | M3E 環境が必要 | HTML だけで共有できる |
| オフライン性 | beta app / viewer 依存 | 完全 self-contained にできる |
| 壊れにくさ | M3E 本体の描画と一致するので高い | renderer 二重化を避ければ高い |
| 実装リスク | viewer への view 追加が必要 | export 境界、asset 埋め込み、state freeze が必要 |
| 最初にやる価値 | 高い。見た目と操作の正本を作れる | PR2 後に高い。同じ renderer を外へ出せる |

## M3E view の選択肢

| ID | View | 何を見るか | 強い用途 | 弱い用途 |
|---|---|---|---|---|
| VW1 | Tree View | 階層、親子、文脈 | 構造整理、scope traversal | 連続した説明や demo |
| VW2 | System View | node 間関係、依存、横断 link | 設計レビュー、依存確認 | プレゼン順序の明示 |
| VW3 | Presentation View | 固定 node map + active links + steps | demo、onboarding、decision review | 大量編集 |
| VW4 | HTML Presentation Export | VW3 の standalone snapshot | 外部共有、記録、非 M3E 環境 | live map 編集 |

## 色付き評価表の軸

| ID | 軸 | 色で表す意味 | 用途 |
|---|---|---|---|
| EV1 | 推奨度 | 今これを採るべきか | 最終判断の見通し |
| EV2 | 優先度 | いつ着手すべきか | PR2/PR3 の順序決め |
| EV3 | 実装難度 | 実装が重いか軽いか | 見積もり |
| EV4 | 効果量 | demo / UX / 運用に効く度合い | 投資対効果 |
| EV5 | 依存度 | 他タスクにどれだけ依存するか | ブロッカー検出 |
| EV6 | リスク | 破綻・退行・二重実装の危険 | 実装方針の安全性 |
| EV7 | 可逆性 | やめやすいか、戻しやすいか | 試作判断 |
| EV8 | 検証容易性 | スクショ・テストで確認しやすいか | QA 設計 |
| EV9 | 再利用性 | 他の map / project / demo に使えるか | 長期価値 |
| EV10 | 保守コスト | 将来の修正負荷 | renderer 共通化判断 |
| EV11 | UX 即効性 | ユーザーがすぐ価値を感じるか | MVP 優先度 |
| EV12 | M3E 整合性 | workspace > map > scope > node と自然に合うか | 方向性チェック |

最小評価軸は `推奨度 / 優先度 / 実装難度 / 効果量 / リスク / 再利用性` でよい。

## 推奨シーケンス案

| ID | 順序 | 内容 | 理由 |
|---|---|---|---|
| NX1 | 先 | PR2: Viewer Presentation View を作る | M3E 本体の見た目を正本にできる |
| NX2 | 次 | renderer / edge routing を共通化する | HTML export で edge が消える問題を防ぐ |
| NX3 | 後 | PR3: Shared HTML Renderer で standalone HTML を出す | PR2 と同じ見た目を外部化できる |

## 中核式

```text
map state + tour spec
  -> Presentation View
  -> shared graph renderer
  -> standalone HTML export
```

## 論点ID

- L. Presentation View を M3E viewer の正式 view 選択肢にするか。
- M. standalone HTML export を PR2 後の共通 renderer 出力として扱うか。
- N. 多色表の評価軸をどこまで増やすか。
