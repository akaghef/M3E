# M3E Design Semantic Source

この directory は、M3E repository の設計 corpus を Phase 1 の `specimen-v1`
semantic source package として置く暫定配置である。

- Package: `m3e-design.source.json`
- Schema: `m3e.semantic-source.specimen.v1`
- Validator: `beta/src/node/semantic_source.ts`
- Permanent placement: 未決。`.m3e/` などの恒久配置や分割 serialization は、この package では決めない。

この package は read-only file adapter の検証用であり、Neo4j database、write route、
runtime cache、generated inverse relation、secret、private absolute path を含めない。
Principle entity は、現行 `Principle.md` の Details 見出しに合わせて `P0`-`P7`
として採番している。
