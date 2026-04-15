# parity harness (Phase D-5 scaffold)

AlgLibMove の Julia 実装と MATLAB golden data との数値/記号一致を検証するための
テストハーネス。Phase D-5 時点では骨組みのみで、実 fixture は未登録。

## 使い方 (概要)

1. `fixtures/manifest.json` に fixture メタを追加する (MATLAB dump 側で生成予定)。
2. `runners/` 配下に runner スクリプトを作り、`@parity` マクロで fixture を列挙する。
3. `runtests_parity.jl` から runner を include して実行する。

MATLAB golden data の生成は別セッションで整備予定。

仕様: [dev-docs/projects/AlgLibMove/design/parity_framework.md](../../../dev-docs/projects/AlgLibMove/design/parity_framework.md)
