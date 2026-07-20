# Arbor と MDD の接点: Experimental Search Tree

作成日: 2026-07-02

## Why

RUC-NLPIR/Arbor は、自律研究 agent を「仮説木、実験 worktree、評価 gate、知見伝播」で回す設計を取っている。これは M3E の MDD (Map Driven Development) とかなり近いが、対象範囲が違う。

MDD は Authoring Map を system 設計、契約、実行観測の中心に置く。Arbor はそのうち、評価可能な改善ループだけを Idea Tree として切り出している。

## Idea

Arbor の Idea Tree は、MDD 全体の正本 map ではなく、MDD runtime の一部として持つ **Experimental Search Tree** として扱うのが自然。

対応関係:

- Arbor `Idea Tree` = 実験探索専用の spine
- Arbor `Coordinator` = map / tree を読んで次の探索を決める Director
- Arbor `Executor` = bounded Codex worker
- Arbor `eval_cmd` + dev/test gate = 実行契約と検証 gate
- Arbor `backpropagated insight` = 観測結果の map writeback
- Arbor git worktree isolation = M3E task worktree ルールと同型

この見方では、M3E の Deep / Authoring Map が上位正本で、Arbor 型 tree は評価可能な改善タスクに対する projection になる。chat log ではなく構造化 tree を正本にする点が、MDD の「会話ではなく Authoring Map / Contract Tree が正本」という思想と接続する。

## Boundary

Arbor をそのまま M3E に導入するのは危ない。stock Arbor runtime は temp worktree、branch checkout、merge tool、provider/API 設定を前提にする。M3E では `dev-beta`、`codex/<task>`、PR review、final 非接触の運用境界があるため、Arbor の merge runtime ではなく、Idea Tree と guarded experiment loop の概念だけを adapter 経由で使うべき。

また Arbor の tree は M3E の semantic graph や facet の代替ではない。表現力は tree に寄っており、実験探索の履歴・知見・候補管理に向く。

## Open Questions

- Experimental Search Tree を M3E の `map` 上に node / edge として持つか、外部 artifact として持って projection するか。
- Arbor 型の `eval_cmd` / `eval_cmd_test` を M3E の GraphSpec / Contract にどう対応させるか。
- `backpropagated insight` は Authoring Map のどこへ writeback するべきか。Runtime Board / Trace Store / reviews/Qn の境界を汚さない設計が必要。
- M3E の Codex worker protocol に、仮説 node ID、worktree、評価結果、PR の対応をどう保存するか。

## Next Action

Arbor を install する前に、M3E 側で「Experimental Search Tree adapter」の設計メモを作る。最初の対象は layout 性能、hit-test、保存/復元 regression など、評価コマンドと dev/test split を定義できる領域に限定する。

## Related

- `V5`: Map-Driven Development を成立させる
- `S2`: Team Collaboration
- `S3`: 保存・同期・復元の信頼性
- `S13`: 外部インフラやプロバイダに依存しすぎない経路を維持する
