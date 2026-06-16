# Handoff: Resource 概念の設計

- AssignedTo: subagent
- AssignedAt: 2026-04-08T19:00:00+09:00
- Branch: dev-beta
- Priority: P2
- AssignedPC: any

## Task

M3E に「Resource」概念を導入する。
Resource とは **時間・お金・人数** など、プロジェクトが消費する資源を
マインドマップ上で集中管理し、ノード間で整合性を保つ仕組みである。

### 設計で決めること

1. **データモデル**: Resource をノード属性として持たせるか、専用エンティティにするか
   - Resource の型定義 (time / money / headcount / custom)
   - 各ノードへの紐付け方法 (attributes 拡張 or 別テーブル)
   - 集計ロジック (子→親へのロールアップ、上限チェック)
2. **整合性ルール**: 親の予算を子が超えたら警告? 自動調整?
   - 競合検出 (同一 Resource を複数ノードが取り合う場合)
   - Collab/Cloud Sync との整合
3. **UI/UX 方針**: Resource の表示・編集フロー
   - ノード上のバッジ / サイドパネル / 専用ビュー
   - Resource 一覧ダッシュボード
4. **マップ上の位置付け**: strategy/Resource スコープ配下のサブノード構成
   - 現在 Time Management / Budget・Cost / Headcount・Roles / Capacity Planning を仮置き
   - 最適なスコープ構成を再検討

### 参考: strategy 配下の既存スコープ

- Collaboration & Sync
- AI Integration
- Data & Import/Export
- Scope & Structure
- Rendering & UX
- Infrastructure
- Bugs
- **Resource** (新規追加済み)

## Spec References

- マップデータ構造: `beta/src/shared/` 配下の型定義
- 既存 attributes の仕組み: ノードの `attributes` フィールド
- strategy マップ: `tmp_map.json` → `n_res_1775645677276_1` (Resource ノード)

## Acceptance Criteria

- [ ] `docs/03_Spec/Resource_Design.md` に設計仕様書を作成
- [ ] データモデル案 (型定義の TypeScript インターフェース案を含む)
- [ ] 整合性ルールの定義
- [ ] UI/UX ワイヤーフレーム (テキストベース可)
- [ ] strategy マップのサブノード構成の最終案
- [ ] 実装フェーズのタスク分割案 (data / visual / shared の担当別)

## Notes

- これは **設計フェーズ** のみ。実装は設計レビュー後に着手する
- 既存の attributes 拡張で足りるか、専用モデルが必要かの判断が最重要
- MVP スコープに入れる最小機能と将来拡張の線引きを明確にすること

## Completion

タスク完了時:
1. 担当ブランチに commit + push
2. `/pr-beta` で dev-beta への PR を作成
3. このファイルの Acceptance Criteria にチェックを入れる
