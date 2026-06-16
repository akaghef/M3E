# Failure Pattern Ledger

- **Undefined teacher sufficiency threshold**
  - Example: What counts as teacher trace sufficient.
  - General Fix Rule: Define sufficient evidence as explicit candidate labels or explicit same-role expansion pattern with stated candidates.
  - Seen in: iter 1
- **Prompt-generated stable IDs**
  - Example: Parent id naming in benchmark was unclear.
  - General Fix Rule: Harness supplies stable selectedNodeId; prompt output uses labels only for new nodes.
  - Seen in: iter 1
- **Implicit candidate order**
  - Example: Expected labels implied order but no ordering rule existed.
  - General Fix Rule: State order preservation rule at the output boundary.
  - Seen in: iter 1

- **Scenario missing concrete selectedNodeId**
  - Example: Executor used `<selectedNodeId>` placeholder because scenarios gave labels but not IDs.
  - General Fix Rule: empirical scenarios must provide concrete opaque IDs whenever the prompt requires stable IDs.
  - Seen in: iter 2
