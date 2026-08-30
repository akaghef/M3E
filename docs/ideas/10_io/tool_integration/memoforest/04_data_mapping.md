# データ対応と変換損失

## Mapping

| Memoforest | M3E candidate | Notes |
|---|---|---|
| project | mapまたはartifact portal | source descriptorとrevisionが必要 |
| node.topic | node text / label | 外部IDを別属性で保持 |
| node.parentId | Rapid edge / spine | tree orderを保持 |
| section | Markdown body facet | section IDを局所IDとして保持 |
| annotation | annotation facet / provenance | quote、context、section IDが必要 |
| folder | source-side grouping | M3E scopeと自動同一視しない |
| LaTeX macros | rendering metadata | semantic entityではない |

## Missing from plain v3

- canonical owner / write authority
- source revision / export digest
- classification
- approval state
- operation journal
- cross-source stable identity
- M3E GraphLink / typed relation

## Envelope proposal

v3本体を独自拡張せず、sidecar manifestへ次を置く。

```json
{
  "schema": "m3e-external-artifact-manifest-v1",
  "mediaType": "application/vnd.memoforest.annotator-qa-export+json;version=3",
  "sourceId": "memoforest-local:example",
  "artifactId": "memoforest-project:example",
  "revision": "sha256:<digest>",
  "classification": "public-safe",
  "exportedAt": "<RFC3339>"
}
```

## Required validation

- duplicate ID / reserved internal root
- missing parent / self reference / cycle
- section ID / title / content type
- annotation quote and anchor validity
- node / section counts
- deterministic digest
- undefined LaTeX macro and renderer compatibility

