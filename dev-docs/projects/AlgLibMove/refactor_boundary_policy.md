---
project: AlgLibMove
topic: MATLAB → Julia 移植中の refactor 境界線ポリシー
status: 運用規約 (初版)
date: 2026-04-15
related:
  - debt_register.md #24 #27 #25
  - idiom_registry.md
  - decisions/scalar_type_decision.md
---

# Refactor 境界線ポリシー

MATLAB → Julia 移植における「どこまで書き換えてよいか」の運用規約。
debt_register #24 (refactor 境界線)、#27 (idiom 可読性)、#25 (parity test) を前提とする。

## 1. 前提

- 本プロジェクトは **LLM 翻訳を挟む**。人間翻訳ではない。
- cryptic な MATLAB idiom (匿名関数ネスト、インデックスによる削除、静的プロパティの擬似利用等) は **LLM の誤訳リスクを増幅する**。
- 従来の「1:1 忠実移植」原則は人間翻訳前提の安全策。LLM 翻訳では **翻訳前の可読性改善が安全性向上策として正当化される**。
- 最終担保は **behavioral parity test (#25)**。意味が保存されているか否かは test で判定する。
- 本ポリシーの目的は「LLM が事故を起こしにくい形に前処理する」ことと「事故を起こしやすい領域に立ち入らない」ことの両立。

コア原則: **idiom 展開 = 可、式改変 = 不可**。

## 2. 3 分類ルール

### 2.1 やってよい (idiom 展開 / 構造的改善)

言語機能差分の吸収および可読性向上。意味保存が容易で、LLM 翻訳の安全性を高める。

- MATLAB の言語制約回避ワークアラウンドの削除
  - 例: `InferiorClasses=` ディレクティブ、TypeParam 静的プロパティ経由の型パラメータ偽装
  - Julia では `const`、型パラメータ、多重ディスパッチで自然に表現可能
- cryptic idiom の明示展開
  - 例: `A(idx)=[]` による要素削除 → `deleteat!(A, idx)`
  - 例: 多段ネスト匿名関数 → 名前付き関数に抽出
- 命名の番号付けブレの統合
  - 例: `getGenerator1` / `getGenerator2` → 多重ディスパッチによる `getGenerator`
- `Dependent` プロパティの関数化
  - Julia ではプロパティ getter ではなく通常の関数として表現
- test / verify メソッドの分離
  - クラス内の test メソッドは `Test.jl` を使った別モジュールへ
- Examples / Core 境界の整理
  - Example 用補助コードが Core に紛れている箇所を分離

**理由**: いずれも「言語機能差分の吸収」か「cryptic idiom の明示化」。意味は 1:1 に保てる。

### 2.2 やってはいけない (式改変 / 意味破壊リスク)

数学的正当性が **逐語性そのものに依存する** 箇所。LLM でも人間でも「正しそうに見えて実は違う」を踏みやすい。

- magic expression の改変
  - Hopf 公理の具体展開、構造定数の導出式
  - `calcTensorExpression` の DSL 解釈ロジック
  - associator / coassociator の行列表現
- 代数的恒等式による書き換え
  - 例: S(ab) = S(b)S(a) による左辺右辺差し替え
  - 恒等式は「等しい」と保証されているが、実装上の計算経路が変わると浮動小数や simplify の副作用で結果が変わる
- simplify の呼び出し順序の「最適化」
  - CAS 系の simplify は非可換・非冪等なケースがある
- 乗法の結合律を活用した括弧付け替え
  - 浮動小数では `(a*b)*c ≠ a*(b*c)` になり得る
- parity test の意図解釈による reduce
  - test は振る舞い仕様そのもの。LLM が「冗長」と判断して畳むと仕様が縮退する

**理由**: これらの領域は「意味 = 字面」と考える。疑わしきは原文保存。

### 2.3 判断保留 (case-by-case、レビュー必須)

現時点で判定不能。論点を open_problems/ or investigations/ に分離し、別セッションで決定する。

- 3 系統並立 (StrAlg / VectAlg / PolAlg) の統合
  - → investigations/three_system_inquiry.md 調査結果次第
- SparseEx 継承 vs 委譲
  - → 同上
- スカラー型設計 (`Num` 抽象型の扱い)
  - → decisions/scalar_type_decision.md
- `calc` / `C` 命名統合
  - → B' クラスタ深掘り結果次第

**判断プロセス**:

1. 改変候補を認識したら open_problems/ or investigations/ に論点を切り出す
2. 別セッションで調査・決定
3. 決定事項を本ポリシー (2.1 または 2.2) に昇格させて反映

## 3. 判例集

### 判例 A (やってよい)

**事例**: TypeParam 静的プロパティワークアラウンドの削除。

MATLAB では型パラメータを擬似的に扱うため `TypeParam` クラスの静的プロパティを利用していた。
Julia では `const N = 3` や型パラメータ `{N}` で自然に表現できる。

**判定根拠**: 言語機能差分の吸収。意味は 1:1 に保たれる。

### 判例 B (やってはいけない)

**事例**: VectQuasiHopf の associator Φ 具体行列を「対称性で半分に圧縮」する。

associator は定義から対称性を持つように見えるが、実装上の格納形式と数値の順序が
downstream の simplify / pattern match に影響する。「半分に圧縮して展開し直す」は
等価に見えて等価でない。

**判定根拠**: 数学的意味が逐語性に依存。原文保存。

### 判例 C (判断保留)

**事例**: `calcTensorExpression('C{5,1,7}...')` の文字列 DSL を `@tensor` マクロに置換。

意味上は等価となるはずだが、DSL の文法と展開規則が変わるため副作用が読みにくい。
parity test が整備されれば「やってよい」に昇格可能。

**昇格条件**: 該当 DSL に対する parity test が green になること。

## 4. 運用フロー

1. 改変候補に遭遇 → 3 分類のどれかを判定。
2. 「やってよい」→ 実施。commit メッセージは `refactor:` プレフィックス。
3. 「やってはいけない」→ 原文を保持。該当箇所に idiom_registry.md へのマーカーを追加 (#27)。
4. 「判断保留」→ open_problems/ or investigations/ に論点切り出し、本ポリシーの更新候補として予約。

## 5. FAQ

**Q**: 明らかにバグっぽい MATLAB コードを見つけた場合は？
**A**: バグ修正も式改変なので原則「やってはいけない」。修正候補を port_log に記録、
元コードは逐語移植、parity test で両挙動を比較して意思決定する。

**Q**: コメントに `% TODO` / `% Fix me` が残存している場合は？
**A**: コメント自体は保持。Julia 側にも `# TODO` として残す (判断材料の保存)。

**Q**: 未使用メソッドが見つかった場合は？
**A**: 削除可 (「やってよい」)。ただし callers を grep で全件確認してから。

**Q**: 「やってよい」の refactor を LLM が勝手に踏み込みすぎるのが怖い。
**A**: refactor 系 commit は `refactor:` プレフィックスで分離し、機能変更 commit
とは別に積む。parity test が green の状態を壊さない限り受け入れる。

## 6. 本ポリシーの更新手順

- 判断保留項目が解消したら 2.1 / 2.2 のどちらかに昇格させて記録。
- 更新時は frontmatter の `date:` を追記、末尾に変更履歴を残す。

## 変更履歴

- 2026-04-15: 初版。debt_register #24 を運用規約として文書化。
