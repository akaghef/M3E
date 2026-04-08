# Handoff: Cloud Sync 競合UI改善

- AssignedTo: codex1
- AssignedAt: 2026-04-08T11:45:00
- Branch: dev-beta-visual
- Priority: P2
- AssignedPC: any

## Task

Cloud Sync で競合 (conflict) が発生した際の UI を改善する。
現在は "Cloud: conflict" バッジと use-local / use-cloud ボタンがあるだけで、
ユーザーは何が競合しているか分からないまま選択を迫られる。

改善内容:
1. 競合時にローカル版とクラウド版の差分サマリーを表示する
2. ノード単位で「どこが違うか」を視覚的に示す（追加/変更/削除のハイライト）
3. use-local / use-cloud の選択を確認ダイアログ化する（誤クリック防止）

## Spec References

- `dev-docs/03_Spec/Cloud_Sync.md`（競合とみなす条件、競合解決ポリシー）
- `dev-docs/03_Spec/REST_API.md`（Cloud Sync API セクション）
- `beta/src/browser/viewer.ts`（cloudSync 関連コード、L47-51, L118-121, L197-260, L3137-3260）

## Acceptance Criteria

- [ ] 競合発生時、変更ノード数・主な変更内容のサマリーが表示される
- [ ] use-local / use-cloud クリック時に確認ダイアログが出る
- [ ] 通常の push/pull フロー（非競合時）に影響しない
- [ ] `npm --prefix beta run build` pass
- [ ] 該当テスト pass

## Notes

- 現在の Cloud Sync は file-mirror 方式（document 全体）。scope 単位の差分はまだ未実装
- diff サマリーはクライアント側で JSON diff を取る形で十分（サーバー変更不要）
- ヒアリングセッションで詳細を詰めてから着手すること

## Completion

タスク完了時:
1. 担当ブランチに commit + push
2. `/pr-beta` で dev-beta への PR を作成
3. このファイルの Acceptance Criteria にチェックを入れる
