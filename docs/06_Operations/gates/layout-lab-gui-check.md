# FAIL — layout-lab G-GUI independent check

Date: 2026-06-25
Reviewer role: independent Codex reviewer, not the implementer
Worktree: `/Users/nisimoriyuuya/dev/M3E-layout-seam-lab`
Branch: `codex/layout-seam-lab`

## Verdict

FAIL, classified as a setup blocker.

The requested lab server could not be started, so the real GUI gate could not inspect layout samples, controls, status, golden diff, or browser console behavior. This is not a product behavior PASS.

## Environment

- OS: macOS 14.8.1 (Build 23J30)
- Node: v26.0.0
- npm: 11.12.1
- Vite: 8.0.13 (`darwin-arm64`, `node-v26.0.0`)
- Browser: no usable browser session was established. `open -a "Google Chrome"` failed because Google Chrome was not installed, and Launch Services reported no URL handler for the target URL.
- Computer-use: attempted. `computer-use/get_app_state` for Safari timed out after 120 seconds, so no computer-use screenshot could be captured.

## Startup Evidence

Command run from `beta/`:

```text
npx vite --config vite.config.mjs --host 127.0.0.1 --port 4175
```

Result:

```text
error when starting dev server:
Error: listen EPERM: operation not permitted 127.0.0.1:4175
  code: 'EPERM',
  errno: -1,
  syscall: 'listen',
  address: '127.0.0.1',
  port: 4175
```

Target URL:

```text
http://127.0.0.1:4175/src/labs/layout/layout-lab.html
```

## Sample Observations

### tree

Not executed. The lab did not start, so dummy rectangles, parent-child edges, golden diff, and status were not observable.

### mindmap

Not executed. The lab did not start, so dummy rectangles, parent-child edges, golden diff, and status were not observable.

### scope-routing

Not executed. The lab did not start, so dummy rectangles, parent-child edges, golden diff, and status were not observable.

## Controls Checked

Controls were not operable because the GUI never loaded:

- mode: not checked
- direction: not checked
- depthAlign: not checked
- density: not checked
- branchDirection: not checked
- spacing: not checked

## Golden Diff / Status

Not checked. No rendered lab state was available.

## Browser Console

Not checked. No browser session reached the lab URL.

## Screenshot Evidence

Screenshots captured: 0.

Reason: the requested local server failed to bind before GUI validation, browser launch failed, and computer-use timed out while attempting to inspect Safari.

## Notes

This artifact intentionally does not modify implementation code. The gate remains FAIL until a reviewer can start the lab, drive the real GUI, inspect all three samples, operate the layout controls, verify golden status/diff behavior, and confirm the browser console has no errors.
