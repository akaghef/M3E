# Mapify Roundtrip Reference

## Outbound Format

Prefer MF-H / Markdown headings for a tree:

```md
# 生物の分類
## 動物
### 哺乳類
### 鳥類
### 魚類
## 植物
### 被子植物
### 裸子植物
## 菌類
```

Preserve sibling order. Do not include M3E-only fields unless the task is
explicitly about metadata transfer.

## Inbound XMind Recovery

An `.xmind` file is a zip. The structural payload is normally `content.json`.

```bash
tmp="$(mktemp -d)"
unzip -q "$XMIND_FILE" -d "$tmp"
python3 tools/rapid_mapify_oracle/scripts/xmind_content_to_appstate.py "$tmp/content.json" --out "$tmp/retrieved_appstate.json"
```

If `content.json` is missing, inspect the zip listing before assuming failure:

```bash
unzip -l "$XMIND_FILE"
```

## Strict Comparison

Normalize both sides to ordered root-to-node paths:

```text
生物の分類
生物の分類 > 動物
生物の分類 > 動物 > 哺乳類
```

Compare:

- `nodeCount`
- `maxDepth`
- ordered path list
- ordered child labels for each parent path

Report exact diffs. A roundtrip is not successful if labels were paraphrased,
siblings reordered, or extra wrapper nodes were inserted without explicit
normalization.

## Current Status

Known open route:

```text
Markdown/MF-H -> Mapify -> XMind export -> M3E/XMind import or AppState-lite
```

Known not-open route unless reverified:

```text
Mapify internal/private API -> direct Markdown/JSON readback
```

The private API previously returned `401 Unauthorized` without authenticated
browser context. Do not solve this by extracting cookies.

