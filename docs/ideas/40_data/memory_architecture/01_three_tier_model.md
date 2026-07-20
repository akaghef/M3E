# 01. 三層モデル — Hermes 比較から M3E memory を再構成

## T1. Hermes 設計の本質

Hermes Agent (Nous Research) の memory 仕組みを読み解くと、要点は 4 つ：

1. **ハード予算**：MEMORY.md 2200 char / USER.md 1375 char（合算 ~1300 token）。
   超えたら add 前に consolidate を強制。これが "memory 腐敗" を防ぐ唯一の機構
2. **frozen snapshot**：session 開始時に固める。prefix cache を壊さない／中身がブレない。
   mid-session 追加は disk persist のみ、次 session で反映
3. **二系統分離**：MEMORY（環境・規約・学び） と USER（嗜好・口調・文脈）を別ファイル・別予算
4. **nudge & flush**：10 ターンごとに save リマインダ、exit/reset 時に 1 ターン flush

加えて：
- session_search（SQLite + FTS5）で過去 session を on-demand 検索
- memory provider plugin（honcho / mem0 / supermemory）で外部委託可
- security scan（prompt injection / 不可視 Unicode）で注入耐性
- duplicate rejection・§ delimiter・usage % header で運用補助

## T2. M3E 三層モデル候補

Hermes の bounded vs searchable 二段を、M3E は **三層**に拡張できる：

| 層 | 容量 | アクセス | 性格 | M3E 該当 |
|---|---|---|---|---|
| **Tier A（注入）** | bounded（要予算） | system prompt に毎回 | curated facts | `~/.claude/memory/MEMORY.md` index、CLAUDE.md |
| **Tier B（構造化検索）** | unbounded | tool 経由 query | 多次元構造化メモリ | **M3E map（/api/maps）** |
| **Tier C（アーカイブ検索）** | unbounded | grep / FTS | 時系列ログ | `.remember/archive.md`、`backlog/` 履歴、daily files |

## T3. M3E 固有：Tier B が Hermes に存在しない

Hermes は flat な MEMORY.md と SQLite session log のみ。M3E の map は：
- 親子・position・color・urgency / importance / status の **多次元属性**
- facet / scope / 確定 PJ ノードという **構造的 semantics**
- 人間と agent が **共同編集**する canvas

これらが Tier B として機能する。**Hermes 風 flat memory には模倣できない領域**で、
M3E の射影出力（科研費等）の **素材そのもの** にもなる。
Hermes の memory は agent 用にしか使えないが、M3E の Tier B は出力にも使える。

## T4. Tier A 規律の不在（現状の病理）

`~/.claude/memory/MEMORY.md` に予算がない。現状：

- 単調増加で line 数が伸びる
- index ファイルなのに 200 行を超えるとロード時 truncate される（CLAUDE.md ルール）
- 各 typed-memory ファイルにも字数上限なし
- consolidate 機構なし（手動トリガ skill `consolidate-memory` のみ）

Hermes 流に Tier A だけにハード予算をかけ、超過時 consolidate 強制が必要。

具体案：
- index 200 行 hard cap
- typed-memory 各ファイル 800 char hard cap
- 80% 越えで agent に warn、95% でブロック
- user vs project + feedback で予算分離（Hermes 二系統に倣う）

## T5. scratch / backlog / Qn の tier 帰属混乱

現状の役割が曖昧で、Tier 間で混ざっている：

| 仕組み | あるべき tier | 実際の使われ方 | 病理 |
|---|---|---|---|
| scratch | Tier B（構造データ） | Tier A inbox 的に flat に流される | 局所化されない |
| reviews/Qn | 独立（合議キュー） | Tier A 的にも Tier B 的にも使われる | 役割が読めない |
| backlog/ | Tier C（アーカイブ通信） | Tier A 同期キューとして使われる | 古い backlog が残り続ける |

→ 役割を整理し直す必要あり。次ファイル以降で詳述。

## 代替案：二層に圧縮する選択肢

**alt T2a**：Tier B を独立させず、map を "Tier A の external mirror" と捉える
- pro：シンプル、Hermes と並べやすい
- con：M3E の優位（構造化）を捨てる、射影出力との接続が切れる

**alt T2b**：Tier B / C を統合（map + archive を同一クエリ層に）
- pro：read-path が 2 段で済む
- con：Deep と廃材が混ざる、検索ノイズ増

→ 三層維持が妥当（README キーメッセージ参照）。

## 観察

- Hermes の "ハード予算" は **agent の自由を奪うのではなく、品質を担保する制約**
- M3E は Tier B に Hermes 越えの優位がある分、Tier A 規律の遅れが目立つ
- 三層が機能するためには、各層の **境界が機械的に判定可能**である必要がある
  → 03_deep_canonicality_rules.md の 7 ルールが境界判定機構
