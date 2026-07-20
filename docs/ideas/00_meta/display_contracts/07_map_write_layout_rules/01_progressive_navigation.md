# Progressive Navigation Layout

UI蒸留・UI再現 map のための layout rule。

この文書は、M3E viewer / try-app で検討している Progressive Navigation UI の指示を書き溜める場所でもある。
会話中の UI 判断はここへ集約し、map 書き込み・UI 再現・overlay 実装の副作用を抑える。

## 位置づけ

- Progressive Navigation は本体 canvas renderer ではなく、canvas 上に重なる overlay UI として扱う。
- 本体 canvas の描画ロジック、node / edge / scope のデータ構造を壊さない。
- 将来的には map 内の node / scope / action をたどるナビゲーション手段として育てる。
- 最初の対象は Miro 風の UI 項目探索と、M3E viewer の左 rail / toolbar / inspector 周辺操作である。
- 本体側の UI を優先する。overlay は canvas 操作や既存 toolbar を不必要に塞がない。

## 基本粒度

- `1 node = 1 click = 1 UI element`
- node は概念カテゴリではなく、画面上で押せる/見える UI 要素
- parent-child は分類ではなく「クリック/展開で次に出る UI」
- flyout / modal / dropdown / tab は必ず1階層深くする
- 画面上の配置順・メニュー表示順を優先する
- UI action は既存の toolbar / inspector / command 処理へ bridge する。
- 既存の描画・保存・scope 操作を Progressive Navigation から直接壊さない。

## Anchor

root直下はUIグループanchorにする。

例:

```text
🧱 ボード上部ツールバー
🧱 ユーザー上部ツールバー
🧱 左Creationツールバー
🧱 下部コントロール
```

`UIグループ anchor:` のような説明文字列は node text に入れない。

## Root / [GUI]

- Root label は `[GUI]` とする。
- `[GUI]` は別カードとして浮かせるのではなく、既存 UI 上の固定位置に置く。
- M3E viewer では、左 rail の「More mindmap tools」に相当する場所を `[GUI]` root として扱う。
- `[GUI]` root 自体が root node であり、そこから Board / View / Scatter / Mindmap / Annotation / Panel などへ分岐する。
- Root を押した場合は全て collapse する。

## 表示と展開

- Root だけが最初に見えている状態を基本にする。
- Root に hover / focus したとき、第一階層の選択肢を表示する。
- click を必須にしない。カーソルを向けるだけで下位項目を表示する。
- 第一階層へカーソルを向けると、第二階層以降の詳細設定が浮かび上がる。
- 一番下への path が、どの階層で何を選んできたか分かるようにする。
- 途中階層の選択肢は、深い階層へ進んでも急に消えない。
- 子階層を開いたときに、親や中間層の水平位置が突然動かない。
- collapse 操作をしないと出たままになる問題を避ける。Root から離れたとき、または Root を押したときに閉じられる設計にする。

## Layout

- node の breadth は開きすぎない。
- 各 depth ごとに、sibling 群の中心位置を parent の中心位置と一致させる。
- 上揃えだけで並べない。親から子へ自然にたどれる中心揃えを優先する。
- 深くしたとき、中間層の column / node 位置を固定し、hover 先の sibling 移動で全体が揺れないようにする。
- 縦一列だけの配置はナビゲートしにくい場合があるため、横方向の展開と edge で path を読みやすくする。
- 背景は無地の白を基本にする。

## Edge

- Progressive Navigation UI 内の node 間には edge を表示する。
- edge は前 UI のように、親子関係を追える位置へ正しく描画する。
- overlay 内 edge は canvas 本体の edge ではない。UI path を示す補助線である。
- edge 描画は node の実測位置に基づける。固定座標だけで描いて node とずれないようにする。
- parent center から child center へ自然につながる線を優先する。

## 状態表現

```text
#️⃣ ライングリッド radio: on
🧲 グリッドに位置合わせ toggle: off
🔒 デフォルト表示をロックする toggle: off disabled
```

## Demo / Test Data

- UI 検証用 map では、実データに見える node label をそのまま表示しない。
- 撹乱するのは label だけで、木構造は変えない。
- node を勝手に scopen しない。
- 検証用 node は全て同じ root scope 上に配置する。
- `scope root` 以外の scope 化は、ユーザーが明示的に求めた場合だけ行う。

## CUI / Touch

- CUI / keyboard 連携も考える。VS Code の `Ctrl+K` 系のように、段階的な command path をたどれる形にする。
- touch UI は別途検討する。Pinterest 風の swipe / radial action のような移動量ベースの操作は候補にする。

## 未解決・検討中

- hover のみで開く場合、誤展開と誤閉じをどう抑えるか。
- touch / pen / trackpad での swipe navigation をどう設計するか。
- command palette / keyboard path と overlay path を同じ model で扱えるか。
- map navigation と UI command navigation を同じ Progressive Navigation model に統合できるか。
