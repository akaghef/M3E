# 公開版ソフトウェア構造

## Evidence levels

- **確認済み（UI・公開文書）**: 使い方、応用ガイド、TOOL_MANUAL、法務・セキュリティ文書、実画面。
- **確認済み（配信コード）**: 公開配信されたJavaScript/CSS bundleとHTTP header。
- **推定**: 公開情報から合理的に導けるが、非公開source / infrastructure設定は未確認。

## Runtime

| Concern | Observed implementation | How |
|---|---|---|
| UI | React / React DOM 19.2.4 | `createRoot`によるclient-side rendering |
| Style | Tailwind CSS 4.2.2 | utility class中心のlayout / state表現 |
| Icon | Phosphor Icons | font assetとして同一origin配信 |
| Markdown | Marked系parser | GFM、table、list、code blockをHTML化 |
| Sanitization | DOMPurify 3.4.13 | Markdown由来HTMLの危険要素・属性を除去 |
| Math | KaTeX | inline/display mathとproject-level `\newcommand` |
| Front door | Cloudflare Workers / Assets | static asset、HTTPS、security header |
| Auth / Sync | Supabase JS 2.101.1 | Google Auth、session、REST/Functions、RLS |
| Billing | Stripe | checkout / portal / billing status Edge Functions |

## Local-first storage

- scoped localStorage / sessionStorage名前空間
- 1KB以上の対象値をLZ UTF-16圧縮
- IndexedDB `memoforest-time-machine` / `snapshots`
- PBKDF2-SHA-256（250,000 iterations）→ AES-GCM-256
- 端末内解除sessionは約10分

端末内保護はクラウドE2EEではない。JSON exportも可搬な平文artifactとして扱う。

## Domain model

```text
Project
├── Node (id, topic, parentId)
│   └── Section (id, title, Markdown content)
├── Annotation (quote anchor, context, derived nodes)
├── Folder / manual order
└── project-level LaTeX macros
```

v3 exportは`annotator-qa-export`で、内部合成rootを除外し、最上位nodeを`parentId: null`として直列化する。

## AI boundary

公開UIで確認できる経路は直接LLM APIではない。

```text
Memoforest request生成
  → clipboard
  → external AI
  → batch patchをclipboard
  → Memoforest取込
```

依頼時のbase content / timestampと現在値を比較し、処理中に編集された箇所の上書きを避ける。

## External workspace signals

公開bundleにはREST / WebSocket、revision、operationId、entityVersions、capability negotiationに相当する実装が含まれる。ただし、一般公開された安定integration contractか、限定runtime用かは未確認。

