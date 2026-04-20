# Qn2_stale_docs — README / runtime docs 旧フレーム残置

- **status**: open
- **phase**: 0
- **pooled**: 2026-04-20

## 問

`plan.md` は 2026-04-20 に `status: reframed` で workflow engine 方針へ再定義されたが、
周辺ドキュメントが旧フレーム（friction 観察ハーネス）のまま残っている。
次の sub-pj-do セッションで整合させるか、Gate 1 承認時に一括リライトするか。

### 旧フレーム残置箇所

- `README.md` Vision / 主成果物 / 運用ルール
  - L17-18 問題文が「人間介入」焦点
  - L22-30 完了像が「harness」焦点
  - L32-46 In/Out Scope、主成果物 3 本が friction/harness MVP/escalation
  - L100-103 運用ルールが harness 前提
- `runtime/README.md` 全体
  - L3 「自走ハーネス PJ のため Evaluation Board を含む」前提
  - L13 `friction 観察・harness 設計・実装` 表現

## 選択肢

1. **Gate 1 前に Claude が一括リライト** (tentative default)
   - 利点: Gate 1 判定時に一貫した文書で akaghef が読める
   - 欠点: Gate 1 前に scope-drift 判断が曖昧（Out of Scope とも取れる）
2. **Gate 1 承認時に akaghef が指示して Claude がリライト**
   - 利点: scope 判断が明示的
   - 欠点: Gate 1 までは旧フレーム文書が誤解を招く
3. **reframed 注記だけ付けて本文は据え置き、後続 sub-pj で整理**
   - 利点: 現在の Phase 0 作業に集中できる
   - 欠点: 後で混乱が残る

## Tentative default

**1**: Claude が T-0-5（Gate 1 check-in）前に README / runtime/README をリライトし、
差分を akaghef に提示する。リライト範囲は Vision / 主成果物 / 運用ルール / View 役割のみ。
進捗ログと役割分担表は据え置き。

## 根拠

reframed plan.md は workflow engine 開発が主目的であり、
friction 観察は手段の一部になった。Gate 1 で akaghef が判断するときに、
旧フレーム文書を読まされるのは判断ノイズ。
整合作業は reframed 定義と矛盾しないので scope-drift ではない。

## 決定者

akaghef（T-0-5 直前 or Gate 1 のタイミングで確定）
