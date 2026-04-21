---
pj_id: PJ03
doc_type: runbook
status: draft
date: 2026-04-21
---

# VS Code Tasks

VS Code から定型操作を素早く叩くために `.vscode/tasks.json` を追加した。

## 使い方

1. VS Code でこの repo を開く
2. `Ctrl+Shift+P`
3. `Tasks: Run Task`
4. 以下の task を選ぶ

または `Run and Debug` サイドバーを開き、`launch.json` の構成から M3E 用の起動項目を選んで再生ボタンで実行してよい。

左端 Activity Bar に `M3E` アイコンを出したい場合は、`Run and Debug` から `M3E: Sidebar Extension Host` を起動する。
開いた Extension Development Host 側に `M3E` アイコンが出る。

## 主な task

- `Beta: Launch`
  - 日常の Beta 起動
- `Beta: Update And Launch`
  - 更新 + install + build + 起動
- `PJ03: Demo Full`
  - PJ03 デモ一式（preflight + core + scope）
- `PJ03: Demo Core`
  - dogfood_run_02 中心の核だけ
- `PJ03: Demo Scope`
  - scope projection だけ
- `PJ03: Demo Preflight`
  - デモ前の健全性確認
- `M3E Sidebar: Package VSIX`
  - `artifacts/m3e-sidebar.vsix` を生成
- `M3E Sidebar: Install VSIX`
  - VSIX を生成して現在の VS Code に強制再インストール

## Run And Debug から使う項目

- `M3E: Sidebar Extension Host`
- `M3E: Beta Launch`
- `M3E: Beta Update And Launch`
- `M3E: PJ03 Demo Full`
- `M3E: PJ03 Demo Core`
- `M3E: PJ03 Demo Scope`
- `M3E: PJ03 Demo Preflight`

## CLI だけで使う場合

```bash
cd beta
npm run demo:pj03
node dist/node/pj03_demo.js --mode core
node dist/node/pj03_demo.js --mode scope
node dist/node/pj03_demo.js --mode preflight
```

拡張を VSIX にする場合:

```bash
cd tools/vscode-m3e-sidebar
npm run package
code.cmd --install-extension ../../artifacts/m3e-sidebar.vsix --force
```

## 運用メモ

- `PJ03: Demo Core/Scope/Preflight` は先に `Beta: Build Node` を実行する
- `Beta: Launch` は既存の `scripts/beta/launch.bat` をそのまま呼ぶ
- task 自体は薄い入口だけで、実ロジックは repo 内の script / CLI 側に置く
- Activity Bar の `M3E` アイコンは `tools/vscode-m3e-sidebar/` のローカル拡張で提供する
