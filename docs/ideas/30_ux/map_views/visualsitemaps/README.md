# VisualSitemaps 参考idea

## Source

- App: [VisualSitemaps](https://app.visualsitemaps.com/)
- Product overview: [VisualSitemaps](https://visualsitemaps.com/)
- Features: [Features](https://visualsitemaps.com/features/)
- Map操作: [How to use the map view](https://support.visualsitemaps.com/en/articles/2914622-how-to-use-the-map-view)
- 取得日: 2026-08-23

## Status

- 外部サービスの参考事例として保存した未採用idea
- M3Eの仕様・実装方針・依存先としては未確定
- 本文は公式公開情報の要約であり、VisualSitemapsのコンテンツ複製ではない

## What it is

VisualSitemapsは、URLを起点にWebサイトをクロールし、各ページのスクリーンショットを階層的なvisual sitemapとして表示するサービス。

公式公開情報で確認できる主な機能:

- public / private URLのcloud crawlとdesktop / mobile screenshot
- directoryまたはreferralによるmap構造表示
- pan、zoom、検索、expand / collapse
- page / directoryの追加、削除、rename、drag-and-drop再配置
- screenshot annotation、public / private / resolved comment
- tag、content / SEO planning、scheduled crawl、visual QA
- PDF、JSON、CSV、XML、screenshot zip等へのexport
- crawl結果に対するAIベースのIA最適化、redirect案、report生成

## Why it matters to M3E

M3Eとの共通点は、単なるsitemap生成ではなく、取得した外部構造を人間が読めるmapにし、その場で整理・注釈・比較・共有する一連の作業面を持つこと。

特に参考になる境界:

1. **captureとmapを分離する**  
   crawlerが取得したURL、metadata、screenshotをsource evidenceとして保持し、map上の階層・配置・tag・commentを作業状態として重ねる。

2. **nodeをvisual evidence cardとして扱う**  
   page titleだけでなくscreenshotを主要表現にすることで、情報アーキテクチャと実画面を同時に読める。

3. **現状mapと計画mapを分ける**  
   crawl結果をmasterとして残し、duplicateしたmap上でrestructureする。M3Eでもsource-materialized recordとM3E-ownedな編集案を同一所有にしない設計と整合する。

4. **差分を独立したsurfaceにする**  
   scheduled crawl / visual QAは、現在のsnapshotを上書きするのではなく、前回とのvisual changeを判定・resolveする作業面として扱える。

5. **構造exportを閉じない**  
   JSON / CSV / XML / PDF / screenshot archiveを分けて出す。構造、表形式、閲覧成果物、evidence assetを一つの形式へ押し込まない。

## M3E adaptation idea

Web captureをM3Eへ持ち込む場合、次の三層に分ける。

```text
Capture source
  URL / crawl revision / metadata / screenshot asset
        ↓ materialize
Rapid map
  site hierarchy / page card / collapse / search / tag
        ↓ human decision
Planning overlay
  move / merge / delete proposal / annotation / QA status
```

候補となる最小slice:

- 1 URLを起点に同一origin内をbounded crawl
- page nodeに`url`, `title`, `status`, `captured_at`, `screenshot_ref`を保持
- screenshot付きTree表示と、screenshotを省略したoutline表示を切替
- crawl snapshot自体はread-onlyにし、再構成案は別mapまたはproposalとして保存
- 2 revision間でURL追加・削除・metadata変更・visual changeを表示

## Constraints

- authenticated / private siteのcrawlはcredential owner、保存範囲、secret非永続化を先に定義する
- screenshotには個人情報や機密画面が含まれ得るため、public repoへassetを直接保存しない
- robots、利用規約、rate limit、同一origin境界を守る
- screenshot差分とsemantic content差分を同一視しない
- VisualSitemapsのUIや固有コンテンツを複製せず、設計上の参考事例として扱う

## Open questions

- Web captureをFlash input、Rapid document、独立したsource-materialized scopeのどれとして導入するか
- URL階層、DOM内link referral、手動spineのどれを親子edgeの正本にするか
- screenshot assetのcanonical ownerとretention policyをどこに置くか
- crawl revision間のvisual differenceをmap node、GraphLink、専用QA surfaceのどこへ載せるか
- M3E viewerでscreenshot cardを大量表示する場合のvirtualization / level of detailをどう定義するか

## Next action

採用判断は行わない。Web captureまたはvisual QAの具体需要が発生した時に、公開ページ5〜20件のbounded specimenで、取得・表示・revision差分・asset ownershipを検証する。

## Related

- `S3` 保存・同期・復元の信頼性
- `S13` 外部インフラ依存を抑えた経路
- `S16` source-materialized recordとcanonical ownerの境界
- [Map View Frameworks for M3E](../README.md)

