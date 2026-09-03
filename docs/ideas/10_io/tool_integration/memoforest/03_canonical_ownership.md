# Canonical ownership境界

## Principle

- Git等のsource systemはbytes / content / historyを所有する。
- Memoforestは人間の局所編集状態、読解順、annotationを所有する。
- M3E Semantic Coreはstable identity、authority、invariant、approval/conflict policy、write routingを所有する。
- Neo4j等のgraph storeは、source-owned recordについてmaterializationであり、普遍的なcanonical ownerではない。

## Proposed identity

外部node identityは`sourceId + localEntityId`を基本とする。Memoforest内部node IDをrepo-wide identityへ単独昇格させない。

```json
{
  "sourceId": "memoforest-local:<installation-or-export-scope>",
  "localEntityId": "<project-id>/<node-id>",
  "sourceRevision": "<export digest or revision>",
  "referentialState": "resolved"
}
```

## Write route

```text
Memoforest edit
  → export / proposed patch
  → normalize as graph operation
  → Semantic Command
  → AuthorityResolver
  → canonical owner adapter
  → journal
  → read-after-write
  → materialized M3E view
```

## Rejected

- Memoforest JSONをM3E全体の第二正本にする。
- M3E SQLiteへ外部toolが直接writeする。
- Neo4jへraw Cypher writeし、owner routingを迂回する。
- pathや本文copyをartifact identityとして扱う。

