---
project: AlgLibMove
date: 2026-04-15
topic: MATLAB 静的プロパティ欠如に由来する負債 — Julia 移植で解消見込み
status: findings
---

# 概要

MATLAB classdef には「型パラメータに依存する静的プロパティ」が書けない。
AlgLibMove ではこの欠如を回避するために `TypeParam` という専用クラスが導入され、
さらに `properties(Constant) = TypeParam(@factory)` という不自然なパターンが
パラメトリックな代数ファミリ全体に蔓延している。

Julia に移植する際、**パラメータは型パラメータに昇格**できるため、
これらの回避策は丸ごと消える見込み。本ドキュメントは移植前に
「何が消えるか」を具体箇所で記録する。

---

# 消える資産の一覧

## 1. `TypeParam` クラス本体 — 丸ごと削除

**場所**: `AkaghefAlgebra/Core/common/TypeParam.m`

```matlab
classdef TypeParam < handle
    properties
        dict dictionary = dictionary
        createFcn
    end
    methods
        function obj = TypeParam(createFcn)
            obj.createFcn = createFcn;
        end
        function ret = get(obj, key)
            try
                ret = obj.dict{key};
            catch
                obj.dict = obj.dict.insert(key, {obj.createFcn(key)});
                ret = obj.dict{key};
            end
        end
    end
end
```

**役割**: キー（= 型パラメータ）で factory を遅延呼び出し＋キャッシュ。
**Julia 後**: 型パラメータ化 + (必要なら) `@generated` / `Base.@assume_effects` /
メモ化辞書で代替。クラスそのものは不要。

---

## 2. `properties(Constant) = TypeParam(@...)` パターン

N や l に依存する basis を「Constant に見せかける」ための手口。
対応するインスタンスプロパティ（N, l）と常にペアで現れる。

### 2.1 CyclicGroupAlg

**場所**: `Examples/VectAlgebra/CyclicGroupAlg.m:3-14`

```matlab
properties(Constant)
    bs0 = TypeParam(@makeBase)
end
properties
    N                            % cyclic order
end
methods(Static)
    function [Z, One] = getGenerator(N)
        Z = CyclicGroupAlg();
        Z = Z.setBase(Z.bs0.get(N));
        Z.N = N;
        Z.setConst;
    end
end
```

**Julia 後（予定）**:
```julia
struct CyclicGroup{N,T} <: HopfAlgebra{T}
    core::VectAlgCore{T}
end
basis(::Type{CyclicGroup{N}}) where N =
    Bases(N, "e" .* string.(0:N-1), "Z/NZ")
```
`bs0` も `TypeParam` も `getGenerator(N)` も不要。
`CyclicGroup{3}()` が MATLAB の `getGenerator(3)` を置き換える。

### 2.2 PolCnmodalg

**場所**: `Examples/PolAlg/PolCnmodalg.m:4-19`

```matlab
properties(Constant, Hidden)
    B = TypeParam(@(l) Bases(2*l, ["x_m"+(l:-1:1) "x_"+(1:l)], "symC"+l+"modalg"))
end
properties
    l
end
methods(Static)
    function v = getGenerator(l)
        v = rowfun(@(x) PolCnmodalg(1, x), table(eye(2*l)));
        v = dictionary([-l:-1, 1:l]', v.Var1);
    end
end
```

**痛点**: `l` が次元を決めるのに Constant にできない。
`B` は `TypeParam` 経由で遅延。`getGenerator(l)` は毎回 2*l 個の生成元を再構築。

**Julia 後**: `PolCnmodalg{L,T}` で `L` を型に昇格 → `B` は型関数化。

---

## 3. `getGenerator(...)` ファクトリ関数群

ファミリ全体で共通の手口。**Julia では型コンストラクタそのもの**に吸収される。

| MATLAB | Julia |
|---|---|
| `CyclicGroupAlg.getGenerator(N)` | `CyclicGroup{N}()` |
| `PolCnmodalg.getGenerator(l)` | `PolCnmodalg{l}()` |
| `VectHeisenbergDouble.getGenerator(H1, H2)` | `HeisenbergDouble{H1,H2}()` or `HeisenbergDouble(H1, H2)` |

`getGenerator1`, `getGenerator2`（`VectHeisenbergDouble.m:27, 36`）のような
「同じ実装・引数違い」の分岐も、dispatch で整理可能。

---

## 4. 毎回ゼロから再構築される構造定数

**場所**: `Core/VectAlgebra/VectHeisenbergDouble.m:9-24`

```matlab
function Z = getGenerator(H1, H2, name)
    D = H1.dim;
    Z = VectHeisenbergDouble();
    Z.rdim = D;
    Z.cf = H1.Czeros([D^2, 1]);
    Z.H1 = H1;
    Z.H2 = H2;
    Z = Z.setBase(TensorBases([H1.bs H2.bs], name));
    Z.bs.helperHD;
    Z.setConst;   % L57-L94 の tensor 式フル実行
end
```

`(H1, H2)` が同じでも毎回 `setConst` を再実行。静的テンプレートの共有が
言語的にできない。

**Julia 後**: 型パラメータ `{H1,H2}` で特殊化。`@generated` function または
定数折り畳みで **初回のみ構築** にできる。

---

# 数量的目安（grep 結果, 2026-04-15）

`tmp/tmp_repo/AkaghefAlgebra` 配下の `.m` ファイルに対する grep で
**TypeParam 使用箇所は 22 ファイル超**に及ぶことが判明。予想以上の蔓延。

## properties 宣言レベルでの使用（静的プロパティ擬態）

### Examples/VectAlgebra/
- `CyclicGroupAlg.m:4`        `bs0 = TypeParam(@makeBase)`
- `VectFpX.m:5`               `bs0 = TypeParam(@makeBase)`
- `VectExtAlg.m:5`             `bs0 = TypeParam(@makeBase)`
- `Uqsl2BorelSmall.m:5`        `bs0 = TypeParam(@makeBase)`

### Examples/StrAlgebra/
- `StrExtAlg.m:3`              `B = TypeParam(@(N)Bases(N, "X"+(1:N), "Ext"+N))`
- `StrWeylAlg.m:3`             `B = TypeParam(@(N)Bases(2*N, ..., "weyl_"+N))`
- `StrWeylXQ.m:3`              `B = TypeParam(@(N)Bases(4*N, ..., "weyl_"+N))`
- `StrCnmodalg.m:3`            `B = TypeParam(@(l)Bases(2*l, ..., "StrC"+l+"alg"))`
- `StrAnAlg_.m:3`              `B = TypeParam(@(N)Bases(4*N, ..., "Uqsl_"+(N+1)))`
- `StrCnAlg.m:4-9`             **6 つの TypeParam**（B, CM, RVL, DeltaStorage, RepStorage, RelStorage）— 極端例
- `StrQUEAlg.m:4-9`            同上パターンがコメントアウトで残存（移行中の痕跡）
- `Core/StrAlgebra/StrEndV.m:62` `B TypeParam = TypeParam(@(N)Bases(1, "oper", "StrEndV_"+N))`

### Examples/PolAlg/
- `PolCnmodalg.m:5`            `B = TypeParam(@(l)Bases(2*l, ...))`
- `PolCnmodalg2.m:5`           同上
- `PolWeylXQ.m:3`              `B = TypeParam(@(N)Bases(3*N, ..., "weyl_"+N))`
- `PolModAlg.m:3`              `rule = TypeParam(@(x)nan)` — rule 辞書にも転用

### Execution/SLnDual/
- `FSL2Borel.m:6`              `DeltaStorage = TypeParam(@createDelta)`
- `FSL2Full.m:6`                同上
- `FSL3Borel.m:6`               同上

## メソッド内ローカル使用（キャッシュとして）

- `StrAnAlg.m:66, 102`         `RS = TypeParam(@createRep); List = TypeParam(@createDelta);`
- `StrAnAlg_.m:51, 127, 161`   同様 3 箇所
- `StrCnAlg.m:64, 131`         `RS = TypeParam(@createRep); List = TypeParam(@createDelta);`
- `StrExtAlg.m:106`            `RS = TypeParam(@createRel);`
- `StrKPAlg.m:31`              `RS = TypeParam(@createRel);`
- `StrWeylAlg.m:51`            `RS = TypeParam(@createRel);`
- `StrWeylXQ.m:84`             `RS = TypeParam(@createRel);`
- `PolCnmodalg.m:55-56, 108-109`  `MC = TypeParam(@getM); operC = TypeParam(@getOper);`
- `PolCnmodalg2.m:45-46`       同上

## サマリ

| カテゴリ | 件数 |
|---|---|
| TypeParam 本体 classdef | 1（削除対象） |
| `properties` での静的擬態使用 | 約 20 ファイル |
| メソッド内ローカルキャッシュ使用 | 約 12 箇所 |
| 最多集中ファイル | `StrCnAlg.m`（6 プロパティ）、`PolCnmodalg.m`（3 用途） |

**観察**:
- `StrCnAlg.m` の 6 TypeParam は「Uqsl 風の quantum enveloping algebra」で、
  basis / comultiplication / R-matrix / rep / rel と **構造の各パーツが全部 N 依存**。
  Julia では `StrCnAlg{N}` 単一型パラメータで全部特殊化できる → **最大の改善余地**。
- `Execution/SLnDual/` の `DeltaStorage` 3 兄弟は同じ役割で別クラス3つ。
  Julia なら `FSL{2,Borel}`, `FSL{2,Full}`, `FSL{3,Borel}` のような**2軸型パラメータ**
  に統合可能（3 classdef → 1 struct）。
- メソッド内 `TypeParam` は本来の「型パラメータ」ではなく**ただのメモ化辞書**
  として使われている。Julia では `Dict` + `get!` で素直に書ける
  （`TypeParam` クラスを介さない）。

---

# 移植時の確認ポイント

1. 移植中、新設計で `TypeParam` 相当の「パラメータで遅延生成するキャッシュ」を
   再導入したくなったら、**負債の再輸入警告**を出すこと。型パラメータで
   解けないか先に検討。
   - ⚠ **特に警戒**: TypeParam は場当たり的な hack ではなく「MATLAB の限界を
     一点に集約した統一的な回避策」として機能していた。見た目が整っている分、
     Julia 側で `AbstractTypeParam` や `ParamCache{K,V}` のような抽象として
     **再発明したくなる誘惑が強い**。これは綺麗な顔をした負債の再輸入であり、
     禁止。runtime dict lookup に落ちていたパラメータは **型パラメータに
     昇格させる**のが Julia 移植の中核的な価値。統一抽象が欲しくなったら、
     「それは型で表現できないか？」を先に問うこと。
   - 例外: メソッド内ローカルの `TypeParam`（純粋なメモ化用途, 12 箇所）は
     `Dict` + `get!` に置き換えれば済む。TypeParam 抽象そのものは不要。
2. `getGenerator` を Julia のコンストラクタに吸収する際、
   `getGenerator1` / `getGenerator2` のような variant は
   **別型 or 別 dispatch** で整理。元の番号付き命名を引きずらない。
3. 毎回再計算していた structure constants は、メモ化または型生成関数で
   「同じパラメータでは 1 回だけ」に格上げできる。性能的副産物。

---

# 参照

- [ingest_draft.md](ingest_draft.md) — facet 1 で列挙済みの対象クラス
- Explore 調査ログ（会話履歴, 2026-04-15）
