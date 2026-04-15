---
project: AlgLibMove
topic: MATLAB idiom 集約レジスタと展開方針
status: 運用規約 (初版)
date: 2026-04-15
related:
  - debt_register.md #27 #24
---

# MATLAB idiom 集約レジスタ

MATLAB → Julia 移植時に現れる idiom の扱い方針と、謎ロジック箇所の集約管理表。

## 1. 方針

- idiom 展開 = 可 (意味保存の範囲で Julia 慣用句に書き換えてよい)
- 式改変 = 不可 (magic expression は逐語移植、意味保存のため触らない)
- 謎ロジックは `# MATLAB_IDIOM:` マーカーで集約し、parity test 通過で正しさを担保する

## 2. idiom 類型テーブル

| idiom | MATLAB 例 | Julia 相当 | 方針 | 備考 |
|---|---|---|---|---|
| Colon indexing (単発) | `A(:,k)` | `A[:,k]` | 保持 (美しい) | ユーザー明示 |
| Linear indexing | `A(:)` | `vec(A)` | 保持 | |
| Logical indexing | `A(A>0)` | `A[A .> 0]` | 保持 | |
| `end` keyword | `A(end,:)` | `A[end,:]` | 保持 | Julia も `end` あり |
| `sub2ind` / `ind2sub` | `sub2ind(sz,i,j)` | `LinearIndices(sz)[i,j]` | 展開 or ヘルパ | 読解ヘルパ関数化可 |
| Broadcasting 暗黙拡張 | `A + b'` | `A .+ b'` | 展開 (Julia は明示必須) | ドット記法必須 |
| Anonymous 単段 | `@(x) x^2` | `x -> x^2` | 保持 | |
| Anonymous 多段ネスト | `cellfun(@(x) arrayfun(@(y)..., x), C)` | 明示関数に展開 | 展開 | ユーザー明示 (誤訳リスク) |
| `A(idx)=[]` 削除 | `A(idx)=[]` | `deleteat!(A, idx)` | 展開 | |
| `cellfun(@f, C)` | `cellfun(@f, C)` | `map(f, C)` | 展開 (可読性) | |
| `reshape` 多次元 | `reshape(x,[a,b,c])` | `reshape(x,(a,b,c))` + 形状コメント | 保持+コメント | |
| Magic expression | (構造的導出式、例: Hopf 公理の具体展開) | 逐語移植 | 不可 (触らない) | 意味破壊リスク |

## 3. マーカー書式

```julia
# MATLAB_IDIOM: <category> <brief>
#   original: <1行 MATLAB>
#   why_cryptic: <何が読みにくいか>
#   test_cover: <parity test id>
```

記入ルール:

- `<category>` はテーブルの idiom 類型、またはアドホックな `magic_expr`
- parity test が未整備な段階では `test_cover: TODO` で OK、#15 完成時に埋める
- マーカーは Julia 側コードに挿入し、レジスタの id (後述) と対応させる

## 4. 集約レジスタ (実コード由来、雛形)

| id | file:line | category | MATLAB 原文 | Julia 扱い | test | 担当 |
|---|---|---|---|---|---|---|
| IDIOM-0001 | (例) VectAlg.m:317 | calc_stub | `out = arrayfun(@(k) f(A(:,k)), 1:n)` | B' クラスタで明示 for ループに再設計 | TODO | TBD |
| IDIOM-0002 | (例) HopfAxiom.m:42 | magic_expr | (逐語保存、抜粋省略) | そのまま逐語移植、触らない | TODO | TBD |

初版は空表 + 上記 2 例のみ。実コード走査は別タスクで行い、id は `IDIOM-NNNN` で採番する。

## 5. 運用フロー

1. port 作業中に cryptic 箇所を見つけたら Julia 側にマーカーを挿入する
2. 本ファイルの集約レジスタ表にエントリを追記 (id を `IDIOM-NNNN` で採番)
3. parity test を debt #15 で整備する
4. test 通過したらエントリの status を `verified` に更新 (必要なら `test` 列に test id を記載)

## 6. 非ゴール

- idiom 展開の自動化スクリプト化 (Phase C 以降で検討)
- magic expression の形式化 (数学的正当性の議論は別問題、ここでは扱わない)
