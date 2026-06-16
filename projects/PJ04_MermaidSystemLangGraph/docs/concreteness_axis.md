---
title: PJ04 Concreteness Axis — Extended
pj: PJ04
status: draft
date: 2026-04-22
axis: 具象軸 (concreteness / detail level)
related:
  - render_target_definition.md (用語定義・L0/L1 既存)
  - system_diagram_map_model.md (3軸分離の理論)
  - langgraph_integration_plan.md (下層レイヤ露出の IPC)
---

# 具象軸の拡張 — Python / 下層レイヤまで覗けるようにする

## 0. Why extend

既存の `detail level` は **L0 (箱のみ) / L1 (1 段 preview)** の 2 段のみ。
authoring に必要な粒度はこれで足りるが、**実装契約 (Python callable / schema / 状態) を覗きたい** という要求には届かない。

PJ04 の主題は「LangGraph を M3E で描く + 動かす + 覗く」なので、**具象軸は runtime 契約まで貫通する必要がある**。
本書でその貫通を設計する。

### 3 軸の再確認 (押さえ直し)

| 軸 | 決めるもの | 独立の証拠 |
|---|---|---|
| 構造軸 | parent/child, scope containment | 「Execute System に何が属する」は detail level で変わらない |
| 遷移軸 | node 間の relation (edge) | 「Explore → Plan の approve 遷移」は zoom で変わらない |
| 具象軸 | 同じ node / edge を**どの粒度で見るか** | zoom しても topology は変わらない |

具象軸は **window 側**の状態。map 正本には書かない (I4: trace 非破壊と同系の原則)。

---

## 1. Level 階層 (L0 → L5)

```
L0: 箱のみ                           ← authoring 最小
L1: 1 段 preview (既存)               ← 箱の中に子構造の影
L2: + contract hints                ← callable ref / channels / edge labels 全部見える
L3: + signature                     ← callable の input/output 型 (Python type hint)
L4: + source                        ← Python 関数本体 (読み取り専用)
L5: + live state                    ← 実行中の channel values / last tool_call / trace
```

各 L は **前段を包含する** (L3 は L2 の情報も全部含む)。

### レベル別 仕様

| Level | 表示内容 | データ源 | フェッチ方式 |
|---|---|---|---|
| **L0** | 箱 + label + 形状 (shape) | map attribute | 既存 (同期) |
| **L1** | + 箱内部に child の mini-flow | map attribute | 既存 (同期、`buildFlowPreviewLayout`) |
| **L2** | + `m3e:kernel-*` 属性の要約 (node kind, ref, channels) | map attribute | 既存 (同期) |
| **L3** | + Python callable の signature (params, types, docstring 1 行) | bridge introspection IPC | 非同期、**バッジ表示までは即時** / 本体は lazy |
| **L4** | + Python 関数 body (先頭 N 行、syntax highlight) | bridge IPC (source fetch) | 非同期、キャッシュ 5 分 |
| **L5** | + live channel values / 最後の tool_call / 実行 span | bridge streaming (thread 必須) | 非同期、stream 中のみ |

### L3-L5 の "下層" 定義

- **L3 の下層** = registry 側。Python module の関数 signature
- **L4 の下層** = ソースファイル。registry が指すモジュールのファイル + 行範囲
- **L5 の下層** = runtime。active thread の channel 値 + 最新 trace 1 件

これらは全部 **Python bridge から read-only で返す IPC** で統一する。map 側には書かない (I3: ref 一方向)。

---

## 2. ナビゲーション

### Global level (surface 全体)
- `j` / `k` で **全ノード**の concreteness を +1 / -1
- 上限 = L5、下限 = L0
- bridge 接続が無い環境では L2 が上限 (L3+ は表示不可を status に明示)

### Per-node override (局所)
- `o` で選択 node のみ **1 段上げる** (global とは独立)
- `shift-o` で戻す
- 局所 override は window state のみ。保存しない

### モーダル / サイドパネル
- L4 / L5 は **箱の中だけでは情報量に耐えない**。選択 node に対して右サイドパネルで詳細表示する
- パネルは既存 linear panel のレイアウト枠を流用 (system mode で hidden だったもの)
- `i` (info toggle) でパネル開閉、`L` (shift-l) で level pin

### Fallback
- bridge が未接続 → L3+ は灰色バッジ "requires bridge" を表示
- callable ref が解決不能 → L3+ で赤バッジ "unresolved: <ref>"
- source fetch 失敗 → L4 はエラー行 (詳細は status bar)

---

## 3. データ取得パス (Phase に対応)

```
L0 / L1 / L2
    ↓
map sqlite (既存)

L3 (signature)
    ↓
bridge IPC: {kind:"introspect_callable", ref}
    → {signature, docstring_oneline, module_path}

L4 (source)
    ↓
bridge IPC: {kind:"fetch_source", module_path, symbol}
    → {source_text, line_range, file_path}

L5 (live state)
    ↓
bridge streaming: existing stream("values"|"messages") @ threadId
    → viewer が最新値を per-node buffer に溜める
```

### bridge に追加する IPC (Phase B 拡張)

[langgraph_integration_plan.md](langgraph_integration_plan.md) Phase B に以下 2 IPC を追加する:

| IPC | 入力 | 出力 | 備考 |
|---|---|---|---|
| `introspect_callable` | `{ref: string}` | `{signature, paramTypes, returnType, docOneLine, modulePath}` | Python `inspect` モジュール使用 |
| `fetch_source` | `{modulePath, symbol}` | `{sourceText, startLine, endLine, filePath}` | read-only、size 上限 16KB |

**security**: ref は registry に登録された名前のみ解決可能。任意 path は拒否。

---

## 4. UI 要素

### 箱の描画差分

| Level | 箱内 | 箱周辺 |
|---|---|---|
| L0 | label のみ | — |
| L1 | label + mini flow | — |
| L2 | + kind icon + channels badge | edge に label |
| L3 | + signature 1 行 (`(state) → Partial<State>`) | ref badge (緑=resolved / 赤=unresolved) |
| L4 | L3 と同じ (body はパネルへ) | "source" ボタン |
| L5 | + 状態値 sparkline / 最終 value 縮約 | 実行中 pulse + span 色 |

### サイドパネル (右)

L3+ 時に表示。選択 node に対して:
- Signature (Python type hint)
- Docstring (折り畳み)
- Source (L4 時、先頭 N 行 or 全文。syntax highlight は後回しでも OK)
- Recent trace events (L5 時、直近 N 件)
- Link: `Open in editor` (file_path を VSCode に渡す deep link)

---

## 5. 実装順 (LangGraph Integration Plan と並走)

| Step | 対応 Phase | 成果物 |
|---|---|---|
| C-0 | 今すぐ可 | `flowSurfaceDetailLevel` の MAX_DETAIL を 5 に拡張、L2 (kernel attr 要約) を viewer に実装 |
| C-1 | Phase B に合流 | bridge IPC `introspect_callable` 追加 (T-B-1 の延長) |
| C-2 | Phase B+ | viewer の L3 描画 + サイドパネル枠 |
| C-3 | Phase B+ | bridge IPC `fetch_source` 追加 + L4 描画 |
| C-4 | Phase C に合流 | stream の per-node buffer + L5 描画 |
| C-5 | Phase C+ | per-node override (`o` / `shift-o`) と level pin |

C-0 は bridge が無くても完結する (map attribute のみ)。先行着手可。

---

## 6. 既存との整合

### `detail level` glossary (render_target_definition.md:56)
- 旧定義: `0 = 箱のみ、1 = 1 段 preview`
- 新定義: L0-L5、L0/L1 は既存互換、L2+ は拡張
- **破壊的変更なし**: L1 までは既存のまま動く

### 不変式の更新
本計画に伴い [langgraph_integration_plan.md](langgraph_integration_plan.md) の不変式に以下を追加:

- **I6 (具象軸 volatile)**: concreteness level は window state のみ。map attribute に書き戻さない
- **I7 (introspect 無害)**: `introspect_callable` / `fetch_source` は Python 側の state を変えない (read-only)

---

## 7. 未決定事項

| Q | 選択肢 | 推奨 |
|---|---|---|
| L4 のソース取得サイズ上限 | 無制限 / 16KB / 関数スコープのみ | **関数スコープのみ (symbol 指定で切り出す)** |
| L5 の値表示方針 | JSON 全文 / プリセット truncate / custom formatter | **truncate (配列は先頭 3 件、文字列は 80 字、オブジェクトは key 数のみ)** |
| `o` / `shift-o` のキー | このまま / 他のキー衝突確認 | Keybindings_Beta と突き合わせて Phase C 時点で確定 |
| サイドパネル表示の lifecycle | selection 切替で自動更新 / 手動 pin | **selection 追従 + `L` で pin** |
| bridge 未接続時の UI | 灰色バッジ / 非表示 / 警告 status | **灰色バッジ + tooltip で理由** |

---

## 8. 非目標

- 箱内での source code 編集 (authoring は別モード、detail level は read-only)
- L5 での time travel UI (これは Phase D のスコープ、具象軸と別軸)
- Python 以外の言語 (Phase E で ts tool を足すかは別議論)
- 具象軸を map 正本に書き込む (I6 違反)
