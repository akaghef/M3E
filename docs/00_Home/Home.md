# M3E — Home

最終更新: 2026-04-15

---

## M3E とは何か

**データ構造・UXを工夫して、研究レベルまでスケーラブルな知識ベースを作る。**

M3E は Miro のビジュアルコラボ × Obsidian の構造化知識 × GitHub のバージョン管理を融合した、科学用ナレッジベース。日常のメモから研究レベルの体系的知識まで、一気通貫で扱えるツールを目指す。

### 核心的な問題意識

知識の蓄積は日常〜局所推論レベルでは機能するが、**信頼性の累積ができない**（途中で破綻する）ため、**大域的なレベル（研究レベル）に外挿できない**。この問題を適切なデータ構造 + UX で解決する。

### 設計原則

- **AI は提案、人間が確定する**
- **正本はモードで明示する**。Standalone は SQLite 正本、ローカルファイル連携モードは `.md` 正本
- **構造は親子を主軸に保つ**。scope で認知境界を制御
- **オフライン動作が基本**。オンラインでチームコラボ

### 基本概念

- 概念階層は **`workspace (ws) > map > scope > node`**
- **scope は M3E 固有の中核概念**。map 内の階層的な構造境界であり、見える範囲・編集範囲を制御する
- **folder は一般向けの補助語**。導入時に scope を説明するために使うが、仕様・実装の正規語は scope
- **map は仕様語**。実装や API に `doc` / `docId` が残っていても、意味としては map を指す

---

## 3バンド構造: Flash / Rapid / Deep

| バンド | レベル | 特徴 | 信頼度 | 競合参考 |
|--------|--------|------|--------|---------|
| **Flash** | 日常 | マルチモーダルキャプチャ。構造は後付け | 低（AI 推定） | Mapify, Apple Notes |
| **Rapid** | 業務 | グラフ構造、チーム Collab、AI 連携 | 中（人間確認済み） | Miro, Heptabase |
| **Deep** | 研究 | オントロジー、信頼度付き階層構造、TCL | 高（エビデンス付き） | **競合なし** |

### 昇格パス

```
Flash → Rapid → Deep
 取り込み   構造化    体系化
 confidence: 0.3 → 0.7 → 0.9+
```

- Flash で大量に速く取り込む（ファネルの入口）
- Rapid で構造化して業務に使う
- Deep で信頼度を上げて研究に使う

### 競合ポジショニング

- **Flash/Rapid の体験は Mapify 等でサチっている**。同じ土俵では勝てない
- **M3E の差別化は Deep バンド**: 信頼度付き知識、TCL、オントロジー
- ただし Flash の取り込み速度がないと Deep に到達するデータ量が足りない
- → Flash は Mapify 並の体験を確保し、Deep で勝つ

---

## 技術スタック

| レイヤー | 技術 | 備考 |
|---------|------|------|
| フロントエンド | TypeScript + SVG canvas | React は使わない（現状） |
| バックエンド | Node.js + Express | ローカルサーバー |
| データストア | SQLite + .md | Standalone は SQLite 正本、連携モードは `.md` 正本 |
| クラウド同期 | Supabase | scope 単位 push/pull |
| AI | Anthropic SDK (Claude) | Bitwarden 方式でキー管理 |
| ファイル監視 | chokidar | .md の外部編集検出 |

---

## データの所在

| 種別 | 保存先 | ポート | 用途 |
|------|--------|--------|------|
| 開発データ | beta (SQLite + Supabase) | 4173 | strategy, agent status, Vision |
| 検証用データ | final/data/ | 38482 | 手動検証 |
| ユーザーデータ | %APPDATA%/M3E/ | - | Akaghef 個人の本番利用 |

---

## アーキテクチャ

### 保存モード

| モード | 主用途 | 正本 | UI 上の位置づけ |
|-------|--------|------|----------------|
| Standalone | 通常利用、M3E 単体編集 | SQLite | 既定モード |
| Import / Export | 単発の取り込み・書き出し | 実行後は各側で独立 | 普段の UI のユーティリティ |
| ローカルファイル連携モード | Obsidian / Markdown フォルダとの強結合 | `.md` | 明示的に開始する別モード |

- `Import / Export` は変換操作であり、ライブ同期や `.md` 正本を意味しない。
- `ローカルファイル連携モード` を名乗る場合のみ、`.md` を正本として watch / write-back / conflict policy を有効にする。

### ローカルファイル連携モード（強結合）

```
.md ファイル（唯一の正本）
    ↕ read/write
FileBinding Layer
    ↕ cache
SQLite（インデックス/キャッシュ）
    ↕ push/pull
Supabase（リモート同期）
```

- .md 保存 = commit（確定）。staging なし
- SQLite はインデックスに過ぎない。壊れても .md から再構築
- Cloud Sync は SQLite キャッシュ経由（CS-2 方式）
- 普段の `Import / Export` はこのモードに含めない。単発変換として扱う

### Collab（リアルタイム共同編集）

- ユーザー間の**序列（priority）**が核心。単なるリアルタイム同期ではない
- Priority Cascade, Auto Merge, Branch Isolate, Last Write Wins, Manual Resolve の 5 戦略
- scope 単位でのロック・共有

---

## 開発体制

| ロール | 担当領域 | ブランチ |
|-------|---------|---------|
| visual | UI・描画・CSS・SVG | worktree |
| data | model・controller・API・永続化 | worktree |
| team | Collab・Cloud Sync | worktree |
| manage | 統合・方針策定・レビュー | dev-beta |

---

## リポジトリ構成

```
M3E/
├── beta/              ← 開発版（ソース・ビルド・開発データ）
├── final/             ← 安定版（beta から sync）
├── install/           ← インストーラー（Inno Setup .exe ビルド）
│   ├── setup.bat      ← セットアップ本体
│   ├── windows/       ← m3e.iss, ビルド・検証スクリプト
│   ├── assets/        ← アイコン等
│   └── artifacts/     ← ビルド済み .exe 出力先
├── scripts/
│   ├── beta/          ← beta 起動・更新
│   ├── final/         ← final 起動・移行
│   └── ops/           ← テスト・運用（vm_test, build_test_package 等）
├── docs/          ← 設計・仕様・運用ドキュメント
├── freeplane/         ← Freeplane 連携
└── others/            ← その他
```

---

## この文書群の使い方

| 知りたいこと | 読むファイル |
|-------------|------------|
| 現在の状態 | [Current_Status.md](./Current_Status.md) |
| 思想・原則 | [../01_Vision/Core_Principles.md](../01_Vision/Core_Principles.md) |
| 仕様 | [../03_Spec/](../03_Spec/) 配下 |
| アーキテクチャ | [../04_Architecture/](../04_Architecture/) 配下 |
| 競合研究 | [../competitive_research/](../competitive_research/) |
| アイデア・設計提案 | [../ideas/](../ideas/) |
| 運用ルール | [../06_Operations/](../06_Operations/) |
| Akaghef 向け手順書 | [../for-akaghef/](../for-akaghef/) |
