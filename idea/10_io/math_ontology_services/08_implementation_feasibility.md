# 08. 実装レベルでの取込可能性検討

ブレスト全般は「採否を決めない」前提だが、**P8（Deep 帯域の GraphLink を多種エッジ化して育てる）** だけ
ユーザ要望で実装コストを事前見積もりした分析メモ。
この文書は「何が可能か」を並べるのみ。**実装決定はしない**。

## 枠組みの再整理（帯域軸）

[01_landscape.md](01_landscape.md) / [Axes.md](../../../docs/01_Vision/Axes.md) / [Glossary](../../../docs/00_Home/Glossary.md) より:

- **Rapid**: 文書 1 つ = syntax tree。親子 `edge` で表現（M3E 既存中心）
- **Deep**: 文書群 = semantic graph。関係線 `GraphLink` で表現（既に芽はある）
- **Blueprint 等の外部 DAG**: Deep の「uses 1 種に痩せた形」。GraphLink 側へ流入
- **P8 実装課題**: GraphLink を多種エッジで育て、体系化（Rapid→Deep）と射影（Deep→Rapid）の土台を作る

つまり Phase 0-4 は **「Deep 帯域の実装を育てるロードマップ」** として読み直す。

## 出発点: M3E 側の現状（2026-04-16 時点 beta）

### 現在の `GraphLink` 型（[beta/src/shared/types.ts:25-33](../../../beta/src/shared/types.ts#L25-L33)）

```typescript
interface GraphLink {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationType?: string;     // 既に自由文字列で関係種別が持てる
  label?: string;
  direction?: "none" | "forward" | "backward" | "both";
  style?: "default" | "dashed" | "soft" | "emphasis";
}
```

### 現在の `TreeNode` 型（抜粋）

```typescript
interface TreeNode {
  id: string;
  parentId: string | null;
  children: string[];
  text: string;
  attributes: Record<string, string>;  // 任意の外部 ID をここに詰められる
  // ...
}
```

### 重要な既存インフラ

- `GraphLink.relationType` は既に **semantic kind を入れる箱** として使える（自由文字列）
- `TreeNode.attributes` は **外部 ID 格納庫** として既に自由に使える（`wikidata_qid`, `lean4_decl`, `msc` 等を即入れられる）
- エッジ描画は per-edge style（direction / dasharray / class / color パレット）で既に差し替え可能
- 可視性フィルタ（scope / importance）のパターンが既にあり、**エッジ層フィルタに拡張しやすい**
- SQLite 永続化は加算的スキーマに寛容

## 取込可能性の結論

**全体として「高くフィージブル」**。
アーキテクチャ的障害なし、追加のみで既存機能を壊さず段階導入可能。
フル導入まで凡そ **4 段階 / 合計 ~600-900 行変更** の見積もり。

以下に段階ごとのコスト見積もりと、各段階で得られる機能を並べる。

---

## Phase 0: kind 語彙の受け皿を作る（〜30 行, 半日）

**「既存 `GraphLink.relationType` を Deep 帯域の kind として正式運用する」**。型変更は最小。

### 変更点

- [beta/src/shared/types.ts:25-33](../../../beta/src/shared/types.ts#L25-L33) は **変更不要**（`relationType?: string` を kind として使う）
- [beta/src/shared/relation_kinds.ts](../../../beta/src/shared/) 新設 — 推奨 kind 定数集:
  ```typescript
  export const RELATION_KINDS = {
    USES: "uses",                    // 痩せた Deep から流入
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
- [beta/src/node/rapid_mvp.ts:99-107](../../../beta/src/node/rapid_mvp.ts#L99-L107) の `_normalizeLink()` で `relationType` 未指定時のデフォルトを `"see_also"` 程度に
- Glossary の「semantic graph」項目に kind 語彙を明記

### 既存エッジの扱い

- 既存リンクは `relationType === undefined` → ランタイムで `"see_also"` にフォールバック、または `"unknown"` 扱い
- 後から見直して kind を付ける運用、マイグレーションスクリプト不要

### 得られる機能

- API レベルで層を指定して追加できるようになる（UI は未対応）
- 外部スクリプトで layer 付きエッジを作成・照会可能

### リスク

- ほぼゼロ。既存コード経路に変更なし（nullable 追加のみ）

---

## Phase 1: kind 別レンダリング（〜150 行, 1〜2 日）

**GraphLink の `relationType` ごとに色・線種を変える**。`uses` は地味（痩せた Deep の印）、意味系は派手。

### 変更点

- [beta/src/browser/viewer.tuning.ts:49-52](../../../beta/src/browser/viewer.tuning.ts#L49-L52) に kind → 色のマップ追加:
  ```typescript
  relationKindStyles: {
    uses:         { color: "#aaa", width: 1.0, dasharray: "2,2" },  // 痩せた Deep
    generalizes:  { color: "#2a7", width: 1.5 },                     // 意味系
    dual:         { color: "#a72", width: 1.5 },
    example_of:   { color: "#27a", width: 1.2 },
    motivates:    { color: "#a2a", width: 1.5, dasharray: "5,3" },
    analogous:    { color: "#888", width: 1.2, dasharray: "3,3" },
    contradicts:  { color: "#c33", width: 2.0 },
    see_also:     { color: "#999", width: 1.0 },
  }
  ```
- [beta/src/browser/viewer.ts:2876-2936](../../../beta/src/browser/viewer.ts#L2876-L2936) のエッジ描画ループで `link.relationType` に応じた style を引く
- [beta/viewer.css](../../../beta/viewer.css) に `.graph-link-kind-<name>` クラス定義

### 得られる機能

- Deep 関係線の kind が一目で見分かる
- Blueprint 等の uses が地味に入るので、意味系が埋もれない

### 判断事項

- 親子 edge（Rapid 骨格）との視覚的区別は既に確保済み（既存スタイル維持）
- kind ごとの色相ルール（semantic 系は暖色 / uses は灰 等）
- 未知 kind（自由文字列）のフォールバック表示

### リスク

- 既存エッジは `relationType` 未設定なら灰色見た目 → 地味だが問題なし
- kind が増えすぎた時の視覚負荷 → Phase 2 のフィルタで解決

---

## Phase 2: kind フィルタ UI（〜200 行, 2〜3 日）

**キー操作で「uses だけ」「意味系だけ」「全て」「特定 kind だけ」を切替**。

### 変更点

- [beta/src/browser/viewer.ts:2020-2025 付近](../../../beta/src/browser/viewer.ts#L2020) の `isNodeVisibleByImportance` と同系列で `isLinkVisibleByKind(link)` を追加
- エッジ描画ループ（viewer.ts:2890）の可視性判定に加える
- `ViewState` に `linkKindFilter: string[] | "all" | "semantic_only" | "uses_only"` を追加
- キーボードショートカット（例: `Shift+E` で循環、`Shift+U` で uses トグル）
- ステータスバーに現在のフィルタ表示

### 得られる機能

- Blueprint を大量取込みした後でも、意味系の関係線だけで Deep を見る
- uses だけ見て「形式化依存の骨格」を観察
- 射影（Deep→Rapid）時に「引用関係だけ抽出」等の前処理にも使える

### 関連する既存パターン

- `cleanup mode` や `scope` 切替と同じ UX モデルなので、ユーザの学習負荷低
- [idea/30_ux/keyboard_modes/](../../30_ux/keyboard_modes/) のキーバインド方針と整合

### リスク

- フィルタ状態の永続化をどうするか（session / workspace / 永続）
- 他のフィルタ（importance / scope）との合成時のユーザ混乱

---

## Phase 3: 外部 Deep 取込 importer（〜250 行, 3〜5 日）

**外部 DAG（Blueprint / Stacks / 自作 JSON）を Deep の痩せた関係線として取込**。
= 体系化（Rapid→Deep）の外部素材供給ルート。

### 変更点

- 新ファイル: `beta/src/node/deep_importer.ts`（`blueprint_importer.ts` より汎用名）
- 入力フォーマット仮決め:
  - Blueprint `dep_graph.json`（LaTeX から plastex が生成）
  - 簡易 `{nodes: [{id, label}], edges: [{from, to, kind?}]}` の自作 JSON
  - Stacks Project の tag 依存（同系統）
- 処理:
  1. 外部 ID（Blueprint の label / Stacks tag）と既存ノードの照合・新規ノード作成
  2. 外部 ID はノード `attributes` に保持（`lean4_decl`, `stacks_tag`, `blueprint_label` 等）
  3. エッジは `relationType: "uses", direction: "forward"` で一括追加
  4. 重複回避（`(from, to, relationType)` で dedup）
- [beta/src/node/rapid_mvp.ts](../../../beta/src/node/rapid_mvp.ts) に `importDeep(source, data)` メソッド追加
- CLI or IPC 経由で起動（当面 UI なし）

### 得られる機能

- PFR Blueprint や Stacks Project の tag DAG を数分で M3E に流し込める
- 既存ノートノードと重なる部分は自動名寄せ（ラベル一致 or 外部 ID 属性一致）

### 判断事項

- **名寄せポリシー**: label 完全一致 / fuzzy / ユーザ確認ダイアログ / AI 補助
- **取込単位**: プロジェクト全体 / 部分木 / 個別ノード
- **ライセンス表示**: Blueprint は通常 CC-BY-SA、ノード属性に license 情報を残す

### リスク

- Blueprint フォーマットは標準化されておらず、プロジェクトごとに微差
  → 最初は「JSON スキーマに従った素朴な取込」だけで、Blueprint 直接パースは後回しが現実的
- 大規模（PFR は数百ノード、Stacks は数千）で viewer 側のパフォーマンス懸念
  → [idea/40_data/performance_scale/](../../40_data/performance_scale/) と接続

---

## Phase 4: kind 語彙の固定と UX 整備（〜300 行, 1 週間）

**Phase 0 で仮置きした語彙を固定 / UI に落とす**。ここは意見が分かれる領域、射影（Deep→Rapid）を見据えた設計が必要。

### 変更点

- kind 語彙の正式決定（未決 Q13）。以下 4 案:
  - 案 a: SKOS 準拠 3 種（broader / narrower / related）
  - 案 b: M3E 独自固定 10 種（Phase 0 で仮置いたもの）
  - 案 c: 自由文字列 + AI 分類
  - 案 d: 両対応（固定デフォルト + 自由入力）
- エッジ作成時に kind 選択 UI（ドロップダウン / キー入力）
- kind ごとのデフォルト方向（generalizes は矢印あり / analogous は双方向 等）
- 既存エッジへの kind 後付け（一括 or 個別）
- Glossary に語彙を正式登録

### 得られる機能（射影と直結）

- 「A は B の一般化」「A は B の双対」を形式的に記録
- kind 別のマップ表示（「一般化関係だけ見る」「反例関係だけ見る」）
- **射影時のテンプレ分岐**: 科研費射影で「背景 = generalizes / motivates を先行紹介」「手法 = uses で依存順」「新規性 = contradicts や未解決を強調」といった kind 駆動の章立て生成が可能

### リスク

- kind を増やしすぎると UX が複雑化
- 既存エッジに kind を遡及付与する手間
- 判断ミスの蓄積（誤った kind のエッジが増える）
- 語彙の国際化（日本語ラベル ↔ SKOS @en）

---

## フェーズ比較表

| Phase | 行数 | 期間 | 帯域的役割 | 推し度 |
|---|---|---|---|---|
| 0. kind 語彙の受け皿 | 〜30 | 半日 | Deep の GraphLink 仕様を明確化 | ⭐⭐⭐ |
| 1. kind 別レンダリング | 〜150 | 1-2日 | Deep 関係線の可視化強化 | ⭐⭐⭐ |
| 2. kind フィルタ | 〜200 | 2-3日 | Deep の焦点切替 / 射影前処理 | ⭐⭐ |
| 3. 外部 Deep 取込 | 〜250 | 3-5日 | 体系化（Rapid→Deep）の外部素材供給 | ⭐⭐ |
| 4. kind 語彙固定 & UX | 〜300 | 1週間 | 射影（Deep→Rapid）のテンプレ駆動 | ⭐（慎重） |

**合計**: 〜930 行 / 〜2週間。
**Phase 0-1 だけで Deep 帯域の表現力が実質開通**。Phase 3 で外部素材流入、Phase 4 で射影への橋渡し。

## 取り込まない選択肢（or 後回しでよいもの）

- **MMT / OMDoc の内部表現採用** — 完全に OMDoc に寄せると書き手負担が重い。**見送り or export のみ**
- **Lean サーバ常駐連携（P5）** — 環境構築コスト高、ユーザ裾野が狭い。**プラグイン/オプションで別リポに**
- **Wikidata SPARQL を毎回叩く設計** — ネットワーク依存強すぎ。**キャッシュ前提 / バッチ取込に**
- **semantic kind を無制限自由文字列にする** — 汚れる。**Phase 4 で決めるまで "uses" / "related" の 2 種で様子見**
- **Blueprint HTML パース** — フォーマット変動大。**JSON dep_graph のみ対応が現実的**

## 最小で始める提案（全て推し・決定ではない）

もし何も始めないより何か始めたいなら、**Phase 0 + Phase 1 の組** が最小ユニット:

1. `relation_kinds.ts` を新設、Glossary に語彙登録（Phase 0）
2. kind 別の色・線種を viewer.tuning に追加（Phase 1）
3. Stacks Project の 1 部分木（例: 第 1 章の補題 30 個）を手動 JSON 変換して import テスト（Phase 3 の手動先行）

これで **「M3E の Deep 帯域が多種エッジの semantic graph として機能する」** というコア主張を
0.5 人週の投資で実証できる。Phase 2 以降は実データを見てから判断するのが筋。

## 帯域軸との整合チェック

Axes.md 非目標リストとの照合:

- ❌ 帯域を 4 つ以上に増やさない → P8 は Deep 内部の成熟、新帯域追加なし ✓
- ❌ 独立複数軸に分解しない → Rapid/Deep は単一進化軸として扱う。syntax/semantic を直交軸として扱わない ✓
- ❌ 帯域ごとに別アプリに分けない → 同じ M3E 内、edge と GraphLink の既存二分を利用 ✓
- ❌ Flash を Rapid 素材置き場に縮退させない → P8 は Flash に触れない ✓

## 実装前に確認したい未決

- [07 Q13] semantic kind 語彙の決定（Phase 4 に直結）
- [07 Q14] 同時表示 vs 切替（Phase 2 の UX）
- [07 Q15] 既存エッジのマイグレーション（Phase 0 時点でどう扱うか）
- **Q16（新）**: `relationType` と `kind` フィールドの重複をどう扱うか（統合 / 棲み分け / 一方を deprecate）
- **Q17（新）**: 層フィルタ状態の永続性スコープ（viewer session / workspace / 永続設定）
- **Q18（新）**: Phase 3 の初期ターゲット外部 DAG は何にするか（PFR Blueprint / Stacks / 自作 JSON）

## 横断観察

- **既存コードは驚くほど P8 に寛容** — `GraphLink.relationType` が既に自由文字列で、`TreeNode.attributes` が自由 key-value。**型追加すら不要**で Phase 0 が成立
- **帯域軸で再整理したことで、「新概念追加」から「既存の Deep 芽を育てる」に位置付けが変わった** — 実装者に対しても説明しやすい
- **Phase 0-1 の実装コストは極めて低い**（半日〜2日）ので、試行段階として非常に現実的
- **Phase 3 の外部 Deep 取込は体系化の外部素材供給ルート** — Rapid→Deep 往復の上流を開通させる戦略的価値
- **Phase 4 は射影（Deep→Rapid）と直結** — kind 情報を使った章立てテンプレが project_projection_vision の科研費生成で鍵になる可能性
- kind フィルタは [idea/30_ux/keyboard_modes/](../../30_ux/keyboard_modes/) の「モード」概念の拡張として自然に馴染む
- [idea/40_data/maintenance_hygiene/](../../40_data/maintenance_hygiene/) の重複検出（D1）と semantic kind は相性良 — 同じ対象に複数の kind エッジが刺さる整理で検出材料が増える
