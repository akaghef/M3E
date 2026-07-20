# Rapid Markdown Canon / MF-H / Obsidian 内 M3E surface

作成日: 2026-07-01

関連:
- `docs/03_Spec/Linear_Tree_Conversion.md`
- `docs/03_Spec/Obsidian_Vault_Integration.md`
- `docs/03_Spec/Band_Spec.md`
- `docs/ideas/260627_m3e_obsidian_plugin_limit_and_core_focus.md`
- `docs/ideas/260630_four_surface_workbench_obsidian_aitui_m3e_n8n.md`

---

## Why

Obsidian / Markdown と M3E の関係について、以前は「どちらを正本にするか」が主問題に見えていた。
しかし Rapid 帯域に限ると、問題の中心は正本化そのものというより、**上流の概念構造と下流の大量文書作業をどう階層化するか**である。

M3E が上流の概念整理から下流の大量ドキュメント保存まで一つのツールで抱えようとすると、Obsidian が得意な領域まで再実装することになり、作業摩擦と開発負荷が増える。
特に Rapid 帯域の 1 文書レベルでは、Markdown を正本として扱い、M3E はその Markdown を構造化して眺める / 操作する / AI と共有する作業面として振る舞う方が自然である。

---

## Core Insight

Rapid 帯域では、少なくとも **1 文書に対する Mapify / mindmap 化**に限れば、Markdown を canon として問題ない。

```text
Markdown file (.md) = canon
M3E tree / map view = projection / cache / work surface
```

Deep 帯域へ進むと、同一性・非線形関係・typed edge・scope bind・alias・semantic graph が関わるため、Markdown 正本だけでは足りなくなる。
そのため、まずは実現範囲を **Rapid One-Document Markdown Canon Mode** に限定して設計する。

---

## MF-H: Markdown Heading Mindmap Format

仮称 `MF-H` は、Markdown heading hierarchy を 1 文書 mindmap として扱う形式である。

```markdown
# 1 {中心トピック}
## 1.1 {主枝ラベル}
### 1.1.1 {葉ノードラベル}
### 1.1.2 {葉ノードラベル}
## 1.2 {主枝ラベル}
### 1.2.1 {葉ノードラベル}
### 1.2.2 {葉ノードラベル}
```

### 最小ルール案

- `#` が root node。
- `##` 以降が child node。
- heading depth が tree depth に対応する。
- heading order が sibling order に対応する。
- heading text が node label に対応する。
- heading 下の本文は node details / note として扱う。
- `1.1.2` のような番号は原則として表示用 projection とし、構造 canon にはしない。
- metadata は HTML comment で最小限だけ挿入できる。

例:

```markdown
## 1.1 主枝ラベル
<!-- m3e:id=n_xxx -->

本文。必要なら M3E 側では details として扱う。
```

ただし、初期段階では任意 Markdown の完全 round-trip を目指さない。
MF-H は「制約付き Markdown heading tree」であり、表・callout・plugin 記法・複雑な code block などを完全に構造化するものではない。

---

## index.md / MOC の位置づけ

`index.md` や MOC は表面的には Markdown の線形文書だが、実際には参照を集約する graph 的な構造を持つ。
ただし、これは Deep semantic graph ではなく、Rapid 帯域に属する **参照集約グラフ** と考える。

```text
Rapid graph = note / heading / link を人間が読むために集約した参照グラフ
Deep graph  = concept / identity / typed relation / abstraction を扱う意味グラフ
```

この区別により、Obsidian の index / MOC は Markdown canon のまま扱い、M3E はその参照構造を見える化する projection として利用できる。

---

## 上流 / 下流の階層化

今回の整理で重要なのは、M3E の問題が「Markdown vs DB」ではなく、上流と下流を一つのツールで扱おうとしていた点にあること。

### 下流

- Markdown
- Obsidian vault
- 大量ドキュメント
- 作業ログ
- 個別ノート
- 実務成果物

### 中流

- `index.md`
- MOC
- handoff
- MF-H
- 1 文書 mindmap
- Rapid mapify

### 上流

- M3E map
- scope
- typed edge
- concept boundary
- strategy / decision structure
- AI と共有する抽象作業場

Obsidian は下流の文書保存・編集面として強い。
M3E は中流〜上流で、概念構造・階層化・判断構造・AI 共有面を担う。

---

## External Reference Layer

最近の hyperlink node 実装により、M3E node から外部 URL / Obsidian note を開けるようになった。
これは単なる便利機能ではなく、M3E が内部閉鎖型 map から、外部知識資産を参照する上流構造レイヤーへ変わる重要な潮流である。

今後の方向:

1. M3E node が Obsidian note / heading / block を参照できる。
2. 参照先を M3E から開ける。
3. 参照先の種別・状態を inspector / meta panel で見える。
4. broken link / missing note を検出できる。
5. 必要に応じて node と Markdown heading / block の binding を持てる。
6. ただし Markdown 本文全体を M3E に吸い込むことは初期目標にしない。

---

## Obsidian 内に M3E web surface を置く案

追加の重要な発見として、Obsidian editor / pane 内で web page を表示できるなら、Obsidian を開いたまま M3E viewer を操作できる。

これは「M3E を Obsidian plugin として完全再実装する」より軽い。
Obsidian plugin 化で M3E 全体を作り直すのではなく、Obsidian 側に M3E web surface を表示し、以下のような構成にできる。

```text
Obsidian pane
  ├─ Markdown editor  = 本文 canon
  └─ M3E web viewer   = 構造 projection / mapify surface
```

この構成の利点:

- Obsidian から離れず M3E を操作できるため、上流 / 下流の隔壁が薄くなる。
- M3E の専用 UI を Obsidian plugin API に無理に移植しなくてよい。
- 本文 canon は Obsidian / Markdown に残せる。
- M3E は localhost web app として独立性を保てる。
- Rapid 帯域の Mapify 体験を Obsidian 内に持ち込める。

注意点:

- Obsidian 内 web surface は M3E 本体の置き換えではない。
- Obsidian pane はあくまで操作面であり、M3E の source of truth を曖昧にしない。
- Markdown-canon mode では `.md` が正本、M3E view は projection / cache と明示する。
- Deep 帯域では別途 M3E graph canon が必要になる可能性がある。

---

## In Scope

- Rapid 帯域。
- 1 文書単位。
- Markdown heading tree。
- index.md / MOC 的な参照集約。
- Obsidian note / URL への外部参照。
- Obsidian 内 web surface による低摩擦操作。
- Markdown canon + M3E projection / cache。

## Out of Scope

- Deep semantic graph 全体。
- Vault 全体の完全 live sync。
- 任意 Markdown の完全 round-trip。
- Obsidian plugin として M3E 全体を再実装すること。
- n8n / runtime / execution log の統合。
- AI による非決定的な自動書き戻し。

---

## Next Action

1. `Linear_Tree_Conversion.md` の「正本は常に Tree」と、Rapid Markdown-canon mode の関係を整理する。
2. MF-H を draft spec として `docs/03_Spec/` に昇格するか判断する。
3. Obsidian 内 web surface の実現方法を調査する。
   - Obsidian の iframe / webview / Custom Frames 系 plugin / local URL 表示方法。
   - `http://localhost:4173/viewer.html?...` を Obsidian pane 内で開けるか。
4. hyperlink node を External Reference Layer の第一歩として、上位 docs に意味づける。
5. M3E node → Obsidian note / heading / block の binding metadata を最小設計する。

---

## Related Strategies

- `S3`: 保存・同期・復元の信頼性。
- `S4`: Linear ↔ Tree / Markdown round-trip 系の次段階。
- `S13`: 外部インフラや特定 provider に依存しすぎない経路の維持。
