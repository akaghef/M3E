# Repository-local semantic source specimen

Phase 1 の read-only file adapter を検証する portable fixture。

このdirectory名とJSON serializationは **specimenであり正規配置ではない**。`.m3e/`、Neo4j schema、write adapterを確定しない。

## Files

- `revision-001.json`: rename前のsource revision
- `revision-002-renamed.json`: document path変更後。`sourceId` / local IDは維持し、`lastIndexedRevision`で前revisionを示す

fixtureは数学ontologyを最初の検証対象として、D3の数学構造と`SPECIALIZES` relation、およびtransform + provenance付きで選択されたD2 trendを含む。

## Agent / CI check

```bash
cd beta
npm run semantic-source:check
```

validatorはJSON Linesで結果を返し、不正schema、unresolved local reference、unsafe path、direct write capability、未選択D2などを非zero exitで拒否する。
