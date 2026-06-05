# Policy table after DEC1

Mapify action is now the provisional correct answer. Remaining policies are implementation choices, not mission ambiguities.

| ID | 方針項目 | 採用方針 | Codexへの制約 |
|---|---|---|---|
| UP1 | Mapifyの役割 | Rapid action teacher / reference trajectory | Mapifyを正本化しない |
| UP2 | 比較対象 | 操作フロー + 生成delta | UIだけの模倣にしない |
| UP3 | Rapidの単位 | 選択node/subtreeへの局所生成 | 全map再生成は禁止 |
| UP4 | 評価軸 | Mapify-like map quality | ノード数だけで合格にしない |
| UP5 | 自己改善対象 | prompt/spec/policy/formatter/delta guards | ランダムなUI改修に逃げない |
| UP6 | Mapify I/O | fixture-first, live limited | quota/auth失敗時はfixtureで継続 |
| UP7 | Outbound | AppState subtree -> Markdown outline | AppStateを直接Mapifyへ投げない |
| UP8 | Inbound | XMind export -> content.json | private APIは補助・非前提 |
| UP9 | 正本 | M3E AppState | Mapify側状態を正本にしない |
| UP10 | 自律範囲 | feature slice単位 | unrelated dirty filesを触らない |
| UP11 | 成功判定 | AppState diff + browser diff + quality score | build通過のみ不可 |
| UP12 | 失敗処理 | failure taxonomyで分類 | 盲目的再試行不可 |
| UP13 | 教師信号 | Mapify action = provisional truth | ただし特定ドメイン真理とは限らない |
| UP14 | 既存map扱い | semantic locality | 選択subtree外を汚染しない |
| UP15 | ノード文体 | 短い名詞句・同階層同粒度 | 長文自然文ノードを避ける |
| UP16 | 分類map規則 | class -> subclass -> example | 関連語を無秩序に混ぜない |
| UP17 | 回帰防止 | unit/model/browser/e2e | 手動目視だけ不可 |
| UP18 | worktree | declared files only | 他者変更をrevertしない |
