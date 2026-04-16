# M3EのAI協働に関する知見整理

会話の中で得られた知見を整理すると、M3Eは単なるマインドマップではなく、人間と複数のAIが同じ構造を共有しながら仕事を進めるための共同作業基盤として捉えるのが適切である。ユーザーは技術スタックそのものを把握する必要はなく、可視化されたワークフローと判断根拠を見たい。一方で、下位層ではAIが計画、実装、要約、検証、セキュリティ確認を分担し、全体を支える。この意味で、M3Eの本質は「AIを使うツール」ではなく、「AIと人間が同じ白板の上で認識を揃え、承認しながら進める環境」である。

そのため、中心になるのは個々のAIの賢さそのものではなく、役割分担と統合の仕組みである。会話からは、少なくとも planner AI、worker AI、security AI、要約や情報収集を担う中間AIが必要だという像が見えた。特に planner AI は、ユーザーの意図を受けて木構造を拡張し、下位AIへ問いを分配し、返ってきた結果を比較・統合し、十分な確信度に達した段階でユーザーへレビューを返す役割を持つ。この考え方は、M3Eの既存設計にある「AIは提案し、人間が確定する」という原則と一致している。AI出力は正本を直接変更せず、提案や差分として提示されるべきである。

このとき最大の障害として見えているのは、実装そのものよりもレビューの負荷である。コード生成や個別作業の自動化は進んでも、設計や技術選定の妥当性を人間が確認する工程は依然として重い。したがって、M3Eが解くべき主要課題は、ワークフローと判断理由を可視化し、どこまで確信が高まったかを明示することで、レビューの意思決定を速めることである。会話では、mind map への記述が承認の記録となり、各ノードに reliability や confidence のようなメタ属性を持たせ、出典を見つけることで信頼度を上げるという方向が示された。これは構造にメタ情報を重ねる設計として自然である。

第二の障害は、複数AI間の文脈整合である。planner、implementer、reviewer が別々に動く場合、全員が同じ目的、制約、最新決定を共有できていなければ、部分最適な結果が増える。会話では、この整合を保つ媒体としてマインドマップが位置づけられた。つまり、mind map は単なる表示ではなく、意思決定の正本、共有コンテクスト、レビュー対象、承認履歴を兼ねる。M3Eの既存仕様でも、単一の実体構造を帯域や表示密度の違いとして扱う設計が置かれており、構造を一つに保つ発想と合う。

また、会話からは「各AI workerとユーザーがローカルな mind map を持ち、それを統合木へ push し、最終的に cloud 側で統合する」という運用像も現れた。これは将来の共同編集モデルの原型だが、同時に編集整合性と差分表現が中核課題になることを示している。既存設計では、M3Eの主構造は親子ツリーであり、Undo/Redoや差分比較のためにコマンドベースの変更履歴を持つべきとされている。さらに、ドラッグ中はModelを書き換えずViewStateだけで追従し、確定時だけCommandを発行する設計が整理されている。これは将来、差分比較や共同編集に耐えるための重要な前提である。

特に重要なのは、木構造の差分可視化が未解決の核心問題だという認識である。会話では、通常の文書diffのように木の変化を直感的に示すことが難しいため、時間や版を「レイヤ」として重ね、前後比較を比較軸として扱う案が出た。この発想は有力である。既存仕様でも、Deep帯域では差分比較や思考の進化追跡を将来可能にすることが明記されており、全変更をコマンドとして記録する方向が示されている。したがって、M3Eにおける tree diff は、単純な before/after の比較ではなく、レイヤ化された履歴、構造単位の差分、承認状態、信頼度の変化を同時に見る仕組みとして設計すべきだと分かる。

AIの実体についても知見が得られた。会話では、AIは単なる「処理の列」ではなく、チーム内の一員のように振る舞う存在として考えるべきだという認識に至っている。これにより、M3Eは GitHub、Obsidian、Miro の要素を統合したものとして捉え直される。すなわち、GitHubのような履歴と統合、Obsidianのような知識蓄積、Miroのような共有白板を、AIとの協働前提でまとめる方向である。ただし、既存文書では現時点の主眼は独自エディタの完成ではなく、まずは Freeplane を土台に思考支援の有効性を検証することに置かれている。したがって、当面は「全部を一気に作る」のではなく、既存の構造表現基盤の上に、AI支援、構造変換、差分提示、レビュー支援を重ねる方針が現実的である。

さらに、Gmail閲覧・通知の自動化という具体例から、M3Eは実務フロー設計にも適用できると分かった。ここでは、vision を受けて planner が分解し、implementer が技術スタックとコードを出し、security が検査し、結果をユーザーがレビューする。問題は polling のような待機方式がコストを増やすことであり、イベント駆動や callback 的な方式が望ましいという認識も共有された。この点は、M3EのAIインフラ設計とも整合する。既存設計では、AI呼び出しは共通APIとsubagentで抽象化し、browserが直接providerを叩かず、失敗時は fail-closed にすることが定められている。つまり、Gmail自動化のような外部連携も、個別に作るより「共通のAI基盤の上で feature として差し込む」べきだと整理できる。

要するに、この会話から固まった知見は次の通りである。M3Eの中核価値は、AIに処理させること自体ではなく、複数AIと人間の協働過程を一つの構造上に可視化し、信頼度と承認状態を持ったまま前進できることにある。最大の障害はレビュー負荷、次が文脈整合であり、それを解くために、mind map を承認の正本・共有コンテクスト・差分比較基盤として扱う必要がある。差分可視化はレイヤ比較として再定義するのが有望であり、実装戦略としては、まず既存基盤を活用しながら、AI提案、構造変換、差分提示、レビュー支援を先に成立させるのがよい。これが現時点で最も筋の通った整理である。

# 構造スニペットと同義語木のアイデア


会話の中で得られた知見を整理すると、まず中心にあるのは「反応のような単発の信号だけでは、ユーザーの本当の意図や感情は十分に分からない」という認識である。ユーザーがある投稿に反応したとしても、それは継続的な嗜好を示しているとは限らず、単に珍しかった、気になった、その場だけ興味を持った、という可能性がある。したがって、AI が一回の反応をそのまま長期的な好みとして学習すると、解釈を誤る危険がある。ここで重要なのは、反応そのものの情報量が少ないという点であり、解釈には文脈、頻度、継続性、他の行動との関係が必要である。

この問題は、短い信号から意味を読み取る問題として抽象化できる。会話の中では、感情を反応だけから読むことは、モールス信号のような限られた符号から意味を解釈することに近いという見方が出てきた。つまり、表面の信号だけを見ても意味は確定せず、背後にある文脈や体系があって初めて適切な理解が可能になる。この比喩によって、AI の記憶や推薦において「弱い信号をどう扱うか」が本質的課題であることが明確になった。

次に、M3E の中核機能として、語の同義語を木構造で保持する発想が出てきた。通常の検索は表記に強く依存するため、同義語や近い表現をうまく拾えないことが多い。しかし、同義語の関係を構造として保存しておけば、AI はその構造を読んで検索語を展開できる。これにより、大量のコードや大量のデータの中から、表現の違いを越えて必要な情報を見つけやすくなる。これは単なる辞書ではなく、意味的な近傍やニュアンスの差も含めて保持できる知識基盤として位置づけられる。

さらに、木構造の中に「構造スニペット」を保存し、それをテンプレートとして再利用するという考えも重要である。これはフレームワーク思考を支える仕組みであり、過去に有効だった論点整理の型、問題分解の型、比較の型をツリーとして保存し、新しい問題に対して呼び出せるようにするものである。これにより、毎回ゼロから考え始めるのではなく、既存の思考の型を土台にして新しい問題を整理できる。M3E は単なる情報保存ではなく、思考手順そのものを再利用可能にする環境として設計できる。

AI orchestration については、タスクを木のノードのように定義し、それぞれの処理を分担する複数の AI モジュールに割り当て、それらの流れを管理する層が必要だという理解に至った。ここで本質なのは、個別の AI を呼ぶことではなく、誰が何を処理し、どの順に結果を渡し、どこで統合するかを定める制御構造である。したがって、必要なのは単体のモデルではなく、タスク分解、依存関係、実行順序、再実行、失敗処理を含む仕組みである。

最後に、そのような「コードを書いて自動で実行させる仕組み」を技術的にどう抽象化するかという点では、会話の中で workflow automation または orchestration という見方が確認された。つまり、AI 活用を単なる一回の応答生成としてではなく、複数の処理を定義し、自動実行し、条件分岐し、結果をつなぐ実行系として扱う必要がある。M3E の将来像としては、木構造が単なる表示形式ではなく、意味構造、同義語構造、テンプレート構造、タスク構造を統合し、それを AI が読み取って支援・変換・実行する基盤になる、という方向が見えてきた。



# 固定費と戦略

**User:** Anonymous (kawami.s.aa@m.titech.ac.jp)  
**Created:** 4/3/2026 19:29:22  
**Updated:** 4/5/2026 17:04:21  
**Exported:** 4/7/2026 21:27:59  
**Link:** [https://chatgpt.com/g/g-p-69a7967bc9a88191915a53f767d5aec1-akaghef-m3e/c/69cf962c-cd60-83a5-b019-5f306b1ef798](https://chatgpt.com/g/g-p-69a7967bc9a88191915a53f767d5aec1-akaghef-m3e/c/69cf962c-cd60-83a5-b019-5f306b1ef798)  

## Prompt:
2026/4/3 19:29:19

M3Eマーケ.txt

ドキュメント

販売戦略だけど、固定費掛かるなら、先に資金を用意しといてユーザーをどかっと伸ばすほうがいいんかね？起業分からん

## Response:
2026/4/3 19:29:20

結論から言うと、その戦略は条件付きで正しい。無条件には危険。

まず整理する。

**① 固定費がある場合の基本構造**

固定費があると、損益分岐点が決まる。  
したがって、

*   少数高単価
*   多数低単価

のどちらかで回す必要がある。

「先に資金を入れてユーザーを増やす」は後者の戦略。

* * *

**② その戦略が成立する条件**

成立するのは以下の場合のみ。

*   ネットワーク効果がある  
    （ユーザーが増えるほど価値が上がる）
*   またはスイッチングコストが高い  
    （一度使うと離れにくい）
*   または後から確実に課金できる  
    （例：SaaS、課金機能）

このどれもない場合、単に赤字を拡大する。

* * *

**③ M3Eの場合の構造**

現状の設計だと、

*   個人利用（オフライン主体）
*   初期は無料/低価格想定
*   同期や共有は後から追加
    M3E仕様設計書

なので、

**ネットワーク効果は弱い**

つまり  
「先にユーザーだけ増やす」は効きにくい。

* * *

**④ より現実的な順序**

M3Eならこうなる。

1.  小さく作る（固定費ほぼゼロ）
2.  コア価値を検証
3.  有料機能（同期など）を追加
4.  そこで初めてスケール

つまり

**先に資金 → ユーザー拡大ではなく、  
先に価値 → 小さく課金 → 拡大**

* * *

**⑤ 例外**

逆に、こういう構造なら先行投資OK

*   チーム共有（マルチユーザー）を早期にやる
*   共同編集などでネットワーク効果が出る
*   SaaSで月額が明確に回収できる

この場合は

「資金 → ユーザー → 収益化」

が成立する。

* * *

**まとめ**

*   固定費がある → スケール戦略は必要
*   ただし
    *   ネットワーク効果 or 継続課金 がないと破綻
*   M3E現状はその条件を満たしていない
*   よって最初はスケールより検証優先

* * *

一言で言うと、

**今の段階でユーザーを増やすこと自体には意味が薄い。  
課金できる構造を先に作る必要がある。**

📋

## Prompt:
2026/4/3 19:31:48

利益構造的にどういう戦略を取ればいいの？
徐々にユーザー増やすか、どかっと売り込みして一気に増やすか

## Response:
2026/4/3 19:31:48

結論だけ述べる。

**現状のM3Eは「徐々に増やす」以外は成立しない。**

* * *

理由を構造で整理する。

**① 利益構造の型**

ビジネスは基本的に3種類に分かれる。

1.  低固定費・単発課金  
    　→ 徐々に伸ばす型
2.  高固定費・サブスク  
    　→ ある程度まとめて獲得する型
3.  ネットワーク効果型  
    　→ 一気に拡大が必要

* * *

**② M3Eの現在位置**

仕様上は

*   個人利用中心
*   オフラインファースト
*   同期は後付け
*   OSS寄り思想
    M3E仕様設計書

この時点で

*   ネットワーク効果：弱い
*   継続課金：まだ弱い
*   固定費：小さくできる

→ **①の型（徐々に伸ばす）に該当**

* * *

**③ 「一気に増やす」が成立する条件**

次のどれかが必要。

*   使う人が増えるほど価値が上がる（例：SNS）
*   チームで使う前提（例：Slack）
*   明確な月額収益モデルがある（例：SaaS）

これがない状態で広告や営業をかけると、

*   CAC（獲得コスト）＞LTV（回収額）

になって赤字拡大になる。

* * *

**④ 現実的な戦略**

段階で分ける。

**Phase 1：検証（今）**

*   個人ユーザーを少数獲得
*   強いユースケースを特定
*   最小の課金（例：同期アンロック）

**Phase 2：収益化**

*   有料機能を明確化
*   LTVを測定
*   継続利用が発生するか確認

**Phase 3：拡大**

*   ここで初めて広告・拡販
*   チーム機能があれば一気に伸ばせる

* * *

**⑤ 判断基準**

どちらを選ぶかはこれだけで決まる。

*   1ユーザーあたりの回収額が読めるか
*   使い続ける理由があるか
*   他人を巻き込む構造があるか

今のM3Eはまだここが未確定。

* * *

**まとめ**

*   現段階：徐々に増やすしかない
*   一気に増やすのは「課金構造が成立してから」
*   順番を間違えると、ユーザーが増えるほど損する状態になる

* * *

補足として重要な点を1つだけ。

**「ユーザー数」ではなく「有料化できた人数」を指標にするべき。**

📋

## Prompt:
2026/4/3 19:32:54

俺の利益に関しての一般論って有るのか？

## Response:
2026/4/3 19:32:55

ある。かなり単純な式に落ちる。

* * *

**① 基本式**

利益 ＝ 売上 − コスト

もう少し分解すると

利益 ＝（単価 × ユーザー数）−（固定費 ＋ 変動費）

これがすべて。

* * *

**② 重要なのはこの2つだけ**

**1¥. LTV（1人からどれだけ回収できるか）**

*   買い切りなら価格
*   サブスクなら 月額 × 継続期間

**2¥. CAC（1人獲得するコスト）**

*   広告費
*   時間（開発・営業含む）

* * *

**③ 成立条件**

LTV ＞ CAC

これを満たさないと、ユーザーが増えるほど赤字。

* * *

**④ 戦略の分岐**

この比率で全部決まる。

**LTV が大きい場合**

*   広告を使って一気に拡大できる
*   1人あたりで回収できるから

**LTV が小さい場合**

*   自然流入・口コミで増やすしかない
*   広告を使うと赤字になる

* * *

**⑤ よくある3パターン**

**① 高単価・低ユーザー**

*   例：業務ツール
*   少人数でも成立

**② 低単価・大量ユーザー**

*   例：アプリ
*   スケール必須

**③ サブスク型**

*   継続で回収
*   最も安定

* * *

**⑥ M3Eに当てはめると**

現状は

*   低価格（想定）
*   個人向け
*   継続課金弱い

→ LTVが低い構造

だから

*   広告で一気に増やすのは不利
*   まずLTVを上げる必要がある

* * *

**まとめ**

利益の一般論はこれだけ。

*   利益 ＝ 単価 × 人数 − コスト
*   LTV ＞ CAC が成立条件
*   戦略はこの比率で決まる

これ以上の議論はすべてこの変形に過ぎない。

📋

## Prompt:
2026/4/3 19:34:13

それはそうなんだけど、単価設定の意図、というか。需要と供給で決まる？それは俺が決めること？

## Response:
2026/4/3 19:34:13

結論だけ整理する。

**価格は「需要と供給」だけでは決まらない。  
実務では「価値に対してどこまで取るか」を自分で決める。**

* * *

**① 誰が決めるのか**

最終的に決めるのは売り手（あなた）。  
ただし、

*   高すぎる → 売れない
*   低すぎる → 利益が出ない

ので、

**市場が「許容する範囲」をテストして探る**のが実態。

* * *

**② 価格の決まり方（実務）**

3つの軸で決まる。

**1¥. 価値ベース（最重要）**

*   ユーザーにとってどれだけ意味があるか
*   時間短縮、ストレス減、成果向上など

**2¥. 競合・代替**

*   無料ツール（Obsidianなど）
*   他の思考ツール

**3¥. コスト**

*   最低ラインを決めるだけ（これ以下は無理）

* * *

**③ 需要と供給の位置づけ**

*   市場全体では「需要と供給」で価格帯は決まる
*   個別プロダクトでは「その範囲のどこを取るか」を決める

つまり

**市場がレンジを決めて、あなたが位置を選ぶ**

* * *

**④ 単価設定の意図（ここが本質）**

価格は単なる金額ではなく、

**誰を切り、誰を残すかのフィルター**

になる。

例：

*   300円 → 誰でも使うが継続率低い
*   1000円 → 本気ユーザーだけ残る
*   3000円 → 明確な用途がある人だけ

* * *

**⑤ M3Eの場合**

構造的に

*   無料代替が多い（Obsidianなど）
*   個人向け
*   初期は機能差が小さい

なので最初は

**高価格は成立しにくい**

ただし

*   同期の安心性
*   構造化の強さ
*   AI連携

ここが効けば上げられる。

* * *

**⑥ 実務的な決め方**

理論ではなくこれで決める。

1.  仮の価格を置く（例：500円, 1000円）
2.  実際に売る
3.  売れ方を見る
4.  上げる or 下げる

これだけ。

アンケートより実販売の方が正確。

* * *

**まとめ**

*   価格は市場が決めるわけではない
*   自分が決めて、市場にテストする
*   本質は「誰に使わせるか」の選択

価格は最適解を当てるものではなく、  
**試して寄せるもの**。

📋

## Prompt:
2026/4/3 19:35:09

obsidianの発展の経緯教えて

## Response:
2026/4/3 19:35:10

> **情報の更新と信頼性の確保**
>
> 現在の情報が歴史に関連している場合、カットオフを考慮しても問題ないかもしれません。ただ、現在の情報を正確に引用するためには、信頼できるオンラインソースを検索し、公式な情報を基にした簡潔な説明を心がけます。
>
> **Searching official sources about Obsidian history**
>
> [About](https://obsidian.md/about)
> [History of Obsidian: Second Brain to AI Knowledge OS ...](https://www.taskade.com/blog/obsidian-history)
> [What is your Personal Knowledge Management problem?](https://forum.obsidian.md/t/what-is-your-personal-knowledge-management-problem/56)
> [Exploring the power of note-making with the co-founder ...](https://nesslabs.com/obsidian-featured-tool)
> [Dynalist & Obsidian - 📣Announcements](https://talk.dynalist.io/t/dynalist-obsidian/6736)
> [Obsidian (software)](https://en.wikipedia.org/wiki/Obsidian_%28software%29)
> [What's the catch? It's free for personal use, how does ...](https://www.reddit.com/r/ObsidianMD/comments/18xouyw/whats_the_catch_its_free_for_personal_use_how/)
> [How the head of Obsidian went from superfan to CEO](https://www.theverge.com/decoder-podcast-with-nilay-patel/760522/obsidian-ceo-steph-ango-kepano-productivity-software-notes-app)
>
> **確認すべき公式リリース日**
>
> 公式なリリース日確認が必要な場合、リリースノートや公式情報を調べて、正確な日付を把握しておきます。それに基づいて適切な情報を提供できるようにします。
>
> **Searching for official release dates and notes**
>
> [Obsidian 0.0.1 Desktop (Public)](https://obsidian.md/changelog/2020-03-30-desktop-v0.0.1/)
> [Obsidian Publish](https://publish.obsidian.md/)
> [publish your Obsidian vault as a website (hosted edition)](https://forum.obsidian.md/t/flowershow-publish-your-obsidian-vault-as-a-website-hosted-edition/105957)
> [Submit your plugin - Developer Documentation](https://docs.obsidian.md/Plugins/Releasing/Submit%2Byour%2Bplugin)
>
> **日本語で簡潔に説明**
>
> Sync/Publishの公式な発表日については正確な情報がわからないかもしれませんが、公式ブログやリリースノートを調べてみると良いかもしれません。必要に応じて、新しい情報をギュッと簡潔にまとめます。
>
> **Searching Obsidian Sync/Publish official launch dates**
>
> [Blog](https://obsidian.md/blog/)
> [Tags improvement in 9.17 unclear - Basement](https://forum.obsidian.md/t/tags-improvement-in-9-17-unclear/9144)
>
> 思考時間: 26s

大まかには、**Dynalist系のアウトライナー開発の延長から始まり、2020年にローカルファーストのノートアプリとして公開され、その後は有料の周辺サービスとコミュニティ拡張で育った**、という流れです。Obsidianの共同創業者は Shida Li と Erica Xu で、公式サイトでも Erica Xu が「2020年に Obsidian を始めた」と説明されています。さらに、2020年5月の Dynalist 側の告知では、開発チームが数か月前から新しい製品として Obsidian を並行開発していたこと、そして public beta を 2020年5月下旬に出したことが確認できます。[Obsidian+2Dynalist Forum+2](https://obsidian.md/about?utm_source=chatgpt.com)

初期の発展で重要だったのは、**最初からローカル保存・Markdownファイル・内部リンク・プラグイン機構を中核に置いたこと**です。2020年3月30日の 0.0.1 の時点で、vault の選択、`[[内部リンク]]`、画像や音声の埋め込み、そして plugin system が入っていました。つまり、後から拡張性を足したのではなく、最初から「ファイルを自分で持つ」「リンクでつなぐ」「拡張する」という設計で出ています。[Obsidian](https://obsidian.md/changelog/2020-03-30-desktop-v0.0.1/?utm_source=chatgpt.com)

その後の成長は、**アプリ本体を無料で広げつつ、有料サービスを後から載せる形**でした。公式ヘルプでは、Obsidian の有料要素として Sync、Publish、Catalyst、Commercial license などが案内されています。Commercial license はアプリ内機能を増やすものではなく、商用利用向けのライセンスです。一方で Sync は端末間同期、Publish はノートのWeb公開を提供します。つまり、Obsidian は「本体無料、必要な運用機能だけ課金」という構造で発展してきました。[Obsidian+5Obsidian+5Obsidian+5](https://obsidian.md/help/official-site?utm_source=chatgpt.com)

発展を加速させたもう一つの要因は、**コミュニティ主導の拡張**です。公式ヘルプには community plugins の導入手順が明記されており、外部開発者が作ったプラグインをアプリ内から導入できる仕組みが整っています。2020年時点のフォーラムでも、PARA テンプレートや Zettelkasten 補助など、かなり早い段階から利用者側の方法論や拡張が動いていました。製品単体ではなく、利用者コミュニティと一緒に広がったのが特徴です。[Obsidian+2Obsidian Forum+2](https://obsidian.md/help/community-plugins?utm_source=chatgpt.com)

節目としては、**2022年10月13日に 1.0.0 を公開**しています。公式 changelog でも 1.0.0 は大きな見た目と内部構造の変更を伴う節目のリリースとして扱われています。その後、2023年には公式 About ページで Steph Ango が CEO として記載される体制になっており、創業者2人中心の開発から、少し組織化された段階に移っています。[Obsidian+1](https://obsidian.md/changelog/2022-10-13-desktop-v1.0.0/?utm_source=chatgpt.com)

最近の方向性を見ると、Obsidian は依然として **ローカルファーストを維持しつつ、周辺機能を厚くしている** 段階です。公式ロードマップには 2026年時点で Obsidian Reader、Sync の headless client、Obsidian CLI などが載っており、単なるノートアプリから、読書・同期・自動化まで含む基盤へ広げています。[Obsidian+1](https://obsidian.md/roadmap/?utm_source=chatgpt.com)

要するに、Obsidian の発展はこうです。  
**Dynalistの系譜 → 2020年にローカルMarkdown＋リンク＋拡張性で公開 → 無料本体＋有料周辺サービスで収益化 → コミュニティ拡張で成長 → 1.0到達後に周辺基盤を拡充**。  
この流れは、M3E の販売設計を考える上でもかなり参考になります。

📋

---

**Sources:**

- [About](https://obsidian.md/about?utm_source=chatgpt.com)

## Prompt:
2026/4/3 19:38:05

サービスの規模(ユーザー数、利益、など）について時系列で整理

## Response:
2026/4/3 19:38:07

> **検索して最新情報を確認する**
>
> ユーザーの質問に正確な情報を提供するためには、ウェブで検索して最新の内容を確認する必要があると感じています。公式な情報を探しつつ、信頼できるサードパーティのインタビューも参考にしたほうが良さそうです。
>
> **Searching web for Obsidian user count and revenue**
>
> [Plugins](https://obsidian.md/plugins)
> [11 Top SaaS Industry Trends (2024)](https://explodingtopics.com/blog/saas-trends)
> [The Obsidian Co.](https://cy.linkedin.com/company/the-obsidian-co)
> [Obsidian Value Platforms](https://www.linkedin.com/company/obsidian-value-platforms)
> [2.5 years of using Obsidian and looking ahead](https://forum.obsidian.md/t/2-5-years-of-using-obsidian-and-looking-ahead/92260)
> [Obsidian Risk Advisors](https://au.linkedin.com/company/obsidian-risk-advisors)
> [How to do anything RESEARCH - Reject Convenience](https://publish.obsidian.md/rejectconvenience/Reject%2BConvenience%2BWebsite/Videos/2025/11-24-2025%2B-%2BHow%2Bto%2Bdo%2Banything%2B%28without%2BAI%29/How%2Bto%2Bdo%2Banything%2BRESEARCH)
> [Collaboration against ethnography: How colonial history ...](https://publish-01.obsidian.md/access/45893db0399cde004e6bf1267f11178a/includes/Friedman%202013.pdf)
>
> **信頼できる情報源を探す**
>
> もっと信頼性の高い情報を集めるために、ニュース記事やインタビューを検索してみる必要がありそうです。ユーザーに正確で信頼できる情報を提供したいので、しっかり調べなおします。
>
> **ニュースとインタビューの検索**
>
> [For heavy Canvas users (from hundreds of thousands to ...](https://forum.obsidian.md/t/for-heavy-canvas-users-from-hundreds-of-thousands-to-millions-of-words-which-computer-components-should-be-upgraded/81629)
> [How many users does Obsidian have? (CEO Stephan Ango)](https://www.youtube.com/shorts/kRVIHHE-kYA)
> [How the head of Obsidian went from superfan to CEO](https://www.theverge.com/decoder-podcast-with-nilay-patel/760522/obsidian-ceo-steph-ango-kepano-productivity-software-notes-app)
> [How to onboard a new employee - Daniel's notes](https://publish.obsidian.md/dk/How%2Bto%2Bonboard%2Ba%2Bnew%2Bemployee)
>
> **調査と情報収集**
>
> ユーザー数や利益のタイムラインが手に入らないかもしれませんが、公式な収益や利益が開示されていないか確認します。その後、価格に関する情報を調べて推測できるかも。公式なタイムラインとサードパーティの収益予測について調べ、公式のチーム規模も確認します。
>
> **検索してチーム情報、価格設定、公式情報を探す**
>
> [Creating a CEO User Manual - Scott Novis Notes](https://publish.obsidian.md/scottnovis/Published/Creating%2Ba%2BCEO%2BUser%2BManual)
> [Obsidian 0.10.0 Desktop (Early access)](https://obsidian.md/changelog/2020-12-14-desktop-v0.10.0/)
> [Whiteboard Hacking V3](https://publish-01.obsidian.md/access/c0e493dbba8a0957fda1ce70a08fcf62/Attachments/Whiteboard-Hacking-Manual.pdf)
> [No guarantee and "everything will break" API beta testing ...](https://forum.obsidian.md/t/no-guarantee-and-everything-will-break-api-beta-testing-phase/488)
>
> **収益予測の調査**
>
> 収益の推定値が必要かもしれません。サードパーティのデータを探して、例えば「Growjo」などの信頼できるソースで情報を確認するのが良さそうです。これで、もう少し明確な予測が得られるかもしれません。
>
> **サードパーティの収益データを検索**
>
> [How OBSIDIAN hit $2M revenue with a 18 person team in ...](https://getlatka.com/companies/obsidian.md)
> [Obsidian in 2026: Usage, Revenue, Valuation & Growth ...](https://fueler.io/blog/obsidian-usage-revenue-valuation-growth-statistics)
> [How the head of Obsidian went from superfan to CEO](https://www.theverge.com/decoder-podcast-with-nilay-patel/760522/obsidian-ceo-steph-ango-kepano-productivity-software-notes-app)
> [Measuring the Digital Economy](https://www.iab.com/wp-content/uploads/2025/04/Measuring-the-Digital-Economy_April_29.pdf)
> [Obsidian vs Notion: Honest comparison in 2026 (I tried both)](https://www.productivetemply.com/blog/notion-vs-obsidian)
> [Pacific Specialty Insurance Company Review [Updated 2026]](https://www.coveragecat.com/reviews/pacific-specialty)
> [Can we have a discussion about Obsidian's high pricing?](https://www.reddit.com/r/ObsidianMD/comments/sepfgo/can_we_have_a_discussion_about_obsidians_high/)
> [Comprehensive List of SaaS Companies | PDF](https://www.scribd.com/document/932703238/Saas-All-Database)
> [Cross-Platform Note Taking App Market Analysis and ...](https://www.marketreportanalytics.com/reports/cross-platform-note-taking-app-55191)
> [Global Collaborative Note-taking App Market Research ...](https://www.linkedin.com/pulse/global-collaborative-note-taking-app-market-research-2026-2033-jzz9e)
> [sundae_bar Broker Note - Jonathan Plant](https://www.clearcapitalmarkets.co.uk/analysis/sundae-bar-broker-note)
> [Note Taking App Market Size, Share, Growth Analysis ...](https://www.marketresearchstore.com/market-insights/note-taking-app-market-829245)
> [Obsidian as an example of thoughtful pricing strategy and the ...](https://www.robinlandy.com/blog/obsidian-as-an-example-of-thoughtful-pricing-strategy-and-the-power-of-product-tradeoffs)
> [About Pricing aka why does Obsidian Service X cost so ...](https://forum.obsidian.md/t/about-pricing-aka-why-does-obsidian-service-x-cost-so-much-or-any-money-at-all/26329?page=3)
>
> **情報整理と明確化**
>
> 収集した情報は十分です。日本語で簡潔に説明し、未知の部分は正直に触れるべきです。2020年、2022年、2025年のデータを使用し、YouTubeショートからの2023年のコアチーム5名、Latkaからの2025年の推定18名を言及するか検討します。ただし、成長の可能性や推定の不確実性を考慮し、チームの人数に関しては注意が必要です。
>
> **公式情報とチーム規模に関する調査**
>
> [About - Obsidian](https://obsidian.md/about)
> [How many users does Obsidian have? (CEO Stephan Ango) - YouTube](https://www.youtube.com/shorts/kRVIHHE-kYA)
> [How OBSIDIAN hit $2M revenue with a 18 person team in 2025.](https://getlatka.com/companies/obsidian.md)
>
> **公開ベータの日程調査**
>
> 公開ベータの開始日を知る必要がありそうです。バージョン0.0.1や公式ブログなどから情報を探してみようと思います。その情報が見つかれば、ユーザーに分かりやすく伝えられるかもしれません。
>
> **検索による公開ベータ日情報の取得**
>
> [Obsidian 0.0.1 Desktop (Public)](https://obsidian.md/changelog/2020-03-30-desktop-v0.0.1/)
> [Dynalist & Obsidian - 📣Announcements](https://talk.dynalist.io/t/dynalist-obsidian/6736)
>
> 思考時間: 36s

公式に確認できる範囲と、外部推定を分けて時系列で整理する。

**2020年**  
Obsidian は 2020年3月30日に初回公開版 0.0.1 を出しており、同年5月末には Dynalist 側で「2日前に public beta を開始した」と案内している。かなり初期からローカル Markdown、内部リンク、プラグイン機構を中核にしていた。[Obsidian+2Dynalist Forum+2](https://obsidian.md/changelog/2020-03-30-desktop-v0.0.1/?utm_source=chatgpt.com)

**2021年ごろ**  
この時点ではまだ小規模運営だったことは確認できる。Obsidian の開発元は現在の About でも「small team」と表現しており、2021年初頭の Dynalist フォーラムでも共同創業者 Erica Xu が「今は Obsidian が忙しい」「Dynalist はそこまで大きな収益ではない」と述べている。ここから、当初は大きな資本投下ではなく、小さなチームで立ち上げていたと読める。なお、この時期の公式なユーザー数や売上額は見当たらない。[Obsidian+1](https://obsidian.md/about)

**2022年**  
2022年10月13日に 1.0.0 を公開した。これはプロダクトとしての大きな節目で、UI と内部構造の両方に大きな更新が入っている。少なくともこの時点で、初期実験段階から本格運用段階へ移ったと見てよい。[Obsidian](https://obsidian.md/changelog/2022-10-13-desktop-v1.0.0/)

**2023年前後の規模感**  
CEO Steph Ango の発言として、2023年ごろには「Obsidian のユーザーは 100万人近い」「コアチームは基本5人ほど」と紹介されている。ただしこれは YouTube ショート由来で、正式な年次開示ではないため、目安として扱うのが妥当。[YouTube](https://www.youtube.com/shorts/kRVIHHE-kYA?utm_source=chatgpt.com)

**2025年時点の収益構造**  
公式には、アプリ本体は無料で、収益源は Sync、Publish、Catalyst、Commercial license などの任意課金とされている。現在の価格は Sync が年払いで月4ドル、Publish が年払いで月8ドル、Catalyst が25ドル買い切り、Commercial が1ユーザー年50ドルで、公式にも「100% user-supported」とある。つまり、無料本体を広げて周辺サービスで回収する構造である。[Obsidian+2Obsidian+2](https://obsidian.md/pricing)

**2025年の売上**  
利益は公式非開示。売上についても公式開示は見当たらない。外部推定としては GetLatka が 2025年売上を 200万ドル、チーム18人としている。ただしこれは第三者推定であり、Obsidian 自身の公式発表ではない。したがって、売上の参考値にはなるが、確定値としては扱えない。[Latka](https://getlatka.com/companies/obsidian.md)

**整理すると**  
時系列で確実に言えるのは、  
2020年に公開・β開始 → 2022年に 1.0 到達 → 2023年前後にユーザー約100万人規模という発言 → 2025年には無料本体＋任意課金の収益構造が定着、という流れ。  
一方で、**利益額、営業利益率、正確な有料会員数、年度別売上推移は公式にはほぼ開示されていない**。したがって、規模の議論では「ユーザー数は100万人近辺の発言あり」「収益モデルは明確」「売上は外部推定のみ」という切り分けが必要。[Latka+4Obsidian+4Obsidian+4](https://obsidian.md/changelog/2020-03-30-desktop-v0.0.1/?utm_source=chatgpt.com)

📋

---

**Sources:**

- [Obsidian 0.0.1 Desktop (Public)](https://obsidian.md/changelog/2020-03-30-desktop-v0.0.1/?utm_source=chatgpt.com)
- [How many users does Obsidian have? (CEO Stephan Ango)](https://www.youtube.com/shorts/kRVIHHE-kYA?utm_source=chatgpt.com)
- [How OBSIDIAN hit $2M revenue with a 18 person team in 2025.](https://getlatka.com/companies/obsidian.md)

## Prompt:
2026/4/3 19:40:00

推測とか非公式でいいので、2023年までの規模感を

## Response:
2026/4/3 19:40:02

> **Web検索して情報を集める必要がある**
>
> ユーザーが求めているのは最新の情報と信頼できる情報源のため、インターネットで検索する必要があります。すべての事実については、出典を示さなければなりません。2023年の推定情報に合わせて、ポッドキャストやインタビュー、社員数、収益の推定、ユーザー数などを調べます。
>
> **Browsing web for Obsidian app user and revenue estimates**
>
> [History of Obsidian: Second Brain to AI Knowledge OS ...](https://www.taskade.com/blog/obsidian-history)
> [Steph Ango's Post](https://www.linkedin.com/posts/stephango_no-one-knows-how-many-users-obsidian-has-activity-7351766158372429825-WH9p)
> [How OBSIDIAN hit $2M revenue with a 18 person team in ...](https://getlatka.com/companies/obsidian.md)
> [Obsidian: A Comprehensive Startup Profile](https://sparkco.ai/blog/obsidian)
> [Getting to know the CEO of Obsidian | by TfTHacker](https://medium.com/obsidian-observer/getting-to-know-the-ceo-of-obsidian-93c20a00df8a)
> [Internet Citizen and Philosopher in Action by Dialectic](https://creators.spotify.com/pod/profile/dialecticpod/episodes/5-Tina-He---Internet-Citizen-and-Philosopher-in-Action-e2sdlph)
> [Obsidian in 2026: Usage, Revenue, Valuation & Growth ...](https://fueler.io/blog/obsidian-usage-revenue-valuation-growth-statistics)
> [Steph Ango (@kepano) on @obsdmd's small team, user- ...](https://x.com/jacksondahl/status/1889022922401964512)
> [Measuring the Digital Economy](https://www.iab.com/wp-content/uploads/2025/04/Measuring-the-Digital-Economy_April_29.pdf)
> [BOOK OF ABSTRACTS](https://www.dmg-home.org/fileadmin/user_upload/Konferenzen/Abstracts_Geo4Goettingen_2025.pdf)
> [Obsidian (Network Management Software)](https://pitchbook.com/profiles/company/181981-00)
> [How the head of Obsidian went from superfan to CEO](https://www.theverge.com/decoder-podcast-with-nilay-patel/760522/obsidian-ceo-steph-ango-kepano-productivity-software-notes-app)
> [sundae_bar Broker Note - Jonathan Plant](https://www.clearcapitalmarkets.co.uk/analysis/sundae-bar-broker-note)
> [EGU General Assembly 2025](https://egusphere.net/conferences/EGU25/ERE/index.html)
> [How many people pay for Evernote in 2023?](https://www.reddit.com/r/Evernote/comments/18es5f5/how_many_people_pay_for_evernote_in_2023/)
> [Getting to know the CEO of Obsidian - by TfT Hacker - Substack](https://tfthacker.substack.com/p/getting-to-know-the-ceo-of-obsidian?utm_medium=web)
> [rsna-2024-meeting-program.pdf](https://www.rsna.org/-/media/files/rsna/annual-meeting/future-and-past-meetings/rsna-2024-meeting-program.pdf?hash=207E5AB69674CEA633F3D1183736C1E1&rev=5c3e037ee6554379926c11195b4e0803)
> [Obsidian vs. Notion Statistics – Which is Better? (2025)](https://coolest-gadgets.com/obsidian-vs-notion-statistics-which-is-better-2025/)
> [How many users does Obsidian have? (CEO Stephan Ango)](https://www.youtube.com/shorts/kRVIHHE-kYA)
> [Spring 2026 Frontlist Rights Guide Adult and Children's ...](https://www.bgagency.it/images/pdf/editoria-anglosassone/SJGA%202026%20Spring_compressed.pdf)
>
> **価格履歴の調査が必要**
>
> 2023年の価格履歴を調べる必要があるため、公式な価格をアーカイブで検索してみようかな。ウェブで調べると、最新の情報しかないかもしれないけれど、非公式な情報も使って推測することはできるかもしれない。古いプランを探してみるのもいいかも。
>
> **検索中：Obsidianの価格履歴（2021～2023年）**
>
> [Roadmap](https://obsidian.md/roadmap/)
> [Obsidian Sync: Self-Hosted Server (on premise)](https://forum.obsidian.md/t/obsidian-sync-self-hosted-server-on-premise/20975)
> [Early bird discount for Obsidian Sync and Publish ends ...](https://www.reddit.com/r/ObsidianMD/comments/pgm2ca/early_bird_discount_for_obsidian_sync_and_publish/)
> [Obsidianと過ごした2021年 - Minerva](https://minerva.mamansoft.net/2021-12-31-obsidian-2021-review)
> [Obsidian is Now Completely FREE to Use](https://medium.com/%40michaelswengel/obsidian-is-now-completely-free-to-use-even-for-businesses-62db839d2695)
>
> **チームサイズの調査**
>
> 2023年頃のチームサイズを調べる必要があるので、LinkedInや企業の「About」ページで情報を探すべきだね。これらの情報源から、会社の規模やチーム構成についての手がかりが得られるかもしれない。検索してみるよ。
>
> **検索：Obsidianのチームサイズ（2023年）**
>
> [New unannounced AAA RPG by Obsidian Entertainment ...](https://www.reddit.com/r/GamingLeaksAndRumours/comments/y6jzlc/new_unannounced_aaa_rpg_by_obsidian_entertainment/)
> [Obsidian Ventures](https://www.linkedin.com/company/obsidianventures?trk=similar-pages)
> [Obsidian (software)](https://en.wikipedia.org/wiki/Obsidian_%28software%29)
> [Obsidian | Home](https://www.obsidian.net/)
> [2023 - Game Industry Layoffs](https://publish.obsidian.md/vg-layoffs/Archive/2023)
> [How the head of Obsidian went from superfan to CEO](https://www.theverge.com/decoder-podcast-with-nilay-patel/760522/obsidian-ceo-steph-ango-kepano-productivity-software-notes-app)
> [About](https://obsidian.md/about)
> [Obsidian Holdings](https://lk.linkedin.com/company/obsidian-holdings-pvt-ltd)
> [Obsidian CEO explains that teams with many remote ...](https://gigazine.net/gsc_news/en/20250805-remote-chat-ramble/)
> [Things you should know about Obsidian Publish](https://medium.com/%40vladcampos/things-you-should-know-about-obsidian-publish-my-struggles-and-how-im-dealing-with-them-4f545a6ad408)
> [Ish Cheema - Head of Global Services @ Obsidian Security](https://ca.linkedin.com/in/ishwinder)
> [Avowed (Obsidian Entertainment)](https://bsn.boards.net/thread/18388/obsidian-entertainment-avowed?page=4)
> [Note size limit - Knowledge management](https://forum.obsidian.md/t/note-size-limit/56558)
>
> **マーケットの代理指標を調べる**
>
> マーケットの代理指標として、Redditメンバー数やフォーラムメンバー数、プラグインエコシステムの成長を調べたい。コミュニティ規模に関するデータを探してみようと思います。これらの指標をもとに、より正確な市場分析を目指します。
>
> **市場プロキシの調査とコミュニティ規模**
>
> [A systematic way to remove or avoid outdated/broken ...](https://forum.obsidian.md/t/a-systematic-way-to-remove-or-avoid-outdated-broken-community-plugins/71923)
> [Blog](https://obsidian.md/blog/)
> [2023-03-25 Improved Community Updates & Task Searching](https://publish.obsidian.md/hub/01%2B-%2BCommunity/Obsidian%2BRoundup/2023-03-25%2BImproved%2BCommunity%2BUpdates%2B%26%2BTask%2BSearching)
> [marekbrze/categorized-obsidian-plugins](https://github.com/marekbrze/categorized-obsidian-plugins)
> [All the Obsidian Core Plugins (Obsidian Tour 2023)](https://nicolevanderhoeven.com/blog/20230721-all-the-obsidian-core-plugins-2023/)
> [Questions about damage calculation - Obsidian Forums](https://forums.obsidian.net/topic/132772-questions-about-damage-calculation/)
> [We will not be actively maintaining the Linux client anymore](https://discussion.evernote.com/forums/topic/147703-we-will-not-be-actively-maintaining-the-linux-client-anymore/)
> [Blog - Obsidian Location Plugin](https://aaronczichon.de/blog/18-obsidian-location-plugin/)
>
> **慎重に推定を含めた回答が必要**
>
> 慎重な推定を交えた回答が求められているので、Redditのメンバー数も一つの指標になるかもしれませんが、必須ではないかもしれません。代わりにフォーラムの統計データを調べる方向で進めるべきかなと思います。
>
> **Searching Obsidianユーザー統計とフォーラム情報**
>
> [Mar 2023: Current "Vision" For Userspace Metadata: YAML ...](https://forum.obsidian.md/t/mar-2023-current-vision-for-userspace-metadata-yaml-frontmatter-dataview-inline/56912)
> [Obsidian October 2023](https://obsidian.md/blog/2023-obsidian-october/)
> [Moved to Obsidian MD in 2023. Haven't looked back. ...](https://www.reddit.com/r/ObsidianMD/comments/1m6bpk0/moved_to_obsidian_md_in_2023_havent_looked_back/)
> [Obsidian Entertainment](https://discord.com/invite/obsidian)
> [Obsidian Life OS Dashboard Demo Vault](https://www.patreon.com/posts/obsidian-life-os-95599755)
> [People are obsessed with Obsidian, the darling of ...](https://www.fastcompany.com/90960653/why-people-are-obsessed-with-obsidian-the-indie-darling-of-notetaking-apps)
> [Obsidianの情報収集のススメ｜松濤Vimmer](https://note.com/shotovim/n/n36f30a284da5)
> [3 reasons I'm finally uninstalling Obsidian](https://www.xda-developers.com/reasons-switching-from-obsidian-to-notion/)
> [Nominated for Obsidian's Gems of the Year 2023 - TfT Hacker](https://tfthacker.substack.com/p/obsidians-gems-2023?utm_medium=reader2&utm_source=profile)
> [It works. It really works!. It's finally time to provide an update…](https://medium.com/%40noteapps/it-works-it-really-works-eb61e2dfc0c5)
>
> **簡潔な日本語で推定を記載**
>
> 2023年の1Mユーザーに基づき、FastCompanyとCEOのインタビューから推測される範囲を述べる必要があります。利益については、2025年にVergeが後付けで触れている内容を参考にし、2023年には利益が出ている可能性を推測します。価格や収益の推定も行いますが、必ず明確に推測であることを示します。
>
> **Searching 2021 Obsidian pricing and revenue estimates**
>
> [Early bird discount for Obsidian Sync and Publish ends ...](https://www.reddit.com/r/ObsidianMD/comments/pgm2ca/early_bird_discount_for_obsidian_sync_and_publish/)
> [Last chance to get early bird discount for Sync and Publish](https://obsidian.md/blog/last-chance-to-get-early-bird/)
> [A little confused about Obsidian Publish prices - Help](https://forum.obsidian.md/t/a-little-confused-about-obsidian-publish-prices/12812)
> [Obsidian Publish - Minerva](https://minerva.mamansoft.net/Notes/Obsidian%2BPublish)
> [Obsidian Pricing: Free, Sync, Publish, and Hidden Costs ...](https://www.larksuite.com/en_us/blog/obsidian-pricing)
> [A complete guide to Obsidian pricing in 2025](https://www.eesel.ai/blog/obsidian-pricing)
> [Obsidian Publish Feels Like It's Still In Development and ...](https://www.linkedin.com/pulse/obsidian-publish-feels-like-its-still-development-therefore-bob-doto)
> [Obsidian - Functies, prijzen & ervaringen (2026) - ToolGuide](https://toolguide.io/en/tool/obsidian/)
> [Obsidian Pricing Breakdown: Prices, Plans, Pros, and Cons](https://www.lindy.ai/blog/obsidian-pricing)
>
> 思考時間: 59s

かなり荒く推すなら、¥*¥*2023年時点の Obsidian は「ユーザー約100万人、コアチーム約5人、年商はおそらく数十万〜数百万ドル前半」¥*¥*くらいの規模感と見るのが自然です。根拠として、2023年の Fast Company 記事は Obsidian 側の見積もりとして「100万人のユーザー」、Discord 約11万人、Reddit 約9.46万人を挙げています。別の Steph Ango の発言でも「100万人近いユーザー」「コアチームは基本5人」とされています。[Fast Company+1](https://www.fastcompany.com/90960653/why-people-are-obsessed-with-obsidian-the-indie-darling-of-notetaking-apps?utm_source=chatgpt.com)

まず**ユーザー数**は、2023年末でだいたい **70万〜120万人** と見てよいと思います。下限を 70万程度に置くのは、2022年時点の非公式インタビュー要約で「likely around 1 million users」とされており、2023年の Fast Company でも 100万人見積もりが出ているためです。2023年に急減した材料は見当たらないので、2023年通年では「ほぼ100万級」に入っていたと見るのが妥当です。[Medium+1](https://medium.com/obsidian-observer/getting-to-know-the-ceo-of-obsidian-93c20a00df8a?utm_source=chatgpt.com)

**組織規模**はかなり小さく、2023年は **常勤コアで5人前後、広く見ても一桁台前半** と見るのが自然です。Steph Ango は 2023年に CEO としてフルタイム参加しており、公式 About でも現在も small team と明記されています。2023年に「5 core members」という発言もあります。[Reddit+2Obsidian+2](https://www.reddit.com/r/ObsidianMD/comments/10vcxb2/im_joining_obsidian_fulltime_as_ceo/?utm_source=chatgpt.com)

**収益モデル**はこの時点で既に明確で、本体無料、収益源は Sync、Publish、Catalyst、Commercial license でした。2021年には Commercial license が年50ドル、Catalyst が25ドルから、Publish は月16ドルで early bird 8ドルという情報が確認でき、2023年には Publish が通常月8ドルへ下がったという二次情報もあります。2024年時点の公式価格は Sync 年払い月4ドル、Publish 年払い月8ドルなので、2023年の主力課金もだいたいこの近辺にあったと見て大きく外れません。[Obsidian+4Obsidian Forum+4Obsidian+4](https://forum.obsidian.md/t/obsidian-commercial-license/14364?utm_source=chatgpt.com)

ここから**売上規模**を推すと、2023年の年商は **0.8M〜3Mドル程度** と見るのが無難です。これは事実ではなく推定です。計算の置き方は、100万人級ユーザーに対して、有料転換率を **1〜3%**、有料ユーザー1人あたりの年額を **80〜100ドル前後** と置くものです。すると  
10,000〜30,000人 × 80〜100ドル ≒ **0.8M〜3Mドル/年** になります。  
このレンジは、2025年に第三者推定で売上 2Mドルという数字とも大きくは矛盾しません。[Latka+2Fast Company+2](https://getlatka.com/companies/obsidian.md?utm_source=chatgpt.com)

**利益**については公式開示が見当たりません。ただ、2025年の Verge インタビュー要約では「early on から profitable」とされています。したがって、2023年時点でも**黒字だった可能性が高い**です。ただし、これは 2025年時点の回顧発言に基づく推論であって、2023年決算の公開値ではありません。[The Verge](https://www.theverge.com/decoder-podcast-with-nilay-patel/760522/obsidian-ceo-steph-ango-kepano-productivity-software-notes-app?utm_source=chatgpt.com)

要するに、2023年までの規模感はこうです。  
**ユーザー：100万級**  
**チーム：5人前後の超小規模**  
**売上：年商100万ドル台前半くらいが中心推定**  
**利益：黒字の可能性が高い**。

この形は、**大規模資金調達で膨らませた会社ではなく、小チームで高密度に回るインディーSaaSに近い**。M3E の参考にするなら、まず見るべきはユーザー数より **「小チームでも黒字化しうる課金点をどこに置いたか」** です。

📋

---

**Sources:**

- [People are obsessed with Obsidian, the darling of ...](https://www.fastcompany.com/90960653/why-people-are-obsessed-with-obsidian-the-indie-darling-of-notetaking-apps?utm_source=chatgpt.com)
- [Getting to know the CEO of Obsidian | by TfTHacker](https://medium.com/obsidian-observer/getting-to-know-the-ceo-of-obsidian-93c20a00df8a?utm_source=chatgpt.com)
- [I'm joining Obsidian full-time as CEO : r/ObsidianMD](https://www.reddit.com/r/ObsidianMD/comments/10vcxb2/im_joining_obsidian_fulltime_as_ceo/?utm_source=chatgpt.com)
- [Obsidian Commercial License - Basement](https://forum.obsidian.md/t/obsidian-commercial-license/14364?utm_source=chatgpt.com)
- [How OBSIDIAN hit $2M revenue with a 18 person team in ...](https://getlatka.com/companies/obsidian.md?utm_source=chatgpt.com)
- [How the head of Obsidian went from superfan to CEO](https://www.theverge.com/decoder-podcast-with-nilay-patel/760522/obsidian-ceo-steph-ango-kepano-productivity-software-notes-app?utm_source=chatgpt.com)

## Prompt:
2026/4/3 19:42:11

初期〜2022までも同様に考察して

## Response:
2026/4/3 19:42:12

> **Browsing and citing Obsidian-related developments and users**
>
> [History of Obsidian: Second Brain to AI Knowledge OS ...](https://www.taskade.com/blog/obsidian-history)
> [Pricing](https://obsidian.md/pricing)
> [How the head of Obsidian went from superfan to CEO](https://www.theverge.com/decoder-podcast-with-nilay-patel/760522/obsidian-ceo-steph-ango-kepano-productivity-software-notes-app)
> [Obsidian pricing / support options are a bit confusing](https://forum.obsidian.md/t/obsidian-pricing-support-options-are-a-bit-confusing/20698)
> [What Obsidian's 2-Founder Success Taught Me About ...](https://medium.com/%40ehoneahobed/what-obsidians-2-founder-success-taught-me-about-building-my-startup-d61fac8728f3)
> [The Future of Obsidian with CEO Stephan Ango and Andy ...](https://www.youtube.com/watch?v=TkNTuFF2t-c)
> [How the head of Obsidian went from superfan to CEO](https://www.reddit.com/r/ObsidianMD/comments/1mtpyth/how_the_head_of_obsidian_went_from_superfan_to_ceo/)
> [An exceptional example of thoughtful pricing strategy and ...](https://www.linkedin.com/pulse/exceptional-example-thoughtful-pricing-strategy-power-robin-landy-utuzc)
> [Obsidian CEO explains that teams with many remote ...](https://gigazine.net/gsc_news/en/20250805-remote-chat-ramble/)
> [Evergreen notes with Stephan Ango — Episode 81 ...](https://museapp.com/podcast/81-evergreen-notes/)
> [The Other Stuff #28 — Kepano: The Interconnectedness of ...](https://www.podchemy.com/notes/the-other-stuff-28-kepano-the-interconnectedness-of-everything-46497115756)
> [Getting to know the CEO of Obsidian - by TfT Hacker](https://tfthacker.substack.com/p/getting-to-know-the-ceo-of-obsidian)
> [Obsidian | Bellingcat's Online Investigation Toolkit](https://bellingcat.gitbook.io/toolkit/more/all-tools/obsidian)
> [Obsidian CEO @kepano tells Decoder guest host @crumbler ...](https://www.instagram.com/reel/DNgaCYrg5NO/)
> [kepano (@stephango.com)](https://bsky.app/profile/did%3Aplc%3A4pklmqyj4mew3wftz7edg4fy)
>
> **特定の価格と公開情報を検索**
>
> [Obsidian 0.0.1 Desktop (Public)](https://obsidian.md/changelog/2020-03-30-desktop-v0.0.1/)
> [Self hosted Docker instance - Share & showcase](https://forum.obsidian.md/t/self-hosted-docker-instance/3788)
> [Community code of conduct](https://help.obsidian.md/community-code-of-conduct)
>
> **Fast Companyの結果を開く**
>
> [An exceptional example of thoughtful pricing strategy and the power of product tradeoffs](https://www.linkedin.com/pulse/exceptional-example-thoughtful-pricing-strategy-power-robin-landy-utuzc)
> [Getting to know the CEO of Obsidian | by TfTHacker | Obsidian Observer | Medium](https://medium.com/obsidian-observer/getting-to-know-the-ceo-of-obsidian-93c20a00df8a)
> [Obsidian’s CEO on why productivity tools need community more than AI | The Verge](https://www.theverge.com/decoder-podcast-with-nilay-patel/760522/obsidian-ceo-steph-ango-kepano-productivity-software-notes-app)
> [Obsidian 0.0.1 Desktop (Public) - Obsidian](https://obsidian.md/changelog/2020-03-30-desktop-v0.0.1/)
> [Obsidian pricing / support options are a bit confusing - Basement - Obsidian Forum](https://forum.obsidian.md/t/obsidian-pricing-support-options-are-a-bit-confusing/20698)
>
> **DynalistのObsidianパブリックベータ発表を検索**
>
> [Dynalist & Obsidian - 📣Announcements](https://talk.dynalist.io/t/dynalist-obsidian/6736)
> [No guarantee and "everything will break" API beta testing ...](https://forum.obsidian.md/t/no-guarantee-and-everything-will-break-api-beta-testing-phase/488)
> [Interesting new app in beta - Obsidian](https://forum.zettelkasten.de/discussion/1032/interesting-new-app-in-beta-obsidian)
> [History of Obsidian: Second Brain to AI Knowledge OS ...](https://www.taskade.com/blog/obsidian-history)
> [Obsidian public beta (and Discourse forum) available - Page 2](https://talk.macpowerusers.com/t/obsidian-public-beta-and-discourse-forum-available/17387?page=2)
> [Comparison guide of infinite outliner apps: Workflowy vs ...](https://www.reddit.com/r/dynalist/comments/j5sa8p/comparison_guide_of_infinite_outliner_apps/)
> [Obsidian 1.0 – Personal knowledge base app](https://news.ycombinator.com/item?id=33190433)
> [Exploring the power of note-making with the co-founder ...](https://nesslabs.com/obsidian-featured-tool)
> [Why I Switched: A deep dive into Roam vs. Obsidian](https://nileswyler.medium.com/why-i-switched-a-deep-dive-into-roam-vs-obsidian-df1a394971ff)
> [Dynalist - App Store - Apple](https://apps.apple.com/nz/app/dynalist/id1195392808)
>
> 思考時間: 21s

推測でよければ、¥*¥*初期〜2022年の Obsidian は「超小規模チームが、無料本体を軸に急速にコミュニティを広げ、2022年末にはすでに数十万〜100万弱ユーザー級に達していた可能性が高い」¥*¥*という見方が自然です。

まず事実として置ける土台はこれです。Obsidian は 2020年3月30日に 0.0.1 を公開し、この時点でローカルの vault、`[[内部リンク]]`、画像埋め込み、プラグインシステムを備えていました。さらに 2020年5月30日、Dynalist 側で「数か月サイドで開発しており、2日前に public beta を始めた」と案内されています。つまり、2020年前半の時点で、すでに今の中核思想を持った状態で外に出ていたことになります。 [Obsidian+1](https://obsidian.md/changelog/2020-03-30-desktop-v0.0.1/)

この初期段階の**2020年の規模感**は、かなり小さいはずです。開発体制は創業者中心のごく少人数で、売上もほぼ支援金中心だったとみるのが妥当です。2021年の公式フォーラムでは、Desktop と Mobile は無料、Catalyst と Unlimited は「開発支援のための donation tiers」で、機能本体は無料と説明されています。また 2021年3月時点で Commercial license は年50ドル、Catalyst は25ドルでした。したがって 2020年末ごろは、まだ本格的なSaaS売上というより、**無料配布でユーザーを集めつつ、少額課金で延命・継続開発する段階**だったと考えるのが自然です。 [Obsidian Forum+1](https://forum.obsidian.md/t/obsidian-pricing-support-options-are-a-bit-confusing/20698)

ユーザー数については、2020年は**数万〜十数万**くらいで見るのが無難です。これは公式開示ではなく推測です。理由は、2020年5月時点で public beta に入ったばかりである一方、同年5月にはすでにフォーラムでテンプレート共有やプラグイン議論が動き始めており、初期の熱量は強かったからです。まだ一般的大衆向けではなく、PKM や Zettelkasten 周辺の濃い層で急速に広がった段階と見るのが自然です。 [Dynalist Forum+2Obsidian Forum+2](https://talk.dynalist.io/t/dynalist-obsidian/6736?utm_source=chatgpt.com)

**2021年**は、規模よりも収益構造が固まり始めた年と見るのがよいです。無料本体に対して、Catalyst、Commercial license、将来の Publish などの周辺課金が見え始めています。2020年7月のフォーラムでは、価格ページに Publishing の案内があり、公開サービスを準備していたことも確認できます。したがって 2021年は、**まだ小規模だが、無料アプリから周辺サービス課金へ移る設計が明瞭になった年**です。ユーザー数は推測で **10万〜40万**くらい、年商は **数十万ドル未満〜数十万ドル台**あたりが中心だと思います。売上の中心は Commercial license と支援課金で、まだ Sync や Publish の寄与は限定的だった可能性があります。 [Obsidian Forum+2Obsidian Forum+2](https://forum.obsidian.md/t/is-there-a-way-to-expose-a-vault-on-the-web-for-the-public/3405?utm_source=chatgpt.com)

**2022年**になると、明らかに「初期プロダクト」から一段上がっています。2022年10月に 1.0.0 を公開しており、この時点で試作品ではなく、定着したプロダクトとして見てよいです。加えて、2023年には外部記事で「100万人超のユーザー」と紹介されているので、2022年末の時点ではその少し手前、つまり **50万〜90万人**程度まで来ていたと推すのが自然です。これは 2023年に突然跳ねたというより、2020〜2022年の積み上げの結果と考える方が筋が通ります。 [Hacker News+1](https://news.ycombinator.com/item?id=33190433&utm_source=chatgpt.com)

2022年の売上は、これも推測ですが **年商50万〜150万ドル程度**で見るのが一つの妥当なレンジです。理由は、2023年時点で「小チーム・非VC・持続可能な事業を目指す」と語られており、2025年の外部推定売上 200万ドルとも大きく矛盾しないからです。つまり 2022年は、**既に黒字化していても不思議ではないが、まだ大企業ではなく、非常に効率のよいインディー企業**という位置づけです。 [Medium+1](https://medium.com/obsidian-observer/getting-to-know-the-ceo-of-obsidian-93c20a00df8a)

まとめると、私ならこう見ます。

2020年  
**チーム 2〜3人級、ユーザー数 数万〜十数万、売上 かなり小さい。**  
無料本体で熱量の高い初期ユーザーを獲得する段階。 [Obsidian+2Dynalist Forum+2](https://obsidian.md/changelog/2020-03-30-desktop-v0.0.1/)

2021年  
**チーム 2〜4人級、ユーザー数 10万〜40万、売上 数十万ドル級の可能性。**  
支援課金と商用ライセンスで事業の骨格を作る段階。 [Obsidian Forum+1](https://forum.obsidian.md/t/obsidian-pricing-support-options-are-a-bit-confusing/20698)

2022年  
**チーム 3〜5人級、ユーザー数 50万〜90万、売上 50万〜150万ドル級の可能性。**  
1.0到達で、熱心なニッチツールから持続可能な事業へ移る段階。 [Hacker News+2LinkedIn+2](https://news.ycombinator.com/item?id=33190433&utm_source=chatgpt.com)

要するに、Obsidian はこの時期、**先に巨大売上を作ったのではなく、極小チームで高密度に支持を集め、あとから周辺課金を厚くした**と見るのが一番自然です。これは M3E を考える上でもかなり重要です。

📋

## Prompt:
2026/4/3 19:46:24

それはプログラマ受けが良かったから、ってことか？

## Response:
2026/4/3 19:46:25

部分的には正しいが、それだけではない。

**① 初期ユーザーがプログラマ寄りだったのは事実**

理由は明確で、

*   Markdown
*   ローカルファイル管理
*   内部リンク（wiki記法）
*   プラグイン前提

これらは一般ユーザーよりも**技術寄り・PKM層（知識管理オタク）に強く刺さる設計**。  
したがって初期拡大は「プログラマ含む濃い層」が中心だった。

* * *

**② ただし本質は「思想と設計」**

受けた理由はこっちの方が重要。

*   データを自分で持てる（ローカルファースト）
*   ベンダーロックインが弱い
*   拡張できる（プラグイン）
*   強制されない（自由度が高い）

これは単に「プログラマ向け」ではなく、

**コントロールを重視するユーザー全般に刺さる設計**

* * *

**③ 成長の流れ**

段階で分かれる。

**初期（2020〜）**

*   プログラマ / PKM層 / Zettelkasten界隈
*   濃いユーザーが集まる

**中期（2021〜2022）**

*   YouTuber、知識労働者、学生などに拡張
*   テンプレ・運用法が普及

**後期（2023〜）**

*   一般層にも一部浸透

* * *

**④ 重要な点**

Obsidianは

**「誰でも使える」から広がったのではなく、  
「一部に強烈に刺さった」から広がった**

* * *

**⑤ M3Eへの示唆**

ここが重要。

*   最初から広く取ろうとしていない
*   最初に“濃いユーザー”を取っている
*   その人たちが使い方を作る

* * *

**まとめ**

*   初期にプログラマ受けしたのは事実
*   ただし本質は「制御性・拡張性」という設計思想
*   成長は「濃い層 → 周辺層」の順

単にターゲットがプログラマだった、というより  
**結果的に最初に刺さったのがそこだった**という構造。

📋

## Prompt:
2026/4/3 19:47:24

俺のM3Eもそうなる要素を持ってるよな。既に利益出してる企業とはまだ肩を比べられないが、

## Response:
2026/4/3 19:47:25

ある。ただし「そのまま同じ軌道に乗る」とは限らない。

* * *

**① 共通している要素**

M3Eには初期拡散に有利な条件がいくつかある。

*   構造思考ツール（強いニッチ）
*   ローカルファースト志向
    M3E仕様設計書
*   alias・スコープなどの独自概念
*   AIは補助で人間が確定（制御性が高い）
    M3E仕様設計書

これはObsidianと同じく

**「理解した人に強く刺さる設計」**

* * *

**② ただし違う点（ここが重要）**

Obsidianは

*   Markdown（既存文化）
*   Zettelkasten（既存思想）
*   Dynalistユーザー基盤

があった。

一方M3Eは

*   概念が新しい（スコープ、帯域など）
*   既存文化に完全には乗っていない

つまり

**理解コストが高い**

* * *

**③ 何が起きるか**

この違いで初期成長の性質が変わる。

Obsidian：

*   既存層に刺さる → 自然拡散

M3E：

*   理解できる人が少ない → 拡散が遅い

* * *

**④ それでも有利な点**

逆に言うと、

*   うまくハマれば差別化は強い
*   代替が少ない

つまり

**当たれば深く刺さるタイプ**

* * *

**⑤ 現実的な位置づけ**

現段階のM3Eは

*   「拡大フェーズ」ではない
*   「適合ユーザーの発見フェーズ」

* * *

**⑥ やるべきこと（構造的に）**

重要なのはこれだけ。

*   誰に一番刺さるかを特定する
*   その人が日常的に使う形を作る
*   その使い方を外に出す

Obsidianはこれをユーザー側がやった。

* * *

**まとめ**

*   M3Eは「濃い層に刺さる構造」は持っている
*   ただし初期拡散はObsidianより難しい
*   今やるべきは拡大ではなく「刺さる層の特定」

比較すると近い位置にはいるが、  
**同じ経路を辿る前提では考えない方がよい。**

📋

## Prompt:
2026/4/3 19:49:42

大衆受けは絶対しないが、頭いい人に受けるなら、ユーザー単価もたかいと期待できる。

## Response:
2026/4/3 19:49:43

その見方は一部正しいが、そのままでは危険。

* * *

**① 「頭いい人＝高単価」は成立条件つき**

成立するのはこういう場合だけ。

*   仕事や研究に直結する（ROIが明確）
*   時間短縮や成果向上に寄与する
*   代替が弱い

このときだけ高単価が取れる。

* * *

**② 成立しないケース**

以下だと単価は上がらない。

*   趣味用途（思考整理が楽しいだけ）
*   代替が多い（Obsidian, ノートアプリ）
*   効果が測れない

この場合、

**「賢い人ほど無料で工夫して済ませる」**

* * *

**③ 本質は「知能」ではなく「支払う理由」**

価格を決めるのは

*   知能レベルではなく
*   支払う必然性

例：

*   学生の天才 → 無料ツール使う
*   企業の凡人 → 年数万円払う

* * *

**④ 高単価を取れる構造**

3パターンしかない。

**1¥. 業務ツール化**

*   研究・設計・仕事で使う
*   → 経費で払う

**2¥. チーム機能**

*   複数人で使う必要がある
*   → 強制的に課金

**3¥. データやワークフローにロックイン**

*   乗り換えコストが高い
*   → 継続課金できる

* * *

**⑤ M3Eの現状**

今は

*   個人ツール
*   代替あり
*   ROIが曖昧

→ 高単価はまだ取りにくい

* * *

**⑥ 可能性がある方向**

高単価を狙うなら

*   研究・設計用途に寄せる
*   Deepを「成果物生成」に使わせる
*   チーム利用に拡張

* * *

**まとめ**

*   「頭いい人に受ける＝高単価」は自動では成立しない
*   価格を決めるのは「支払う必然性」
*   高単価にするには用途を仕事側に寄せる必要がある

今のままだと  
**濃いユーザーは増えても、単価は上がりにくい構造。**

📋



---
Powered by [ChatGPT Exporter](https://www.chatgptexporter.com)





# Scope に設定を持たせる方針

せっかく階層構造があるから、メタ的な設定値を階層的に定義できると思ったが、nodeだと多すぎるな。
と思ったが、Scopeが結構よさそうだ。


思考完了

思考時間: 17s
そうです。Scopeのほうが自然です。

理由は3つです。

1つ目は、仕様上すでにScopeが可視性・編集範囲の単位だからです。folder を root とする scope が境界になり、外部は基本見せず、alias でのみ跨ぐ設計になっています。つまり、メタ設定の適用範囲として最初から意味を持っています。


2つ目は、node単位だと設定点が増えすぎて、継承関係より例外管理が主役になるからです。今の仕様は主構造を親子ツリーに寄せ、実体は単一スコープに属する前提なので、設定も scope 単位に寄せたほうが整合します。


3つ目は、保存・同期・Undoとの相性です。保存単位もスコープ単位で閉じる設計が有利とされているので、設定も scope に載せると実装が揃います。


なので方針としては、

基本は Scope に設定を持たせる

Node は原則 inherit

Node に直接持たせるのは override が必要な最小項目だけ

がよいです。

形としては、優先順位を

Scope default → 下位 Scope 継承 → Node override

にすると扱いやすいです。

設定の種類も分けたほうがよくて、

表示系：帯域、折り畳み方針、密度、色

編集系：AI提案許可、自動整形、編集ロック

運用系：保存方針、エクスポート方針、共有禁止

解釈系：このScopeを何として扱うか、外部AIへどう自然言語化するか

あたりは Scope に置く価値があります。

逆に node に置くべきなのは、そのノード固有の内容や一時UI状態に近いものです。仕様でも View状態は構造状態と分ける前提なので、選択・hover・drag中座標のようなものは Scope設定ではなく ViewState 側です。


さらに今の方針だと、当面は Freeplane を土台にして外側で思考支援をかけるので、Scope を単位に「この部分木をどう解釈するか」というメタ設定を持たせるのはかなり相性がよいです。M3Eの価値を描画ではなく構造変換に置くなら、Scope はその変換単位になります。


結論としては、node が多すぎると感じた時点で、その設定は node の属性ではなく scope の属性である可能性が高いです。


📋

我ながら良い閃きだ

妥当な判断です。

既存の設計と整合しているため、後付けの例外ではなく中核に据えられる発想です。特に

scope が可視性と編集境界を担う

実体が単一スコープに属する

aliasで跨ぐ

という前提と矛盾しないため、設定の集約先として自然です。

また、node単位で持たせる設計は将来的に破綻しやすく、設定の衝突解決や継承ルールが複雑化します。scopeに寄せると、設定の意味が「この思考空間の前提」として明確になります。

設計的には、構造（tree）と意味（解釈設定）を分離できた点が重要です。


# M3Eのコンテンツ販売

**User:** Anonymous (kawami.s.aa@m.titech.ac.jp)  
**Created:** 4/4/2026 0:23:36  
**Updated:** 4/4/2026 0:31:09  
**Exported:** 4/7/2026 21:29:28  
**Link:** [https://chatgpt.com/g/g-p-69a7967bc9a88191915a53f767d5aec1-akaghef-m3e/c/69cfdb53-f9b0-83a5-b5bf-3f730a8ea732](https://chatgpt.com/g/g-p-69a7967bc9a88191915a53f767d5aec1-akaghef-m3e/c/69cfdb53-f9b0-83a5-b5bf-3f730a8ea732)  

## Prompt:
2026/4/4 0:23:35

M3Eのコンテンツを"note"のように販売する形式もありうるな

## Response:
2026/4/4 0:23:36

成立する。むしろ設計と整合している。

前提として、M3Eは「構造（Deep）→自然言語化→外部共有」という流れを持っている。

M3E仕様設計書

この「自然言語化された断片」をコンテンツとして切り出せば、そのまま販売単位になる。

整理すると次の3層になる。

* * *

**① Deep（構造）**

*   ノード・ツリー・スコープ
*   思考の設計図そのもの
*   内部資産

これは販売しない。価値の源泉。

* * *

**② Rapid（整形）**

*   構造を人が読める文章に変換
*   セクション分割、論点整理
*   軽い編集

ここで「記事化」が成立する。

* * *

**③ 外部フォーマット（note等）**

*   1テーマ単位で切り出し
*   ストーリーとして再配置
*   有料化可能

* * *

重要なのは「単なる記事」ではなく、以下の差別化になる。

**1¥. 構造起点**

*   通常のnote：文章→構造
*   M3E：構造→文章

→ 論点の抜けが少ない

**2¥. 再利用可能**

*   元はノードなので再編集可能
*   同じ素材から複数記事を生成できる

**3¥. 更新可能コンテンツ**

*   Deep更新 → 記事更新
*   静的記事ではなく「進化する記事」

* * *

マネタイズ形態は3種類に分かれる。

**A. 単発記事販売**

*   noteと同じ
*   Rapid→整形して出す

**B. シリーズ販売**

*   1つのDeep構造を分割販売
*   章単位で課金

**C. 構造ごと販売**

*   M3Eユーザー向け
*   「思考テンプレ」を売る
*   noteより高単価

* * *

リスクもある。

**1¥. 読者層の制限**

*   高密度になるため大衆受けしない  
    → 既に認識している通り

**2¥. UI依存**

*   構造の価値がUIなしで伝わるか  
    → Rapid層で補う必要あり

**3¥. コピー容易性**

*   文章は複製される  
    → 構造側に価値を残す設計が必要

* * *

結論  
M3Eは「記事生成ツール」ではなく「構造資産を外販する装置」になる。  
note形式はその一部の出口に過ぎない。

📋

## Prompt:
2026/4/4 0:24:50

構造を作って売るっていうエコシステムへの挑戦だな。自然言語より優位だということを主張したい

## Response:
2026/4/4 0:24:51

方向性は一貫しているが、その主張はそのままでは通らない。  
「自然言語より優位」は条件付きでしか成立しない。

整理する。

* * *

まず、比較対象を分解する必要がある。

自然言語の強み

*   読みやすさ
*   伝播性（拡散しやすい）
*   低い参入障壁

構造の強み

*   関係の明示
*   再利用性
*   編集容易性
*   一貫性維持

したがって、優劣ではなく適用領域の違いになる。

* * *

M3Eが主張できる優位は限定される。

**成立する主張**

*   長期的に更新される知識
*   複雑な依存関係を持つ内容
*   再利用前提の知識

この領域では構造が明確に有利。

* * *

**成立しない主張**

*   初見の理解の速さ
*   読者の広さ
*   拡散力

ここは自然言語が強い。

* * *

したがって戦略は二層になる。

**内側（本体）**

*   構造が主
*   M3E

**外側（流通）**

*   自然言語
*   note, SNS

この関係は置き換えではなく変換。

* * *

エコシステムとして成立させるには、交換単位を定義する必要がある。

候補は3つ。

1.  ノード単位  
    　細かすぎる。価値が分散する。
2.  ツリー（サブツリー）単位  
    　妥当。テーマ単位になる。
3.  スコープ単位  
    　最も強いが重い。高単価。

* * *

さらに重要なのは「検証可能性」。

自然言語は評価が曖昧だが、構造は以下が可能になる。

*   依存関係の明示
*   抜け漏れ検出
*   更新履歴の追跡

これは明確な差別化になる。

* * *

結論  
主張すべきは「自然言語より優れている」ではなく、

「構造は知識の編集・再利用・進化において優れている」

である。

📋

## Prompt:
2026/4/4 0:26:56

例えるなら、vectorDB, GraphDBのうち、linearしかない状況だ。
おい、お前らは何をやっているんだ、と3年間思っている

## Response:
2026/4/4 0:26:56

指摘している状況は概ね妥当だが、理由は単純ではない。

まず、現在主流の基盤は「linear」ではなく実質的にはベクトル検索である。  
多くのLLMアプリは embedding → 類似検索 → 文章生成という構成で動いている。  
これは意味的近傍は扱えるが、関係構造は明示しない。

Graph的な表現が普及していない理由は3つに分解できる。

1.  コスト構造  
    グラフはエッジ設計と整合性維持が必要になる。  
    人手または高精度抽出が必要で、運用コストが高い。
2.  曖昧性  
    自然言語は関係が暗黙で、多義的である。  
    正しいエッジを定義する基準が安定しない。
3.  プロダクト適合性  
    多くの用途は「それっぽく答える」で十分。  
    厳密な構造を要求しないため、ベクトルで足りる。

* * *

一方で、あなたが狙っている領域は別である。

対象

*   研究
*   設計
*   長期的思考資産

この領域では条件が変わる。

*   誤りが許されにくい
*   更新が前提
*   依存関係が重要

ここではGraph的表現の価値が出る。

* * *

ただし、重要な点がある。

GraphDB自体は既に存在する。  
問題は「入力インターフェース」である。

既存GraphDB

*   Neo4jなど

課題

*   人間が直接書けない
*   思考の流れと一致しない

* * *

M3Eの位置づけはここになる。

*   Graphを人間の思考操作として扱うUI
*   かつ自然言語との往復変換を持つ

つまり差別化はDBではなく

**「思考入力レイヤー」**

* * *

結論  
現状は「vector偏重」であり、「graphが無い」のではなく「人間が使える形で存在しない」。  
M3Eはそこに入る設計になっている。

📋

## Prompt:
2026/4/4 0:28:37

たとえば会社の組織図、Agentの組織図、というのはハーネスエンジニアリングとして最近流行ってるよな？
それを構造として取り込むことで一貫したインターフェースで構造を記述できる。そういう豊さがある

## Response:
2026/4/4 0:28:37

主張は筋が通っている。ただし、ポイントは「表現の統一」であって「構造そのもの」ではない。

* * *

まず、挙げている例はすべて同型である。

*   会社の組織図
*   Agentの役割分担
*   タスク分解
*   設計構造

いずれも

**ノード（主体）＋関係（役割・依存）**

で表現できる。

* * *

このときの利点は3つに整理できる。

**1¥. インターフェースの統一**

*   組織もタスクも同じ操作で扱える
*   drag, reparent, scope移動などが共通になる  
    （操作はCommandとして一貫管理できる）
    DragOperate

* * *

**2¥. 横断的な再利用**

*   人の組織 → Agentに変換できる
*   タスク構造 → 実行構造に変換できる

つまり「意味の違う構造」を同じ基盤で扱える。

* * *

**3¥. 制約の明示**

*   誰が誰に依存するか
*   どこで責務が切れているか

これは自然言語では暗黙になるが、構造では強制的に表出する。

* * *

ただし注意点がある。

あなたの言う「豊かさ」は、自由度ではなく

**制約の一貫性から生まれる**

という点。

*   何でも表現できる → 価値は出ない
*   同じルールでしか表現できない → 比較・変換が可能

* * *

ハーネスエンジニアリングとの対応も整理できる。

*   部品 → Node
*   接続 → Edge
*   サブシステム → Scope

この対応を固定すれば、抽象レベルが変わっても同じ操作系で扱える。

* * *

結論  
価値は「構造を扱うこと」ではなく、  
**異なる対象を同一の構造言語で記述できること**にある。

📋

## Prompt:
2026/4/4 0:29:55

初期のころ、ChatGPTはどっちの回答がよいか、二通選ばせてたよな

## Response:
2026/4/4 0:29:56

そう。初期の ChatGPT では、2つの回答を並べてどちらが良いか選ばせる形式が使われていた。

目的は明確で、**人間の選好データの収集**である。

* * *

構造は単純。

1.  同一プロンプトに対して複数の出力を生成
2.  ユーザーに比較させる
3.  「どちらが良いか」を記録
4.  そのデータでモデルを改善（RLHF）

* * *

この方式の利点は2つ。

*   評価が相対的なので判断しやすい
*   「良さ」の定義を明示せずに学習できる

* * *

ただし限界もあった。

*   ユーザーの負担が大きい
*   長期的な一貫性は評価できない
*   局所的に「それっぽい回答」が勝ちやすい

* * *

今の話と接続すると、これは**自然言語ベースの評価**であり、構造は使っていない。

もしM3Eで同じことをやるなら、評価対象は変わる。

*   文章の良し悪し → ノード構造の良し悪し
*   局所比較 → 構造全体の整合性比較

つまり、

**「どちらの思考構造が良いか」を選ばせる評価系**

になる。

* * *

結論  
当時の仕組みは「自然言語の質を人間に選ばせる」ものだった。  
同じ枠組みを構造に適用すれば、「思考の質」を直接比較できるようになる。

📋

## Prompt:
2026/4/4 0:30:47

問題は、構造を比較する、というのは難しい、ということだ（コンフリクト解決でもそう）

## Response:
2026/4/4 0:30:47

その通り。難しさは本質的で、理由は明確に分解できる。

* * *

第一に、**比較基準が単一でない**。  
文章なら「読みやすさ」などである程度収束するが、構造は

*   網羅性
*   依存関係の正しさ
*   粒度の適切さ
*   深さ／幅のバランス

など複数軸になる。重み付けも状況依存。

* * *

第二に、**同値な表現が多い**。  
同じ内容でも

*   分割の仕方
*   親子関係の取り方
*   スコープの切り方

が異なるだけで見た目が変わる。  
グラフ同型に近い問題になる。

* * *

第三に、**局所と全体のトレードオフ**。  
局所的に良い変更が、全体整合性を壊すことがある。  
コンフリクト解決が難しい理由と同じ。

* * *

第四に、**意図が外部にある**。  
構造単体では目的関数が閉じない。  
「何のための構造か」が無いと評価不能。

* * *

したがって、完全な自動比較は困難。  
代わりに分解して扱う必要がある。

* * *

現実的なアプローチは3段階になる。

**1¥. 正規化（Normalization）**  
比較前に揃える。

*   並び順の正規化
*   冗長ノードの圧縮
*   alias展開

これで「表現差」を削る。

* * *

**2¥. 局所比較に分解**  
全体ではなく部分に落とす。

*   同一ノードID単位
*   サブツリー単位

「差分」として扱う。

* * *

**3¥. 評価関数を限定する**  
単一軸に落とす。

例

*   依存違反があるか（yes/no）
*   循環があるか
*   ノード数増減

多目的最適化を避ける。

* * *

コンフリクト解決も同型。

*   両方の操作列を適用
*   競合箇所のみ抽出
*   局所ルールで決定

* * *

重要なのは、¥*¥*「良い構造を選ぶ」ではなく「破綻している構造を排除する」¥*¥*に寄せること。

*   正しいか → 判定しやすい
*   良いか → 判定が難しい

* * *

結論  
構造比較は最適解探索ではなく、制約違反の除去問題として扱うのが現実的。

📋



---
Powered by [ChatGPT Exporter](https://www.chatgptexporter.com)

