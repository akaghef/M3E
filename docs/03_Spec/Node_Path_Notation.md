# Node Path Notation

M3E マップ上のノードを、会話・ログ・スキル指示・Map Manager 指示で指し示すための公式表記法。

---

## 1. 公式パス表記

### 基本形

公式の表示・指示用パスは `>` と `>>` で区切る。

```text
M:(開発)> SYSTEM > DEV >> scratch
```

- `M:(map label)` は対象 map の表示名。
- `>` は同一 scope 内の通常セグメント。
- `>>` は scope boundary を越える位置。
- 各セグメントはノードの `text` フィールドで照合する。
- 大文字・小文字は照合時に区別しない。
- 前後のスペースは無視する。

### Scope boundary

`folder` node は scope boundary を作る。scope boundary を含む path では、その境界の直前だけ `>>` を使う。

```text
M:(開発)> SYSTEM > DEV >> strategy > Collaboration & Sync
```

この例では `DEV` から `strategy` に scopen している。

### ルート

root を明示したい場合は次の形を使う。

```text
M:(開発)> root
```

通常の会話・指示では、root から始める旧 `ROOT / ...` 形式ではなく、map label から始める公式形を使う。

---

## 2. 非公式・互換表記

### `/`

`/` は公式の map-internal separator ではない。legacy/API/external compatibility のためだけに受け付ける。

```text
Map:Root/SYSTEM/DEV/scratch
```

この形は、古いログ・古い skill・API resolve・外部コピーとの互換用であり、新しい user-facing / AI-facing / Map Manager 指示では使わない。

### `\`

`\` は filesystem path 専用。map-internal path separator として使わない。

```text
C:\Users\Akaghef\dev\M3E
```

---

## 3. ノード名の扱い

### 区切り文字を含む名前

ノード名そのものに `>`、`>>`、`/`、`\` が含まれる場合、曖昧なので会話指示では可能なら ID 指定を使う。

```text
#n_1234567890_abc123
```

人間向けには、該当セグメントをダブルクォートで囲んでもよい。

```text
M:(開発)> SYSTEM > "Input/Output" > config
```

ただし quote parsing はすべての古い API/skill で保証されない。正確な操作では ID 指定を優先する。

### 省略形

中間ノードが一意に特定できる場合、`...` で省略できる。

```text
M:(開発)> ... > scratch
M:(開発)> SYSTEM > ... >> strategy
```

省略パスが複数ノードにマッチした場合は曖昧性エラーとする。

---

## 4. ノードの指定方法

| 方式 | 書き方 | 用途 |
|---|---|---|
| 公式フルパス | `M:(開発)> SYSTEM > DEV >> scratch` | 人間・AI・Map Manager 指示 |
| 公式省略パス | `M:(開発)> ... > scratch` | 短く指す |
| 名前マッチ | `"scratch"` | 会話中の簡略指定 |
| ID 指定 | `#n_1234_abc` | プログラム・ログ・曖昧性回避 |
| 現在 scope | `@scope` | 現在 scope root |
| 相対指定 | `./子ノード名` | 現在 scope / 現在 node 基準 |
| legacy/API | `Map:Root/SYSTEM/DEV/scratch` | 互換・resolve endpoint |

### ID 指定

`#` に続けて node ID を書く。プログラムやログでの正確な参照に使う。

```text
#n_1234567890_abc123
```

### 相対指定

| 表記 | 意味 |
|---|---|
| `./子` | 現在ノードの子で名前が「子」のもの |
| `../` | 親ノード |
| `../兄弟` | 同じ親を持つ「兄弟」という名前のノード |

---

## 5. 操作の表記

会話や skill 指示でノード操作を記述するときは公式 path を使う。

### 追加

```text
+ "新ノード名" under M:(開発)> SYSTEM > DEV >> scratch
+ "子ノードA", "子ノードB" under M:(開発)> ... >> scratch
```

### 削除

```text
- M:(開発)> SYSTEM > DEV >> scratch > 不要なメモ
```

### 移動

```text
M:(開発)> DEV >> scratch > メモ -> M:(開発)> DEV >> Objective
```

`->` の右側は移動先の親ノード。

### テキスト編集

```text
M:(開発)> DEV >> scratch > 古い名前 := "新しい名前"
```

### ステータス変更

```text
M:(開発)> DEV >> strategy > タスクA [status: done]
M:(開発)> DEV >> strategy > タスクA [status: doing, priority: high]
```

---

## 6. API との対応

公式 path は人間・AI・Map Manager 指示用。API は最終的に node ID ベースで動く。

| 表記 | API 相当 |
|---|---|
| `M:(開発)> ... > scratch` | `m3e.find("scratch")` または resolve |
| `M:(開発)> DEV >> scratch` | resolve 後に node ID 参照 |
| `#n_1234_abc` | 直接 ID 参照 |
| `Map:Root/SYSTEM/DEV/scratch` | legacy resolve compatibility |

`/api/maps/{mapId}/resolve?path=...` は legacy/API path も受け付けるが、UI 表示・新規指示・skill 出力は公式 path を返す。

---

## 7. 早見表

| やりたいこと | 書き方 |
|---|---|
| ノードを一意に指す | `M:(開発)> SYSTEM > DEV >> scratch` |
| scope boundary を示す | `>>` |
| 通常 segment を示す | `>` |
| 省略して指す | `M:(開発)> ... > scratch` |
| 名前で指す | `"scratch"` |
| ID で指す | `#n_1234_abc` |
| 追加 | `+ "名前" under M:(開発)> ... > 親` |
| 削除 | `- M:(開発)> ... > node` |
| 移動 | `M:(開発)> ... > node -> M:(開発)> ... > new parent` |
| 名前変更 | `M:(開発)> ... > old := "new"` |
| 属性変更 | `M:(開発)> ... > node [key: value]` |
| 現在 scope | `@scope` |
| legacy/API 互換 | `Map:Root/SYSTEM/DEV/scratch` |

---

## 8. 関連文書

- [Data_Model.md](Data_Model.md) -- ノード構造の定義
- [Scope_and_Alias.md](Scope_and_Alias.md) -- スコープとエイリアス
- [Scope_Transition.md](Scope_Transition.md) -- スコープ遷移とブレッドクラム
- [Command_Language.md](Command_Language.md) -- プログラム向け API
