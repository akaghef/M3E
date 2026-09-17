# Q1 — 色の所有権は node type か、map 全体の規約か

- status: open
- raised: 2026-09-15
- raised_by: Claude (Director)
- decided_by: akaghef
- blocks: T-1-3, T-2-1（node type カタログ）

## 何が衝突しているか

**akaghef（2026-09-15、9月会話 c37bb36e）**

> 色使いは node type ごとに決まるのであって global に意味は無いんよ
> node type が何を指してると思ってるんだ　node の解釈論は node type が決める。
> type は node shape とかで衝突しない感じでやればいい

**`.kiro/steering/color_semantics.md`（binding steering、2026-08-29 akaghef 決定）**

> 使う色（7色。これ以外を状態表現に使わない）
> **map 全体の規約であり、agent 固有ではない。** agent lifecycle state はこの規約の消費者のひとつ。
> 拘束規則1: 色数を増やさない。7色で表せない区別が要るなら、それは色ではなく文字・形・線種で表す。

どちらも akaghef の決定であり、後者は binding steering。前者の方が新しい。

## 選択肢

| ID | 案 | 帰結 |
|---|---|---|
| **OP1** | **暫定分離を正式化する。** state（状態）は7色 global 規約、塗り・形・線種は node type 所有 | `screen01.html` が既に採っている形。色は「状態の要約」という規則5と整合し、node type は state 以外の視覚属性を持てる。`color_semantics.md` に「本規約が拘束するのは *状態表現* の色であり、node type の identity 表現は拘束しない」を追記する |
| **OP2** | **node type が完全に所有する。** `color_semantics.md` の global 規約を撤廃し、type ごとに色語彙を定義する | akaghef の発言に最も忠実。ただし遠景・一覧・周辺視で「どれを見るべきか」を決める機能（規則5 / `RQ6`）が type ごとにバラバラになる。`ADR_011 DC19` も撤回が要る |
| **OP3** | **global 規約が優先。** node type は形・線種・文字でのみ区別する | `color_semantics.md` をそのまま維持。akaghef の 2026-09-15 の指摘を却下することになる |

## Director の見立て

**OP1 を推す。** 根拠は `color_semantics.md` 規則5 そのもの——

> 色は状態の要約であり、状態そのものではない。細かい状態名は文字で出す。
> 色は遠景・一覧・周辺視で「どれを見るべきか」を決めるためのもの。

この規則は**色の役割を「状態」に限定している**。node type の identity（これは task か agent か）は
状態ではないので、元々 7色規約の管轄外と読める。つまり衝突は見かけ上のもので、
**規約の適用範囲が明示されていないことが原因**。

`mocks/screen01.html` は既に OP1 で描いてある: state ring = 7色、塗り・形 = node type 所有。

## 決着の反映先（chat 上の合意で閉じない）

どの案を採っても、決着は **`.kiro/steering/color_semantics.md`** に書き戻す。
OP2 を採る場合は `ADR_011 DC19` の撤回も要る。

## akaghef の回答

<!-- ここに記入 -->
