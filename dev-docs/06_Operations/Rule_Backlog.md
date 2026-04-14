# Rule_Backlog

正式ルール化する前の草案プール。思いつきを捨てずに貯める場所。
合意したら `*_Rules.md` に昇格、不要と判断したら削除。

最終更新: 2026-04-15

---

## 運用ルール

- 細かいルール草案はここに箇条書きで追記（フォーマット自由）
- 1項目1行〜数行。深掘りは別ファイルでやる
- 合意済みルールは `Documentation_Rules.md` / `Commit_Message_Rules.md` / 新規 `*_Rules.md` に昇格して**ここから削除**
- 却下されたものは削除（履歴は git に残る）

---

## 草案プール

### ドキュメント運用

- dev-docs 直下には `.md` を置かない（カテゴリフォルダ必須）
- 新語は `00_Home/Glossary.md` 登録を経てから skill / doc に持ち込む
- `ideas/` の古い命名違反ファイルは次のリファクタ時に日付付きにリネーム or `legacy/` 送り

### CI / 通知

- CI 失敗通知が多すぎる → 段階的に通知対象を絞る（詳細は別途）
- 壊れたまま放置されている CI ステップを洗い出す
- 不要な CI ジョブを削除（どれが不要かは別途調査）

### コード命名

- `RapidMvpModel` → `RapidModel` リネーム（別 PR で実施、30+呼び出し元修正）
- `_mvp` suffix を持つテストファイルも同時リネーム

### レビュー方法

- reviews/Qn へのリアクション語彙: `good` / `bad` / `explain-more` / `rethink`（詳細は後日）
- `selected="yes"` 付与後の `decisions/` 移送タイミング
- batch review のサイクル（定時？件数ベース？）

### 開発導線

- Feature Flow（Split → Plan Fan-out → Human Select → Assign+Gates → Sub-loops）の具体手順
- ゲート解放を誰が監視するか（Manager ポーリング？ event push？）
- `design_doc` attribute 登録義務の強制

### その他

- `02_Strategy/` 復活の要否（今は削除済み）
- `ADR_004_SQLite_For_Rapid_MVP.md` のファイル名 — 歴史記録として維持 or 改名
