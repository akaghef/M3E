# 連携方式

## A. Manual JSON round-trip

最初の推奨。export、manifest付与、検証、proposal importを人間が明示実行する。境界と損失が見え、誤同期のblast radiusが小さい。

## B. Read-only Source Adapter

M3EがMemoforest exportを`SourceReadPort`として読み、source-owned recordをmaterializeする。元データは変更しない。

## C. Proposal Write Adapter

Memoforest側の差分をgraph operationへ変換し、Semantic Commandとしてcanonical ownerへ提案する。

必須field:

- stable target
- operation intent
- base revision
- operation ID
- provenance
- requesting principal

## D. Bidirectional realtime sync

現時点では保留。最低でもthree-way merge、offline queue、tombstone、entity version、idempotency、Recovery Gateが必要。

## Recommended sequence

```text
A: manual round-trip
  → B: read-only adapter
  → C: proposal write
  → D: realtime（Demand Gate通過時のみ）
```

WebSocketは更新通知に限定し、通知payloadを正本にしない。通知後にrevision付きreadを行う。

