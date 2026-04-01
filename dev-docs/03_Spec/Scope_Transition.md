# Scope 遷移仕様

最終更新: 2026-04-01

---

## 概要

Scope 遷移とは、ユーザーが現在の「folder world」から別の folder world に入り、また戻る操作のことである。
現在スコープ（`currentScopeId`）を切り替えることで、表示・編集の対象が切り替わる。

---

## 状態定義

### ViewState に追加する項目

```ts
currentScopeId: string   // 現在表示しているスコープの rootFolder ノード ID
                         // ルート（最上位）の場合は固定値 "root"
scopeHistory: string[]   // 遷移履歴（戻るために使用）。末尾が直前のスコープ
```

- `currentScopeId` は `PersistedDocument` に含めない（ViewState のみ）
- 再起動後も復元できるよう、`ViewState` のセッション保存対象に含める

---

## 遷移トリガー

| 操作 | 遷移先 |
|------|--------|
| folder ノードを **ダブルクリック** | その folder のスコープへ入る |
| ブレッドクラムの項目をクリック | その祖先スコープへ戻る |
| キーボード `Alt+Enter`（folder 選択中） | その folder のスコープへ入る |
| キーボード `Backspace`（ノード非編集中） | 親スコープへ戻る |
| ツールバーの「← 戻る」ボタン | 直前のスコープへ戻る |

### 注意

- folder に「入る」操作と、ノードを「編集開始する」操作（`F2` / 通常ダブルクリック）は区別する
- folder ノードの場合: **ダブルクリック = スコープ遷移**（編集開始は `F2` のみ）
- text ノードの場合: **ダブルクリック = 編集開始**（変更なし）

---

## 遷移時の処理

### 入る（EnterScopeCommand）

```
1. scopeHistory に現在の currentScopeId を push
2. currentScopeId を対象 folder のノード ID に更新
3. viewport を初期位置にリセット（fit-to-content）
4. 選択状態をクリア
5. 表示ノードを新スコープ以下に絞り込む
```

**Command の位置づけ:**
ViewState の変更のみであり、PersistedDocument は変更しない。
Undo/Redo の対象外とする（scopeHistory で独自に管理する）。

### 戻る（ExitScopeCommand）

```
1. scopeHistory が空なら何もしない（最上位スコープ）
2. scopeHistory から末尾を pop
3. currentScopeId を取り出した値に更新
4. viewport を前回の位置に戻す（ViewState に保存していれば）
5. 元のスコープで選択していたノードを復元する（ViewState に保存していれば）
```

---

## 表示ルール

### 現在スコープ内のノード

- `currentScopeId` の folder 以下のノードをすべて表示する
- その folder ノード自体はルートとして表示する（ノードラベルは表示する）

### スコープ外ノードの扱い

- 現在スコープ外の実体ノードは表示しない
- 現在スコープ内に alias があれば、その alias は表示する（参照先が外部スコープでも可）
- alias は視覚的に区別する（→ alias 描画仕様参照）

### 最上位スコープ

- `currentScopeId === "root"` のとき、全ノードのうち最上位のツリーを表示する
- 未所属ノードは表示しない

---

## ブレッドクラム

ブレッドクラムは現在のスコープ階層を示す。

```
[ルート] > [研究テーマA] > [仮説グループ1]
```

- 各項目はクリック可能で、そのスコープに直接ジャンプする
- ジャンプ時は途中のスコープを scopeHistory に積む
- 現在スコープは末尾に表示し、クリック不可とする

### 配置

ツールバー上部または viewer 上端に固定表示する。スコープ深度が増えても省略せず表示する（折り返し可）。

---

## キーボード操作まとめ

| キー | 条件 | 動作 |
|------|------|------|
| `Alt+Enter` | folder ノード選択中 | スコープに入る |
| `Backspace` | ノード非編集中 | 親スコープへ戻る |
| `Escape` | スコープ内 | 何もしない（スコープ遷移には使わない） |

---

## alias の表示（スコープ遷移との関係）

- alias ノードをダブルクリックしてもスコープ遷移は発生しない
- alias の参照先が folder であっても、そのスコープへの自動遷移は行わない
- alias から参照先スコープへ移動するには、別途「参照先を開く」操作（右クリックメニュー等）を使う
  （→ 将来実装。Phase 1 では alias のクリック動作は「参照先ノードへジャンプ」に留める）

---

## ViewState の保存・復元

再起動後も以下を復元する。

| 項目 | 保存先 |
|------|--------|
| `currentScopeId` | ViewState セッション保存 |
| `scopeHistory` | ViewState セッション保存 |
| 各スコープの viewport（pan/zoom） | ViewState セッション保存（スコープ ID をキーに Map で管理） |
| 各スコープの選択ノード | 復元しない（遷移時にクリア） |

---

## エラー・エッジケース

| ケース | 対応 |
|--------|------|
| `currentScopeId` のノードが削除された | `"root"` にフォールバック |
| `scopeHistory` 内のノードが削除された | その項目をスキップしてさらに戻る |
| 循環参照（alias から自分のスコープへ） | 遷移を許可しない（入口でチェック） |
| 最上位スコープで「戻る」 | 何もしない（戻るボタンを無効化表示） |

---

## 実装フェーズ

### Phase 1（今回実装）

- [ ] `currentScopeId` / `scopeHistory` を ViewState に追加
- [ ] folder ノードのダブルクリックで `EnterScope`
- [ ] ツールバー「← 戻る」ボタンで `ExitScope`
- [ ] ブレッドクラム表示（クリックで直接ジャンプ）
- [ ] スコープ外ノードの非表示
- [ ] `Alt+Enter` / `Backspace` キーバインド
- [ ] ViewState のセッション保存・復元（`currentScopeId`）

### Phase 2（後続）

- [ ] 各スコープの viewport を個別保存・復元
- [ ] alias の「参照先を開く」操作
- [ ] スコープ間 alias 表示の整合（rename/delete 時）
- [ ] 全体俯瞰ビュー（スコープを折りたたんで表示）

---

## 関連文書

- Scope/Alias 原則: [Scope_and_Alias.md](Scope_and_Alias.md)
- Data Model: [Data_Model.md](Data_Model.md)
- MVC and Command: [../04_Architecture/MVC_and_Command.md](../04_Architecture/MVC_and_Command.md)
- Editing Design: [../04_Architecture/Editing_Design.md](../04_Architecture/Editing_Design.md)
- Model State/Schema v2: [Model_State_And_Schema_V2.md](Model_State_And_Schema_V2.md)
