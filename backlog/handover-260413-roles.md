# Handover 260413 — Setup items akaghef must do

Manager: Claude (opus-4.6) / Date: 2026-04-13

These blockers prevent sub-agent work from starting. They require user (akaghef) action because they touch Supabase dashboards, external accounts, or OS-level install.

---

## 1. New Codex role: `red` (Security)  [blocks S4]

Create the worktree + agent definition so `red` can be invoked like visual/data/team.

**Steps**
- [ ] `git worktree add ../M3E-dev-red-security -b dev-red` from main
- [ ] Copy `.claude/agents/visual.md` → `.claude/agents/red.md`; rewrite scope to: security review, threat modeling, penetration test scripts. Working dirs: `beta/src/node/`, `scripts/ops/`, `docs/03_Spec/`.
- [ ] Add `red` to `.claude/settings.json` agents allowlist if present.
- [ ] (Optional) Install OWASP ZAP on host or VM for DAST runs.

**Framework references**
- OWASP ASVS v4 checklist
- Supabase RLS policies docs (https://supabase.com/docs/guides/auth/row-level-security)
- Existing `docs/03_Spec/Command_Panel_Security_Test_Cases.md`
- Blocked items already on board: CSRF / LAN exposure / spoofing / input validation

---

## 2. New Codex role: `voice`  [blocks S6-Mapify]

**Steps**
- [ ] `git worktree add ../M3E-dev-voice -b dev-voice`
- [ ] Create `.claude/agents/voice.md`: scope = audio capture → transcription → task/node insertion. Working dirs: `beta/src/browser/` (mic UI), `beta/src/node/` (transcribe proxy).
- [ ] Obtain OpenAI Whisper API key **or** confirm Web Speech API is sufficient (browser-only, free, lower accuracy).
- [ ] Add env var slot `M3E_WHISPER_KEY` to `scripts/beta/launch.bat` (leave empty until key supplied).

**Framework references**
- Whisper API: https://platform.openai.com/docs/guides/speech-to-text
- Web Speech API (browser): https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
- Pipes into PageIndex (see §3) to build map structure from transcript

---

## 3. PageIndex installation  [blocks S2 + S6-Mapify]

Tree-indexer for large doc corpora. Needed for `decisions/` scope search and Mapify voice-pipeline.

**Steps**
- [ ] `pip install pageindex` in a Python venv under `tools/pageindex/` (do NOT pollute global python)
- [ ] Confirm it can process `docs/` end-to-end: `pageindex build docs/`
- [ ] Decide: Python sidecar (spawn from node) vs. port to TS. Recommend sidecar for P1.

**Framework references**
- https://github.com/VectifyAI/PageIndex
- Integration pattern: node `child_process.spawn('python', ['-m','pageindex', ...])` + stream JSON over stdout

---

## 4. Supabase project `m3e-dev`  [blocks S5 Cloud-Sync e2e]

260412 daily already flagged. Needed so dev DB (`M3E_devV1.sqlite`) has a sync target separate from `m3e-prod`.

**Steps**
- [ ] Supabase dashboard → New project `m3e-dev` (free tier, Tokyo region)
- [ ] Copy URL + anon key into `%LOCALAPPDATA%\M3E\M3E_dev.sync.json`
- [ ] Create `documents` table with schema from 260412 daily (id TEXT PK, version INT, saved_at TEXT, state_json TEXT)
- [ ] Add RLS policy: owner-only read/write (red will audit later)

---

## 5. markdown-viewer / Mermaid skill  [blocks S1 self-evolving loop]

**Steps**
- [ ] Install a Claude skill that renders Mermaid locally (check `/skills` registry) OR confirm existing `m3e-map` visualization is enough for mid-loop review.
- [ ] Decide: do we render Mermaid inside the map (new node type) or in an external panel? (design decision, not installation)

---

## Sub-agent task dispatch (no setup needed, just kick off)

These can start immediately once the above is NOT a blocker for them:

| Agent | First design deliverable | Output target |
|---|---|---|
| **data** (codex, running) | Continue Obsidian Watch/Sync layer design | `docs/03_Spec/Obsidian_Vault_Integration.md` §Watch |
| **visual** | Presentation Mode design doc | `docs/03_Spec/Presentation_Mode.md` (new) |
| **team** | VM e2e Cloud-Sync test matrix + Miro-style realtime draft | `docs/03_Spec/Cloud_Sync_E2E.md` (new) |
| **manage** (self) | review-pool skill spec + Workflow Layer L1-L5 | `docs/02_Strategy/Workflow_Layers.md` (new) |
| **data2** | PageIndex integration spec (pending §3) | `docs/03_Spec/PageIndex_Integration.md` (new) |

---

## Summary of required akaghef actions

1. Create 2 worktrees + agent md files (`red`, `voice`) — ~15 min
2. Install PageIndex in sidecar venv — ~10 min
3. Create Supabase `m3e-dev` project + sync config — ~20 min
4. (Optional) Whisper API key + ZAP install — deferrable

Total: ~45 min of setup unblocks all S1-S8 design work.
