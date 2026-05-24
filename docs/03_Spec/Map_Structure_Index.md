# Map Structure Index

このファイルは索引のみ。canonical rule の本文を重複させない。

## Canonical product specs

- Data model: `Data_Model.md`
  - node
  - edge
  - GraphLink
  - alias constraints
  - invariants

- Scope and alias: `Scope_and_Alias.md`
  - root scope
  - folder scope
  - scopen / unscopen の product meaning
  - alias behavior

- Path notation: `Node_Path_Notation.md`
  - canonical display path `M:(<map label>)> A > B >> C`
  - `/` legacy/API compatibility
  - `\` filesystem-only separator
  - ambiguity rules

- Layout modes: `map_layout_modes.md`
  - right-tree
  - down-tree
  - balanced-tree
  - outline
  - future modes

## Related operating protocols

- Map Manager: `../../protocols/map-manager/README.md`
- Map write: `../../protocols/map-write-protocol.md`
- Scope operation: `../../protocols/scope-operation-protocol.md`
- Layouting: `../../protocols/layouting-protocol.md`
