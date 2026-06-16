# sub-agent コンテキスト供給の設計課題

sub-PJ の自動運転で sub-agent に作業を委任する場合、起動時に必要な情報を持っている必要がある。
現状は agent.md（自動読み込み）に汎用ルールしかなく、PJ 固有の facet 契約や protocol 抜粋が欠落。
起動後に「ファイルを読みに行く」のが最初のアクションになり、非効率。

## 2層コンテキスト設計

| 層 | 内容 | 提供方法 | 更新頻度 |
|---|------|---------|---------|
| **静的** | facet 契約、protocol 抜粋（資源管理・エスカレーション基準）、ノードフォーマット規約、Axes/Glossary 要約 | agent.md に埋め込み or PJ固有 agent overlay | PJ 立ち上げ時 |
| **動的** | 今日のタスク、マップ現在状態、他 agent の進捗、plan.md の現フェーズ | Agent tool の prompt に注入 or Bootstrap で fetch | セッション毎 |

## 現状の agent.md に入っているもの / 入っていないもの

| 入っている | 入っていない |
|-----------|------------|
| ブランチルール、スコープ | Axes.md / Glossary.md の内容 |
| タスク発見手順 | PJ 固有の設計原則・facet 契約 |
| Work Loop | protocol の資源管理ルール |
| Communication プロトコル | 共有メモリ(MEMORY.md)の参照指示 |

## facet 契約とは

PJ ごとに「この agent はこの facet を担当する」を明示する契約。含むべき情報:
- 担当スコープ（マップ上のどの subtree）
- ノード粒度ルール（depth 何層まで、summary 必須等）
- 使用する link 種別（facet 内で許可された型）
- 完了条件（何をもって facet 完了か）
- 他 facet との境界（alias で示す、link は張らない）

## 実装方向の候補

1. **agent.md にPJ固有セクションを追記** — kickoff 時に agent.md を書き換え。シンプルだが agent.md が肥大化
2. **PJ固有 overlay ファイル** — `projects/PJ{NN}/agents/{role}.md` を作り、agent.md + overlay をマージして渡す
3. **Agent tool の prompt で動的注入** — manager が sub-agent 起動時に plan.md の該当部分を prompt に埋め込む
4. **setrole skill の拡張** — 起動直後に setrole が facet 契約を読み込む（現状に近いが自動化）

## sub-PJ protocol との接点

- protocol §2（立ち上げチェックリスト）に「facet→agent マッピング定義」を追加？
- protocol §4（役割分担）に facet 契約テンプレートを追加？
- plan.md に agent overlay 情報を含める？

*2026-04-17*
