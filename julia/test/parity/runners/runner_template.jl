# parity runner template
# 使い方: このファイルをコピーし、具体的な fixture 群を `@parity` で列挙する。

include("../helpers.jl")

"""
    @parity fixture_id input_expr expected_expr [kw...]

1 fixture を 1 testset として実行するマクロ。
"""
macro parity(fixture_id, input_expr, expected_expr, kwargs...)
  quote
    @testset "parity: $($fixture_id)" begin
      local actual = $(esc(input_expr))
      local expected = $(esc(expected_expr))
      local pass = compare_numeric(actual, expected)
      if !pass
        @warn "parity failed" fixture=$fixture_id diff=diff_report(actual, expected)
      end
      @test pass
    end
  end
end

# 例 (コメントアウト状態):
# @parity "polalg/add_0001" simplify(PolAlg(...) + PolAlg(...)) PolAlg(...)
