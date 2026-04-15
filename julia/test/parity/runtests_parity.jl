# parity test エントリ (Phase D-5 時点ではすべて noop)
using Test

@testset "parity (scaffold)" begin
  manifest_path = joinpath(@__DIR__, "fixtures", "manifest.json")
  @test isfile(manifest_path)  # 雛形の存在確認のみ
end
