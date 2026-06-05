# Commands run

- `npm --prefix beta run build`
- `python3 tools/rapid_mapify_oracle/scripts/evaluate_case.py tools/rapid_mapify_oracle/fixtures/cases/biology_expand_animals.case.json --candidate tools/rapid_mapify_oracle/fixtures/biology/m3e_good_delta.json`
- `POST /api/maps/BIO-RF1-ANIMALS-EXPAND-001-live` with fixture before state
- `POST /api/maps/BIO-RF1-ANIMALS-EXPAND-001-live/rapid/mapify-oracle` dryRun/apply
- `POST /api/maps/BIO-RF1-ANIMALS-EXPAND-001-live/rapid/mapify-oracle` unsupported n_fish no-fallback check
