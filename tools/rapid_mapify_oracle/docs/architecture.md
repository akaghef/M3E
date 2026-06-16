# Architecture: Rapid self-improvement loop

## AR1 Mission

Build a loop where M3E Rapid generation is repeatedly compared against Mapify's Rapid-equivalent action. Mapify is the provisional teacher. The learning target is not domain truth; it is **map-native action format**.

## AR2 Control formulation

For a Rapid operation \(R\):

```text
R(T, v, u, C) -> ΔT
T' = T ⊕ ΔT
```

- `T`: current M3E tree / AppState projection
- `v`: selected node
- `u`: operation intent, e.g. `expand`, `add_examples`, `split`
- `C`: local context window
- `ΔT`: local graph delta

The measured error is:

```text
E = grade(ΔT_m3e, ΔT_mapify_teacher, rubric)
```

The next loop updates:

```text
Rapid policy / prompt / formatter / operation spec / delta guards
```

not arbitrary UI code.

## AR3 Core subsystems

| ID | Subsystem | Responsibility |
|---|---|---|
| AR3.1 | Mission Board | Selects next Rapid operation and benchmark case |
| AR3.2 | Spec Writer | Converts Mapify-like action into M3E-native RapidOpSpec |
| AR3.3 | Codex Worker | Implements the smallest M3E slice |
| AR3.4 | Delta Engine | Applies local AppState mutations |
| AR3.5 | Verifier | Checks AppState diff, browser-visible delta, and quality rubric |
| AR3.6 | Failure Classifier | Converts defects into next patch instructions |
| AR3.7 | Mapify I/O Layer | Observes/reference-probes Mapify, never canonicalizes Mapify |

## AR4 Autonomy boundary

Codex may do detailed M3E integration and error cleanup, but the outer system must constrain it:

```text
input: one Rapid operation + one benchmark + one acceptance rubric
output: patch + run manifest + grade report + failure classification
forbidden: global map rewrite, unrelated file cleanup, Mapify canonicalization, cookie extraction
```
