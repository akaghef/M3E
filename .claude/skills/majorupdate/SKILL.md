---
name: majorupdate
description: Promote dev-beta to main (final) with a date-based version tag. Merges dev-beta into main with a merge commit, tags it as vYYMMDD (e.g. v260402), pushes both, then returns to dev-beta. Use when the user says /majorupdate or wants to release / promote beta to final.
---

# Major Update Skill

Promote the current `dev-beta` branch to `main` (final release) with a date-based version tag.

## Version format

Tag name: `v` + YYMMDD of today's date (e.g. `v260402` for 2026-04-02).
Derive the date from the current date at the time of execution.

## Steps

Execute the following sequence in order:

1. **Confirm** with the user before proceeding (this modifies `main`)
2. Determine today's version tag: `vYYMMDD`
3. `git checkout main`
4. `git merge dev-beta --no-ff -m "merge: dev-beta → main (beta promotion to final)"`
5. `git tag <vYYMMDD> main`
6. `git push origin main`
7. `git push origin <vYYMMDD>`
8. `git checkout dev-beta` — return to the working branch

## Notes

- If there are merge conflicts, stop and report them to the user before proceeding
- If the tag already exists (same-day re-launch), ask the user whether to overwrite or use a suffix (e.g. `v260402-2`)
- Report the commit range pushed and the tag name on completion
- Do not force-push or rewrite history
