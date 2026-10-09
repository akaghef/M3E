# OT Component Seam Labs

Fixture を投入し、OT の描画と操作を評価する Beta workshop。責務は次の 2 つ。

| route | 責務 | 主な確認対象 |
|---|---|---|
| `routes/surface-overview.html` | 全体像 | DECK cards、NETWORK graph、view/history 切替、selection、hover、`.nctl` tuning / Reset |
| `routes/agent-detail.html` | 単一 AI agent の詳細 | 名前 / metadata / summary、History / Output、sparkline、role controls、Close / reopen |

起動入口は `/src/labs/index.html`。旧 7 fragment routes は削除した。空枠や依存不足を合格として扱わない。

## Upstream とライセンス

`gyroid-eth/orrery-telemetry` commit `22ffe6483530e643c8fc1af486319990e0181de4`、`dashboard/index.html`。

PolyForm Perimeter 1.0.1。Required Notice: **Copyright (c) 2026 gyroid**。
本文は `upstream/LICENSE`。portrait と provider logo も同じ upstream 由来。

## 依存 closure と調整箇所

`provenance.json` に source path、commit、1-based inclusive 行範囲、SHA-256、`adapted` と理由を記録する。

- **surface-overview**: script `28916–28949`（route parser）と `30070–34885`（連続した operational closure）、markup `2434–2824`。`esc`、`drag`、`gmap`、`NR`、`render`、`bay`、`buildEls`、力学、tuning、selection、詳細・replay・spawn の相互参照までまとめて保持する。詳細などの補助 UI は closure に含まれるが、この seam の合格責務は全体像。iframe、全体の複製隠蔽、harness による描画再実装はない。
- **agent-detail**: script `33418–33906` の詳細実装全体に、upstream の error reporting (`30081–30094`)、escaping / portrait lookup (`30114–30136`, `30149–30152`)、portrait / toast / jump (`30387–30432`) を含める。markup は `2777–2824`。DECK / NETWORK の DOM や力学をロードしない。
- **overview の調整**: cockpit 専用 theme bridge と巨大な generated inventory は省略する。元の server defaults と suspension flag を cut 先頭で宣言する。upstream stylesheet は `11–2417` を逐語保持する。テーマ軸操作は評価範囲外。
- **detail の調整**: cut の bootstrap で `lastData` に fixture の先頭 1 件を渡し、`EMBED_MODE=false` にする。`openPanel` を起動時と reopen ボタンで呼ぶ。markup に reopen ボタンと toast host を加える。詳細の描画・状態遷移は upstream のまま。
- **harness**: DOM host、fixture globals、read-only fetch、classic script load、upstream 既設の `AGENTSTACK_DEMO.portraitURL/assetURL` hooks への asset URL 供給だけを行う。

adapted cut 全体の 100% byte identity は要求しない。ただし上記の主要 source region は逐語の連続部分文字列であることを検査し、未申告の改変や欠落は失敗させる。元 dashboard の digest と license notice も検査する。

## Fixture 境界

`OT_NATIVE_FIXTURES` は upstream payload 語彙を維持する。graph `nodes` は名前だけでなく node object 配列。live は 2 cards、all history は gone を含む 3 cards、NETWORK は 3 nodes / 1 communication link / 1 spawn link。

`shared/safe_fetch.ts` は一切 live fetch に転送しない。`/api/agents`、`/api/graph`、history、deliverables などを mock 応答にする。未登録 GET は `404 OT_LAB_UNMOCKED_READ`。GET / HEAD 以外は `403 OT_LAB_WRITE_ATTEMPT` と同名の window event。`Request.method` と `init.method` override の両方に対応する。upstream が捕捉した `/api/jserr` も console に出し、ブラウザ検証で見逃さない。

role の preset 選択は操作できるが保存は拒否される。OPEN TMUX / Exit / spawn も実処理しない。補助機能の spawn catalog / replay / mail streaming はこの 2 seam の評価保証範囲外（messages-since は空 stream）。upstream のローカル tuning 設定保存は保持する。

## 検証

`beta/` で実行する。

```sh
npm run build:node
npx vitest run tests/unit/ot_component_seam_labs.test.ts --testTimeout 10000 --hookTimeout 10000 --reporter verbose
npm run typecheck
npm run build:browser
npm run check:ot-provenance
npm run check:ot-build-artifacts
./node_modules/.bin/playwright test --config playwright.ot-seam.config.js tests/visual/ot_component_seam_labs.spec.js
```

provenance 検査には pinned checkout `/tmp/orrery-telemetry-inspect` が必要。

Vitest は jsdom 内で各 cut を実行し、fixture が作る DOM と control state を検証する。media / layout / animation API は stub なので、見た目や力学収束の測定には使わない。

Playwright は production preview の 2 routes を開き、可視 card / graph / detail、具体的な子要素、Reset / view / history / selection / hover / panel 操作を検証する。page error、console error（ReferenceError を含む）、asset 失敗、live API request は失敗。DOM と screenshot は test artifact に添付する。

この worker 環境では preview bind が `listen EPERM 127.0.0.1:14278`、単独 Chromium 起動も `SIGTRAP` で停止した。**Playwright: 未実行（Director 依頼）**。対象: `tests/visual/ot_component_seam_labs.spec.js` の 2 tests。DOM 実行テストを browser 描画成功と読み替えない。
