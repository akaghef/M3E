# Decision Pool

会話や作業中に出た判断を、正式文書に昇格する前にためる場所。
新しい項目を上に追加する。

---

## 2026-04-02-001

- Date: 2026-04-02
- Topic: Linear <-> Tree 変換を scope 基準で設計する
- Status: working-agreement
- Decision: 正本は Tree のまま維持し、Linear は入出力インターフェースとして扱う。既定の変換単位は `currentScopeId` の部分木とし、L1（インデント）を可逆優先、L2（Markdown）を準可逆として段階導入する。
- Why: 入力速度を上げつつ、主構造（親子）と認知境界（scope）を壊さないため
- Next: L1 export/import の最小実装と round-trip テストを追加する
- Source: 2026-04-02 の Linear/Tree 変換ビジョン確認
- Promoted: [../03_Spec/Linear_Tree_Conversion.md](../03_Spec/Linear_Tree_Conversion.md)

## 2026-03-30-004

- Date: 2026-03-30
- Topic: MVP テストレイヤーと CI 段階導入方針の運用基準化
- Status: working-agreement
- Decision: MVP 期間は Test and CI/CD Guide を基準として、Model/SaveLoad/Layout-HitTest を優先しつつ CI Stage A を先行導入する
- Why: 操作品質の検証とデータ安全性の検証を分離して運用し、壊れ込みの早期検知を可能にするため
- Next: Stage A の最小 CI ジョブを実装し、PR 前ゲートを運用に組み込む
- Source: このスレッドでのテスト/CICD 文書拡充依頼
- Promoted: [Test_and_CICD_Guide.md](./Test_and_CICD_Guide.md)

## 2026-03-30-003

- Date: 2026-03-30
- Topic: Freeplane-first から独自描画エンジン方針へ転換
- Status: accepted
- Decision: Freeplane は参考実装および `.mm` 互換入力形式として扱い、描画エンジンと操作系は M3E 側で自作する
- Why: M3E 固有の研究思考支援 UI は Freeplane の外側の補助レイヤーではなく、表示と操作の設計そのものに宿るため
- Next: MVP 定義、方針文書、ADR を独自描画前提へ更新する
- Source: このスレッドでの方針転換の会話
- Promoted: [../09_Decisions/ADR_003_Freeplane_Informed_Custom_Engine.md](../09_Decisions/ADR_003_Freeplane_Informed_Custom_Engine.md)

## 2026-03-30-001

- Date: 2026-03-30
- Topic: 会話ベースの決定を集約する文書運用を先に作る
- Status: accepted
- Decision: 会話で出た決定や仮決めは、まず `06_Operations/Decision_Pool.md` に記録してから、必要に応じて `Spec` `Architecture` `ADR` へ昇格させる
- Why: 開発初期は会話量に対して正式文書化が追いつきにくく、決定の散逸と重複が起こりやすいため
- Next: 以後の会話判断はこのプールへ記録し、反映先ができたら `Promoted` を更新する
- Source: このスレッドでの運用方針決定
- Promoted: [Documentation_Rules.md](./Documentation_Rules.md)

## 2026-03-30-002

- Date: 2026-03-30
- Topic: SVG を先に使う方針
- Status: working-agreement
- Decision: MVP 立ち上げでは SVG を優先候補とし、レイアウト・モデル・描画を分離した構成で進める
- Why: 初期実装速度と UI デバッグ容易性を優先しつつ、将来の Canvas 移行余地を残すため
- Next: `04_Architecture` 側に描画インターフェースの境界を整理する
- Source: このスレッドでの MVP 実装方針の会話
- Promoted: -
