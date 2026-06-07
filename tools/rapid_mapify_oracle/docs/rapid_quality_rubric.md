# Rapid quality rubric

## QR1 Scoring dimensions

| ID | Dimension | Target behavior | Typical failure |
|---|---|---|---|
| MQ1 | Locality | Delta is under selected node/subtree only | Adds nodes globally or under root |
| MQ2 | Hierarchy | class -> subclass -> example structure | Flat/random list |
| MQ3 | Sibling consistency | Siblings share semantic type and granularity | `哺乳類`, `サケ`, `植物` mixed |
| MQ4 | Label quality | Short noun phrases | Long explanatory sentences |
| MQ5 | Cognitive order | General to specific; stable ordering | Random order |
| MQ6 | Non-duplication | Avoids existing siblings | Duplicates existing nodes |
| MQ7 | Delta discipline | Minimal local insertion | Whole map regeneration |
| MQ8 | Reviewability | Human can accept/reject node groups | Opaque large rewrite |
| MQ9 | Teacher proximity | Similar action pattern to Mapify | Ignores teacher trace |

## QR2 Minimum pass for RF1

```text
locality >= 0.95
label_quality >= 0.80
non_duplication >= 0.90
teacher_proximity >= 0.50
no critical failure flags
```

For early development, semantic exactness can be lower than structural discipline. A wrong but local and map-shaped delta is more useful than a semantically plausible but globally messy one.
