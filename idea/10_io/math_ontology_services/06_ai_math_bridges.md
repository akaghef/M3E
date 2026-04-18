# 06. AI × 数学 × オントロジー橋渡し（L5）

LLM / 機械学習と形式数学・数学知識を繋ぐデータセット・モデル・プロトコル群。
2022〜2026 で急伸、移り変わり激しい領域。

## 分類軸

- **Dt.** データセット / モデル / プロトコル / サービス
- **Tg.** 対象（自然言語数学 / 形式証明 / 問題解決 / 検証補助）
- **Fw.** 基盤（Lean / Coq / Isabelle / 独自）
- **St.** 状態（活発 / 安定 / 凍結）

## A1. LeanDojo
- **本質**: Lean4 + mathlib4 と対話する Python 環境、学習データセット
- **公開**: 定理 → 証明 trace のペア（state-tactic データ）
- **論文**: Yang et al. 2023（NeurIPS）
- **M3E 供給**: Lean 証明の機械可読化、AI 連携実装の参考

## A2. Lean Copilot
- **本質**: VSCode 上で Lean 証明を AI が補助
- **モデル**: ReProver 等
- **状態**: 活発
- **M3E 関連**: 直接より、同系統の UX 参考

## A3. mathlib4 Blueprints
- **本質**: 大規模形式化プロジェクトで「Lean 化前の自然言語 → 依存 DAG」を管理するツール
- **例**: PFR プロジェクト（Gowers–Green–Manners–Tao 多項フロイマン–ルザ）
- **M3E 供給**: **構造（DAG ベース、状態色分け、外部ID属性）は非常に近い**。
  ただし Blueprint のエッジは **syntax（uses のみ 1 種）** で、M3E が目指す **semantic（多種エッジ）** とは意味層が異なる。
  「兄弟」というより「構造だけが相似で意味層が別住民」。詳細は [07_m3e_connection.md](07_m3e_connection.md) P8 参照

## A4. Formal Abstracts（再掲, L5 視点）
- **L5 的側面**: 論文 abstract を形式化して LLM の接地点にする

## A5. NaturalProofs / NaturalProofs-Gen
- **本質**: ProofWiki を構造化した自然言語定理+証明データセット
- **公開**: Welleck 2021
- **M3E 供給**: 自然言語側の訓練データ、半形式表現の参考

## A6. ProofNet
- **本質**: 学部レベル教科書の形式化問題（Lean 等）
- **公開**: 2023
- **数字**: 数百問
- **M3E 関連**: ベンチ参照

## A7. miniF2F
- **本質**: 高校〜大学入門の形式化数学ベンチ
- **Lean / Isabelle / HOL Light / Metamath** 版あり
- **規模**: 488 問
- **M3E 関連**: ベンチ参照

## A8. PutnamBench
- **本質**: Putnam 競技問題の形式化ベンチ
- **M3E 関連**: ベンチ参照

## A9. FIMO — Formal International Mathematical Olympiad
- **本質**: IMO 問題の Lean 化
- **M3E 関連**: ベンチ参照

## A10. MATH dataset
- **本質**: 高校競技数学、自然言語問題 12,500 問
- **公開**: Hendrycks et al. 2021
- **M3E 関連**: LLM 数学能力評価

## A11. GSM8K
- **本質**: 小学校レベル算数問題
- **M3E 関連**: 低

## A12. Open-STEM / TheoremQA / MathVista
- **本質**: 様々な評価セット
- **M3E 関連**: 参考

## A13. AlphaGeometry (DeepMind)
- **本質**: 幾何問題 AI、IMO 銀レベル
- **公開**: 2024, 2025 に AlphaGeometry2 も
- **M3E 関連**: 分野特化 AI の事例参考

## A14. AlphaProof (DeepMind)
- **本質**: Lean ベースの AI 証明器
- **実績**: 2024 IMO 銀メダル級
- **M3E 関連**: 外部検証系としての可能性

## A15. Minerva / PaLM-Math
- **本質**: Google 大規模 LLM の数学特化版（2022）
- **現状**: Gemini に統合
- **M3E 関連**: 参考

## A16. Llemma
- **本質**: 数学特化オープン LLM（EleutherAI + Princeton）
- **学習**: Proof-Pile-2 データセット
- **M3E 供給**: オープンな数学 LLM、ローカル推論可能

## A17. Proof-Pile-2
- **本質**: 数学 LLM 学習コーパス、550 億トークン
- **構成**: arXiv math, OpenWebMath, mathlib, Lean 証明
- **M3E 関連**: 学習データの事実上のデファクト

## A18. OpenWebMath
- **本質**: Web から抽出した数学テキスト 14.7B トークン
- **公開**: 2023
- **M3E 関連**: コーパス参考

## A19. HTPS — HyperTree Proof Search
- **本質**: Meta AI の証明探索、Lean/Metamath
- **M3E 関連**: AI 探索手法の参考

## A20. PACT — Proof Artifact Co-Training
- **本質**: Polu & Sutskever 2020、GPT-f 系列
- **M3E 関連**: 手法参考

## A21. GPT-f / Thor / DSP
- **本質**: OpenAI 初期の証明系 AI 研究
- **状態**: 研究的価値中心

## A22. Draft, Sketch, Prove (DSP)
- **本質**: 自然言語 draft → 形式 sketch → 証明の 3 段階
- **論文**: Jiang et al. 2022
- **M3E 関連**: ワークフロー設計の参考

## A23. LEGO-Prover
- **本質**: 補題を段階的に構築する AI

## A24. Lean Chat
- **本質**: Lean 対話インタフェース、AI 連携試作

## A25. Codex / GPT-4 Math 系
- **現状**: API で数学支援、形式系との接地は弱い

## A26. Claude / Gemini / GPT-5 の数学能力
- **現状**: 自然言語数学での高能力、形式系は間接
- **M3E 関連**: 既存の M3E AI subagent 実装の延長

## A27. SymbolicAI / GenAI + symbolic
- **本質**: LLM + 記号計算ハイブリッドフレームワーク

## A28. MuMath / MathGLM / ToRA
- **本質**: 各種数学特化 LLM / 推論フレームワーク

## A29. AutoFormalization
- **本質**: 自然言語数学 → Lean/Coq/Isabelle の自動形式化
- **研究**: Wu et al., Jiang et al.
- **M3E 関連**: **M3E にとって最も重要な技術の一つ**、自然ノート → 形式化

## A30. InternLM-Math / DeepSeek-Math / Qwen-Math
- **本質**: 中国勢の数学特化 LLM
- **状態**: 2024〜急伸、Llemma を超える場面あり
- **M3E 関連**: オープンモデル候補

## A31. LeanAgent / Aesop / Duper
- **本質**: Lean 内の自動化 tactic
- **M3E 関連**: Lean 連携時のユーティリティ

## A32. TacticToe / Tactician (Coq)
- **本質**: Coq の tactic 推薦 ML

## A33. Formal Math Foundation (FMF) 構想
- **本質**: コミュニティで掲げられる「形式数学の共通基盤」構想
- **M3E 関連**: 動向ウォッチ

## A34. Terence Tao 実験ログ（個人）
- **本質**: Tao が Lean / GPT / Claude で数学する実験を公開ブログで記録
- **M3E 供給**: ワークフロー事例、ユースケース源

## A35. DeepSeek Prover / DeepSeek Math
- **本質**: オープン最高峰の数学 AI（2024〜）
- **M3E 関連**: ローカル利用候補

## A36. Kimina Prover
- **本質**: 2025 の新鋭証明系 LLM
- **状態**: 急進中

## A37. IMO Grand Challenge
- **本質**: コミュニティ挑戦: 2026 までに AI が IMO 金メダル
- **状態**: 進行中、2025 で実質達成（AlphaProof 等）
- **M3E 関連**: 動向

## A38. Putnam Grand Challenge
- **本質**: Putnam を AI で解く挑戦

## A39. PuzzlePrompt / ReasonEval
- **本質**: 推論評価ベンチ

## A40. Rust/Python で LLM ↔ Lean 連携する OSS 群
- **例**: repl, LeanAgent, Moogle
- **M3E 関連**: 実装ライブラリ候補

## 比較表

| ID | 名前 | 種別 | 基盤 | 活発度 | M3E 用途 |
|---|---|---|---|---|---|
| A1 | LeanDojo | データ/環境 | Lean4 | ⭐⭐⭐ | Lean 取込実装参考 |
| A3 | mathlib4 Blueprints | UX | Lean4 | ⭐⭐⭐ | M3E 兄弟、要参照 |
| A5 | NaturalProofs | データ | - | ⭐⭐ | 半形式データ |
| A7 | miniF2F | ベンチ | 横断 | ⭐⭐ | 参考 |
| A14 | AlphaProof | モデル | Lean | ⭐⭐⭐ | 外部検証連携 |
| A16 | Llemma | LLM | オープン | ⭐⭐ | ローカル推論 |
| A17 | Proof-Pile-2 | コーパス | - | ⭐⭐ | 学習データ |
| A29 | AutoFormalization | 技術 | 横断 | ⭐⭐⭐ | 取込時の中核 |
| A34 | Tao 実験ログ | 事例 | - | ⭐⭐ | UX 参考 |
| A35 | DeepSeek Math | LLM | オープン | ⭐⭐⭐ | ローカル推論 |

## 論点

- **Ai. AI 統合方針** — LLM は呼び出し元（外部）/ 内蔵 / 両方
- **Fm. 形式系連携** — Lean サーバと M3E 通信プロトコル
- **Af. 自動形式化** — 自然ノート → Lean の自動変換を M3E 内機能に組み込むか
- **Ev. 検証** — AI 出力を Lean で検証してから M3E に書き戻す流れ
- **Bp. Blueprint 統合** — mathlib4 Blueprint ↔ M3E の相互表示
- **Lo. ローカル推論** — DeepSeek Math / Llemma のローカル運用で Privacy 維持（L5 と直結）
- **St. 鮮度** — 2026 時点の最新を追うか、安定版に固定するか

## 横断的観察

- L5 は **動きが速すぎる** → M3E は直接実装を抱えず、**プロトコル接続** で対応
- **A3 Blueprints は M3E と構造が 90% 一致、意味層は別** — syntax graph vs semantic graph の違い（07 P8 / 横断観察 9）
- **自動形式化（A29）× M3E** は「思いつき → 形式定理」の黄金経路
- 日本発の L5 プロジェクトはほぼ無い → 隙間あり
- Privacy（feedback_privacy）との相性: 外部 API 型 AI は機微情報検閲が必須（L5 機能 ⇄ L5 プライバシー）
