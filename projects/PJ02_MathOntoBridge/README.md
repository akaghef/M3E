---
pj_id: PJ02
project: MathOntoBridge
date: 2026-04-17
topic: MathOntoBridge — 数学オントロジーサービスの基盤構築
status: active
owner: akaghef
related: plan.md
enum_label: PJ-101
---

# MathOntoBridge

## Vision

M3E 上で **semantic tree**（意味の木）と **syntax tree**（構文の木）の両方を扱い、数学のためのオントロジーサービスの **foundation** を敷くプロジェクト。

このサービスの完成形は PJ02 より遥かに大きい。PJ02 はその基盤だけを作る。PJ02 自体が研究でもある。

### 問題

現在の M3E の木には **edge に情報がない**。親子関係が is-a なのか part-of なのか区別できず、共通のプロトコルなしにはデータ構築のスケール限界が発生する。

### 二つの木

| | Semantic tree | Syntax tree |
|---|---|---|
| 本質 | 概念間の意味関係（is-a, generalizes, dual, motivates...） | 形式化された依存関係（uses, proves） |
| 既存資産 | なし — M3E が作る | mathlib4 Blueprints 等に既存ライブラリあり |
| M3E での対応 | Deep 帯域の edge protocol | Blueprint dep_graph の取込 |
| 担当 | PJ02 コア（Claude + akaghef） | Codex に委任 |

### PJ02 のスコープ

- **In**: edge に意味を載せるプロトコル（edge protocol）の設計と最小実装。semantic tree の基盤
- **In**: syntax tree（Blueprint）の取込インターフェース設計。実装は Codex 委任
- **Out**: 外部オントロジーサービス全接続（arXiv / Wikidata / zbMATH 等）→ 将来の別 PJ
- **Out**: 射影パイプライン（科研費出力）→ PJ-07 Projection
- **Out**: Lean サーバ常駐連携 → 別リポ/プラグイン

## 主成果物

1. **Edge protocol** — 親子 edge と GraphLink の両方に意味を載せる共通プロトコル（edgeType + relationType kind 語彙）
2. **Syntax tree import interface** — mathlib4 Blueprint dep_graph を M3E に流し込むローダの設計（Codex が実装）
3. **既存考察の統合** — [prior_art.md](prior_art.md) に集約した typed_edges / ontology 考察を設計判断に反映

## メタ情報

| 項目 | 値 |
|---|---|
| PJ 名（正規） | `PJ02_MathOntoBridge` |
| 列挙番号（pj-vision-100） | `PJ-101` |
| ブランチ | `prj/02_MathOntoBridge`（dev-beta から分岐） |
| worktree | なし（PJ01 並列回避。段階進行） |
| M3E マップ | DEV map 内 DAG レーンに登録（独立マップは当面作らない） |
| Kickoff | 2026-04-17 |
| ブレスト原典 | [idea/10_io/math_ontology_services/](../../idea/10_io/math_ontology_services/) |
| 実装見積り原典 | [idea/10_io/math_ontology_services/08_implementation_feasibility.md](../../idea/10_io/math_ontology_services/08_implementation_feasibility.md) |

## ドキュメント構成

- [plan.md](plan.md) — Phase 0〜4 実行計画（kind 語彙 / 描画 / フィルタ / importer / 語彙固定）
- [prior_art.md](prior_art.md) — 既存考察の全文集約（typed_edges / ontology_data_structure / 競合調査 / scalable KB vision）
- [blueprint_facets.md](blueprint_facets.md) — Blueprint の色分け、design/implementation facet、scope+alias による相互参照
- [../../idea/10_io/math_ontology_services/](../../idea/10_io/math_ontology_services/) — 事前ブレスト 8 ファイル（01 landscape 〜 08 feasibility）
- [../../backlog/mathlib4-blueprint-overview.md](../../backlog/mathlib4-blueprint-overview.md) — Blueprint 構造と M3E 対応表

## 位置づけ

- **帯域軸**（[docs/01_Vision/Axes.md](../../docs/01_Vision/Axes.md)）: Deep 帯域の実装育成ロードマップ
- **他 PJ との関係**:
  - `PJ-04 InfoGather` と交差（情報集約の外部素材供給源）
  - `PJ-07 Projection` の前提条件（Deep semantic graph が射影の基盤）
  - `PJ-03 DogfoodDeep` と並行（マップ自体を research substrate として使う）
- **project_projection_vision** の素材供給役。科研費・論文出力の Rapid 側テンプレは別 PJ（PJ-07）で扱う

## 役割分担

| 領域 | 人間（akaghef） | Claude | Codex |
|---|---|---|---|
| Edge protocol 設計（edgeType + kind 語彙） | ◎ 最終判断 | 選択肢列挙と仮置き | — |
| Edge protocol 実装（types.ts / viewer） | 方針承認 | ◎ 実装・検証 | — |
| Blueprint 取込設計 | 方針承認 | ◎ インターフェース設計 | — |
| Blueprint 取込実装（dep_graph sync） | — | — | ◎ 委任 |
| Phase 遷移判定 | ◎ | × 勝手に進めない | — |

**Claude が止まって確認すべき境界**: edge protocol の語彙決定 / syntax tree 取込のデータフォーマット / edgeType を既存ノードに遡及付与する戦略。

## 運用ルール（要点）

- **ambiguity は pool**: 未決は reviews/Qn ノードに積み、tentative default で進める
- **Phase 分離**: Phase 0-1 を最小ユニットとして先行完遂、Phase 3 以降は実データを見てから判断
- **PJ02 は foundation**: 完全なサービスは PJ02 の範囲外。基盤が動けば成功
- **研究でもある**: 実装と並行して、edge protocol が数学知識の構造化に有効かを検証する

## Future Work（本 PJ 範囲外 — 将来の別 PJ）

- **外部オントロジーサービス全接続**（arXiv / Wikidata / zbMATH / KAKEN / researchmap）
- **射影パイプライン（科研費出力）** → PJ-07 Projection
- **Lean サーバ常駐連携（P5）** → プラグイン/別リポ
- **Wikidata への書込み（逆方向フロー）**
- **OMDoc 完全採用** → export のみ検討

## 進捗ログ

- 2026-04-17: PJ02 として正式登録、projects/PJ02_MathOntoBridge/ 作成
- 2026-04-17: ビジョン策定 — semantic tree + syntax tree の dual-tree architecture。foundation スコープに絞る。Blueprint 実装は Codex 委任
