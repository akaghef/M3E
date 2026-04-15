---
project: AlgLibMove
topic: MATLAB → Julia 段階移植戦略 (delegation-chain ベース)
status: 初版 (Phase B 成果物、C/D 着手前の指針)
date: 2026-04-15
supersedes_partial: debt_register.md #26
related:
  - investigations/three_system_inquiry.md
  - investigations/simplification_api_inquiry.md
  - refactor_boundary_policy.md
  - idiom_registry.md
  - decisions/scalar_type_decision.md
  - plan.md
---

本書は [debt_register.md](debt_register.md) #26 (L205 ユーザー追記「依存パス (delegation chain) から決定。独立性高いものは独立で」) を、[investigations/three_system_inquiry.md](investigations/three_system_inquiry.md) で抽出済みの依存 DAG に沿って具体化したものである。実装提案には踏み込まず、Stage 定義・並列度・gate 条件のみを示す。

## 1. 原則

- delegation chain の葉 (依存先) から順に移植する
- independent island は並列で進める
- cluster は bundle で移植する (途中で切るとテスト不能)
- 各段で behavioral parity ([debt_register.md](debt_register.md) #25) を段階的に整備する
- refactor は境界条件を越えない ([refactor_boundary_policy.md](refactor_boundary_policy.md) に従う)

## 2. 移植ステージ定義

### Stage C.0 — 前提整備 (Phase C 着手前)

- スカラー型決定 ([decisions/scalar_type_decision.md](decisions/scalar_type_decision.md) を別セッションで解決)
- Julia プロジェクト骨格作成 (`Project.toml`, module 境界)
- parity test framework 選定 (Test.jl + 外部 MATLAB golden data、[debt_register.md](debt_register.md) #25 連動)

### Stage C.1 — Shared core (independent island)

- 対象: Bases, SpaceSpec, NumericType, IAdditive, ICompare
- [investigations/three_system_inquiry.md](investigations/three_system_inquiry.md) の「Shared core」葉ノード群
- 5 クラスは相互依存がなく並列移植可能

### Stage C.2 — PolAlg island

- 対象: PolAlg 本体 + 可換多項式表現
- C.1 のみに依存、VectAlg / StrAlg 系統から独立
- 単独完結、早期成功体験向き

### Stage C.3 — SparseEx

- VectAlg cluster の基盤
- Julia `SparseArrays` + 薄い struct ラッパの採否が先行論点 ([debt_register.md](debt_register.md) #6)
- zero 判定規約の確定も本段で行う ([idiom_registry.md](idiom_registry.md) 参照)

### Stage C.4 — VectAlg cluster (bundle)

- 対象: VectAlg, VHD (HeisenbergDouble), CGA (CyclicGroupAlg), DualAlg, TensorBases, VectQuasiHopfAlg
- SparseEx composition、B' クラスタの simplify API ([investigations/simplification_api_inquiry.md](investigations/simplification_api_inquiry.md) 決定後に確定)
- 途中で切ると tensor 計算テストが組めないため bundle 扱い

### Stage C.5 — StrAlg cluster (bundle)

- 対象: StrAlg, StrEndV
- 自由代数 (cell 語) 表現、C.4 と独立に並走可能

### Stage C.6 — calcTensorExpression

- hand-rolled `@calcTE` マクロ + TensorOperations.jl バックエンド (Phase B 既存決定)
- VectAlg cluster + SparseEx 完成後に着手

### Stage C.7 — 相互変換 API (新設領域)

- MATLAB 側に存在しない領域。Julia で新規設計。
- Str ↔ Vec ↔ Pol の変換、behavioral parity テスト基盤と合体
- 設計主体は [investigations/three_system_inquiry.md](investigations/three_system_inquiry.md) Q5 で決定

### Stage D — 実装フェーズ

各 Stage C.x 完了後に該当範囲の Julia 実装に入る。C/D は Stage 単位で逐次、同一 Stage 内は並列可。

## 3. 並列度マトリクス

| Stage | 独立 island | cluster bundle | 並列度目安 |
|---|---|---|---|
| C.0 | — | — | 1 (決定事項先行) |
| C.1 | 5 クラス | — | 5 並列 |
| C.2 | PolAlg | — | 1 (島内並列) |
| C.3 | SparseEx | — | 1 |
| C.4 | — | 6 クラス bundle | bundle 内で細分並列 |
| C.5 | — | 2 クラス bundle | 2 並列 |
| C.6 | calcTE | — | 1 |
| C.7 | 変換 API | — | 1 (テスト込) |

並列度合計ピーク: C.1 の 5 並列 + C.2 並走で最大 6。実務では開発者数により 2〜3 に収束する想定。

## 4. クリティカルパス

```
C.0 → C.1 → (C.2 ∥ C.3) → C.4 → (C.5 ∥ C.6) → C.7
```

最短経路は **C.3 → C.4 → C.6** (tensor 計算が中核)。C.2 / C.5 は早期並列で食える。

## 5. gate 条件 (Stage 間の移行判定)

- **C.0 → C.1**: スカラー型決定 committed、parity test framework MVP 動作
- **C.1 → C.2 / C.3**: Shared core 全 5 クラスの Julia 側 test green
- **C.3 → C.4**: SparseEx の zero 判定と sparse 形式が確定 (B' クラスタ [debt #6](debt_register.md) 連動)
- **C.4 → C.6**: VectAlg ⊗ VectAlg tensor 計算が MATLAB と数値一致
- **C.6 → C.7**: calcTE の既存 MATLAB テストケースが Julia 側で全通過

## 6. リスクと保険

- **リスク**: VectAlg cluster (C.4) の simplify API 決定が B' クラスタ未解決で滞る
  - **保険**: simplify を trait 化して後決定可能にする ([investigations/simplification_api_inquiry.md](investigations/simplification_api_inquiry.md) Q1 に委譲)
- **リスク**: 相互変換 API (C.7) の設計主体が未定 ([investigations/three_system_inquiry.md](investigations/three_system_inquiry.md) Q5)
  - **保険**: Phase C 着手前に別セッションで決定
- **リスク**: behavioral parity ([debt #25](debt_register.md)) の golden data 生成が MATLAB ライセンスに依存
  - **保険**: C.0 の早期に CI 用の data dump スクリプトを書いて凍結

## 7. 非ゴール

- 実装コード (Phase D の範疇)
- 個別関数シグネチャ設計
- Julia バージョン選定 (別 open_problem 化候補)

## 8. 次の一手 (Phase B → C 遷移時)

1. [decisions/scalar_type_decision.md](decisions/scalar_type_decision.md) 別セッション → 決定 commit
2. [investigations/simplification_api_inquiry.md](investigations/simplification_api_inquiry.md) Q1–Q10 別セッション → 決定 commit
3. [investigations/three_system_inquiry.md](investigations/three_system_inquiry.md) の open question 5 件別セッション → 決定 commit
4. Stage C.0 着手 (Julia プロジェクト骨格 + parity test framework)
