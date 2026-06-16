# 2026-04-14 レビュー選択肢まとめ

今日の batch review で通った決定と、まだ未解決で残っている選択肢の一覧。
詳細な pros/cons は [../06_Operations/Decision_Pool.md#2026-04-14-002](../06_Operations/Decision_Pool.md) を参照。

---

## 1. 確定した選択肢

### Cloud Sync
| Q | 採用 | 却下 |
|---|---|---|
| Q2 DTO 位置 | `shared/types.ts` に継続 | — |
| Q4 Supabase project | 既存プロジェクト (akaghef が URL + anon key 提供) | 新規 + SQL migration |

### Alias Impl
| Q | 採用 | 却下 |
|---|---|---|
| Q1 write-alias scope | everything incl metadata (将来 per-alias mode toggle で独立保持も両立) | 独立データ保持 (排他) |
| Q2 named wrappers | skip (reparentNode + deleteNode で足りる) | 追加 wrapper |
| Q3 scoped-API × alias | API 引数で挙動制御 (default 可視、引数で隠す) | 常に可視固定 |

### Markdown Viewer
| Q | 採用 | 却下 |
|---|---|---|
| 基本方針 | **軽量**。見出し・強調のみ、表レンダリング不要、フォントサイズ切替 | — |
| Q1 library | hand-written renderer 継続 | marked + DOMPurify / markdown-it |
| Q2 Mermaid | `beta/public/vendor/mermaid.min.js` vendor | CDN / npm |
| Q3 preview UI | ノード属性 `markdown:true` で opt-in | Alt+D panel / 常時 inline |

### Red Team
| Q | 採用 | 却下 |
|---|---|---|
| Q1 branch | `dev-red` ベース + `audit/<date>-<domain>` トピック併用 | ad-hoc only / research/* |
| Q2 autonomy | read-only audit (reports only) | 自動修正 |
| Q3 初回 scope | full security sweep (CSRF / LAN / 偽装 / 入力検証 / 公開URL / Supabase / APIキー) | — |

### Rapid Deep Binding
| Q | 採用 | 却下 |
|---|---|---|
| Q1 domain enum | hierarchical (`math.topology.knot`) | flat / freeform |
| Q2 role enum | 固定リスト (`object / representation / move / invariant / theorem / method`) | freeform |
| Q3 syntactic tree 位置 | 専用 `syntactic_nodes` テーブル | 既存 nodes に混在 |
| Q4 span addressing | char offset (text+details+note 連結) v1、将来 token range 昇格 | token / node-id only |
| Q5 encoder trigger | 明示ボタンのみ (v1) | 自動 |

### Node Decoration
| Q | 採用 | 却下 |
|---|---|---|
| 保存キー | `attributes['m3e:style']` (JSON) | `style` / 分割属性 |
| color matrix | mlx Method 2 (U=blue / I=yellow / both=red) | 軸反転 / Method 1 |
| swatch set | mlx 配色 (importance=yellow tints / urgency=blue tints) | Miro 汎用 |

### Link API
| Q | 採用 | 却下 |
|---|---|---|
| Q1 API shape | dedicated REST `POST/DELETE /api/docs/:docId/links` | whole-doc POST |
| Q2 duplicate link | 許可 (dedup なし) | reject / silent dedupe |
| Q3 self-link | 許可 (+ ループ描画ロジック follow-up) | reject |

---

## 2. 未解決 (map の `reviews/` に残置)

### Cloud Sync
- **Q1 Auth mode** — tentative: email magic link / 残り option: OAuth (Google/GitHub)
- **Q3 Conflict resolution** — scope-level (採用方向) vs CRDT (Yjs) 追加検討
- **Q5 Encryption** — **user 明示要求まで放置**。いまは実装しない

### Markdown Viewer
- 方針ノート「軽量に動くこと」が未整理 (Q ではなく指針)

### Node Decoration
- **Precedence** — ビューモード切替案: `U*I view` = mlx 自動配色 / 通常 view = 手動色のみ
- **Hotkey** — ノードプロパティ編集モード内で `r` / `b` / `g` 単打 + テンキーで U*I 一発入力 (要議論)

### Obsidian Integration (codex 着手前に要決定)
- Q1 `![[image.png]]` 扱い
- Q2 Dataview / Templater 記法
- Q3 linearText > 6000 字
- Q4 外部削除時のノード扱い
- Q5 改行コード方針

### X Tech Radar (PR #53 で新規 pool)
- Q1 Ingress: `chrislee973/twitter-bookmark-mcp` sidecar (tentative) vs 直接 X API v2
- Q2 Poll interval: manual (P1) / 6h cron (P2)
- Q3 Auto-notify threshold: `rating >= trial`
- Q4 Source of truth: map primary, SQLite cache
- Q5 P1 scope: bookmarks only (likes は P2)
- Q6 Models: haiku で抽出, sonnet で評価
- Q7 既存ツール重複時の扱い: `rating=assess` + `overlap_with_existing`

---

## 3. 今日走ったタスク (PR)

| PR | 内容 | 状態 |
|----|------|------|
| #48 | visual: Node color decoration (phase 1, mlx palette, hotkey `c`) | open |
| #49 | data: Link add/delete API | open |
| #50 | data: Linear text box edit API | open |
| #51 | visual: Mermaid architecture view mode (`v` toggle) | open |
| #53 | team: X Tech Radar pipeline design + codex brief | open |

---

## 4. X MCP 補足

公式 X MCP は **存在しない**。P1 は `chrislee973/twitter-bookmark-mcp` (bookmark 専用、OAuth PKCE、M3E は API key を持たない) 経由で吸い込む。P2 で直接 X API v2 (~$5/月, PPU tier) に移行予定。詳細は [../design/x_tech_radar.md](../design/x_tech_radar.md) と [../../backlog/codex-x-tech-radar.md](../../backlog/codex-x-tech-radar.md)。
