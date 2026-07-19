# ADR 009: Agent Orchestration の M3E 融合と実行境界

## Status

Accepted.

## Date

2026-07-19

## Context

agent orchestration の可視化・管理は 3 箇所に分散して進行していた:

- **Track U**(本 repo): orchestration board seam(計画平面: Goal / Task / Agent / Gate の projection JSON を読む read-only board)。U1 実装・検証済み
- **codex-agent-mapping スレ**(`codex://threads/019f6177-dff2-7d71-9fc2-948ef53b246a`): 実行平面の semantic model が収束(Agent = Session 1:1 絶対・機械採番、(team, agent_name) は mailbox アドレスであって個体識別ではない、edge は runtime 層 = mailbox 接続状態 / semantic 層 = 不変の会話履歴の二種、同一 Message を複数 Session が受信したら semantic edge も複数)
- **playground/agent-orrery**(:39283): 実行平面 view のプロトタイプ(d3-force)。mock データ

データ供給(Mapify 課金枠)はボトルネックではなく、チーム開発としての統合・方向付け = orchestration が本質課題である、というプロダクト軌道修正判断(2026-07-19)が上位にある。散乱の原因は同一製品線の front と backend が別スレで別々に進んだことにあり、凝集先を決める必要がある。

## Decision

### 1. M3E repo を凝集先とする

codex-agent-mapping スレの最終時点で成立した範囲(semantic model + Orrery UI 相当)を M3E に組み込む。playground/agent-orrery は参照実装に降格し、正本の view は M3E 内に置く。

### 2. 実行平面の UI は Disperse 解釈で実現する

agent network は既存 Surface View canon の **Disperse** 解釈として orchestration seam(U1 で実装済み)に載せる。新 Surface View 名は新造しない。force layout は projection 生成時に backend で計算し座標をデータとして焼き込む(seam は静的描画のまま。viewer hot path で live simulation しない)。

### 3. backend は out-of-process plugin として成立させる

projection(materialization、provenance 必須)を産出・提供するプロセスを M3E plugin と呼ぶ。viewer への in-process 拡張点は作らない。plugin の障害は board の劣化(古い projection)に留まる。汎用 plugin API の発明は実需 query 3 件が揃うまで凍結。

### 4. 現行 agent 監視 runtime は別 lane

Hermes db / Claude jsonl / Codex rollout の live 観測 adapter 群は本決定の範囲外とし、別 lane で議論する。本決定で組み込むのはスレ最終時点の成立範囲のみ。

### 5. Neo4j は正本採用しない。用語法・クエリ仕様の整合は維持する

ADR_008 の gate を維持し、この段階で Neo4j を canonical store に昇格しない。ただし relation 語彙(大文字動詞)、graph 意味論、query 形状は Neo4j / Cypher 互換に寄せ続け、将来の採用が「projection 生成元の差し替え」で済む状態を保つ。runtime 層で新造された語彙(MESSAGE / CONNECTED_TO、正規化イベント 8 種)は組込み前に Glossary / Command_Language 対応表へ登録する。

### 6. 実行境界: 仕様 = Claude、実装 = Codex。PDCA の D/C は一括単位、目視確認まで Codex

役割分担は front/backend ではなく 仕様・管理(Claude Director) / 実装(Codex) を維持する。PDCA の Do と Check はなるべく一括バッチで回し、**機能の目視確認まで Codex の実行範囲に含める**(browser 検証可能な Codex セッションを用いる)。akaghef は操作感・UX の最終判定 gate として残る(agent 自己判定で UX 完了扱いにしない原則は不変)。

## Consequences

- Track D pilot handoff のうち「Neo4j canonical runtime の初適用」は本 ADR により保留。語彙・policy 整合部分のみ有効
- Track U seam は計画平面・実行平面の両 projection を受ける共通表示面となる(U4 の合流設計と同一線上)
- Orrery 相当の M3E 組込みは Codex への実装 handoff とし、D/C 一括 + 目視確認込みの新実行境界を初適用する
- 二平面の join(mailbox ラベル ↔ Session)は cross-plane edge として後続スライスで扱う
