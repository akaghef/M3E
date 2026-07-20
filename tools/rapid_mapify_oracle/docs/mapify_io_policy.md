# Mapify I/O policy

## IO1 Role

Mapify is a teacher/probe layer. It can provide reference action traces and map-native formatting. It is not canonical storage.

## IO2 Outbound: M3E -> Mapify

Preferred order:

1. `AppState` scope/subtree -> Markdown outline.
2. `URL/text/youtube/prompt` -> Mapify MCP, when the source material is external.
3. Browser extension route only for human browsing workflows.
4. Private/internal API is avoided; if used, keep it inside the logged-in browser context.

Minimum projection:

```text
TreeNode.text        -> heading/list label
children[] order     -> Markdown order
scope root           -> export root
details/note/etc.    -> unsupported or fenced metadata quarantine
links/surfaces/etc.  -> retained in M3E, not sent to Mapify
```

## IO3 Inbound: Mapify -> M3E

Preferred order:

```text
Mapify UI export
-> XMind .xmind
-> unzip
-> content.json
-> sheet.rootTopic pre-order traversal
-> candidate AppState
-> compare with M3E canonical state
```

Minimum mapping:

```text
sheet.rootTopic                 -> AppState.rootId
topic.id                        -> TreeNode.id or xmind_<uuid>
topic.title                     -> TreeNode.text
children.attached[]             -> TreeNode.children + child.parentId
class: topic                    -> nodeType: text
structureClass                  -> attributes["m3e:layout"]
topic-title-folding != unfolded -> collapsed: true
```

## IO4 Safety

Do not transfer session cookies into Codex scripts. If an internal Mapify endpoint is needed, use a content script or page-context fetch and pass only the resulting JSON to local tools.
