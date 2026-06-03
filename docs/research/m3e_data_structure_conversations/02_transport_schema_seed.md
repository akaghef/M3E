# M3E Transport Schema Seed

通信側だけを先に固めるための seed。正本 schema ではなく、LLM / agent と M3E runtime の境界 DTO として扱う。

## M3E.Context.v1

LLMへ渡す読み取り用 packet。

```text
format: M3E.Context.v1
map: <map_id>
scope: <scope_id>
base: <model_hash_or_revision>
dict:
  k: kind
  pol: polarity
  dep: dependability
  st: status
  conf: confidence
nodes[n]{id,k,label,core,attrs?}:
  n0,folder,Root,0x0000000000000000,-
tree[n]{parent,child,order}:
  n0,n1,0
links[n]{source,target,type,attrs?}:
  n1,n2,depends_on,-
attrs[n]{target,key,type,value}:
  n1,dep,u4,5
```

原則: parent/depth/order のような構造情報は `tree` 側に置く。ノード属性へ重複させない。

## M3E.Command.v1

LLM / agent から返す mutation packet。Context全体を書き戻させない。

```text
format: M3E.Command.v1
base: <model_hash_or_revision>
ops[n]{op,id,args}:
  set_attr,n1,key=pol;type=i4;value=2
  add_node,n3,parent=n1;order=1;kind=text;label=New idea
  move_node,n2,parent=n3;order=0
```

必須ルール:

- `base` が一致しない場合は apply 前に conflict とする
- op は idempotent に寄せる
- alias/scope/循環制約は command 生成側ではなく Model.apply 側が最終責任を持つ
- repair 可能なものは report に明示する

## M3E.Report.v1

Apply結果。人間確認・agent再試行・ログ保存に使う。

```text
format: M3E.Report.v1
base: <old_revision>
head: <new_revision>
status: applied|partial|rejected
applied[n]{op,id,result}:
  set_attr,n1,ok
rejected[n]{op,id,reason}:
  move_node,n2,cycle_detected
repairs[n]{op,id,repair}:
  add_node,n3,renamed_duplicate_label
diff[n]{kind,id,summary}:
  attr,n1,pol changed 0->2
```

## 通信面の設計判断

JSONは正確だがLLM入力としてはトークンが重い。TOON風 format は Context には適するが、正本化すると検証・migration・差分更新が壊れやすい。

したがって標準境界は `Context projection -> Command patch -> Validate/Repair -> Model.apply -> Report` とする。
