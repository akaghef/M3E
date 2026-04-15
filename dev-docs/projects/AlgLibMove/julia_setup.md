---
project: AlgLibMove
date: 2026-04-15
topic: Julia 開発環境セットアップ（Windows 11 / Application Control 回避込み）
status: 実施記録
---

# 環境

- OS: Windows 11 Home
- Julia: 1.12.6（juliaup 経由）
- ユーザ: Akaghef（OneDrive でドキュメント同期あり）
- ドキュメントパス: `C:\Users\Akaghef\OneDrive\ドキュメント\WindowsPowerShell\`

# 遭遇した問題

## Application Control による `.dll` ブロック

Julia 1.12 は precompile キャッシュをネイティブコード付き `.dll` として
`.julia\compiled\v1.12\<Pkg>\*.dll` に保存する。Windows の **Smart App Control**
（または WDAC / AppLocker）がこの署名されていない `.dll` の実行をブロックし、
precompile が失敗する。

エラーの決定的な 1 行:
```
Error opening package file C:\Users\Akaghef\.julia\compiled\v1.12\OrderedCollections\...\.dll:
An Application Control policy has blocked this file.
```

影響を受けたパッケージ:
- DataStructures
- Tables
- SortingAlgorithms
- StructUtils → StructUtilsTablesExt
- PrettyTables
- DataFrames

いずれも `OrderedCollections` の precompile された `.dll` をロードしようとして失敗。

# 解決策（採用）

## 1. 起動フラグ `--pkgimages=no`

pkgimages（ネイティブコードキャッシュ）を無効化して `.dll` 生成を止める。
初回実行がやや遅くなるが機能への影響なし。

```powershell
julia --pkgimages=no
```

**注意**: 環境変数 `JULIA_PKGIMAGES=no` は**存在しない**。コマンドラインフラグのみ有効。

## 2. PowerShell プロファイルで恒久化

```powershell
$PROFILE     # 実体: C:\Users\Akaghef\OneDrive\ドキュメント\WindowsPowerShell\Microsoft.PowerShell_profile.ps1
New-Item -ItemType File -Path $PROFILE -Force
notepad $PROFILE
```

以下を追記:
```powershell
function julia { & "julia.exe" --pkgimages=no $args }
```

保存後 PowerShell を再起動すると `julia` だけでフラグ付き起動される。

## 3. 壊れたキャッシュの掃除

フラグ無しで起動して生成された `.dll` が残っていると、それをロードしようとして
失敗が続く。キャッシュディレクトリを削除する。

```powershell
Remove-Item -Recurse -Force C:\Users\Akaghef\.julia\compiled\v1.12
```

# 採用しなかった代替策

## Smart App Control をオフ
設定 → プライバシーとセキュリティ → Windows セキュリティ → アプリ＆ブラウザー制御 →
スマート アプリ コントロール → オフ。
**一度オフにすると OS 再インストールまで再オンにできない仕様**のため見送り。

## Julia 1.11 LTS へのダウングレード
1.11 系でも pkgimages は使うので根本解ではない。1.12 維持。

## WDAC 例外登録
管理者権限が必要で、個人環境では意味が薄いため見送り。

# インストール済みパッケージ

AlgLibMove 負債レジスタ #7（calcTE tensor DSL）移植用:

| パッケージ | 用途 | 必須度 |
|---|---|---|
| TensorOperations | `@tensor` / `@tensoropt` マクロ、Einstein notation 収縮 | 必須 |
| MacroTools | `@calcTE` 自作マクロの AST 操作 | 必須 |
| Tullio | `@tullio`（TensorOperations 代替 / 性能比較用） | 比較用 |
| DataFrames | sparse COO シャドー検証（relational join 経由） | 任意 |
| BenchmarkTools | MATLAB 版との性能比較 | 任意 |

インストールコマンド（Pkg モード）:
```
]add TensorOperations MacroTools Tullio DataFrames BenchmarkTools
```

または:
```julia
using Pkg
Pkg.add(["TensorOperations", "MacroTools", "Tullio", "DataFrames", "BenchmarkTools"])
```

# ノートブック環境

選択肢:

| 用途 | 推奨 |
|---|---|
| コード編集・実行・デバッグを VS Code で完結 | **VS Code + Julia 拡張**（julialang.language-julia） |
| Jupyter 既存資産との互換 | IJulia（`Pkg.add("IJulia")` → `using IJulia; notebook()`）|
| 数学探索、reactive な対話実行 | **Pluto.jl**（`Pkg.add("Pluto")` → `using Pluto; Pluto.run()`）|

AlgLibMove 移植用途では **VS Code + Julia 拡張**（本体）と **Pluto**（探索・検証用）の
併用が現実的。両方とも Application Control 回避の `--pkgimages=no` が必要なので、
VS Code の Julia 拡張設定 `Julia: Additional Args` にも `--pkgimages=no` を追加すること。

# 再現手順まとめ（新環境セットアップ時）

```powershell
# 1. juliaup 経由で Julia インストール（未導入なら）
winget install JuliaLang.Juliaup

# 2. PowerShell プロファイルに alias 追加
$PROFILE
New-Item -ItemType File -Path $PROFILE -Force
notepad $PROFILE
#   function julia { & "julia.exe" --pkgimages=no $args }   を追記

# 3. PowerShell 再起動後
julia
#   (@v1.12) pkg> add TensorOperations MacroTools Tullio DataFrames BenchmarkTools

# 4. もしキャッシュ由来のエラーが出たら掃除
Remove-Item -Recurse -Force C:\Users\Akaghef\.julia\compiled\v1.12
#   再度 ]precompile
```

# 参照

- [debt_register.md](debt_register.md) § #7 calcTE 文字列 DSL — 依存先
- Julia issue: pkgimages と Smart App Control の干渉は既知の問題
