# Write Safety

map 書き込みで最優先するのは、指示された操作以外への副作用を作らないこと。

## 原則

```text
指示: node text を変更する
許可: 該当 node の text だけ
禁止: collapsed / children / parentId / links / selection / viewport / 他node
```

API が full-state POST 中心でも、agent 側は許可された差分だけを作る。

## 保存前チェック

- 変更対象 node id
- 変更対象 field
- semantic diff
- view diff
- unrelated node diff

想定外の view diff や unrelated node diff がある場合は保存しない。

## View State

明示指示なしに変更しない。

- collapsed
- selected node
- current scope
- viewport x/y
- zoom
- panel open/closed
- active tool
