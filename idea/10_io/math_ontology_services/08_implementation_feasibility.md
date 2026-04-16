# 08. 実装レベルでの取込可能性検討

ブレスト全般は「採否を決めない」前提だが、**P8 二層エッジモデル** だけ
ユーザ要望で実装コストを事前見積もりした分析メモ。
この文書は「何が可能か」を並べるのみ。**実装決定はしない**。

## 出発点: M3E 側の現状（2026-04-16 時点 beta）

### 現在の `GraphLink` 型（[beta/src/shared/types.ts:25-33](beta/src/shared/types.ts#L25-L33)）

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

## Phase 0: 属性だけ用意する（〜50 行, 半日）

**「データ型を広げるだけ」**。UI は変わらない。将来拡張の地ならし。

### 変更点

- [beta/src/shared/types.ts:25-33](beta/src/shared/types.ts#L25-L33) `GraphLink` に 2 フィールド追加:
  ```typescript
  layer?: "syntactic" | "semantic";  // 未指定は "semantic" 扱い
  kind?: string;                      // relationType と重複するなら統合検討
  ```
- [beta/src/node/rapid_mvp.ts:99-107](beta/src/node/rapid_mvp.ts#L99-L107) の `_normalizeLink()` で未指定時デフォルトを `"semantic"` に
- [beta/src/node/rapid_mvp.ts:326-354](beta/src/node/rapid_mvp.ts#L326-L354) `addLink()` に options として `layer` / `kind` を渡せるよう拡張

### 既存エッジの扱い

- 既存リンク（1000 件程度を想定）は `layer === undefined` → ランタイムでは `"semantic"` にフォールバック
- マイグレーション不要

### 得られる機能

- API レベルで層を指定して追加できるようになる（UI は未対応）
- 外部スクリプトで layer 付きエッジを作成・照会可能

### リスク

- ほぼゼロ。既存コード経路に変更なし（nullable 追加のみ）

---

## Phase 1: レンダリング差別化（〜150 行, 1〜2 日）

**syntactic 層のエッジを見た目で区別**。グレー・細線・ドット等。

### 変更点

- [beta/src/browser/viewer.tuning.ts:49-52](beta/src/browser/viewer.tuning.ts#L49-L52) に色パレット追加:
  ```typescript
  syntacticEdgeColors: ["#bbb", "#aaa", "#999"]  // ミュート系
  ```
- [beta/src/browser/viewer.ts:2876-2936](beta/src/browser/viewer.ts#L2876-L2936) のエッジ描画ループに分岐:
  - `link.layer === "syntactic"` なら syntacticEdgeColors パレットと細線・dasharray
  - 既定（semantic）は従来通り
- [beta/viewer.css](beta/viewer.css) に `.graph-link-syntactic` クラス定義
- 矢印マーカーも専用（控えめな三角）を 1 種追加

### 得られる機能

- 「syntax 層のエッジ」と「semantic 層のエッジ」が一目で見分かる
- 同一ノードに両層が刺さっていても視覚的混乱が少ない

### 判断事項

- 色相を変えるか、彩度を落とすか（semantic は派手、syntactic は地味）
- semantic の色は `kind` ごとに色相を変えるか、統一するか
  - 統一なら実装早い、kind 別なら kind 語彙の決定（Q13）が先行必要

### リスク

- 既存エッジは全て semantic 扱いになるので見た目は変わらない
- 将来 Blueprint 取込時にグレー多数で「汚く見える」懸念 → Phase 2 のフィルタ前提で設計

---

## Phase 2: 層フィルタ UI（〜200 行, 2〜3 日）

**キー操作で「semantic だけ」「syntax だけ」「両方」を切替**。

### 変更点

- [beta/src/browser/viewer.ts:2020-2025 付近](beta/src/browser/viewer.ts#L2020) の `isNodeVisibleByImportance` と同系列で `isLinkVisibleByLayer(link)` を追加
- エッジ描画ループ（viewer.ts:2890）の可視性判定に加える:
  ```typescript
  if (!isLinkVisibleByLayer(link)) return;
  ```
- `ViewState` に `linkLayerFilter: "all" | "semantic" | "syntactic"` を追加
- キーボードショートカット（例: `Shift+E` で循環切替）
- ステータスバーにインジケーター表示（現在何を表示中か）

### 得られる機能

- Blueprint を大量取込みした後でも、semantic 層だけで自分の思考を見る
- syntax 層だけ見て「形式化で詰まっている箇所」を観察

### 関連する既存パターン

- `cleanup mode` や `scope` 切替と同じ UX モデルなので、ユーザの学習負荷低
- [idea/30_ux/keyboard_modes/](../../30_ux/keyboard_modes/) のキーバインド方針と整合

### リスク

- フィルタ状態の永続化をどうするか（session / workspace / 永続）
- 他のフィルタ（importance / scope）との合成時のユーザ混乱

---

## Phase 3: Blueprint importer（〜250 行, 3〜5 日）

**外部 DAG（Blueprint / Stacks / 自作 JSON）を syntactic エッジとして取込**。

### 変更点

- 新ファイル: `beta/src/node/blueprint_importer.ts`
- 入力フォーマット仮決め:
  - Blueprint `dep_graph.json`（実在、LaTeX から plastex が生成）
  - 簡易 `{nodes: [{id, label}], edges: [{from, to, kind?}]}` の自作 JSON
- 処理:
  1. 外部ID（Blueprint の label）と既存ノードの照合・新規ノード作成
  2. エッジを `layer: "syntactic", kind: "uses", direction: "forward"` で一括追加
  3. 既存 syntactic エッジとの重複回避（`(from, to, layer, kind)` で dedup）
- [beta/src/node/rapid_mvp.ts](beta/src/node/rapid_mvp.ts) に `importDag()` メソッド追加
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

## Phase 4: semantic 種別語彙の本格化（〜300 行, 1 週間）

**semantic 層のエッジに「種別 (kind)」を UI レベルで導入**。ここは意見が分かれる領域。

### 変更点

- kind 語彙の決定（未決 Q13）。以下 4 案:
  - 案 a: SKOS 準拠 3 種（broader / narrower / related）
  - 案 b: M3E 独自固定 10 種
  - 案 c: 自由文字列 + AI 分類
  - 案 d: 両対応（固定デフォルト + 自由入力）
- エッジ作成時に kind 選択 UI（ドロップダウン / キー入力）
- kind ごとの色・矢印形状
- kind 別フィルタ（Phase 2 の拡張）
- エッジ作成時のデフォルト kind 設定
- 既存エッジへの kind 後付け（一括 or 個別）

### 得られる機能

- 「A は B の一般化」「A は B の双対」を形式的に記録
- kind 別のマップ表示（「一般化関係だけ見る」「反例関係だけ見る」）
- 論文生成（B1）時に kind 情報を使って文章テンプレ変化

### リスク

- kind を増やしすぎると UX が複雑化
- 既存エッジに kind を遡及付与する手間
- 判断ミスの蓄積（誤った kind のエッジが増える）

---

## フェーズ比較表

| Phase | 行数 | 期間 | 既存ユーザへの影響 | 外部接続可能性 | 推し度 |
|---|---|---|---|---|---|
| 0. 属性追加のみ | 〜50 | 半日 | なし | データだけ | ⭐⭐⭐（即やって損なし） |
| 1. 描画差別化 | 〜150 | 1-2日 | 軽微（層指定なければ変化なし） | Phase 0 補完 | ⭐⭐⭐ |
| 2. 層フィルタ | 〜200 | 2-3日 | キー操作 1 つ増える | Blueprint 大量取込に必須 | ⭐⭐ |
| 3. Blueprint importer | 〜250 | 3-5日 | なし（独立機能） | 外部 DAG 取込開通 | ⭐⭐ |
| 4. semantic 種別語彙 | 〜300 | 1週間 | 大（UI 変化） | L3/L4 本格対応 | ⭐（慎重） |

**合計**: 〜950 行 / 〜2週間（連続作業ベース）。
ただし **Phase 0-1 だけでも P8 の本質は実現できる**。Phase 3 以降は独立に検討可能。

## 取り込まない選択肢（or 後回しでよいもの）

- **MMT / OMDoc の内部表現採用** — 完全に OMDoc に寄せると書き手負担が重い。**見送り or export のみ**
- **Lean サーバ常駐連携（P5）** — 環境構築コスト高、ユーザ裾野が狭い。**プラグイン/オプションで別リポに**
- **Wikidata SPARQL を毎回叩く設計** — ネットワーク依存強すぎ。**キャッシュ前提 / バッチ取込に**
- **semantic kind を無制限自由文字列にする** — 汚れる。**Phase 4 で決めるまで "uses" / "related" の 2 種で様子見**
- **Blueprint HTML パース** — フォーマット変動大。**JSON dep_graph のみ対応が現実的**

## 最小で始める提案（全て推し・決定ではない）

もし何も始めないより何か始めたいなら、**Phase 0 + Phase 1 の組** が最小ユニット:

1. `GraphLink` に `layer` 追加（Phase 0）
2. syntactic 用の地味パレット追加（Phase 1）
3. Stacks Project の 1 部分木（例: 第 1 章の補題 30 個）を手動 JSON 変換して import テスト

これで **「M3E は semantic graph の住人、syntax graph を受け入れて描ける」** というコア主張を
0.5 人週の投資で実証できる。Phase 2 以降は実データを見てから判断するのが筋。

## 実装前に確認したい未決

- [07 Q13] semantic kind 語彙の決定（Phase 4 に直結）
- [07 Q14] 同時表示 vs 切替（Phase 2 の UX）
- [07 Q15] 既存エッジのマイグレーション（Phase 0 時点でどう扱うか）
- **Q16（新）**: `relationType` と `kind` フィールドの重複をどう扱うか（統合 / 棲み分け / 一方を deprecate）
- **Q17（新）**: 層フィルタ状態の永続性スコープ（viewer session / workspace / 永続設定）
- **Q18（新）**: Phase 3 の初期ターゲット外部 DAG は何にするか（PFR Blueprint / Stacks / 自作 JSON）

## 横断観察

- **既存コードは驚くほど P8 に寛容** — `relationType` が既に自由文字列で、`attributes` が自由 key-value
- **Phase 0 と Phase 1 の実装コストは極めて低い**（半日〜2日）ので、試行段階として非常に現実的
- **Blueprint import（Phase 3）はデータ次第** — まず小さい JSON で試し、Blueprint 直接対応は後回しが良い
- **Phase 4 は UX 設計が重い** — ブレストを別途立てて詳細化すべき領域
- 層フィルタは [idea/30_ux/keyboard_modes/](../../30_ux/keyboard_modes/) の「モード」概念の拡張として自然に馴染む
