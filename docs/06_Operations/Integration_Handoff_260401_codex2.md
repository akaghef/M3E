# Integration Handoff (codex2) - 2026-04-01

## Purpose

This note fixes the minimum merge target from `dev-beta-data` into `dev-beta` for scope normalization and scope transition model work.

## Recommended Pick Order

1. `9b70970` feat(beta-data): add scope transition viewstate and scoped queries
2. `29736f1` model: clarify scope-root query and add reparent regression test
3. `4b36a5c` docs: record scope-root query normalization follow-up

## Why This Order

1. `9b70970` introduces the base scope-transition/query behavior.
2. `29736f1` refines naming and adds regression safety over that base.
3. `4b36a5c` only updates documentation and should come last.

## Main Files Affected

- `beta/src/browser/viewer.globals.d.ts`
- `beta/src/browser/viewer.ts`
- `beta/src/node/rapid_mvp.ts`
- `beta/tests/unit/rapid_mvp.test.js`
- `docs/00_Home/Current_Status.md`
- `docs/daily/260401.md`

## Integration Commands (on dev-beta)

```powershell
git checkout dev-beta
git fetch origin
git cherry-pick 9b70970
git cherry-pick 29736f1
git cherry-pick 4b36a5c
npm --prefix beta run build
npm --prefix beta run test:ci
git push origin dev-beta
```

## Conflict Policy

1. Keep scope query semantics as subtree-root based, not persisted scope fields.
2. Keep `queryNodeIds(scopeRootId?)` and `queryNodes(scopeRootId?)` naming.
3. Keep regression test that verifies query result changes after `reparent`.

## Verification Checklist

1. Build passes: `npm --prefix beta run build`
2. Unit/CI tests pass: `npm --prefix beta run test:ci`
3. Test `reparent updates scope-root query results without any node-level scope cascade` passes.
4. No node-level persisted `scopeId` field is introduced in model code.
