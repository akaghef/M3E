# 03. Deep Canonicality — Deep を M3E 正本に固定する 7 ルール

帯域軸 Deep × {Syntax, Semantic} を M3E 側に置き続けるための運用ルール。
揮発（Flash/Rapid）は Hermes 等に委譲してよいが、Deep だけは絶対に M3E が canonical。

## D1. Promote 一方向（Flash/Rapid → Deep のみ）

Hermes / scratch / Qn にある思考は、**明示の昇格アクション** で map ノード化されない限り Deep にならない。
Hermes MEMORY.md にだけ存在する事実は **Deep ではない** と扱う。

これがないと session reset で Deep が静かに消える事故が起きる。
昇格アクションは provenance 属性を必ず付ける（"settled YYYY-MM-DD via Qn-N" 等）。

論点：
- 昇格アクションの UI（map 上のボタン / CLI コマンド / Qn settle 自動）
- 昇格時の差分通知（誰に通知するか）

## D2. Settling Gate（昇格条件）

Deep に昇格できるのは次のいずれか：

- **(a)** 2 セッション以上で参照された（=安定性）
- **(b)** axes / glossary / vision / projection 出力に触る（=構造的価値）
- **(c)** reviews/Qn で `selected=yes` が立った（=人間ゲート通過）

満たさないものは Rapid 圏に留め、age out させる。
**「全部を Deep にしない」が品質維持の核**。

論点：
- (a) のセッション境界判定（Claude Code session？1 日単位？）
- (b) の "触る" の定義（参照／編集／引用）
- (c) が最強だが、(a)(b) でも昇格を許すか厳格化するか

## D3. Mirror-but-not-source

Hermes・~/.claude/memory・他外部 store が axes / vision を持つのは **キャッシュとして可**、
ただし「source は map」を agent が知っている必要がある。

発散時は **map が勝つ**。Hermes 側 memory は session 開始時に map から pull する
read-only mirror として運用。

実装：
- mirror 各ストアに staleness timestamp
- session 開始時に diff チェック → mirror を refresh
- mirror への直接書き込みは禁止（書きたければ map に書け）

## D4. Demotion は archive、Rapid に戻さない

Deep ノードが不要になっても **scratch には戻さず archive サブツリーに移す**。

理由：過去の射影出力（v1 の科研費が node X を引用）の **provenance を切らない** ため。
一度 Deep に上がったら、**消えるか archive されるかしかない**。

実装：
- map に `archive/` トップレベル
- archive ノードは projection 対象外、検索可能
- Tier C の一部として grep / FTS で参照される

## D5. Read-path 優先順位を固定

agent が Deep 質問（"現在の vision は？"）を投げるとき、参照順を固定：

1. **map（/api/maps 経由）** ← canonical
2. **~/.claude/memory** — 運用・feedback のみ
3. **Hermes MEMORY** — 個人文脈・口調のみ

この順を `canvas-protocol` / `CLAUDE.md` に明記。
**Deep 質問の答えは map にしかない** を agent 側に強制。

論点：
- agent が短絡（mirror 参照のみ）したときの検出
- map が落ちている時の degrade 戦略

## D6. Write-path は Qn settling を必ず通す

Deep ゾーンへの新規 / 変更書き込みは **agent 直書きを禁止**。

経路を固定：
```
scratch / 付箋 → Qn 起票 → 人間 selected=yes → Deep 昇格
                                              （provenance: "settled YYYY-MM-DD via Qn-N"）
```

これで Deep の信頼性が **「人間が一度認めた」に裏打ち** される。

例外：
- typo 修正等の cosmetic edit は人間 explicit authorization で skip 可
- ただし cosmetic 判定は agent 側でせず、人間が flag する

## D7. Privacy 境界 = Deep 境界

client-side encryption の対象を **Deep ゾーンに機械的に一致** させる。

理由：
- Deep だけが射影出力の素材＝価値が高く漏洩リスク大
- Flash/Rapid は Hermes gateway 経由で平文で入ってくるので、そもそも暗号化は無理
- 境界が map structure 由来なので「どこまで暗号化？」の判断が不要になる

実装：
- map の Deep ゾーン（昇格済みノード）に encrypted 属性
- 暗号化対象 = projection 対象 = Hermes 不可視 = backup 暗号化対象
- 一つのフラグで複数のセキュリティ要件が連動

→ `privacy_security/05_vault_separation.md` と協調設計。

## 既存仕組みとの差分

| ルール | 現状 | 必要な追加 |
|---|---|---|
| D1 Promote 一方向 | 慣習レベル | 明示昇格アクション、provenance 属性 |
| D2 Settling Gate | 暗黙 | 条件文書化、判定ロジック |
| D3 Mirror-not-source | Hermes 連携これから | mirror staleness 機構 |
| D4 Demotion to archive | scratch 整理に archive あり | Deep にも適用、provenance 維持 |
| D5 Read-path priority | 文書化されてない | canvas-protocol / CLAUDE.md に追記 |
| D6 Qn settling | reviews/Qn 仕組みあり | Deep 書込ゲート機能化 |
| D7 Privacy=Deep | privacy policy はあるが境界曖昧 | encrypted 属性と Deep 属性を結合 |

## 着手優先度

最小コストで効くのは **D5 と D2 の文書化**：

1. **D5 read-path priority を canvas-protocol に追記**
   実装ゼロ。agent が Deep 質問を map に投げるようになる
2. **D2 Settling Gate 条件を Qn 運用ルールに追記**
   実装ゼロ。Qn の semantics が "Deep 昇格ゲート" に統一される
3. D3 / D6 は Hermes 統合・hook 整備が必要、second wave
4. D7 は privacy 仕様改訂、third wave

## 代替案

**alt D2-loose**：Settling Gate を撤廃、agent 自由に Deep 化
- pro：書きやすい
- con：Deep が腐る、projection ノイズ増

**alt D6-trust-agent**：Qn settling を agent self-approve で済ませる
- pro：人間ボトルネックなし
- con：D2 (c) 人間ゲートが死に、信頼性が agent の質に依存

→ 厳格運用推し。柔軟化は信頼蓄積後に検討。

## 観察

- 7 ルールの根底は "**Deep は静的で良い**" — 動的にしようとすると整合保証が崩壊する
- Hermes に学んだのは "予算と境界" であって、"内容の管理方法" ではない
- 人間 gate（D6）を残すことが、AI 時代の memory 信頼性の最後の砦
