# AI 利用シナリオ集

最終更新: 2026-04-02

## 目的

この文書は、M3E において AI をどのような場面で使うと価値が高いかを、
ユーザー視点のアイデアとして整理する。

ここで扱うのは確定仕様ではなく、
feature 検討・優先順位付け・UI 構想の材料である。

## 前提

- AI は正本の自動編集者ではなく、提案・変換・整理補助として使う
- ユーザーは思考の主体を維持したい
- AI が使えない状態でも基本操作は成立する

## 用法名

AI の使い方は、まず次の名前で呼ぶ。

### 1. Flash Intake

雑多な文書、ファイル、断片メモを
まず Flash に取り込む用途。

例:

- PDF やメモの内容を雑に取り込む
- ファイル群から素材を入れる
- まだ tree 構造を考えずに一時保管する

考え方:

- import の受け皿は基本的に Flash でよい
- この段階では整理より capture を優先する
- AI は抽出・要約・分解の補助として使う

向く機能:

- file import
- text extraction
- context package generation
- Flash -> Rapid 昇格支援

### 2. Rapid Expand

Rapid で考えている途中に、
いま見ている scope のアイデアをワンクリックで広げる用途。

例:

- 子観点を増やしたい
- 仮説の枝を広げたい
- 抜けている論点を見つけたい

考え方:

- 既に tree で考えている最中なので、対象は current scope に限定する
- 結果は subtree 差分として返す
- 1 クリックで候補を出し、採用はユーザーが行う

向く機能:

- outline-expand
- structure-proposal
- suggest-parent

### 3. Rapid Polish

Rapid で組んだ tree を、
壊さずに見やすく整理する用途。

例:

- ラベルを整える
- 重複を見つける
- 並びや親子関係の違和感を減らす

向く機能:

- title-rewrite
- duplicate-check
- suggest-parent

### 4. Deep Relay

ある scope を外部 AI に渡して、
レビューや再構成を受ける用途。

例:

- DeepSeek に論点レビューさせる
- scope を読みやすい linear/context に変換して渡す
- 提案を差分として持ち帰る

向く機能:

- linear-transform
- context-package
- proposal import
- diff-based apply

## 大きな利用カテゴリ

### 1. 構造化を速くする

ユーザーは最初から tree を丁寧に作るより、
まず断片や箇条書きを高速に書き出したいことが多い。

AI はその粗い入力を tree 構造へ寄せる補助に向く。

想定機能:

- linear -> tree 変換
- tree -> linear 変換
- outline expand
- context package generation

### 2. 整理の迷いを減らす

ノードが増えると、
どこへ置くか、どう名付けるか、何が重複しているかで迷う。

AI は「答え」より「候補圧縮」に向く。

想定機能:

- suggest-parent
- title-rewrite
- duplicate-check
- structure-proposal

### 3. 外部 AI との往復をしやすくする

Deep な検討では、
ある scope を外部 AI に渡して要約・批評・再構成を受けたい場面がある。

AI 基盤はそのための安全な送信・整形・取り込み口になる。

想定機能:

- context package export
- deep review
- proposal import
- diff-based apply

## ユーザー利用シーン

### シーン A: まず雑に書いて、あとで構造化したい

対応する用法名:

- `Flash Intake`

状況:

- 研究メモや発想を書き殴っている
- まだ親子関係を考えたくない

欲しいこと:

- 箇条書きや段落を tree へ変換したい
- 変換結果を見てから採用したい

向く AI 機能:

- `linear-transform`

価値:

- 入力速度を落とさずに構造化へ移れる

### シーン B: 既存 tree を外部 AI に読ませやすくしたい

対応する用法名:

- `Deep Relay`

状況:

- ある scope を DeepSeek や他モデルに見せたい
- 生の JSON では読ませにくい

欲しいこと:

- tree から readable な linear/context へ変換したい
- 送る範囲を scope 単位で制御したい

向く AI 機能:

- `linear-transform`
- `context-package`

価値:

- map を崩さずに外部 AI 対話へ接続できる

### シーン C: ノードの置き場所に迷う

対応する用法名:

- `Rapid Polish`

状況:

- ノードは書けたが、どの親の下に置くか迷う
- 似た候補が複数ある

欲しいこと:

- 親候補を 2-3 個出してほしい
- なぜその候補なのか短く説明してほしい

向く AI 機能:

- `suggest-parent`

価値:

- tree の整理コストを下げる

### シーン D: ラベルが長くて汚い

対応する用法名:

- `Rapid Polish`

状況:

- ノード text が長い
- 口語やメモ断片のままで見通しが悪い

欲しいこと:

- 短いラベル候補を複数ほしい
- 元の意味を壊したくない

向く AI 機能:

- `title-rewrite`

価値:

- map の可読性を上げる

### シーン E: 重複や近いノードを見つけたい

対応する用法名:

- `Rapid Polish`

状況:

- 同じような仮説や観察が増えてきた
- 手で見比べるのが重い

欲しいこと:

- 重複候補や類似ノードを教えてほしい
- 統合するかは自分で決めたい

向く AI 機能:

- `duplicate-check`

価値:

- tree の肥大化を抑える

### シーン F: ある scope をもう少し展開したい

対応する用法名:

- `Rapid Expand`

状況:

- 観点が足りない気がする
- たたき台だけほしい

欲しいこと:

- 子ノード案を差分として出してほしい
- そのまま採用ではなく選択採用したい

向く AI 機能:

- `outline-expand`
- `structure-proposal`

価値:

- 発想展開を加速できる

### シーン G: 雑多なファイルをとにかく材料として入れたい

対応する用法名:

- `Flash Intake`

状況:

- PDF、議事録、web からのコピペ、メモ断片が混在している
- どれが重要かまだ分からない

欲しいこと:

- まず Flash に流し込みたい
- 長文から箇条書き候補や断片カードを切り出したい
- source を保持したまま後で見返したい

向く AI 機能:

- `text extraction`
- `context package generation`
- `Flash -> Rapid 昇格支援`

価値:

- import 前の整理コストを減らせる

### シーン H: Flash に溜まった断片を Rapid に昇格したい

対応する用法名:

- `Flash Intake`

状況:

- Flash にメモが大量にある
- どれを structure に上げるべきか迷う

欲しいこと:

- 昇格候補をまとめて見たい
- 既存 tree のどこに入るか候補がほしい
- 類似ノードや重複も同時に知りたい

向く AI 機能:

- `suggest-parent`
- `duplicate-check`
- `title-rewrite`

価値:

- Flash が単なる墓場にならず、Rapid へ流し込みやすくなる

### シーン I: scope の抜け論点を短時間で洗いたい

対応する用法名:

- `Rapid Expand`

状況:

- 今の subtree は一応できている
- ただし抜けている観点がありそう

欲しいこと:

- 「足りない観点」だけを追加候補で見たい
- 現在の枝を壊さずに補完案を受けたい

向く AI 機能:

- `outline-expand`
- `structure-proposal`

価値:

- 短時間で観点漏れチェックができる

### シーン J: 行き詰まったときに別方向の切り口がほしい

対応する用法名:

- `Rapid Expand`

状況:

- 同じ観点で考え続けて煮詰まっている
- 新しい軸だけ欲しい

欲しいこと:

- 既存の子ノードを増やすのでなく、別の分類軸を提案してほしい
- その場で 3-5 個だけ軽く出してほしい

向く AI 機能:

- `outline-expand`
- `structure-proposal`

価値:

- 思考停止から抜けやすくなる

### シーン K: subtree の並び順に違和感がある

対応する用法名:

- `Rapid Polish`

状況:

- 内容はある程度揃っている
- ただし sibling 順が読みづらい

欲しいこと:

- 並び替え候補を理由付きで見たい
- 採用前に差分だけ確認したい

向く AI 機能:

- `structure-proposal`

価値:

- map の読み順が改善する

### シーン L: subtree を人に見せる前に言い換えたい

対応する用法名:

- `Rapid Polish`

状況:

- 自分向けの雑なラベルで書いてきた
- 共有前に少し整えたい

欲しいこと:

- 専門用語を揃えたい
- 曖昧なラベルを比較可能な表現にしたい

向く AI 機能:

- `title-rewrite`

価値:

- 共有品質を短時間で上げられる

### シーン M: scope 単位で要約レビューを受けたい

対応する用法名:

- `Deep Relay`

状況:

- ある論点の subtree は育っている
- でも全体として何が言えているかを外から見たい

欲しいこと:

- scope を要約してほしい
- 強い点と弱い点を指摘してほしい
- 欠けている論点を返してほしい

向く AI 機能:

- `context-package`
- `deep review`

価値:

- self-review を加速できる

### シーン N: 外部 AI の返答を差分で持ち帰りたい

対応する用法名:

- `Deep Relay`

状況:

- DeepSeek に相談した
- 返答の全部を鵜呑みにはしたくない

欲しいこと:

- 返答を subtree 差分として見たい
- 追加、移動、言い換えを分けて見たい
- 部分採用したい

向く AI 機能:

- `proposal import`
- `diff-based apply`

価値:

- 外部 AI の活用と M3E の正本管理を両立できる

### シーン O: 研究ログから論点候補だけを抜きたい

対応する用法名:

- `Flash Intake`

状況:

- 日報、調査ログ、会議メモが長い
- 全文を tree に入れたいわけではない

欲しいこと:

- 論点候補だけ抽出したい
- action、仮説、観察を分けてほしい

向く AI 機能:

- `text extraction`
- `Flash -> Rapid 昇格支援`

価値:

- 長文から structure の種だけを拾いやすくなる

### シーン P: いまの subtree を別表現で眺めたい

対応する用法名:

- `Deep Relay`

状況:

- tree のままだと見えにくい
- 一度 linear や文章で眺めたい

欲しいこと:

- current scope を別表現へ変換したい
- 表現を見比べて structure の歪みを見つけたい

向く AI 機能:

- `linear-transform`
- `context-package`

価値:

- 表現変換が思考点検になる

## 優先順位の考え方

初期に価値が出やすい順は次の通り。

1. `linear-transform`
2. `title-rewrite`
3. `duplicate-check`
4. `suggest-parent`
5. `outline-expand`
6. `structure-proposal`
7. `context-package` の双方向化

理由:

- Flash への intake は import 導線と相性がよい
- Rapid 中の one-click 展開は体験価値が高く、AI らしさが出やすい
- まず変換と軽い整理補助が最も日常頻度が高い
- 親候補や構造提案は価値が高いが、誤提案時の UI と承認設計が重い
- 双方向の deep 往復は最後に統合するのが安全

## UI の示唆

この文書から見える UI の示唆:

- AI は常時自動実行より、明示操作のほうが合う
- 提案は「採用/棄却/保留」がしやすい形で出すべき
- 変換はプレビュー付きがよい
- 送信範囲は scope 単位で見せるべき
- 失敗時は手動操作へすぐ戻れるべき

## 非目標

- AI に map 全体を自律編集させること
- provider 固有機能をそのまま UI に出すこと
- ユーザー承認なしで subtree を置換すること

## 関連文書

- `./AI_Integration.md`
- `./AI_Common_API.md`
- `../04_Architecture/AI_Infrastructure.md`
