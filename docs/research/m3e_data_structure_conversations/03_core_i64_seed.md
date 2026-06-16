# core_i64 Seed

SQLiteの1列を固定フォーマット領域として使う案の seed。目的は、頻出する小さな semantic fields を JSON/attrs の文字列ノイズから逃がすこと。

## 原則

`core_i64` に入れるのは、構造から導けず、頻出し、enum / small int として安定して扱える値だけ。

入れないもの:

- `parent`: tree/edge から明らか
- `depth`: tree projection で計算できる
- `children_count`: cacheで十分
- 長い text / label
- 実験的属性

入れる候補:

- node kind
- polarity
- status
- priority
- dependability
- confidence
- scope role
- visibility
- source kind
- lock state

## bit lane seed

まだ正式決定ではない。通信・保存の議論用に固定幅の候補を置く。

| bits | field | width | note |
|---:|---|---:|---|
| 0-3 | node_kind | 4 | text/folder/alias/image/etc |
| 4-7 | polarity | 4 | positive/negative/neutral/conflict/etc |
| 8-11 | status | 4 | draft/active/resolved/archived/etc |
| 12-15 | priority | 4 | 0-15 |
| 16-19 | dependability | 4 | 0-15 |
| 20-23 | confidence | 4 | 0-15 |
| 24-27 | scope_role | 4 | root/local/external/bridge/etc |
| 28-31 | visibility | 4 | hidden/normal/pinned/focused/etc |
| 32-35 | source_kind | 4 | human/ai/import/api/etc |
| 36-39 | lock_state | 4 | unlocked/read_only/system/etc |
| 40-47 | flags | 8 | booleans |
| 48-55 | core_schema | 8 | bit layout version |
| 56-63 | reserved | 8 | migration reserve |

## DTOとの対応

`core_i64` は通信時にそのまま出してもよいが、LLMには `dict` で展開可能にする。

```text
nodes[n]{id,k,label,core}:
  n1,text,Claim,0x0102030405060708
attrs[n]{target,key,type,value}:
  n1,comment,str,needs proof
```

人間・LLMに意味を読ませる必要があるときは projection 側で展開する。

```text
facets[n]{id,pol,dep,st,conf}:
  n1,neg,12,draft,9
```

## 判断

この設計は「全部 JSON に書く」より通信ノイズが少なく、「全部 bit pack に入れる」より拡張性を保てる。M3Eの探索・表示・LLM制御で頻出する semantic surface だけを固定領域にするのが要点。
