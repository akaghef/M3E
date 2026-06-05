# Codex worker protocol

## CW1 Input contract

Each run must receive:

```text
- Rapid operation ID, e.g. RF1.expandSelectedNode
- fixed benchmark case path
- selected node ID
- teacher trace or teacher delta
- quality rubric
- allowed file scope
```

## CW2 Required output

Codex must leave behind:

```text
- patch summary
- run_manifest.json
- grade_report.md
- failure_taxonomy.json update if failed
- exact commands run
- browser-visible evidence when available
```

## CW3 Forbidden actions

```text
- do not rewrite whole map for a Rapid operation
- do not create garbage verification maps and call that success
- do not treat UI-only success as functional success
- do not extract browser cookies
- do not revert unrelated dirty worktree changes
- do not silently change the benchmark fixture to pass the test
```

## CW4 Loop rule

A failed run must classify the error before coding again. Accepted classes are in `config/failure_taxonomy.json`.

## CW5 First task for Codex

```text
Implement RF1.expandSelectedNode so that selecting 動物 and invoking Rapid expansion adds map-native missing classification branches under 動物 only.

Teacher reference:
  動物 -> 爬虫類, 両生類, 無脊椎動物

Acceptance:
  - AppState diff has children appended only to selected node
  - labels are short noun phrases
  - no duplicate of 哺乳類/鳥類/魚類
  - browser view shows added children
  - no new map/scope created
```
