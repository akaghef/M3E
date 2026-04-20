# Qn_initial — workflow runner timer host choice

- **status**: resolved (akaghef approved 2026-04-21 at Gate 1, option 3: ScheduleWakeup + CronCreate 併用)
- **phase**: 0
- **pooled**: 2026-04-20
- **resolution-proposed**: 2026-04-21 — T-0-3 `legacy_asset_mapping.md` に「ScheduleWakeup = one-shot sleeping / CronCreate = 繰返し sleeping」として反映済。`WorkflowNode` の `wakeup_mechanism` tag で区別する方針を T-1-1 で型化。Gate 1 で akaghef が option 3（併用）を正式確定する前提。

## 問

自走ハーネスのトリガー基盤を何にするか。

## 選択肢

1. **ScheduleWakeup dynamic /loop** のみ
   - 利点: Claude Code 内で完結、追加依存なし
   - 欠点: セッション起動中しか効かない。バックグラウンド continuity 弱
2. **CronCreate（Remote Trigger）** を併用
   - 利点: Claude Code がアイドルでも発火可能
   - 欠点: 設定 overhead、リモート環境依存
3. **両方を役割分担**
   - inner loop = ScheduleWakeup, outer monitor = Cron

## Tentative default

**3 の両方併用**。Phase 0 の harness_mvp_spec で確定させる。

## 根拠

inner loop は短周期（数分）で cache を温存、outer monitor は長周期（時〜日）で
人間不在時の再開を担当する。役割が直交するので併用が自然。

## 決定者

akaghef（Gate 1 のタイミングで確定）
