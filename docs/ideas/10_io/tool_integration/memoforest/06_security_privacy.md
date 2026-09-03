# セキュリティ・プライバシー

## Separate exposure surfaces

1. ブラウザlocal storage
2. 端末内暗号化解除session
3. Supabase cloud sync
4. JSON export
5. clipboard経由のexternal AI request / patch
6. M3E repo / runtimeへの投入

端末内暗号化が有効でも、JSON exportやcloud syncが同じ保護境界になるとは限らない。

## M3E boundary

- public-safeな設計・contract・表示情報のみrepoへ置く。
- 個人観測、credential、private automationはA-sys側に保持する。
- JSONは平文portable artifactとして分類する。
- external AIへ渡すscopeはfocused targetsを既定にする。
- full document送信前にclassificationを確認する。

## Rendering versus authorization

DOMPurifyとKaTeX `trust:false`は表示防御であり、access control、classification、owner policyの代替ではない。

## Preflight gate

- canonical owner
- destination
- classification
- retention / deletion route
- export digest
- rollback / recovery route
- whether external AI receives content

