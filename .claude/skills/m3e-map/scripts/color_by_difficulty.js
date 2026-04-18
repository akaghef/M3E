// Default coloring pass: paint a map's nodes white→red by estimated execution difficulty.
// Heuristic-only (no LLM call). Preserves existing m3e:style keys (border/text/...).
// Backs up the pre-write document JSON to %TEMP%/<mapId>_before.json.
//
// Usage:
//   node scripts/color_by_difficulty.js <mapId> [--port 4173] [--dry]
//
// Or via env:
//   M3E_MAP_ID=map_XXX node scripts/color_by_difficulty.js
//
// --dry prints the histogram without writing back.

const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const argv = process.argv.slice(2);
let mapId = process.env.M3E_MAP_ID || "";
let port = Number(process.env.M3E_PORT) || 4173;
let dry = false;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--port") port = Number(argv[++i]);
  else if (a === "--dry") dry = true;
  else if (!mapId) mapId = a;
}
if (!mapId) {
  console.error("Usage: node color_by_difficulty.js <mapId> [--port 4173] [--dry]");
  process.exit(2);
}

const HOST = "127.0.0.1";
const COLORS = ["#ffffff", "#ffe5b4", "#ffb074", "#ff6b4a", "#ff0000"];
const LABELS = [
  "L0 white  (trivial)",
  "L1 peach  (easy)",
  "L2 orange (medium)",
  "L3 verm.  (hard)",
  "L4 red    (very hard)",
];

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body), "utf8") : null;
    const req = http.request({
      host: HOST, port, method, path: urlPath,
      headers: data
        ? { "Content-Type": "application/json; charset=utf-8", "Content-Length": data.length }
        : {},
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(text)); } catch { resolve(text); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${text.slice(0, 300)}`));
        }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

// Heuristic difficulty: 0 (trivial) ... 8+ (very hard).
function difficultyScore(node) {
  const text = node.text || "";
  const details = node.details || "";
  const note = node.note || "";
  const blob = (text + " " + details + " " + note);
  const attrs = node.attributes || {};
  let s = 0;

  // Subtree fan-out → larger task
  const childCount = (node.children || []).length;
  s += Math.min(childCount * 0.6, 4);

  // Length of details/note → ongoing complex thinking
  s += Math.min(details.length / 250, 2.5);
  s += Math.min(note.length / 400, 1.0);

  // Hard-implementation keywords
  if (/(実装|設計|リファクタ|migration|rewrite|refactor|integrat|spike|MVP|prototype|architect|build out|ハーネス|harness|design|spec|sync engine)/i.test(blob)) s += 2.5;

  // Investigation / unknowns
  if (/[？\?]|TODO|未定|TBD|unknown|要検討|要調査|investigat|決めない/i.test(blob)) s += 1.5;

  // External dependency / coordination
  if (/Supabase|cloud|sync|conflict|migration|schema|認証|auth/i.test(blob)) s += 1.0;

  // UX heavy work
  if (/canvas|SVG|レイアウト|animation|transition|drag|複雑なUI/i.test(blob)) s += 1.0;

  // Easy / low-effort signals
  if (/(メモ|確認|更新|comment|整理|note|tweak|typo|rename|cosmetic|軽微|小さい|簡単)/i.test(blob)) s -= 1.5;
  if (/(完了|done|済|fixed|merged|閉じ|closed)/i.test(blob)) s -= 2.5;

  // Status attribute lowers/raises it
  const status = String(attrs.status || attrs["m3e:status"] || "").toLowerCase();
  if (status === "done" || status === "completed" || status === "merged") s -= 4;
  if (status === "in-progress" || status === "active") s += 1;
  if (status === "blocked") s += 2;

  // Very short single-word leaves are usually folders/labels — neutral white
  if (text.length <= 4 && childCount === 0 && !details) s = -10;

  return s;
}

function bucketOf(score) {
  if (score < -2) return 0;
  if (score < 1) return 1;
  if (score < 3) return 2;
  if (score < 6) return 3;
  return 4;
}

(async () => {
  console.log(`[1/4] GET map ${mapId}`);
  const doc = await request("GET", `/api/maps/${encodeURIComponent(mapId)}`);
  const state = doc.state;
  const nodeIds = Object.keys(state.nodes);
  console.log(`     ${nodeIds.length} nodes`);

  console.log("[2/4] Score and bucket");
  const histo = [0, 0, 0, 0, 0];
  for (const id of nodeIds) {
    const node = state.nodes[id];
    const score = difficultyScore(node);
    const b = bucketOf(score);
    histo[b]++;

    node.attributes = node.attributes || {};
    let style = {};
    const raw = node.attributes["m3e:style"];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") style = parsed;
      } catch { style = {}; }
    }
    if (b === 0) {
      delete style.fill;        // L0 = clear (treated as no decoration)
    } else {
      style.fill = COLORS[b];
    }
    if (Object.keys(style).length > 0) {
      node.attributes["m3e:style"] = JSON.stringify(style);
    } else {
      delete node.attributes["m3e:style"];
    }
  }
  for (let i = 0; i < 5; i++) {
    console.log(`     ${LABELS[i]}: ${histo[i]} nodes`);
  }

  if (dry) {
    console.log("[3/4] --dry: skipping backup + write");
    return;
  }

  const backup = path.join(os.tmpdir(), `${mapId}_before.json`);
  console.log(`[3/4] Backup → ${backup}`);
  fs.writeFileSync(backup, JSON.stringify(doc, null, 2));

  console.log("[4/4] POST updated map");
  let result;
  try {
    result = await request("POST", `/api/maps/${encodeURIComponent(mapId)}`, doc);
  } catch (e1) {
    console.log("     POST failed:", e1.message, "→ trying PUT");
    result = await request("PUT", `/api/maps/${encodeURIComponent(mapId)}`, doc);
  }
  console.log("     result:", JSON.stringify(result).slice(0, 300));
})().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
