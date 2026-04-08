# Version Registry

リリースタグとデータスキーマバージョンの対応表。
launch-final 実行時に更新する。

## タグ ↔ Data Schema 対応

| タグ | data schema | 日付 | 主な変更 |
|------|-------------|------|---------|
| v260402 | v1 | 2026-04-02 | 初回リリース |
| v260402-2 | v1 | 2026-04-02 | 同日修正 |
| v260403 | v1 | 2026-04-03 | graph link, variable-height layout |
| v260403-2 | v1 | 2026-04-03 | wheel normalization, meta panel |
| v260403-3 | v1 | 2026-04-03 | compact layout, BroadcastChannel |
| v260408 | v1 | 2026-04-08 | launch-final 拡張, タグ規則明文化 |
| v260408-2 | v1 | 2026-04-08 | Agent Teams, skill 整備 |
| v260408-3 | v1 | 2026-04-08 | collab, IME composition, linear text, Resource spec |

## Data Schema Version 履歴

| schema | 導入タグ | 変更内容 |
|--------|---------|---------|
| v1 | v260402 | 初版。nodes, links (optional) |

## 注意

- schema version が変わる場合は migration script を用意すること
- ADR_006 で Resource 追加時の version 方針を検討中
