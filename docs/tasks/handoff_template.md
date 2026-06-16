# Handoff: {TOPIC}

- AssignedTo: {codex1 | codex2 | subagent | akaghef}
- AssignedAt: {ISO 8601}
- Branch: {dev-visual | dev-data | feature branch}
- Priority: {P1-P5}
- AssignedPC: {hostname | any}

## Task

{タスクの説明。何を実装/修正/調査するか。}

## Spec References

- {関連する spec ファイルパス、例: `docs/03_Spec/Linear_Tree_Conversion.md`}

## Acceptance Criteria

- [ ] {検証可能な完了条件1}
- [ ] {検証可能な完了条件2}
- [ ] `npm --prefix beta run build` pass
- [ ] 該当テスト pass

## Notes

{追加コンテキスト、注意事項、既知の制約}

## Completion

タスク完了時:
1. 担当ブランチに commit + push
2. `/pr-beta` で dev-beta への PR を作成
3. このファイルの Acceptance Criteria にチェックを入れる
