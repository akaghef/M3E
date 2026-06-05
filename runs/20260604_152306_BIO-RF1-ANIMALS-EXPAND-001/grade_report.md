# Grade report: BIO-RF1-ANIMALS-EXPAND-001

- Score: `0.2958`
- Passed: `False`

## Dimensions

| Dimension | Score |
|---|---:|
| locality | 0.0000 |
| label_quality | 0.5000 |
| sibling_consistency | 0.2500 |
| non_duplication | 1.0000 |
| teacher_proximity | 0.1667 |
| delta_discipline | 0.0000 |

## Failures

- `F10_LABEL_SENTENCE_LIKE`
- `F11_SIBLING_TYPE_MIX`
- `F2_WRONG_TARGET`
- `F3_GLOBAL_CONTAMINATION`

## Recommendations

- Propagate selectedNodeId into the delta writer and append under the selected node only.
- Rapid operations must not append to root/global map unless explicitly requested.
- Apply a map-label formatter: short noun phrases, no explanations, no sentence endings.
- Constrain a single Rapid run to one semanticRole, e.g. class OR example, not both.

## Label comparison

- Teacher: `両生類, 無脊椎動物, 爬虫類`
- Candidate: `ヒトは哺乳類です, 植物, 爬虫類, 生物とは生命を持つもの`
