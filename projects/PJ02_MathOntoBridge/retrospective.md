# PJ02 MathOntoBridge — 振り返り

PJ02 固有の反省・改善点を追記していくファイル。

---

## 2026-04-17: PJ 立ち上げ

### やったこと
- 正式登録（採番 PJ02、ブランチ `prj/02_MathOntoBridge`、DEV map 登録）
- ビジョン策定: semantic tree + syntax tree の dual-tree architecture、foundation スコープ
- prior_art.md に既存考察 5 本を集約

### 反省
- 最初 `docs/projects/` に作ってしまい、ユーザーの指示で `projects/` に移動。ディレクトリ規約を事前確認すべきだった
- ビジョンが「外部サービス全接続」→「edge protocol foundation」に絞られるまで数往復かかった。最初からユーザーに「何が痛いか」「何がスコープ外か」を聞くべきだった
- 名前 MathOntoBridge の "Bridge" が実態（foundation / edge protocol）と若干ずれている。リネームするか要検討
