# Handoff: layout() 純関数化 + PN layout設定統合

**日付**: 2026-06-16  
**worktree**: `/Users/nisimoriyuuya/dev/M3E-layout-refactor`  
**branch**: `codex/layout-refactor`  
**ベース**: `dev-beta`

---

## 目的

破綻しない拡張性のある GUI 基盤を作る。  
具体的には `viewer.ts` の描画ロジックを以下の4レイヤーに分離する：

```
[Measure]  content → {w, h}                       (impure: DOM/canvas)
[Layout]   visibleGraph + boxSizes → {x,y,w,h}    (pure) ← 今回実装
[Port]     srcRect + dstRect → ports               (pure) ← 未着手
[Route]    ports + style → SVGPath                 (pure)
[Render]   → SVG → DOM                             (impure)
```

**edge と link の定義（以後この区別を厳守）**：
- `edge` = ツリー親子線
- `link` = GraphLink（ツリー外接続線）

---

## 完了済み

### Phase A: LayoutOptions 型分割
`viewer.ts:6575` 付近に以下3型を定義：

```typescript
type PublicLayoutOptions = {
  spacing?: { nodeGap?: number; levelGap?: number; padding?: number };
  direction?: 'right' | 'left' | 'down' | 'up';
  depthAlign?: 'aligned' | 'packed';
  edge?: { route?: 'elbow' | 'bezier' | 'straight' };
  link?: { route?: 'simple-bezier' | 'orthogonal' | 'straight' };
  scatter?: { seed?: number; strength?: number; repulsion?: number };
};
type InternalLayoutOptions = { displayRootId?, structuredMode?, density?, ... };
type LayoutOptions = PublicLayoutOptions & InternalLayoutOptions;
```

### Phase B: layout() 純関数
`viewer.ts:6881` に `layout(visibleGraph, boxSizes, mode, options): LayoutResult` を定義。  
`buildLayout(state)` はラッパーになった（外部から見た動作変化なし）。  

viewState に追加したフィールド：
- `surfaceLayoutDirection: 'right'|'left'|'down'|'up'`  default: `right`
- `surfaceDepthAlign: 'aligned'|'packed'`  default: `packed`
- `surfaceEdgeRoute: 'elbow'|'bezier'|'straight'`  default: `elbow`
- `surfaceLinkRoute: 'simple-bezier'|'orthogonal'|'straight'`  default: `simple-bezier`

### Phase C: PN に Layout 設定項目を追加
`workbench-ui.tsx` の `makeProgressiveNodes()` に以下を追加：

```
PN > View > Layout > Direction      > right/left/down/up
                   > Depth Align    > aligned/packed
                   > Edge Route     > elbow/bezier/straight       ← ツリー親子線
                   > Link Route     > simple-bezier/orthogonal/straight  ← GraphLink
```

各項目に `active()` で現在値ハイライト、`action()` で viewState 更新 + `m3e:layout-options-changed` イベント発火。

### Phase D: PN GUI を layout() で配置 → **revert済み**
実装したが PN が「崩壊してる」とユーザー報告。  
`progressiveLayout` / `window.m3eLayout` 呼び出しを除去し、従来の CSS column 配置に戻した。  
Phase D は別タスクとして後回し。

---

## 現在の状態

### ビルド
- `npm --prefix beta run build:browser` → **pass**
- `npm --prefix beta run build:test` → **pass**
- TypeScript エラーなし

### 変更ファイル（worktreeのuncommitted diff）
```
beta/src/browser/viewer.globals.d.ts               +36
beta/src/browser/viewer.ts                         +556 / -~120
beta/src/browser/workbench-ui.css                  +11 / -~5
beta/src/browser/workbench-ui.tsx                  +150 / -~50
beta/tests/visual/workbench_progressive_nav.spec.js +37
```

### 未解決
- **目視確認未完了**: `localhost:4173` でサーバー起動中だが、Playwright/Chromium がサンドボックス環境で SIGTRAP/SIGABRT で全滅。実ブラウザでの確認が必要。
- ユーザーが「崩壊してる」と言っていた原因を Codex が特定・修正したが、ブラウザ確認できていない。
  - 修正内容: PN列配置が2階層前提だったため3階層目（`View > Layout > Direction`）が崩れていた。列配置を任意階層対応に修正、CSS overflow/幅を固定。

---

## 次のアクション

1. **ブラウザ目視確認**: `localhost:4173` をリロードして `View > Layout > Direction/Depth Align/Edge Route/Link Route` が正常表示されることを確認
2. **OKなら PR 作成**: `codex/layout-refactor` → `dev-beta`
3. **Phase D（将来）**: PN GUI 自体を `layout()` で配置する。今回は revert 済み。アーキ的には `visibleGraph = PNボタンツリー`、`layout()` で x/y 計算、absolute 配置 という方向は正しい。
4. **Port レイヤー（将来）**: `selectPorts(srcRect, dstRect) → {srcPort, dstPort}` 純関数。GraphLink を矩形の辺中点4点（top/bottom/left/right）に正しく接続する。`LinkPort` 型は既存。

---

## コンテキスト

- node = 長方形前提 → port = 辺の中点4点（固定）
- per-link の `port`/`direction`/`style` は GraphLink 側に持つ（LayoutOptions ではない）
- `window.m3eLayout` は viewer.ts が window に expose した layout() のブリッジ（workbench-ui.tsx から参照可能にするため）
- codex-session skill の `start.sh` の MODEL が `gpt-5.2` でエラーになる → `${MODEL:-gpt-5.5}` に修正済み（`M3E/.claude/skills/claude-codex-session-pack-20260214/skills/codex-session/scripts/start.sh`）
