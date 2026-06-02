# PJ05 初期契約

date: 2026-05-14
status: draft-implemented

## Scope

PJ05 は M3E の presentation surface を扱う sub project とする。
ここでいう presentation は PPTX ではなく、M3E の map state から派生する埋め込み HTML surface である。

## Source of Truth

- 正本: M3E map state (`node`, `edge`, `scope`, attributes)
- 派生: presentation HTML
- 補助: `presentation_spec.json`

HTML 側で node の意味や座標を勝手に再定義しない。
最初の静的 artifact では spec に固定座標を置くが、viewer 組み込み時は map layout cache / surface layout から読む。

## User Constraint

今回の重要条件:

- node 座標は固定する。
- presentation の進行で変化するのは link highlight と説明 pane だけ。
- progress bar は 1 段または 2 段がよい。
- 粒度は階層で持つ。

PJ05 seed では 2 段を採用する。

| 層 | 意味 | UI |
|---|---|---|
| Flow | 大きな章 / scene | 上段 progress |
| Step | flow 内の操作単位 | 下段 progress |

## V4 Demo Content Mapping

| Flow | 内容 | V4 demo 対応 |
|---|---|---|
| F1 | Full Slice | 全体俯瞰 |
| F2 | PDF to Flash | Mapify 相当 |
| F3 | Discussion | Miro 相当 |
| F4 | Vault Sync | Obsidian 相当 |
| F5 | Conflict | 409 / resolution |
| F6 | Publish Boundary | GitHub safety boundary |

## Acceptance

- DaveJ 型の right-side flow selector と steps pane を持つ。
- node は固定位置のカードとして描画される。
- flow / step 選択で active path の link だけが変わる。
- 2 段 progress bar が flow 粒度と step 粒度を分けて表示する。
- V4 service-equivalent demo と同じ説明内容を含む。
- HTML 単体で開ける。
