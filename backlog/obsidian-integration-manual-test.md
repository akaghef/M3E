# Obsidian Vault Integration — Status & Manual Test Workflow

*2026-04-14 — for codex assignment*

## 1. Current status

| Phase | Spec | Code | Merged | PR |
|---|---|---|---|---|
| P1 Import one-shot (no AI) | ✅ | ✅ on `dev-data` (8059c31) | ❌ | none |
| P2 Import + AI Transform  | ✅ | ⚠ partial (wikilink/frontmatter in importer; AI re-use unclear) | ❌ | none |
| P3 Export one-shot         | ✅ | ✅ on `dev-data` (fac4522) | ❌ | none |
| P4 Watch (fs.watch)        | ✅ | ✅ on `dev-data` (fac4522 backend + f917c28 toolbar UI) | ❌ | none |
| P5 Conflict UI + large-vault perf | ✅ | ❌ | ❌ | none |

**Files on `dev-data`** (not yet on `dev-beta`):
- `beta/src/node/vault_importer.ts`
- `beta/src/node/vault_exporter.ts`
- `beta/src/node/vault_watch.ts`
- `beta/src/node/start_viewer.ts` — wires `/api/vault/{import,export,watch}` routes
- `beta/tests/unit/vault_{importer,exporter,import_api_integration,watch_api_integration}.test.js`
- Toolbar controls in `beta/src/browser/viewer.ts`

**Codex task**: open PR `dev-data → dev-beta` for P1-P4, then add P5. Run manual test below **after merge + rebuild** (`cd beta && npm run build && node dist/node/start_viewer.js`, port 4173).

---

## 2. Manual test workflow

Prereq: a small sample vault at `test-vault/` with:
```
test-vault/
├── Index.md              (frontmatter: tags: [demo], aliases: [Home])
├── notes/
│   ├── Alpha.md          (contains: link to [[Beta]] and [[notes/Gamma|γ]])
│   └── Beta.md
└── assets/
    └── image.png         (referenced as ![[assets/image.png]] in Alpha.md)
```

### Gate A — Import (P1 + P2)

1. Start server; open `http://localhost:4173`.
2. UI: click vault-import toolbar → paste absolute path to `test-vault/` → submit.
3. **Expect**:
   - SSE progress events cycle Phase A → B → C → D → E.
   - Map grows a `folder` node named `test-vault` with children mirroring dir structure.
   - `Index.md` node has `attributes.tags="demo"` and `attributes.aliases="Home"`.
   - `[[Beta]]` in Alpha.md resolves to folder alias pointing at `notes/Beta.md` node (check `nodeType="alias"` + `targetNodeId` set).
   - `[[notes/Gamma|γ]]` → broken alias node (Gamma.md absent) with `isBroken=true` and `aliasLabel="γ"`.
   - `![[assets/image.png]]` handling: record behavior (image node? embedded? ignored?) — currently undecided; flag if it crashes.
4. **Fail conditions**: crash on missing file, encoding error, wikilink not resolved, frontmatter dropped.

### Gate B — Export round-trip (P3)

1. In the imported map, rename one node (`Alpha` → `Alpha-edited`), add a new child text node, change `Index.md` tag.
2. UI: click vault-export toolbar → pick imported folder root → export to `test-vault-out/`.
3. **Expect**:
   - Directory structure recreated.
   - Renamed node produces `Alpha-edited.md`; old `Alpha.md` gone.
   - New child appears as nested heading in its parent `.md`.
   - Changed frontmatter tag written in YAML.
   - Aliases back to `[[wikilink]]`, original `[[notes/Gamma|γ]]` preserved byte-for-byte even if broken.
4. **Diff check**: `diff -r test-vault/ test-vault-out/` (ignoring intentional edits) should be minimal — no spurious whitespace, heading level, or newline churn.

### Gate C — Watch layer (P4)

1. UI: enable vault watch for `test-vault/`.
2. In file explorer, **edit `test-vault/notes/Beta.md`** externally (add a line); save.
3. **Expect**: within ~5s the corresponding map node's body updates live; SSE event visible in DevTools Network.
4. In file explorer, **delete `test-vault/notes/Alpha.md`**.
5. **Expect**: alias targeting Alpha becomes `isBroken=true`; Alpha node removal is guarded (orphan protection — prompt, or soft-delete, not silent removal).
6. In M3E, edit a node body.
7. **Expect**: corresponding `.md` rewritten after debounce (~1-2s); `Alpha.md` modification time updates.
8. **Fail conditions**: lost edits on rapid fs+map dual-edit; watcher leaks file handles; Windows path separator breakage.

### Gate D — Scale smoke (pre-P5)

1. Generate a 1000-file vault (`scripts/gen_vault.sh` — doesn't exist yet; codex to write).
2. Import. Record: time to complete, memory high-water, # of AppState bytes.
3. **Expect**: completes <60s, map stays interactive. If not, log for P5.

### Gate E — Path traversal smoke (security)

1. Attempt vault path `../../etc/passwd` or `C:\Windows\System32` via import API.
2. **Expect**: rejection with clear error; no files read outside the declared vault root.
3. This is a pre-req before Cloud Sync / shared-URL exposure — Red Team concern.

---

## 3. Known gaps / pool as reviews before codex starts

- **Q1**: `![[image.png]]` handling policy — embed as image node, ignore, or copy-to-assets? (tentative: copy into map as image node with rel path)
- **Q2**: Dataview / Templater inline code — preserve verbatim in details, or parse? (tentative: preserve verbatim)
- **Q3**: linearText >6000 chars — truncate with note, chunk into children, or reject? (tentative: chunk)
- **Q4**: Delete policy when `.md` removed externally — soft delete (mark broken, keep node) vs hard delete. (tentative: soft)
- **Q5**: Windows vs POSIX line endings — normalize to LF on import, restore original on export? (tentative: preserve original per-file)

Pool these as `ROOT/SYSTEM/DEV/reviews/Obsidian Integration/Qn` on the beta map before the codex PR opens, so manual gate review can mark `selected="yes"`.

---

## 4. Next actions

1. **Codex**: open `dev-data → dev-beta` PR titled `feat(obsidian): vault import/export/watch (P1-P4)`.
2. **Codex**: run Gates A-E and paste outcomes in PR description.
3. **Akaghef**: review PR; resolve Q1-Q5 with `selected="yes"` on map.
4. **Codex**: kick off P5 (conflict UI + 1000+ perf) as separate PR once P1-P4 lands.

## 5. Reference

- Spec: [dev-docs/03_Spec/Obsidian_Vault_Integration.md](../dev-docs/03_Spec/Obsidian_Vault_Integration.md)
- Design: [dev-docs/design/local_file_integration.md](../dev-docs/design/local_file_integration.md)
- Original task brief: [backlog/codex-obsidian-tight-coupling.md](codex-obsidian-tight-coupling.md)
