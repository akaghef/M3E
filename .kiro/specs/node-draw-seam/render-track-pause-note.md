# 描画トラックの中断メモ（2026-11-22）

akaghef の決定（2026-11-22）により、描画トラック（`viewer.ts` の分割、fps などの performance の改修）は、データ構造が固まるまで止める。このメモは、再開するときの入力である。書いたのは、表示の速さの作業をしていた session。

## 止めた地点

- 未 commit の変更は無い。作業用の worktree と branch は残っていない。入れた変更はすべて dev-beta にある。
- 着手していないもの: `viewer.ts` の node type の分岐を dispatch table に寄せる作業、Model / 導出 / View / Controller への分割、scope に入る側の trace。

## dev-beta に入っているもの

| 変更 | commit |
|---|---|
| scope だけを読む経路で、scope の移動を同じ page の中で行う | 14b4041 |
| 出た scope の entry に選択を残す | ec9e5a0 |
| camera の animation の時計を、新しい scene が描かれた後に始める | 8ca4f33 |
| scope の移動の前後で、entry を画面の同じ位置に保つ | 72cb0a6 |
| WebGL へ写す処理から、node ごと・点ごとの DOM の問い合わせを外す | fbefa80 |
| サーバーが scope を返すとき、map 全体を copy しない | eef8760 |
| 描画断片の bounding box と edge の中点を、markup から計算する（`beta/src/browser/markup_bounds.ts`） | 8682e7e |

## 確かめた原因

scope に入る・出るときの fps の低下は、camera の animation の frame と重い処理が同じ main thread を取り合うことで起きる。処理の順は、fetch、SVG の scene を組む、それを WebGL 用のデータに写す、camera の animation（300 ms）である。

- SVG の scene を組む処理（`innerHTML` の parse と style の再計算）は、647 node の scope で約 170〜250 ms の long task になる。
- WebGL へ写す処理（`buildWebGLRenderSnapshot`）は、同じ scope で約 135 ms。fbefa80 の前は 283 ms だった。
- 断片ごとの `getBBox` / `getTotalLength`（forced synchronous layout）は、8682e7e で 0 回になった。647 node の scope では、1 回の移動に約 1,300 回あった。時間の短縮は計っていない。
- サーバーの応答は、小さい scope で約 15 ms、647 node の scope で約 33 ms。後者の残りは、描画に使わない attribute 約 2.1 MB の転送である。

計測は、実データの copy を headless Chromium（software の GPU）で開いたもので、実機の GPU の値ではない。

## 確かめていない候補

- camera の zoom が変わる間、WebGL 側が frame ごとに描画内容を作り直している可能性。software の GPU では費用が見えたが、実機では確かめていない。
- scope に入る側は、WebGL が有効な状態で検証していない。出る側だけ実データで確かめた。
- SVG fallback では、WebGL が使えないと分かったときに canvas の transform を消すが、適用済みの値の記録を戻さないので、表示の transform が camera とずれる。直していない。

## 再開するときの方針の案

- 根本は、SVG の scene を一度組んでから WebGL に写す二度手間である。layout と draw input から WebGL のデータを直接作れば、上の 2 つの long task（合計で約 300〜400 ms）が scope の移動の経路から外れる。
- 分割は 4 層にする: Model（map の状態と Command、DOM に触れない）、導出（layout・draw input・bounding box の pure function）、View（SVG / WebGL、hit test）、Controller（入力を Command か表示の状態の変更に変える）。依存の向きは View → 導出 → Model の一方向とし、`dependency-cruiser` の規則で強制する。
- 表示の状態（選択、camera、畳み、今いる scope）は Model に入れず、1 つの store にまとめる。書き換えは Controller だけにする。
- 切り出す順は、導出の層から。1 つの責務を移すときは、旧い経路を同じ変更で消す。
- node type ごとの描画の宣言（読む attribute、measure と draw の pure function）は、DB 仕様書 10 節の【提案】に渡してある。

## 再開の前に知っておくこと

- text が空の node があると、fit がその node を原点 (0, 0) にあるものとして広く取る。ブラウザが空の text の行を原点に報告するためで、`markup_bounds.ts` は見た目を変えないようにこの挙動を再現している。直すと fit が変わる。
- `markup_bounds.ts` は、`viewer.css` の text の font size・weight・letter spacing を持っている。CSS を変えるときは両方を変える。
- visual test の一部は、変更の有無に関係なく失敗する: `camera_follow.spec.js:86`、`fit_cycle.spec.js:114`（svg と webgl）、`edge_graphlink_edit.spec.js` の大半、`lane_view.spec.js` の 2 件、`scope_layout_diff.spec.js` の 3 件。WebGL の test は、並列実行の負荷で 1 件ずつ入れ替わって落ちる。View と Controller を動かす前に、この網を直す必要がある。
- scope に入るとき、選択は常に root になる（入った scope で前に選んでいた node は覚えていない）。undo の履歴と畳みの状態は、同じ page の中での scope の移動をまたいで引き継がれない。
