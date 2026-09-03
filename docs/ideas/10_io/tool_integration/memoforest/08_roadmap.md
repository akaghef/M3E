# 導入ロードマップ

## Phase 0 — Inventory

- v3 schemaとM3E modelの対応表
- identity / owner / revision / classification
- plan limit / export size / macro constraints
- representative fixtureの選定

## Phase 1 — Manual round-trip

代表1文書を往復し、以下を測る。

- node / section / order保持率
- Markdown / KaTeX / macro再現率
- annotation anchor保持率
- 手動修正数
- round-trip時間

## Phase 2 — Read-only adapter

SourceDescriptor + SourceReadPortで取り込み、空状態から同じmaterializationを再構築する。

## Phase 3 — Proposal write

operation ID、expected revision、diff、approval、journal、read-after-writeを実装する。

## Adoption Gate

自動writeへ進む条件:

1. 継続的な実需がある。
2. manual round-tripより明確に改善する。
3. canonical ownerとclassificationが明示される。
4. stale writeと再送を安全に拒否できる。
5. Rebuild Gate / Recovery Gateを通過する。

## Not now

- realtime collaborationの先行実装
- raw SQLite / Neo4j write
- Memoforestを新しいM3E canonical storeにすること
- Current Strategyへの即時昇格

