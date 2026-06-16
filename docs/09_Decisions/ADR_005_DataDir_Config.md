# ADR 005: Data Directory Configuration per Environment

## Status

Accepted

## Date

2026-04-01

## Context

The SQLite database path is currently resolved relative to `__dirname` inside the compiled Node.js bundle, which places user data inside the application directory (`<env>/data/rapid-mvp.sqlite`).

This is acceptable during development (beta), where developers want data co-located with the source. However, for the final environment deployed as a desktop application, storing data inside the app directory causes problems:

- Updating the app (re-running `migrate-from-beta.bat`) risks overwriting or losing user data.
- Standard Windows practice expects user data under `%APPDATA%`, not the application install path.
- Users cannot easily back up or relocate their data independently from the application.

## Decision

Resolve the data directory via the environment variable `M3E_DATA_DIR`. If the variable is not set, fall back to the current behavior (`<app-root>/data/`).

```
Priority: M3E_DATA_DIR (env) > <app-root>/data/ (default)
```

Each environment sets this variable at launch time:

| Environment | M3E_DATA_DIR | Set by |
|-------------|-------------|--------|
| beta (dev) | *(not set — uses default)* | — |
| final (desktop) | `%APPDATA%\M3E` | `scripts/final/launch.bat` |
| final (user override) | any path | user edit of `launch.bat` |

## Why Environment Variable

- Minimal code change: one line in `start_viewer.ts`.
- No config file reader needed; the launch script is the single source of truth for the final environment.
- Easy to override without recompiling; users can edit `launch.bat` if they need a custom path.
- Keeps beta behavior unchanged — developers do not need to set anything.

## Why Not a Config File

A JSON/INI config file would require a reader, a fallback resolution strategy, and a location convention. For the current single-user local app this is unnecessary complexity. Revisit if a settings UI is added later.

## Why Not Hardcode %APPDATA% in Code

The code would then behave differently in dev vs. final without any explicit signal, making debugging harder. Keeping the code path-agnostic and letting the launch script control the environment is a cleaner separation.

## Consequences

### Positive

- Data survives app updates in the final environment.
- beta development workflow is unaffected.
- No new dependencies or config file format.
- User can relocate data by editing one line in `launch.bat`.

### Negative

- If a user launches the final app directly (bypassing `launch.bat`), `M3E_DATA_DIR` will not be set and data will land in the app directory. Document this in `FINAL_POLICY.md`.
- Migration script (`migrate-from-beta.bat`) must also read `M3E_DATA_DIR` when performing backup.

## Implementation Checklist

- [ ] `beta/src/node/start_viewer.ts` — replace hardcoded path with `process.env.M3E_DATA_DIR ?? path.join(ROOT, "data")`
- [ ] `scripts/final/launch.bat` — add `set M3E_DATA_DIR=%APPDATA%\M3E` before `npm start`
- [ ] `scripts/final/migrate-from-beta.bat` — use same env var for backup path
- [ ] `final/FINAL_POLICY.md` — add note: always launch via `launch.bat` to ensure correct data path
