# Biology benchmark scenarios

## SC1 Local expansion

Worker selects `動物` and invokes `Rapid > Expand`.  
Mapify-like teacher action adds missing classification branches such as `爬虫類`, `両生類`, `無脊椎動物`.  
M3E passes only if these are local children of `動物`, with no global map pollution.

## SC2 Add examples

Worker selects `哺乳類` and invokes `Rapid > Add examples`.  
Mapify-like teacher action adds concrete examples such as `ヒト`, `イヌ`, `クジラ`.  
M3E passes only if examples are not mixed with taxonomic classes.

## SC3 Repair messy generation

Worker compares a messy M3E delta against the Mapify teacher delta.  
The evaluator detects long labels, sibling inconsistency, duplicates, and wrong target insertion.  
Codex updates the Rapid generation policy/formatter so the next delta is more map-native.
