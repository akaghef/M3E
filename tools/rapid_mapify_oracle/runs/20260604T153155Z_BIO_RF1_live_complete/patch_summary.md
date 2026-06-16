# Patch summary

- Removed the Rapid Mapify local fallback path from `/api/maps/:mapId/rapid/mapify-oracle`.
- Kept the experiment constrained to the fixed teacher benchmark `BIO-RF1-ANIMALS-EXPAND-001`.
- Unsupported contexts now fail explicitly with "No fallback generation is allowed for this experiment."
- Verified API path and browser PN path against the zip evaluator.

## Browser path

`select 動物 -> Space -> N2 展開 -> N3 詳細化`

## Result

- API candidate grade: 1.0 / passed
- Browser UI candidate grade: 1.0 / passed
- Added labels: 爬虫類, 両生類, 無脊椎動物
