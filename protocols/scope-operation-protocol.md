# Scope Operation Protocol

## Product reference

See `docs/03_Spec/Scope_and_Alias.md` for product meaning.

## Operating definition

Scope is a cognitive/editing boundary. It is not merely a folder, tab, file, or storage unit.

## When to create or adjust scope

Use scoping when a subtree needs a stable local world for reading, writing, review, or worker delegation.

Do not scope only because:

- the tree is visually large
- a node has many children
- the worker wants a smaller context without semantic boundary

## Granularity checks

A good scope:

- has a coherent purpose
- can be named by its role
- can be delegated safely
- avoids cross-scope writes for ordinary edits
- does not hide necessary parent context

## Alias vs move

- Move when the entity's canonical ownership changes.
- Alias when another scope needs visibility without moving ownership.
- GraphLink when the relationship is non-tree and should not affect ownership or layout.

## Worker boundary

Worker can edit inside an assigned scope. Worker must escalate for scopen/unscopen or cross-scope alias/link creation unless the handoff explicitly grants it.
