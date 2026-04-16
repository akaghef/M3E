# AlgLibMove 学習ルート

akaghef 用の「Julia 実装を手で触って理解する」ための勉強ノート一覧。
VSCode Julia 拡張の `##` cell ナビゲーションで 1 セルずつ回せる形式。

## 前提

- VSCode で `julia/` フォルダを開いている（`Project.toml` がアクティブ）
- Julia REPL を `Alt+J Alt+O` で起動、`] activate .` 済
- 初回のみ `using AkaghefAlgebra` でプリコンパイル待ち

## 推奨ルート

| 順 | ファイル | 所要 | ゴール |
|---|---|---|---|
| 1 | [01_hopf_tour.jl](01_hopf_tour.jl) | 30 分 | FiniteHopf の構造定数 (M, Δ, ε, S) を手で読む |
| 2 | [02_sweedler_by_hand.jl](02_sweedler_by_hand.jl) | 20 分 | Sweedler H_4 の mul/comul/antipode を紙と突き合わせる |
| 3 | [03_cga_and_taft.jl](03_cga_and_taft.jl) | 30 分 | 群環と Taft の関係 (n=2 で一致, n=3 で gap)、q-binomial |
| 4 | [04_dual_and_hd.jl](04_dual_and_hd.jl) | 40 分 | dualHopf と Heisenberg double の積・単位元 |
| 5 | [05_exercises.jl](05_exercises.jl) | 随時 | 手を動かす演習（解答は下にまとめ） |

各ノートの先頭に「このノートで分かること」「前提」「つまずきポイント」を書いている。

## セルの回し方（VSCode Julia 拡張）

- カーソルを `## ...` の下に置いて `Alt+Enter` → そのセルだけ実行
- `Shift+Enter` → 実行して次セルへ
- `Ctrl+Enter` → カレント行のみ実行

## 困ったら

- 出力が `FiniteHopf{ComplexF64}(4, …)` と巨大に出る → `show(stdout, "text/plain", H.M)` で整形
- `MethodError: no method matching …` → `using AkaghefAlgebra` が未ロードのケースが多い
- Taft(n, ω) で `ω=exp(2π*im/n)` がデフォルト値なので `TaftAlg(3)` だけで OK

## 参考

- 設計: [dev-docs/projects/AlgLibMove/design/julia_skeleton.md](../../dev-docs/projects/AlgLibMove/design/julia_skeleton.md)
- レビュー: [backlog/design_integrity_review_hopf_hd.md](../../backlog/design_integrity_review_hopf_hd.md)
- Kassel, "Quantum Groups" §III (Hopf 代数), §VIII.2 (Sweedler), §IX (Heisenberg double)
