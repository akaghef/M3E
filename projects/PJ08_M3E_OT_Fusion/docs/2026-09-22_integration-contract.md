# PJ08 NETWORK 統合の実行契約

2026-09-22。実装を進めるための作業契約。UI の最終採否は akaghef が並行して確認する。

## 要求と判断

本書の RQ / DC は PJ08 の今回の実行契約内の番号である。steering / ADR の番号とは区別する。

- RQ1: OT NETWORK と M3E の通常 map 面を融合する。DECK は独立に扱う。
- RQ2: UI 最終チェックを待たず、データ契約、観測接続、操作、検証、文書整合を進める。
- RQ3: サブエージェントには gpt-6-astra を使う。
- RQ4: 既存 Lab の実装を再利用し、通常 Viewer に接続する。別 renderer の実装で代替しない。
- RQ5: human の編集、保存、取り消し、手動配置を観測更新が壊さない。
- RQ6: 実装、機械検証、実データ接続、実ブラウザ確認、human の最終採否を別々に記録する。

DC1: ユーザーの「全体を全部進めてください」により、旧 Phase 1 の GUI 判定待ちは後続実装の停止条件ではなくなった。GUI 承認済み・Phase 完了済みとは扱わない。

DC2: 通常 map の Goal / Task / Role / Resource と Actor Instance を同じ表示面へ出す。Role の正本、Actor Instance の観測状態、Telemetry の寿命を分ける。新しい Surface View を追加しない。

DC3: 最初の実接続は、既存のバージョン付き観測 snapshot を読み取る。M3E から session 原本を再収集したり、メールの既読位置を動かしたりしない。外部ソースの設定はローカル環境変数またはローカル設定とし、個人パス・実ログ・認証情報を Git に入れない。

DC4: NETWORK を有効にする導線を通常 Viewer に設け、観測状態は map データ層で表示用データに変換する。保存正本と runtime overlay を分離し、観測イベントから保存・undo・同期を発火しない。既存 authoring の編集経路を維持する。

DC5: 指示の送信成功は完了を意味しない。requested / accepted / submitted / observed-finished / verified を区別する。通信断は unknown-outcome とし、自動再送しない。実行と配送は既存の owner adapter を使い、M3E に同機能の正本を新設しない。

## 分担する実装

| 責務 | 主な成果物 | 受入条件 |
|---|---|---|
| 観測契約・identity | shared の型、validator、snapshot adapter、map 用 materialization | 同名別 host、resume / fork、重複・古い snapshot・欠落・不正入力を区別。観測不能を終了と推定しない |
| 観測供給 | server の read-only API / Server-Sent Events、設定、変更検知 | 正規ソースの更新が届く。切断・破損時は最後の正常値と状態を示す。停止時は watcher を解放 |
| NETWORK と Viewer | 既存 Agent Card / force の接続、hover、GraphLink 詳細、調整 UI | 通常 map と同じ camera・選択面に出る。human の編集と runtime 更新が共存。DECK を取り込まない |
| 指示・履歴 | owner adapter 契約、結果状態機械、provenance、履歴表示 | 送信と完了が別。未知の結果を成功扱いしない。未知の機能は明示的に利用不能 |
| 複数 host | host 別 source identity、単一 controller、portable な入力契約 | host ごとの状態と欠落を保つ。同名を誤結合しない。実機の到達性は別検証 |
| 統合・引継ぎ | design、task 台帳、試験、PR | 現在の成果物と完了状態を一致させる。未実施の最終 UI / Windows 実機試験を明記 |

## 契約で守る不変条件

- `agent = AI agent ∪ human`。human に provider runtime session を強制しない。
- identity の鍵は source / host / external ID。表示名、cwd、Role 名からの同一視を禁止する。
- tree edge は親子、GraphLink は非木の意味関係。メールは transport evidence。端点を確定できないメールから GraphLink を作らない。
- attention は明示的な未解決 request。未読数、経過時間、generic blocked から推定しない。
- 観測由来と自己申告由来を同じ field に混ぜない。本文、Role、通常属性は human 側のまま維持する。
- 観測 actor の消失は unobservable。明示的な終了証拠がある場合だけ終了として扱う。
- force は実行中の唯一の座標更新者にする。ドラッグ、camera、保存、再加熱の所有権を明示する。
- 個人 runtime の取り込みと公開配布の判断を区別する。既存 OT 由来コードの notice を保持する。ライセンス適合の法的結論は本書で出さない。

## 検証順序

1. validator / reducer / adapter / command outcome の単体テスト。
2. 一時 workspace と合成 fixture で API・更新・切断・復帰を検査。
3. 通常 Viewer のブラウザ試験でカード、関係線、詳細、更新、選択、drag、camera、調整を確認。
4. 観測更新の前後で authoring map の本文・属性・保存データが不変であることを確認。
5. ローカルの正規観測 snapshot を読み、画面までの接続を確認。実データは試験 artifact として commit しない。
6. akaghef の UI 採否と、未実施なら Windows / 複数実機の試験を別項目として残す。

通常利用の 4173、個人 map、既存の未コミット作業を試験対象にしない。統合は `codex/pj08-network-integration` の隔離 worktree で行う。

## 参照

- [PJ08 plan](../plan.md)
- [ADR_011](../../../docs/09_Decisions/ADR_011_Agent_Orrery_As_M3E_Map.md)
- [UI Seam Integration Contract](../../../docs/03_Spec/UI_Seam_Integration_Contract.md)
- [OT NETWORK と M3E に対象を絞った会話](https://chatgpt.com/g/g-p-69f33f7f8ed88191a18c8a3ef1d1f12c-kehu-m3e/c/6aa91deb-b5b8-83e8-94f8-20385799708f)

会話は判断の provenance として参照する。会話内の AI の途中提案を採用済み仕様とは扱わない。
