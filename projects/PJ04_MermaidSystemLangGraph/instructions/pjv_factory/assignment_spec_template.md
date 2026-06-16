---
pj_id: PJ04
package: pjv_factory
doc: assignment_spec_template
date: 2026-04-30
---

# PJv Assignment Spec Template

このテンプレートをコピーし、`projects/PJ04_MermaidSystemLangGraph/specs/pjvXX_<slug>.md` として保存する。

## 1. Identity

| 項目 | 値 |
|---|---|
| PJv ID |  |
| slug |  |
| owner agent |  |
| source path |  |
| map scope path |  |
| status | draft / spec_review / spec_frozen / template_built / run_done / done |

## 2. Goal

この PJv* system が 1 回の Run で達成することを書く。

```text

```

## 3. Inputs

| input | kind | path / source | required | notes |
|---|---|---|---|---|
|  | folder / file / text / api / state |  | yes/no |  |

## 4. Outputs

| output | kind | path / target | acceptance |
|---|---|---|---|
|  | markdown / json / map-qn / tmp-file |  |  |

## 5. User Journey

人間が見る上位 flow を 5 node 以下で書く。

```text
START -> ... -> END
```

## 6. System Nodes

| node id | label | template | reads | writes | done condition |
|---|---|---|---|---|---|
| load_sources | Load Sources | `io.load_local_folder` |  |  |  |
| generate_artifact | Generate Artifact | `llm.generate_doc.subsystem` |  |  |  |
| write_output | Write Output | `io.write_artifact` |  |  |  |

## 7. Subsystems

| subsystem | parent node | internal nodes | reason |
|---|---|---|---|
|  |  |  |  |

## 8. Data View

Data View は実体と対応するものだけを書く。

| resource/state | concrete entity | owner | lifecycle |
|---|---|---|---|
| `resource.sourceFolder` |  | local | read-only |
| `state.contextPackage` |  | runtime | transient |
| `resource.outputFile` |  | tmp | generated |

## 9. Failure Policy

| failure | handling | map/Qn behavior |
|---|---|---|
| missing input | fail fast | Qn |
| provider error | retry then fallback_qn | Qn |
| bad output | fallback_qn | Qn |

## 10. Template System Spec Plan

| field | value |
|---|---|
| yaml path | `projects/PJ04_MermaidSystemLangGraph/templates/pjvXX_<slug>.yaml` |
| root id | `pjvXX_<slug>_system` |
| entry |  |
| graphSpecVersion |  |

## 11. Open Questions

| question | options | default if unanswered |
|---|---|---|
|  |  |  |

## 12. Freeze Checklist

- [ ] input / output が明確
- [ ] 上位 diagram は 5 node 以下
- [ ] subsystem 境界が明確
- [ ] Data View が実体と対応している
- [ ] failure policy がある
- [ ] template catalog にある block だけで表現できる
