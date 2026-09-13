import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const buildRoot = resolve(root, "dist/browser");
const expected = {
  deck: ['id="wrap"', "function render(){"],
  network: ['id="gsvg"', "function buildEls(){"],
  detail: ['id="term"', "const TM=id=>document.getElementById(id);"],
  edge: ['id="edrawer"', "function edgeClick(ev){"],
  mail: ['id="wrap"', "function mailPulseStart(){"],
  replay: ["DIGEST REPLAY", "function startReplay(names){"],
  runtime: ['id="spawnmd"', "function openSpawnModal(){"],
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
  .filter((needle) => !content.includes(needle))
  .map((needle) => `${component}: ${JSON.stringify(needle)}`));
if (missing.length) {
  console.error(`OT cut build reachability failed:\n${missing.join("\n")}`);
  process.exit(1);
}
console.log(`OT cut build reachability passed for ${Object.keys(expected).length} components.`);
