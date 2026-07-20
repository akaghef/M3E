# Vision v0.1.4 技術スタック分析と M3E 応用候補

作成日: 2026-06-15

対象: https://github.com/visionmd/vision-releases/releases/tag/v0.1.4

## 前提

Vision v0.1.4 の macOS DMG を展開し、`app.asar` を静的解析した結果に基づく。
package metadata と Electron main/preload、renderer bundle の痕跡から読める範囲で整理する。

M3E 側では、Vision の `.canvas` や drawing model を map の正本に置き換えない。
`workspace / map / scope / node` を正本に保ち、外部形式・component・projection として取り込む前提で評価する。

## 技術スタックと応用可能性

| 技術スタック / 方式 | Vision の特徴 | M3E への応用可能性 | 優先度 / 注意 |
|---|---|---|---|
| Electron + React SPA | Electron desktop app。UI は React 系 SPA。main / preload / renderer 分離 | M3E の Beta / Final desktop shell に近い。Web viewer を保ったまま Electron shell を載せられる | 中。browser verification 経路は残す |
| Preload IPC API | `window.vision` 経由で `vault`, `file`, `canvas`, `search`, `update`, `image`, `clipboard`, `shell` を公開 | M3E も desktop 専用機能を preload adapter に閉じ込めると境界が明確 | 高 |
| Local-first vault | ユーザー選択 folder を vault として扱う。`.md`, `.canvas`, `.json`, image を管理 | M3E の workspace / project / map を local folder に安全に mirror する設計に使える | 高。S3 save / sync / restore に直結 |
| Path safety | absolute path、null char、vault 外 escape、symlink、`.git`, `.vision`, `node_modules` などを拒否 | M3E の external file、attachment、export / import の防御層に応用可 | 高 |
| Atomic write | temp file に書いて rename。canvas / json は pretty write | M3E の保存破損防止、crash tolerance、restore log に有用 | 高 |
| Size / type guard | text / canvas と binary asset に size limit。対象拡張子を allowlist | M3E でも map / file / image / component ごとの上限を明示できる | 高 |
| JSON Canvas | `.canvas` に frame 配置、`contentPath` で `.md` / `.json` を参照 | M3E の map / node を直接置換せず、import / export または sidecar 形式として有望 | 高。ただし M3E の正本にはしない |
| Framework registry | `why-tree`, `context-diagram`, `mind-map`, `infrastructure-diagram`, `sequence-diagram`, `free-drawing` を whitelist | M3E の `m3e:component` 登録型 renderer に近い。新 nodeType 乱立を避けられる | 高 |
| Markdown-first frames | Why Tree / Mind Map などは Markdown を編集単位にしている | M3E の `linear-text` / `linear-transform`、outline round-trip に使える | 高。Markdown は projection / sidecar 扱いが安全 |
| DSL-driven diagrams | Infrastructure / Sequence は DSL と描画を分ける構造 | System Diagram、Contract Tree、Runtime Board の projection component に応用可 | 中高。writeback 契約がない限り DSL を正本にしない |
| Mermaid 系 parser assets | Mermaid diagram chunk が多数含まれる | M3E の Mermaid 表示、外部共有、仕様書投影に使える | 中。Mermaid は projection-only が無難 |
| KaTeX | 数式 renderer 資産あり | 技術文書 node、spec node、制約表示に使える | 中 |
| Syntax highlighting assets | 多言語 grammar / highlighter 系 chunk がある | Code / spec / log node の読みやすさ向上に使える | 中 |
| Cytoscape / graph layout 系 | diagram layout 用の graph rendering / layout 資産あり | auto layout、dependency view、runtime graph に応用可 | 中高。既存 layout contract と衝突させない |
| Infrastructure icon library | AWS / GCP resource library、auto layout、DSL pane がある | M3E の MDD / System Diagram の視覚語彙として有用 | 中。provider icon は core schema に入れない |
| Sequence diagram UI | participant、message、auto number、DSL / editor 構成 | Runtime Board、protocol trace、Inko / A2A call 可視化に向く | 高 |
| Free Drawing | shape、arrow、text、image、layer、property、mini map 的 UI | M3E canvas の annotation overlay として有用 | 中。構造 map data とは分離 |
| Search | vault 内 `.md` / `.canvas` を scan して snippet を返す | workspace-wide search、map search、linear export search に応用可 | 中。規模が出たら indexed search が必要 |
| Image export / clipboard | image save、copy to clipboard、external open を IPC 化 | map / frame export、報告資料、共有に有用 | 中高 |
| Auto updater | `electron-updater` 利用 | M3E Beta / Final の配布更新に使える | 中。channel 分離が必須 |

## M3E への導入順

| 順位 | 取り込み候補 | 理由 |
|---:|---|---|
| 1 | `m3e:component` 型の登録 renderer | Vision の framework registry が M3E の component 方針と相性が良い |
| 2 | Atomic write + vault guard | save / sync / restore 信頼性に直結する |
| 3 | JSON Canvas import / export + sidecar | 既存 map 正本を壊さず外部互換を増やせる |
| 4 | Sequence / Infrastructure projection | M3E の Runtime / Contract / Architecture 可視化に使いやすい |
| 5 | Free Drawing overlay | 注釈・説明・レビュー用として強いが、構造 data とは分けるべき |

## 採用時の境界

- Vision 的な `.canvas` を M3E の正本 storage にしない。
- Mermaid / DSL / Free Drawing は projection または overlay として扱う。
- 新しい nodeType を増やす前に、v1-compatible attributes と `m3e:component` registry で吸収する。
- sidecar file を採用する場合、atomic write、path guard、size guard、schema validation を必須にする。
- desktop-only API は preload IPC に閉じ込め、viewer / API / storage の境界を崩さない。

## 要約

Vision から盗むべき中心は「描画機能そのもの」ではなく、local vault、sidecar file、framework registry、atomic write、projection renderer の組み合わせ。

M3E では `workspace / map / scope / node` を正本に保ち、Vision 型の `.canvas` / Markdown / DSL / Free Drawing は component または projection として取り込むのが安全。
