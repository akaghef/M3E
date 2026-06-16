---
project: MathOntoBridge
date: 2026-04-17
topic: MathOntoBridge — Deep 帯域の GraphLink 多種エッジ化と外部オントロジー取込
status: active
owner: akaghef
kickoff: 2026-04-17
related: README.md
---

# MathOntoBridge — 実行計画

> M3E の **Deep 帯域**（関係線 GraphLink）を多種 kind エッジで育て、外部オントロジー（Blueprint / Stacks / Wikidata 等）を流入可能にし、射影（科研費方向）の substrate を作る。

## TL;DR

- **何を作る**: `GraphLink.relationType` を kind 語彙として正式運用 + kind 別描画 + 外部取込 importer
- **同時に何を検証する**: M3E は Deep 帯域の「個人研究者用 semantic graph 編集環境」として立てるか
- **いつ**: Phase 0-1 は数日、全 Phase で 〜2 週間想定（実施は逐次判断）
- **最小実証**: Phase 0 + Phase 1 + Phase 3 手動先行 = 0.5 人週で価値検証可能

---

## Phase 構成

原典: [idea/10_io/math_ontology_services/08_implementation_feasibility.md](../../idea/10_io/math_ontology_services/08_implementation_feasibility.md)

| Phase | 行数 | 期間 | 帯域的役割 | 推し度 |
|---|---|---|---|---|
| 0. kind 語彙の受け皿 | 〜30 | 半日 | Deep の GraphLink 仕様を明確化 | ⭐⭐⭐ |
| 1. kind 別レンダリング | 〜150 | 1-2日 | Deep 関係線の可視化強化 | ⭐⭐⭐ |
| 2. kind フィルタ UI | 〜200 | 2-3日 | Deep の焦点切替 / 射影前処理 | ⭐⭐ |
| 3. 外部 Deep 取込 importer | 〜250 | 3-5日 | 体系化（Rapid→Deep）の外部素材供給 | ⭐⭐ |
| 4. kind 語彙固定 & UX | 〜300 | 1週間 | 射影（Deep→Rapid）のテンプレ駆動 | ⭐（慎重） |

合計 〜930 行 / 〜2週間。Phase 0-1 で Deep 帯域の表現力が実質開通。

---

## Phase 0: kind 語彙の受け皿（半日）

### 変更点

- 新設: `beta/src/shared/relation_kinds.ts` — 推奨 kind 定数集
  ```typescript
  export const RELATION_KINDS = {
    USES: "uses",
    GENERALIZES: "generalizes",
    DUAL: "dual",
    EXAMPLE_OF: "example_of",
    MOTIVATES: "motivates",
    ANALOGOUS: "analogous",
    CONTRADICTS: "contradicts",
    PRECEDES: "precedes",
    SEE_ALSO: "see_also",
  } as const;
  ```
- [beta/src/node/rapid_mvp.ts](../../beta/src/node/rapid_mvp.ts) の `_normalizeLink()` で未指定時のデフォルト挙動を定義
- Glossary に語彙登録

### 既存エッジの扱い

- `relationType === undefined` はそのままランタイムで `"unknown"` 扱い、マイグレーション不要

### 完了条件

- `relation_kinds.ts` が beta ビルドを壊さず入る
- Glossary に語彙表が記載される
- テストは既存を壊さないこと（新規テスト不要）

### リスク

- ほぼゼロ（nullable 追加のみ）

---

## Phase 1: kind 別レンダリング（1-2 日）

### 変更点

- [beta/src/browser/viewer.tuning.ts](../../beta/src/browser/viewer.tuning.ts) に kind → 色・線種マップ追加
- [beta/src/browser/viewer.ts](../../beta/src/browser/viewer.ts) のエッジ描画ループで `link.relationType` に応じて style 引く
- [beta/viewer.css](../../beta/viewer.css) に `.graph-link-kind-<name>` クラス

### 色相ルール仮

- `uses`: 灰・細・dashed（痩せた Deep の印）
- 意味系（generalizes/dual/example_of/motivates）: 暖色系・実線
- `contradicts`: 赤・太
- `see_also`: 薄灰

### 完了条件

- 手動で 2-3 種類の kind を持つ GraphLink を作ると視覚的に区別できる
- 既存の relationType 未指定リンクはフォールバック表示で壊れない

### 判断事項

- 未知 kind（自由文字列）のフォールバック表示ルール
- 親子 edge（Rapid 骨格）との視覚的区別は既存維持

---

## Phase 2: kind フィルタ UI（2-3 日）

### 変更点

- `beta/src/browser/viewer.ts` に `isLinkVisibleByKind(link)` 追加、描画ループで可視性判定
- `ViewState` に `linkKindFilter: string[] | "all" | "semantic_only" | "uses_only"` 追加
- キーボードショートカット割当（例: `Shift+E` 循環、`Shift+U` uses トグル）
- ステータスバーに現在フィルタ表示

### 完了条件

- uses だけ / 意味系だけ / 全て を切り替えて描画が変わる
- フィルタ状態がセッション内で保持される

### 判断事項

- フィルタ永続化の範囲（session / workspace / 永続）
- importance / scope フィルタとの合成ルール

---

## Phase 3: 外部 Deep 取込 importer（3-5 日）

### 変更点

- 新設: `beta/src/node/deep_importer.ts`
- 入力フォーマット仮決め:
  - Blueprint `dep_graph.json`
  - 簡易 `{nodes: [{id, label}], edges: [{from, to, kind?}]}` の自作 JSON
  - Stacks Project tag 依存
- 処理:
  1. 外部 ID と既存ノードの照合・新規作成
  2. 外部 ID はノード `attributes` に保持（`lean4_decl`, `stacks_tag`, `blueprint_label` 等）
  3. エッジは `relationType: "uses", direction: "forward"` で一括追加
  4. `(from, to, relationType)` で dedup
- [beta/src/node/rapid_mvp.ts](../../beta/src/node/rapid_mvp.ts) に `importDeep(source, data)` メソッド
- CLI / IPC 起動（当面 UI なし）

### 完了条件

- Stacks Project 第 1 章の補題 30 個 + 依存関係が M3E に入り、Phase 1 の kind 描画で見える

### 判断事項

- **名寄せポリシー**: label 完全一致 / fuzzy / ユーザ確認 / AI 補助
- **取込単位**: プロジェクト全体 / 部分木 / 個別ノード
- **ライセンス表示**: CC-BY-SA の継承情報をノード属性に保持

### リスク

- Blueprint フォーマットの標準化なし → 最初は JSON スキーマ経由のみ
- 大規模取込時の viewer パフォーマンス（PFR: 数百、Stacks: 数千）

---

## Phase 4: kind 語彙の固定と UX 整備（1 週間）

### 変更点

- kind 語彙の正式決定（未決 Q13、以下 4 案）:
  - 案 a: SKOS 準拠 3 種（broader/narrower/related）
  - 案 b: M3E 独自固定 10 種
  - 案 c: 自由文字列 + AI 分類
  - 案 d: 両対応（固定デフォルト + 自由入力）
- エッジ作成時の kind 選択 UI（ドロップダウン / キー入力）
- kind ごとのデフォルト方向（generalizes: 矢印 / analogous: 双方向 等）
- 既存エッジへの kind 後付け UI（一括 / 個別）
- Glossary 正式登録

### 完了条件

- 新規エッジ作成時に kind を選択できる
- 既存エッジに後付けで kind を付与できる
- 射影テンプレ（科研費方向）の kind 駆動章立てが 1 パターン動作する

### リスク

- kind 増加による UX 複雑化
- 既存エッジ遡及付与の手間
- 判断ミス蓄積（誤 kind のエッジ）

---

## 運用メモ

### runtime 正本

- PJ02 の実行開始点は `PJ02 Runtime` の 3-view runtime とする
  - `Progress Board`
  - `Review`
  - `Active Workspace`
- `/sub-pj start` 相当では、README / plan.md に加えて runtime を読む
- runtime を使わない opt-out は採らない
- `次フェーズへ` は runtime 上の readiness を見たうえで人間が出す

### ambiguity pool（未決論点、Qn ノードへ）

- **Q1.** M3E は独自ハブか、Wikidata/MaRDI クライアントか
- **Q2.** 外部 ID は 1 対 1（canonical）か多対多（複数リンク）か
- **Q13.** kind 語彙の決定（Phase 4 で最終化）
- **Q14.** syntax と semantic の同時表示 / 切替
- **Q15.** 既存エッジの二層化マイグレーション戦略

全 Q 一覧は [idea/10_io/math_ontology_services/07_m3e_connection.md](../../idea/10_io/math_ontology_services/07_m3e_connection.md) 参照。

### Phase 遷移判定

- Phase 0 → 1: ビルド通過 + Glossary 追記確認
- Phase 1 → 2: 手動検証で kind 描画が機能
- Phase 2 → 3: フィルタ UX が馴染む（1週間触る）
- Phase 3 → 4: 実データ取込で価値を体感 + Q13 判断材料が揃う

各遷移はユーザ判断ゲート。Claude 独断では進めない。

### 進捗ログ

- 2026-04-17: PJ02 正式登録、plan.md 初版（08_implementation_feasibility.md から整理）
- 2026-04-29: T-1-1 / T-1-2 として implementation facet contract と timeseries facet contract を `idea/00_meta/display_contracts/` に追加。T-1-3 go-signal criteria を pending に戻した。
