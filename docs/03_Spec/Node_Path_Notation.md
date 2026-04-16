# Node Path Notation

M3E マップ上のノードを会話・ログ・スキル指示で指し示すための表記法。

---

## 1. パス表記

### 基本形

スラッシュ `/` で区切り、ルートから対象ノードまでの祖先を並べる。

```
ROOT / SYSTEM / DEV / scratch
```

- 先頭は常に `ROOT`（ルートノードの暗黙名）
- 各セグメントはノードの `text` フィールドで照合する
- 大文字・小文字は区別しない（照合時）
- 前後のスペースは無視する（`ROOT/SYSTEM` と `ROOT / SYSTEM` は同じ）

### ノード名に `/` を含む場合

ノード名そのものにスラッシュが含まれるときは、ノード名をダブルクォートで囲む。

```
ROOT / SYSTEM / "Input/Output" / config
```

クォートが不要な場合（名前に `/` も `"` も含まない）は裸のまま書いてよい。

### ノード名に特殊文字を含む場合

| 文字 | 対処 |
|------|------|
| `/` | ダブルクォートで囲む |
| `"` | `\"` でエスケープ（`"言い換え\"A\""` ） |
| `,` | そのまま使える（区切り文字ではない） |
| `-` `&` `()` スペース | そのまま使える |

### 省略形

中間ノードが一意に特定できる場合、`...` で省略できる。

```
ROOT / ... / scratch          # scratch が全体で1つしかないなら一意
ROOT / SYSTEM / ... / scratch # SYSTEM 配下で一意なら十分
```

省略パスが複数ノードにマッチした場合はエラーとする（曖昧性の報告）。

### 末端の `*` はワイルドカード

```
ROOT / SYSTEM / DEV / *       # DEV の直下の全子ノード
ROOT / SYSTEM / DEV / **      # DEV 配下の全子孫ノード
```

---

## 2. ノードの指定方法

パス以外にもノードを指定する方法がある。用途に応じて使い分ける。

| 方式 | 書き方 | 用途 |
|------|--------|------|
| フルパス | `ROOT / SYSTEM / DEV / scratch` | 一意に特定（人間向け） |
| 省略パス | `ROOT / ... / scratch` | 短く書きたいとき |
| 名前マッチ | `"scratch"` | 会話中の簡略指定 |
| ID 指定 | `#n_1234_abc` | プログラム・ログ用 |
| 相対指定 | `./子ノード名` | 現在スコープ基準 |

### 名前マッチ

ダブルクォートで囲んだテキストで名前検索する。一致が複数ある場合は曖昧性エラー。

```
"scratch"       # text が "scratch" のノードを検索
"Collaboration & Sync"
```

### ID 指定

`#` に続けてノード ID を書く。プログラムやログでの正確な参照に使う。

```
#n_1234567890_abc123
```

### 相対指定

現在のスコープまたは直前に指定したノードを基準とする。

| 表記 | 意味 |
|------|------|
| `./子` | 現在ノードの子で名前が「子」のもの |
| `../` | 親ノード |
| `../兄弟` | 同じ親を持つ「兄弟」という名前のノード |

---

## 3. スコープの表記

### 現在スコープ

`@scope` で現在のスコープを指す。

```
@scope              # 現在スコープのルートノード
@scope / タスク一覧  # 現在スコープ内の「タスク一覧」
```

### スコープパス

folder がスコープ境界を作る。ブレッドクラムと同じ表記。

```
[ROOT] > [SYSTEM] > [DEV]    # ブレッドクラム形式（UI表示用）
ROOT / SYSTEM / DEV           # パス形式（指示用。こちらが標準）
```

ブレッドクラム形式は UI 表示やログの参考表記として使う。操作指示では標準のパス形式を使う。

---

## 4. 複数ノードの列挙

### 1ノード vs 複数ノードの区別

ノード名にハイフンやスペースが含まれる場合と、複数ノードの列挙を区別する必要がある。

**原則: 列挙にはカンマ `,` を使い、中括弧 `{}` で囲む。**

```
# 1つのノード（名前に - やスペースを含む）
ROOT / SYSTEM / DEV / Collaboration & Sync

# 複数ノードの列挙
ROOT / SYSTEM / DEV / {scratch, Objective, strategy}
```

### 列挙構文 `{}`

中括弧 `{}` 内にカンマ区切りでノード名を並べると「同じ親の下にある複数ノード」を指す。

```
ROOT / DEV / {scratch, Objective}    # DEV 直下の scratch と Objective
```

列挙なしで書けば常に 1 ノードを指す。曖昧性は生じない。

### 列挙の例

```
# DEV の子ノード scratch と strategy を指す
ROOT / SYSTEM / DEV / {scratch, strategy}

# 「A-B」という名前の1ノード（ハイフンはノード名の一部）
ROOT / SYSTEM / DEV / A-B

# 「A」と「B」という2ノード
ROOT / SYSTEM / DEV / {A, B}
```

---

## 5. 操作の表記

会話やスキル指示でノード操作を記述するときの書き方。

### 追加

```
+ "新ノード名"  under  ROOT / SYSTEM / DEV / scratch
+ "子ノードA", "子ノードB"  under  ROOT / ... / scratch    # 複数追加
```

### 削除

```
- ROOT / SYSTEM / DEV / scratch / 不要なメモ
```

### 移動

```
ROOT / DEV / scratch / メモ  ->  ROOT / DEV / Objective /
```

`->` の右側は移動先の親ノード。末尾の `/` は「その下に入れる」ことを明示する。

### テキスト編集

```
ROOT / DEV / scratch / 古い名前  :=  "新しい名前"
```

### ステータス変更

```
ROOT / DEV / strategy / タスクA  [status: done]
ROOT / DEV / strategy / タスクA  [status: doing, priority: high]
```

---

## 6. 既存表記との整合

### Akaghef が使っている形式

```
ROOT / SYSTEM / DEV / Objective / strategy / Collaboration & Sync
```

これはそのまま本仕様のフルパスとして有効。変更不要。

### m3e-scratch スキル

```
ROOT / SYSTEM / DEV / scratch
```

フルパスそのまま。

### map-update スキル

操作指示の形式:

```
/map-update
- "conflict backup" -> done（ノード削除）
- "entity list UI" -> doing（進捗: デザイン完了）
```

これは本仕様の名前マッチ + ステータス変更として解釈できる:

```
"conflict backup"  [status: done]    # 名前マッチで特定
"entity list UI"   [status: doing]
```

### Command_Language (m3e.*)

```javascript
m3e.find("scratch")              // 名前マッチ
m3e.tree(m3e.find("DEV"))        // パス不要（API が ID を返す）
```

パス表記は人間向け。API は ID ベースで動く。対応関係:

| パス表記 | API 相当 |
|----------|----------|
| `ROOT / ... / scratch` | `m3e.find("scratch")` |
| `ROOT / DEV / *` | `m3e.children(m3e.find("DEV"))` |
| `#n_1234_abc` | 直接 ID 参照 |

### ブレッドクラム (Scope_Transition.md)

```
[ルート] > [研究テーマA] > [仮説グループ1]
```

UI 表示用。操作指示には使わない。パス表記に変換可能:

```
ROOT / 研究テーマA / 仮説グループ1
```

---

## 7. まとめ: 早見表

| やりたいこと | 書き方 |
|-------------|--------|
| ノードを一意に指す | `ROOT / SYSTEM / DEV / scratch` |
| 省略して指す | `ROOT / ... / scratch` |
| 名前で指す | `"scratch"` |
| ID で指す | `#n_1234_abc` |
| 子を全部 | `ROOT / DEV / *` |
| 子孫を全部 | `ROOT / DEV / **` |
| 複数ノードを列挙 | `ROOT / DEV / {A, B, C}` |
| 追加 | `+ "名前" under パス` |
| 削除 | `- パス` |
| 移動 | `パス -> 新しい親/` |
| 名前変更 | `パス := "新名前"` |
| 属性変更 | `パス [key: value]` |
| 現在スコープ | `@scope` |
| スコープ内相対 | `./子ノード` |
| 親 | `../` |

---

## 関連文書

- [Data_Model.md](Data_Model.md) -- ノード構造の定義
- [Scope_and_Alias.md](Scope_and_Alias.md) -- スコープとエイリアス
- [Scope_Transition.md](Scope_Transition.md) -- スコープ遷移とブレッドクラム
- [Command_Language.md](Command_Language.md) -- プログラム向け API
