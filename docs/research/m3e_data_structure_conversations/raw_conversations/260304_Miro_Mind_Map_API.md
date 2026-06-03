---
title: "Miro Mind Map API"
created: 2026-03-04 11:23:08
updated: 2026-03-04 11:23:49
tags:
  - chatgpt
  - conversation
---
# Miro Mind Map API

<sub>2026-03-04</sub>

---

**User**: <sub>2026-03-04 11:23</sub>

Miroってmind mapのAPI経由の操作ってどこまでできる？

> [!note]- Internal Reasoning
> <sub>2026-03-04 11:23</sub>
> 
> **Miro API capabilities and mindmap limitations**: Miro offers a Developer Platform with its REST API, webhooks, and apps. While the API supports board items like sticky notes, shapes, and connectors, it seems mind maps may have limited support. For instance, "mindmap node" might not be a fully supported item type. I'll need to verify this information through a web search.

**ChatGPT (tool execution)**: <sub>2026-03-04 11:23</sub>

```
{"search_query":[{"q":"Miro REST API supported item types mind map node","recency":30},{"q":"Miro API create mindmap node endpoint","recency":30},{"q":"Miro developer platform board items types connector frame card sticky","recency":30}],"response_length":"short"}
```

> [!note]- Internal Reasoning
> <sub>2026-03-04 11:23</sub>
> 
> **Miro APIでのマインドマップとアイテム操作**: M

> [!info] Reasoning Summary
> <sub>2026-03-04 11:23</sub>
> 
> 思考時間: 23s

**ChatGPT**: <sub>2026-03-04 11:23</sub>

Miro は「REST API（v2）」と「Web SDK」で、ボード上の多くの要素をプログラムから作成・取得・更新・削除できます。典型的には、ボード管理（作成・共有・メンバー取得等）と、ボード上の各種アイテム（付箋、テキスト、図形、画像、カード、フレーム、コネクタ等）の操作が中心です。citeturn0search20turn0search13turn0search4turn0search21

mind map については、以前は「API/SDKで未対応」という状況がありましたがciteturn0search0、現在は「実験的（Experimental）API」として mind map ノードの作成・取得・削除などが提供されています。citeturn0search3turn0search1turn0search5  
ただし制約があり、少なくとも実験版の mind map は「テキストのノードのみ」を対象とし、座標（x,y）を指定して配置する方式などの制限が明記されています。citeturn0search5turn0search1

補足として、一般の「ボードアイテム」には API/SDK がまだ対応していない種類があり、その場合は “unsupported items” として扱われ、作成や内容更新ができない（位置の読み書きのみ等）という整理です。citeturn0search2

