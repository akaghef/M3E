# Mermaid Parity Checklist

**status**: requirement (akaghef 指定 2026-04-22)
**intent**: M3E graph layer は **最低でも Mermaid 相当の描画能力** を持つこと。Mermaid で書けるものは M3E で書けるべき。

## Why

- Mermaid は graph 表記の de-facto 参考 (plan5.md の `layout 参考` 方針)
- canonical sub-PJ flow は Mermaid で記述されている (`plan6/cycle2/canonical.mmd`)
- M3E で同じ graph が描けなければ、canonical を authoring surface に載せられない

## 最低機能 checklist

### Node

- [ ] rectangular node (labeled)
- [ ] rounded rectangle (stadium)
- [ ] diamond / rhombus (decision / gate)
- [ ] circle (start / end)
- [ ] subroutine (double-border)
- [ ] multi-line label (escape `\n` / `<br>`)
- [ ] font-family / color 任意指定

### Edge

- [ ] directed edge (`-->`)
- [ ] labeled edge (`-- text -->`)
- [ ] dotted / dashed / thick の線種
- [ ] bidirectional (double-headed)
- [ ] self-loop
- [ ] 複数 edge between 同一 pair
- [ ] curved auto-routing

### Layout

- [ ] direction: LR / RL / TD / BT
- [ ] subgraph (grouping with border & label)
- [ ] nested subgraph
- [ ] node / edge collision avoidance (auto-layout)
- [ ] consistent spacing

### Authoring

- [ ] text source → graph (Mermaid code → rendering)
- [ ] graph → text source (export back to Mermaid)
- [ ] live edit (source を直すと描画が即追従)

### Semantics (M3E 側の拡張)

- [ ] edge に type (next / approve / reject / fail / pool / done など) を持てる
- [ ] node に type (action / eval / human_gate / pool / hub / end) を持てる
- [ ] node / edge scope (layer / authority) を持てる
- [ ] state panel (graph 外の共有ステート) を別枠で描ける

## Gate 条件

Plan 6 gate 通過条件 (見た目で判定) に以下を追加:

- canonical `.mmd` を手動読み取りで M3E に写したとき、Mermaid ネイティブ描画と同等以上に読める
- 上記 checklist の 80% 以上を満たす

Plan 7 gate は data model 側で:

- Mermaid で表現できる node / edge の属性が schema に載る
- Mermaid 構文 → M3E graph model の 1:1 変換が可能 (round-trip lossless が目標)

## 非目標

- Mermaid の全シンタックス完全実装 (gantt / pie / sequence 等は対象外)
- Mermaid と完全同一の auto-layout アルゴリズム再現
- Mermaid を runtime semantics の source of truth にすること (layout / notation 参考のみ)

## 参照

- [plan5.md](../plan5.md) — umbrella
- [plan6.md](../plan6.md) — layout track
- [plan7.md](../plan7.md) — data track
- [plan6/cycle2/canonical.mmd](../plan6/cycle2/canonical.mmd)
- [docs/canonical_subpj_flow.md](canonical_subpj_flow.md)
