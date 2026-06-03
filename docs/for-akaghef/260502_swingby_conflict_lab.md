# Swingby conflict lab runbook

Date: 2026-05-02

## Purpose

`ws_team_swingby` の中で、定例会 map とは別の conflict lab map を使い、public link 経由の VM stale write が 409 で止まり、明示 resolution で host 側更新と VM 側 resolution が両方残ることを確認する。

## Links

- Viewer: <https://akaghef-dell.tail6206ae.ts.net/viewer.html?ws=ws_team_swingby&map=map_team_swingby_conflict_lab_260502&access=edit>
- API: <https://akaghef-dell.tail6206ae.ts.net/api/maps/map_team_swingby_conflict_lab_260502>

Do not use the meeting map for this test:

- Meeting map: `map_team_swingby_monthly_2604`
- Conflict lab map: `map_team_swingby_conflict_lab_260502`

## Prerequisites

- Host beta server is running on `localhost:4173`.
- Tailscale public base URL proxies to that server: `https://akaghef-dell.tail6206ae.ts.net`.
- VirtualBox VM `M3E-Test` is running or guestcontrol-ready.
- Guest credentials are the test defaults: `m3etest` / `m3etest`.
- Guest Additions are ready enough for `VBoxManage guestcontrol run`.

## Command

From `C:\Users\Akaghef\dev\M3E`:

```powershell
scripts\ops\vm_swingby_conflict_lab.bat
```

Optional overrides:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\ops\vm_swingby_conflict_lab.ps1 `
  -VmName M3E-Test `
  -PublicBase https://akaghef-dell.tail6206ae.ts.net `
  -WorkspaceId ws_team_swingby `
  -MapId map_team_swingby_conflict_lab_260502
```

## Expected Flow

1. Host force-seeds `map_team_swingby_conflict_lab_260502` with root `Swingby conflict lab`.
2. VM reads the stale base through the public API URL and stores it under `C:\M3E_test_reports\swingby_conflict_lab_*`.
3. Host saves a newer edit with the stale `baseSavedAt`.
4. VM tries to save its stale edit with the old `baseSavedAt`; expected result is HTTP 409 / `DOC_CONFLICT`.
5. VM resolves by force-saving a merged state built from the latest remote state after the 409 plus `vm resolution edit <runId>`.
6. Host verifies final state contains:
   - `Swingby conflict lab`
   - `host seed <runId>`
   - `host newer edit <runId>`
   - `vm resolution edit <runId>`

## Pass / Blocker

Pass condition: script prints `[PASS] Swingby conflict lab verified.`

Common blockers:

- `VBoxManage not found`: VirtualBox is not installed at the default path.
- `Guest PowerShell failed`: VM is off, credentials changed, or Guest Additions are not ready.
- Public API timeout / HTTP failure: beta server or Tailscale public proxy is not serving `localhost:4173`.
