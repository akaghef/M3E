# ws / map / region / node naming direction

- 現在の概念階層は `ws > doc > scope > node` と見てよいが、命名が悪い。
- `doc` は M3E の実感に合っておらず、仕様語としては `map` を優先したい。
- `scope` は「見える範囲を制御する」意味では合っているが、`folder` と曖昧になっている。
- `folder` は node type、`scope` は可視範囲制御概念、といったん分けて扱う。
- 構造説明としては `region` のほうが強い。
  - 「region を階層的に管理する」と言えば、階層構造そのものの説明になる。
  - したがって構造説明の基準語は `region` を優先候補にする。
- 当面の用語方針:
  - 概念階層は `ws > map > region > node`
  - 実装上の `docId` / `scopeId` はすぐには消さない
  - 仕様・会話では `map` を優先
  - `scope` は現行語として残すが、再整理対象として明記する

関連する論点:

- `workspaceId` は現状、保存先を機械的に決める SSOT ではなく表示ラベル寄り。
- 保存先の決定は `M3E_DATA_DIR` と `M3E_DB_FILE` に寄っている。
- 将来的には `workspaceId -> 保存先` を機械的に解決できる設計に寄せたい。
- `channel` と `data profile` は workspace 階層とは別軸で整理する。

次の変更候補:

- `Glossary.md` に `workspace`, `map`, `region`, `channel`, `data profile` を追加
- `Data_Runtime_Layout.md` を `channel / data profile / workspace` の三者分離で再記述
- `scope` と `folder` の責務分離を spec に明文化

*2026-04-15*
