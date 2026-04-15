"""
NumericType — 係数の数値分類 (display / parity 記録用)。

設計方針は `dev-docs/projects/AlgLibMove/design/shared_core.md` §2 参照。
scalar_type_decision Q1=D により runtime dispatch には使わず、
型 `S` からの分類関数 `numerictype(::Type{S})` のみを提供する。

Symbolics への依存はこの段階では追加しない (D-1 で Project.toml 管理)。
Symbolics.Num は fallback で `UNKNOWN` を返す (後続フェーズで拡張可)。
"""
module NumericTypes

export NumericType, numerictype,
       INT, RATIONAL, FLOAT, COMPLEX, SYMBOLIC, UNKNOWN

@enum NumericType INT RATIONAL FLOAT COMPLEX SYMBOLIC UNKNOWN

# 型関数: 型 T -> NumericType
numerictype(::Type{<:Integer})        = INT
numerictype(::Type{<:Rational})       = RATIONAL
numerictype(::Type{<:AbstractFloat})  = FLOAT
numerictype(::Type{<:Complex})        = COMPLEX
numerictype(::Type)                   = UNKNOWN

# 値経由
numerictype(x) = numerictype(typeof(x))

end # module
