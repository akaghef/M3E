# Browser-use verification contract

Browser-use is not the source of truth. It is the visible-sensor layer.

## BV1 Required checks

For each Rapid run:

```text
1. Open fixed workspace/map/scope.
2. Select target node.
3. Trigger Rapid operation via intended UI path.
4. Snapshot before/after node count and selected node label.
5. Confirm added children are visible near selected node.
6. Confirm no new map/scope was created.
7. Confirm shortcut does not fire while text input is focused.
```

## BV2 Evidence

Record:

```text
- URL
- selected node before operation
- visible labels after operation
- screenshot path if available
- AppState diff path
- browser trace path
```

## BV3 Failure rule

If browser passes but AppState diff fails, classify as `F4_UI_ONLY_SUCCESS`.
If AppState passes but browser fails, classify as `F5_MODEL_ONLY_SUCCESS`.
