# AI インフラ設計

最終更新: 2026-04-02

## 目的

この文書は、M3E における AI 連携の基盤設計を定義する。

ここでいう AI インフラは、
個別機能（Linear <-> Tree 変換、title rewrite、duplicate check など）の前段にある
共通の provider 接続基盤・秘密情報管理・呼び出し境界・失敗時の振る舞いを指す。

## 基本思想

1. AI は機能ではなく基盤として扱う。
2. provider 固有事情を feature 実装へ漏らさない。
3. API key や endpoint はアプリ機能ごとに分散させず、共通の AI 設定へ集約する。
4. feature ごとの差分は prompt / payload / response schema に閉じ込める。
5. AI が使えない状態でも、M3E の主要操作は成立しなければならない。

## なぜ feature 専用設定にしないか

`M3E_LINEAR_AGENT_API_KEY` のような feature 専用設定は、
短期的には簡単でも中長期で次の問題を作る。

- AI 機能を追加するたびに env が増殖する
- provider 切替が feature ごとにバラバラになる
- secret 注入経路が分散し、Bitwarden 連携や運用自動化が複雑化する
- UI から見た「AI が有効か」の状態が統一できない
- ログ、レート制御、タイムアウト、fail-closed 方針を横断で揃えにくい

そのため、M3E では AI 接続設定を `M3E_AI_*` に寄せ、
各 feature はその基盤を利用する構造を採る。

## レイヤ構成

```text
Feature UI / Feature API
  -> Feature Adapter
    -> AI Infrastructure
      -> Provider Transport
        -> External Provider or MCP Server
```

### 1. Feature UI / Feature API

- browser 側のボタン、パネル、操作フロー
- Node 側の feature endpoint
- 例:
  - `GET /api/linear-transform/status`
  - `POST /api/linear-transform/convert`

### 2. Feature Adapter

AI 基盤の上に載る個別機能層。

- feature 固有の request schema
- feature 固有の prompt
- provider 返答の feature 用正規化
- feature 単位の fail-closed 条件

例:

- linear transform
- title rewrite
- suggest-parent
- duplicate-check

### 3. AI Infrastructure

共通化されるべき責務を持つ。

- provider 設定読込
- secret 注入前提の環境変数解決
- transport 選択
- 共通 status 判定
- 共通エラー分類
- 共通 timeout / retry / rate limit の受け皿
- 将来の監査ログ統合点

### 4. Provider Transport

外部接続の差分を吸収する層。

- `openai-compatible`
- `mcp`（将来）
- local gateway / proxy（将来）

feature は transport ではなく、
AI インフラが返す抽象化済みの呼び出し面を見る。

## 現行の責務分離

### 共通 AI 設定

共通設定は `M3E_AI_*` に置く。

想定項目:

- `M3E_AI_ENABLED`
- `M3E_AI_PROVIDER`
- `M3E_AI_TRANSPORT`
- `M3E_AI_BASE_URL`
- `M3E_AI_API_KEY`
- `M3E_AI_MODEL`
- `M3E_AI_MCP_SERVER`

これらは provider 接続に必要な最低限の構成であり、
feature 固有の意味を持たない。

### feature 固有設定

feature 固有設定は prompt や schema に限定する。

例:

- `M3E_LINEAR_TRANSFORM_SYSTEM_PROMPT_FILE`
- `M3E_LINEAR_TRANSFORM_TREE_TO_LINEAR_PROMPT_FILE`
- `M3E_LINEAR_TRANSFORM_LINEAR_TO_TREE_PROMPT_FILE`

この分離により、
同じ provider 接続を複数の AI 機能で共有できる。

## 秘密情報管理

### 原則

1. API key は repo 内に保存しない。
2. browser に API key を渡さない。
3. secret 解決はアプリ内部よりも起動レイヤで行う。

### 推奨経路

Bitwarden を secret source とし、
launch script が起動前に取得して `M3E_AI_*` を注入する。

```text
Bitwarden
  -> launch-with-ai.ps1
    -> M3E_AI_API_KEY / M3E_AI_MODEL / M3E_AI_BASE_URL
      -> beta start
```

### 起動レイヤで注入する理由

- アプリ本体が secret manager 依存にならない
- feature 呼び出しのたびに secret 解決しなくてよい
- desktop 運用と CI 運用で同じ env 契約を共有できる
- provider 差し替え時も launch 層だけで調整しやすい

## Transport 方針

### `openai-compatible`

現行の第一実装。

- DeepSeek 系 endpoint を含む OpenAI 互換 API を対象とする
- `/chat/completions` 互換を利用する
- Node サーバー経由で呼び出す

### `mcp`

将来の transport。

用途:

- subagent をツールサーバーとして分離したい場合
- provider だけでなく処理器そのものを外部化したい場合
- 複数 feature で同一 subagent を共有したい場合

現段階では config surface のみ先行し、
実体は未実装でよい。

## API 設計原則

共通 API の request / response / error 契約の正本は
`../03_Spec/AI_Common_API.md` とする。

### browser は provider を直接呼ばない

理由:

- API key 保護
- CORS 回避
- provider 差し替えの容易化
- audit / rate limit / timeout 集中管理

そのため、browser は常に localhost の Node API を叩く。

### status endpoint を feature ごとに持つ

例:

- `/api/linear-transform/status`

status endpoint の目的:

- UI が機能有効性を描画できる
- provider 未設定時の fail-closed を事前に伝えられる
- transport や prompt 設定の診断点になる

### convert / propose endpoint は feature schema を持つ

共通 provider の上に載っても、
feature request/response は feature ごとに分ける。

理由:

- schema が feature ごとに異なる
- 妥当性検証が feature ごとに異なる
- UI 側の承認フローが feature ごとに異なる

## Fail-Closed 原則

AI 連携で失敗した場合、M3E は次を守る。

1. 正本を部分更新しない
2. 既存の手動操作導線へ戻れる
3. 失敗理由を UI/ログで観測可能にする

典型的な失敗分類:

- disabled
- config missing
- transport not implemented
- invalid request
- provider timeout
- provider schema mismatch
- provider unavailable

## Linear Transform との関係

Linear <-> Tree は AI インフラ上の 1 feature に過ぎない。

そのため、次を守る。

- provider 接続設定は共通 AI 基盤から取る
- prompt だけを feature 固有設定として持つ
- browser 側は feature endpoint だけを見る
- provider 固有レスポンスは feature adapter で吸収する

これにより、後から以下を追加しやすくなる。

- title rewrite
- duplicate check
- suggest-parent
- structure proposal
- context package enrichment

## Bitwarden 運用との整合

Bitwarden item の責務は secret source であり、
アプリの feature 単位設定 source ではない。

推奨:

- `password`: API key
- custom field:
  - `provider`
  - `transport`
  - `base_url`
  - `model`

launch script がこれを `M3E_AI_*` に写像する。
feature 固有の prompt は repo 内のファイルか、
将来的には別設定層で管理する。

## 今後の拡張点

1. 共通 `POST /api/ai/subagent/:name` の導入
2. provider ごとの token usage 正規化
3. タイムアウト・リトライ・レート制御の共通化
4. 監査ログの統一
5. MCP transport 実装
6. feature ごとの approval UI との接続

## 2026-04-03 追加: LLM マルチプロバイダ基盤方針 v0.1

### 目的再定義

M3E の AI 基盤は次を満たすことを目標にする。

1. ローカル/クラウドを同一 API 契約で扱う
2. モデルを alias で切替できる（Copilot 的な選択体験）
3. feature 実装は provider 固有名を直接持たない
4. データポリシー（local only 等）を集中管理する

### 推奨スタック（実務優先）

- App layer: Vercel AI SDK
- Gateway layer: LiteLLM
- Local runtime: Ollama（標準）、必要に応じて vLLM / llama-cpp-python
- Optional cloud aggregator: OpenRouter

この構成の理由:

- Vercel AI SDK は TypeScript 側の provider/model 抽象化と model 管理に向く
- LiteLLM は複数 provider を OpenAI 互換 endpoint で束ねる gateway に向く
- Ollama / vLLM / llama-cpp-python はローカル実行面を担い、gateway 配下に置ける
- OpenRouter は cloud 集約として有用だが、local 実行基盤の代替ではない

### ライブラリ比較（M3E 観点）

| コンポーネント | 主な役割 | M3E での位置付け | 注意点 |
|---|---|---|---|
| Vercel AI SDK | TS 側 provider abstraction | App/adapter 層の標準候補 | gateway 機能そのものは持たない |
| LiteLLM | 統一 gateway/proxy | backend の第一候補 | 運用プロセス（config/key）設計が必要 |
| Ollama | ローカル LLM 実行 | 開発機での標準 runtime | 大型モデルはメモリ制約に注意 |
| vLLM | 高速サービング | GPU サーバ向け拡張 | 開発機単体では過剰になりやすい |
| llama-cpp-python | 軽量ローカル実行 | オフライン検証の補助 | 速度/機能はモデル依存 |
| OpenRouter | cloud provider 集約 | 任意追加 | local 実行を代替しない |

### フェーズ設計

#### Phase 1（最速検証）

- 構成: `Vercel AI SDK + (Ollama or OpenAI API)`
- 目的: alias 切替 UI と feature 接続の検証
- 制約: backend gateway 不在のため、ルーティング/ポリシー集中管理が弱い

#### Phase 2（基盤化）

- 構成: `Vercel AI SDK + LiteLLM + local runtimes + cloud providers`
- 目的: local/cloud ルーティング、fallback、監査ログの集中化
- 期待効果: feature 側コードの provider 依存を最小化

### モデル ID 方針（alias 優先）

feature 側では vendor model 名を直接持たない。内部 alias を使う。

例:

- `chat.local.fast`
- `chat.local.reason`
- `chat.cloud.fast`
- `chat.cloud.strong`
- `embed.default`

alias -> 実モデル名の対応は AI 基盤設定で集中管理する。

### データポリシー方針

request ごとに次のいずれかを明示する。

- `local_only`
- `cloud_allowed`
- `cloud_required`

`local_only` は cloud fallback を禁止する。

### 実装メモ（現行 beta）

現行実装では `M3E_AI_MODEL_REGISTRY_JSON` と `M3E_AI_DEFAULT_MODEL_ALIAS` により、
alias ベースのモデル解決を先行導入する。

例:

```json
{
  "chat.fast": {
    "label": "Fast Cloud",
    "kind": "chat",
    "privacy": "cloud",
    "capabilities": ["streaming", "json"],
    "targetModel": "deepseek-chat",
    "dataPolicy": "cloud_allowed"
  },
  "chat.local": {
    "label": "Gemma Local",
    "kind": "chat",
    "privacy": "local",
    "capabilities": ["streaming"],
    "targetModel": "gemma3:4b",
    "dataPolicy": "local_only"
  }
}
```

`M3E_AI_GATEWAY=litellm` は運用上の明示フラグとして扱い、
`/api/ai/status` で可観測にする。

## 非目標

- AI が無承認で正本を書き換えること
- browser に provider SDK と secret を埋め込むこと
- feature ごとに別々の secret 配布経路を持つこと
- provider 別の UI を feature へ直接埋め込むこと

## 関連文書

- `../03_Spec/AI_Integration.md`
- `../03_Spec/Linear_Tree_Conversion.md`
- `../03_Spec/Import_Export.md`
