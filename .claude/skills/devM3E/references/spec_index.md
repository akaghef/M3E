# Spec Index

M3E仕様文書への索引。実装時に参照すべきspecを素早く特定するために使う。

## 文書一覧

| 文書 | パス | 対象領域 |
|------|------|---------|
| Data Model | `dev-docs/03_Spec/Data_Model.md` | ノード型、ID体系、属性、不変条件 |
| Scope & Alias | `dev-docs/03_Spec/Scope_and_Alias.md` | スコープ境界、エイリアス、フォルダノード |
| Scope Transition | `dev-docs/03_Spec/Scope_Transition.md` | スコープ間ナビゲーション |
| Command Language | `dev-docs/03_Spec/Command_Language.md` | 編集コマンド体系 |
| AI Common API | `dev-docs/03_Spec/AI_Common_API.md` | AIサブエージェントAPI仕様 |
| REST API | `dev-docs/03_Spec/REST_API.md` | HTTP API全エンドポイント |
| Linear↔Tree | `dev-docs/03_Spec/Linear_Tree_Conversion.md` | リスト⇔ツリー相互変換 |
| Keybindings | `dev-docs/03_Spec/Keybindings_Beta.md` | キーバインド定義 |
| Actions | `dev-docs/03_Spec/Actions_Beta.md` | アクション定義 |

## 不変条件（頻出）

- 各ノードは1つのscopeに属する（runtime derived, not persisted per node）
- alias → alias のチェーンは禁止
- folder ノードが子スコープのエントリポイント
- Commandパターン経由でのみ状態変更（undo/redo保証）
- persistedId はドキュメント内で一意
