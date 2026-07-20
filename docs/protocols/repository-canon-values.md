# Repository Canon Values

This protocol is the canonical statement of repository-level values for M3E agents.
It tells Claude Director and Codex workers how to allocate canon, source, generated artifacts, worktrees, and external tools.

## Core stance

M3E follows Akaghef's stance: **弱いから利用して強くなる**.

Do not rebuild what existing tools already own well. Use Git, Obsidian, spreadsheets, n8n, CI, artifact stores, and external runtimes as their own canon holders when they are the right tool. M3E becomes stronger by defining the missing meta-layer: typed edges, scope, contracts, layout rules, AI-shared structure, validation, and sealed boundaries.

## Canon allocation

Every durable thing must have one canonical owner.

- If Git owns byte history, M3E must not reinvent byte-level version control.
- If Obsidian owns Markdown authoring and references, M3E must not duplicate Markdown text as a second canon.
- If an external tool owns runtime records, logs, sheets, workflow executions, or provider state, M3E should reference or project it rather than mirror it as canon.
- If M3E owns a contract, scope boundary, typed relationship, layout rule, validation state, or semantic frontier, keep that as M3E canon and treat generated outputs as projections.

Avoid dual-canon. If the same concern appears in two places, decide which place is canon and make the other a projection, cache, index, export, or convenience view.

## Source-only repository policy

The Git repository should contain human-authored, public-safe, non-regenerable source assets whose canonical home is this repo.

Commit:

- product source code and tests,
- package manifests and lockfiles,
- specs, protocols, operating contracts, ADRs, and design docs,
- seed/tutorial data required for distribution when it is intentionally part of the source package,
- dated idea memos under `docs/ideas/` when they are public-safe design source.

Do not commit:

- generated build outputs, caches, coverage, test results, and dependency installs,
- runtime logs and traces,
- local editor/app state such as `.obsidian/`, `.kamui/`, `.codex/`, `.hermes/`, `.claude/settings.local.json`,
- private business materials, credentials, meeting audio/transcripts, or public-danger artifacts,
- large binaries that are not intentionally source assets.

Use `.gitignore` for local rebuildable noise. Move private/public-danger material outside the repo, usually under `$HOME/dev/M3E-private/`.

## Artifact and projection policy

Repo root is the project root. Local generated outputs may live inside ignored child directories when convenient, but shared or durable artifacts belong in a dedicated external store such as CI artifacts, GitHub Releases, an object store, an artifact registry, or a private archive.

Do not create a parent-level `artifact/` as a shadow project root. If an output can be regenerated from canon, keep the canon and ignore or publish the output through the right artifact channel.

## Worktree policy

Worktrees are not generated artifacts. They are separate working copies for isolated task branches.

Current convention:

```text
$HOME/dev/
  M3E/                 # primary checkout on dev-beta
  M3E-worktrees/       # task worktrees: one subdir per Codex task
    <task>/
  M3E-private/         # repo-external private/public-danger material
```

Never place Git worktrees inside the primary checkout. Use `scripts/ops/worktree.sh` to create/list/remove task worktrees.

## Agent behavior

Before changing repository policy, agent routing, source/artifact boundaries, or worktree layout:

1. Identify the canonical owner of the concern.
2. Prefer linking to the canonical source over duplicating rules.
3. Keep root `AGENTS.md` as a routing hub, not a dump of all rules.
4. If a change affects recurring agent behavior, update durable protocol/rule files, not only chat.
5. If a generated/local/private file appears dirty, classify it before deleting: source, projection, cache, runtime, private, or meaningful unfinished work.

When in doubt, stop and ask whether the proposal makes M3E stronger by owning the missing meta-layer, or weaker by reimplementing another tool's canon.
