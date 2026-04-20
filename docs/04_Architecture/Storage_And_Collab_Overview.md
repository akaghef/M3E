# Storage & Collab — アーキテクチャ概観

最終更新: 2026-04-20

Home.md から分離した、保存モード / ローカルファイル連携 / Collab の層構造まとめ。
詳細仕様は `../03_Spec/` 配下の各ファイルに委ねる。

---

## 保存モード

| モード                     | 主用途                                 | 正本               | UI 上の位置づけ            |
| -------------------------- | -------------------------------------- | ------------------ | -------------------------- |
| Standalone                 | 通常利用、M3E 単体編集                 | SQLite             | 既定モード                 |
| Import / Export            | 単発の取り込み・書き出し               | 実行後は各側で独立 | 普段の UI のユーティリティ |
| ローカルファイル連携モード | Obsidian / Markdown フォルダとの強結合 | `.md`               | 明示的に開始する別モード   |

- `Import / Export` は変換操作であり、ライブ同期や `.md` 正本を意味しない
- `ローカルファイル連携モード` を名乗る場合のみ、`.md` を正本として watch / write-back / conflict policy を有効にする

詳細: [../03_Spec/local_file_integration.md](../03_Spec/local_file_integration.md), [../03_Spec/Import_Export.md](../03_Spec/Import_Export.md)

---

## ローカルファイル連携モード（強結合）

```
.md ファイル（唯一の正本）
    ↕ read/write
FileBinding Layer
    ↕ cache
SQLite（インデックス/キャッシュ）
    ↕ push/pull
Supabase（リモート同期）
```

- .md 保存 = commit（確定）。staging なし
- SQLite はインデックスに過ぎない。壊れても .md から再構築できる
- Cloud Sync は SQLite キャッシュ経由（CS-2 方式）
- 普段の `Import / Export` はこのモードに含めない。単発変換として扱う

詳細: [../03_Spec/Cloud_Sync.md](../03_Spec/Cloud_Sync.md), [../03_Spec/Obsidian_Vault_Integration.md](../03_Spec/Obsidian_Vault_Integration.md)

---

## Collab（リアルタイム共同編集）

- ユーザー間の **序列（priority）** が核心。単なるリアルタイム同期ではない
- 戦略は 5 種: Priority Cascade / Auto Merge / Branch Isolate / Last Write Wins / Manual Resolve
- scope 単位でのロック・共有

詳細: [../03_Spec/Team_Collaboration.md](../03_Spec/Team_Collaboration.md), [../03_Spec/Cloud_Sync_Conflict_Resolution.md](../03_Spec/Cloud_Sync_Conflict_Resolution.md)
