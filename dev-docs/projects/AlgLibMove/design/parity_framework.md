---
project: AlgLibMove
topic: behavioral parity test framework 設計
status: 設計草案 (Phase C.0-b、実装前)
date: 2026-04-15
related:
  - migration_strategy.md
  - debt_register.md #15 #25
  - open_problems/calc_te_test_suite.md
  - idiom_registry.md
---

# behavioral parity test framework 設計

本書は Phase C.0-b の設計草案である。実コードは書かず、アーキテクチャ・フォーマット・運用
規約のみを固める。実装着手は scalar_type_decision.md と simplification_api_inquiry.md の
決定 commit 後 (migration_strategy.md §8 の「次の一手」2, 3 完了後) とする。

## 1. 目的

- Julia 側実装が MATLAB 側と**数値 (および記号構造) で一致する**ことを継続的に検証する
- migration_strategy.md §5 の Stage gate (「MATLAB と数値一致」) の客観根拠にする
- idiom_registry.md の `MATLAB_IDIOM` マーカー付きコード (特に `magic_expr` 類) の意味保存を
  parity test で担保する (debt_register.md #27 連動)
- debt #15 (テスト欠如) と #25 (behavioral parity) の同時解消ルートを提供する

非ゴールは §10 を参照。

## 2. アーキテクチャ

二段構成: (a) MATLAB 側 golden data 生成、(b) Julia 側 harness による突合。

- **MATLAB 側 golden dumper** (`matlab_src/parity/generate_golden.m`)
  - 各 classdef / メソッド / 入力パターンに対して期待出力を `.json` (スカラー・小配列・記号) または
    `.mat` (大配列・疎行列) に書き出す
  - 生成 metadata (MATLAB version、`ver` 出力の該当行、timestamp、git SHA) を同梱
- **Julia 側 harness** (`julia/test/parity/`)
  - 同じ入力 (manifest から復元) で Julia 実装を走らせ、golden data と比較
  - 比較は `isapprox` (`rtol`, `atol` パラメータ化)、記号式は Symbolics.jl の `simplify` 後に
    構造一致判定 (§9 参照)
- **CI 統合**: Julia 側 `Pkg.test()` から parity テストを呼ぶ。MATLAB は CI 実行時には不要
  (fixture を commit/LFS で配布する前提、§4, §8 参照)。

原則: Julia 側は「MATLAB を再度呼び出して比較する」方式を取らない。CI が MATLAB ライセンスに
依存すると脆弱になる (migration_strategy.md §6 リスク対策)。

## 3. ディレクトリ構造

```
julia/test/parity/
├── fixtures/                 # golden data (§4 参照、LFS 採否は §8 で決定)
│   ├── vectalg/
│   ├── stralg/
│   ├── polalg/
│   ├── sparseex/
│   ├── calcte/               # open_problems/calc_te_test_suite.md 連動
│   └── manifest.json         # 入力 → 期待出力のメタ情報 (単一ルート)
├── runners/                  # Julia 側 parity 駆動
│   ├── runner_vectalg.jl
│   ├── runner_stralg.jl
│   ├── runner_polalg.jl
│   ├── runner_sparseex.jl
│   └── runner_calcte.jl
├── helpers.jl                # isapprox wrapper、記号比較、正規化
└── parity.jl                 # エントリポイント (include all runners)

matlab_src/parity/
├── generate_golden.m         # 全体エントリ
├── cases/                    # クラスごとの生成ロジック
│   ├── gen_vectalg.m
│   ├── gen_stralg.m
│   ├── gen_polalg.m
│   ├── gen_sparseex.m
│   └── gen_calcte.m
└── serialize/                # 共通シリアライザ (JSON, MAT, 記号)
```

manifest.json を単一ルートにすることで、fixture ファイルのパスは manifest 経由でのみ参照する
(Julia runner 側で path を hard-code しない)。

## 4. golden data フォーマット

### 4.1 manifest entry (JSON 配列の要素)

```json
{
  "fixture_id": "vectalg_0042",
  "class": "VectAlg",
  "method": "mtimes",
  "inputs": {
    "self": { "kind": "VectAlg_ref", "ref": "vectalg_0042.inputs.self.mat" },
    "other": { "kind": "VectAlg_ref", "ref": "vectalg_0042.inputs.other.mat" }
  },
  "expected": {
    "kind": "VectAlg",
    "ref": "vectalg_0042.expected.mat"
  },
  "metadata": {
    "matlab_version": "R2024a",
    "generated_at": "2026-04-15T10:00:00Z",
    "git_sha": "d87d579",
    "rtol": 1e-10,
    "atol": 1e-12,
    "tags": ["MATLAB_IDIOM:IDIOM-0001"]
  }
}
```

### 4.2 値の kind

| kind | 用途 | 格納形式 |
|---|---|---|
| `scalar_num` | 数値スカラー | JSON (inline) |
| `array_dense` | 稠密配列 | `.mat` (double) |
| `array_sparse` | 疎行列 | `.mat` (sparse) |
| `string` | 文字列 | JSON (inline) |
| `enum` | Bases などの列挙子 | JSON (文字列キー) |
| `symbolic` | 記号式 | JSON (`char(sym(...))` で stringify、Julia 側で `Symbolics.parse` 復元) |
| `VectAlg` / `StrAlg` / `PolAlg` / `SparseEx` | composite | `.mat` (struct 保存) + kind ラベル |
| `null` | 空出力 | JSON `null` |

### 4.3 タグとカテゴリ

- `metadata.tags` に `MATLAB_IDIOM:IDIOM-NNNN` を記録すると idiom_registry.md の test 列と連動
- `metadata.stage` (例: `C.4`) を付与すると Stage gate の集計に使える (§7)

## 5. MATLAB 側 dump スクリプトの仕様

### 5.1 シグネチャイメージ

```matlab
% matlab_src/parity/generate_golden.m
function generate_golden(outDir, varargin)
%   generate_golden('julia/test/parity/fixtures')
%   generate_golden(outDir, 'only', {'VectAlg','SparseEx'})
%   generate_golden(outDir, 'seed', 20260415)
```

### 5.2 各 cases ファイルの責務

- 対象 classdef に対する**入力パターン配列**を返す (`cases = {struct('method',...,'inputs',...)}`)
- 各 case について:
  1. MATLAB 側を実行して出力取得
  2. 出力を `.mat` / JSON にシリアライズ
  3. manifest entry を append
- seed 固定 (`rng(seed)`)、ランダム入力は seed + case index から派生

### 5.3 metadata 必須項目

- `matlab_version` (debt #14: バージョン依存の記録義務)
- `generated_at`, `git_sha`
- `rtol`, `atol` (case 単位で上書き可能、既定は `1e-10 / 1e-12`)
- `tags` (optional)
- `tolerance_rationale` (緩和した場合のみ、自由記述)

## 6. テストランナー規約

### 6.1 マクロ / 関数シグネチャ

```julia
# julia/test/parity/helpers.jl
@parity "vectalg/vectalg_0042" begin
    # 内部で manifest から inputs/expected を復元し、
    # 対応する Julia メソッドを呼び、helpers の比較関数で assert
end
```

- 1 fixture = 1 `@testset`、`fixture_id` を testset 名にする
- `@parity` マクロは manifest lookup + 復元 + Julia 呼び出し + 比較を隠蔽
- runner は `@parity` を列挙するだけ (runner コードは manifest に従属)

### 6.2 失敗時 diff 表示

- **数値**: 最大絶対誤差、最大相対誤差、最初に外れた index、shape mismatch の場合は両 shape
- **記号**: `simplify(lhs - rhs)` が 0 にならない場合、両辺を `sprint` で表示し、
  `Symbolics.expand` 後の項単位 diff を出す
- **composite (VectAlg など)**: field 単位の first-failure を表示 (`:key` で mismatch など)

### 6.3 tolerance の決定順

1. `metadata.rtol` / `metadata.atol` が manifest にあればそれ
2. なければクラス既定 (`helpers.jl` 内の `DEFAULT_TOL[:VectAlg] = (1e-10, 1e-12)` など)
3. どちらもなければ大域既定 (`1e-10 / 1e-12`)

## 7. Stage gate との連動

migration_strategy.md §5 の gate 条件を parity test で具体化する。

| Stage | gate 条件 | parity 対応 |
|---|---|---|
| C.0 → C.1 | framework MVP 動作 | `runner_vectalg.jl` で 1 fixture green |
| C.1 → C.2/C.3 | Shared core 全 5 クラス green | `fixtures/{bases,spacespec,numerictype,...}/*` 全 pass |
| C.3 → C.4 | SparseEx 数値一致 | `fixtures/sparseex/*` 全 pass |
| C.4 → C.6 | VectAlg ⊗ VectAlg 数値一致 | `fixtures/vectalg/*` 全 pass (tensor tag 優先) |
| C.6 → C.7 | calcTE 既存ケース全通過 | `fixtures/calcte/*` 全 pass (§11 TBD) |

MATLAB_IDIOM マーカー付きコードは、該当 `metadata.tags` を持つ fixture が 1 件以上 green な
ことを idiom 検証条件とする (idiom_registry.md §5 の「test 通過したら verified」)。

## 8. 運用規約

### 8.1 fixture 追加手順

1. MATLAB 側 `matlab_src/parity/cases/gen_<class>.m` に case を追加
2. `generate_golden('julia/test/parity/fixtures')` を実行 → manifest 更新 + fixture 生成
3. Julia 側 runner に `@parity "..."` 行を追加 (boilerplate のみ)
4. commit (fixture + manifest + runner の 3 点セット)

### 8.2 fixture バージョン管理

- **小サイズ** (< 100 KB 目安): git に直接 commit
- **大サイズ / 疎行列**: Git LFS 候補 (C.0-c の別決定、本書では未確定)
- `manifest.metadata.git_sha` を MATLAB 側のコミット SHA と照合できるように記録
- MATLAB 側コード変更 (semantics を変えない bugfix 等) 時は**全 fixture 再生成**を原則とし、
  diff が出た fixture を個別にレビューする

### 8.3 fixture が golden を外れた場合のトリアージ

| 兆候 | 一次仮説 | 検証手段 |
|---|---|---|
| Julia 実装変更直後に失敗 | 実装バグ | 直前の commit を revert して再走 |
| MATLAB 側変更直後に失敗 | golden バグ | MATLAB 側差分レビュー、必要なら fixture 再生成 |
| どちらも無関係に失敗 | 許容差異 (丸め etc.) | `rtol/atol` 緩和の是非を PR で議論、緩和時は `tolerance_rationale` 記載 |
| 非決定性 | 順序依存 | §9.1 の正規化を runner 側で適用 |

緩和は**個別 fixture 単位**で行い、大域既定は安易に触らない。

## 9. 特殊ケース

### 9.1 非決定的出力 (ハッシュ順、Map 反復、疎行列の nnz 順)

- Julia 側 runner で正規化 (sort by key、canonical index) してから比較
- 正規化関数は `helpers.jl` にクラスごとに用意 (`canonicalize(::VectAlg)`, `canonicalize(::SparseEx)` 等)
- MATLAB 側も同じ正規化を dump 前に適用し、fixture 自体を正規形で保存する (二重保険)

### 9.2 記号式

- MATLAB `sym` → `char(sym(...))` で stringify して JSON に格納
- Julia 側で `Symbolics.parse_expr_from_string` で復元
- 比較は `iszero(simplify(expand(a - b)))` を既定、失敗時は `isequal(simplify(a), simplify(b))` で
  構造一致をフォールバック判定
- simplify API の正式形は simplification_api_inquiry.md Q1 決定後に固定

### 9.3 浮動小数の累積誤差

- Kahan 和 / pairwise 和 の採用有無があれば `metadata.accumulation = "kahan"` 等を記録
- 累積オーダー (要素数 N) に応じて `atol = atol_base * sqrt(N) * eps()` 的なスケールを許容
- スケールは fixture 単位で `atol` を上書きして明示する (大域で自動スケールしない)

### 9.4 ランダム入力

- MATLAB 側 `rng(seed)` で seed 固定、seed は `metadata.seed` に記録
- 同じ seed から MATLAB / Julia で独立に乱数を振って比較するのは**禁止** (実装依存)。
  MATLAB で生成した入力配列を fixture に保存し、Julia はそれを読むだけにする。

## 10. 非ゴール

- MATLAB 側の parity (Julia → MATLAB の逆方向検証) は扱わない
- 性能ベンチマークは本 framework と分離する (Phase D 以降、別 framework)
- 汎用 MATLAB ↔ Julia シリアライザの設計 (本書は AlgLibMove 専用で十分)
- 継続的な MATLAB CI 実行 (fixture は commit/LFS で配布、CI に MATLAB を要求しない)

## 11. TBD スロット

- **T1. calcTE 用 expression DSL 比較**: open_problems/calc_te_test_suite.md Q1-Q5 決定後に
  `runner_calcte.jl` 規約を追記。特に Q4 (JSONL vs TOML) の選定が manifest スキーマに影響する
  可能性あり (現状 §4 は JSON 前提)。
- **T2. 大サイズ fixture の配布方式**: §8.2 の Git LFS 採否。Phase C.0-c の別決定に委譲。
- **T3. 記号比較の最終 API**: §9.2 の simplify 呼び出しは simplification_api_inquiry.md Q1
  決定待ち。

TBD 件数: 3。
