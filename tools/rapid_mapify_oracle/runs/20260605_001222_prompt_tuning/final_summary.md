# Empirical Prompt Tuning Final Summary

## Target

M3E map-generation local delta prompt.

Final prompt file:

- `tools/rapid_mapify_oracle/prompts/local_delta_worker.md`

## Playground Scope

- source: `codex-pn-verify-5 / n_1780555544823_0_738kjz`
- clone: `codex-pn-verify-5 / n_1780618342328_pn_prompt_tuning`
- URL: `http://localhost:4173/viewer.html?ws=ws_REMH1Z5TFA7S93R3HA0XK58JNR&map=codex-pn-verify-5&scope=n_1780618342328_pn_prompt_tuning`

## Result

Converged after Iter-4.

| Iteration | Accuracy | New unclear points | Notes |
|---|---:|---:|---|
| Iter-1 | 100% | 3 | Prompt was proposed by executor; unclear teacher sufficiency, ID, order. |
| Iter-2 | 87.5% | 1 | Scenario missing concrete selectedNodeId. |
| Iter-3 | 100% | 0 | First clear. |
| Iter-4 | 100% | 0 | Second clear plus hold-out. |

## Final Prompt Properties

- append-only selected-node local delta
- no fallback dictionaries
- NEED_CONTEXT on missing teacher evidence
- short noun labels
- single semantic role per run
- duplicate filtering against existing children
- teacher order preservation
- no prompt-generated stable node IDs
