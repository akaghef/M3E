# M3E × Codex App Server — Scope-aware Copilot

更新: 2026-07-12  
状態: 会話ログからの設計整理。確定事項と将来案を分離する。

## 目的

M3E の map を操作面かつ正本として維持し、その背後で Codex App Server（CAS）が scope-aware な常駐知能として働く状態を作る。Progressive Navigation（PN）は、この知能を呼び出す操作面の一つである。

## 今回確認できたこと

- M3E の PN 操作から `codex app-server --stdio` の `thread/start` / `turn/start` を実行し、提案を map へ反映できる。
- CAS の `threadId` / `turnId` を生成 node の provenance として保存できる。
- Mapify fixture や固定ローカル生成を使わず、CAS の実 turn で生成できる。
- 現在の PR #72 は、操作ごとに CAS process と thread を作って終了する on-demand 実装であり、常駐化はまだ行っていない。

## 確定した設計判断

### Host と正本

- M3E が host であり、map / scope / viewer / SQLite / operation command を所有する。
- CAS は M3E の子 server（常駐 sidecar）として扱う。
- CAS thread は cache であり、正本ではない。map が唯一の正本である。
- CAS が停止しても、M3E は通常の map editor として利用できる。

### AI Mode

```text
AI Mode OFF
└─ CAS停止。通常のmap編集のみ。

AI Mode ON
└─ M3E host
   └─ 常駐CAS子server
      └─ userが開いているscopeを追跡
         ├─ contextをprewarm/cache
         ├─変更差分を監視
         ├─操作候補をBGで検討
         └─user操作時に提案
```

- 「常に考えるが、勝手に書かない」を基本境界とする。
- scope 移動時に context を prewarm する。
- node 選択時に PN 候補を background で準備する。
- map 更新時は debounce し、revision が古い候補を破棄する。
- map への commit は user の選択または明示 approval 後だけ行う。
- thread の基本 key は `workspaceId + mapId + scopeId` とする。
- 複数 tab では focused tab の scope を active context とする。

想定状態:

```text
OFF / WARMING / WATCHING / THINKING / READY / STALE / ERROR
```

## Context 表現

### 今回の PN

単純な scope の階層・粒度・局所派生には MF-H を使う。AppState JSON を丸ごと prompt へ渡さない。

```text
# test1
## 動物
### 哺乳類
#### ヒト
#### イヌ
#### クジラ
```

理由:

- MF-H は階層の token 効率がよい。
- JSON の反復 key、空 field、ID、style attribute は、局所的な意味生成にはノイズが多い。
- map API の正本レスポンスは JSON のまま維持し、CAS 入力時に deterministic に MF-H へ射影する。

### JSON へ昇格する条件

次を正確に扱う場合は JSON または同等の構造表現へ昇格する。

- node ID による厳密な書き戻し
- alias / GraphLink / 非木構造
- 複数 scope
- metadata を判断材料として使う操作
- field-level mutation
- 複雑な validation

## PN 生成パターン

CAS に自由な木生成をさせず、現在 scope から MF-H completion template を機械生成し、生成対象だけを `???` にする。

```text
# ヒト
## ???
## ???
## ???
## ???
```

CAS は既存 scope を書き換えず、slot だけを埋める。response は小さい構造化 JSON とし、操作ごとの relation を検証してから map へ適用する。

```json
{
  "children": [
    { "text": "...", "relation": "example_of" }
  ]
}
```

## 操作契約

今回の PR では prompt 内の最小契約と relation 検証まで行う。将来は N3〜N6 を YAML 正本へ分離する。

```yaml
operation: N4.examples
target: selected_node
input_projection: mf-h
slots:
  count: 4
  relation: example_of
constraints:
  fill_slots_only: true
  preserve_existing: true
  forbid:
    - property
    - definition
    - classification
    - paraphrase
```

YAML は意味契約、MF-H は構造 template、CAS は穴埋め、M3E は validation と commit を担当する。

## 失敗から得たこと

`ヒト` に N3 / N4 を実行した際、次のような不整合が発生した。

- `身体の構造 / 生命維持機能 / 感覚と運動` のように、N3 と分類・構成要素が混ざった。
- N4 で `二足歩行する霊長類 / 言語を使う動物` のように、具体例ではなく特徴・言い換えが生成された。
- context JSON を増やしても、操作の意味契約が弱ければ品質は上がらなかった。
- `preserve sibling granularity` のような一般指示だけでは、親子 edge の意味を決められなかった。

結論: context の量ではなく、操作ごとの relation、禁止事項、slot、validation が必要である。

## 未決事項

- `N4.examples` で抽象概念の instance を何とみなすか。曖昧時に clarification を返す契約。
- `N6.related` を tree child として保存するか、GraphLink にするか。
- YAML contract の配置、schema、versioning。
- background turn の費用・頻度・cancel policy。
- thread 再利用時の compaction、TTL、最大 cache 数。
- MF-H から JSON へ昇格する complexity threshold。

## PR #72 の境界

含む:

- M3E PN から実 CAS turn を実行する経路
- CAS provenance の保存
- scope の MF-H 射影
- `???` completion template
- N3〜N6 の最小 action contract と relation 検証
- API / build / 実 CAS dry-run の検証

含まない:

- AI Mode UI
- CAS process の常駐化
- scope watcher / background generation
- YAML contract runtime
- thread cache

