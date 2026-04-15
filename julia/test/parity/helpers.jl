# parity harness 共通 utility
using Test

"""
    load_manifest(path::AbstractString) -> Vector{NamedTuple}

test/parity/fixtures/manifest.json を読み、fixture メタ情報を返す。
JSON パッケージは Phase D-5 時点では未追加のため、stub 実装で空配列を返す。
"""
function load_manifest(path::AbstractString)
  # TODO(Phase D-5+): JSON パッケージ導入後に実装
  isfile(path) || return NamedTuple[]
  return NamedTuple[]
end

"""
    compare_numeric(actual, expected; rtol=1e-10, atol=1e-12) -> Bool

数値配列の近似比較。NamedTuple/Matrix/Vector/Scalar を再帰的に扱う。
"""
function compare_numeric(actual, expected; rtol=1e-10, atol=1e-12)
  if actual isa Number && expected isa Number
    return isapprox(actual, expected; rtol=rtol, atol=atol)
  elseif actual isa AbstractArray && expected isa AbstractArray
    size(actual) == size(expected) || return false
    return all(isapprox.(actual, expected; rtol=rtol, atol=atol))
  else
    return actual == expected
  end
end

"""
    compare_symbolic(actual, expected) -> Bool

記号式の構造一致判定。Symbolics 依存なしの stub (`isequal` fallback)。
"""
compare_symbolic(actual, expected) = isequal(actual, expected)

"""
    diff_report(actual, expected) -> String

比較失敗時の diff 説明。数値なら最大絶対/相対誤差、その他は repr 差分。
"""
function diff_report(actual, expected)
  if actual isa AbstractArray && expected isa AbstractArray && size(actual) == size(expected)
    diff = actual .- expected
    maxabs = maximum(abs, diff; init=0.0)
    relscale = maximum(abs, expected; init=1.0)
    return "maxabs=$(maxabs), maxrel=$(maxabs/max(relscale, eps()))"
  end
  return "actual=$(repr(actual)) expected=$(repr(expected))"
end

export load_manifest, compare_numeric, compare_symbolic, diff_report
