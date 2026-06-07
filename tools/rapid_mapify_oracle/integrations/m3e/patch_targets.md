# M3E integration patch targets

This bundle does not assume exact M3E file names. Codex should inspect the repo and bind these abstract targets to actual files.

| Abstract target | Expected implementation |
|---|---|
| Rapid operation registry | Register `RF1.expandSelectedNode`, `RF2.addExamples`, `RF3.addSubtypes` |
| Selection context provider | Provide current `workspace/map/scope/selectedNodeId` to Rapid op |
| Local delta writer | Append children under selected node and preserve IDs/order |
| Prompt/policy layer | Enforce short noun labels, sibling consistency, duplicate filter |
| UI trigger | PN/shortcut route invokes Rapid operation without firing inside text input |
| AppState diff exporter | Emit before/after tree delta for grading |
| Browser verifier hook | Expose visible labels or stable DOM selectors for browser-use |

## Minimal internal API Codex should create if absent

```ts
interface RapidOpRequest {
  opId: string;
  workspaceId: string;
  mapId: string;
  scopeId: string;
  selectedNodeId: string;
  localContext: unknown;
}

interface RapidNodeCandidate {
  text: string;
  semanticRole?: 'class' | 'example' | 'definition' | 'related' | 'unknown';
  children?: RapidNodeCandidate[];
}

interface RapidOpResult {
  opId: string;
  selectedNodeId: string;
  delta: unknown;
  diagnostics: string[];
}
```

Codex may adapt this to the actual M3E TypeScript types.
