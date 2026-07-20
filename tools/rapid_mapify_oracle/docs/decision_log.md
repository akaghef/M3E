# Decision log

| ID | Decision | Status |
|---|---|---|
| DEC1 | Treat Mapify action as provisional correct teacher signal for Rapid. | Fixed |
| DEC2 | M3E `AppState / workspace > map > scope > node` remains canonical. | Fixed |
| DEC3 | Rapid generation is local selected-node/subtree delta; whole-map generation belongs to Flash. | Fixed |
| DEC4 | Compare operation flow and graph delta quality, not only node count or UI appearance. | Fixed |
| DEC5 | Improve M3E Rapid policy/prompt/formatter/delta guards through classified failures. | Fixed |
| DEC6 | Use Mapify I/O as optional teacher/probe layer, not as runtime dependency. | Fixed |
| DEC7 | Detailed M3E integration error handling is delegated to Codex, but the loop must preserve run artifacts. | Fixed |
| DEC8 | Avoid cookie extraction; any Mapify internal fetch must run inside logged-in browser context. | Fixed |

## Practical consequence

The system may ask Mapify, or use previously captured Mapify traces, to define the teacher delta. It must then make M3E produce a comparable local graph delta natively.
