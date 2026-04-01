# Decision Pool

会話や作業中に出た判断を、正式文書に昇格する前にためる場所。
新しい項目を上に追加する。

---

## 2026-04-01-003

- Date: 2026-04-01
- Topic: graph-level `Link` の Beta 実装前提仕様
- Status: working-agreement
- Decision: `Link` は `Edge` と別の overlay relation として `AppState.links` に保持し、node-level `link` 文字列とは分離する。`Link` は layout に参加せず、source/target node ID を参照し、broken endpoint を含む状態は保存時に拒否する。
- Why: 構造木と非木関係線を混同せず、将来の relation line 実装を最小データ構造から始められるようにするため
- Next: `03_Spec/Data_Model.md` と import/export 境界文書へ graph-level `Link` の型と保存制約を追加する
- Source: このスレッドでの `Link` 実装状況確認と仕様追記依頼
- Promoted: [../03_Spec/Data_Model.md](../03_Spec/Data_Model.md), [../03_Spec/Import_Export.md](../03_Spec/Import_Export.md)

## 2026-04-01-002

- Date: 2026-04-01
- Topic: `scope` / `alias` 仕様の訂正
- Status: working-agreement
- Decision: target 実体 delete は alias 残存を理由に拒否せず、alias 側を broken 状態へ遷移させて表示名を `元の名前 (deleted)` とする。alias には write 権限設定を持てるようにし、同一 scope 内 alias も許可する。
- Why: delete を過度に阻害せず参照喪失を分かりやすく残し、将来の alias 経由編集や同一 scope 内参照の用途を塞がないため
- Next: `03_Spec/Scope_and_Alias.md` の delete / 権限 / 同一 scope 制約を訂正し、Beta model での最小表現に落とす
- Source: このスレッドでの仕様修正指示
- Promoted: [../03_Spec/Scope_and_Alias.md](../03_Spec/Scope_and_Alias.md)

## 2026-04-01-001

- Date: 2026-04-01
- Topic: `scope` と `alias` の Beta 実装前提仕様
- Status: working-agreement
- Decision: `folder` は子 scope の入口ノードとして扱い、実体ノードは単一 scope 所属、他 scope からの再利用は `alias` 経由のみとする。`alias` は read-only 参照ノードで、`alias -> alias` は禁止し、対象実体の削除は alias 解消前は拒否する。
- Why: 認知境界を UI とモデルの両方で一貫して扱い、複製による整合崩壊と削除事故を防ぐため
- Next: `03_Spec/Scope_and_Alias.md` を Beta 実装に使える粒度へ拡張し、後続で model/save-load への反映単位を切り出す
- Source: このスレッドでの `scope` / `alias` 仕様整理依頼
- Promoted: [../03_Spec/Scope_and_Alias.md](../03_Spec/Scope_and_Alias.md)

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
