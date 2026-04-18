# Phase 4: Complete — PJ 完了・振り返り

PJ の振り返りを行い、教訓を蓄積して PJ をクローズする。

## いつ入るか

- 全 Phase 完了時
- 「振り返り」「反省」「retrospective」
- `/sub-pj retro`
- PJ の意図的な中断決定時

## フロー

```
1. PJ の進捗ログと成果物を振り返る
2. 個別反省を projects/PJ{NN}_{Name}/retrospective.md に書く
3. 一般化できる教訓を projects/retrospective_general.md に抽出
4. protocol.md への昇格候補があれば提案（実施はユーザー判断）
5. PJ をクローズ（status 更新、表の更新）
```

## 振り返り観点

- **うまくいったこと**: 再利用可能なパターン
- **手戻り・詰まり**: 原因と対策ルール
- **ビジョンとのズレ**: スコープの過不足
- **M3E 機能要求**: dogfood 由来の発見

## retrospective.md テンプレート

```markdown
# PJ{NN}_{Name} — 振り返り

## うまくいったこと

- {パターン1}

## 手戻り・詰まり

### {タイトル}
- **状況**: {何が起きたか}
- **原因**: {なぜ起きたか}
- **対策ルール**: {次回から守るルール}
- **一般化可能?**: Yes / No

## ビジョンとのズレ

- {ズレ1}

## M3E 機能要求（dogfood）

- {機能要求1}
```

## 一般化の基準

`projects/retrospective_general.md` に抽出するのは:
- 他の PJ でも起きうるパターン
- PJ 固有のドメイン知識を含まない教訓

`protocol.md` に昇格するのは:
- **2 回以上の PJ で確認されたパターンのみ**
- ユーザー承認後に改訂

## PJ クローズ処理

振り返り完了後:

1. README の `status` を `done` に変更
2. `backlog/meta-subpj-candidates.md` の表を更新
3. protocol.md への昇格候補をユーザーに提案