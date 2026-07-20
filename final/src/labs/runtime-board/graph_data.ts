/** Static demo data for the conditional-probability pipeline runtime board. */

export type NodeCategory =
  | "source"
  | "etl"
  | "table"
  | "independent"
  | "hub"
  | "process"
  | "service"
  | "api"
  | "api-new"
  | "output";

export type GraphNode = {
  id: string;
  label: string;
  sublabel?: string;
  category: NodeCategory;
  x: number;
  y: number;
  w: number;
  h: number;
  method?: string;
  path?: string;
  overview?: string;
  code?: string;
  sourceLink?: string;
};

export type GraphEdge = {
  id: string;
  from: string;
  to: string;
  label?: string;
  /** optional control point offset for elbow routing */
  via?: { x: number; y: number }[];
};

export type StepDef = {
  index: number;
  title: string;
  detail: string;
  activeNodeIds: string[];
  activeEdgeIds: string[];
  completedNodeIds?: string[];
};

export const CATEGORY_META: Record<
  NodeCategory,
  { label: string; fill: string; stroke: string; text: string }
> = {
  source: { label: "原典データ", fill: "#1e3a5f", stroke: "#3b82f6", text: "#bfdbfe" },
  etl: { label: "ETL / Phase", fill: "#7c2d12", stroke: "#ea580c", text: "#fed7aa" },
  table: { label: "テーブル (条件付き分布)", fill: "#14532d", stroke: "#22c55e", text: "#bbf7d0" },
  independent: { label: "独立テーブル (marginal)", fill: "#166534", stroke: "#4ade80", text: "#dcfce7" },
  hub: { label: "ハブ (T_municipal_stats)", fill: "#5b21b6", stroke: "#a78bfa", text: "#ede9fe" },
  process: { label: "加工手法", fill: "#9a3412", stroke: "#f97316", text: "#ffedd5" },
  service: { label: "サービス", fill: "#9d174d", stroke: "#ec4899", text: "#fce7f3" },
  api: { label: "API エンドポイント", fill: "#7f1d1d", stroke: "#ef4444", text: "#fecaca" },
  "api-new": { label: "■ 新規 API", fill: "#991b1b", stroke: "#f87171", text: "#fee2e2" },
  output: { label: "出力", fill: "#713f12", stroke: "#eab308", text: "#fef9c3" },
};

const N = (
  partial: GraphNode
): GraphNode => ({
  ...partial,
  w: partial.w ?? 148,
  h: partial.h ?? 44,
  overview: partial.overview ?? `${partial.label} ノード`,
  code:
    partial.code ??
    `// ${partial.id}\nfunction handle() {\n  return load("${partial.id}");\n}`,
  sourceLink: partial.sourceLink ?? `lambda/api/src/handlers/${partial.id}.ts`,
});

/** Multi-column pipeline layout (world coords). */
export const NODES: GraphNode[] = [
  // Col 0 — source
  N({ id: "src-census-2020", label: "国勢調査 2020", sublabel: "e-Stat API", category: "source", x: 40, y: 40, w: 150, h: 48 }),
  N({ id: "src-estat-api", label: "e-Stat API", sublabel: "統計表取得", category: "source", x: 40, y: 110, w: 150, h: 48 }),
  N({ id: "src-school-basic", label: "学校基本調査", sublabel: "文部科学省", category: "source", x: 40, y: 180, w: 150, h: 48 }),
  N({ id: "src-economic-2021", label: "経済センサス 2021", sublabel: "事業所統計", category: "source", x: 40, y: 250, w: 150, h: 48 }),
  N({ id: "src-labor-2023", label: "労働力調査 2023", sublabel: "就業構造", category: "source", x: 40, y: 320, w: 150, h: 48 }),
  N({ id: "src-housing", label: "住宅・土地統計", sublabel: "総務省", category: "source", x: 40, y: 390, w: 150, h: 48 }),
  N({ id: "src-kaken", label: "共創研 Kaken", sublabel: "研究データ", category: "source", x: 40, y: 460, w: 150, h: 48 }),

  // Col 1 — ETL intermediate
  N({ id: "etl-census", label: "node-census", sublabel: "正規化・結合", category: "etl", x: 240, y: 50, w: 140, h: 48 }),
  N({ id: "etl-employment", label: "node-employment_structure", sublabel: "産業×就業", category: "etl", x: 240, y: 140, w: 160, h: 48 }),
  N({ id: "etl-economic", label: "node-economic_census", sublabel: "地域経済", category: "etl", x: 240, y: 230, w: 150, h: 48 }),
  N({ id: "etl-tax", label: "node-tax", sublabel: "税務統計", category: "etl", x: 240, y: 320, w: 140, h: 48 }),
  N({ id: "etl-university", label: "node-university", sublabel: "高等教育", category: "etl", x: 240, y: 410, w: 140, h: 48 }),

  // Col 2 — independent / hub tables
  N({ id: "t-age", label: "T1_age", sublabel: "年齢分布", category: "independent", x: 460, y: 30, w: 120, h: 42 }),
  N({ id: "t-sex", label: "T2_sex", sublabel: "性別分布", category: "independent", x: 460, y: 90, w: 120, h: 42 }),
  N({ id: "t-prefecture", label: "T3_prefecture", sublabel: "都道府県", category: "independent", x: 460, y: 150, w: 130, h: 42 }),
  N({
    id: "t-municipal",
    label: "T_municipal_stats",
    sublabel: "市区町村ハブ",
    category: "hub",
    x: 450,
    y: 220,
    w: 150,
    h: 48,
    overview: "市区町村単位の統計ハブ。条件付き分布の結合キー。",
    code: "const hub = joinMunicipal(T3, census, economic);\nreturn hub.byPrefecture(pref);",
    sourceLink: "lambda/api/src/tables/municipal_stats.ts",
  }),
  N({ id: "t-marital", label: "T4_marital", sublabel: "配偶者関係", category: "table", x: 460, y: 300, w: 120, h: 42 }),
  N({ id: "t-education", label: "T5_education", sublabel: "学歴分布", category: "table", x: 460, y: 360, w: 120, h: 42 }),
  N({ id: "t-employment", label: "T6_employment", sublabel: "就業状態", category: "independent", x: 460, y: 420, w: 130, h: 42 }),
  N({ id: "t-income", label: "T8_income", sublabel: "所得分布", category: "independent", x: 460, y: 480, w: 120, h: 42 }),
  N({ id: "t-occupation", label: "T11_occupation", sublabel: "職業分類", category: "independent", x: 460, y: 540, w: 130, h: 42 }),
  N({ id: "t7b-employment-pref", label: "T7B_employment_pref", sublabel: "就業×地域", category: "table", x: 460, y: 600, w: 150, h: 42 }),
  N({ id: "m5-universities", label: "M5_universities", sublabel: "大学マスタ", category: "etl", x: 460, y: 660, w: 130, h: 42 }),

  // Col 3 — Phases
  N({
    id: "phase1",
    label: "Phase 1 基盤",
    sublabel: "年齢・性別・地域",
    category: "etl",
    x: 680,
    y: 40,
    w: 150,
    h: 48,
    overview: "基盤属性の独立抽選: 年齢 / 性別 / 都道府県 / 市区町村。",
    code: "P(age) ← T1\nP(sex|age) ← T2_by_age\nP(pref) ← T3\nP(muni|pref) ← T_municipal_stats",
  }),
  N({
    id: "phase2",
    label: "Phase 2 デモグラフィック",
    sublabel: "婚姻・学歴",
    category: "etl",
    x: 680,
    y: 120,
    w: 170,
    h: 48,
  }),
  N({
    id: "phase3",
    label: "Phase 3 経済",
    sublabel: "就業・所得・職業",
    category: "process",
    x: 680,
    y: 220,
    w: 150,
    h: 48,
    overview: "Municipal Blend とフォールバック階層で経済属性を推定。",
    code:
      "P(employment | sex, age) ← T7 + T7B fallback → Municipal Blend\nP(occupation | emp, sex, edu) ← T11 × Municipal Blend\nP(income | hh, age) ← T8 × Municipal Blend",
  }),
  N({ id: "phase4", label: "Phase 4 地理", sublabel: "移動・居住", category: "etl", x: 680, y: 320, w: 140, h: 48 }),
  N({ id: "phase5", label: "Phase 5 心理", sublabel: "嗜好・行動", category: "etl", x: 680, y: 400, w: 140, h: 48 }),
  N({
    id: "phase6",
    label: "Phase 6 検証",
    sublabel: "HARD / COND / SOFT",
    category: "etl",
    x: 680,
    y: 500,
    w: 150,
    h: 48,
    overview: "ルール検証と再生成。HARD 棄却、COND 再サンプル、SOFT ペナルティ。",
    code:
      "HARD 57 ルール検査 (違反 → 棄却 + 再生成)\nCOND 49 ルール (違反 → 該当属性 resample)\nSOFT 51 + S-R20 6 ルール (penalty スコア)\n(オプション) apply_lpf でキャリブレーション",
  }),

  // Col 4 — process techniques
  N({
    id: "cond-sampling",
    label: "Conditional Sampling",
    sublabel: "条件付き抽選",
    category: "process",
    x: 900,
    y: 40,
    w: 170,
    h: 48,
  }),
  N({
    id: "municipal-blend",
    label: "Municipal Blend",
    sublabel: "市区町村混合",
    category: "process",
    x: 900,
    y: 140,
    w: 150,
    h: 48,
  }),
  N({
    id: "fallback-hierarchy",
    label: "Fallback Hierarchy",
    sublabel: "階層フォールバック",
    category: "process",
    x: 900,
    y: 230,
    w: 160,
    h: 48,
  }),
  N({
    id: "apply-lpf",
    label: "apply_lpf",
    sublabel: "LPF キャリブレーション",
    category: "process",
    x: 900,
    y: 340,
    w: 140,
    h: 48,
  }),
  N({
    id: "hardcond-rules",
    label: "HARD/COND Rules",
    sublabel: "57+49 ルール",
    category: "process",
    x: 900,
    y: 440,
    w: 150,
    h: 48,
  }),

  // Col 5 — services
  N({
    id: "gen-lambda",
    label: "Gen Lambda",
    sublabel: "生成エントリ",
    category: "service",
    x: 1120,
    y: 100,
    w: 140,
    h: 48,
    overview: "ペルソナ生成 Lambda。Phase 1〜6 をオーケストレーション。",
    code: "export async function generatePersona(req) {\n  const base = samplePhase1(req);\n  return runPhases(base, req.conditions);\n}",
    sourceLink: "lambda/api/src/handlers/generate.ts",
  }),
  N({
    id: "condition-rate-service",
    label: "condition-rate-service",
    sublabel: "条件付き確率",
    category: "service",
    x: 1100,
    y: 320,
    w: 170,
    h: 48,
    overview: "条件付き確率と信頼区間・推定人口を返すコアサービス。",
    code:
      "stderr = √(p(1-p)/N)\nCI95 = [rate ± 1.96·stderr]\nestimated_population = round(rate × base_pop)",
    sourceLink: "lambda/api/src/services/condition_rate.ts",
  }),

  // Col 6 — APIs
  N({
    id: "api-personas-generate",
    label: "POST /v1/personas/generate",
    sublabel: "ペルソナ生成",
    category: "api",
    x: 1340,
    y: 80,
    w: 190,
    h: 48,
    method: "POST",
    path: "/v1/personas/generate",
    overview: "条件付きペルソナを生成する API。",
    code: "POST /v1/personas/generate\n→ Gen Lambda\n→ JSON persona",
    sourceLink: "lambda/api/src/handlers/personas_generate.ts",
  }),
  N({
    id: "api-tables-id",
    label: "GET /v1/tables/:id",
    sublabel: "テーブル直接取得",
    category: "api",
    x: 1340,
    y: 160,
    w: 170,
    h: 48,
    method: "GET",
    path: "/v1/tables/:id",
    overview: "テーブル直接取得 API",
    code: "GET /v1/tables/{table_id}\n→ loadTable(table_id) (Lambda Layer から JSON 読み込み)\n→ JSON そのまま返却",
    sourceLink: "lambda/api/src/handlers/index.ts#handleGetTable",
  }),
  N({
    id: "api-condition-rate",
    label: "POST /v1/personas/condition-rate",
    sublabel: "条件付き確率 API",
    category: "api-new",
    x: 1320,
    y: 300,
    w: 210,
    h: 52,
    method: "POST",
    path: "/v1/personas/condition-rate",
    overview: "条件付き確率・信頼区間・推定人口を返す新規 API。",
    code: `POST /v1/personas/condition-rate に下記が到着:
{
  "conditions": {
    "age_range": {"min": 25, "max": 45},
    "sex": "female",
    "prefecture": ["東京都"],
    "big5": {"O": {"min": 0.0}}
  },
  "method": "auto",
  "include_absolute": true
}`,
    sourceLink: "lambda/api/src/handlers/condition_rate.ts",
  }),
  N({
    id: "api-health",
    label: "GET /health",
    sublabel: "ヘルスチェック",
    category: "api",
    x: 1340,
    y: 400,
    w: 130,
    h: 42,
    method: "GET",
    path: "/health",
  }),

  // Col 7 — outputs
  N({
    id: "out-condition-rate",
    label: "条件付き確率 (%)",
    sublabel: "rate / CI / pop",
    category: "output",
    x: 1580,
    y: 280,
    w: 160,
    h: 52,
    overview: "最終出力: 条件付き確率、95% CI、推定人口。",
    code: "{\n  \"rate\": 0.0042,\n  \"ci95\": [0.0030, 0.0054],\n  \"estimated_population\": 525000\n}",
  }),
  N({
    id: "out-persona",
    label: "生成ペルソナ",
    sublabel: "JSON persona",
    category: "output",
    x: 1580,
    y: 100,
    w: 140,
    h: 48,
  }),
  N({
    id: "out-table",
    label: "生テーブル",
    sublabel: "JSON rows",
    category: "output",
    x: 1580,
    y: 180,
    w: 130,
    h: 48,
  }),
];

export const EDGES: GraphEdge[] = [
  { id: "e-src-census", from: "src-census-2020", to: "etl-census" },
  { id: "e-src-estat", from: "src-estat-api", to: "etl-census" },
  { id: "e-src-school", from: "src-school-basic", to: "etl-university" },
  { id: "e-src-economic", from: "src-economic-2021", to: "etl-economic" },
  { id: "e-src-labor", from: "src-labor-2023", to: "etl-employment" },
  { id: "e-src-housing", from: "src-housing", to: "etl-tax" },
  { id: "e-src-kaken", from: "src-kaken", to: "etl-university" },

  { id: "e-etl-age", from: "etl-census", to: "t-age", label: "age" },
  { id: "e-etl-sex", from: "etl-census", to: "t-sex", label: "sex" },
  { id: "e-etl-pref", from: "etl-census", to: "t-prefecture", label: "pref" },
  { id: "e-etl-muni", from: "etl-census", to: "t-municipal", label: "muni" },
  { id: "e-emp-t6", from: "etl-employment", to: "t-employment" },
  { id: "e-emp-t7b", from: "etl-employment", to: "t7b-employment-pref" },
  { id: "e-econ-hub", from: "etl-economic", to: "t-municipal" },
  { id: "e-tax-income", from: "etl-tax", to: "t-income" },
  { id: "e-uni-m5", from: "etl-university", to: "m5-universities" },
  { id: "e-uni-edu", from: "etl-university", to: "t-education" },

  { id: "e-t1-p1", from: "t-age", to: "phase1", label: "P(age)" },
  { id: "e-t2-p1", from: "t-sex", to: "phase1", label: "P(sex)" },
  { id: "e-t3-p1", from: "t-prefecture", to: "phase1", label: "P(pref)" },
  { id: "e-hub-p1", from: "t-municipal", to: "phase1", label: "muni" },
  { id: "e-t4-p2", from: "t-marital", to: "phase2" },
  { id: "e-t5-p2", from: "t-education", to: "phase2" },
  { id: "e-t6-p3", from: "t-employment", to: "phase3" },
  { id: "e-t8-p3", from: "t-income", to: "phase3" },
  { id: "e-t11-p3", from: "t-occupation", to: "phase3" },
  { id: "e-t7b-p3", from: "t7b-employment-pref", to: "phase3" },
  { id: "e-hub-p3", from: "t-municipal", to: "phase3", label: "blend" },

  { id: "e-p1-cs", from: "phase1", to: "cond-sampling" },
  { id: "e-p2-mb", from: "phase2", to: "municipal-blend" },
  { id: "e-p3-mb", from: "phase3", to: "municipal-blend" },
  { id: "e-p3-fb", from: "phase3", to: "fallback-hierarchy" },
  { id: "e-p6-lpf", from: "phase6", to: "apply-lpf" },
  { id: "e-p6-rules", from: "phase6", to: "hardcond-rules" },
  { id: "e-rules-p6", from: "hardcond-rules", to: "phase6" },

  { id: "e-cs-gen", from: "cond-sampling", to: "gen-lambda" },
  { id: "e-mb-gen", from: "municipal-blend", to: "gen-lambda" },
  { id: "e-fb-crs", from: "fallback-hierarchy", to: "condition-rate-service" },
  { id: "e-lpf-crs", from: "apply-lpf", to: "condition-rate-service" },
  { id: "e-rules-crs", from: "hardcond-rules", to: "condition-rate-service" },

  { id: "e-gen-api", from: "gen-lambda", to: "api-personas-generate" },
  { id: "e-gen-table", from: "gen-lambda", to: "api-tables-id" },
  { id: "e-crs-api", from: "condition-rate-service", to: "api-condition-rate" },
  { id: "e-api-gen-out", from: "api-personas-generate", to: "out-persona" },
  { id: "e-api-table-out", from: "api-tables-id", to: "out-table" },
  { id: "e-api-cr-out", from: "api-condition-rate", to: "out-condition-rate" },
];

/** 15-step API processing flow matching the reference video narrative. */
export const STEPS: StepDef[] = [
  {
    index: 1,
    title: "API リクエスト受信",
    detail: `POST /v1/personas/condition-rate に下記が到着:
{
  "conditions": {
    "age_range": {"min": 25, "max": 45},
    "sex": "female",
    "prefecture": ["東京都"],
    "big5": {"O": {"min": 0.0}}
  },
  "method": "auto",
  "include_absolute": true
}`,
    activeNodeIds: ["api-condition-rate"],
    activeEdgeIds: [],
  },
  {
    index: 2,
    title: "ルーティング → condition-rate-service",
    detail: "API Gateway → Lambda ハンドラ → condition-rate-service へ委譲。\nmethod: auto のとき内部で推定経路を選択。",
    activeNodeIds: ["api-condition-rate", "condition-rate-service"],
    activeEdgeIds: ["e-crs-api"],
    completedNodeIds: ["api-condition-rate"],
  },
  {
    index: 3,
    title: "原典データ参照",
    detail: "条件に必要な統計表の原典 (国勢調査 / e-Stat / 労働力調査 等) を解決。",
    activeNodeIds: [
      "src-census-2020",
      "src-estat-api",
      "src-labor-2023",
      "etl-census",
      "etl-employment",
    ],
    activeEdgeIds: ["e-src-census", "e-src-estat", "e-src-labor"],
    completedNodeIds: ["api-condition-rate", "condition-rate-service"],
  },
  {
    index: 4,
    title: "独立テーブル準備",
    detail: "T1_age / T2_sex / T3_prefecture / T_municipal_stats をメモリにロード。",
    activeNodeIds: ["t-age", "t-sex", "t-prefecture", "t-municipal"],
    activeEdgeIds: ["e-etl-age", "e-etl-sex", "e-etl-pref", "e-etl-muni"],
    completedNodeIds: ["api-condition-rate", "condition-rate-service", "etl-census"],
  },
  {
    index: 5,
    title: "Phase 1 基盤抽選",
    detail: `P(age) ← T1 (独立分布)
P(sex | age) ← T2_by_age
P(prefecture) ← T3 (独立分布)
P(municipality | prefecture) ← T_municipal_stats`,
    activeNodeIds: ["t-age", "t-sex", "t-prefecture", "t-municipal", "phase1", "cond-sampling"],
    activeEdgeIds: ["e-t1-p1", "e-t2-p1", "e-t3-p1", "e-hub-p1", "e-p1-cs"],
    completedNodeIds: ["api-condition-rate", "condition-rate-service"],
  },
  {
    index: 6,
    title: "Phase 2 デモグラフィック",
    detail: "婚姻・学歴を Conditional Sampling と Municipal Blend で推定。",
    activeNodeIds: ["t-marital", "t-education", "phase2", "municipal-blend"],
    activeEdgeIds: ["e-t4-p2", "e-t5-p2", "e-p2-mb"],
    completedNodeIds: ["phase1", "t-age", "t-sex", "t-prefecture", "cond-sampling"],
  },
  {
    index: 7,
    title: "Phase 3 経済",
    detail: `P(employment | sex, age) ← T7 + T7B fallback → Municipal Blend
P(occupation | emp, sex, edu) ← T11 × Municipal Blend
P(income | hh, age) ← T8 × Municipal Blend`,
    activeNodeIds: [
      "t-employment",
      "t-income",
      "t-occupation",
      "t-municipal",
      "phase3",
      "municipal-blend",
      "fallback-hierarchy",
    ],
    activeEdgeIds: ["e-t6-p3", "e-t8-p3", "e-t11-p3", "e-hub-p3", "e-p3-mb", "e-p3-fb"],
    completedNodeIds: ["phase1", "phase2", "cond-sampling"],
  },
  {
    index: 8,
    title: "Phase 4–5 地理・心理",
    detail: "居住・移動 (Phase 4) と Big5 制約 (Phase 5) を適用。\nbig5.O min 制約で再抽選。",
    activeNodeIds: ["phase4", "phase5"],
    activeEdgeIds: [],
    completedNodeIds: ["phase1", "phase2", "phase3", "municipal-blend"],
  },
  {
    index: 9,
    title: "Fallback Hierarchy",
    detail: "セル件数が閾値未満のとき、市区町村 → 都道府県 → 全国へ階層フォールバック。",
    activeNodeIds: ["fallback-hierarchy", "phase3", "condition-rate-service"],
    activeEdgeIds: ["e-p3-fb", "e-fb-crs"],
    completedNodeIds: ["phase1", "phase2", "phase3"],
  },
  {
    index: 10,
    title: "Phase 6 検証",
    detail: `HARD 57 ルール検査 (違反 → 棄却 + 再生成)
COND 49 ルール (違反 → 該当属性 resample)
SOFT 51 + S-R20 6 ルール (penalty スコア)
(オプション) apply_lpf でキャリブレーション`,
    activeNodeIds: ["phase6", "apply-lpf", "hardcond-rules"],
    activeEdgeIds: ["e-p6-lpf", "e-p6-rules", "e-rules-p6"],
    completedNodeIds: ["phase1", "phase2", "phase3", "phase4", "phase5"],
  },
  {
    index: 11,
    title: "Gen Lambda オーケストレーション",
    detail: "生成経路では Gen Lambda が Phase 結果を束ね JSON persona を組み立てる。\n本フロー (condition-rate) は確率集計パスを優先。",
    activeNodeIds: ["gen-lambda", "cond-sampling", "municipal-blend"],
    activeEdgeIds: ["e-cs-gen", "e-mb-gen"],
    completedNodeIds: ["phase1", "phase2", "phase3", "phase6"],
  },
  {
    index: 12,
    title: "信頼区間 + 推定人口",
    detail: `stderr = √(p(1-p)/N) = √(0.0042×0.9958/10000) ≈ 0.00065
CI95 = [rate ± 1.96·stderr] = [0.30%, 0.54%]
estimated_population = round(0.0042 × 125,000,000) = 525,000 人`,
    activeNodeIds: ["condition-rate-service"],
    activeEdgeIds: ["e-fb-crs", "e-lpf-crs", "e-rules-crs"],
    completedNodeIds: ["phase6", "apply-lpf", "hardcond-rules"],
  },
  {
    index: 13,
    title: "レスポンス組み立て",
    detail: "rate / ci95 / estimated_population / method_used を JSON 化。\ninclude_absolute=true なら絶対人数を同梱。",
    activeNodeIds: ["condition-rate-service", "api-condition-rate"],
    activeEdgeIds: ["e-crs-api"],
    completedNodeIds: ["condition-rate-service"],
  },
  {
    index: 14,
    title: "出力ノードへ配送",
    detail: "条件付き確率 (%) ノードへ結果を書き出し、クライアントへ 200 OK。",
    activeNodeIds: ["api-condition-rate", "out-condition-rate"],
    activeEdgeIds: ["e-api-cr-out"],
    completedNodeIds: ["condition-rate-service", "api-condition-rate"],
  },
  {
    index: 15,
    title: "フロー完了",
    detail: "全 Phase と API パスが完了。再生ボタンで最初から再実行可能。",
    activeNodeIds: [
      "api-condition-rate",
      "condition-rate-service",
      "phase1",
      "phase3",
      "phase6",
      "out-condition-rate",
    ],
    activeEdgeIds: ["e-crs-api", "e-api-cr-out", "e-p1-cs", "e-p3-mb"],
    completedNodeIds: NODES.map((n) => n.id),
  },
];

export const WORLD = { width: 1780, height: 740 };
export const STEP_INTERVAL_MS = 2200;
export const TITLE = "条件付き確率 生成パイプライン";
export const SUBTITLE = "原典データ → ETL → 確率テーブル → サンプリング → API → 条件付き確率 (%)";
