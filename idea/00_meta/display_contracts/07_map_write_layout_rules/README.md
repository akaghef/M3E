# Map Write Layout Rules

このフォルダは、map 書き込み時の layout / display contract / 副作用禁止ルールを書き溜める場所。

## ファイル構成

- `README.md` — 現時点の基本ルール
- `01_progressive_navigation.md` — UI蒸留・Progressive Navigationの粒度
- `02_write_safety.md` — field-level write safety と副作用禁止
- `99_inbox.md` — 未整理メモの投げ込み先

## 目的

AI/agent が M3E map に書き込むときのレイアウト指示・副作用禁止ルールを蓄積する。

ここでいう layout は、単なる見た目ではなく、人間が review しやすい構造・順序・anchor・表示粒度を含む。

## 最重要原則

ユーザーが指示した操作以外への副作用を作らない。

例:

```text
指示: node text から "UIグループ anchor:" を消す
許される変更: 該当 node の text だけ
許されない変更: collapsed / viewport / selection / children / links / 他 node
```

API が full-state POST 中心で副作用を起こしやすくても、agent 側は許可された差分だけを作る。

## Field-level Write Contract

操作ごとに変更可能 field を限定する。

```text
text変更:
  allowed: text
  forbidden: children, parentId, collapsed, attributes, links, viewport, selection

style変更:
  allowed: attributes["m3e:style"] の対象 key
  forbidden: text, children, parentId, collapsed

構造変更:
  allowed: parentId, children, new/deleted nodes, affected links
  forbidden: unrelated node text, unrelated collapsed, viewport, selection

view変更:
  allowed: collapsed, selected, scope, viewport, zoom
  forbidden: semantic text/structure unless explicitly requested
```

保存前に、実際の差分がこの contract を超えていないか確認する。

## Progressive Navigation Layout

UI蒸留・UI再現 map では以下を基本にする。

- `1 node = 1 click = 1 UI element`
- node は概念カテゴリではなく、画面上で押せる/見える UI 要素
- parent-child は分類ではなく、クリック/展開で次に出る UI
- flyout / modal / dropdown / tab は必ず1階層深くする
- 画面上の配置順・メニュー表示順を優先する

例:

```text
⋮ メインメニュー
└── 📋 ボード
    └── ⬆️ エクスポート
        ├── 📄 PDFとして保存
        └── 🖼 画像としてエクスポート
```

## Anchor Naming

anchor は短く、画面上のグループ名に近くする。

よい:

```text
🧱 ボード上部ツールバー
🧱 ユーザー上部ツールバー
🧱 左Creationツールバー
```

避ける:

```text
🧱 UIグループ anchor: ボード上部ツールバー
```

説明語は node text ではなく `details` / `note` / attributes に逃がす。

## 表記ルール

- 日本語UIは日本語のまま写す
- 絵文字は先頭に置き、視認性のために使う
- toggle / radio / disabled は状態を node text に含める
- 個人名、招待URL、token は抽象化する

例:

```text
#️⃣ ライングリッド radio: on
🧲 グリッドに位置合わせ toggle: off
🔒 デフォルト表示をロックする toggle: off disabled
👤 招待候補ユーザー chip
```

## View State Safety

layout 指示であっても、明示されていない view state は変更しない。

- `collapsed`
- selected node
- current scope
- viewport x/y
- zoom
- panel open/closed
- active tool

構造を作り直す必要がある場合は、既存 node の非対象 field を引き継ぐ。

## 保存前チェック

agent は map 保存前に以下を見る。

```text
1. 変更対象 node id
2. 変更対象 field
3. semantic diff
4. view diff
5. unrelated node diff
```

想定外の view diff や unrelated node diff がある場合は保存しない。
