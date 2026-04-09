---
name: m3e-shortcuts
description: "M3E viewer.tsのキーボードショートカットを追加・編集・削除するためのガイド。ユーザーが「ショートカット追加」「キーバインド変更」「hotkey」「キーボード操作」などに言及したとき、または viewer.ts の keydown ハンドラを修正する必要があるときに使用する。"
---

# M3E Keyboard Shortcut Guide

M3Eのキーボードショートカットは `final/src/browser/viewer.ts` 内のグローバル `keydown` イベントハンドラで管理されている。ショートカット設定ファイルやレジストリは無く、if/else chainで直接記述するスタイル。

## ワークフロー

ショートカットの追加・編集・削除は以下の順序で行う。

### 1. 仕様ドキュメントを確認する

まず以下のドキュメントを読み、現在のキー割り当てとアクション定義を把握する。

| ファイル | 内容 |
|---|---|
| `dev-docs/06_Operations/Keybindings_Beta.md` | キー → アクション名のマッピング（全キーの一覧） |
| `dev-docs/06_Operations/Actions_Beta.md` | アクション名 → 説明・備考 |

これらが「仕様」であり、実装の正解はここに書かれている。衝突チェックもこのドキュメントで行う。

### 2. 実装する

実装対象は `final/src/browser/viewer.ts` の keydown ハンドラ。詳細は後述の「実装ガイド」を参照。

### 3. 仕様ドキュメントを更新する

実装が完了したら、変更内容に応じて `Keybindings_Beta.md` と `Actions_Beta.md` を更新する。

- 新規ショートカット → 両方に追記
- キー変更 → `Keybindings_Beta.md` を更新
- アクション動作変更 → `Actions_Beta.md` を更新
- 削除 → 両方から該当行を削除（`Keybindings_Beta.md` 側は `—` に戻す）

### 4. チートシートを更新する

ショートカット一覧のオーバーレイ（Ctrl/Alt 長押しで表示）は `viewer.html` 内の `#shortcut-cheatsheet` にハードコードされている。ショートカットを変更したら必ずこの HTML も同期させること。

- 対象: `beta/viewer.html`（および同期時に `final/viewer.html`）内の `<div id="shortcut-cheatsheet">` ブロック
- 構造: 2カラム × 複数グループ（Navigation / Editing / View / Clipboard / Structure / Thinking Mode）
- 各行のフォーマット: `<div class="cheatsheet-row"><kbd>キー</kbd><span>説明</span></div>`

変更パターン:
- 新規ショートカット → 該当グループに行を追加
- キー変更 → `<kbd>` 内のキー表記を更新
- 削除 → 該当行を削除
- グループが増える場合 → `<div class="cheatsheet-group">` を新設

### 5. 型チェック

```bash
npx tsc -p tsconfig.browser.json --noEmit
```

---

## 実装ガイド

### ハンドラの位置

3つの独立した `keydown` ハンドラが存在する。目的に応じて正しいハンドラに追加すること。

| ハンドラ | 検索キーワード | 用途 |
|---|---|---|
| **メインハンドラ** | `document.addEventListener("keydown"` | ツリー操作全般（ノード選択、スコープ遷移、コピペ等） |
| **インラインエディタ** | `input.addEventListener("keydown"` | テキスト編集中のショートカット（Enter, Tab, Escape等） |
| **リニアテキストパネル** | `linearTextEl?.addEventListener("keydown"` | メモパネル内のショートカット（Ctrl+Enter保存等） |

### メインハンドラの構造

```
document.addEventListener("keydown", (event: KeyboardEvent) => {
  // ── ガード節 ──
  if (!doc) return;
  if (inlineEditor && document.activeElement === inlineEditor.input) return;
  if (document.activeElement === linearTextEl) return;

  // ── ショートカット定義（if → preventDefault → command → return） ──
  // Ctrl系 → 特殊キー(Escape, Tab, Enter, F2) → 数字キー → Alt系 → 裸キー → 矢印キー
  // この順序に意味がある：修飾キー付きが先、裸キーが後
});
```

### ショートカット追加テンプレート

```typescript
if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "k") {
  event.preventDefault();
  myCommand();
  return;
}
```

### 修飾キーの書き方

| やりたいこと | 条件式 |
|---|---|
| Ctrl/Cmd | `(event.ctrlKey \|\| event.metaKey)` |
| Ctrl/Cmd+Shift | `(event.ctrlKey \|\| event.metaKey) && event.shiftKey` |
| Alt | `event.altKey` |
| 裸キー（修飾なし） | `!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey` |

Mac互換のため、Ctrl条件には必ず `event.metaKey` を OR で含める。使わない修飾キーは明示的に `!event.shiftKey` 等で否定する（意図しない発火を防ぐため）。

### キー値の書き方

| キーの種類 | 書き方 |
|---|---|
| アルファベット | `event.key.toLowerCase() === "k"` （CapsLock対応） |
| 数字 | `event.key === "1"` |
| 特殊キー | `event.key === "Enter"` （`"Escape"`, `"Tab"`, `"F2"`, `"Delete"`, `"Backspace"`, `"ArrowUp"` 等） |
| 記号 | `event.key === "]"` |

### 挿入位置のルール

ショートカットの挿入位置は優先度に直結する（最初にマッチしたものが発火）。

1. **修飾キー付き（Ctrl/Cmd系）** → ハンドラの先頭寄り
2. **特殊キー（Escape, Tab, Enter, F2）** → 中間
3. **裸の数字キー** → 中間
4. **Alt系** → 後半
5. **裸のアルファベット** → 最後尾寄り
6. **矢印キー** → 最末尾

同じカテゴリ内では、既存のショートカットの近くに配置する。

### その他の注意点

- `event.preventDefault()` — ブラウザデフォルト動作の抑止。必須。
- `return` — 後続ショートカットの発火を防止。必須。
- `event.repeat` — 長押し連打を防ぎたい場合は `if (!event.repeat)` ガードを追加（既存例: `toggleReparentSource`）。
