---
project: AlgLibMove
topic: Julia プロジェクト骨格と module 境界
status: 設計草案 (Phase C.0-a、実装前)
date: 2026-04-15
related:
  - migration_strategy.md
  - decisions/scalar_type_decision.md
  - investigations/three_system_inquiry.md
---

本書は Phase C.0-a の設計成果物で、Julia 側のプロジェクト骨格 (ディレクトリ配置、Project.toml の骨子、module 階層、ファイル配置規約、Stage 対応、命名規約、着手チェックリスト) を「ルールだけ」配置する。実コード (.jl 実体) は Phase D で書き、本書では **契約イメージとしての型シグネチャ例** のみ許す。open_problems で未決定の事項は `TBD_<topic>` スロットとして明示し、後続セッションで差し込み可能な構造にする。

---

## 1. プロジェクト配置

リポジトリ直下に `julia/` を新設し、Julia 関連一切をその配下に閉じる。既存の `matlab_src/` は port 元として保持 (削除しない、[refactor_boundary_policy.md](../refactor_boundary_policy.md))。

```
m3e-prj-alglibmove/
├── matlab_src/              # 既存、port 元 (凍結)
├── dev-docs/                # 既存 (本書含む)
└── julia/                   # 新設、Phase C 以降の成果物はここ
    ├── Project.toml
    ├── Manifest.toml        # git 管理 (再現性のため)
    ├── src/
    │   └── AkaghefAlgebra.jl  # top-level module entrypoint
    ├── test/
    │   └── runtests.jl
    ├── docs/                # Documenter.jl 用 (C.7 以降で整備)
    └── scripts/
        └── parity/          # MATLAB golden data dump / 比較ハーネス
```

Julia standard layout 準拠。`Project.toml` は `julia/` 直下に置き、`julia/` で `] activate .` する運用。

---

## 2. Project.toml 骨子

- **name**: `AkaghefAlgebra`
- **uuid**: (C.1 着手時に `Pkg.generate` で付与)
- **version**: `0.0.1-dev`
- **julia compat**: `1.10` 以上 (LTS 追従、正式選定は TBD_julia_version)

### 依存候補と採否理由

| パッケージ | 採否 | 理由 |
|---|---|---|
| `Symbolics` | 採用 (Q2=A) | [scalar_type_decision.md](../decisions/scalar_type_decision.md) で Symbolics.jl による記号係数を採用 |
| `SymbolicUtils` | 採用 (間接) | Symbolics の依存として入るが `simplify` hook で直接参照しうる |
| `SparseArrays` | 採用 | stdlib、SparseEx の基盤候補 (正式形は TBD_sparse_ex_design) |
| `LinearAlgebra` | 採用 | stdlib、norm/kron 等で必須 |
| `TensorOperations` | 採用 | Stage C.6 の `@calcTE` バックエンド (migration_strategy §2 C.6) |
| `StaticArrays` | 採用 | 低次元基底 (CGA, Dual) のパフォーマンス用 |
| `Test` | 採用 | stdlib、parity test framework の土台 |
| `TestItems` / `TestItemRunner` | 候補 | test 分割用、採否は C.0-b で決定 |
| `Documenter` | 後続 | C.7 以降 |
| `BenchmarkTools` | 後続 | Stage D のベンチ用、MVP では外す |
| `Reexport` | 採用 | submodule の API 集約に使う |

パラメトリック型 (Q1=D) を採るため、数値 backend は dispatch で捌く。追加の `Num` 系依存 (例: `DoubleFloats`, `Quadmath`) は TBD_bases_coeff_type で確定後に差し込む。

---

## 3. module 階層

### 3.1 ツリー

```
AkaghefAlgebra                          (top-level)
├── Core                                (Stage C.1)
│   ├── Bases                           # 基底生成・ラベル管理
│   ├── SpaceSpec                       # 空間仕様 (dim, metric, grading)
│   ├── NumericType                     # 係数型 trait
│   ├── Interfaces                      # IAdditive, ICompare (abstract + trait)
│   └── Scalars                         # promote/convert rule (型別)
├── Polynomial                          (Stage C.2、PolAlg island)
├── Sparse                              (Stage C.3、SparseEx)
├── Vector                              (Stage C.4 bundle)
│   ├── VectAlg
│   ├── VHD                             # HeisenbergDouble
│   ├── CGA                             # CyclicGroupAlg
│   ├── DualAlg
│   ├── TensorBases
│   └── VectQuasiHopfAlg
├── String                              (Stage C.5 bundle)
│   ├── StrAlg
│   └── StrEndV
├── TensorDSL                           (Stage C.6)
│   ├── CalcTE                          # @calcTE マクロ
│   └── Backend                         # TensorOperations へ dispatch
├── Conversions                         (Stage C.7、新設)
│   ├── StrToVec
│   ├── VecToPol
│   └── <TBD_three_system_integration>
└── Examples                            (横断、具体代数の置き場)
    └── CyclicGroupAlg_samples
```

### 3.2 依存方向 (graph)

```
Core ← Polynomial
Core ← Sparse ← Vector ← TensorDSL
Core ← String
(Vector ∥ String) ← Conversions
Polynomial ← Conversions
Examples → {Vector, String, Polynomial}   (downstream only)
```

逆向き依存は禁止。Core は他の一切を import しない (葉の中の葉)。

### 3.3 各 module の export と TBD スロット

| module | 主要 export (予定) | TBD スロット |
|---|---|---|
| `Core.Bases` | `AbstractBasis`, `basis_of`, `label` | TBD_bases_coeff_type |
| `Core.SpaceSpec` | `SpaceSpec`, `dim`, `grading` | — |
| `Core.NumericType` | `NumericTrait`, `is_exact`, `is_symbolic` | — |
| `Core.Interfaces` | `IAdditive`, `ICompare`, `@algcontract_additive` | — |
| `Core.Scalars` | `promote_scalar`, `convert_scalar` | TBD_scalar_backends |
| `Polynomial` | `PolAlg`, `coeffs`, `monomials` | — |
| `Sparse` | `SparseEx`, `iszero_entry`, `nnz_pattern` | **TBD_sparse_ex_design** |
| `Vector.VectAlg` | `VectAlg{S<:Number}`, `⊕`, `⊗` | TBD_simplify_api |
| `Vector.*` (others) | 各代数の型と構造定数 | TBD_simplify_api |
| `String.StrAlg` | `StrAlg`, word 表現 | — |
| `TensorDSL.CalcTE` | `@calcTE` | — |
| `Conversions` | `to_vec`, `to_str`, `to_pol` | **TBD_three_system_integration** |

### 3.4 契約イメージ (型シグネチャのみ、実装なし)

```julia
# Core/Interfaces.jl
abstract type IAdditive end
abstract type ICompare end

# Vector/VectAlg.jl (契約イメージ; 本体は Phase D)
struct VectAlg{S<:Number, B<:AbstractBasis} <: IAdditive
    space::SpaceSpec
    basis::B
    coeffs::AbstractVector{S}   # Sparse or Dense は SparseEx trait で切替
end
```

---

## 4. ファイル配置規約

- **1 型 = 1 ファイル**: `src/Vector/VectAlg.jl` に `struct VectAlg` とその直接メソッドのみ。
- **test ミラー配置**: `test/Vector/vectalg_tests.jl`。ディレクトリ構造は `src/` と完全に一致させる。
- **contracts 分離 (optional)**: `src/Vector/VectAlg_contracts.jl` に invariant / trait 実装を分離してよい。分離は module 側で `include` する。
- **top-level glue**: `src/AkaghefAlgebra.jl` は各 submodule の `include` + `Reexport` のみ。ロジックを書かない。
- **Examples**: 具体代数インスタンスは `src/Examples/` に集約し、core module から参照しない (逆依存防止)。
- **parity data**: `julia/scripts/parity/golden/*.jld2` に MATLAB dump を置く。test から相対パスで参照。

---

## 5. Stage 対応表

| Stage | 整備対象 module | gate (抜粋) |
|---|---|---|
| C.0 | プロジェクト骨格 + `Project.toml` + `runtests.jl` 空雛形 | scalar 決定 committed |
| C.1 | `Core.*` 全 5 サブモジュール | Shared core の test green |
| C.2 | `Polynomial` | C.1 完了、PolAlg 単独で test green |
| C.3 | `Sparse` | TBD_sparse_ex_design 解決 |
| C.4 | `Vector.*` bundle 6 モジュール | VectAlg⊗VectAlg 数値一致 |
| C.5 | `String.*` bundle 2 モジュール | StrAlg 基本演算 green |
| C.6 | `TensorDSL.*` | calcTE 既存 MATLAB ケース全通過 |
| C.7 | `Conversions.*` + `Examples` 拡張 | 相互変換 parity green |

各 Stage の完了条件は [migration_strategy.md](../migration_strategy.md) §5 gate と同期する。

---

## 6. 命名規約

- **型**: PascalCase (`VectAlg`, `SparseEx`, `HeisenbergDouble`)。略号 (CGA, VHD) は module 名には使うが型名は full 綴り優先。
- **関数**: snake_case (`basis_of`, `iszero_entry`, `promote_scalar`)。
- **述語関数**: 末尾 `?` は Julia 流儀に反するため不使用。代わりに `is_<adj>` / `has_<noun>` prefix。
- **内部契約マクロ**: `@algcontract_<name>` (例: `@algcontract_additive`)。`@` 付きは contracts 専用と予約する。
- **1 文字名は公開 API に出さない**: `C` (CyclicGroupAlg 省略名)、`V` (VectAlg 省略名) 等を export しない。内部の ローカル変数としてのみ許容 ([refactor_boundary_policy.md](../refactor_boundary_policy.md) 準拠)。
- **ファイル名**: module 名と一致 (`VectAlg.jl`)。複数形 vs 単数形は module 親ディレクトリ側で複数形 (`Vector/`)、個別型は単数形で統一。
- **テスト名**: `<modulename>_tests.jl` (小文字化)。

---

## 7. Stage C.1 着手チェックリスト

- [ ] `julia/` ディレクトリ作成
- [ ] `cd julia && julia --project=. -e 'using Pkg; Pkg.generate("AkaghefAlgebra")'` で骨格生成 (生成物を `julia/` 直下に移動、不要な雛形は削除)
- [ ] `Project.toml` に §2 の依存候補 (Symbolics, SparseArrays, LinearAlgebra, TensorOperations, StaticArrays, Reexport, Test) を `Pkg.add` で追加
- [ ] `Manifest.toml` を commit
- [ ] `src/AkaghefAlgebra.jl` に top-level module + 各 submodule の `include` 行 (中身は空) だけ書く
- [ ] `src/Core/` 配下に 5 つの空 `.jl` を配置 (Bases, SpaceSpec, NumericType, Interfaces, Scalars)
- [ ] `test/runtests.jl` に `@testset "AkaghefAlgebra" begin end` の骨だけ書く
- [ ] `test/Core/` 配下に対応する空 tests を配置
- [ ] `julia --project=. -e 'using Pkg; Pkg.test()'` が green (空 testset) で通ることを確認
- [ ] `julia/scripts/parity/` ディレクトリを作成、README に MATLAB dump フォーマット (TBD) の placeholder
- [ ] `.gitignore` に `julia/docs/build/` 追加
- [ ] 最初の PR は「骨格のみ、ロジック 0 行」の形で分離する

---

## 8. TBD スロット

本章は open_problems ディレクトリの未決定事項に 1:1 対応する placeholder 集。決定 commit 後に該当箇所の `TBD_*` を差し替える。

| スロット名 | 関連 open_problem | 影響範囲 (module) | 差し込み予定 Stage |
|---|---|---|---|
| `TBD_sparse_ex_design` | [open_problems/sparse_ex_design.md](../open_problems/sparse_ex_design.md) | `Sparse`, `Vector.*` | C.3 |
| `TBD_bases_coeff_type` | [open_problems/bases_coeff_type.md](../open_problems/bases_coeff_type.md) | `Core.Bases`, `Core.Scalars` | C.1 終盤 |
| `TBD_three_system_integration` | [open_problems/three_system_integration.md](../open_problems/three_system_integration.md) | `Conversions` 全体 | C.7 |
| `TBD_simplify_api` | [open_problems/simplification_api.md](../open_problems/simplification_api.md) | `Vector.*` 全般 | C.4 で trait として遅延決定 |
| `TBD_calc_te_test_suite` | [open_problems/calc_te_test_suite.md](../open_problems/calc_te_test_suite.md) | `TensorDSL.*`, `test/TensorDSL/` | C.6 |
| `TBD_example_size_hierarchy` | [open_problems/example_size_hierarchy.md](../open_problems/example_size_hierarchy.md) | `Examples` | C.4 並走 |
| `TBD_verify_separation` | [open_problems/verify_separation.md](../open_problems/verify_separation.md) | test 全般 (分離境界) | C.0-b |
| `TBD_scalar_backends` | [decisions/scalar_type_decision.md](../decisions/scalar_type_decision.md) 追補 | `Core.Scalars` | C.1 |
| `TBD_julia_version` | (未登録、migration §7) | `Project.toml` compat | C.0-b |
| `TBD_parity_framework` | [migration_strategy.md](../migration_strategy.md) §2 C.0 | `scripts/parity/`, `test/` | C.0-b |

差し込み手順: 決定が committed されたら、(a) 本書該当行を更新し、(b) 関連 module の export 表 (§3.3) と Stage 対応表 (§5) を同期する。

---

## 9. 非ゴール

- 実コード (関数本体) — Phase D。
- 個別型の field 最終決定 — 該当 Stage で確定。
- ベンチマーク戦略 — Stage D 以降。
- Documenter / CI pipeline — C.7 以降。
