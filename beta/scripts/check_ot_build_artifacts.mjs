import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const buildRoot = resolve(root, "dist/browser");
const expected = {
  'surface-overview': ['id="wrap"', 'id="gsvg"', 'id="nc-reset"', "function render(){", "function buildEls(){"],
  'agent-detail': ['id="term"', 'id="ot-open-detail"', "function openPanel(name){", "function renderPanelSummary(name, a, g){"],
};

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

if (!statSync(buildRoot, { throwIfNoEntry: false })) {
  console.error(`Missing browser build directory: ${buildRoot}`);
  process.exit(1);
}
const content = files(buildRoot).map((path) => readFileSync(path, "utf8")).join("\n");
const missing = Object.entries(expected).flatMap(([component, needles]) => needles
  .filter((needle) => !content.includes(needle) && !content.includes(JSON.stringify(needle).slice(1, -1)))
  .map((needle) => `${component}: ${JSON.stringify(needle)}`));
if (missing.length) {
  console.error(`OT cut build reachability failed:\n${missing.join("\n")}`);
  process.exit(1);
}
console.log(`OT cut build reachability passed for ${Object.keys(expected).length} components.`);
