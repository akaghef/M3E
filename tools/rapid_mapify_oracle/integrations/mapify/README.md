# Mapify integration notes

Use Mapify as a teacher/probe layer.

## Allowed

- Manual observation of Mapify Rapid-like behavior.
- Fixture teacher traces.
- Markdown outline outbound probe.
- XMind `.xmind` export -> `content.json` recovery.
- Browser-context fetch that does not expose cookies.

## Avoid

- Mapify as canonical store.
- Direct ingestion of raw M3E AppState by Mapify.
- Cookie extraction into Codex scripts.
- Relying on private API as the only path.
- Running live Mapify calls in every autonomous iteration.
