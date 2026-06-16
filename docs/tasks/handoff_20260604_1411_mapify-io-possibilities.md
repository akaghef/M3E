# Handoff: Mapify I/O 機能の可能性

作成日時: 2026-06-04 14:11 JST
作業場所: `/Users/nisimoriyuuya/dev/M3E`
現在branch: `dev-beta`

## 現在の目的

- Mapify を M3E の外部 Flash 層として使い、M3E 側の map / scope / node と入出力できるかを後続作業者が検討・実装できる状態にする。
- 焦点は「M3E map を Mapify に投げる outbound」と「Mapify 生成物を M3E Rapid tree へ回収する inbound」を分けて評価すること。
- M3E の正本は `AppState` / `workspace > map > scope > node`。Mapify は外部プロバイダであり、Mapify 側を M3E の正本にしない。

## 重要な決定

- Mapify へ `URL/text/youtube/prompt` を投げる主経路は **Mapify MCP** が最有力。Chrome 拡張 UI 自動化より安定し、Chrome DOM / iframe / shortcut 変更に依存しない。
- Mapify MCP は構造 JSON/text を返さず、基本は image URL と editable link を返す。したがって **生成の入口** と **構造回収の出口** は別設計にする。
- Mapify から構造を回収する主経路は **XMind export -> `.xmind` unzip -> `content.json` parse**。ログイン済み Ext Browser が使えるなら、内部 API で `content.json` を直接取得する余地もある。
- M3E map を Mapify に「そのまま」取り込むのは不可に近い。M3E `AppState` は Mapify が理解しない。現実的には `AppState` の subtree/scope を Markdown outline へ射影して Mapify に渡す。
- Mapify 公式情報では Markdown import/convert は確認済み。変換モードは Markdown 階層を保って mind map 化する説明がある。
- `.xmind` 内の実構造は `content.json`。`metadata.json` は `{"dataStructureVersion":"2"}` 程度、`manifest.json` は ZIP 内目録、`content.xml` は今回の Mapify export では旧 XMind 向け警告 XML であり、実構造として使わない。
- Cookie 値を Codex 側に抜いて使う方式は避ける。内部 API を使うならログイン済みブラウザ内の page context / content script で `fetch` し、Codex へは取得済み JSON だけ渡す。

## 変更済みファイル

- `/Users/nisimoriyuuya/dev/M3E/docs/tasks/handoff_20260604_1411_mapify-io-possibilities.md`: この引き継ぎ文書を追加。

この handoff 作成では、既存の dirty worktree 変更には触れていない。

## 検証結果

- Mapify MCP:
  - `generate_mindmap` は利用可能で、`Hopf Algebra definition` 生成時に image URL と editable link を返した。
  - MCP 結果から直接 JSON/text 構造は得られなかった。
- Mapify UI / Export:
  - in-app browser でログイン済み Mapify を開き、`共有 > その他の形式` に `PDF / SVG / Markdown / Xmind ファイル / 印刷 / Xmindで開く` があることを確認。
  - in-app browser は download 非対応のため、実ダウンロードは out-app Chrome で実施済み。
- XMind export 実体:
  - `/Users/nisimoriyuuya/Downloads/Hopf Algebra_ definition and structure.xmind`
  - SHA256: `857393498cd7a228af73fa3223a3264a2da50db76ef220de3a30fdc06add2e26`
  - unzip 後の主要ファイル:
    - `/Users/nisimoriyuuya/.codex/tmp/mapify/xmind-unpacked/content.json`: 45,358 bytes
    - `/Users/nisimoriyuuya/.codex/tmp/mapify/xmind-unpacked/metadata.json`: 28 bytes
    - `/Users/nisimoriyuuya/.codex/tmp/mapify/xmind-unpacked/manifest.json`: 55 bytes
    - `/Users/nisimoriyuuya/.codex/tmp/mapify/xmind-unpacked/content.xml`: 4,309 bytes
  - `content.json` は 1 sheet / 177 nodes / max depth 4 / root `Hopf Algebra: definition and structure`。
- 変換済み artifacts:
  - `/Users/nisimoriyuuya/.codex/tmp/mapify/hopf-algebra-definition-from-xmind.md`
  - `/Users/nisimoriyuuya/.codex/tmp/mapify/hopf-algebra-definition-from-xmind.mmd`
  - `/Users/nisimoriyuuya/.codex/tmp/mapify/hopf-algebra-definition-from-xmind.render-safe.mmd`
  - `/Users/nisimoriyuuya/.codex/tmp/mapify/hopf-algebra-definition-from-xmind.render-safe.svg`
- Mermaid:
  - raw `.mmd` は数式中の `{}` 等で Mermaid parser が落ちた。
  - render-safe 版は Mermaid CLI で SVG 生成成功。
- Chrome 拡張調査:
  - 別作業者報告として、Mapify Chrome 拡張 ID `fldgacclkckcmflokaialbihppmndpbd`、version `1.6.3`、Alt+M summarize command、`contextMenus/tabs/scripting/cookies/<all_urls>` 権限、`externally_connectable` なし。
  - 拡張はページ本文を抽出して `local:summarize` に置き、`https://mapify.so/app/new?from=extension&type=...&isIframe=1` を開く/iframe表示する構造と報告されている。後続実装前に必要ならローカル manifest / bundle を再確認する。

## I/O 方針

### Outbound: M3E -> Mapify

推奨順:

1. `AppState` の scope/subtree を Markdown outline に射影し、Mapify Markdown convert に渡す。
2. `URL/text/youtube/prompt` の場合は Mapify MCP を使う。
3. 人間がブラウジング中のページを Mapify へ送る用途だけ Chrome 拡張を使う。
4. Mapify private API 直接利用は避ける。使う場合もブラウザ内 page context で完結させる。

M3E -> Markdown outline の最小ルール:

```text
TreeNode.text -> heading/list label
children[] order -> Markdown order
scope root -> export root
details/note/attributes/link -> まずは非対応または fenced metadata に退避
links/scopes/surfaces/annotations -> Mapify へは送らず M3E 側で保持
```

### Inbound: Mapify -> M3E

推奨順:

1. Mapify UI で XMind export。
2. `.xmind` を unzip。
3. `content.json` の `sheet.rootTopic` を pre-order 走査。
4. M3E `AppState` に変換。
5. 必要なら `linearNotesByScope` も同時生成。

最小対応表:

```text
sheet.rootTopic                 -> AppState.rootId
topic.id                        -> TreeNode.id または xmind_<uuid>
topic.title                     -> TreeNode.text
children.attached[]             -> TreeNode.children + child.parentId
class: "topic"                  -> nodeType: "text"
structureClass                  -> attributes["m3e:layout"] or surfaces
topic-title-folding != unfolded -> collapsed: true
```

Mapify/XMind 側で画像や添付がある場合:

```text
manifest.json file-entries resources/* -> M3E attachment/resource 候補
topic.image / topic.href                -> node attributes/link 候補
```

## 内部 API メモ

ログイン済み Mapify Web では、フロント bundle 上で以下の形が見えた。

```http
POST /api/history/list-user-files
POST /api/history/download-user-file
POST /api/history/update-user-file?fileId=...
GET/PUT/DELETE /api/history/{fileId}/resources/{filename}
```

`content.json` 取得候補:

```js
await fetch("/api/history/download-user-file", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    fileId: "fe613410-9135-4622-b48c-1b627279961a",
    subFilename: "content.json"
  })
})
```

注意:

- API key ではなく Web セッション cookie が必要。
- cookie 値を読んで curl に移す方式は避ける。
- Ext Browser でログイン済みなら、content script / page context で `fetch` して結果だけ Codex local helper へ渡す方式が安全。

## 未解決・リスク

- Mapify の内部 API は非公開で、破壊的変更に弱い。
- Mapify MCP は生成入口としては安定だが、構造回収には使えない。
- XMind export は UI 操作に依存するため、完全自動化するなら out-app Chrome / CDP / extension bridge が必要。
- Mapify Markdown import は公式情報上は可能だが、M3E `AppState` から生成した Markdown を実際に Mapify に投入する round-trip は未実施。
- M3E の `links`, `scopes`, `surfaces`, `annotations`, `details`, `note`, `attributes` は Mapify では欠落または劣化しやすい。
- Mapify 生成・変換は credits/quota 消費の可能性がある。自動テストでは小さいサンプルか手動承認を挟む。
- 現在の worktree は既存変更で dirty。handoff 以外の変更を誤って revert しない。

## 次の一手

1. `M3E AppState -> Markdown outline` の one-shot converter を作り、1 scope のみを対象に dry-run 出力する。
2. Mapify UI の Markdown import/convert にその Markdown を手動投入し、階層保持の程度を確認する。
3. Mapify から XMind export し、`content.json -> AppState` 変換で元の sibling order / depth が保たれるか比較する。
4. Ext Browser logged-in で内部 API を使う場合は、cookie を外へ出さない content-script/local-helper 境界を設計する。
5. 実装するなら M3E 側に薄い adapter として置き、Mapify を正本化しない。

## 再開コマンド

```bash
cd /Users/nisimoriyuuya/dev/M3E
git status --short
ls -lh /Users/nisimoriyuuya/.codex/tmp/mapify
find /Users/nisimoriyuuya/.codex/tmp/mapify/xmind-unpacked -maxdepth 1 -type f -print -exec sh -c 'printf "  "; wc -c "$1"' sh {} \;
```

Mapify export artifact を再展開する場合:

```bash
rm -rf /Users/nisimoriyuuya/.codex/tmp/mapify/xmind-unpacked
mkdir -p /Users/nisimoriyuuya/.codex/tmp/mapify/xmind-unpacked
unzip -q "/Users/nisimoriyuuya/Downloads/Hopf Algebra_ definition and structure.xmind" -d /Users/nisimoriyuuya/.codex/tmp/mapify/xmind-unpacked
```

## 参照メモ

- Official: Mapify Markdown blog: `https://mapify.so/blog/convert-markdown-to-mind-map`
- Official: Mapify Markdown tool page: `https://mapify.so/cn/tools/markdown-to-mind-map`
- Mapify editor URL used in testing: `https://mapify.so/ja/app/fe613410-9135-4622-b48c-1b627279961a`
- Existing `.xmind`: `/Users/nisimoriyuuya/Downloads/Hopf Algebra_ definition and structure.xmind`
- Extracted `content.json`: `/Users/nisimoriyuuya/.codex/tmp/mapify/xmind-unpacked/content.json`
- Generated Markdown: `/Users/nisimoriyuuya/.codex/tmp/mapify/hopf-algebra-definition-from-xmind.md`
- Generated Mermaid SVG: `/Users/nisimoriyuuya/.codex/tmp/mapify/hopf-algebra-definition-from-xmind.render-safe.svg`

