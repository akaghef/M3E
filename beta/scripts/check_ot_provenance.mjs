import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const beta = resolve(import.meta.dirname, "..");
const { validateOtProvenance } = await import(resolve(beta, "scripts/ot_provenance_lib.mjs"));
const result = validateOtProvenance(beta, "/tmp/orrery-telemetry-inspect");
if (!result.ok) throw new Error(result.errors.join("\n"));
const manifest = JSON.parse(readFileSync(resolve(beta, "src/labs/ot/provenance.json"), "utf8"));
console.log(`OT provenance OK: ${manifest.fragments.length} responsibility cuts (recorded verbatim regions plus declared adaptations) + ${manifest.styles.length} stylesheet + ${manifest.assets.length} assets`);
