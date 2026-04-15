---
project: AlgLibMove
date: 2026-04-15
topic: kickoff セッション 集計メトリクス
reliability: 混在（agent duration は 🟢 厳密、人間時間は 🟡 推定）
source: task-notification duration_ms + timeline_2026-04-15.md
pair_with: timeline_2026-04-15.md
---

# 目的

API / エージェント運用 / M3E マップの改善に向けた戦略データ。
「何にどれだけ時間を食ったか」「どの操作が詰まったか」を後から参照可能にする。

---

# 1. 全体サマリ

| 指標 | 値 | 備考 |
|---|---|---|
| セッション全長 | ~5h 45m (13:00–18:50 JST) | 🔴 pre-compaction 推定含む |
| post-compaction 可観測区間 | ~2h 05m (16:45–18:50) | 🟢 |
| 起動 agent 数 | 17 (post) + 推定 9 (pre) = ~26 | Wave1-5 + facet + Phase B + debt→map |
| agent 実時間合計 (post) | ~2,420 s ≈ 40 min | duration_ms 合算 |
| 生成 node 概数 | ~960 | 12 facets + port_log + debt_register |
| 生成 link 概数 | ~110 | realizes/affects/represents/inherits 等 |
| 編集ファイル (dev-docs) | 4 新規 + 1 改訂 | register/timeline/metrics/brainstorm |
| tmp/ スクリプト | ~18 個（削除保留） | rm 権限拒否 |

---

# 2. agent 実行統計 (post-compaction, 🟢)

| 統計 | 値 |
|---|---|
| 件数 | 17 |
| 最小 | 74 s (link batch / facet 4 dependency) |
| 最大 | 308 s (VectAlg deep rewrite, 828 行・14 長関数) |
| 中央値 | ~126 s |
| 平均 | ~142 s |
| 合計 | ~2,420 s |

## duration 分布（秒, sorted）

74, 74, 99, 99, 102, 105, 114, 126, 128, 129, 134, 146, 160, 166, 178, 180, 308

- 74-130s 帯が多数 → facet 1 枚の構築はほぼこのレンジに収束
- 178s (port_log harvest), 180s (Phase B calcTE), 308s (VectAlg) は「複数ファイル横断 or 深い再構成」のシグナル
- **1 facet ≒ 2 分**が運用上の基準値として使える

---

# 3. 種別別時間内訳 (post, 🟡 比率は概算)

| 種別 | agent秒 | 比率 | 人間時間(推定) |
|---|---|---|---|
| ingest (facet 構築) | ~1,580 | 65% | ~5 min（プロンプト書き） |
| ingest (ports / Wave 4-5) | ~600 | 25% | ~3 min |
| design (Phase B 深掘り) | 180 | 7% | ~5 min（方針議論） |
| tool_friction | 0 (agent外) | — | ~10 min（rm 拒否 / port_log 重複気付き） |
| discussion / decision | 0 | — | **~40 min** (debt 評価軸、0-idx、LaTeX、抽象度) |

**所見**: agent 実時間 < 議論時間。プロジェクト品質は人間の議論時間で決まる (timeline 所感と一致)。

---

# 4. facet 別コスト (🟢 duration, 🟡 node/link)

| facet | agent(s) | nodes | links | note |
|---|---|---|---|---|
| 0 root/1 core classes | pre | 13+ | — | Wave 1-4 ingest |
| 2 hierarchy | 102 | 20 | 5 inherits | alias 無子制約で折衝 |
| 3 call_flow | 99 | 17 | 17 represents | |
| 4 dependency | 74 | 25 | — | VectAlg=hub 特定 |
| 5 concepts | 99 | 28 | 7 realizes | **Should 達成マイルストン** |
| 6 impl_map | 128 | 25 | 7 bridges + 18 aliases | 最 link-rich |
| 7 dataflow | 114 | 26 | 10 | |
| 8 notation | 105 | 26 | 7 notation_of | |
| 10 verify | 146 | 28 | 17 | alias-as-source で詰まり |
| 12 progress | 126 | 36 | — | 最 node |
| — 2/4 link batch | 74 | — | 11 | 既存 call 再利用 |
| — port_log harvest | 178 | 58 | — | 最長 ingest |
| — Phase B calcTE | 180 | 17+ | — | 深掘り |
| — debt→map | 160 | 30 leaves | 28 affects | 本日最終 |

link batch / harvest / debt→map は **facet 跨ぎのため単独**。

---

# 5. 摩擦ポイント一覧（API/運用改善の種）

| # | 事象 | 頻度 | 影響 | 示唆 |
|---|---|---|---|---|
| F1 | `rm` 権限拒否 (tmp/*.mjs) | 多数 | tmp 18 ファイル残留 | skill/settings に **tmp/ 限定の delete allow** |
| F2 | alias `aliasOf` vs `targetNodeId` | 1回 | facet 2 で redo | data-model.md の例を強化（memory 済） |
| F3 | alias が GraphLink source 不可 | 1回 | facet 10 で redo | エラーメッセージに「target の id を使え」ヒント |
| F4 | PUT /api/maps → 405 | 1回 | facet 5 軽微 | skill に「POST only」明示済み、OK |
| F5 | port_log top-level と scopes/9 二重化 | 1回 | 運用混乱 | 自己規約違反 → port_log 運用のlint |
| F6 | full-state POST の race | — | facet は serial 化 | `?scope=` を**全 facet 操作で強制**にすると parallel 可 |
| F7 | compaction で pre 時刻損失 | 1回 | timeline 🔴 化 | 長セッションは中途で metrics 保存するのが安全 |
| F8 | agent 結果が main に来るまで block | 毎回 | 人間側 idle | foreground/background 判断を plan 段階で |

---

# 6. 生産性シグナル

- **並列 ingest の効力**: Wave 1-3 (9 class placeholder) はほぼ同時に起動 → 実時間 ~30 min で 9 ファイル分
- **serial 化コスト**: facet 2-12 を serial 化して ~15 min。`?scope=` 活用で 1/5 に圧縮可能（F6）
- **1 facet ≒ 2 min** (§2) がプランニングの単位として信頼可能
- **議論 1 epoch ≒ 5-10 min** (debt 評価軸、抽象度議論)。**agent で代替不可**

---

# 7. 戦略的示唆

1. **tmp/ の delete 許可** を settings に入れるだけでセッション末端のノイズが消える
2. **`?scope=` first 運用**: facet 単位の書き込みは常に scoped POST。並列化で総 ingest 時間 -50%
3. **metrics 中間保存**: 長セッションは 2h 毎に自動 timeline snapshot を dump する slot を設ける
4. **「1 facet 2 分」規約**: 超過は facet 分割 or class scope 過大のシグナル → 早期介入トリガー
5. **議論時間が総時間を支配**: agent 委任度を上げるほど「人が考える時間」の純度が上がる → 次 phase はこの方向で

---

# 8. 未完タスク（本セッション発）

- [ ] tmp/ クリーンアップ（手動）
- [ ] debt_brainstorm.md 削除（手動, supersedes 宣言済み）
- [ ] ingest_draft.md 削除（役割終了）
- [ ] port_log 二重化（top-level vs scopes/9）: ユーザー判断で据え置き、Phase B 入口で再検討
