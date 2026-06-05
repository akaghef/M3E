# Task slices

## TS1 RF1.expandSelectedNode

Input: selected node `動物`.
Output: missing branch children under `動物`.

Teacher examples:

```text
爬虫類
両生類
無脊椎動物
```

Acceptance:

```text
- inserted under 動物 only
- no duplicate of 哺乳類/鳥類/魚類
- short labels
- no unrelated node like 植物 under 動物
```

## TS2 RF2.addExamples

Input: selected node `哺乳類`.
Output: examples under `哺乳類`.

Teacher examples:

```text
ヒト
イヌ
クジラ
```

Acceptance: examples only, not classes like `脊椎動物`.

## TS3 RF3.addSubtypes

Input: selected node `植物`.
Output: subtypes/classes under `植物`.

Teacher examples:

```text
種子植物
シダ植物
コケ植物
```

Acceptance: do not mix examples (`サクラ`, `イネ`) as siblings of subtype classes unless operation asks for examples.
