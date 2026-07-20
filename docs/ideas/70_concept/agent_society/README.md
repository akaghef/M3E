# エージェント社会論（Agent Society） — 「会社」が群個体のマップになる

2026-07-19〜20、Track U orchestration board の設計・実装・akaghef レビューを通じて
自然発生した思想ブレスト。**個別機能案ではなく、M3E が最終的に何を写す道具になるか**
という射程の長い命題を扱う。

## 出発点（会話ログからの直接引用要約）

- 「agent orchestration system は即効性が高く、良い仕組みのままスケールアップすれば
  チームの orchestration も相似形として出来る」（2026-07-20 冒頭）
- 「inko は agmsg の上位となるはず。人間は上流化するので、各自が AI agent の組織を伴う。
  "人" の単位のクラスターに agent の node があり、その群個体のクラスターが沢山有るマップが
  会社になっていきそう」（2026-07-20）
- 「agmsg は素晴らしいシステムだよね。ゆくゆくはチームの人間同士も inko が繋いで、
  より低レイヤでは sync と agmsg が繋ぐスタイルが一般的に成るはず」（同日）

3 発言を繋ぐと 1 本の線になる: **agent 統制の実践 → プロトコル層の一般化 → 組織構造そのものの
再定義**。この folder はその線を思想として展開する。

## 中核命題（As0）

> 会社とは、部門でも階層でもなく、**「人」を核とする agent クラスターの群れが
> 約束(commitment)の edge で結ばれた 1 枚のマップである。**

対立命題: 会社は職務記述書と報告系統(組織図)によって定義される — 静的な木構造。
群個体モデルは組織図を **観測結果の一つの投影** に格下げする。組織図が正本ではなく、
実際に交わされた約束の graph が正本になる。これは M3E の一貫した立場
（[philosophical/Q1 未完成原則](../philosophical/01_unfinished_principle.md) —
完成した構造より生成過程を正本にする）の組織論への拡張でもある。

## 方針

- 採否は決めない。各節で対立案・代替トポロジーを併記する
- 実装詳細は最後のファイルにのみ参考程度で置く
- 「思想のための思想」にしない。各命題に **今週の Track U/ADR_009 のどこに効くか** を必ず添える
- 個人の A-sys/M3E 二層構造（今日確定した RQ4 の帰属境界）を **会社スケールへの最小実証**として扱う

## ファイル構成

- [README.md](README.md) — 本索引、中核命題、全体俯瞰
- [01_layer_stack.md](01_layer_stack.md) — As1: inko/agmsg/sync 3 層プロトコルスタックの一般化
- [02_person_as_interface.md](02_person_as_interface.md) — As2: 人 = クラスターのインターフェース、
  agent 組織 = カプセル化された private 実装
- [03_company_as_map.md](03_company_as_map.md) — As3: 会社 = クラスター群のマップ、
  edge = 約束(commitment)、計画平面 gate 意味論の組織スケール昇格
- [04_boundary_and_scoped_channel.md](04_boundary_and_scoped_channel.md) — As4: projection を
  「境界壁」として一般化、クラスター横断直結という未決の設計問題
- [05_cross_cutting_and_roadmap.md](05_cross_cutting_and_roadmap.md) — 横断観察・
  既存 ADR/要求定義との接続表・短期/中期/長期の実装可能性ロードマップ・未決質問

## 全体俯瞰

```
                    As0 中核命題（会社=群個体マップ、edge=約束）
                            │
        ┌───────────────────┼───────────────────┐
        ↓                   ↓                   ↓
   As1 層スタック       As2 人=界面           As3 会社=マップ
  (inko>agmsg>sync)   (agent組織の            (edge=約束、
   プロトコル一般化      カプセル化)            gate意味論の昇格)
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ↓
                    As4 境界壁と未決チャネル問題
                  (projection契約 = 主権の実装形)
```

- **As1 は基盤**: 3 層分離がなければ As2 のカプセル化は技術的に支えられない
- **As2 は境界の定義**: 「人がインターフェース」という主張の技術的裏付け
- **As3 は帰結**: As1+As2 が成立した状態で観測すると、会社は自然に As0 の形に見える
- **As4 は今回唯一の開放問題**: As2 のカプセル化を、効率化の圧力に対してどこまで守るか

## 既存資産との接続

| 既存 | 接続点 |
|---|---|
| [ADR_009](../../../09_Decisions/ADR_009_Orchestration_Fusion_Into_M3E.md) | backend=out-of-process plugin 契約が As4 の技術的雛形 |
| [requirements_agent_dialogue_monitor_260720.md](../../../tasks/requirements_agent_dialogue_monitor_260720.md) | RQ4(backend=A-sys帰属、M3E=表示面)が As2/As4 の**個人スケールでの実証第一号** |
| [50_collab/collaboration](../../50_collab/collaboration/README.md) | 人↔人・人↔エージェント・エージェント↔エージェントの3軸整理と As2/As3 が直結 |
| [20_ai/ai_agent_deep](../../20_ai/ai_agent_deep/README.md) | C9 エージェント・ペルソナは「1人が複数agentを従える」の個体内バージョン。As2 はそれを人単位に外挿 |
| [philosophical/01_unfinished_principle](../philosophical/01_unfinished_principle.md) | 組織図(完成した構造)より約束グラフ(生成過程)を正本にする、という Q1 の組織論拡張 |
| codex-agent-mapping スレ (`019f6177`) | Agent=Session 1:1、mailbox≠個体識別 という semantic model が As1/As2 の実装済み先行事例 |

## キーメッセージ（先取り）

- **層を分けると主権が守れる**。inko/agmsg/sync の分離は効率のためではなく、
  「何を見せて何を見せないか」を各層で独立に決められるようにするための構造（As1）
- **人がインターフェースであることは、agent 組織を実装詳細にする**。これは
  隠蔽ではなく責任の所在を明確にする設計（As2）
- **組織図ではなく約束の graph が正本になる。** 会社マップの edge は「報告する/される」
  ではなく「何を約束したか」。これは計画平面(Goal/Task/Gate)の語彙をそのまま持ち上げられる（As3）
- **今日確定した個人の backend/surface 分離(RQ4)は、会社版群個体モデルの最小実証。**
  1 人分の境界壁がうまく機能すれば、それが N 人・N クラスターに複製できるという検証手順が
  既に走っている（As4）
- **唯一の開放問題はクラスター横断の直結。** 効率化の圧力は必ず「agent 同士を直接繋げたい」
  という要求を生む。これを許すとカプセル化が崩れる。解の方向性は「人の承認で開通し、
  開通の事実自体が inko 層のコミットメントとして記録される scoped channel」（As4 で詳述）
