import { resolve } from "node:path";
import {
  FileSemanticSourceAdapter,
  SemanticSourceValidationError,
} from "./semantic_source";

function usage(): string {
  return "Usage: node dist/node/semantic_source_validate_cli.js <semantic-source.json> [...]";
}

function main(argv: string[]): number {
  if (argv.length === 0) {
    console.error(usage());
    return 2;
  }

  let failed = false;
  for (const inputPath of argv) {
    const filePath = resolve(inputPath);
    try {
      const adapter = new FileSemanticSourceAdapter(filePath);
      const rebuilt = adapter.rebuild();
      console.log(JSON.stringify({
        ok: true,
        file: inputPath,
        sourceId: rebuilt.sourceId,
        revision: rebuilt.sourceRevision,
        entities: rebuilt.entities.length,
        assertions: rebuilt.assertions.length,
        semanticContentHash: rebuilt.semanticContentHash,
      }));
    } catch (error) {
      failed = true;
      if (error instanceof SemanticSourceValidationError) {
        console.error(JSON.stringify({ ok: false, file: inputPath, issues: error.issues }));
      } else {
        const message = error instanceof Error ? error.message : String(error);
        console.error(JSON.stringify({ ok: false, file: inputPath, issues: [{ code: "READ_FAILED", path: "$", message }] }));
      }
    }
  }
  return failed ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
