/** Checked-in, map-independent definitions. Selections are never map data. */
export type FilterValue = string | readonly string[];
export interface FilterOption { value: string; label: string; meaning: string; minimum?: number }
export interface FilterAxis {
  id: string; label: string; target: "node" | "GraphLink"; keys: readonly string[];
  kind: "exact" | "score" | "multiple"; all: FilterValue; options: readonly FilterOption[];
}
const scoreOptions = (label: string): FilterOption[] => [
  { value: "high-plus", label: "高以上", meaning: "score 3以上", minimum: 3 },
  { value: "medium-plus", label: "中以上", meaning: "score 2以上", minimum: 2 },
  { value: "all", label: "すべて", meaning: `${label}で絞らない` },
];
export const VIEW_FILTER_AXES: readonly FilterAxis[] = [
  { id: "realization", label: "実現段階", target: "GraphLink", keys: ["confidence"], kind: "exact", all: "all", options: [
    { value: "system-evidenced", label: "CURRENT", meaning: "動作を確認した関係だけ" },
    { value: "all", label: "TO-BE", meaning: "採用した設計（図に書いた関係すべて）" },
  ] },
  { id: "importance", label: "重要度", target: "node", keys: ["importance", "priority", "重要度"], kind: "score", all: "all", options: scoreOptions("重要度") },
  { id: "urgency", label: "緊急度", target: "node", keys: ["urgency"], kind: "score", all: "all", options: scoreOptions("緊急度") },
  { id: "domain", label: "所属", target: "node", keys: ["domain"], kind: "multiple", all: [], options: [] },
];
/** Preserves the former viewer importance score, including nullish key precedence. */
export function attributeScore(value: unknown): number {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return 0;
  if (/^[0-9]+$/.test(raw)) return Math.max(0, Number(raw));
  if (raw.includes("critical") || raw.includes("urgent") || raw.includes("highest") || raw.includes("緊急")) return 4;
  if (raw === "h" || raw.includes("high") || raw.includes("top") || raw.includes("高")) return 3;
  if (raw === "m" || raw.includes("medium") || raw.includes("mid") || raw.includes("中")) return 2;
  if (raw === "l" || raw.includes("low") || raw.includes("低")) return 1;
  return 0;
}
