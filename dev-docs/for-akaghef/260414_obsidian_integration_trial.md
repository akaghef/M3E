# Obsidian 連携を実際に試す手順

2026-04-14 時点での「いま自分で触る」ための最短ガイド。

## 先に結論

- Obsidian 連携の実装は **`dev-beta-obsidian` ブランチ** にある
- PR は **#52**
- いま具体的に試すなら、まずそのブランチに切り替えて `beta/` を build して起動する

---

## 1. 試す前提

現時点では `dev-beta` に未マージの可能性があるので、まず実装ブランチへ移る。

```powershell
git fetch origin
git switch dev-beta-obsidian
cd beta
npm ci
npm run build
node dist/node/start_viewer.js
```

起動先:

- `http://localhost:4173/viewer.html`

もし `4173` が既に使われているなら:

```powershell
$env:M3E_PORT="4174"
node dist/node/start_viewer.js
```

その場合の起動先:

- `http://localhost:4174/viewer.html`

---

## 2. すぐ試せるサンプル

このブランチには `test-vault/` が入っている。

構成:

```text
test-vault/
├── Index.md
├── notes/
│   ├── Alpha.md
│   └── Beta.md
└── assets/
    └── image.png
```

ポイント:

- `Index.md` に frontmatter: `tags: [demo]`, `aliases: [Home]`
- `Alpha.md` に `[[Beta]]`
- `Alpha.md` に `[[notes/Gamma|γ]]`（存在しない note への broken link）
- `Alpha.md` に `![[assets/image.png]]`

---

## 3. Import を試す

M3E の上部 toolbar から:

1. `Import`
2. `Vault md...`
3. `test-vault` の**絶対パス**を入力
4. 実行

Windows なら、たとえば:

```text
C:\Users\Akaghef\dev\M3E\test-vault
```

期待する結果:

- `test-vault` という folder ノードができる
- `Index` ノードに `tags=demo`, `aliases=Home` が入る
- `Alpha` から `Beta` への alias ができる
- `[[notes/Gamma|γ]]` は broken alias になる
- `![[assets/image.png]]` は現状 crash しなければ OK。最終仕様は未確定

補足:

- AI transform が未設定でも import 自体は動く
- その場合、本文は階層化されず `details` 側に寄る fallback になる

---

## 4. Export を試す

Import 後に M3E 上で少し編集する。

おすすめの試し方:

1. `Alpha` を `Alpha-edited` に rename
2. `Alpha-edited` の子に text node を 1 つ追加
3. `Index` の tag を `demo-updated` に変更

次に toolbar から:

1. `Export`
2. `Vault md...`
3. 出力先フォルダを指定

例:

```text
C:\Users\Akaghef\dev\M3E\test-vault-out
```

確認ポイント:

- `notes/Alpha-edited.md` が出る
- `notes/Alpha.md` は出ない
- `Index.md` の frontmatter に更新された tag が入る
- alias が `[[wikilink]]` に戻る

注意:

- 現時点の fallback export は **round-trip 品質がまだ弱い**
- 「意味は戻るが Markdown の形はかなり変わる」ケースがある

---

## 5. Watch を試す

toolbar から:

1. `Integrate`
2. `Set Vault Path...`
3. `test-vault` の絶対パスを入れる
4. `Vault md SoT`

この状態で:

### 5-1. Vault → M3E

外部エディタで:

- `test-vault/notes/Beta.md` を開く
- 1 行足して保存

期待:

- 数秒以内に M3E 側の `Beta` が更新される

### 5-2. delete の扱い

外部で:

- `test-vault/notes/Alpha.md` を削除

期待:

- M3E 側で即 silent delete されない
- file node は `missing` 扱いの soft-delete になる
- Alpha を向いていた alias は broken 化する

### 5-3. M3E → Vault

M3E 側で:

- `Beta` の body / details を編集

期待:

- debounce 後に `Beta.md` へ書き戻る

---

## 6. 1000 file の負荷確認を試す

repo root で:

```powershell
node scripts/gen_vault.mjs tmp\manual-scale-vault 1000
```

または:

```powershell
bash scripts/gen_vault.sh tmp/manual-scale-vault 1000
```

これで `Index.md` を含めて合計 1000 markdown files の vault を作る。

その後、Import を同じ手順で実行して以下を見る:

- import 完了までの時間
- viewer が固まらないか
- メモリ使用量が極端に跳ねないか

2026-04-14 の codex 記録では:

- `skipAiTransform=true` 相当で約 `603ms`
- AppState 約 `1.46 MB`
- Peak Working Set 約 `89.9 MB`

ただしこれは API ベース計測で、体感 UI は別途見る必要がある。

---

## 7. セキュリティ確認も 1 回やる

Import 時に、vault path に以下のような値を入れて拒否されることを確認する:

```text
C:\Windows\System32
```

期待:

- `vaultPath points to a protected system directory.` のようなエラーで拒否

これは Cloud Sync / 公開 URL につなぐ前の最低限の確認。

---

## 8. まだ未確定の点

beta map の `DEV > reviews > Obsidian Integration` に Q1-Q5 を置いてある。

判断待ち:

- Q1 `![[image.png]]` を image node にするか
- Q2 Dataview / Templater 記法をそのまま残すか
- Q3 6000 chars 超過時の扱い
- Q4 外部 delete を soft/hard のどちらにするか
- Q5 改行コードを file ごとに維持するか

---

## 9. いまのおすすめ試行順

1. `dev-beta-obsidian` へ切り替えて起動
2. `test-vault/` を import
3. `Alpha -> Alpha-edited` で export
4. watch を on にして `Beta.md` を外で編集
5. `Alpha.md` を削除して soft-delete を確認
6. `scripts/gen_vault.mjs ... 1000` で重さを見る

---

## 10. 見るべき場所

- 実装ブランチ: `dev-beta-obsidian`
- PR: `#52`
- 手動試験メモ: `backlog/obsidian-integration-manual-test.md`
- spec: `dev-docs/03_Spec/Obsidian_Vault_Integration.md`
- design: `dev-docs/design/local_file_integration.md`
