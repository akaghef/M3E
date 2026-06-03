---
title: "【重要】Resource管理のアプローチ"
created: 2026-04-17 14:08:32
updated: 2026-04-17 16:04:29
tags:
  - chatgpt
  - conversation
---
# 【重要】Resource管理のアプローチ

<sub>2026-04-17</sub>

---

**User**: <sub>2026-04-17 14:08</sub>

前話したと思うんだが、Resource概念の管理難しいな。PJ毎に管理するほうが集中管理より壊れにくさもあるが、同期取りづらさ、一貫性の懸念もある。

> [!abstract]- Tool (file_search)
> <sub>2026-04-17 14:08</sub>
> 
> Make sure to include fileciteturn0file0 in your response to cite this file, or to surface it as a link.
> 以下は「ノードAをドラッグして、別の親P’の子に付け替える」一連操作を、MVC（＋Command）で忠実に流した場合の連携です。Konva等の有無に依存しない抽象形で書きます。
> 
> 前提の責務
> Model：ツリー整合性を保証しつつ、Commandを適用・Undo記録・変更通知
> View：Canvas描画のみ
> Controller：入力列を解釈し、HitTest結果を用いてCommandを作りModelへ渡す
> HitTest：座標→対象（nodeId等）を返す
> ViewState：カメラ、選択、ドラッグ中のプレビュー状態
> 
> 初期状態
> ViewはModelのsnapshotを描画している。ControllerはIdle。
> 
> pointerdown（ノードA上）
> (1) Browser → Controller に pointerdown
> (2) Controller は HitTest(point) を呼ぶ
> (3) HitTest は nodeId=A を返す
> (4) Controller は内部状態を Pressed(A) にする（ドラッグ開始候補）
> (5) ViewState に activeNode=A, dragStartPos を記録（任意）
> (6) まだModelは変更しない（クリック判定のため）
> 
> pointermove（閾値超えでドラッグ開始）
> (1) Browser → Controller に pointermove
> (2) Controller は「移動距離が閾値超え」を確認し DraggingNode(A) に遷移
> (3) Controller はドラッグ中プレビューを更新
> 　・ViewState.dragPos を更新（Aの表示位置だけ一時的に動かす）
> (4) Controller は必要なら HitTest を呼び「ドロップ先候補」を検出
> 　・HitTest(point) → nodeId=P’（候補親）または background
> (5) ViewState.hoverDropTarget=P’ を更新（ハイライト用）
> (6) Modelはまだ変更しない（確定はdrop時）
> 
> pointermove（ドラッグ継続）
> (1) 同様に dragPos を更新
> (2) 同様に dropTarget候補を更新
> (3) Viewは subscribe しているので、ViewStateの更新に応じて再描画（方式は任意）
> 　※ここは「Model変更通知」でなくても良い。ドラッグ中はViewState駆動で再描画してよい。
> 
> pointerup（ドロップ確定）
> (1) Browser → Controller に pointerup
> (2) Controller は最終位置で HitTest(point) を呼び、dropTarget候補を確定
> 　・HitTest(point) → nodeId=P’（候補親）
> (3) Controller は「付け替えが成立する条件」を最低限チェック
> 　・P’が存在する
> 　・A自身ではない
> 　・（任意）Aの子孫ではないか、など
> 　※厳密チェックはModelに任せてもよいが、明らかな誤りはここで弾くとUXが良い。
> (4) Controller は Command を生成
> 　・ReparentNodeCommand(nodeId=A, fromParent=P, toParent=P’, fromIndex=i, toIndex=j)
> 　※fromIndex/toIndexは並び順を保存したいなら必要。最小なら親だけでもよい。
> (5) Controller → Model.apply(command) を呼ぶ（ここが唯一の状態変更入口）
> 
> Model.apply(command)
> (1) Modelは内部で制約検証
> 　・ツリーが循環しない
> 　・scope制約、alias制約など
> (2) OKなら状態を更新（親をP→P’へ）
> (3) undoStackにcommandをpush（redoStackはクリア）
> (4) Modelが “changed” を通知（emit/subscribe）
> 
> View更新
> (1) View（Renderer）は Model.changed を受け取る
> (2) 最新snapshotを読み、Canvasを再描画
> (3) Controllerはドラッグ状態をIdleに戻し、ViewStateの一時状態をクリア
> 　・dragPos/hoverDropTargetなど
> 
> Undo/Redo（参考）
> Undo操作（Ctrl+Z等）
> (1) Browser → Controller に keydown
> (2) Controller → Model.undo()
> (3) Modelは最後のcommand.undoを実行し、changed通知
> (4) View再描画
> 
> 重要な設計上の注意
> ・ドラッグ中の「見た目の追従」は、Modelを書き換えずViewStateで行う方が安全です。確定時だけCommandを発行します。
> ・「親付け替え」の正当性（循環、scope、alias等）はModelが最終責任を持つべきです。ControllerはUX向上のための軽い事前判定まで。
> ・Commandには「元の親情報」を必ず入れます。Undoに必要です。

> [!abstract]- Tool (file_search)
> <sub>2026-04-17 14:08</sub>
> 
> Make sure to include fileciteturn0file1 in your response to cite this file, or to surface it as a link.
> ### KGF開発のための追加マインドマップツール調査
> 
> 前回の提案（MindMup、Freeplane）以外に、マインドマップツールをさらに調査しました。焦点はオープンソースで、オフライン対応、拡張性が高く、KGFの仕様（ツリー構造、スコープ/folder、alias参照、キャンバスUI、帯域対応可能性）にラップしやすいものを優先。Web SearchとX Searchの結果から、Webベース/デスクトップのツールを抽出。いくつかは知識グラフ寄りですが、マインドマップに拡張可能。
> 
> 調査基準:
> - **オフライン対応**: KGFのオフラインファーストに適合。
> - **拡張性**: API/スクリプト/モジュラー構造で、ラップ（カスタムUI/機能追加）しやすく、帯域（Flash/Rapid/Deep）やAI統合を追加可能。
> - **構造サポート**: ノード/ツリー、フォルダ/スコープ相当、参照（alias）機能。
> - **コスト削減効果**: 既存コード再利用で、開発工数30-50%減。
> 
> 以下、テーブルでまとめ。提案ツールはフォーク/ラッパーでKGF独自機能（スコープ境界、AI提案、自然言語化）を追加可能。詳細はBrowse Page結果に基づく。
> 
> | Tool | Open Source | Offline Support | Tech Stack | Key Features for KGF | Extensibility & Wrapping Potential | Source |
> |------|-------------|-----------------|------------|----------------------|------------------------------------|--------|
> | WiseMapping | Yes | **No** (Web-based, server needed) | React (frontend), Spring Boot (backend), SVG, PostgreSQL | Hierarchical nodes/trees, rich content (text/links/icons), search/navigation. No explicit folders, but node grouping for scopes. Import/export (Freeplane/XMind). | High: REST API for integration, modular (frontend/backend separate), Docker deploy. Wrap with Quasar for PWA/offline cache, add band modes via styles. |   |
> | TiddlyMap | Yes (TiddlyWiki plugin) | Yes (Browser-local, no server) | JavaScript, TiddlyWiki (single HTML file) | Nodes/edges for graphs, filters for scopes, double-click navigation. Wiki integration for alias-like references. Styles/icons/groups. | High: Plugin-based, customizable via TiddlyWiki macros/filters. Embed in Web app, add keyboard/IME via JS. Offline-first fits KGF. Extend for AI with local LLM. |   |
> | diagrams.net (draw.io) | Yes | Yes (Desktop app, PWA offline) | JavaScript, Electron (desktop), XML-based storage | Mind map templates, trees/auto-layout, containers for folders/scopes. Links/references for aliases. Infinite canvas, undo/redo. | High: Embeddable libraries, plugins/extensions. Wrap with Vue/Quasar for custom UI. Add bands via layers/styles. Integrates with IndexedDB. |  |
> | MindGraph | Yes | Yes (Local/in-memory DB) | Python (backend), Cytoscape.js (frontend), NebulaGraph/FalkorDB | Knowledge graph with entities/relationships (tree-like), schema for scopes. Natural language input/search. | High: Modular integrations/signals, API endpoints. Wrap frontend for KGF canvas, add AI via built-in NLP. Extend for bands with query filters. | [post:1]  |
> | Semantik | Yes | Yes (Desktop) | Qt/C++ (KDE) | Mind maps with nodes/trees, document generation. Hierarchical views for scopes. | Medium: Scriptable, but desktop-focused. Wrap via Qt WebEngine for Web, but cross-platform effort needed. |  |
> | Docear (SciPlore) | Yes | Yes (Java desktop) | Java | Mind maps with PDF/literature integration, folders/projects for scopes. References/links for aliases. | Medium: Extensible via plugins. Fork for Web, but Java-to-JS migration costly. Fits academic KGF use. |  |
> | VUE | Yes | Yes (Java desktop) | Java | Concept maps (nodes/links), pathways for navigation/scopes. Merge maps for aliases. | Medium: Scriptable, offline. Wrap with Electron for modern UI, add bands via views. |  |
> | Coggle | No (Free tier) | Partial (Web, offline export) | Web (JS) | Simple trees, branches for scopes. Real-time collab. | Low: No open source, API limited. Not ideal for wrapping, but inspire UI. |   |
> | MYND | Custom (Described as built) | Yes (Local ML) | Python/ML (Graph Transformer), Claude API | 3D mind maps, context synthesis, memory hierarchy for bands/scopes. AI learning for proposals. | High: If open-sourced, wrap for KGF AI. Proactive features fit Flash band. | [post:2] |
> | Blender Mindmap Addon | Yes (Blender addon) | Yes (Offline 3D) | Python (Blender API) | 3D mind maps in Blender. Nodes/trees in viewport. | Low: 3D-focused, heavy for KGF. Wrap via Blender Python, but overkill. | [post:3] |
> 
> ### 推奨
> - **トップピック**: TiddlyMap (オフライン/軽量、Webラップ容易) or diagrams.net (キャンバス/オフライン、Miro差別化に強い)。これらをラップすれば、仕様の80%カバー可能。Freeplaneと組み合わせでJava部分をオフライン強化。
> - **戦略**: オープンソースをフォーク、KGF独自（スコープ/alias/AI）をプラグイン追加。テストで消失防止優先。
> - **注意**: オフライン弱いツールはService Workerで強化。詳細実装でさらにBrowse可能。
> 
> 

> [!abstract]- Tool (file_search)
> <sub>2026-04-17 14:08</sub>
> 
> Make sure to include fileciteturn0file2 in your response to cite this file, or to surface it as a link.
> # Mind Map Model Engine (M3E) 仕様設計書（会話ログ統合）
> 
> 本書は、これまでの会話で合意された世界観・制約・設計意図を、実装詳細に過度に踏み込まずに「仕様」として再構成したものである。特に、個人オフライン・スコープ境界・親子主構造・帯域（Flash/Rapid/Deep）・AIは提案で承認が確定、を中核原則として保持する。
> 
> ---
> 
> ## 0. 基本思想・前提
> 
> - 目的：M3Eは「情報管理」と「認知拡張」を同時に満たす思考ツール（道具であり環境）である。研究知識・タスク・生活管理などの思考要素を同一体系で扱い、分断を避ける。
> - 想定ユーザー：まずは1ユーザーの個人利用を前提とし、日常運用に耐える信頼性（消失バグなし）を最優先とする。
> - オフラインファースト：編集・閲覧・構造操作はオフラインで成立し、AI等の外部APIはオンライン時の補助として位置づける。
> - Miroとの差別化：Miroはオンラインのチームホワイトボードであり、M3Eは個人オフラインの構造思考環境である。M3Eの差別化は「帯域」「スコープ境界（見えすぎ回避）」「alias参照」「構造→自然言語化による外部AI連携」である。
> - Flash / Rapid / Deep：帯域は機能差ではなく、思考密度と作業態度の差として設計する。
>   - Flash：反応（閃き・割り込み・提案を逃さない）／種（後で本体に組み込む）
>   - Rapid：作業（普段使い）／草稿（速度優先の思考整理）
>   - Deep：構造化（設計図）／設計図（完成ではなく変化し続ける）
> - 構造は単一でビューが変わる：同一の基礎構造（単一の実体グラフ）を、帯域・スコープ・表示密度の違いとして観測・編集する。
> - folder = 認知境界：フォルダは下位階層のルートノードであり、スコープ境界（folder world）として可視性・探索・編集の範囲を規定する。
> - alias = 参照のみ：aliasは実体を複製せず参照する窓である。実体は一意の場所（単一スコープ）に属し、他スコープからはaliasで参照する。
> - 見えすぎ回避：現在スコープ外の情報は基本的に露出しない。外部要素が必要な場合はalias等の明示的導線のみで参照する。
> - 主構造は親子関係のみ：主構造は親子（ツリー）であり、自動整形の対象はこの骨格である。関係線は補助線として後回し／既定非表示を基本方針とする。
> 
> ---
> 
> ## 1. 用語定義
> 
> - Node：思考要素の最小単位。型は text / image / folder / alias。
>   - text：テキスト内容を持つノード。
>   - image：画像内容を持つノード。
>   - folder：下位階層のルートノード。スコープ境界として振る舞う。
>   - alias：text/image/folderのいずれかを参照するノード（alias→alias参照は禁止）。
> - Edge：親子関係のみを表す有向関係（親→子）。
> - Scope：folder world。あるfolderをrootとする可視性・編集範囲。
> - 帯域：Flash / Rapid / Deep。
> - Inbox：Flash領域。種（未統合）を一時的に保持する受け皿。
> - 昇格：Flash → Rapid。Inbox内の種をスコープ内の構造へ組み込む操作。
> - View状態：ズーム位置、折り畳み、選択など表示・操作に関わる状態。
> - 構造状態：ノード・親子関係・スコープ所属など実体構造に関わる状態。
> - コンテクストパッケージ：選択スコープ以下の構造を、外部AI等に渡す目的で自然言語化・圧縮した表現。
> 
> ---
> 
> ## 2. データモデル
> 
> ### 2.1 Nodeの必須属性（概念要件）
> - 一意ID（永続的）
> - 型（text/image/folder/alias）
> - 所属スコープ（実体は単一スコープに属する）
> - 親子関係（親ID、子ID列、順序）
> - 内容（text本文、image参照など。aliasは参照先ID）
> - 作成・更新時刻（最小限）
> 
> ### 2.2 制約
> - Nodeの一意性：実体ノード（text/image/folder）は一意の存在であり、複製による整合性崩壊を避ける。
> - 親子制約：主構造はツリーを基本とし、親子整合性（循環禁止、順序の一貫性）を保証する。
> - alias参照制約：aliasは text/image/folder のみ参照可能（alias→alias禁止）。
> - scope所属ルール：実体は単一スコープに所属し、他スコープからはaliasで参照する。
> - folderの特権性：folderは下位階層のrootであり、スコープ境界として可視性・探索・編集範囲を規定する。
> 
> ### 2.3 変更履歴・差分
> - Undoログ構造：全変更を「コマンド（操作）」として記録できる構造を前提にする。
> - 差分表現：将来、Deepの比較（思考比較）を可能にするため、差分抽出可能なログ設計を目標とする。
> - バージョン管理の可能性：Deepを設計図として扱うため、将来のバージョン履歴・比較へ拡張できる余地を残す。
> 
> ### 2.4 スキーマ
> - スキーマ定義：保存形式におけるデータ構造の設計図（Node/Edge/Scope/Alias/ログなど）。
> - スキーマ移行方針：将来の属性追加・形式変更に備え、スキーマバージョンを持ち、移行（変換）手段を用意できる設計を採用する。
> 
> ---
> 
> ## 3. 帯域設計
> 
> ### 3.1 Flash（反応／種）
> - 目的：閃き・割り込み・提案を逃さない即応性を最優先とする。
> - Inbox構造：Flashの受け皿としてInboxを持つ。種は未統合として扱い、Rapidへ組み込む導線を持つ。
> - 自動保存：入力直後に確実に保存されることを重視する。
> - 昇格条件：ユーザー操作により種を構造へ組み込む（Flash→Rapid）。
> - AI補助の範囲：Flash→Rapidの補助（候補提示、仮配置提案）は現実的価値が高い。
> - 削除と昇格の違い：昇格は状態の変化であり、削除ではない。種の履歴を消失させない。
> 
> ### 3.2 Rapid（作業／草稿）
> - 目的：普段の使用帯域。速度優先で思考整理を行う。
> - 速度優先原則：起動や操作は軽快であるべきだが、Flashほどの即応性は要求しない（FlashとRapidで要求水準を分ける）。
> - AI編集許容範囲：RapidではAI編集を許容する方向性がある（ただし承認が確定）。
> - 自動整形：ツリー自動整形を主とし、キャンバス上で操作する。
> - 構造変更：親子付け替え・折り畳みなどの構造操作が日常的に行える。
> 
> ### 3.3 Deep（構造化／設計図）
> - 目的：完成物ではなく変化し続ける設計図として構造を扱う。成果物そのものではないが、外部思考（AI対話等）に渡す設計図として有効。
> - 外部AI用コンテクスト生成：選択スコープ以下を自然言語化し、外部チャット等で利用可能な形に変換する。
> - 差分比較：思考の比較・進化の可視化を将来可能にする。
> - 抽象化：詳細度を上げる／圧縮するなど、設計図としての読解密度を高める。
> - AI介入方針：内部AIによる全面介入は信頼性の観点から現時点では抑制的だが、将来は介入範囲を拡張する余地を残す（境界は意図的に曖昧に保つ）。
> 
> ---
> 
> ## 4. UI / UX
> 
> - キーボード設計思想：Flash/Rapid/Deepで効率的なキー操作を重視し、予測可能性と安定性（消失バグなし）を採用基準とする。
> - Enter / Alt+Enter仕様：編集開始・確定・改行・兄弟追加などの仕様は「入力状態（選択/編集/IME）」に依存して一貫的に定義する。
> - IME考慮：日本語入力（変換中）とショートカットの衝突を避ける。
> - フォーカス状態定義：どの要素が入力を受け取るか（キャンバス/編集欄/検索等）を明確にし、誤作動を避ける。
> - ノード編集モード／選択モード：編集と操作の状態遷移を安定させる。
> - パン／ズーム／ドラッグ：キャンバス操作の誤作動防止を重視し、操作感は段階的に改善する。
> - 折り畳み：ツリー構造の可視性制御の中核。
> - スコープ遷移UI：folder[X]を開くと[X]をrootとするマップが広がる。Rapid/Deepは[X]のプロパティ（またはビュー状態）として決まる世界観。
> - 戻る動作：スコープ移動の往復が迷子にならない設計。
> - 全体俯瞰ビュー：全体を見渡すビューは必要だが、全ノードの完全描画を要求しない（要約/抽象化）。
> - 表示密度切替：Rapid/Deepの差は主に表示密度・読解密度として扱い、使いながら境界を調整する。
> - View状態保存：再起動後に同じ作業状態へ戻れること（ズーム位置・折り畳み・最後のスコープ等）。
> 
> ---
> 
> ## 5. キャンバス技術
> 
> - SVG vs Canvas：要素数・更新頻度に応じて選定する。一般に大量要素ではCanvasが有利になりやすい。
> - ヒットテスト方式：ズーム/パン下での選択判定を安定させる。
> - ビューポート仮想化：見えている範囲（および周辺）だけを描画・計算して性能を確保する。
> - レイアウトアルゴリズム：親子ツリーの自動整形を主軸にする。
> - 差分描画戦略：毎フレーム全更新を避け、変更があった部分中心に更新する。
> - パフォーマンス目標値：典型スコープ（~100ノード）で日常操作が快適であることを目標にする。
> - 100ノード基準設計：スコープ内操作は100ノード規模を基準に最適化する。
> - 1万ノード全体管理：全体ビューは要約/抽象化を用い、1万ノードの完全インタラクティブ描画を前提にしない。
> 
> ---
> 
> ## 6. 永続化
> 
> - IndexedDB設計：Webアプリのローカル永続化として採用候補。保存・復元の一致性を最優先する。
> - 保存単位：スコープ単位で閉じる設計が性能・整合性・将来同期に有利。全体としても参照整合性を維持する。
> - 自動保存間隔：実装は後で調整するが、消失防止を優先する。
> - 破損時の復旧戦略：最低限のバックアップ/復元導線を持つ。
> - バックアップ戦略：日常運用の安全策として手動でも成立する形式（例：JSON）を持つ。
> - ローカル専用方針：初期はローカル専用で成立させ、同期は先送り可能な領域とする。
> 
> ---
> 
> ## 7. スコープ設計
> 
> - folder世界の閉包性：原則としてスコープ内で完結し、外部は見せない。
> - aliasの跨ぎ方：他スコープはalias参照でのみ接続し、見えすぎを抑制する。
> - 複数タブ編集戦略：複数スコープを並行編集したい要求があるため、タブ/ビューの並行性と整合性を設計する。
> - scope単位ロック方針：同一スコープの同時編集を避けることで衝突を減らす。
> - スコープ間移動UX：移動と帰還がストレスなく行えること。
> - 参照整合性：参照先の変更（名称変更/移動/削除）とalias表示の整合を保つ。
> 
> ---
> 
> ## 8. Undo / 差分
> 
> - すべての変更をログ化するか：消失バグ防止・差分・履歴の観点からログ化は有効。
> - コマンドパターン採用：Undo/Redoと整合性を担保するため、操作をコマンドとして表現する。
> - ノード移動のUndo：親子付け替え、順序変更などを戻せる。
> - スコープ移動のUndo：必要に応じて扱う（ビュー状態と構造状態の分離に留意）。
> - 差分可視化の将来構想：Deepの比較・思考の進化追跡へ拡張。
> 
> ---
> 
> ## 9. AI統合
> 
> - Flash → Rapid補助：親候補・フォルダ候補・タイトル整形などの提案。
> - ノード追加提案：承認により確定することを前提とする。
> - 構造再整理提案：Rapidでの編集支援として検討。
> - Deep → 自然言語変換：外部AIに渡すためのコンテクスト化。
> - 自然言語 → 構造復元：将来課題。関係性明示やプロンプト設計が必要。
> - AI承認フロー：AIは提案であり、人間の承認が確定。
> - AI出力差分表示：採用の判断を容易にするための差分提示。
> - プライバシー方針：AI APIへ送る範囲は明示し、既定は送信最小化を志向する。
> 
> ---
> 
> ## 10. エクスポート / 連携
> 
> - Markdown：可読性重視。
> - Mermaid：構造の図的表現。
> - JSON：完全な保存・復元・移行の基礎。
> - 独自フォーマット：必要なら後で。
> - 外部チャット連携フォーマット：構造と関係性を明示して渡せる形式。
> - コンテクスト圧縮戦略：長すぎるコンテクストを避け、要約・抽象化を行う。
> 
> ---
> 
> ## 11. 非機能要件
> 
> - 起動時間：Flashは速さ命、Rapidは数秒の起動を許容するが日常運用で不満がない範囲。
> - 操作レスポンス：典型スコープでの快適さ。
> - メモリ使用量：iPad等も想定して肥大化を避ける。
> - データ安全性：消失バグゼロを最優先。
> - 安定性：保存・復元の一致性、クラッシュ耐性。
> - デバイス範囲：Mac/iPad優先。
> 
> ---
> 
> ## 12. 開発戦略
> 
> - 1ヶ月日常運用版：キー操作の効率と安定感（消失なし）を満たし、日常使用しながら改良できる水準。
> - 先送り可能問題：公開・課金・共有・多端末同期・本格ログ収集など。
> - テスト方針：消失防止を最優先し、保存→再起動→復元のリグレッションを重視。
> - コード生成エージェント：仕様が明確で自動テスト可能な領域（データモデル、コマンド、永続化、テスト）を中心に活用し、操作感に関わる領域は微調整可能にする。
> - UI改善サイクル：Rapidの操作感を最初に成立させ、その後Deep/Flashへ拡張。
> - 技術負債管理：触感プロトタイプとコアの二本立てで進め、早期に合流する。
> 
> ---
> 
> ## 13. 将来拡張
> 
> 
> The file is too long and its contents have been truncated.
> 

> [!abstract]- Tool (file_search)
> <sub>2026-04-17 14:08</sub>
> 
> Make sure to include fileciteturn0file3 in your response to cite this file, or to surface it as a link.
> 現時点であなたが置いている前提を整理すると、次のようになります。
> 
> **目的・用途**
> 
> 1. M3Eは思考整理ツール。
> 2. Flash → Rapid → Deep の三段階運用。
> 3. Rapid / Deep の運用イメージはほぼ確定している。
> 4. Flashは簡易メモ用途（当面テキストのみ）。
> 5. メールやDiscordなどからの取り込みは「手動収集ボタン」を押す日課型。
> 
> **実行環境**
> 
> 1. Mac上で利用。
> 2. Chromeブラウザで動作するWebアプリ。
> 3. TypeScriptを主要言語として採用。
> 
> **基本アーキテクチャ**
> 
> 1. MVC系構造を採用。
> 2. CoreはModel中心に設計。
> 3. 操作はCommandパターンでModelに適用。
> 4. Undo/RedoはModelが管理。
> 
> **責務分離**
> 
> Model
>  13. Node / Edge / Graph構造。
>  14. 整合性チェック。
>  15. Command適用。
>  16. Undo / Redo。
>  17. 永続化。
> 
> View
>  18. Canvas描画。
>  19. HitTest。
> 
> Controller
>  20. ユーザー入力処理。
>  21. Command生成。
> 
> ViewState（UI状態）
>  22. カメラ。
>  23. 選択状態。
>  24. hover。
>  25. drag中の仮位置。
> 
> **操作フロー**
> 
> 1. Browserイベント → Controller。
> 2. Controller → Command生成。
> 3. Controller → Model.apply(command)。
> 4. Model更新 → change通知。
> 5. View再描画。
> 
> **ドラッグ操作の方針**
> 
> 1. ドラッグ中はModelを書き換えない。
> 2. previewはViewStateで表現。
> 3. drop確定時のみCommandを発行。
> 4. 接続構造が変わるタイミングでのみModel更新。
> 
> **データ管理**
> 
> 1. Node IDは不変。
> 2. スキーマ変更はversion＋migrationで管理。
> 3. 破壊的変更は極力避ける。
> 
> **実装方針**
> 
> 1. 描画とデータ管理を分離。
> 2. Canvas系ライブラリを利用可能。
> 3. 操作ロジックはControllerに集中。
> 
> 以上が現在の仮定です。

> [!abstract]- Tool (file_search)
> <sub>2026-04-17 14:08</sub>
> 
> Make sure to include fileciteturn0file4 in your response to cite this file, or to surface it as a link.
> 当面の M3E は、独自エディタの開発を主目的としない。
> 既存の思考整理環境として Freeplane を採用し、日常の入力と構造化はその上で行う。
> M3E は Freeplane を置き換える製品ではなく、その外側で働く思考支援の層として再定義する。
> 中心に置く価値は、描画や同期ではなく、研究を進めるための論点整理と構造変換である。
> 具体的には、Freeplane 上の構造を読み取り、論点分解、比較軸整理、仮説整理などを補助する。
> 出力はまず提案として返し、人間が確認して採用する形を基本とする。
> これにより、基盤実装の負担を抑えつつ、思考支援そのものの有効性を先に検証する。
> 評価軸は機能数や収益ではなく、研究や設計の思考過程が実際に加速するかに置く。
> 独自 UI や専用アプリ化は否定せず、必要性が確認された段階で再検討する。
> すなわち M3E は、アプリ開発計画から、Freeplane を土台とした研究加速の思考エンジンへと方針転換する。

> [!abstract]- Tool (file_search)
> <sub>2026-04-17 14:08</sub>
> 
> Make sure to include fileciteturn0file5 in your response to cite this file, or to surface it as a link.
> # TheDesign — dev-docs 統合ドキュメント
> 
> > Auto-generated by `scripts/concat-dev-docs.sh` on 2026-04-04 08:12 UTC
> 
> ## Table of Contents
> 
> - **00_Home/**
>   - Current_Status.md
>   - Home.md
>   - Worktree_Separation_Rules.md
> - **01_Vision/**
>   - Core_Principles.md
> - **02_Strategy/**
>   - Current_Pivot_Freeplane_First.md
>   - MVP_Definition.md
> - **03_Spec/**
>   - AI_Common_API.md
>   - AI_Integration.md
>   - AI_Use_Cases.md
>   - Band_Spec.md
>   - Command_Language.md
>   - Data_Model.md
>   - Import_Export.md
>   - Linear_Tree_Conversion.md
>   - Model_State_And_Schema_V2.md
>   - Scope_Transition.md
>   - Scope_and_Alias.md
> - **04_Architecture/**
>   - AI_Infrastructure.md
>   - Drag_and_Reparent.md
>   - Editing_Design.md
>   - Layout_Algorithm.md
>   - MVC_and_Command.md
>   - Multi_Select.md
>   - Visual_Design_Guidelines.md
> - **05_Freeplane_Integration/**
>   - Freeplane_Data_Model_Mapping.md
> - **06_Operations/**
>   - Actions_Beta.md
>   - Agent_Roles.md
>   - Command_Panel_Security_Test_Cases.md
>   - Command_Reference.md
>   - Decision_Pool.md
>   - Documentation_Rules.md
>   - Integration_Handoff_260401_codex2.md
>   - Keybindings_Beta.md
>   - Keyboard_Reference_Beta.md
>   - README.md
>   - Test_and_CICD_Guide.md
>   - Todo_Pool.md
> - **09_Decisions/**
>   - ADR_001_Freeplane_First.md
>   - ADR_002_React_UI_Basis.md
>   - ADR_003_Freeplane_Informed_Custom_Engine.md
>   - ADR_004_SQLite_For_Rapid_MVP.md
>   - ADR_005_DataDir_Config.md
> - **/** (root)
>   - DragOperate.md
>   - M3E仕様2.md
>   - M3E仕様設計書.md
>   - README.md
> - **daily/**
>   - 260330.md
>   - 260331.md
>   - 260401.md
>   - 260402.md
>   - 260403.md
> - **freeplane/**
>   - Repository_Structure_Summary.md
> - **/** (root)
>   - freeplane利用について.txt
> - **ideas/**
>   - 20260330_dual_root_design_graph.md
>   - 260401_important_goal.md
>   - 260401_memo.md
>   - 260402subagent.md
>   - README.md
>   - security.md
> - **legacy/**
>   - Canvas_Centric_Architecture.md
>   - README.md
> - **/** (root)
>   - mindmapsoftwares.md
> - **tasks/**
>   - todo_by_role.md
> - **/** (root)
>   - use_WiseMapping.md
>   - use_freeplane.md
>   - use_obsidian.md
> 
> ---
> 
> 
> ## 00_Home
> 
> ### Current_Status.md
> 
> ```
> source: 00_Home/Current_Status.md
> ```
> 
> # Current Status
> 最終更新: 2026-04-02
> 
> ## 現在の状態（スナップショット）
> 
> - 開発の主対象: `beta/`
> - 運用方針:
>   - UpdateLog は `dev-docs/daily/YYMMDD.md` に追記
>   - 本ファイルは「現在状態」だけを保持
>   - 粗い TODO は `dev-docs/06_Operations/Todo_Pool.md` へ集約
> - 役割分担:
>   - 部下（codex1 / codex2）: 実装と daily 追記。`Current_Status.md` は read-only
>   - 上司（claude）: 部下 daily を参照して `Current_Status.md` の status 更新と統合管理
> 
> ## 統合フロー（強制）
> 
> 1. 部下は担当ブランチ（`dev-beta-visual` / `dev-beta-data`）へ push
> 2. 上司が `dev-beta` へ merge
> 3. 部下は次サイクル開始前に `origin/dev-beta` へ rebase
> 4. rebase 未実施の stale ブランチでは作業再開しない
> 
> ## In Progress
> 
> - ドキュメント運用を「daily + current snapshot + todo pool」に移行
> - セッション開始ゲート（1回のみ強制）を全体ルールへ反映済み
> - worktree 分離運用とブランチ責務の整合を強化中
> 
> ## Blocked / Risk
> 
> - `dev-docs/daily/260402.md` に競合解消の最終確認が必要
> - role 違反を機械的に止める CI チェックは未導入
> 
> ## Next 3
> 
> 1. `dev-docs/daily/260402.md` の内容整合を最終確認
> 2. branch-role と変更ファイル範囲の CI 検証を追加
> 3. `Todo_Pool.md` を実運用し、正式タスク化の流れを固定
> 
> ## 参照
> 
> - 運用ルール: `dev-docs/06_Operations/Documentation_Rules.md`
> - worktree 運用: `dev-docs/00_Home/Worktree_Separation_Rules.md`
> - rough task pool: `dev-docs/06_Operations/Todo_Pool.md`
> - 直近ログ: `dev-docs/daily/260402.md`
> 
> ---
> 
> ### Home.md
> 
> ```
> source: 00_Home/Home.md
> ```
> 
> # Home
> ## Operations
> 
> 会話や実装中に出た決定を先に保存する場所を追加した。
> 
> - 会話の決定は `../06_Operations/Decision_Pool.md`
> - 文書運用ルールは `../06_Operations/Documentation_Rules.md`
> - 並行開発時の worktree 分離運用は `./Worktree_Separation_Rules.md`
> - ここで育てた内容を `Spec` `Architecture` `ADR` へ昇格する
> 
> ## M3E とは何か
>  M3Eは科学研究のための枠組(フレームワーク)思考​支援を
> 目的としたGraph構造UIのツールです。目標として
> チャット形式のLLMの進化版となり、世界モデルを構築して
> 可視化・外在化し、意思決定を加速することを掲げます。
> 特徴としてこの文章のように構造と文章の相互変換、
> 構造(情報)の直接的な操作/やり取り、Flash/Rapid/Deepの
> 3つの思考の帯域のモード、範疇(Scope)の制御が有ります。
> ​
> 
> M3E は、科学研究を中心とした個人オフライン前提の思考ツールである。  
> 主目的は、研究の論点整理、仮説形成、比較、設計判断を、構造を保ったまま進められるようにすることにある。
> 
> 現時点では、独自エディタを先に完成させるのではなく、Freeplane を土台にして思考支援の有効性を検証する方針を採る。  
> 独自実装へ進む場合も、UI 全体は React コンポーネントで組み、マップ描画だけを独立したレンダリング層として切り出す。
> 
> ## この文書群の使い方
> 
> - 思想から入りたい場合は [../01_Vision/Core_Principles.md](../01_Vision/Core_Principles.md)
> - 今の方針を知りたい場合は [Current_Status.md](./Current_Status.md)
> - 何を作るかを知りたい場合は [../02_Strategy/MVP_Definition.md](../02_Strategy/MVP_Definition.md)
> - 実体モデルを知りたい場合は [../03_Spec/Data_Model.md](../03_Spec/Data_Model.md)
> - スコープ設計を知りたい場合は [../03_Spec/Scope_and_Alias.md](../03_Spec/Scope_and_Alias.md)
> - 実装責務を知りたい場合は [../04_Architecture/MVC_and_Command.md](../04_Architecture/MVC_and_Command.md)
> 
> ## 全体像
> 
> ### Vision
> 
> M3E の核は次の 4 点である。
> 
> - 科学研究を前に進めるための思考支援を主目的にする
> - 構造は親子を主軸に保つ
> - scope (範疇)で認知境界を制御する
> - alias で他スコープを参照する
> - AI は提案し、人間が確定する
> 
> ### Strategy
> 
> 現段階では、科学研究の思考支援として価値があるかの検証を優先する。  
> そのため、編集 UI・描画・永続化を最初から自作せず、Freeplane を既存の思考整理基盤として活用する。
> 
> ### Spec
> 
> 仕様の中核は次の通り。
> 
> - 実体ノードは永続 ID を持つ
> - 実体ノードは単一スコープに属する
> - alias は参照専用であり alias から alias は辿らない
> - 帯域は Flash / Rapid / Deep の 3 つ
> 
> ### Architecture
> 
> 独自実装へ進む場合の基本線は以下で固定する。
> 
> - Model が整合性と履歴を持つ
> - Controller が入力を解釈して Command を作る
> - UI shell は React コンポーネントで構成する
> - マップ描画は React から分離した専用レンダリング層として扱う
> - ドラッグ中の一時状態は ViewState に置く
> 
> ## 読むべき優先順
> 
> 1. 原則を確認する
> 2. 現在のピボットを確認する
> 3. MVP の範囲を確認する
> 4. 仕様とアーキテクチャに降りる
> 5. Freeplane との対応を確認する
> 6. 旧前提が必要なら `legacy/` を参照する
> 
> ---
> 
> ### Worktree_Separation_Rules.md
> 
> ```
> source: 00_Home/Worktree_Separation_Rules.md
> ```
> 
> # Worktree 分離運用ルール
> 
> 最終更新: 2026-04-01
> 
> ---
> 
> ## 目的
> 
> AI エージェント並行開発時のブランチ混在を防ぐため、担当ごとに Git worktree を分離して運用する。
> 
> ---
> 
> ## 役割と担当ブランチ
> 
> - `claude`: `dev-beta`（マージ、仕様、タスク管理、Final 反映）
> - `codex1`: `dev-beta-visual`（visual 関連）
> - `codex2`: `dev-beta-data`（model / controller 関連）
> - `akaghef`: 全体レビューと指示
> 
> ---
> 
> ## ディレクトリ割り当て（固定）
> 
> - `C:/Users/Akaghef/dev/M3E` -> `dev-beta`
> - `C:/Users/Akaghef/dev/M3E-dev-beta-visual` -> `dev-beta-visual`
> - `C:/Users/Akaghef/dev/M3E-dev-beta-data` -> `dev-beta-data`
> 
> 各担当は自分のディレクトリのみを VS Code で開く。
> 
> ---
> 
> ## 日次運用ルール
> 
> 1. 作業開始時に現在ブランチを確認する。
>    - `git branch --show-current`
> 2. pull / test / commit / push は必ず担当 worktree 内で実行する。
> 3. 共有時（画面共有、ペア作業）も、表示中のターミナルでブランチ名を都度確認する。
> 4. 役割外のブランチに切り替えない。必要時は `akaghef` にエスカレーションする。
> 
> ---
> 
> ## セッション開始ゲート（1回だけ）
> 
> 1. セッション開始時に次を 1 回だけ実施する。
>    - 役割確認
>    - ブランチ確認
>    - worktree / ディレクトリ確認
> 2. 以降は軽量チェックのみ継続する。
>    - ブランチと編集対象の整合
> 3. 毎ステップでルール全文を再確認する運用はしない。
> 
> ---
> 
> ## 変更・マージ方針
> 
> - `dev-beta-visual` と `dev-beta-data` の成果は `dev-beta` に統合する。
> - `final/` への反映は `scripts/final/migrate-from-beta.bat` 経由のみ。
> - `main` / release 系ブランチでの破壊的操作（history rewrite、force-push）は禁止。
> 
> ### 強制プロトコル（部下 -> 上司 -> 再開）
> 
> 1. 部下（`codex1` / `codex2`）は担当ブランチへ push する。
> 2. 上司（`claude`）が `dev-beta` へ merge する。
> 3. 部下は次サイクル着手前に最新 `origin/dev-beta` を自分の担当ブランチへ rebase する。
> 4. rebase 未実施の状態で実装を再開してはならない。
> 
> 部下側の最小手順:
> 
> ```bash
> git fetch origin
> git checkout dev-beta-visual   # codex2 の場合は dev-beta-data
> git rebase origin/dev-beta
> ```
> 
> ---
> 
> ## 初期セットアップ / 再作成
> 
> 既存 worktree がない場合は、リポジトリルートで以下を実行する。
> 
> ```bash
> git worktree add ../M3E-dev-beta-data dev-beta-data
> git worktree add -b dev-beta-visual ../M3E-dev-beta-visual dev-beta
> ```
> 
> 状態確認:
> 
> ```bash
> git worktree list
> ```
> 
> ---
> 
> ## 運用チェックリスト（最小）
> 
> - [ ] 正しいディレクトリを開いている
> - [ ] `git branch --show-current` が担当ブランチになっている
> - [ ] `git status` が想定どおりである
> - [ ] テスト実行後に commit / push している
> 
> ---
> 
> 
> ## 01_Vision
> 
> ### Core_Principles.md
> 
> ```
> source: 01_Vision/Core_Principles.md
> ```
> 
> # Core Principles
> 
> ## 目的
> 
> M3E は、科学研究を中心に、構造を保ったまま思考するための環境を目指す。  
> 汎用メモ整理よりも、研究課題の分解、仮説比較、前提整理、設計判断の支援を優先する。
> 
> ## 中核原則
> 
> ### 0. 科学研究を主対象にする
> 
> - 第一対象は科学研究の思考過程である
> - 論文読解、仮説形成、比較検討、研究設計を支える
> - 汎用化は否定しないが、初期最適化対象は研究用途に置く
> 
> ### 1. 個人オフラインファースト
> 
> - まず 1 ユーザーの個人利用に耐えることを重視する
> - 編集・閲覧・構造操作はオフラインで成立させる
> - 外部 AI は補助であり必須依存にしない
> 
> ### 2. 認知境界としての scope
> 
> - folder は単なる整理用ディレクトリではなく認知境界である
> - 現在の思考に不要な情報は基本的に見せない
> - 見せる必要があるときだけ alias を通じて参照する
> 
> ### 3. 主構造は親子
> 
> - 思考の骨格は親子ツリーで表現する
> - 補助線や自由接続は主構造を曖昧にしない範囲で扱う
> - 自動整形や折り畳みはこの骨格に対して行う
> 
> ### 4. 単一の実体、複数の見え方
> 
> - 実体は 1 つだけ持つ
> - 帯域や表示密度の違いはビュー差で扱う
> - 情報を複製して整合性を壊さない
> 
> ### 5. AI は提案、人間が確定
> 
> - AI が勝手に正本を書き換えない
> - 提案は差分として見える必要がある
> - 採用判断は常に人間が行う
> 
> ### 6. 消失バグゼロ優先
> 
> - 便利さよりも保存・復元の信頼性を優先する
> - Undo/Redo を含む変更履歴を重視する
> - 日常運用で壊れないことを最上位要件に置く
> 
> ## 反対側に置くもの
> 
> - ドキュメント中心の思考管理
> - 研究用途をぼかした汎用性優先
> - 常時すべてを露出するグローバル可視化
> - AI による無断編集
> - 初期段階でのマルチユーザー最適化
> 
> ## 関連文書
> 
> - 戦略: [../02_Strategy/Current_Pivot_Freeplane_First.md](../02_Strategy/Current_Pivot_Freeplane_First.md)
> - スコープ仕様: [../03_Spec/Scope_and_Alias.md](../03_Spec/Scope_and_Alias.md)
> - 帯域仕様: [../03_Spec/Band_Spec.md](../03_Spec/Band_Spec.md)
> 
> ---
> 
> 
> ## 02_Strategy
> 
> ### Current_Pivot_Freeplane_First.md
> 
> ```
> source: 02_Strategy/Current_Pivot_Freeplane_First.md
> ```
> 
> # Current Pivot: Freeplane-Informed Custom Engine
> 
> ## 判断
> 
> 当面の M3E は、Freeplane をそのまま土台 UI として使うのではなく、
> Freeplane を参考実装および互換入力形式として扱い、
> 描画と操作は M3E 側で自作する方針へ切り替える。
> 
> ## 背景
> 
> Freeplane-first は、研究支援価値の検証を早く進めるうえでは有効だった。
> しかし、M3E の独自価値が最終的に宿るのは、
> 研究思考に合った描画、操作、差分提示の設計そのものにある。
> 
> そのため、今後は次の前提で進める。
> 
> - Freeplane は参考実装として読む
> - `.mm` は互換入力形式として扱う
> - M3E の描画、操作、差分提示は独自実装する
> - レイアウト、モデル、描画を分離して将来拡張しやすくする
> 
> ## 何を Freeplane から学ぶか
> 
> - `.mm` の構造
> - ノードの `text` `details` `note` `attributes` `link`
> - 折り畳み、保存、既存運用の考え方
> - マインドマップ編集で必要になる最低限の操作要件
> 
> ## 何を M3E 側で自作するか
> 
> - 描画エンジン
> - ヒットテスト
> - 選択
> - パン、ズーム
> - ノード追加、編集、削除、再親付け
> - Undo/Redo
> - 構造の読み取りと変換
> - 論点分解
> - 比較軸整理
> - 仮説整理
> - 研究設計の整理
> - AI へのコンテクスト変換
> - 提案差分の提示
> 
> ## この方針の利点
> 
> - M3E 固有の思考支援 UI を最初から設計できる
> - Freeplane の制約に縛られずにモデル境界を保てる
> - 描画と操作を一体で設計できる
> - `.mm` 互換を保ちながら独自進化できる
> 
> ## この方針の制約
> 
> - 初期の実装コストは Freeplane-first より上がる
> - 描画、入力、永続化、Undo/Redo の品質を自分たちで担保する必要がある
> - Freeplane 互換範囲を意識しつつ独自モデルを保つ必要がある
> 
> ## 結論
> 
> Freeplane は最終形でも土台 UI でもなく、参考実装および互換入力形式である。
> M3E は独自の描画エンジンと操作系を持つ研究思考支援ツールとして進める。
> 
> ## 関連文書
> 
> - MVP 定義: [./MVP_Definition.md](./MVP_Definition.md)
> - Freeplane との写像: [../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md](../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md)
> - 新 ADR: [../09_Decisions/ADR_003_Freeplane_Informed_Custom_Engine.md](../09_Decisions/ADR_003_Freeplane_Informed_Custom_Engine.md)
> - 旧 ADR: [../09_Decisions/ADR_001_Freeplane_First.md](../09_Decisions/ADR_001_Freeplane_First.md)
> 
> ---
> 
> ### MVP_Definition.md
> 
> ```
> source: 02_Strategy/MVP_Definition.md
> ```
> 
> # MVP Definition
> 
> ## MVP の目的
> 
> M3E の MVP は、Freeplane を参考にしつつ、
> 独自描画エンジンと独自操作系を持つ研究思考支援ツールの最小成立形を示すことである。
> Freeplane の `.mm` マップは互換入力形式として受け取り、
> 研究思考支援に向けた最小の操作可能性を示す。
> 
> ## MVP の一貫した定義
> 
> MVP で成立している状態を、以下の 4 点で定義する。
> 
> 1. Freeplane の `.mm` を安定して読み取れる
> 2. M3E の最小モデルへ変換できる
> 3. 独自描画と最小編集操作を安全に扱える
> 4. 保存と再読込まで含めて日常利用で破綻しない
> 
> この段階では高度な UI 完成度までは要求しないが、
> 独自描画面が動いていること自体は MVP の成立条件に含める。
> 
> ## 実装の起点
> 
> - MVP は Rapid 帯域の最小実装から始める
> - Flash と Deep は後続フェーズで段階的に実装する
> - 今週は「Rapid で迷わず編集できること」を最優先にする
> 
> ## Freeplane をどう使うか
> 
> - Freeplane は参考実装および互換入力形式として使う
> - 最初の対象は `.mm` ファイルの import/export とする
> - Freeplane の UI や操作系をそのまま土台にはしない
> - Freeplane の内部概念に M3E 全体を押し込まない
> - `scope` `alias` などの M3E 固有概念は M3E 側の外部モデルで持つ
> 
> ## MVP で必須のこと
> 
> ### 1. 構造を読める
> 
> - Freeplane のマップ構造を読み取れる
> - ノード階層を安定して取得できる
> - 最低限の属性を扱える
> 
> 最低限の属性:
> 
> - `id`
> - `parentId`
> - `children`
> - `text`
> - `details`
> - `note`
> - `attributes`
> - `link`
> 
> ### 2. M3E 最小モデルへ変換できる
> 
> - Freeplane ノードを M3E ノードへ変換できる
> - 主構造は親子ツリーとして保持できる
> - `scope` は最初は推論対象または未設定でよい
> - M3E 固有意味は Freeplane の生属性から分離して保持する
> 
> ### 3. コア編集を安全に扱える
> 
> - 独自描画面の上で編集できる
> - ノード追加
> - ノード編集
> - ノード削除
> - 再親付け
> - Undo/Redo
> 
> ### 4. 本当に簡単に操作できる
> 
> - ノードを選択してすぐ編集できる
> - 主要操作が少ない手順で到達できる
> - 説明なしでも基本操作を試せる
> 
> ### 5. 保存して戻せる
> 
> - 保存前に不整合を検出できる
> - 保存 -> 再読込で同一構造を再現できる
> - Undo/Redo により編集事故を回復できる
> 
> ## MVP で後回しにすること
> 
> - 高性能な独自レンダリング最適化
> - 独自ドラッグ操作の作り込み
> - 高度なリアルタイム同期
> - マルチユーザー
> - 課金や公開サービス化
> - 完全な Deep 差分履歴
> - Freeplane API やスクリプトとの密結合
> - AI 提案生成と承認フロー
> 
> ## UI 方針
> 
> - UI shell は React + TypeScript ベースで進める
> - 描画は SVG 先行でよい
> - 描画層はレイアウト層と分離する
> - Canvas 移行可能性を保つため、描画面は差し替え可能な境界を持たせる
> - 独自描画面は MVP の一部である
> 
> ## Freeplane から参考にする部分
> 
> Freeplane から直接学ぶ価値が高いのは次の部分である。
> 
> - `.mm` の XML ベース構造
> - ノードの `text` `details` `note` `attributes` `link`
> - 折り畳み、ノード順序、ローカル保存
> - 既存の import/export と autosave の考え方
> 
> 逆に、そのまま採用しないものは次の通り。
> 
> - M3E 固有の `scope`
> - alias による厳密参照制約
> - command ベースの変更履歴
> - AI 提案と承認フロー (MVP 後)
> 
> ## MVP タスク一覧
> 
> ### Phase 1: 読み取り基盤
> 
> 1. Freeplane `.mm` 入力の最小実装
> 2. ノード階層パーサ実装
> 3. M3E 最小モデルへの変換
> 4. 整合性バリデータ実装
> 
> 受け入れ基準:
> 
> - サンプル 10 マップでクラッシュせず読み取れる
> - ツリー整合性エラーが明示される
> 
> ### Phase 2: コア編集機能
> 
> 1. ノード追加
> 2. ノード編集
> 3. ノード削除
> 4. 再親付け
> 5. Undo/Redo
> 
> 受け入れ基準:
> 
> - 4 操作すべてが Command 経由で実行される
> - Undo/Redo 連続 30 回で状態破綻しない
> 
> ### Phase 3: コア表示機能
> 
> 1. ノードと親子エッジの基本描画
> 2. 選択ノードの可視化
> 3. パン、ズーム、ノード中心移動
> 4. 500 ノード規模で最低性能確認
> 
> 受け入れ基準:
> 
> - 編集から描画更新まで 3 ステップ以内で確認できる
> - 500 ノードで致命的な遅延がない
> - 独自描画面の上で基本編集が成立する
> 
> ### Phase 4: 保存と保護
> 
> 1. 保存形式に version を付与
> 2. 保存前検証
> 3. バックアップ保存
> 4. 保存後再読込テスト
> 
> 受け入れ基準:
> 
> - 不正状態保存を拒否できる
> - 保存後再読込で同一構造が復元される
> 
> ### Phase 5: 操作性の最終調整
> 
> 1. 主要操作の導線を短くする
> 2. 操作ラベルと状態表示を整理する
> 3. 初見ユーザーでの簡易操作確認を行う
> 
> 受け入れ基準:
> 
> - 主要操作が迷わず実行できる
> - 最低 1 セッションを詰まらず完了できる
> 
> ## MVP 完了判定
> 
> 以下を満たしたら MVP とみなす。
> 
> - `.mm` を安定して読める
> - 独自描画面で基本表示と基本編集ができる
> - 最小編集が壊れずに動く
> - 保存後再読込で同一構造を再現できる
> - 初見でも基本操作を完了できる
> 
> ## 関連文書
> 
> - 現在の方針: [./Current_Pivot_Freeplane_First.md](./Current_Pivot_Freeplane_First.md)
> - データモデル: [../03_Spec/Data_Model.md](../03_Spec/Data_Model.md)
> - Freeplane 対応: [../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md](../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md)
> - 新 ADR: [../09_Decisions/ADR_003_Freeplane_Informed_Custom_Engine.md](../09_Decisions/ADR_003_Freeplane_Informed_Custom_Engine.md)
> - UI 基盤判断: [../09_Decisions/ADR_002_React_UI_Basis.md](../09_Decisions/ADR_002_React_UI_Basis.md)
> 
> ---
> 
> 
> ## 03_Spec
> 
> ### AI_Common_API.md
> 
> ```
> source: 03_Spec/AI_Common_API.md
> ```
> 
> # AI 共通 API 仕様
> 
> 最終更新: 2026-04-02
> 
> ## 目的
> 
> この文書は、M3E の AI 機能が共有する
> Node ローカル API の共通契約を定義する。
> 
> 対象は feature 個別の payload ではなく、
> provider 非依存で共通化される request / response / error / approval の枠組みである。
> 
> ## 適用範囲
> 
> 本仕様は次の feature に適用する。
> 
> - linear transform
> - title rewrite
> - duplicate check
> - suggest-parent
> - structure proposal
> - context package generation
> 
> feature 固有の入出力は本仕様の `input` / `proposal` / `result` に内包する。
> 
> ## 基本方針
> 
> 1. browser は外部 provider を直接呼ばない。
> 2. browser は localhost の Node API のみを呼ぶ。
> 3. provider 差分は server 側で吸収する。
> 4. AI の返答はそのまま正本に適用せず、提案または明示 result として返す。
> 5. 不正 payload や不完全 response は fail-closed で reject する。
> 
> ## エンドポイント
> 
> ### 共通 status
> 
> - `GET /api/ai/status`
> 
> 用途:
> 
> - AI 基盤が有効か
> - provider / transport / model が何か
> - feature 実行可能性の前提が揃っているか
> 
> ### 共通 subagent 実行
> 
> - `POST /api/ai/subagent/:name`
> 
> 用途:
> 
> - feature ごとの subagent 実行
> - 例:
>   - `/api/ai/subagent/linear-transform`
>   - `/api/ai/subagent/title-rewrite`
>   - `/api/ai/subagent/duplicate-check`
> 
> ### feature alias endpoint
> 
> feature ごとに専用 endpoint を持ってもよい。
> ただし内部的には共通 subagent 契約へ正規化する。
> 
> 例:
> 
> - `POST /api/linear-transform/convert`
>   - 内部的には `POST /api/ai/subagent/linear-transform`
> 
> ## 実装状況（2026-04-02）
> 
> | 項目 | 状態 |
> |------|------|
> | `GET /api/ai/status` | 実装済み |
> | `POST /api/ai/subagent/linear-transform` | 実装済み |
> | `POST /api/ai/subagent/topic-suggest` | 実装済み |
> | `openai-compatible` transport | 実装済み |
> | `mcp` transport | 未実装 |
> | `title-rewrite` | 未実装 |
> | `duplicate-check` | 未実装 |
> 
> ## 共通 status response
> 
> ```json
> {
>   "ok": true,
>   "enabled": true,
>   "configured": true,
>   "provider": "deepseek",
>   "gateway": "litellm",
>   "transport": "openai-compatible",
>   "model": "deepseek-chat",
>   "activeModelAlias": "chat.fast",
>   "availableModelAliases": ["chat.fast", "chat.local"],
>   "endpoint": "https://api.deepseek.com",
>   "message": "AI infrastructure is configured.",
>   "features": {
>     "linear-transform": {
>       "available": true,
>       "promptConfigured": true
>     },
>     "topic-suggest": {
>       "available": true,
>       "promptConfigured": true
>     },
>     "title-rewrite": {
>       "available": false,
>       "promptConfigured": false
>     }
>   }
> }
> ```
> 
> ### フィールド
> 
> - `ok`
>   - status endpoint 自体が成功したことを示す
> - `enabled`
>   - AI 基盤が全体として有効か
> - `configured`
>   - provider 接続に必要な設定が揃っているか
> - `provider`
>   - `deepseek` など
> - `gateway`
>   - `none` または `litellm`
> - `transport`
>   - `openai-compatible` または `mcp`
> - `model`
>   - 現在の既定モデル
> - `activeModelAlias`
>   - alias ベース解決時の既定 alias
> - `availableModelAliases`
>   - 基盤に登録された alias 一覧
> - `endpoint`
>   - provider endpoint または transport endpoint
> - `message`
>   - UI 表示用の短い説明
> - `features`
>   - feature ごとの可用性
> 
> ## 共通 request
> 
> `POST /api/ai/subagent/:name`
> 
> ```json
> {
>   "documentId": "rapid-main",
>   "scopeId": "n_root",
>   "provider": "default",
>   "modelAlias": "chat.fast",
>   "mode": "proposal",
>   "input": {},
>   "constraints": {
>     "timeoutMs": 15000,
>     "maxTokens": 1200,
>     "temperature": 0.2
>   },
>   "clientContext": {
>     "selectionNodeId": "n_child_1",
>     "requestId": "req-123"
>   }
> }
> ```
> 
> ### 必須フィールド
> 
> - `documentId: string`
> - `scopeId: string`
> - `input: object`
> 
> ### 任意フィールド
> 
> - `provider: "default" | string`
>   - `default` の場合は `M3E_AI_*` の現在設定を使う
> - `modelAlias?: string`
>   - alias registry を使う場合の明示指定
> - `mode: "proposal" | "direct-result"`
>   - `proposal`
>     - 承認前提の提案を返す
>   - `direct-result`
>     - 即利用可能な result を返す
>     - ただし正本自動更新を意味しない
> - `constraints`
>   - provider 呼び出しに対する上限制約
> - `clientContext`
>   - ログ相関や UI 復元用の補助情報
> 
> ## `input` の原則
> 
> `input` は feature ごとの payload を入れる。
> 
> 例:
> 
> ### linear-transform
> 
> ```json
> {
>   "direction": "tree-to-linear",
>   "sourceText": "...",
>   "scopeLabel": "Root"
> }
> ```
> 
> ### title-rewrite
> 
> ```json
> {
>   "nodeId": "n123",
>   "text": "長いラベル",
>   "details": "補足"
> }
> ```
> 
> ### duplicate-check
> 
> ```json
> {
>   "targetNodeId": "n123",
>   "targetText": "仮説A",
>   "neighborNodes": [
>     { "nodeId": "n9", "text": "仮説A改" }
>   ]
> }
> ```
> 
> ## 共通成功 response
> 
> ```json
> {
>   "ok": true,
>   "subagent": "linear-transform",
>   "provider": "deepseek",
>   "transport": "openai-compatible",
>   "model": "deepseek-chat",
>   "resolvedModelAlias": "chat.fast",
>   "mode": "proposal",
>   "requiresApproval": true,
>   "proposal": {
>     "kind": "text-transform",
>     "summary": "Tree scope was converted to linear text.",
>     "result": {
>       "outputText": "..."
>     }
>   },
>   "usage": {
>     "inputTokens": 320,
>     "outputTokens": 210,
>     "totalTokens": 530
>   },
>   "meta": {
>     "scopeId": "n_root",
>     "documentId": "rapid-main",
>     "latencyMs": 1240
>   }
> }
> ```
> 
> ### フィールド
> 
> - `ok`
> - `subagent`
> - `provider`
> - `transport`
> - `model`
> - `mode`
> - `requiresApproval`
> - `proposal`
> - `usage`
> - `meta`
> 
> ## `proposal` の共通形
> 
> ```json
> {
>   "kind": "text-transform",
>   "summary": "short human-readable summary",
>   "result": {},
>   "warnings": [],
>   "explanations": []
> }
> ```
> 
> ### 必須フィールド
> 
> - `kind`
> - `result`
> 
> ### 任意フィールド
> 
> - `summary`
> - `warnings`
> - `explanations`
> 
> ### `kind` の例
> 
> - `text-transform`
> - `title-candidates`
> - `duplicate-report`
> - `parent-candidates`
> - `structure-diff`
> - `context-package`
> 
> ## `result` の原則
> 
> `result` は feature ごとの正規化済みデータとする。
> 自由文だけを返すことは禁止する。
> 
> 許可される形:
> 
> - 構造化 object
> - 構造化 array
> - text を返す場合でも field 名を持つ object
> 
> 禁止:
> 
> - schema を持たない文字列 1 本返し
> - markdown 説明文のみ
> - provider 生レスポンスの透過返し
> 
> ## 共通失敗 response
> 
> ```json
> {
>   "ok": false,
>   "code": "AI_PROVIDER_UNAVAILABLE",
>   "error": "Provider request failed.",
>   "subagent": "linear-transform",
>   "provider": "deepseek",
>   "retryable": true,
>   "details": {
>     "transport": "openai-compatible"
>   }
> }
> ```
> 
> ### 必須フィールド
> 
> - `ok: false`
> - `code`
> - `error`
> 
> ### 任意フィールド
> 
> - `subagent`
> - `provider`
> - `retryable`
> - `details`
> 
> ## エラーコード
> 
> ### client/request 系
> 
> - `AI_INVALID_REQUEST`
> - `AI_DOCUMENT_ID_REQUIRED`
> - `AI_SCOPE_ID_REQUIRED`
> - `AI_INPUT_REQUIRED`
> - `AI_UNSUPPORTED_SUBAGENT`
> - `AI_UNSUPPORTED_MODE`
> - `AI_INPUT_TOO_LARGE`
> 
> ### config/infra 系
> 
> - `AI_DISABLED`
> - `AI_NOT_CONFIGURED`
> - `AI_TRANSPORT_NOT_IMPLEMENTED`
> - `AI_PROVIDER_NOT_SUPPORTED`
> 
> ### provider 実行系
> 
> - `AI_PROVIDER_UNAVAILABLE`
> - `AI_PROVIDER_TIMEOUT`
> - `AI_PROVIDER_RATE_LIMITED`
> - `AI_PROVIDER_BAD_RESPONSE`
> - `AI_PROVIDER_SCHEMA_MISMATCH`
> 
> ### feature 正規化系
> 
> - `AI_PROPOSAL_INVALID`
> - `AI_RESULT_INVALID`
> - `AI_APPROVAL_REQUIRED`
> 
> ## HTTP status の原則
> 
> - `200`
>   - status 成功
>   - subagent 実行成功
> - `400`
>   - request 不正
> - `404`
>   - subagent 不明
> - `409`
>   - feature 上の競合や approval 前提違反
> - `429`
>   - rate limit
> - `500`
>   - M3E 内部エラー
> - `502`
>   - provider 応答不正
> - `503`
>   - disabled / not configured / unavailable
> - `504`
>   - provider timeout
> 
> ## 承認境界
> 
> ### 原則
> 
> - AI の返答は既定で `requiresApproval: true`
> - `mode: "direct-result"` でも正本自動適用はしない
> - 正本への反映は別の command / apply endpoint で行う
> 
> ### 例外
> 
> 以下は `requiresApproval: false` を許してよい。
> 
> - context package text の生成
> - linear text の一時プレビュー生成
> - node metadata を変更しない読み取り専用提案
> 
> ただしこの場合も、
> 正本への write は別操作であることを保つ。
> 
> ## 監査ログ前提
> 
> 将来の監査ログのため、
> 少なくとも次を `meta` または内部ログで持てる構造にする。
> 
> - `documentId`
> - `scopeId`
> - `subagent`
> - `provider`
> - `requestId`
> - `latencyMs`
> - `usage`
> 
> ## feature alias endpoint との整合
> 
> 個別 endpoint は UI 実装を単純化するために許可する。
> ただし内部的には次の正規化を行う。
> 
> ```text
> Feature endpoint request
>   -> common subagent request
>     -> provider transport
>       -> normalized proposal/result
>         -> feature endpoint response
> ```
> 
> つまり、個別 endpoint は共通 API 契約の sugar であり、
> 別インフラを持ってはならない。
> 
> ## 初期導入順
> 
> 1. `GET /api/ai/status`
> 2. `POST /api/ai/subagent/linear-transform`
> 3. `POST /api/ai/subagent/title-rewrite`
> 4. feature alias endpoint の整理
> 5. approval / audit log 連携
> 
> ## 関連文書
> 
> - `./AI_Integration.md`
> - `../04_Architecture/AI_Infrastructure.md`
> - `./Linear_Tree_Conversion.md`
> 
> ---
> 
> ### AI_Integration.md
> 
> ```
> source: 03_Spec/AI_Integration.md
> ```
> 
> # AI連携仕様
> 
> 最終更新: 2026-04-02
> 
> ---
> 
> ## 基本原則
> 
> Core Principles §5 に従う。
> 
> - **AI は提案、人間が確定**。AI がユーザーの許可なく正本を書き換えることはない
> - 提案は差分として可視化し、採用・棄却を明示的に選択する
> - AI は外部依存であり、オフライン時も M3E の基本機能は成立する
> - API へ送信するデータ範囲はユーザーが把握・制御できる
> 
> ---
> 
> ## 文書の役割
> 
> - 本文書: AI 機能の導入段階、feature 要件、承認フロー
> - `../04_Architecture/AI_Infrastructure.md`: provider 接続、secret 注入、transport、責務分離
> - `./AI_Common_API.md`: 共通 API 契約、error code、proposal/result 正規形
> - `./AI_Use_Cases.md`: ユーザー視点の利用シナリオと優先順位のアイデア集
> 
> AI インフラの共通設計は上記 architecture 文書を正本とし、
> 本書では feature 側の仕様と段階導入に集中する。
> 
> ---
> 
> ## 連携フェーズ
> 
> ### Phase 0（現行）— 手動コンテクスト出力
> 
> ユーザーが手動でノード構造を外部 AI（Claude, ChatGPT 等）に貼り付けて対話する。
> M3E 側の実装は不要だが、**エクスポート品質**が連携の質を左右する。
> 
> 対応タスク:
> - Markdown エクスポート（インデント形式ツリー）
> - JSON エクスポート（完全構造）
> - コンテクストパッケージ（選択スコープ以下を自然言語化して圧縮した出力）
> 
> ---
> 
> ### Phase 1 — コンテクストパッケージ生成（Deep 連携）
> 
> 選択したスコープ以下の構造を、外部 AI に渡すためのテキストに変換する機能。
> 
> #### 出力形式
> 
> ```
> [スコープ名] についての構造化コンテクスト
> 
> # 主要ノード（階層）
> - 仮説A
>   - 前提1
>   - 前提2
> - 仮説B
>   ...
> 
> # 未整理メモ（Flash/Inbox）
> - ...
> 
> # 関連外部参照（alias）
> - [alias名] → [参照先スコープ名]
> ```
> 
> #### 設計要件
> 
> - 深さ・幅の上限を指定できる（コンテクスト長制御）
> - 未整理の Flash アイテム（Inbox）を区別して含める
> - alias は参照先名称だけを示し、実体データは含めない
> - 出力をクリップボードにコピーするアクションをワンステップで実行できる
> 
> #### UI
> 
> - 右クリックメニュー or ツールバーボタン「コンテクスト生成」
> - 生成プレビュー（モーダル）→ コピー or ファイル保存
> 
> ---
> 
> ### Phase 2 — Flash→Rapid 昇格支援
> 
> Flash の Inbox にある種を Rapid 構造へ組み込む際の配置候補提案。
> 
> #### 機能
> 
> | 提案内容 | 説明 |
> |---------|------|
> | 親候補提示 | 既存ノードの中から親として適切なノードを複数提案 |
> | フォルダ候補提示 | 所属スコープの候補を提案 |
> | タイトル整形 | 口語・断片テキストを簡潔なノードラベルに整形 |
> | 重複検出 | 既存ノードと意味的に重複している場合に警告 |
> 
> #### 承認フロー
> 
> ```
> Inbox アイテム選択
>   → [昇格] ボタン
>   → AI 提案パネルが表示（親候補リスト・整形タイトル）
>   → ユーザーが候補を選択 or 手入力
>   → 確定 → 構造に追加
> ```
> 
> - AI 提案をスキップして手動昇格も常に可能
> - 提案は「候補」として表示し、自動適用しない
> 
> ---
> 
> ### Phase 3 — インライン構造提案（Rapid 支援）
> 
> Rapid 帯域での編集中に、構造改善の提案を差分として表示する。
> 
> #### 提案種別
> 
> | 種別 | 内容 |
> |-----|------|
> | 分割提案 | 長すぎるノードを複数ノードに分割 |
> | 統合提案 | 類似ノードのまとめ |
> | 順序提案 | 兄弟ノードの並び替え（論理的順序） |
> | 親付け替え提案 | 誤配置ノードの再配置候補 |
> 
> #### 差分表示
> 
> - 提案は現在のツリーの上に「ghosted overlay」として表示
> - 変更対象ノードが色分け（追加: 緑、削除: 赤、移動: 黄）
> - 「採用」「棄却」「後で確認」の 3 択で応答
> - 部分採用（提案の一部だけ適用）が可能
> 
> ---
> 
> ### Phase 4 — Deep コンテクスト往復（将来）
> 
> Deep 構造を外部 AI に送り、AI の返答を差分として取り込む双方向連携。
> 
> #### フロー（概念）
> 
> ```
> Deep 構造 → コンテクストパッケージ生成
>   → AI API に送信（ユーザー確認後）
>   → AI 返答（テキスト or 構造化 JSON）
>   → M3E が差分として解釈
>   → ユーザーが採用・棄却を選択
>   → 採用分だけ構造に反映
> ```
> 
> #### 前提条件
> 
> - Phase 1 のコンテクストパッケージが安定していること
> - AI 返答の構造化解釈（JSON スキーマ合意）
> - 差分表示 UI（Phase 3）が実装済みであること
> 
> ---
> 
> ## API 設計方針
> 
> ### ローカル API サーバー経由
> 
> M3E の Node.js サーバーが AI API のプロキシとして振る舞う。
> ブラウザから直接外部 API を叩かない（CORS・キー管理のため）。
> 
> ```
> Browser → localhost API → Claude API (or local LLM)
> ```
> 
> ### エンドポイント（Phase 2 以降）
> 
> | エンドポイント | 説明 |
> |-------------|------|
> | `POST /api/ai/promote-suggestion` | Flash 昇格候補の取得 |
> | `POST /api/ai/structure-proposal` | 構造改善提案の取得 |
> | `POST /api/ai/context-package` | コンテクストパッケージ生成 |
> 
> ### Provider 抽象化（DeepSeek subagent 対応）
> 
> 外部 LLM 連携は provider 依存を避けるため、M3E 内部では共通インターフェースを使う。
> DeepSeek はその 1 provider として実装し、map 内補助は subagent 呼び出しとして扱う。
> 
> #### 目的
> 
> - map 編集体験を壊さずに、補助機能を「提案」として段階導入する
> - provider 切替（DeepSeek / Claude / local LLM）を UI と API 契約から分離する
> - 送信範囲・承認フロー・監査ログを provider 横断で統一する
> 
> #### 非目的
> 
> - AI による無承認の正本更新
> - provider 固有 SDK を browser 側に直接埋め込むこと
> - 1 回の呼び出しで複数スコープ全体を書き換えること
> 
> #### Subagent の責務（初期スコープ）
> 
> | subagent | 入力 | 出力 | map 反映 |
> |---|---|---|---|
> | `suggest-parent` | 対象ノード + 候補親集合 | 親候補ランキング | ユーザー承認後のみ |
> | `title-rewrite` | ノード text/details | 整形タイトル候補 | ユーザー承認後のみ |
> | `duplicate-check` | 対象ノード + 近傍ノード | 重複警告/類似候補 | 警告のみ |
> | `outline-expand` | 選択スコープ | 子ノード案（差分） | 差分採用時のみ |
> 
> #### 共通 API 契約（案）
> 
> 詳細は `./AI_Common_API.md` を正本とする。
> 
> 本書では次の原則のみ固定する。
> 
> - subagent 実行は `POST /api/ai/subagent/:name`
> - provider 差分は server 側で吸収する
> - AI 返答は proposal/result の正規形に落として返す
> - approval 要否は response に明示する
> 
> #### DeepSeek provider 設定（現行方針）
> 
> - 環境変数
>   - `M3E_AI_PROVIDER=deepseek`
>   - `M3E_AI_API_KEY`
>   - `M3E_AI_BASE_URL`（省略時は公式 URL）
>   - `M3E_AI_MODEL`
> - キー未設定時は fail-closed（subagent 機能を無効化して UI で通知）
> 
> #### 安全設計（Command Panel 方針との整合）
> 
> - 入力制限
>   - subagent は `scopeId` 配下だけを参照可能
>   - 最大ノード数・最大文字数を超える入力は送信前に拒否
> - 出力制限
>   - 返答は構造化 JSON のみ受理（自由文は説明欄に隔離）
>   - 未知フィールドは破棄し、必須フィールド不足時は reject
> - 実行制限
>   - タイムアウト、リトライ回数、レート制限を provider 横断で適用
>   - 失敗時は既存編集フローへ即時フォールバック（fail-closed）
> 
> #### 監査ログ（ローカル保存）
> 
> - 最低限の記録項目
>   - timestamp / documentId / scopeId / subagent / provider
>   - request hash（生データ全文は既定で保存しない）
>   - result code / latency / token usage
>   - user action（accept/reject/partial）
> 
> #### 段階導入計画
> 
> 1. Provider 抽象 API を追加（実体は既存 provider 1 つで可）
> 2. `title-rewrite` と `duplicate-check` から導入
> 3. 差分 UI と承認イベントのログ化
> 4. DeepSeek provider を追加し A/B 切替
> 5. `suggest-parent` / `outline-expand` を順次有効化
> 
> ### API キー管理
> 
> - キーはサーバーサイドの環境変数（`M3E_AI_API_KEY`）として保持
> - ブラウザには送出しない
> - キー未設定時は AI 機能を無効化し、その旨を UI に表示
> 
> ---
> 
> ## プライバシー設計
> 
> - **送信範囲の明示**: AI API に送るデータ（テキスト・構造）を送信前にユーザーに提示する
> - **スコープ単位制御**: 特定スコープを「AI 送信対象外」にマークできる（将来）
> - **ローカル LLM 対応**: API エンドポイントを差し替えることでオンプレミス LLM にも対応できる設計とする
> - **送信ログ**: 何を送信したかをローカルに記録する（オプション）
> 
> ---
> 
> ## 実装優先順位
> 
> | Phase | 内容 | 依存 | 優先度 |
> |-------|------|------|--------|
> | 0 | Markdown/JSON エクスポート強化 | なし | **今すぐ着手可能** |
> | 1 | コンテクストパッケージ生成 | エクスポート | Beta 安定後 |
> | 2 | Flash→Rapid 昇格支援 | Flash UI, API proxy | Phase 1 完了後 |
> | 3 | インライン構造提案・差分表示 | Phase 2, diff UI | Phase 2 完了後 |
> | 4 | Deep 往復連携 | Phase 1+3 | 将来 |
> 
> ---
> 
> ## 関連文書
> 
> - Core Principles: [../01_Vision/Core_Principles.md](../01_Vision/Core_Principles.md)
> - Band Spec: [Band_Spec.md](Band_Spec.md)
> - Data Model: [Data_Model.md](Data_Model.md)
> - M3E 仕様設計書 §9: [../M3E仕様設計書.md](../M3E仕様設計書.md)
> 
> ---
> 
> ### AI_Use_Cases.md
> 
> ```
> source: 03_Spec/AI_Use_Cases.md
> ```
> 
> # AI 利用シナリオ集
> 
> 最終更新: 2026-04-02
> 
> ## 目的
> 
> この文書は、M3E において AI をどのような場面で使うと価値が高いかを、
> ユーザー視点のアイデアとして整理する。
> 
> ここで扱うのは確定仕様ではなく、
> feature 検討・優先順位付け・UI 構想の材料である。
> 
> ## 前提
> 
> - AI は正本の自動編集者ではなく、提案・変換・整理補助として使う
> - ユーザーは思考の主体を維持したい
> - AI が使えない状態でも基本操作は成立する
> 
> ## 用法名
> 
> AI の使い方は、まず次の名前で呼ぶ。
> 
> ### 1. Flash Intake
> 
> 雑多な文書、ファイル、断片メモを
> まず Flash に取り込む用途。
> 
> 例:
> 
> - PDF やメモの内容を雑に取り込む
> - ファイル群から素材を入れる
> - まだ tree 構造を考えずに一時保管する
> 
> 考え方:
> 
> - import の受け皿は基本的に Flash でよい
> - この段階では整理より capture を優先する
> - AI は抽出・要約・分解の補助として使う
> 
> 向く機能:
> 
> - file import
> - text extraction
> - context package generation
> - Flash -> Rapid 昇格支援
> 
> ### 2. Rapid Expand
> 
> Rapid で考えている途中に、
> いま見ている scope のアイデアをワンクリックで広げる用途。
> 
> 例:
> 
> - 子観点を増やしたい
> - 仮説の枝を広げたい
> - 抜けている論点を見つけたい
> 
> 考え方:
> 
> - 既に tree で考えている最中なので、対象は current scope に限定する
> - 結果は subtree 差分として返す
> - 1 クリックで候補を出し、採用はユーザーが行う
> 
> 向く機能:
> 
> - outline-expand
> - structure-proposal
> - suggest-parent
> 
> ### 3. Rapid Polish
> 
> Rapid で組んだ tree を、
> 壊さずに見やすく整理する用途。
> 
> 例:
> 
> - ラベルを整える
> - 重複を見つける
> - 並びや親子関係の違和感を減らす
> 
> 向く機能:
> 
> - title-rewrite
> - duplicate-check
> - suggest-parent
> 
> ### 4. Deep Relay
> 
> ある scope を外部 AI に渡して、
> レビューや再構成を受ける用途。
> 
> 例:
> 
> - DeepSeek に論点レビューさせる
> - scope を読みやすい linear/context に変換して渡す
> - 提案を差分として持ち帰る
> 
> 向く機能:
> 
> - linear-transform
> - context-package
> - proposal import
> - diff-based apply
> 
> ## 大きな利用カテゴリ
> 
> ### 1. 構造化を速くする
> 
> ユーザーは最初から tree を丁寧に作るより、
> まず断片や箇条書きを高速に書き出したいことが多い。
> 
> AI はその粗い入力を tree 構造へ寄せる補助に向く。
> 
> 想定機能:
> 
> - linear -> tree 変換
> - tree -> linear 変換
> - outline expand
> - context package generation
> 
> ### 2. 整理の迷いを減らす
> 
> ノードが増えると、
> どこへ置くか、どう名付けるか、何が重複しているかで迷う。
> 
> AI は「答え」より「候補圧縮」に向く。
> 
> 想定機能:
> 
> - suggest-parent
> - title-rewrite
> - duplicate-check
> - structure-proposal
> 
> ### 3. 外部 AI との往復をしやすくする
> 
> Deep な検討では、
> ある scope を外部 AI に渡して要約・批評・再構成を受けたい場面がある。
> 
> AI 基盤はそのための安全な送信・整形・取り込み口になる。
> 
> 想定機能:
> 
> - context package export
> - deep review
> - proposal import
> - diff-based apply
> 
> ## ユーザー利用シーン
> 
> ### シーン A: まず雑に書いて、あとで構造化したい
> 
> 対応する用法名:
> 
> - `Flash Intake`
> 
> 状況:
> 
> - 研究メモや発想を書き殴っている
> - まだ親子関係を考えたくない
> 
> 欲しいこと:
> 
> - 箇条書きや段落を tree へ変換したい
> - 変換結果を見てから採用したい
> 
> 向く AI 機能:
> 
> - `linear-transform`
> 
> 価値:
> 
> - 入力速度を落とさずに構造化へ移れる
> 
> ### シーン B: 既存 tree を外部 AI に読ませやすくしたい
> 
> 対応する用法名:
> 
> - `Deep Relay`
> 
> 状況:
> 
> - ある scope を DeepSeek や他モデルに見せたい
> - 生の JSON では読ませにくい
> 
> 欲しいこと:
> 
> - tree から readable な linear/context へ変換したい
> - 送る範囲を scope 単位で制御したい
> 
> 向く AI 機能:
> 
> - `linear-transform`
> - `context-package`
> 
> 価値:
> 
> - map を崩さずに外部 AI 対話へ接続できる
> 
> ### シーン C: ノードの置き場所に迷う
> 
> 対応する用法名:
> 
> - `Rapid Polish`
> 
> 状況:
> 
> - ノードは書けたが、どの親の下に置くか迷う
> - 似た候補が複数ある
> 
> 欲しいこと:
> 
> - 親候補を 2-3 個出してほしい
> - なぜその候補なのか短く説明してほしい
> 
> 向く AI 機能:
> 
> - `suggest-parent`
> 
> 価値:
> 
> - tree の整理コストを下げる
> 
> ### シーン D: ラベルが長くて汚い
> 
> 対応する用法名:
> 
> - `Rapid Polish`
> 
> 状況:
> 
> - ノード text が長い
> - 口語やメモ断片のままで見通しが悪い
> 
> 欲しいこと:
> 
> - 短いラベル候補を複数ほしい
> - 元の意味を壊したくない
> 
> 向く AI 機能:
> 
> - `title-rewrite`
> 
> 価値:
> 
> - map の可読性を上げる
> 
> ### シーン E: 重複や近いノードを見つけたい
> 
> 対応する用法名:
> 
> - `Rapid Polish`
> 
> 状況:
> 
> - 同じような仮説や観察が増えてきた
> - 手で見比べるのが重い
> 
> 欲しいこと:
> 
> - 重複候補や類似ノードを教えてほしい
> - 統合するかは自分で決めたい
> 
> 向く AI 機能:
> 
> - `duplicate-check`
> 
> 価値:
> 
> - tree の肥大化を抑える
> 
> ### シーン F: ある scope をもう少し展開したい
> 
> 対応する用法名:
> 
> - `Rapid Expand`
> 
> 状況:
> 
> - 観点が足りない気がする
> - たたき台だけほしい
> 
> 欲しいこと:
> 
> - 子ノード案を差分として出してほしい
> - そのまま採用ではなく選択採用したい
> 
> 向く AI 機能:
> 
> - `outline-expand`
> - `structure-proposal`
> 
> 価値:
> 
> - 発想展開を加速できる
> 
> ### シーン G: 雑多なファイルをとにかく材料として入れたい
> 
> 対応する用法名:
> 
> - `Flash Intake`
> 
> 状況:
> 
> - PDF、議事録、web からのコピペ、メモ断片が混在している
> - どれが重要かまだ分からない
> 
> 欲しいこと:
> 
> - まず Flash に流し込みたい
> - 長文から箇条書き候補や断片カードを切り出したい
> - source を保持したまま後で見返したい
> 
> 向く AI 機能:
> 
> - `text extraction`
> - `context package generation`
> - `Flash -> Rapid 昇格支援`
> 
> 価値:
> 
> - import 前の整理コストを減らせる
> 
> ### シーン H: Flash に溜まった断片を Rapid に昇格したい
> 
> 対応する用法名:
> 
> - `Flash Intake`
> 
> 状況:
> 
> - Flash にメモが大量にある
> - どれを structure に上げるべきか迷う
> 
> 欲しいこと:
> 
> - 昇格候補をまとめて見たい
> - 既存 tree のどこに入るか候補がほしい
> - 類似ノードや重複も同時に知りたい
> 
> 向く AI 機能:
> 
> - `suggest-parent`
> - `duplicate-check`
> - `title-rewrite`
> 
> 価値:
> 
> - Flash が単なる墓場にならず、Rapid へ流し込みやすくなる
> 
> ### シーン I: scope の抜け論点を短時間で洗いたい
> 
> 対応する用法名:
> 
> - `Rapid Expand`
> 
> 状況:
> 
> - 今の subtree は一応できている
> - ただし抜けている観点がありそう
> 
> 欲しいこと:
> 
> - 「足りない観点」だけを追加候補で見たい
> - 現在の枝を壊さずに補完案を受けたい
> 
> 向く AI 機能:
> 
> - `outline-expand`
> - `structure-proposal`
> 
> 価値:
> 
> - 短時間で観点漏れチェックができる
> 
> ### シーン J: 行き詰まったときに別方向の切り口がほしい
> 
> 対応する用法名:
> 
> - `Rapid Expand`
> 
> 状況:
> 
> - 同じ観点で考え続けて煮詰まっている
> - 新しい軸だけ欲しい
> 
> 欲しいこと:
> 
> - 既存の子ノードを増やすのでなく、別の分類軸を提案してほしい
> - その場で 3-5 個だけ軽く出してほしい
> 
> 向く AI 機能:
> 
> - `outline-expand`
> - `structure-proposal`
> 
> 価値:
> 
> - 思考停止から抜けやすくなる
> 
> ### シーン K: subtree の並び順に違和感がある
> 
> 対応する用法名:
> 
> - `Rapid Polish`
> 
> 状況:
> 
> - 内容はある程度揃っている
> - ただし sibling 順が読みづらい
> 
> 欲しいこと:
> 
> - 並び替え候補を理由付きで見たい
> - 採用前に差分だけ確認したい
> 
> 向く AI 機能:
> 
> - `structure-proposal`
> 
> 価値:
> 
> - map の読み順が改善する
> 
> ### シーン L: subtree を人に見せる前に言い換えたい
> 
> 対応する用法名:
> 
> - `Rapid Polish`
> 
> 状況:
> 
> - 自分向けの雑なラベルで書いてきた
> - 共有前に少し整えたい
> 
> 欲しいこと:
> 
> - 専門用語を揃えたい
> - 曖昧なラベルを比較可能な表現にしたい
> 
> 向く AI 機能:
> 
> - `title-rewrite`
> 
> 価値:
> 
> - 共有品質を短時間で上げられる
> 
> ### シーン M: scope 単位で要約レビューを受けたい
> 
> 対応する用法名:
> 
> - `Deep Relay`
> 
> 状況:
> 
> - ある論点の subtree は育っている
> - でも全体として何が言えているかを外から見たい
> 
> 欲しいこと:
> 
> - scope を要約してほしい
> - 強い点と弱い点を指摘してほしい
> - 欠けている論点を返してほしい
> 
> 向く AI 機能:
> 
> - `context-package`
> - `deep review`
> 
> 価値:
> 
> - self-review を加速できる
> 
> ### シーン N: 外部 AI の返答を差分で持ち帰りたい
> 
> 対応する用法名:
> 
> - `Deep Relay`
> 
> 状況:
> 
> - DeepSeek に相談した
> - 返答の全部を鵜呑みにはしたくない
> 
> 欲しいこと:
> 
> - 返答を subtree 差分として見たい
> - 追加、移動、言い換えを分けて見たい
> - 部分採用したい
> 
> 向く AI 機能:
> 
> - `proposal import`
> - `diff-based apply`
> 
> 価値:
> 
> - 外部 AI の活用と M3E の正本管理を両立できる
> 
> ### シーン O: 研究ログから論点候補だけを抜きたい
> 
> 対応する用法名:
> 
> - `Flash Intake`
> 
> 状況:
> 
> - 日報、調査ログ、会議メモが長い
> - 全文を tree に入れたいわけではない
> 
> 欲しいこと:
> 
> - 論点候補だけ抽出したい
> - action、仮説、観察を分けてほしい
> 
> 向く AI 機能:
> 
> - `text extraction`
> - `Flash -> Rapid 昇格支援`
> 
> 価値:
> 
> - 長文から structure の種だけを拾いやすくなる
> 
> ### シーン P: いまの subtree を別表現で眺めたい
> 
> 対応する用法名:
> 
> - `Deep Relay`
> 
> 状況:
> 
> - tree のままだと見えにくい
> - 一度 linear や文章で眺めたい
> 
> 欲しいこと:
> 
> - current scope を別表現へ変換したい
> - 表現を見比べて structure の歪みを見つけたい
> 
> 向く AI 機能:
> 
> - `linear-transform`
> - `context-package`
> 
> 価値:
> 
> - 表現変換が思考点検になる
> 
> ## 優先順位の考え方
> 
> 初期に価値が出やすい順は次の通り。
> 
> 1. `linear-transform`
> 2. `title-rewrite`
> 3. `duplicate-check`
> 4. `suggest-parent`
> 5. `outline-expand`
> 6. `structure-proposal`
> 7. `context-package` の双方向化
> 
> 理由:
> 
> - Flash への intake は import 導線と相性がよい
> - Rapid 中の one-click 展開は体験価値が高く、AI らしさが出やすい
> - まず変換と軽い整理補助が最も日常頻度が高い
> - 親候補や構造提案は価値が高いが、誤提案時の UI と承認設計が重い
> - 双方向の deep 往復は最後に統合するのが安全
> 
> ## UI の示唆
> 
> この文書から見える UI の示唆:
> 
> - AI は常時自動実行より、明示操作のほうが合う
> - 提案は「採用/棄却/保留」がしやすい形で出すべき
> - 変換はプレビュー付きがよい
> - 送信範囲は scope 単位で見せるべき
> - 失敗時は手動操作へすぐ戻れるべき
> 
> ## 非目標
> 
> - AI に map 全体を自律編集させること
> - provider 固有機能をそのまま UI に出すこと
> - ユーザー承認なしで subtree を置換すること
> 
> ## 関連文書
> 
> - `./AI_Integration.md`
> - `./AI_Common_API.md`
> - `../04_Architecture/AI_Infrastructure.md`
> 
> ---
> 
> ### Band_Spec.md
> 
> ```
> source: 03_Spec/Band_Spec.md
> ```
> 
> # Band Spec
> 
> ## 概要
> 
> M3E は同一の基礎構造を、思考密度の異なる 3 つの帯域で扱う。
> 
> - Flash
> - Rapid
> - Deep
> 
> 帯域は別データではなく、同じ構造に対する作業態度と表示密度の違いである。
> 
> ## Flash
> 
> ### 役割
> 
> - 閃き
> - 割り込み
> - 一時メモ
> 
> ### 特性
> 
> - 即応性を最優先する
> - 種を逃さない
> - 当面は軽量なテキスト中心でよい
> 
> ### 主な操作
> 
> - すばやい記録
> - Inbox への蓄積
> - Rapid への昇格
> 
> ## Rapid
> 
> ### 役割
> 
> - 日常作業
> - 草稿整理
> - 速度優先の構造化
> 
> ### 特性
> 
> - 普段もっとも使う帯域
> - 自動整形と軽快な編集を重視する
> - 操作の迷いが少ないことを最優先する
> 
> ### 主な操作
> 
> - 親子編集
> - 折り畳み
> - 再配置
> - 構造の粗い整理
> 
> ### MVP での実装範囲 (今週)
> 
> 1. 表示
> 	- ルートから 2 階層以上を常時表示できる
> 	- 選択ノードが視覚的に分かる
> 2. 編集
> 	- 追加 (Enter)
> 	- 同階層追加 (Shift+Enter)
> 	- 編集開始 (F2 or ダブルクリック)
> 	- 削除 (Delete)
> 3. 構造操作
> 	- 再親付け (ドラッグ or キー操作)
> 	- 折り畳み/展開
> 4. 安全性
> 	- Undo/Redo
> 	- 保存前バリデーション
> 	- 保存 -> 再読込で構造一致
> 
> ### MVP 完了条件 (Rapid)
> 
> - 初見ユーザーが 5 分以内に「追加/編集/削除/再配置/保存」を完了できる
> - 30 回連続の Undo/Redo で破綻しない
> - 500 ノードで致命的な操作停止が発生しない
> 
> ## Deep
> 
> ### 役割
> 
> - 設計図化
> - 読解密度の高い整理
> - 外部 AI や外部対話に渡す前の構造化
> 
> ### 特性
> 
> - 完成物ではなく変化し続ける設計図
> - 差分比較や抽象化の余地を持つ
> - 詳細を圧縮しながら意味を保つ
> 
> ### 主な操作
> 
> - 構造の精緻化
> - 前提整理
> - 比較軸整理
> - コンテクストパッケージ生成
> 
> ## 帯域間の関係
> 
> - Flash は種を作る
> - Rapid は日常的に組み立てる
> - Deep は設計図として読み替える
> 
> ## 関連文書
> 
> - 原則: [../01_Vision/Core_Principles.md](../01_Vision/Core_Principles.md)
> - MVP: [../02_Strategy/MVP_Definition.md](../02_Strategy/MVP_Definition.md)
> 
> ---
> 
> ### Command_Language.md
> 
> ```
> source: 03_Spec/Command_Language.md
> ```
> 
> # M3E コマンド言語仕様
> 
> > **設計フェーズ:** Beta 以降の実装対象。MVP には未実装。
> 
> ---
> 
> ## 方針
> 
> **コマンド言語として JavaScript を採用する。**
> 
> M3E はブラウザ上の JS/TS で動作しており、モデルオブジェクトをグローバルに露出するだけで
> パーサー実装ゼロのコマンドインターフェースが実現できる。
> 
> ```javascript
> // ブラウザのコンソールから実行できる
> // 将来のコマンドパネルでは後述の Security Model に従って実行する
> const hypo = m3e.add(m3e.root, "仮説")
> m3e.attr(hypo, "status", "検証中")
> m3e.focus(hypo)
> ```
> 
> 変数・ループ・条件分岐・エラーハンドリングはすべて JS のセマンティクスに委ねる。
> カスタム DSL は導入しない。
> 
> ---
> 
> ## 露出するグローバルオブジェクト
> 
> ```typescript
> window.m3e  // M3E コマンド API
> ```
> 
> `m3e` はブラウザコンソールおよび将来のコマンドパネルから参照できる。
> 
> ---
> 
> ## Security Model（将来のコマンドパネル実装要件）
> 
> 本節は「コマンドパネル実装前に満たす必須条件」を定義する。
> 
> ### 脅威
> 
> - ユーザー入力をそのまま `eval` / `Function` / `new Function` で実行することによるコードインジェクション
> - DOM / `window` / `document` へのアクセスを経由した XSS
> - `fetch` など外部通信 API の悪用によるデータ流出
> 
> ### 必須要件（MUST）
> 
> 1. コマンドパネル実行系で `eval` / `Function` / `new Function` を使用しない。
> 2. 実行可能な文法は「M3E Command Script サブセット」に限定し、AST 検証で許可ノードのみ通す。
> 3. 実行コンテキストは `m3e` API と最小限ユーティリティのみを注入し、`window` / `document` / `globalThis` / `Function` / `XMLHttpRequest` / `fetch` にアクセス不可とする。
> 4. コマンドパネルからの外部ネットワークアクセスを禁止する。
> 5. コマンド実行前に「実行予定 API 一覧」と対象ノード数を表示し、明示承認後に実行する。
> 6. 実行ログは「時刻・呼び出し API・対象件数・成功/失敗」のみを保存し、入力全文の平文保存は既定で行わない。
> 7. 失敗時は fail-closed（実行中断）にする。
> 
> ### 推奨要件（SHOULD）
> 
> - 実行環境は Web Worker など分離コンテキストを使う。
> - 1 実行あたりの命令数・時間・変更件数に上限を設ける。
> - 危険操作（`del`, `move`, `replaceAll`）は dry-run プレビューを提供する。
> 
> ### 実装ガイド（段階導入）
> 
> - Phase A: ブラウザコンソールのみ（現状）。
> - Phase B: 読み取り専用コマンドパネル（`info`, `tree`, `find`, `findAll` 等）。
> - Phase C: 書き込み操作を許可（AST 検証 + 明示承認 + 監査ログが揃ってから）。
> 
> ### 禁止事項
> 
> - 「ユーザー入力を JS としてそのまま評価する」方式でのコマンドパネル実装。
> - CSP 緩和での暫定回避（`unsafe-eval` の追加など）。
> 
> ### 受け入れ条件
> 
> - セキュリティテストで、`window`, `document`, `fetch`, `Function` を参照する入力が拒否される。
> - コマンドパネル経由で許可 API 以外が呼べない。
> - 監査ログに操作概要が残り、入力全文が既定で保存されない。
> 
> 詳細テストケースは `../06_Operations/Command_Panel_Security_Test_Cases.md` を参照。
> 
> ---
> 
> ## ノード参照
> 
> | 表記 | 型 | 意味 |
> |------|----|------|
> | `m3e.root` | `string` | ルートノードの ID（プロパティ） |
> | `m3e.sel` | `string \| null` | 現在選択中のノード ID（読み取り専用プロパティ） |
> | `m3e.parent(id?)` | `string \| null` | 指定ノードの親 ID。省略すると選択中ノードの親 |
> | `m3e.children(id?)` | `string[]` | 指定ノードの子 ID 配列。省略すると選択中ノードの子 |
> | `m3e.node(id)` | `TreeNode` | ノードオブジェクトの深いコピーを返す（変更しても反映されない） |
> | `const id = ...` | `string` | JS 変数に束縛して後続で再利用 |
> 
> ```javascript
> const root     = m3e.root
> const selected = m3e.sel              // プロパティとして参照
> const parent   = m3e.parent()         // 選択中ノードの親
> const children = m3e.children(root)   // ルートの子 ID 配列
> const node     = m3e.node(selected)   // { id, text, note, ... } の深いコピー
> ```
> 
> ---
> 
> ## 暗黙ターゲット（Implicit Targets）
> 
> Excel のアクティブセルのように、**UI で選択中のノードを基準に操作できる**オブジェクト。
> ID を変数に束縛せずに操作したいときに使う。
> 
> | オブジェクト | 対象範囲 |
> |-------------|---------|
> | `m3e.active_node` | 選択中の単一ノード |
> | `m3e.active_branch` | 選択中ノードを根とする部分木（ノード＋全子孫） |
> | `m3e.active_scope` | 選択中ノードが属する最寄りの scope（`folder` 型の祖先ノード、なければルート） |
> 
> 各オブジェクトはメソッドを持つ。また `.id` プロパティで生の ID を取り出せる。
> 
> ```javascript
> // ID を使う従来の書き方
> const id = m3e.sel
> m3e.edit(id, "新ラベル")
> m3e.collapse(id)
> 
> // 暗黙ターゲットを使う書き方（同じ操作）
> m3e.active_node.edit("新ラベル")
> m3e.active_branch.collapse()
> ```
> 
> ### `m3e.active_node` のメソッド
> 
> 選択中の単一ノードに対して操作する。子孫には影響しない。
> 
> | メソッド | 動作 |
> |---------|------|
> | `m3e.active_node.edit(label)` | テキストを変更 |
> | `m3e.active_node.del()` | ノードと部分木を削除 |
> | `m3e.active_node.set(field, value)` | 拡張フィールドを設定 |
> | `m3e.active_node.unset(field)` | 拡張フィールドをクリア |
> | `m3e.active_node.attr(key, value)` | 属性を設定 |
> | `m3e.active_node.attrDel(key)` | 属性を削除 |
> | `m3e.active_node.setType(type)` | ノードタイプを変更 |
> | `m3e.active_node.info()` | ノード情報を返す |
> | `m3e.active_node.id` | ノード ID を返す（プロパティ） |
> 
> ```javascript
> m3e.active_node.edit("修正済み仮説")
> m3e.active_node.attr("status", "検証中")
> m3e.active_node.set("note", "先行研究 A と整合")
> m3e.active_node.info()
> 
> // ID が必要なときは .id で取り出す
> const id = m3e.active_node.id
> m3e.add(id, "子ノード")
> ```
> 
> ### `m3e.active_branch` のメソッド
> 
> 選択中ノードを根とする部分木全体に対して操作する。
> 
> | メソッド | 動作 |
> |---------|------|
> | `m3e.active_branch.collapse()` | 部分木を折り畳む |
> | `m3e.active_branch.expand()` | 部分木をすべて展開 |
> | `m3e.active_branch.move(newParentId)` | 部分木ごと別の親へ移動 |
> | `m3e.active_branch.clone(newParentId?)` | 部分木ごと複製 |
> | `m3e.active_branch.del()` | 部分木ごと削除 |
> | `m3e.active_branch.tree()` | 部分木の構造を文字列で返す |
> | `m3e.active_branch.findAll(text)` | 部分木内を検索 |
> | `m3e.active_branch.id` | 根ノードの ID（プロパティ） |
> 
> ```javascript
> m3e.active_branch.collapse()
> m3e.active_branch.expand()
> console.log(m3e.active_branch.tree())
> 
> // 選択ブランチを別の親に移動
> m3e.active_branch.move(m3e.find("実験計画"))
> 
> // ブランチを複製して派生案を作る
> const copy = m3e.active_branch.clone()
> m3e.select(copy)
> m3e.active_node.edit("派生案 B")
> ```
> 
> ### `m3e.active_scope` のメソッド
> 
> 選択中ノードが属する最寄りの scope（`folder` 型の祖先ノード）に対して操作する。
> scope が存在しない場合はルートが対象になる。
> 
> | メソッド | 動作 |
> |---------|------|
> | `m3e.active_scope.info()` | scope のノード情報を返す |
> | `m3e.active_scope.collapse()` | scope 以下を折り畳む |
> | `m3e.active_scope.expand()` | scope 以下をすべて展開 |
> | `m3e.active_scope.tree()` | scope の構造を文字列で返す |
> | `m3e.active_scope.findAll(text)` | scope 内を検索 |
> | `m3e.active_scope.id` | scope の根ノード ID（プロパティ） |
> 
> ```javascript
> // 今いる scope の構造を確認
> console.log(m3e.active_scope.tree())
> 
> // scope 内で検索
> m3e.active_scope.findAll("仮説").forEach(id => m3e.attr(id, "reviewed", "true"))
> 
> // scope を折り畳んで俯瞰する
> m3e.active_scope.collapse()
> m3e.focus(m3e.active_scope.id)
> ```
> 
> ### 暗黙ターゲットを引数として渡す
> 
> `.id` プロパティで ID が必要な既存メソッドと組み合わせられる。
> 
> ```javascript
> // 選択ブランチの根に子を追加
> m3e.add(m3e.active_branch.id, "新しい観点")
> 
> // 選択ノードの兄弟を追加
> m3e.sibling(m3e.active_node.id, "比較案")
> 
> // 選択 scope を基準にビューを合わせる
> m3e.focus(m3e.active_scope.id)
> m3e.select(m3e.active_scope.id)
> ```
> 
> ---
> 
> ## API リファレンス
> 
> ### ノード作成
> 
> #### `m3e.add(parentId, label, index?)`
> 
> `parentId` の子ノードを追加し、新しいノード ID を返す。
> `index` を省略すると末尾に追加。
> 
> ```javascript
> const obs  = m3e.add(m3e.root, "観察事実")
> const hypo = m3e.add(m3e.root, "仮説")
> const h1   = m3e.add(hypo, "温度上昇が主因")
> const top  = m3e.add(m3e.root, "最優先", 0)   // 先頭に挿入
> ```
> 
> #### `m3e.sibling(nodeId, label, after?)`
> 
> `nodeId` の兄弟ノードを追加し、新しいノード ID を返す。
> `after` を省略または `true` にすると直後、`false` にすると直前。
> 
> ```javascript
> const h2 = m3e.sibling(h1, "土壌劣化が主因")
> const h0 = m3e.sibling(h1, "前置き仮説", false)  // h1 の直前
> ```
> 
> ---
> 
> ### ノード編集
> 
> #### `m3e.edit(nodeId, newLabel)`
> 
> ノードのテキストを変更する。
> 
> ```javascript
> m3e.edit(m3e.sel(), "修正済みラベル")
> m3e.edit(h1, "仮説 A（検証済み）")
> ```
> 
> #### `m3e.del(nodeId)`
> 
> ノードとその部分木を削除する。ルートノードは削除不可（例外をスロー）。
> 
> ```javascript
> m3e.del(h2)
> ```
> 
> #### `m3e.move(nodeId, newParentId, index?)`
> 
> ノードを別の親の子として再配置する。
> `index` を省略すると末尾に追加。循環する移動は例外をスロー。
> 
> ```javascript
> m3e.move(h1, obs)       // obs の末尾へ
> m3e.move(h1, obs, 0)    // obs の先頭へ
> ```
> 
> #### `m3e.promote(nodeId)` / `m3e.demote(nodeId)`
> 
> 兄弟リスト内で1つ上／下に移動する。
> すでに先頭または末尾の場合は何もしない。
> 
> ```javascript
> m3e.promote(m3e.sel())
> m3e.demote(h1)
> ```
> 
> #### `m3e.clone(nodeId, newParentId?)`
> 
> ノードとその部分木を再帰的に複製し、新しいノード ID を返す。
> `newParentId` を省略すると元のノードと同じ親に追加される。
> 
> 複製時の各フィールドの扱い：
> - `text`, `details`, `note`, `attributes`, `link` はすべて値としてコピーする
> - `id` と `parentId` は新しい値が付与される（元 ID は引き継がない）
> - `link` フィールドに別ノードの ID が含まれていてもそのまま値コピーする（alias 解決は行わない）
> 
> ```javascript
> const copy  = m3e.clone(h1)          // h1 の兄弟として複製
> const copy2 = m3e.clone(h1, obs)     // obs の子として複製
> ```
> 
> ---
> 
> ### 選択・ナビゲーション
> 
> #### `m3e.sel`（プロパティ）
> 
> 現在選択中のノード ID を返す読み取り専用プロパティ。
> 選択を変更するには `m3e.select(id)` を使う。
> 
> ```javascript
> const current = m3e.sel             // 取得（プロパティ）
> ```
> 
> #### `m3e.select(nodeId)`
> 
> 指定したノードを選択する。
> 
> ```javascript
> m3e.select(hypo)
> m3e.select(m3e.root)
> ```
> 
> #### `m3e.nav(direction)`
> 
> ツリー構造上の相対位置へ選択を移動する。
> 
> | direction | 移動先 |
> |-----------|--------|
> | `"parent"` | 親ノード |
> | `"first"` | 最初の子ノード |
> | `"last"` | 最後の子ノード |
> | `"next"` | 次の兄弟ノード |
> | `"prev"` | 前の兄弟ノード |
> 
> ```javascript
> m3e.nav("parent")
> m3e.nav("first")
> m3e.nav("next")
> ```
> 
> ---
> 
> ### 折り畳み
> 
> #### `m3e.collapse(nodeId)` / `m3e.expand(nodeId)` / `m3e.toggle(nodeId)`
> 
> ```javascript
> m3e.collapse(m3e.root)
> m3e.expand(hypo)
> m3e.toggle(m3e.sel())
> ```
> 
> #### `m3e.collapseAll(nodeId?)` / `m3e.expandAll(nodeId?)`
> 
> 指定ノード以下の部分木を一括折り畳み／展開する。
> `nodeId` を省略するとルートから全体が対象。
> 
> ```javascript
> m3e.collapseAll()           // ツリー全体を折り畳む
> m3e.expandAll(hypo)         // hypo 以下をすべて展開
> ```
> 
> ---
> 
> ### 属性・メタデータ
> 
> #### `m3e.set(nodeId, field, value)`
> 
> 拡張フィールドを設定する。
> 
> | field | TreeNode フィールド |
> |-------|-------------------|
> | `"details"` | `details` |
> | `"note"` | `note` |
> | `"link"` | `link` |
> 
> ```javascript
> m3e.set(h1, "note", "先行研究 A, B と整合")
> m3e.set(h1, "link", "https://example.com/paper")
> ```
> 
> #### `m3e.unset(nodeId, field)`
> 
> 拡張フィールドを空文字にクリアする。
> 
> ```javascript
> m3e.unset(h1, "note")
> ```
> 
> #### `m3e.attr(nodeId, key, value)`
> 
> `attributes` マップにキーと値を設定する。
> 
> ```javascript
> m3e.attr(m3e.sel(), "status", "検証中")
> m3e.attr(m3e.sel(), "priority", "高")
> ```
> 
> #### `m3e.attrDel(nodeId, key)`
> 
> `attributes` マップから指定キーを削除する。
> 
> ```javascript
> m3e.attrDel(m3e.sel(), "status")
> ```
> 
> ---
> 
> ### 履歴
> 
> #### `m3e.undo()` / `m3e.redo()`
> 
> 操作を1ステップ巻き戻し／やり直す。
> スタックが空の場合は `false` を返す（例外はスローしない）。モデルは最大 200 件の履歴を保持する。
> 
> ```javascript
> m3e.undo()
> m3e.undo()
> m3e.redo()
> 
> // スタックが空かどうかの確認
> if (!m3e.undo()) console.log("これ以上戻れません")
> ```
> 
> ---
> 
> ### 読み取り・検索
> 
> #### `m3e.info(nodeId?)`
> 
> ノードオブジェクトの深いコピーを返す。
> `nodeId` を省略すると選択中ノードが対象。
> ブラウザコンソールで呼んだ場合は DevTools がオブジェクトを展開表示するため、別途 `console.log` は不要。
> 
> ```javascript
> m3e.info()
> // → { id: "n_1234_abc", text: "仮説 A", note: "...", attributes: { status: "検証中" }, ... }
> 
> const data = m3e.info(h1)
> console.log(data.text)
> ```
> 
> #### `m3e.tree(nodeId?)`
> 
> 指定ノード以下のツリー構造を文字列で返す。
> `nodeId` を省略するとルートから全体。折り畳まれたノードは `[+]` で表示。
> コンソールで確認する場合は `console.log(m3e.tree())` を使う。
> 
> ```javascript
> console.log(m3e.tree())
> // 気候変動と農業生産性
> //   ├─ 観察事実
> //   │   ├─ 収穫量が過去10年で15%減少
> //   │   └─ 降水パターンの変化
> //   └─ 仮説 [+]   ← 折り畳み中
> 
> console.log(m3e.tree(hypo))    // hypo 以下のみ
> const s = m3e.tree()           // 文字列として変数に取ることも可能
> ```
> 
> #### `m3e.find(text)`
> 
> テキストが部分一致する最初のノードの ID を返す。
> 一致なしの場合は `null` を返す（例外をスローしない）。
> 
> ```javascript
> const target = m3e.find("仮説 A")
> if (target) {
>   m3e.sel(target)
>   m3e.focus(target)
> }
> ```
> 
> #### `m3e.findAll(text)`
> 
> テキストが部分一致するすべてのノードの ID 配列を返す。
> 一致なしの場合は空配列 `[]` を返す。
> 
> ```javascript
> const results = m3e.findAll("仮説")
> results.forEach(id => m3e.attr(id, "reviewed", "true"))
> ```
> 
> ---
> 
> ### ビュー操作
> 
> #### `m3e.fit()`
> 
> ツリー全体が画面に収まるようにズーム・パンを調整する。
> 
> #### `m3e.focus(nodeId?)`
> 
> 指定ノードを画面中央に表示する。`nodeId` を省略すると選択中ノードが対象。
> 
> ```javascript
> m3e.focus(hypo)
> m3e.focus()       // 選択中ノードにフォーカス
> ```
> 
> #### `m3e.zoom(factor)`
> 
> ズーム倍率を数値で設定する（例: `0.5`, `1.5`）。
> 
> ```javascript
> m3e.zoom(0.5)
> m3e.zoom(1.5)
> ```
> 
> #### `m3e.zoomReset()`
> 
> ズームを等倍（1.0）に戻す。
> 
> ```javascript
> m3e.zoomReset()
> ```
> 
> #### `m3e.pan(dx, dy)`
> 
> キャンバスを指定ピクセル分パンする。
> 
> ```javascript
> m3e.pan(200, 0)    // 右に 200px
> m3e.pan(0, -100)   // 上に 100px
> ```
> 
> ---
> 
> ### ドキュメント管理
> 
> #### `m3e.new(rootLabel?)`
> 
> ツリーを初期化し新しいドキュメントを開始する。
> 未保存の変更がある場合は `confirm()` で確認する（ユーザーがキャンセルすれば何もしない）。
> 
> ```javascript
> m3e.new()
> m3e.new("新しい研究テーマ")
> ```
> 
> #### `m3e.save(filename?)`
> 
> 現在のツリーを `SavedDoc`（`version: 1`）形式でブラウザダウンロードとして保存する。
> ブラウザ環境のため任意のパスへの書き込みは行わない。`filename` を省略するとデフォルト名（`m3e-export.json`）を使用する。戻り値なし。
> 
> ```javascript
> m3e.save()
> m3e.save("research-2026.json")
> ```
> 
> #### `m3e.load(source)`
> 
> JSON または Freeplane `.mm` を読み込む。
> `source` には以下のいずれかを渡す：
> 
> | 型 | 動作 |
> |----|------|
> | `string`（URL またはサーバー相対パス） | `fetch()` で取得して読み込む |
> | `File` オブジェクト | File API で読み込む（`<input type="file">` からの参照） |
> 
> パスはサーバー起動時のルート（`http://localhost:38482/`）からの相対パス。
> **読み込み後、以前のセッションで使用していた JS 変数（ノード ID）は無効になる。**
> ファイルが見つからない、またはパースに失敗した場合は例外をスロー。
> 
> ```javascript
> m3e.load("data/rapid-sample.json")   // サーバー相対パス
> m3e.load("data/aircraft.mm")
> 
> // File ピッカーから取得した場合
> const [file] = document.querySelector("input").files
> m3e.load(file)
> ```
> 
> #### `m3e.export(format)`
> 
> 現在のツリーを指定フォーマットでブラウザダウンロードとして保存する。
> 
> | format | 出力 | 状態 |
> |--------|------|------|
> | `"json"` | M3E SavedDoc 形式（`save` と同等） | 実装済み相当 |
> | `"mm"` | Freeplane `.mm` 形式 | **未実装（Beta 以降）** |
> 
> ```javascript
> m3e.export("json")
> m3e.export("mm")   // 未実装時は例外をスロー: "mm export is not yet implemented"
> ```
> 
> ---
> 
> ## JS を使うことで解決される点
> 
> カスタム DSL では別途定義が必要だった以下の問題が JS のセマンティクスで自動的に解決される。
> 
> | 問題 | JS での解決 |
> |------|------------|
> | クォート・エスケープ | JS 文字列リテラルのルールをそのまま使う |
> | 空文字列 | `m3e.edit(id, "")` — JS の空文字列として有効 |
> | `find` が null の場合 | `if (target) { ... }` で標準的に対処 |
> | ループ・繰り返し処理 | `for`, `forEach`, `map` など JS ネイティブ |
> | 条件分岐 | `if`, `switch` など JS ネイティブ |
> | `undo` スタック空 | `false` を返す。`if (!m3e.undo())` で確認可能 |
> | 変数一覧 | ブラウザの DevTools で確認 |
> | スクリプトファイルの実行 | JS ファイルをコンソールに貼り付けまたは `<script>` タグで読み込み |
> | 複雑なエラー処理 | `try { ... } catch (e) { ... }` |
> | `sel` getter/setter 兼用の曖昧さ | `m3e.sel`（プロパティ）と `m3e.select(id)`（メソッド）に分離 |
> | `zoom` の型混在 | `m3e.zoom(factor)` は数値のみ、リセットは `m3e.zoomReset()` に分離 |
> | `node()` の書き換え防止 | `structuredClone()` で深いコピーを返す |
> | `info()`/`tree()` の二重出力 | `info()` は戻り値のみ（DevTools が表示）、`tree()` は文字列を返すのみ |
> 
> ---
> 
> ## 追加コマンド
> 
> ### マーク選択（複数ノードへの一括操作）
> 
> 単一選択に加えて、複数ノードをマークし一括操作できる。
> 
> #### `m3e.mark(nodeId)` / `m3e.unmark(nodeId)` / `m3e.clearMarks()`
> 
> ```javascript
> m3e.mark(h1)
> m3e.mark(h2)
> m3e.mark(h3)
> m3e.unmark(h2)         // 解除
> m3e.clearMarks()       // 全解除
> ```
> 
> #### `m3e.marked`（プロパティ）
> 
> マーク済みノード ID の配列を返す（読み取り専用）。
> 
> ```javascript
> // マーク済み全ノードに属性を一括設定
> m3e.marked.forEach(id => m3e.attr(id, "status", "レビュー済み"))
> 
> // マーク済みを全て折り畳む
> m3e.marked.forEach(id => m3e.collapse(id))
> ```
> 
> ---
> 
> ### 構造クエリ
> 
> ツリーの形を数値・配列で問い合わせる。
> 
> #### `m3e.depth(nodeId?)`
> 
> ルートからの深さを返す。省略すると選択中ノードが対象。
> 
> ```javascript
> m3e.depth()            // → 3
> m3e.depth(m3e.root)    // → 0
> ```
> 
> #### `m3e.count(nodeId?)`
> 
> 部分木のノード総数を返す（自身を含む）。省略すると選択中ノードが対象。
> 
> ```javascript
> m3e.count(hypo)        // → 12
> m3e.count(m3e.root)    // → ツリー全体のノード数
> ```
> 
> #### `m3e.leaves(nodeId?)`
> 
> 部分木内の葉ノード（子を持たないノード）の ID 配列を返す。
> 
> ```javascript
> m3e.leaves(hypo).forEach(id => m3e.attr(id, "leaf", "true"))
> ```
> 
> #### `m3e.ancestors(nodeId?)`
> 
> 対象ノードからルートまでの祖先 ID 配列を返す（近い順）。
> 
> ```javascript
> m3e.ancestors()        // → ["parent_id", "grandparent_id", ..., "root_id"]
> ```
> 
> #### `m3e.path(nodeId?)`
> 
> ルートから対象ノードまでの ID パスを返す（遠い順）。
> 
> ```javascript
> m3e.path(m3e.sel)      // → ["root_id", ..., "parent_id", "sel_id"]
> ```
> 
> ---
> 
> ### 検索・置換
> 
> #### `m3e.replaceAll(search, replacement, scopeRootId?)`
> 
> テキストが部分一致するすべてのノードのラベルを置換する。
> `scopeRootId` を省略するとツリー全体が対象。
> 
> ```javascript
> m3e.replaceAll("仮説", "Hypothesis")
> m3e.replaceAll("要検証", "要確認", m3e.active_scope.id)
> 
> // 件数を確認してから実行
> const targets = m3e.findAll("旧用語")
> console.log(`${targets.length} 件置換します`)
> targets.forEach(id => m3e.edit(id, m3e.node(id).text.replace("旧用語", "新用語")))
> ```
> 
> ---
> 
> ### ノードタイプの変更
> 
> #### `m3e.setType(nodeId, type)`
> 
> ノードの type を変更する。
> 
> | type | 意味 |
> |------|------|
> | `"text"` | 通常のテキストノード（デフォルト） |
> | `"folder"` | scope の根になるノード |
> | `"alias"` | 別ノードへの参照 |
> | `"image"` | 画像ノード |
> 
> ```javascript
> m3e.setType(m3e.sel, "folder")     // 現在のノードを scope の根にする
> m3e.active_node.setType("folder")  // 暗黙ターゲット版
> ```
> 
> `"alias"` に変更する場合は参照先 ID も必要（詳細は Scope_and_Alias.md 参照）。
> 
> ---
> 
> ## 組み合わせ例
> 
> ### 研究ツリーの構築
> 
> ```javascript
> m3e.edit(m3e.root, "気候変動と農業生産性")
> 
> const obs  = m3e.add(m3e.root, "観察事実")
> const hypo = m3e.add(m3e.root, "仮説")
> const exp  = m3e.add(m3e.root, "実験計画")
> 
> const o1 = m3e.add(obs, "収穫量が過去10年で15%減少")
> const o2 = m3e.add(obs, "降水パターンの変化")
> m3e.attr(o1, "status", "確認済み")
> m3e.attr(o2, "status", "要検証")
> 
> const h1 = m3e.add(hypo, "温度上昇が主因")
> m3e.set(h1, "note", "先行研究 A, B と整合")
> const h2 = m3e.sibling(h1, "土壌劣化が主因")
> 
> const e1 = m3e.add(exp, "温度と収穫量の相関分析")
> m3e.move(e1, exp, 0)
> 
> m3e.fit()
> m3e.focus(hypo)
> m3e.select(hypo)   // sel はプロパティなので変更は select() を使う
> ```
> 
> ### 検索・一括更新
> 
> ```javascript
> // "仮説" を含む全ノードに reviewed フラグを立てる
> m3e.findAll("仮説").forEach(id => {
>   m3e.attr(id, "reviewed", "true")
>   console.log(m3e.node(id).text, "→ reviewed")
> })
> ```
> 
> ### ツリーの整理
> 
> ```javascript
> m3e.collapseAll()
> m3e.expandAll(hypo)
> 
> m3e.promote(h2)   // 「土壌劣化が主因」を上へ
> 
> const h3 = m3e.clone(h1, hypo)
> m3e.edit(h3, "温度と土壌の複合要因")
> 
> console.log(m3e.tree(hypo))
> ```
> 
> ### 暗黙ターゲットを使った対話的操作
> 
> ```javascript
> // UIで「仮説」ノードを選択した状態でコンソールを開き、そのまま操作する
> 
> // 今選んでいるノードを確認
> m3e.active_node.info()
> 
> // ラベルを直すだけ
> m3e.active_node.edit("仮説（改訂版）")
> 
> // 下の枝を全部展開して構造確認
> m3e.active_branch.expand()
> console.log(m3e.active_branch.tree())
> 
> // この scope にある "要検証" を全部探して属性更新
> m3e.active_scope.findAll("要検証").forEach(id => {
>   m3e.attr(id, "status", "着手待ち")
> })
> 
> // 別の scope に枝ごと移動
> const dest = m3e.find("実験計画")
> m3e.active_branch.move(dest)
> ```
> 
> ---
> 
> ### エラー処理
> 
> ```javascript
> // ノードが見つからない場合の安全な処理
> const target = m3e.find("存在しないノード")
> if (!target) {
>   console.warn("ノードが見つかりませんでした")
> } else {
>   m3e.sel(target)
> }
> 
> // 例外をキャッチして継続
> try {
>   m3e.del(m3e.root)   // ルート削除は例外をスロー
> } catch (e) {
>   console.error(e.message)  // "Root node cannot be deleted."
> }
> ```
> 
> ---
> 
> ## エラー仕様
> 
> | 状況 | 動作 |
> |------|------|
> | 存在しないノード ID を渡す | 例外をスロー: `"Node not found: <id>"` |
> | ルートの削除・再配置 | 例外をスロー |
> | 循環する `move` | 例外をスロー: `"Cycle detected"` |
> | `find` / `findAll` で一致なし | `null` / `[]` を返す（例外なし） |
> | `undo` / `redo` でスタック空 | `false` を返す（例外なし） |
> | `load` でファイルが見つからない | 例外をスロー |
> | `new` で未保存変更あり | `confirm()` でユーザー確認。キャンセルで中断 |
> | `load` 後に古い ID を使用 | 次の操作で `"Node not found"` 例外をスロー |
> | 不正な `index` | 末尾挿入にフォールバック（例外なし） |
> 
> ---
> 
> ## 実装メモ
> 
> - `window.m3e` は `viewer.ts` の初期化完了後に代入する
> - 各メソッドは既存の `RapidMvpModel` のメソッドを薄くラップする
> - ビュー操作（`fit`, `focus`, `zoom`, `pan`）は `viewer.ts` の既存関数を呼び出す
> - `m3e.node(id)` の戻り値は読み取り専用コピー（直接変更しても反映されない）
> 
> ---
> 
> ## 関連文書
> 
> - モデルの操作 API: [../../mvp/src/node/rapid_mvp.ts](../../mvp/src/node/rapid_mvp.ts)
> - 編集設計: [../04_Architecture/Editing_Design.md](../04_Architecture/Editing_Design.md)
> - コマンド操作リファレンス（現 MVP のキー操作）: [../06_Operations/Command_Reference.md](../06_Operations/Command_Reference.md)
> 
> ---
> 
> ### Data_Model.md
> 
> ```
> source: 03_Spec/Data_Model.md
> ```
> 
> # Data Model
> 
> ## 目的
> 
> この文書は、M3E の実体モデルに関する不変条件を定義する。  
> 実装方式や UI に関係なく守るべき制約をここに置く。
> 
> ## 基本要素
> 
> ### Node
> 
> 思考要素の最小単位。型は以下を持つ。
> 
> - `text`
> - `image`
> - `folder`
> - `alias`
> 
> ### Edge
> 
> 主構造を表す親子関係。  
> M3E の骨格は親から子への有向ツリーとする。
> 
> ### Scope
> 
> `folder` を root とする可視性・編集範囲。  
> scope はストレージ単位ではなく認知境界である。
> 
> ## Node の必須属性
> 
> - 永続的な一意 ID
> - node type
> - 親 ID
> - 子 ID の順序列
> - 所属 scope（構造から導出される）
> - 内容
> - 作成時刻
> - 更新時刻
> 
> ## 型ごとの追加属性
> 
> ### text
> 
> - 本文
> 
> ### image
> 
> - 画像参照
> 
> ### folder
> 
> - 下位階層の root として振る舞う識別
> 
> ### alias
> 
> - 参照先 node ID
> 
> ## 不変条件
> 
> ### 一意性
> 
> - 実体ノードは複製しない
> - 参照は alias で行う
> 
> ### ツリー整合性
> 
> - 主構造に循環を作らない
> - 親子順序は安定して管理する
> 
> ### 所属
> 
> - 実体ノードは単一 scope にのみ属する
> - 他 scope から直接共有しない
> 
> ### scope 導出ルール（正規化）
> 
> - `scopeId` はノードに永続化しない
> - ノードの所属 scope は、祖先列で最も近い `folder` ノード ID から導出する
> - 祖先に `folder` が無いノードは document `rootId` に属するとみなす
> - `reparent` 時の scope 変更は `parentId` / `children` 更新のみで表現し、scope のカスケード更新は行わない
> 
> ### alias 制約
> 
> - alias は実体ノードのみを参照できる
> - alias から alias を参照しない
> 
> ## 変更履歴
> 
> - 変更は command として表現できる形にする
> - Undo/Redo を可能にする
> - 将来の差分比較に備える
> 
> ## スキーマ方針
> 
> - 保存形式は version を持つ
> - 破壊的変更には migration を用意する
> - 保存と復元で意味が変わらないことを重視する
> 
> ## 関連文書
> 
> - scope と alias の意味: [./Scope_and_Alias.md](./Scope_and_Alias.md)
> - state分離と schema v2: [./Model_State_And_Schema_V2.md](./Model_State_And_Schema_V2.md)
> - MVC と command: [../04_Architecture/MVC_and_Command.md](../04_Architecture/MVC_and_Command.md)
> - Freeplane への写像: [../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md](../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md)
> 
> ## Edge and Link Separation
> 
> M3E should distinguish `Edge` and `Link` as different concepts.
> 
> ### Edge
> 
> - expresses the primary parent-child tree structure
> - is part of the structural graph
> - participates in layout
> - is always derived from ownership relation
> 
> ### Link
> 
> - expresses non-tree relation between nodes
> - is an overlay relation, not a structural ownership relation
> - does not participate in layout
> - may later support relation type, label, direction, or styling
> 
> ## Graph-level Link 仕様
> 
> ### 目的
> 
> `Link` は tree の外側にある意味関係を表す。
> 
> - 因果
> - 参照
> - 補足
> - 対比
> - 関連
> 
> `Link` は親子の `Edge` を置き換えるものではない。
> 構造は `Edge`、非木関係は `Link` として分離する。
> 
> ### 保存単位
> 
> `Link` は node に埋め込まず、document 全体の relation 集合として持つ。
> 
> ```typescript
> interface AppState {
>   rootId: string
>   nodes: Record<string, TreeNode>
>   links?: Record<string, GraphLink>
> }
> 
> interface GraphLink {
>   id: string
>   sourceNodeId: string
>   targetNodeId: string
>   relationType?: string
>   label?: string
>   direction?: "none" | "forward" | "backward" | "both"
>   style?: "default" | "dashed" | "soft" | "emphasis"
> }
> ```
> 
> Beta では `links` は optional でよい。
> 未実装 viewer と既存 save data を壊さないためである。
> 
> ### 不変条件
> 
> #### 1. endpoint の存在
> 
> - `sourceNodeId` と `targetNodeId` は、保存時点で実在ノードを指す必要がある
> - どちらかが欠けた `Link` は broken relation として保存しない
> 
> #### 2. alias endpoint
> 
> - `Link` の endpoint は実体ノードを既定対象とする
> - alias ノードを endpoint として許可するかは Beta では保留とする
> - Beta 実装の既定は「alias endpoint を禁止」でよい
> 
> #### 3. self link
> 
> - `sourceNodeId === targetNodeId` の self link は既定では禁止する
> - 特殊用途が必要になった時だけ再検討する
> 
> #### 4. layout 非参加
> 
> - `Link` は node 座標決定に影響しない
> - `Link` の追加・削除だけで subtree placement を変えない
> 
> #### 5. ownership 非参加
> 
> - `Link` は所有権や親子順序を変えない
> - `Link` は `scope` 所属決定の根拠に使わない
> - `Link` は delete / reparent / alias 規則を上書きしない
> 
> ### node-level `link` との分離
> 
> - `TreeNode.link` は URL や外部参照などの node 属性である
> - `GraphLink` は node 間の relation line である
> - 名前が似ていても、保存場所・意味・描画方法は別である
> 
> ### 操作単位
> 
> 将来の command 層では、少なくとも以下を分けて持つ。
> 
> - `createLink`
> - `updateLink`
> - `deleteLink`
> 
> node 編集 command と混在させない。
> 
> ### delete / move 時の扱い
> 
> #### node delete
> 
> - endpoint node が削除されたら、接続している `Link` は同時に削除する
> - broken endpoint を持つ `Link` を残さない
> 
> #### node move / reparent
> 
> - `Link` は endpoint の ID 参照を維持する
> - node が別親や別 scope に移動しても `Link` 自体は消えない
> - ただし viewer は scope 表示ポリシーに応じて非表示にしてよい
> 
> ### Beta 実装で先に固定すること
> 
> - `AppState.links` を relation 集合として持てるようにする
> - endpoint は実体ノードのみを対象とする
> - self link は禁止する
> - layout 非参加を前提に overlay 描画とする
> - node-level `link` と graph-level `Link` を絶対に混同しない
> 
> ### Beta 実装でまだ保留にすること
> 
> - relationType の語彙セット
> - link label の編集 UI
> - arrowhead と direction の表示仕様
> - cross-scope link をどこまで常時表示するか
> - alias endpoint を許可するか
> - `.mm` import/export への写像
> 
> ### Important Note
> 
> Freeplane-imported node-level `link` values and future graph-level `Link` relations are not the same thing.
> 
> - node-level `link`: external or attached link stored on a node
> - graph-level `Link`: relation line between nodes inside the map
> 
> These must remain separate in model design.
> 
> ## データベース選定方針
> 
> ### 現時点の結論
> 
> Rapid MVP では、SQLite を persistence layer として採用する。
> 
> 優先順位は以下とする。
> 
> 1. 論理正本は JSON document model とする
> 2. Rapid MVP の永続化実装は SQLite とする
> 3. `.mm` は import/export 互換フォーマットとして維持する
> 4. PostgreSQL はサーバー要件が固まった段階で再評価する
> 
> ### なぜ SQLite を採るか
> 
> MVP の主目的は以下である。
> 
> - viewer/editor を素早く成立させる
> - save/load の境界を安定させる
> - Freeplane `.mm` との往復可能性を保つ
> - ローカルで壊れずに編集できることを優先する
> 
> SQLite は上記目的に対して、実装コストと運用コストを抑えつつ必要な永続化を提供できる。
> 
> - ローカル前提で完結できる
> - デモ手順を単純化できる
> - save/load デバッグがしやすい
> - 将来の migration に備えた version 管理と相性が良い
> 
> ### なぜ今は PostgreSQL を採らないか
> 
> Rapid MVP の現状課題は DB スケールではなく、編集体験・保存境界・表示安定性にある。
> この段階で PostgreSQL のようなサーバー DB を先に入れると、以下の負債が増える。
> 
> - バックエンド実装
> - 認証と接続管理
> - マイグレーション運用
> - 起動手順とデモ手順の複雑化
> - 保存失敗時の原因切り分けの増加
> 
> ### JSON を正本にする理由
> 
> - 現在の model は木構造であり、JSON で素直に表現できる
> - `.mm` import/export と対応づけやすい
> - デバッグ時に内容を直接読める
> - 差分確認と fixture 化がしやすい
> - migration を version フィールドで段階的に扱いやすい
> 
> 特に MVP では、「保存内容を人間が読める」「壊れた時にすぐ確認できる」ことを重視する。
> 
> ### PostgreSQL の再評価条件
> 
> - 複数端末同期が MVP 範囲に入る
> - 共有編集またはユーザー単位の保存が必要になる
> - 履歴、監査、検索をサーバー側で持つ必要が出る
> - map がローカルファイル運用では扱いにくい規模になる
> - バックアップ、復元、権限制御がプロダクト要件になる
> 
> ### 将来 DB 導入時の第一候補
> 
> 将来サーバー導入が必要になった場合の第一候補は PostgreSQL とする。
> 
> 理由:
> 
> - 汎用性が高い
> - JSONB を併用しやすい
> - 関係データと半構造化データの両方を扱いやすい
> - 将来の履歴、監査、共有機能に発展させやすい
> 
> ただしこれは「MVP 今すぐ採用」ではなく、「サーバー導入が必要になった時の有力候補」である。
> 
> ---
> 
> ### Import_Export.md
> 
> ```
> source: 03_Spec/Import_Export.md
> ```
> 
> # Import / Export 仕様
> 
> > **MVP 対応状況を含む。** 未実装のものは「未実装」と明記する。
> 
> ---
> 
> ## 全体方針
> 
> - M3E の正本は **SavedDoc JSON**（`version: 1`）とする
> - 外部フォーマットは「入口・出口」であり、正本には常に M3E 形式に変換してから取り込む
> - ラウンドトリップ（M3E → 外部 → M3E）で意味が保たれることを重視する
> - 外部フォーマットで表現できない M3E 固有の概念（scope・alias 等）は、エクスポート時に落とすか属性として退避する
> 
> ---
> 
> ## フォーマット一覧
> 
> | フォーマット | Import | Export | 状態 |
> |-------------|--------|--------|------|
> | M3E SavedDoc JSON | ✅ | ✅ | 実装済み |
> | SQLite（内部永続化） | ✅ | ✅ | 実装済み |
> | Freeplane `.mm` | ✅ | ❌ | Import のみ実装済み |
> | インデントテキスト | ❌ | ❌ | 未実装（将来対応候補） |
> | Markdown | ❌ | ❌ | 未実装（将来対応候補） |
> 
> ---
> 
> ## 内部フォーマット
> 
> ### SavedDoc JSON（`version: 1`）
> 
> M3E の正本フォーマット。ファイル保存・ブラウザダウンロード・SQLite 内部保存に使用する。
> 
> **スキーマ:**
> 
> ```typescript
> interface SavedDoc {
>   version: 1
>   savedAt: string        // ISO 8601 タイムスタンプ
>   state: AppState
> }
> 
> interface AppState {
>   rootId: string
>   selectedId?: string
>   nodes: Record<string, TreeNode>
>   links?: Record<string, GraphLink>
> }
> 
> interface TreeNode {
>   id: string
>   parentId: string | null
>   children: string[]     // 順序付き子 ID 配列
>   text: string
>   collapsed: boolean     // 折り畳み状態。PersistedDocument の一部として保存する
>   details: string
>   note: string
>   attributes: Record<string, string>
>   link: string
> }
> 
> interface GraphLink {
>   id: string
>   sourceNodeId: string
>   targetNodeId: string
>   relationType?: string
>   label?: string
>   direction?: "none" | "forward" | "backward" | "both"
>   style?: "default" | "dashed" | "soft" | "emphasis"
> }
> ```
> 
> **保存・読み込みの動作:**
> 
> | 操作 | 動作 |
> |------|------|
> | ブラウザダウンロード | pretty-print JSON、ファイル名 `rapid-edited.json`（固定） |
> | Node.js ファイル書き出し | `fs.writeFileSync` でUTF-8 pretty-print |
> | 読み込み | `version === 1` と `state` の存在を検証後、モデル不変条件を再検証 |
> 
> **既知の制限:**
> - ダウンロードファイル名が `rapid-edited.json` 固定（未改善）
> - `selectedId` は保存されるが、読み込み後に UI に反映されるかは実装依存
> - `links` は仕様追加済みだが Beta viewer/save-load では未実装
> 
> ### Graph-level `Link` の保存方針
> 
> - `AppState.links` は graph-level relation line の保存先とする
> - `TreeNode.link` は node-level の外部リンク属性として残す
> - 両者を相互変換しない
> 
> **保存制約:**
> 
> - `sourceNodeId` / `targetNodeId` は実在ノードを指す必要がある
> - self link は保存しない
> - alias endpoint は Beta では未対応として保存拒否でよい
> - node delete 時に endpoint を失う `Link` は同時削除する
> 
> ---
> 
> ### SQLite 内部永続化
> 
> `rapid-mvp.sqlite` に SavedDoc の JSON を列として格納する。
> ファイル保存の代替ではなく、ブラウザリロード後も状態を維持するための層。
> 
> **スキーマ:**
> 
> ```sql
> CREATE TABLE documents (
>   id       TEXT PRIMARY KEY,
>   version  INTEGER NOT NULL,
>   saved_at TEXT NOT NULL,
>   state_json TEXT NOT NULL
> )
> ```
> 
> **動作:**
> - 保存: `INSERT ... ON CONFLICT DO UPDATE`（UPSERT）で冪等
> - 読み込み: `state_json` をパースし、SavedDoc と同じ検証を適用
> - JSON 形式は SavedDoc の `state` フィールドと同一
> 
> **データファイルの場所:** `mvp/data/rapid-mvp.sqlite`（`.gitignore` で除外）
> 
> ---
> 
> ## 外部フォーマット
> 
> ### Freeplane `.mm`（Import のみ実装済み）
> 
> Freeplane の XML ベースのマインドマップ形式。
> 
> #### Import
> 
> **パース対象フィールド:**
> 
> | `.mm` の要素 | M3E の `TreeNode` フィールド | 備考 |
> |-------------|---------------------------|------|
> | `node TEXT` 属性 | `text` | 主テキスト |
> | `node FOLDED` 属性 | `collapsed` | `"true"` → `true` |
> | `node LINK` 属性 | `link` | 外部リンク URL |
> | `richcontent TYPE="NODE"` | `text` | TEXT 属性がない場合のフォールバック |
> | `richcontent TYPE="DETAILS"` | `details` | 詳細テキスト |
> | `richcontent TYPE="NOTE"` | `note` | ノートテキスト |
> | `attribute NAME VALUE` | `attributes[NAME]` | 任意キーバリュー |
> | 子 `node` 要素 | `children`（再帰） | 順序を維持 |
> 
> **取り込まれないフィールド:**
> 
> | `.mm` の要素 | 理由 |
> |-------------|------|
> | スタイル・色・フォント | M3E は独自スタイルを持つ |
> | `CREATED` / `MODIFIED` | M3E の ID に埋め込み済み（`n_<timestamp>_<rand>`） |
> | アイコン | 未対応 |
> | クラウド装飾 | 未対応 |
> | エッジ形状 | 未対応 |
> 
> **取り込み後の ID 生成:**
> - Freeplane の元 ID は使用しない
> - M3E の `n_<timestamp>_<random>` 形式で新規 ID を生成する
> - `savedAt` はパース実行時のタイムスタンプを使用
> 
> #### Export（未実装）
> 
> M3E → `.mm` のエクスポートは未実装。以下は将来の設計方針。
> 
> **M3E → `.mm` フィールドマッピング（設計案）:**
> 
> | M3E `TreeNode` フィールド | `.mm` の要素 | 備考 |
> |--------------------------|-------------|------|
> | `text` | `node TEXT` 属性 | |
> | `collapsed` | `node FOLDED` 属性 | |
> | `link` | `node LINK` 属性 | |
> | `details` | `richcontent TYPE="DETAILS"` | |
> | `note` | `richcontent TYPE="NOTE"` | |
> | `attributes` | `attribute` 要素群 | |
> | `children` 順序 | 子 `node` 要素の順序 | |
> 
> **M3E 固有概念の退避:**
> 
> | M3E の概念 | `.mm` への退避方法 |
> |------------|-----------------|
> | ノード type（`folder` 等） | `attribute NAME="m3e:type"` |
> | alias の参照先 | `attribute NAME="m3e:alias-ref"` |
> | scope 境界 | `folder` 型ノードは Freeplane のクラウドで表現（検討中） |
> | graph-level `Link` | 未定義（Beta では未実装） |
> 
> ---
> 
> ## ラウンドトリップ保証
> 
> ### M3E JSON → M3E JSON
> 
> すべてのフィールドが保持される。完全なラウンドトリップを保証する。
> 
> ### Freeplane `.mm` → M3E JSON → Freeplane `.mm`
> 
> | フィールド | 往復後の状態 |
> |-----------|------------|
> | テキスト・構造 | 保持される |
> | 折り畳み状態 | 保持される |
> | details / note / attributes / link | 保持される |
> | 元の Freeplane スタイル・色 | **失われる**（Import 時に破棄） |
> | 元の Freeplane ノード ID | **失われる**（M3E ID に置き換え） |
> 
> ---
> 
> ## 将来対応候補
> 
> Linear <-> Tree 変換の詳細方針は `Linear_Tree_Conversion.md` を参照。
> 
> ### インデントテキスト Import
> 
> ```
> 研究テーマ
>   観察事実
>     収穫量が15%減少
>     降水パターン変化
>   仮説
>     温度上昇が主因
> ```
> 
> 貼り付けから直接ツリーを構築できる。`m3e.paste(text)` コマンドと連動。
> 
> ### Markdown Import / Export
> 
> 見出し階層（`#` `##` `###`）をツリー構造にマッピングする。
> テキストノードのみ対応。`details` / `note` は Markdown のコードブロックや引用で退避する方向で検討。
> 
> ---
> 
> ## 関連文書
> 
> - データモデル不変条件: [./Data_Model.md](./Data_Model.md)
> - Linear <-> Tree 変換仕様: [./Linear_Tree_Conversion.md](./Linear_Tree_Conversion.md)
> - Freeplane マッピング方針: [../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md](../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md)
> - カスタムエンジン採択: [../09_Decisions/ADR_003_Freeplane_Informed_Custom_Engine.md](../09_Decisions/ADR_003_Freeplane_Informed_Custom_Engine.md)
> - SQLite 採択: [../09_Decisions/ADR_004_SQLite_For_Rapid_MVP.md](../09_Decisions/ADR_004_SQLite_For_Rapid_MVP.md)
> - コマンド API: [./Command_Language.md](./Command_Language.md)
> 
> ---
> 
> ### Linear_Tree_Conversion.md
> 
> ```
> source: 03_Spec/Linear_Tree_Conversion.md
> ```
> 
> # Linear <-> Tree 変換仕様（Draft）
> 
> ## 目的
> 
> M3E の主構造（Tree）と線形表現（Linear）を相互に変換し、
> 思考入力の速度と構造整合性を両立する。
> 
> 本仕様は、`Core_Principles.md` の以下と整合する。
> 
> - 主構造は親子（Tree）を維持する
> - scope は認知境界として扱う
> - 実体は単一、見え方を複数にする
> 
> ## 用語
> 
> - Tree: `AppState` の親子構造
> - Linear（リニアテキスト）: テキスト中心の一次元表現
> - Scope Root: 変換の起点ノード（通常は `currentScopeId`）
> 
> ## 設計方針
> 
> 1. 正本は常に Tree とする。
> 2. Linear は入力・出力インターフェースとして扱う。
> 3. 変換の既定単位は scope（全体ではなく部分木）とする。
> 4. 失敗時は fail-closed（曖昧な入力は拒否または明示警告）とする。
> 
> ## 対象フォーマット
> 
> ### L1: インデントテキスト（可逆優先）
> 
> 例:
> 
> ```text
> 研究テーマ
>   観察
>     収穫量低下
>   仮説
>     温度上昇
> ```
> 
> - 先頭空白数で depth を表現
> - 既定インデント幅は 2
> - 同 depth の行順は siblings 順に一致させる
> 
> ### L2: Markdown 見出し/箇条書き（準可逆）
> 
> 例:
> 
> ```markdown
> # 研究テーマ
> ## 観察
> - 収穫量低下
> ## 仮説
> - 温度上昇
> ```
> 
> - `#` 階層またはリスト階層から depth を推定
> - 混在入力は正規化ルールに従う
> 
> ## 変換ルール
> 
> ### Tree -> Linear
> 
> 1. `scopeRootId` を起点に pre-order で走査する。
> 2. 各ノードを `depth` と `text` に射影する。
> 3. `nodeType`, `alias`, `broken` などは必要時に注記トークンで出力する。
> 
> 注記例:
> 
> - alias: `[@alias -> <targetId>]`
> - broken alias: `[@alias broken]`
> 
> ### Linear -> Tree
> 
> 1. 各行を `depth`, `label`, `annotations` に分解する。
> 2. depth スタックで親子関係を復元する。
> 3. depth の飛び越し（例: 0 -> 3）は不正入力として reject する。
> 4. 復元後に model validator を必ず通す。
> 
> ## 可逆性レベル
> 
> - Level A（可逆）
>   - `text`, 親子構造, sibling 順序
> - Level B（条件付き可逆）
>   - `nodeType`, alias 情報（注記トークンを使う場合）
> - Level C（非可逆）
>   - `details`, `note`, `attributes`, ViewState（collapsed など）
> 
> `details` など非可逆情報がある場合、エクスポート時に件数警告を表示する。
> 
> ## Scope との整合
> 
> - 既定変換範囲は `currentScopeId` の部分木。
> - 全体変換は明示オプション指定時のみ。
> - scope 外ノードは既定で出力しない。
> 
> ## UI 統合（Rapid）
> 
> - リニアテキストはマップと同じ表示空間に配置する（分離タブ/別画面にしない）。
> - 現行実装（dev-beta）は 2 ペイン構成（左: Tree ビュー、右: リニアテキストボックス）。
> - Tree でノード選択したとき、リニアテキスト側の対応行を同期する。
> - リニアテキスト側で行選択したとき、Tree 側の対応ノードを選択する。
> - リニアテキスト側の編集は即時反映せず、`Apply` 実行時に一括変換する。
> - 変換失敗時は部分適用せず、エラーを表示して中断する。
> 
> ## エラー仕様
> 
> - 不正インデント: `InvalidIndentation`
> - depth 飛び越し: `InvalidDepthTransition`
> - 空ラベル行: `EmptyLabel`
> - alias 注記不正: `InvalidAliasAnnotation`
> 
> ## MVP 実装順
> 
> 1. L1 Export（Tree -> インデントテキスト）
> 2. L1 Import（インデントテキスト -> Tree）
> 3. L2 Export（Tree -> Markdown）
> 4. L2 Import（Markdown -> Tree）
> 
> ## コマンド API 案
> 
> - `m3e.export("indent")`
> - `m3e.import("indent", text)`
> - `m3e.export("markdown")`
> - `m3e.import("markdown", text)`
> 
> ## 受け入れ基準
> 
> 1. L1 で `Tree -> Linear -> Tree` の round-trip が構造同値になる。
> 2. scope 指定時に scope 外ノードが混入しない。
> 3. 不正入力が fail-closed で停止し、部分適用しない。
> 
> ## 関連文書
> 
> - `./Data_Model.md`
> - `./Import_Export.md`
> - `./Scope_and_Alias.md`
> - `../01_Vision/Core_Principles.md`
> ---
> 
> ### Model_State_And_Schema_V2.md
> 
> ```
> source: 03_Spec/Model_State_And_Schema_V2.md
> ```
> 
> # Model State 分離と Schema v2 仕様
> 
> ## 目的
> 
> 本仕様は以下を明確化する。
> 
> 1. Persisted document state と ViewState の分離境界
> 2. Model 側の必須項目（MUST）
> 3. v1 -> v2 のスキーマ変更と migration 方針
> 
> 対象は Beta の model 層であり、Final 固有の運用要件は含めない。
> 
> ---
> 
> ## 1. State 分離（詳細）
> 
> ### 1.1 基本方針
> 
> - 永続化対象は `PersistedDocument` のみとする。
> - 画面操作に依存する状態は `ViewState` として分離する。
> - SQLite / JSON に保存するのは `PersistedDocument` のみ。
> 
> ### 1.2 PersistedDocument（保存対象）
> 
> `PersistedDocument` はドメイン正本であり、次を含む。
> 
> - `version`
> - `rootId`
> - `nodes`
> - （将来）`scopes`
> - （将来）`aliases`
> - `meta`（作成・更新時刻など）
> 
> ### 1.3 ViewState（非保存対象）
> 
> `ViewState` はセッション状態であり、次を含む。
> 
> - `selectedNodeId`
> - `viewport`（pan/zoom）
> - `dragState`
> - `hoverState`
> - `inlineEditorState`
> 
> ### 1.4 境界ルール
> 
> - Model API は `PersistedDocument` を入出力する。
> - Viewer 側は `PersistedDocument + ViewState` を合成して描画する。
> - Undo/Redo は `PersistedDocument` の差分のみを対象とする。
> - `ViewState` は保存/復元の正当性判定に使わない。
> 
> ---
> 
> ## 2. 必須項目（MUST）
> 
> ### 2.1 Document Top-level MUST
> 
> - `version: number`
> - `rootId: string`
> - `nodes: Record<string, Node>`
> - `meta.createdAt: string (ISO8601)`
> - `meta.updatedAt: string (ISO8601)`
> 
> ### 2.2 Node MUST
> 
> - `id: string`（永続一意）
> - `type: "text" | "image" | "folder" | "alias"`
> - `parentId: string | null`
> - `children: string[]`（順序意味あり）
> - `collapsed: boolean`（折り畳み状態。ドキュメントに保存する）
> - `content: object`（型ごとに構造を定義）
> - `createdAt: string (ISO8601)`
> - `updatedAt: string (ISO8601)`
> 
> 補足:
> 
> - `scopeId` は保存しない
> - ノードの所属 scope は親子構造から導出する
> 
> ### 2.3 型別 MUST
> 
> - `text`: `content.text: string`
> - `image`: `content.imageRef: string`
> - `folder`: `content.title: string`
> - `alias`: `content.targetNodeId: string`
> 
> ### 2.4 整合性 MUST
> 
> - `rootId` は `nodes` に存在する。
> - すべての `children[]` は実在ノードを参照する。
> - `parentId` と `children[]` は相互整合する。
> - 主構造に cycle を作らない。
> - 全ノードが root から到達可能である。
> - alias は実体ノードのみを参照する（alias -> alias 禁止）。
> - 実体ノードは単一 scope にのみ所属する。
> 
> ### 2.5 Scope 導出 MUST
> 
> - ノード所属 scope は `folder` 境界を使って導出する。
> - 導出値は「自分自身を含む祖先列で最も近い `folder` ノード ID」とする。
> - 祖先に `folder` が無い場合は document `rootId` を scope root とみなす。
> - `reparent` 後に scope が変わるノードがあっても、永続データ更新は `parentId` / `children` のみでよい（scope は再導出されるため）。
> 
> ---
> 
> ## 3. Schema v2 設計
> 
> ### 3.1 v1 との差分
> 
> v1 は以下が不足している。
> 
> - `type`
> - `createdAt` / `updatedAt`
> - `meta`（documentレベル）
> - `content` の型分離（現在は text/details/note/link 併置）
> 
> v2 では MUST 項目を満たす構造へ移行する。
> 
> ### 3.2 v2 形式（例）
> 
> ```json
> {
>   "version": 2,
>   "rootId": "n_root",
>   "meta": {
>     "createdAt": "2026-04-01T10:00:00.000Z",
>     "updatedAt": "2026-04-01T10:00:00.000Z"
>   },
>   "nodes": {
>     "n_root": {
>       "id": "n_root",
>       "type": "text",
>       "parentId": null,
>       "children": ["n_a"],
>       "content": { "text": "Root" },
>       "createdAt": "2026-04-01T10:00:00.000Z",
>       "updatedAt": "2026-04-01T10:00:00.000Z"
>     }
>   }
> }
> ```
> 
> ### 3.3 migration 方針
> 
> - 読み込み時に `version` を必ず判定する。
> - `version === 1` の場合のみ `migrateV1ToV2()` を適用する。
> - migration 後に `validateV2()` を実行し、失敗時は reject する。
> 
> ### 3.4 v1 -> v2 変換ルール
> 
> - `type` が無いノードは `"text"` を付与
> - `scopeId` が存在しても保存対象から除外（破棄）
> - `createdAt/updatedAt` は migration 時刻で埋める
> - 既存 `text/details/note/link/attributes` は `content` へ再配置
> - document-level `meta` を新規生成
> 
> ### 3.5 後方互換ポリシー
> 
> - 読み込み対応: v1, v2
> - 書き込み形式: v2 のみ
> - v1 の再出力は行わない
> 
> ### 3.6 テスト要件
> 
> - v1 fixture を v2 に migration できる
> - migration 後 `validateV2()` が pass する
> - round-trip（save/load）で意味が不変
> - 異常系（欠損/循環/不正alias）を reject する
> 
> ---
> 
> ## 4. 実装タスク（Model）
> 
> 1. `PersistedDocumentV2` 型定義を追加
> 2. `ViewState` を model 永続化対象から分離
> 3. `validateV2()` を追加
> 4. `migrateV1ToV2()` を追加
> 5. save は常に v2 を出力
> 6. v1/v2 fixture で unit test を追加
> 
> ---
> 
> ### Scope_Transition.md
> 
> ```
> source: 03_Spec/Scope_Transition.md
> ```
> 
> # Scope 遷移仕様
> 
> 最終更新: 2026-04-01
> 
> ---
> 
> ## 概要
> 
> Scope 遷移とは、ユーザーが現在の「folder world」から別の folder world に入り、また戻る操作のことである。
> 現在スコープ（`currentScopeId`）を切り替えることで、表示・編集の対象が切り替わる。
> 
> ---
> 
> ## 状態定義
> 
> ### ViewState に追加する項目
> 
> ```ts
> currentScopeId: string   // 現在表示しているスコープの rootFolder ノード ID
>                          // ルート（最上位）の場合は固定値 "root"
> scopeHistory: string[]   // 遷移履歴（戻るために使用）。末尾が直前のスコープ
> ```
> 
> - `currentScopeId` は `PersistedDocument` に含めない（ViewState のみ）
> - 再起動後も復元できるよう、`ViewState` のセッション保存対象に含める
> 
> ---
> 
> ## 遷移トリガー
> 
> | 操作 | 遷移先 |
> |------|--------|
> | folder ノードを **ダブルクリック** | その folder のスコープへ入る |
> | ブレッドクラムの項目をクリック | その祖先スコープへ戻る |
> | キーボード `Alt+Enter`（folder 選択中） | その folder のスコープへ入る |
> | キーボード `Backspace`（ノード非編集中） | 親スコープへ戻る |
> | ツールバーの「← 戻る」ボタン | 直前のスコープへ戻る |
> 
> ### 注意
> 
> - folder に「入る」操作と、ノードを「編集開始する」操作（`F2` / 通常ダブルクリック）は区別する
> - folder ノードの場合: **ダブルクリック = スコープ遷移**（編集開始は `F2` のみ）
> - text ノードの場合: **ダブルクリック = 編集開始**（変更なし）
> 
> ---
> 
> ## 遷移時の処理
> 
> ### 入る（EnterScopeCommand）
> 
> ```
> 1. scopeHistory に現在の currentScopeId を push
> 2. currentScopeId を対象 folder のノード ID に更新
> 3. viewport を初期位置にリセット（fit-to-content）
> 4. 選択状態をクリア
> 5. 表示ノードを新スコープ以下に絞り込む
> ```
> 
> **Command の位置づけ:**
> ViewState の変更のみであり、PersistedDocument は変更しない。
> Undo/Redo の対象外とする（scopeHistory で独自に管理する）。
> 
> ### 戻る（ExitScopeCommand）
> 
> ```
> 1. scopeHistory が空なら何もしない（最上位スコープ）
> 2. scopeHistory から末尾を pop
> 3. currentScopeId を取り出した値に更新
> 4. viewport を前回の位置に戻す（ViewState に保存していれば）
> 5. 元のスコープで選択していたノードを復元する（ViewState に保存していれば）
> ```
> 
> ---
> 
> ## 表示ルール
> 
> ### 現在スコープ内のノード
> 
> - `currentScopeId` の folder 以下のノードをすべて表示する
> - その folder ノード自体はルートとして表示する（ノードラベルは表示する）
> 
> ### スコープ外ノードの扱い
> 
> - 現在スコープ外の実体ノードは表示しない
> - 現在スコープ内に alias があれば、その alias は表示する（参照先が外部スコープでも可）
> - alias は視覚的に区別する（→ alias 描画仕様参照）
> 
> ### 最上位スコープ
> 
> - `currentScopeId === "root"` のとき、全ノードのうち最上位のツリーを表示する
> - 未所属ノードは表示しない
> 
> ---
> 
> ## ブレッドクラム
> 
> ブレッドクラムは現在のスコープ階層を示す。
> 
> ```
> [ルート] > [研究テーマA] > [仮説グループ1]
> ```
> 
> - 各項目はクリック可能で、そのスコープに直接ジャンプする
> - ジャンプ時は途中のスコープを scopeHistory に積む
> - 現在スコープは末尾に表示し、クリック不可とする
> 
> ### 配置
> 
> ツールバー上部または viewer 上端に固定表示する。スコープ深度が増えても省略せず表示する（折り返し可）。
> 
> ---
> 
> ## キーボード操作まとめ
> 
> | キー | 条件 | 動作 |
> |------|------|------|
> | `Alt+Enter` | folder ノード選択中 | スコープに入る |
> | `→` | folder ノード選択中 | スコープに入る |
> | `←` | 現在スコープの root ノード選択中 | 親スコープへ戻る |
> | `Backspace` | ノード非編集中 かつ現在スコープの root ノード選択中 | 親スコープへ戻る |
> | `Escape` | スコープ内 | 何もしない（スコープ遷移には使わない） |
> 
> ---
> 
> ## alias の表示（スコープ遷移との関係）
> 
> - alias ノードをダブルクリックしてもスコープ遷移は発生しない
> - alias の参照先が folder であっても、そのスコープへの自動遷移は行わない
> - alias から参照先スコープへ移動するには、別途「参照先を開く」操作（右クリックメニュー等）を使う
>   （→ 将来実装。Phase 1 では alias のクリック動作は「参照先ノードへジャンプ」に留める）
> 
> ---
> 
> ## ViewState の保存・復元
> 
> 再起動後も以下を復元する。
> 
> | 項目 | 保存先 |
> |------|--------|
> | `currentScopeId` | ViewState セッション保存 |
> | `scopeHistory` | ViewState セッション保存 |
> | 各スコープの viewport（pan/zoom） | ViewState セッション保存（スコープ ID をキーに Map で管理） |
> | 各スコープの選択ノード | 復元しない（遷移時にクリア） |
> 
> ---
> 
> ## エラー・エッジケース
> 
> | ケース | 対応 |
> |--------|------|
> | `currentScopeId` のノードが削除された | `"root"` にフォールバック |
> | `scopeHistory` 内のノードが削除された | その項目をスキップしてさらに戻る |
> | 循環参照（alias から自分のスコープへ） | 遷移を許可しない（入口でチェック） |
> | 最上位スコープで「戻る」 | 何もしない（戻るボタンを無効化表示） |
> 
> ---
> 
> ## 実装フェーズ
> 
> ### Phase 1（今回実装）
> 
> - [ ] `currentScopeId` / `scopeHistory` を ViewState に追加
> - [ ] folder ノードのダブルクリックで `EnterScope`
> - [ ] ツールバー「← 戻る」ボタンで `ExitScope`
> - [ ] ブレッドクラム表示（クリックで直接ジャンプ）
> - [ ] スコープ外ノードの非表示
> - [ ] `Alt+Enter` / `Backspace` キーバインド
> - [ ] ViewState のセッション保存・復元（`currentScopeId`）
> 
> ### Phase 2（後続）
> 
> - [ ] 各スコープの viewport を個別保存・復元
> - [ ] alias の「参照先を開く」操作
> - [ ] スコープ間 alias 表示の整合（rename/delete 時）
> - [ ] 全体俯瞰ビュー（スコープを折りたたんで表示）
> 
> ---
> 
> ## 関連文書
> 
> - Scope/Alias 原則: [Scope_and_Alias.md](Scope_and_Alias.md)
> - Data Model: [Data_Model.md](Data_Model.md)
> - MVC and Command: [../04_Architecture/MVC_and_Command.md](../04_Architecture/MVC_and_Command.md)
> - Editing Design: [../04_Architecture/Editing_Design.md](../04_Architecture/Editing_Design.md)
> - Model State/Schema v2: [Model_State_And_Schema_V2.md](Model_State_And_Schema_V2.md)
> 
> ---
> 
> ### Scope_and_Alias.md
> 
> ```
> source: 03_Spec/Scope_and_Alias.md
> ```
> 
> # Scope and Alias
> 
> ## 目的
> 
> この文書は、M3E の `scope` と `alias` を Beta 実装で扱える粒度まで定義する。
> 
> - `scope` は認知境界と編集境界を与える
> - `alias` は実体複製なしで他 scope のノードを見せる
> - Freeplane 由来の tree だけでは表せない M3E 固有意味をここで固定する
> 
> ## なぜ scope が必要か
> 
> ファイルやタブの開閉だけでは、思考対象の境界をうまく制御できない。  
> M3E は storage boundary ではなく cognition boundary を扱うために scope を導入する。
> 
> ## Scope の定義
> 
> scope は「どこまでを 1 つの局所世界として見るか」を定める単位である。
> 
> - `folder` は子 scope の入口ノードである
> - document root の直下には暗黙の root scope がある
> - 各実体ノードはちょうど 1 つの scope に属する
> 
> scope は以下を制御する。
> 
> - 何が見えるか
> - どこまで編集できるか
> - どの構造を同時に考えるか
> 
> ## Scope の決定規則
> 
> ### 1. root scope
> 
> - document 全体に 1 つだけ存在する暗黙 scope
> - どの `folder` 配下にも入っていない実体ノードは root scope 所属とみなす
> 
> ### 2. folder scope
> 
> - `folder` ノード 1 つにつき子 scope を 1 つ作る
> - `folder` ノード自身は親 scope に属する
> - `folder` の直下以下の子孫実体は、その `folder` scope に属する
> - ただし子孫に別の `folder` が現れた時点で、その下はさらに内側の scope へ切り替わる
> 
> ### 3. 所属の一意性
> 
> - 実体ノードは複数 scope に同時所属しない
> - ある scope から別 scope へ見せたいときは移動ではなく `alias` を置く
> 
> ## Scope の原則
> 
> ### 閉包性
> 
> - 原則として scope 内で思考を完結させる
> - 外部の情報は既定で露出しない
> 
> ### 局所性
> 
> - 日常操作は現在 scope に最適化する
> - 全体俯瞰は要約された形で扱う
> 
> ### 往復可能性
> 
> - folder を開くとその folder world に入る
> - 戻る操作で迷子にならないことを重視する
> 
> ## Scope の可視・編集ルール
> 
> ### 通常表示
> 
> - 現在 scope の実体ノードを主表示対象にする
> - 親 scope の情報は breadcrumb や入口ノードなど要約導線としてのみ見せる
> - 他 scope の実体は常時フル表示しない
> 
> ### 編集
> 
> - 直接編集できるのは現在 scope 内の実体ノードと、その scope に置かれた alias ノードに限る
> - scope 外の実体内容を、alias 経由の通常編集で直接書き換えない
> - target 実体を編集したい場合は、その実体の属する scope へ移動して行う
> 
> ### 移動
> 
> - 実体ノードを別 scope へ move した場合、所属 scope は移動先に合わせて更新する
> - subtree move では、配下ノードも同じ規則で再計算する
> - ただし配下に `folder` がある場合、その `folder` より下は独立 scope として維持する
> 
> ## Alias の役割
> 
> alias は、他 scope の実体を複製せずに参照するための窓である。
> 
> ## Alias の原則
> 
> - alias は参照専用である
> - 実体の正本は 1 箇所だけに置く
> - 他 scope へ見せたいときだけ alias を置く
> - alias から alias は辿らない
> - alias には write 権限を付与できるが、既定は read-only とする
> 
> ## Alias ノード仕様
> 
> ### 最低限の属性
> 
> - `id`
> - `type: "alias"`
> - `parentId`
> - `children: []`
> - `scopeId`
> - `targetNodeId`
> - `aliasLabel?`
> - `access: "read" | "write"`
> - `targetSnapshotLabel?`
> - `isBroken?`
> - `createdAt`
> - `updatedAt`
> 
> ### target 制約
> 
> - `targetNodeId` は実体ノードのみを指せる
> - target は `text` `image` `folder` のいずれか
> - `alias -> alias` は禁止する
> - target が同一 scope 内にある alias も許可する
> 
> ### 表示ルール
> 
> - `aliasLabel` があればそれを優先表示する
> - `aliasLabel` がなければ target の現在ラベルを表示する
> - alias は通常ノードと見分けがつく視覚表現を必須とする
> - target scope 名や外部参照であることが分かる補助表示を持てるようにする
> - broken alias は `元の名前 (deleted)` を既定表示とする
> - `targetSnapshotLabel` には target 消失前の最後の表示名を保持する
> 
> ### 操作ルール
> 
> - alias の rename は既定で `aliasLabel` の編集として扱う
> - `access: "read"` の alias では target 実体の直接編集を行わない
> - `access: "write"` の alias では、許可された編集を target 実体へ反映できる
> - target 実体の rename は target 側 scope でも行える
> - alias の delete は alias 自体のみを削除し、target 実体には影響しない
> - alias 選択時は `jump to target` を明示操作として提供できる
> - target が `folder` の場合、alias から target scope へ遷移できる
> - broken alias は rename / annotation / delete のみ許可し、target への jump は不可とする
> 
> ### 禁止事項
> 
> - alias に子を持たせない
> - alias を主構造の所有権ノードとして扱わない
> - alias を target の保存先 scope 変更手段として使わない
> 
> ## Scope と Alias の組み合わせで解く問題
> 
> - 見えすぎることで集中が崩れる
> - 同じノードを複製して整合性が壊れる
> - 全体と局所の往復が煩雑になる
> - 参照元ごとに文脈だけ変えつつ、正本は一意に保つ
> 
> ## 整合性ルール
> 
> ### 1. delete
> 
> - target 実体を delete しても alias は残してよい
> - delete 時点で alias は broken 状態へ遷移し、`targetSnapshotLabel` に最後の表示名を保持する
> - broken alias の既定表示は `元の名前 (deleted)` とする
> - broken alias は保存可能だが、target 復旧までは参照解決不能として扱う
> 
> ### 2. move / reparent
> 
> - target 実体を別親へ移動しても `targetNodeId` は不変
> - その結果 scope 所属が変わっても alias は同じ target を参照し続ける
> - alias 自身の move は設置 scope の変更として扱うが、target の所属は変えない
> 
> ### 3. rename
> 
> - target rename は `aliasLabel` 未設定の alias 表示へ即時反映される
> - `aliasLabel` 付き alias は target rename の影響を受けない
> 
> ### 4. invalid target
> 
> - save/load 時に `targetNodeId` 不在を検出した場合でも、`isBroken` と `targetSnapshotLabel` が整合していれば broken alias として許容する
> - `targetNodeId` 不在かつ broken 情報がない場合は invalid とみなす
> 
> ### 5. access control
> 
> - 既定値は `access: "read"` とする
> - `access: "write"` を持つ alias では、許可された編集操作を target 実体へ転送できる
> - write alias でも target の ownership や scope 所属は変更しない
> - 権限は alias ごとに保持し、target ノード本体の性質にはしない
> 
> ## Beta 実装で先に固定すること
> 
> - scope 所属は nearest ancestor folder から決定する
> - alias は leaf ノードとして扱う
> - alias 既定権限は read-only とする
> - write alias を表現できるデータ構造を先に用意する
> - target delete 時は alias を broken 状態へ遷移させる
> - 同一 scope 内 alias も許可する
> - Freeplane `.mm` には `scope` / `alias` の完全往復をまだ要求しない
> 
> ## Beta 実装でまだ保留にすること
> 
> - 1 つの実体を複数 alias で一覧するときの集約 UI
> - scope 横断検索時の表示優先順位
> - `.mm` export 時の alias 表現形式
> - alias への annotation を `aliasLabel` 以外にどこまで持たせるか
> - write alias が許す編集範囲を rename / body / metadata のどこまでにするか
> 
> ## UI/UX 上の含意
> 
> - 現在 scope 外の情報は常時表示しない
> - 外部参照は alias や明示的導線でのみ見せる
> - rename / move / delete 時は alias 表示との整合を保つ
> - folder は「子を持つノード」であるだけでなく「scope 入口」であることが分かる必要がある
> - alias は通常ノードと誤認されない見た目と操作ラベルを持つ必要がある
> - read alias / write alias / broken alias を視覚的に区別できる必要がある
> 
> ## 実装メモ
> 
> - model では `scopeId` を永続化するか、親子構造から毎回再計算するかを後続で決める
> - viewer は `currentScopeId` を持ち、表示フィルタと編集制約の根拠に使う
> - save/load 層では `alias -> alias` 禁止と broken alias 整合性検証が必要
> - command 層では `createAlias` `setAliasAccess` `moveNodeAcrossScope` `deleteNodeKeepBrokenAliases` を明示した方がよい
> 
> ## 関連文書
> 
> - 原則: [../01_Vision/Core_Principles.md](../01_Vision/Core_Principles.md)
> - 実体モデル: [./Data_Model.md](./Data_Model.md)
> - Freeplane 境界: [../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md](../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md)
> 
> ---
> 
> 
> ## 04_Architecture
> 
> ### AI_Infrastructure.md
> 
> ```
> source: 04_Architecture/AI_Infrastructure.md
> ```
> 
> # AI インフラ設計
> 
> 最終更新: 2026-04-02
> 
> ## 目的
> 
> この文書は、M3E における AI 連携の基盤設計を定義する。
> 
> ここでいう AI インフラは、
> 個別機能（Linear <-> Tree 変換、title rewrite、duplicate check など）の前段にある
> 共通の provider 接続基盤・秘密情報管理・呼び出し境界・失敗時の振る舞いを指す。
> 
> ## 基本思想
> 
> 1. AI は機能ではなく基盤として扱う。
> 2. provider 固有事情を feature 実装へ漏らさない。
> 3. API key や endpoint はアプリ機能ごとに分散させず、共通の AI 設定へ集約する。
> 4. feature ごとの差分は prompt / payload / response schema に閉じ込める。
> 5. AI が使えない状態でも、M3E の主要操作は成立しなければならない。
> 
> ## なぜ feature 専用設定にしないか
> 
> `M3E_LINEAR_AGENT_API_KEY` のような feature 専用設定は、
> 短期的には簡単でも中長期で次の問題を作る。
> 
> - AI 機能を追加するたびに env が増殖する
> - provider 切替が feature ごとにバラバラになる
> - secret 注入経路が分散し、Bitwarden 連携や運用自動化が複雑化する
> - UI から見た「AI が有効か」の状態が統一できない
> - ログ、レート制御、タイムアウト、fail-closed 方針を横断で揃えにくい
> 
> そのため、M3E では AI 接続設定を `M3E_AI_*` に寄せ、
> 各 feature はその基盤を利用する構造を採る。
> 
> ## レイヤ構成
> 
> ```text
> Feature UI / Feature API
>   -> Feature Adapter
>     -> AI Infrastructure
>       -> Provider Transport
>         -> External Provider or MCP Server
> ```
> 
> ### 1. Feature UI / Feature API
> 
> - browser 側のボタン、パネル、操作フロー
> - Node 側の feature endpoint
> - 例:
>   - `GET /api/linear-transform/status`
>   - `POST /api/linear-transform/convert`
> 
> ### 2. Feature Adapter
> 
> AI 基盤の上に載る個別機能層。
> 
> - feature 固有の request schema
> - feature 固有の prompt
> - provider 返答の feature 用正規化
> - feature 単位の fail-closed 条件
> 
> 例:
> 
> - linear transform
> - title rewrite
> - suggest-parent
> - duplicate-check
> 
> ### 3. AI Infrastructure
> 
> 共通化されるべき責務を持つ。
> 
> - provider 設定読込
> - secret 注入前提の環境変数解決
> - transport 選択
> - 共通 status 判定
> - 共通エラー分類
> - 共通 timeout / retry / rate limit の受け皿
> - 将来の監査ログ統合点
> 
> ### 4. Provider Transport
> 
> 外部接続の差分を吸収する層。
> 
> - `openai-compatible`
> - `mcp`（将来）
> - local gateway / proxy（将来）
> 
> feature は transport ではなく、
> AI インフラが返す抽象化済みの呼び出し面を見る。
> 
> ## 現行の責務分離
> 
> ### 共通 AI 設定
> 
> 共通設定は `M3E_AI_*` に置く。
> 
> 想定項目:
> 
> - `M3E_AI_ENABLED`
> - `M3E_AI_PROVIDER`
> - `M3E_AI_TRANSPORT`
> - `M3E_AI_BASE_URL`
> - `M3E_AI_API_KEY`
> - `M3E_AI_MODEL`
> - `M3E_AI_MCP_SERVER`
> 
> これらは provider 接続に必要な最低限の構成であり、
> feature 固有の意味を持たない。
> 
> ### feature 固有設定
> 
> feature 固有設定は prompt や schema に限定する。
> 
> 例:
> 
> - `M3E_LINEAR_TRANSFORM_SYSTEM_PROMPT_FILE`
> - `M3E_LINEAR_TRANSFORM_TREE_TO_LINEAR_PROMPT_FILE`
> - `M3E_LINEAR_TRANSFORM_LINEAR_TO_TREE_PROMPT_FILE`
> 
> この分離により、
> 同じ provider 接続を複数の AI 機能で共有できる。
> 
> ## 秘密情報管理
> 
> ### 原則
> 
> 1. API key は repo 内に保存しない。
> 2. browser に API key を渡さない。
> 3. secret 解決はアプリ内部よりも起動レイヤで行う。
> 
> ### 推奨経路
> 
> Bitwarden を secret source とし、
> launch script が起動前に取得して `M3E_AI_*` を注入する。
> 
> ```text
> Bitwarden
>   -> launch-with-ai.ps1
>     -> M3E_AI_API_KEY / M3E_AI_MODEL / M3E_AI_BASE_URL
>       -> beta start
> ```
> 
> ### 起動レイヤで注入する理由
> 
> - アプリ本体が secret manager 依存にならない
> - feature 呼び出しのたびに secret 解決しなくてよい
> - desktop 運用と CI 運用で同じ env 契約を共有できる
> - provider 差し替え時も launch 層だけで調整しやすい
> 
> ## Transport 方針
> 
> ### `openai-compatible`
> 
> 現行の第一実装。
> 
> - DeepSeek 系 endpoint を含む OpenAI 互換 API を対象とする
> - `/chat/completions` 互換を利用する
> - Node サーバー経由で呼び出す
> 
> ### `mcp`
> 
> 将来の transport。
> 
> 用途:
> 
> - subagent をツールサーバーとして分離したい場合
> - provider だけでなく処理器そのものを外部化したい場合
> - 複数 feature で同一 subagent を共有したい場合
> 
> 現段階では config surface のみ先行し、
> 実体は未実装でよい。
> 
> ## API 設計原則
> 
> 共通 API の request / response / error 契約の正本は
> `../03_Spec/AI_Common_API.md` とする。
> 
> ### browser は provider を直接呼ばない
> 
> 理由:
> 
> - API key 保護
> - CORS 回避
> - provider 差し替えの容易化
> - audit / rate limit / timeout 集中管理
> 
> そのため、browser は常に localhost の Node API を叩く。
> 
> ### status endpoint を feature ごとに持つ
> 
> 例:
> 
> - `/api/linear-transform/status`
> 
> status endpoint の目的:
> 
> - UI が機能有効性を描画できる
> - provider 未設定時の fail-closed を事前に伝えられる
> - transport や prompt 設定の診断点になる
> 
> ### convert / propose endpoint は feature schema を持つ
> 
> 共通 provider の上に載っても、
> feature request/response は feature ごとに分ける。
> 
> 理由:
> 
> - schema が feature ごとに異なる
> - 妥当性検証が feature ごとに異なる
> - UI 側の承認フローが feature ごとに異なる
> 
> ## Fail-Closed 原則
> 
> AI 連携で失敗した場合、M3E は次を守る。
> 
> 1. 正本を部分更新しない
> 2. 既存の手動操作導線へ戻れる
> 3. 失敗理由を UI/ログで観測可能にする
> 
> 典型的な失敗分類:
> 
> - disabled
> - config missing
> - transport not implemented
> - invalid request
> - provider timeout
> - provider schema mismatch
> - provider unavailable
> 
> ## Linear Transform との関係
> 
> Linear <-> Tree は AI インフラ上の 1 feature に過ぎない。
> 
> そのため、次を守る。
> 
> - provider 接続設定は共通 AI 基盤から取る
> - prompt だけを feature 固有設定として持つ
> - browser 側は feature endpoint だけを見る
> - provider 固有レスポンスは feature adapter で吸収する
> 
> これにより、後から以下を追加しやすくなる。
> 
> - title rewrite
> - duplicate check
> - suggest-parent
> - structure proposal
> - context package enrichment
> 
> ## Bitwarden 運用との整合
> 
> Bitwarden item の責務は secret source であり、
> アプリの feature 単位設定 source ではない。
> 
> 推奨:
> 
> - `password`: API key
> - custom field:
>   - `provider`
>   - `transport`
>   - `base_url`
>   - `model`
> 
> launch script がこれを `M3E_AI_*` に写像する。
> feature 固有の prompt は repo 内のファイルか、
> 将来的には別設定層で管理する。
> 
> ## 今後の拡張点
> 
> 1. 共通 `POST /api/ai/subagent/:name` の導入
> 2. provider ごとの token usage 正規化
> 3. タイムアウト・リトライ・レート制御の共通化
> 4. 監査ログの統一
> 5. MCP transport 実装
> 6. feature ごとの approval UI との接続
> 
> ## 2026-04-03 追加: LLM マルチプロバイダ基盤方針 v0.1
> 
> ### 目的再定義
> 
> M3E の AI 基盤は次を満たすことを目標にする。
> 
> 1. ローカル/クラウドを同一 API 契約で扱う
> 2. モデルを alias で切替できる（Copilot 的な選択体験）
> 3. feature 実装は provider 固有名を直接持たない
> 4. データポリシー（local only 等）を集中管理する
> 
> ### 推奨スタック（実務優先）
> 
> - App layer: Vercel AI SDK
> - Gateway layer: LiteLLM
> - Local runtime: Ollama（標準）、必要に応じて vLLM / llama-cpp-python
> - Optional cloud aggregator: OpenRouter
> 
> この構成の理由:
> 
> - Vercel AI SDK は TypeScript 側の provider/model 抽象化と model 管理に向く
> - LiteLLM は複数 provider を OpenAI 互換 endpoint で束ねる gateway に向く
> - Ollama / vLLM / llama-cpp-python はローカル実行面を担い、gateway 配下に置ける
> - OpenRouter は cloud 集約として有用だが、local 実行基盤の代替ではない
> 
> ### ライブラリ比較（M3E 観点）
> 
> | コンポーネント | 主な役割 | M3E での位置付け | 注意点 |
> |---|---|---|---|
> | Vercel AI SDK | TS 側 provider abstraction | App/adapter 層の標準候補 | gateway 機能そのものは持たない |
> | LiteLLM | 統一 gateway/proxy | backend の第一候補 | 運用プロセス（config/key）設計が必要 |
> | Ollama | ローカル LLM 実行 | 開発機での標準 runtime | 大型モデルはメモリ制約に注意 |
> | vLLM | 高速サービング | GPU サーバ向け拡張 | 開発機単体では過剰になりやすい |
> | llama-cpp-python | 軽量ローカル実行 | オフライン検証の補助 | 速度/機能はモデル依存 |
> | OpenRouter | cloud provider 集約 | 任意追加 | local 実行を代替しない |
> 
> ### フェーズ設計
> 
> #### Phase 1（最速検証）
> 
> - 構成: `Vercel AI SDK + (Ollama or OpenAI API)`
> - 目的: alias 切替 UI と feature 接続の検証
> - 制約: backend gateway 不在のため、ルーティング/ポリシー集中管理が弱い
> 
> #### Phase 2（基盤化）
> 
> - 構成: `Vercel AI SDK + LiteLLM + local runtimes + cloud providers`
> - 目的: local/cloud ルーティング、fallback、監査ログの集中化
> - 期待効果: feature 側コードの provider 依存を最小化
> 
> ### モデル ID 方針（alias 優先）
> 
> feature 側では vendor model 名を直接持たない。内部 alias を使う。
> 
> 例:
> 
> - `chat.local.fast`
> - `chat.local.reason`
> - `chat.cloud.fast`
> - `chat.cloud.strong`
> - `embed.default`
> 
> alias -> 実モデル名の対応は AI 基盤設定で集中管理する。
> 
> ### データポリシー方針
> 
> request ごとに次のいずれかを明示する。
> 
> - `local_only`
> - `cloud_allowed`
> - `cloud_required`
> 
> `local_only` は cloud fallback を禁止する。
> 
> ### 実装メモ（現行 beta）
> 
> 現行実装では `M3E_AI_MODEL_REGISTRY_JSON` と `M3E_AI_DEFAULT_MODEL_ALIAS` により、
> alias ベースのモデル解決を先行導入する。
> 
> 例:
> 
> ```json
> {
>   "chat.fast": {
>     "label": "Fast Cloud",
>     "kind": "chat",
>     "privacy": "cloud",
>     "capabilities": ["streaming", "json"],
>     "targetModel": "deepseek-chat",
>     "dataPolicy": "cloud_allowed"
>   },
>   "chat.local": {
>     "label": "Gemma Local",
>     "kind": "chat",
>     "privacy": "local",
>     "capabilities": ["streaming"],
>     "targetModel": "gemma3:4b",
>     "dataPolicy": "local_only"
>   }
> }
> ```
> 
> `M3E_AI_GATEWAY=litellm` は運用上の明示フラグとして扱い、
> `/api/ai/status` で可観測にする。
> 
> ## 非目標
> 
> - AI が無承認で正本を書き換えること
> - browser に provider SDK と secret を埋め込むこと
> - feature ごとに別々の secret 配布経路を持つこと
> - provider 別の UI を feature へ直接埋め込むこと
> 
> ## 関連文書
> 
> - `../03_Spec/AI_Integration.md`
> - `../03_Spec/Linear_Tree_Conversion.md`
> - `../03_Spec/Import_Export.md`
> 
> ---
> 
> ### Drag_and_Reparent.md
> 
> ```
> source: 04_Architecture/Drag_and_Reparent.md
> ```
> 
> # Drag and Reparent
> 
> ## 目的
> 
> ノードのドラッグによる親付け替えを、Model を壊さずに扱うための操作設計を定義する。
> 
> ## 基本原則
> 
> - ドラッグ中は Model を更新しない
> - 見た目の追従は ViewState 
> The file is too long and its contents have been truncated.
> 

> [!abstract]- Tool (file_search)
> <sub>2026-04-17 14:08</sub>
> 
> The file contents provided above are truncated/partial snippets. The complete content for these files IS accessible via querying.
> 
> If the user asks a question related to these files, and the provided snippets do not clearly answer it, you **MUST** use the `file_search` tool to search the full document contents before responding.
> 
> ## How to invoke the file_search tool
> If the user's query isn't sufficiently answered by the provided snippets, parsed text, or images, you should invoke `file_search.msearch`.
> To search the full content of the available files, you **must** send one message with recipient `to=file_search.msearch` in the analysis channel. Your message should be structured exactly as follows:
> ```
> {
>   'queries': ['Example query 1', 'Example query 2']  // List of up to five queries to search for.
> }
> ```
> 
> Carefully balance the number of `file_search` calls and the quality of your response with the latency incurred by `file_search` calls.
> 
> Important guidelines for query formatting:
> - Your message must be a valid JSON object. Do not include any extraneous text, backticks, markdown formatting, or comments beyond what is shown.
> - The `queries` field must be a list of strings.
> - One of the queries **MUST** exactly match the user's original question, but stripped of any extraneous details, and with ambiguous references clearly resolved using context from the conversation. It **MUST** be a complete sentence.
> - Even if you suspect the user meant something else, one query **MUST** still be their original question.
> 
> ## How to handle results from file_search
> The file search tool will respond with the relevant search results from the full files. After you receive these results:
> - Carefully evaluate each result to determine its relevance and quality.
> - Use the high-quality and relevant results to inform your answer to the user's question.
> - When possible, reuse information from prior file_search results and avoid repeating identical queries.
> 
> ## Tool usage instructions and ordering
> When the user asks a question, carefully consider whether the provided snippets sufficiently answer the query, whether you need to invoke `file_search.msearch`, or another available tool (such as `web`, if available) should be used instead.
> 
> Tool-ordering Guidelines:
> 1. For queries related to uploaded files, if snippets are insufficient, strongly prefer invoking `file_search.msearch` over other tools.
>     - Avoid using `web.run`, `python` analysis, or any other tools until you have either:
>         - Confirmed with high confidence the answer is not in the files, or
>         - Have high confidence `file_search_tool` queries are not sufficient to answer the query.
> 2. Avoid usage of `web_search/web.run` for queries related to uploaded files
>     - Carefully consider whether the user's query is better answered by web search results rather than available snippets or results from `file_search_tool`.
>     - Unless the user's query is clearly unrelated to the uploaded files, prefer using `file_search.msearch`. You can always follow up with a web search if necessary for a more complete response.
> 3. Avoid using `python` unless necessary or requested by user.
>     - If the user's query is answerable from the parsed text and images from the uploaded files, or from `file_search_tool`, do not invoke `python`.
> 
> Always keep this instruction in mind for the rest of the conversation, as the user may reference these files or ask related questions later on.

**ChatGPT**: <sub>2026-04-17 14:08</sub>

問題の本質は「Resourceを**どの整合境界で持つか**」にある。今の設計（単一実体＋alias＋スコープ）と強く衝突している。

まず整理すると、M3Eは  
・実体は一意  
・所属スコープは単一  
・他スコープはalias参照  
という前提を置いている fileciteturn0file2  

この時点で、Resourceを「グローバル実体」として扱うと、スコープ境界と責務がズレる。

---

結論から言うと、3パターンに分解できる。

■1. 完全集中管理（グローバルResource）
単一ストアでResourceを持つ

利点  
・一貫性が最も高い  
・重複なし  

問題  
・全体破損リスクが高い  
・変更が全スコープに波及  
・Undo/差分が広域になる  

これはModelが全責任を持つ設計と相性はいいが、壊れた時の影響が大きい  
（Command適用が単一入口なので巻き込みやすい） fileciteturn0file0  

---

■2. PJ単位Resource（ローカル管理）
スコープごとにResourceを持つ

利点  
・破損が局所化  
・Undoも局所  
・スコープ閉包性と一致  

問題  
・同一Resourceの複製が発生  
・同期問題  
・aliasと概念が競合  

これは「スコープ単位保存が有利」という設計とは整合する fileciteturn0file2  
ただし alias の思想（実体は一意）と矛盾し始める

---

■3. ハイブリッド（推奨）
Resourceを2層に分離する

構造はこうなる

・Global Resource（不変 or 準不変）
・Local Instance（スコープ内の利用状態）

つまり

Resource = 実体  
Instance = 使われ方  

---

この形にすると整理される

■性質

・実体の一意性は維持（alias思想と一致）  
・スコープごとの編集はInstanceで閉じる  
・破損は局所化される  
・同期は「実体」ではなく「参照」で起きる  

---

■重要な転換点

「Resourceを直接編集させない」

代わりに

・編集 → Instance  
・構造変更 → Instance  
・意味変更 → Resource  

に分離する

---

■なぜこれが安定するか

現在のMVC+Command構造では  
「変更はすべてModel.applyに集約」される fileciteturn0file1  

ここにグローバルResource変更を混ぜると

・Undo範囲が不明確  
・影響範囲が広すぎる  

になる

Instanceを切ることで

・Commandの作用域 = スコープ  
に制限できる

---

■さらに重要な点

aliasとの関係

alias = 他スコープの実体参照  
Resource = 実体  

なので

alias ≒ Resource参照

と見ると、二重構造を避けられる

---

■設計判断の軸

どれを優先するかで決まる

・壊れにくさ → PJローカル or ハイブリッド  
・一貫性 → グローバル or ハイブリッド  
・Undoの明確さ → ハイブリッド  

---

■最終的な整理

完全中央集権は強いが危険  
完全分散は安全だが崩れる  

なので

「実体は中央、操作はローカル」

に分離するのが自然

---

この問題は「Resourceの粒度」と「どの操作がグローバルか」を決めないと収束しない。

**User**: <sub>2026-04-17 14:09</sub>

解答の改行多すぎる。見づらい。

**ChatGPT**: <sub>2026-04-17 14:09</sub>

了解。簡潔にまとめる。

問題は「Resourceをどこで整合させるか」。M3Eは「実体は一意・スコープは閉じる・aliasで参照」という前提なので、完全グローバルか完全ローカルかの二択にすると必ず崩れる fileciteturn0file2  

グローバル管理は一貫性は高いが、変更の影響範囲が広く、Undoや破損が全体に波及する。MVC＋Commandで全変更がModelに集中する構造だと、このリスクが増幅される fileciteturn0file1  

PJ単位管理は壊れにくいが、同一Resourceの複製が発生し、alias思想（実体一意）と衝突する。同期も難しくなる。  

安定するのは分離。Resourceを「実体」と「利用状態」に分ける。実体はグローバルで一意に保ち、スコープ内の操作はローカルなInstanceとして持つ。編集の大半はInstance側で完結させ、実体変更は限定する。  

こうすると、整合性は実体で維持され、破損やUndoの影響はスコープ内に閉じる。さらにaliasとも自然に整合する。  

要点は「実体を直接いじらせない」こと。これで集中管理と分散管理の衝突が解消される。

**User**: <sub>2026-04-17 14:10</sub>

資源が本質的に階層的なんよな。組織の予算、PJの予算、個人予算、とある

> [!abstract]- Tool (file_search)
> <sub>2026-04-17 14:10</sub>
> 
> Make sure to include fileciteturn1file0 in your response to cite this file, or to surface it as a link.
> 以下は「ノードAをドラッグして、別の親P’の子に付け替える」一連操作を、MVC（＋Command）で忠実に流した場合の連携です。Konva等の有無に依存しない抽象形で書きます。
> 
> 前提の責務
> Model：ツリー整合性を保証しつつ、Commandを適用・Undo記録・変更通知
> View：Canvas描画のみ
> Controller：入力列を解釈し、HitTest結果を用いてCommandを作りModelへ渡す
> HitTest：座標→対象（nodeId等）を返す
> ViewState：カメラ、選択、ドラッグ中のプレビュー状態
> 
> 初期状態
> ViewはModelのsnapshotを描画している。ControllerはIdle。
> 
> pointerdown（ノードA上）
> (1) Browser → Controller に pointerdown
> (2) Controller は HitTest(point) を呼ぶ
> (3) HitTest は nodeId=A を返す
> (4) Controller は内部状態を Pressed(A) にする（ドラッグ開始候補）
> (5) ViewState に activeNode=A, dragStartPos を記録（任意）
> (6) まだModelは変更しない（クリック判定のため）
> 
> pointermove（閾値超えでドラッグ開始）
> (1) Browser → Controller に pointermove
> (2) Controller は「移動距離が閾値超え」を確認し DraggingNode(A) に遷移
> (3) Controller はドラッグ中プレビューを更新
> 　・ViewState.dragPos を更新（Aの表示位置だけ一時的に動かす）
> (4) Controller は必要なら HitTest を呼び「ドロップ先候補」を検出
> 　・HitTest(point) → nodeId=P’（候補親）または background
> (5) ViewState.hoverDropTarget=P’ を更新（ハイライト用）
> (6) Modelはまだ変更しない（確定はdrop時）
> 
> pointermove（ドラッグ継続）
> (1) 同様に dragPos を更新
> (2) 同様に dropTarget候補を更新
> (3) Viewは subscribe しているので、ViewStateの更新に応じて再描画（方式は任意）
> 　※ここは「Model変更通知」でなくても良い。ドラッグ中はViewState駆動で再描画してよい。
> 
> pointerup（ドロップ確定）
> (1) Browser → Controller に pointerup
> (2) Controller は最終位置で HitTest(point) を呼び、dropTarget候補を確定
> 　・HitTest(point) → nodeId=P’（候補親）
> (3) Controller は「付け替えが成立する条件」を最低限チェック
> 　・P’が存在する
> 　・A自身ではない
> 　・（任意）Aの子孫ではないか、など
> 　※厳密チェックはModelに任せてもよいが、明らかな誤りはここで弾くとUXが良い。
> (4) Controller は Command を生成
> 　・ReparentNodeCommand(nodeId=A, fromParent=P, toParent=P’, fromIndex=i, toIndex=j)
> 　※fromIndex/toIndexは並び順を保存したいなら必要。最小なら親だけでもよい。
> (5) Controller → Model.apply(command) を呼ぶ（ここが唯一の状態変更入口）
> 
> Model.apply(command)
> (1) Modelは内部で制約検証
> 　・ツリーが循環しない
> 　・scope制約、alias制約など
> (2) OKなら状態を更新（親をP→P’へ）
> (3) undoStackにcommandをpush（redoStackはクリア）
> (4) Modelが “changed” を通知（emit/subscribe）
> 
> View更新
> (1) View（Renderer）は Model.changed を受け取る
> (2) 最新snapshotを読み、Canvasを再描画
> (3) Controllerはドラッグ状態をIdleに戻し、ViewStateの一時状態をクリア
> 　・dragPos/hoverDropTargetなど
> 
> Undo/Redo（参考）
> Undo操作（Ctrl+Z等）
> (1) Browser → Controller に keydown
> (2) Controller → Model.undo()
> (3) Modelは最後のcommand.undoを実行し、changed通知
> (4) View再描画
> 
> 重要な設計上の注意
> ・ドラッグ中の「見た目の追従」は、Modelを書き換えずViewStateで行う方が安全です。確定時だけCommandを発行します。
> ・「親付け替え」の正当性（循環、scope、alias等）はModelが最終責任を持つべきです。ControllerはUX向上のための軽い事前判定まで。
> ・Commandには「元の親情報」を必ず入れます。Undoに必要です。

> [!abstract]- Tool (file_search)
> <sub>2026-04-17 14:10</sub>
> 
> Make sure to include fileciteturn1file1 in your response to cite this file, or to surface it as a link.
> ### KGF開発のための追加マインドマップツール調査
> 
> 前回の提案（MindMup、Freeplane）以外に、マインドマップツールをさらに調査しました。焦点はオープンソースで、オフライン対応、拡張性が高く、KGFの仕様（ツリー構造、スコープ/folder、alias参照、キャンバスUI、帯域対応可能性）にラップしやすいものを優先。Web SearchとX Searchの結果から、Webベース/デスクトップのツールを抽出。いくつかは知識グラフ寄りですが、マインドマップに拡張可能。
> 
> 調査基準:
> - **オフライン対応**: KGFのオフラインファーストに適合。
> - **拡張性**: API/スクリプト/モジュラー構造で、ラップ（カスタムUI/機能追加）しやすく、帯域（Flash/Rapid/Deep）やAI統合を追加可能。
> - **構造サポート**: ノード/ツリー、フォルダ/スコープ相当、参照（alias）機能。
> - **コスト削減効果**: 既存コード再利用で、開発工数30-50%減。
> 
> 以下、テーブルでまとめ。提案ツールはフォーク/ラッパーでKGF独自機能（スコープ境界、AI提案、自然言語化）を追加可能。詳細はBrowse Page結果に基づく。
> 
> | Tool | Open Source | Offline Support | Tech Stack | Key Features for KGF | Extensibility & Wrapping Potential | Source |
> |------|-------------|-----------------|------------|----------------------|------------------------------------|--------|
> | WiseMapping | Yes | **No** (Web-based, server needed) | React (frontend), Spring Boot (backend), SVG, PostgreSQL | Hierarchical nodes/trees, rich content (text/links/icons), search/navigation. No explicit folders, but node grouping for scopes. Import/export (Freeplane/XMind). | High: REST API for integration, modular (frontend/backend separate), Docker deploy. Wrap with Quasar for PWA/offline cache, add band modes via styles. |   |
> | TiddlyMap | Yes (TiddlyWiki plugin) | Yes (Browser-local, no server) | JavaScript, TiddlyWiki (single HTML file) | Nodes/edges for graphs, filters for scopes, double-click navigation. Wiki integration for alias-like references. Styles/icons/groups. | High: Plugin-based, customizable via TiddlyWiki macros/filters. Embed in Web app, add keyboard/IME via JS. Offline-first fits KGF. Extend for AI with local LLM. |   |
> | diagrams.net (draw.io) | Yes | Yes (Desktop app, PWA offline) | JavaScript, Electron (desktop), XML-based storage | Mind map templates, trees/auto-layout, containers for folders/scopes. Links/references for aliases. Infinite canvas, undo/redo. | High: Embeddable libraries, plugins/extensions. Wrap with Vue/Quasar for custom UI. Add bands via layers/styles. Integrates with IndexedDB. |  |
> | MindGraph | Yes | Yes (Local/in-memory DB) | Python (backend), Cytoscape.js (frontend), NebulaGraph/FalkorDB | Knowledge graph with entities/relationships (tree-like), schema for scopes. Natural language input/search. | High: Modular integrations/signals, API endpoints. Wrap frontend for KGF canvas, add AI via built-in NLP. Extend for bands with query filters. | [post:1]  |
> | Semantik | Yes | Yes (Desktop) | Qt/C++ (KDE) | Mind maps with nodes/trees, document generation. Hierarchical views for scopes. | Medium: Scriptable, but desktop-focused. Wrap via Qt WebEngine for Web, but cross-platform effort needed. |  |
> | Docear (SciPlore) | Yes | Yes (Java desktop) | Java | Mind maps with PDF/literature integration, folders/projects for scopes. References/links for aliases. | Medium: Extensible via plugins. Fork for Web, but Java-to-JS migration costly. Fits academic KGF use. |  |
> | VUE | Yes | Yes (Java desktop) | Java | Concept maps (nodes/links), pathways for navigation/scopes. Merge maps for aliases. | Medium: Scriptable, offline. Wrap with Electron for modern UI, add bands via views. |  |
> | Coggle | No (Free tier) | Partial (Web, offline export) | Web (JS) | Simple trees, branches for scopes. Real-time collab. | Low: No open source, API limited. Not ideal for wrapping, but inspire UI. |   |
> | MYND | Custom (Described as built) | Yes (Local ML) | Python/ML (Graph Transformer), Claude API | 3D mind maps, context synthesis, memory hierarchy for bands/scopes. AI learning for proposals. | High: If open-sourced, wrap for KGF AI. Proactive features fit Flash band. | [post:2] |
> | Blender Mindmap Addon | Yes (Blender addon) | Yes (Offline 3D) | Python (Blender API) | 3D mind maps in Blender. Nodes/trees in viewport. | Low: 3D-focused, heavy for KGF. Wrap via Blender Python, but overkill. | [post:3] |
> 
> ### 推奨
> - **トップピック**: TiddlyMap (オフライン/軽量、Webラップ容易) or diagrams.net (キャンバス/オフライン、Miro差別化に強い)。これらをラップすれば、仕様の80%カバー可能。Freeplaneと組み合わせでJava部分をオフライン強化。
> - **戦略**: オープンソースをフォーク、KGF独自（スコープ/alias/AI）をプラグイン追加。テストで消失防止優先。
> - **注意**: オフライン弱いツールはService Workerで強化。詳細実装でさらにBrowse可能。
> 
> 

> [!abstract]- Tool (file_search)
> <sub>2026-04-17 14:10</sub>
> 
> Make sure to include fileciteturn1file2 in your response to cite this file, or to surface it as a link.
> # Mind Map Model Engine (M3E) 仕様設計書（会話ログ統合）
> 
> 本書は、これまでの会話で合意された世界観・制約・設計意図を、実装詳細に過度に踏み込まずに「仕様」として再構成したものである。特に、個人オフライン・スコープ境界・親子主構造・帯域（Flash/Rapid/Deep）・AIは提案で承認が確定、を中核原則として保持する。
> 
> ---
> 
> ## 0. 基本思想・前提
> 
> - 目的：M3Eは「情報管理」と「認知拡張」を同時に満たす思考ツール（道具であり環境）である。研究知識・タスク・生活管理などの思考要素を同一体系で扱い、分断を避ける。
> - 想定ユーザー：まずは1ユーザーの個人利用を前提とし、日常運用に耐える信頼性（消失バグなし）を最優先とする。
> - オフラインファースト：編集・閲覧・構造操作はオフラインで成立し、AI等の外部APIはオンライン時の補助として位置づける。
> - Miroとの差別化：Miroはオンラインのチームホワイトボードであり、M3Eは個人オフラインの構造思考環境である。M3Eの差別化は「帯域」「スコープ境界（見えすぎ回避）」「alias参照」「構造→自然言語化による外部AI連携」である。
> - Flash / Rapid / Deep：帯域は機能差ではなく、思考密度と作業態度の差として設計する。
>   - Flash：反応（閃き・割り込み・提案を逃さない）／種（後で本体に組み込む）
>   - Rapid：作業（普段使い）／草稿（速度優先の思考整理）
>   - Deep：構造化（設計図）／設計図（完成ではなく変化し続ける）
> - 構造は単一でビューが変わる：同一の基礎構造（単一の実体グラフ）を、帯域・スコープ・表示密度の違いとして観測・編集する。
> - folder = 認知境界：フォルダは下位階層のルートノードであり、スコープ境界（folder world）として可視性・探索・編集の範囲を規定する。
> - alias = 参照のみ：aliasは実体を複製せず参照する窓である。実体は一意の場所（単一スコープ）に属し、他スコープからはaliasで参照する。
> - 見えすぎ回避：現在スコープ外の情報は基本的に露出しない。外部要素が必要な場合はalias等の明示的導線のみで参照する。
> - 主構造は親子関係のみ：主構造は親子（ツリー）であり、自動整形の対象はこの骨格である。関係線は補助線として後回し／既定非表示を基本方針とする。
> 
> ---
> 
> ## 1. 用語定義
> 
> - Node：思考要素の最小単位。型は text / image / folder / alias。
>   - text：テキスト内容を持つノード。
>   - image：画像内容を持つノード。
>   - folder：下位階層のルートノード。スコープ境界として振る舞う。
>   - alias：text/image/folderのいずれかを参照するノード（alias→alias参照は禁止）。
> - Edge：親子関係のみを表す有向関係（親→子）。
> - Scope：folder world。あるfolderをrootとする可視性・編集範囲。
> - 帯域：Flash / Rapid / Deep。
> - Inbox：Flash領域。種（未統合）を一時的に保持する受け皿。
> - 昇格：Flash → Rapid。Inbox内の種をスコープ内の構造へ組み込む操作。
> - View状態：ズーム位置、折り畳み、選択など表示・操作に関わる状態。
> - 構造状態：ノード・親子関係・スコープ所属など実体構造に関わる状態。
> - コンテクストパッケージ：選択スコープ以下の構造を、外部AI等に渡す目的で自然言語化・圧縮した表現。
> 
> ---
> 
> ## 2. データモデル
> 
> ### 2.1 Nodeの必須属性（概念要件）
> - 一意ID（永続的）
> - 型（text/image/folder/alias）
> - 所属スコープ（実体は単一スコープに属する）
> - 親子関係（親ID、子ID列、順序）
> - 内容（text本文、image参照など。aliasは参照先ID）
> - 作成・更新時刻（最小限）
> 
> ### 2.2 制約
> - Nodeの一意性：実体ノード（text/image/folder）は一意の存在であり、複製による整合性崩壊を避ける。
> - 親子制約：主構造はツリーを基本とし、親子整合性（循環禁止、順序の一貫性）を保証する。
> - alias参照制約：aliasは text/image/folder のみ参照可能（alias→alias禁止）。
> - scope所属ルール：実体は単一スコープに所属し、他スコープからはaliasで参照する。
> - folderの特権性：folderは下位階層のrootであり、スコープ境界として可視性・探索・編集範囲を規定する。
> 
> ### 2.3 変更履歴・差分
> - Undoログ構造：全変更を「コマンド（操作）」として記録できる構造を前提にする。
> - 差分表現：将来、Deepの比較（思考比較）を可能にするため、差分抽出可能なログ設計を目標とする。
> - バージョン管理の可能性：Deepを設計図として扱うため、将来のバージョン履歴・比較へ拡張できる余地を残す。
> 
> ### 2.4 スキーマ
> - スキーマ定義：保存形式におけるデータ構造の設計図（Node/Edge/Scope/Alias/ログなど）。
> - スキーマ移行方針：将来の属性追加・形式変更に備え、スキーマバージョンを持ち、移行（変換）手段を用意できる設計を採用する。
> 
> ---
> 
> ## 3. 帯域設計
> 
> ### 3.1 Flash（反応／種）
> - 目的：閃き・割り込み・提案を逃さない即応性を最優先とする。
> - Inbox構造：Flashの受け皿としてInboxを持つ。種は未統合として扱い、Rapidへ組み込む導線を持つ。
> - 自動保存：入力直後に確実に保存されることを重視する。
> - 昇格条件：ユーザー操作により種を構造へ組み込む（Flash→Rapid）。
> - AI補助の範囲：Flash→Rapidの補助（候補提示、仮配置提案）は現実的価値が高い。
> - 削除と昇格の違い：昇格は状態の変化であり、削除ではない。種の履歴を消失させない。
> 
> ### 3.2 Rapid（作業／草稿）
> - 目的：普段の使用帯域。速度優先で思考整理を行う。
> - 速度優先原則：起動や操作は軽快であるべきだが、Flashほどの即応性は要求しない（FlashとRapidで要求水準を分ける）。
> - AI編集許容範囲：RapidではAI編集を許容する方向性がある（ただし承認が確定）。
> - 自動整形：ツリー自動整形を主とし、キャンバス上で操作する。
> - 構造変更：親子付け替え・折り畳みなどの構造操作が日常的に行える。
> 
> ### 3.3 Deep（構造化／設計図）
> - 目的：完成物ではなく変化し続ける設計図として構造を扱う。成果物そのものではないが、外部思考（AI対話等）に渡す設計図として有効。
> - 外部AI用コンテクスト生成：選択スコープ以下を自然言語化し、外部チャット等で利用可能な形に変換する。
> - 差分比較：思考の比較・進化の可視化を将来可能にする。
> - 抽象化：詳細度を上げる／圧縮するなど、設計図としての読解密度を高める。
> - AI介入方針：内部AIによる全面介入は信頼性の観点から現時点では抑制的だが、将来は介入範囲を拡張する余地を残す（境界は意図的に曖昧に保つ）。
> 
> ---
> 
> ## 4. UI / UX
> 
> - キーボード設計思想：Flash/Rapid/Deepで効率的なキー操作を重視し、予測可能性と安定性（消失バグなし）を採用基準とする。
> - Enter / Alt+Enter仕様：編集開始・確定・改行・兄弟追加などの仕様は「入力状態（選択/編集/IME）」に依存して一貫的に定義する。
> - IME考慮：日本語入力（変換中）とショートカットの衝突を避ける。
> - フォーカス状態定義：どの要素が入力を受け取るか（キャンバス/編集欄/検索等）を明確にし、誤作動を避ける。
> - ノード編集モード／選択モード：編集と操作の状態遷移を安定させる。
> - パン／ズーム／ドラッグ：キャンバス操作の誤作動防止を重視し、操作感は段階的に改善する。
> - 折り畳み：ツリー構造の可視性制御の中核。
> - スコープ遷移UI：folder[X]を開くと[X]をrootとするマップが広がる。Rapid/Deepは[X]のプロパティ（またはビュー状態）として決まる世界観。
> - 戻る動作：スコープ移動の往復が迷子にならない設計。
> - 全体俯瞰ビュー：全体を見渡すビューは必要だが、全ノードの完全描画を要求しない（要約/抽象化）。
> - 表示密度切替：Rapid/Deepの差は主に表示密度・読解密度として扱い、使いながら境界を調整する。
> - View状態保存：再起動後に同じ作業状態へ戻れること（ズーム位置・折り畳み・最後のスコープ等）。
> 
> ---
> 
> ## 5. キャンバス技術
> 
> - SVG vs Canvas：要素数・更新頻度に応じて選定する。一般に大量要素ではCanvasが有利になりやすい。
> - ヒットテスト方式：ズーム/パン下での選択判定を安定させる。
> - ビューポート仮想化：見えている範囲（および周辺）だけを描画・計算して性能を確保する。
> - レイアウトアルゴリズム：親子ツリーの自動整形を主軸にする。
> - 差分描画戦略：毎フレーム全更新を避け、変更があった部分中心に更新する。
> - パフォーマンス目標値：典型スコープ（~100ノード）で日常操作が快適であることを目標にする。
> - 100ノード基準設計：スコープ内操作は100ノード規模を基準に最適化する。
> - 1万ノード全体管理：全体ビューは要約/抽象化を用い、1万ノードの完全インタラクティブ描画を前提にしない。
> 
> ---
> 
> ## 6. 永続化
> 
> - IndexedDB設計：Webアプリのローカル永続化として採用候補。保存・復元の一致性を最優先する。
> - 保存単位：スコープ単位で閉じる設計が性能・整合性・将来同期に有利。全体としても参照整合性を維持する。
> - 自動保存間隔：実装は後で調整するが、消失防止を優先する。
> - 破損時の復旧戦略：最低限のバックアップ/復元導線を持つ。
> - バックアップ戦略：日常運用の安全策として手動でも成立する形式（例：JSON）を持つ。
> - ローカル専用方針：初期はローカル専用で成立させ、同期は先送り可能な領域とする。
> 
> ---
> 
> ## 7. スコープ設計
> 
> - folder世界の閉包性：原則としてスコープ内で完結し、外部は見せない。
> - aliasの跨ぎ方：他スコープはalias参照でのみ接続し、見えすぎを抑制する。
> - 複数タブ編集戦略：複数スコープを並行編集したい要求があるため、タブ/ビューの並行性と整合性を設計する。
> - scope単位ロック方針：同一スコープの同時編集を避けることで衝突を減らす。
> - スコープ間移動UX：移動と帰還がストレスなく行えること。
> - 参照整合性：参照先の変更（名称変更/移動/削除）とalias表示の整合を保つ。
> 
> ---
> 
> ## 8. Undo / 差分
> 
> - すべての変更をログ化するか：消失バグ防止・差分・履歴の観点からログ化は有効。
> - コマンドパターン採用：Undo/Redoと整合性を担保するため、操作をコマンドとして表現する。
> - ノード移動のUndo：親子付け替え、順序変更などを戻せる。
> - スコープ移動のUndo：必要に応じて扱う（ビュー状態と構造状態の分離に留意）。
> - 差分可視化の将来構想：Deepの比較・思考の進化追跡へ拡張。
> 
> ---
> 
> ## 9. AI統合
> 
> - Flash → Rapid補助：親候補・フォルダ候補・タイトル整形などの提案。
> - ノード追加提案：承認により確定することを前提とする。
> - 構造再整理提案：Rapidでの編集支援として検討。
> - Deep → 自然言語変換：外部AIに渡すためのコンテクスト化。
> - 自然言語 → 構造復元：将来課題。関係性明示やプロンプト設計が必要。
> - AI承認フロー：AIは提案であり、人間の承認が確定。
> - AI出力差分表示：採用の判断を容易にするための差分提示。
> - プライバシー方針：AI APIへ送る範囲は明示し、既定は送信最小化を志向する。
> 
> ---
> 
> ## 10. エクスポート / 連携
> 
> - Markdown：可読性重視。
> - Mermaid：構造の図的表現。
> - JSON：完全な保存・復元・移行の基礎。
> - 独自フォーマット：必要なら後で。
> - 外部チャット連携フォーマット：構造と関係性を明示して渡せる形式。
> - コンテクスト圧縮戦略：長すぎるコンテクストを避け、要約・抽象化を行う。
> 
> ---
> 
> ## 11. 非機能要件
> 
> - 起動時間：Flashは速さ命、Rapidは数秒の起動を許容するが日常運用で不満がない範囲。
> - 操作レスポンス：典型スコープでの快適さ。
> - メモリ使用量：iPad等も想定して肥大化を避ける。
> - データ安全性：消失バグゼロを最優先。
> - 安定性：保存・復元の一致性、クラッシュ耐性。
> - デバイス範囲：Mac/iPad優先。
> 
> ---
> 
> ## 12. 開発戦略
> 
> - 1ヶ月日常運用版：キー操作の効率と安定感（消失なし）を満たし、日常使用しながら改良できる水準。
> - 先送り可能問題：公開・課金・共有・多端末同期・本格ログ収集など。
> - テスト方針：消失防止を最優先し、保存→再起動→復元のリグレッションを重視。
> - コード生成エージェント：仕様が明確で自動テスト可能な領域（データモデル、コマンド、永続化、テスト）を中心に活用し、操作感に関わる領域は微調整可能にする。
> - UI改善サイクル：Rapidの操作感を最初に成立させ、その後Deep/Flashへ拡張。
> - 技術負債管理：触感プロトタイプとコアの二本立てで進め、早期に合流する。
> 
> ---
> 
> ## 13. 将来拡張
> 
> 
> The file is too long and its contents have been truncated.
> 

> [!abstract]- Tool (file_search)
> <sub>2026-04-17 14:10</sub>
> 
> Make sure to include fileciteturn1file3 in your response to cite this file, or to surface it as a link.
> 現時点であなたが置いている前提を整理すると、次のようになります。
> 
> **目的・用途**
> 
> 1. M3Eは思考整理ツール。
> 2. Flash → Rapid → Deep の三段階運用。
> 3. Rapid / Deep の運用イメージはほぼ確定している。
> 4. Flashは簡易メモ用途（当面テキストのみ）。
> 5. メールやDiscordなどからの取り込みは「手動収集ボタン」を押す日課型。
> 
> **実行環境**
> 
> 1. Mac上で利用。
> 2. Chromeブラウザで動作するWebアプリ。
> 3. TypeScriptを主要言語として採用。
> 
> **基本アーキテクチャ**
> 
> 1. MVC系構造を採用。
> 2. CoreはModel中心に設計。
> 3. 操作はCommandパターンでModelに適用。
> 4. Undo/RedoはModelが管理。
> 
> **責務分離**
> 
> Model
>  13. Node / Edge / Graph構造。
>  14. 整合性チェック。
>  15. Command適用。
>  16. Undo / Redo。
>  17. 永続化。
> 
> View
>  18. Canvas描画。
>  19. HitTest。
> 
> Controller
>  20. ユーザー入力処理。
>  21. Command生成。
> 
> ViewState（UI状態）
>  22. カメラ。
>  23. 選択状態。
>  24. hover。
>  25. drag中の仮位置。
> 
> **操作フロー**
> 
> 1. Browserイベント → Controller。
> 2. Controller → Command生成。
> 3. Controller → Model.apply(command)。
> 4. Model更新 → change通知。
> 5. View再描画。
> 
> **ドラッグ操作の方針**
> 
> 1. ドラッグ中はModelを書き換えない。
> 2. previewはViewStateで表現。
> 3. drop確定時のみCommandを発行。
> 4. 接続構造が変わるタイミングでのみModel更新。
> 
> **データ管理**
> 
> 1. Node IDは不変。
> 2. スキーマ変更はversion＋migrationで管理。
> 3. 破壊的変更は極力避ける。
> 
> **実装方針**
> 
> 1. 描画とデータ管理を分離。
> 2. Canvas系ライブラリを利用可能。
> 3. 操作ロジックはControllerに集中。
> 
> 以上が現在の仮定です。

> [!abstract]- Tool (file_search)
> <sub>2026-04-17 14:10</sub>
> 
> Make sure to include fileciteturn1file4 in your response to cite this file, or to surface it as a link.
> 当面の M3E は、独自エディタの開発を主目的としない。
> 既存の思考整理環境として Freeplane を採用し、日常の入力と構造化はその上で行う。
> M3E は Freeplane を置き換える製品ではなく、その外側で働く思考支援の層として再定義する。
> 中心に置く価値は、描画や同期ではなく、研究を進めるための論点整理と構造変換である。
> 具体的には、Freeplane 上の構造を読み取り、論点分解、比較軸整理、仮説整理などを補助する。
> 出力はまず提案として返し、人間が確認して採用する形を基本とする。
> これにより、基盤実装の負担を抑えつつ、思考支援そのものの有効性を先に検証する。
> 評価軸は機能数や収益ではなく、研究や設計の思考過程が実際に加速するかに置く。
> 独自 UI や専用アプリ化は否定せず、必要性が確認された段階で再検討する。
> すなわち M3E は、アプリ開発計画から、Freeplane を土台とした研究加速の思考エンジンへと方針転換する。

> [!abstract]- Tool (file_search)
> <sub>2026-04-17 14:10</sub>
> 
> Make sure to include fileciteturn1file5 in your response to cite this file, or to surface it as a link.
> # TheDesign — dev-docs 統合ドキュメント
> 
> > Auto-generated by `scripts/concat-dev-docs.sh` on 2026-04-04 08:12 UTC
> 
> ## Table of Contents
> 
> - **00_Home/**
>   - Current_Status.md
>   - Home.md
>   - Worktree_Separation_Rules.md
> - **01_Vision/**
>   - Core_Principles.md
> - **02_Strategy/**
>   - Current_Pivot_Freeplane_First.md
>   - MVP_Definition.md
> - **03_Spec/**
>   - AI_Common_API.md
>   - AI_Integration.md
>   - AI_Use_Cases.md
>   - Band_Spec.md
>   - Command_Language.md
>   - Data_Model.md
>   - Import_Export.md
>   - Linear_Tree_Conversion.md
>   - Model_State_And_Schema_V2.md
>   - Scope_Transition.md
>   - Scope_and_Alias.md
> - **04_Architecture/**
>   - AI_Infrastructure.md
>   - Drag_and_Reparent.md
>   - Editing_Design.md
>   - Layout_Algorithm.md
>   - MVC_and_Command.md
>   - Multi_Select.md
>   - Visual_Design_Guidelines.md
> - **05_Freeplane_Integration/**
>   - Freeplane_Data_Model_Mapping.md
> - **06_Operations/**
>   - Actions_Beta.md
>   - Agent_Roles.md
>   - Command_Panel_Security_Test_Cases.md
>   - Command_Reference.md
>   - Decision_Pool.md
>   - Documentation_Rules.md
>   - Integration_Handoff_260401_codex2.md
>   - Keybindings_Beta.md
>   - Keyboard_Reference_Beta.md
>   - README.md
>   - Test_and_CICD_Guide.md
>   - Todo_Pool.md
> - **09_Decisions/**
>   - ADR_001_Freeplane_First.md
>   - ADR_002_React_UI_Basis.md
>   - ADR_003_Freeplane_Informed_Custom_Engine.md
>   - ADR_004_SQLite_For_Rapid_MVP.md
>   - ADR_005_DataDir_Config.md
> - **/** (root)
>   - DragOperate.md
>   - M3E仕様2.md
>   - M3E仕様設計書.md
>   - README.md
> - **daily/**
>   - 260330.md
>   - 260331.md
>   - 260401.md
>   - 260402.md
>   - 260403.md
> - **freeplane/**
>   - Repository_Structure_Summary.md
> - **/** (root)
>   - freeplane利用について.txt
> - **ideas/**
>   - 20260330_dual_root_design_graph.md
>   - 260401_important_goal.md
>   - 260401_memo.md
>   - 260402subagent.md
>   - README.md
>   - security.md
> - **legacy/**
>   - Canvas_Centric_Architecture.md
>   - README.md
> - **/** (root)
>   - mindmapsoftwares.md
> - **tasks/**
>   - todo_by_role.md
> - **/** (root)
>   - use_WiseMapping.md
>   - use_freeplane.md
>   - use_obsidian.md
> 
> ---
> 
> 
> ## 00_Home
> 
> ### Current_Status.md
> 
> ```
> source: 00_Home/Current_Status.md
> ```
> 
> # Current Status
> 最終更新: 2026-04-02
> 
> ## 現在の状態（スナップショット）
> 
> - 開発の主対象: `beta/`
> - 運用方針:
>   - UpdateLog は `dev-docs/daily/YYMMDD.md` に追記
>   - 本ファイルは「現在状態」だけを保持
>   - 粗い TODO は `dev-docs/06_Operations/Todo_Pool.md` へ集約
> - 役割分担:
>   - 部下（codex1 / codex2）: 実装と daily 追記。`Current_Status.md` は read-only
>   - 上司（claude）: 部下 daily を参照して `Current_Status.md` の status 更新と統合管理
> 
> ## 統合フロー（強制）
> 
> 1. 部下は担当ブランチ（`dev-beta-visual` / `dev-beta-data`）へ push
> 2. 上司が `dev-beta` へ merge
> 3. 部下は次サイクル開始前に `origin/dev-beta` へ rebase
> 4. rebase 未実施の stale ブランチでは作業再開しない
> 
> ## In Progress
> 
> - ドキュメント運用を「daily + current snapshot + todo pool」に移行
> - セッション開始ゲート（1回のみ強制）を全体ルールへ反映済み
> - worktree 分離運用とブランチ責務の整合を強化中
> 
> ## Blocked / Risk
> 
> - `dev-docs/daily/260402.md` に競合解消の最終確認が必要
> - role 違反を機械的に止める CI チェックは未導入
> 
> ## Next 3
> 
> 1. `dev-docs/daily/260402.md` の内容整合を最終確認
> 2. branch-role と変更ファイル範囲の CI 検証を追加
> 3. `Todo_Pool.md` を実運用し、正式タスク化の流れを固定
> 
> ## 参照
> 
> - 運用ルール: `dev-docs/06_Operations/Documentation_Rules.md`
> - worktree 運用: `dev-docs/00_Home/Worktree_Separation_Rules.md`
> - rough task pool: `dev-docs/06_Operations/Todo_Pool.md`
> - 直近ログ: `dev-docs/daily/260402.md`
> 
> ---
> 
> ### Home.md
> 
> ```
> source: 00_Home/Home.md
> ```
> 
> # Home
> ## Operations
> 
> 会話や実装中に出た決定を先に保存する場所を追加した。
> 
> - 会話の決定は `../06_Operations/Decision_Pool.md`
> - 文書運用ルールは `../06_Operations/Documentation_Rules.md`
> - 並行開発時の worktree 分離運用は `./Worktree_Separation_Rules.md`
> - ここで育てた内容を `Spec` `Architecture` `ADR` へ昇格する
> 
> ## M3E とは何か
>  M3Eは科学研究のための枠組(フレームワーク)思考​支援を
> 目的としたGraph構造UIのツールです。目標として
> チャット形式のLLMの進化版となり、世界モデルを構築して
> 可視化・外在化し、意思決定を加速することを掲げます。
> 特徴としてこの文章のように構造と文章の相互変換、
> 構造(情報)の直接的な操作/やり取り、Flash/Rapid/Deepの
> 3つの思考の帯域のモード、範疇(Scope)の制御が有ります。
> ​
> 
> M3E は、科学研究を中心とした個人オフライン前提の思考ツールである。  
> 主目的は、研究の論点整理、仮説形成、比較、設計判断を、構造を保ったまま進められるようにすることにある。
> 
> 現時点では、独自エディタを先に完成させるのではなく、Freeplane を土台にして思考支援の有効性を検証する方針を採る。  
> 独自実装へ進む場合も、UI 全体は React コンポーネントで組み、マップ描画だけを独立したレンダリング層として切り出す。
> 
> ## この文書群の使い方
> 
> - 思想から入りたい場合は [../01_Vision/Core_Principles.md](../01_Vision/Core_Principles.md)
> - 今の方針を知りたい場合は [Current_Status.md](./Current_Status.md)
> - 何を作るかを知りたい場合は [../02_Strategy/MVP_Definition.md](../02_Strategy/MVP_Definition.md)
> - 実体モデルを知りたい場合は [../03_Spec/Data_Model.md](../03_Spec/Data_Model.md)
> - スコープ設計を知りたい場合は [../03_Spec/Scope_and_Alias.md](../03_Spec/Scope_and_Alias.md)
> - 実装責務を知りたい場合は [../04_Architecture/MVC_and_Command.md](../04_Architecture/MVC_and_Command.md)
> 
> ## 全体像
> 
> ### Vision
> 
> M3E の核は次の 4 点である。
> 
> - 科学研究を前に進めるための思考支援を主目的にする
> - 構造は親子を主軸に保つ
> - scope (範疇)で認知境界を制御する
> - alias で他スコープを参照する
> - AI は提案し、人間が確定する
> 
> ### Strategy
> 
> 現段階では、科学研究の思考支援として価値があるかの検証を優先する。  
> そのため、編集 UI・描画・永続化を最初から自作せず、Freeplane を既存の思考整理基盤として活用する。
> 
> ### Spec
> 
> 仕様の中核は次の通り。
> 
> - 実体ノードは永続 ID を持つ
> - 実体ノードは単一スコープに属する
> - alias は参照専用であり alias から alias は辿らない
> - 帯域は Flash / Rapid / Deep の 3 つ
> 
> ### Architecture
> 
> 独自実装へ進む場合の基本線は以下で固定する。
> 
> - Model が整合性と履歴を持つ
> - Controller が入力を解釈して Command を作る
> - UI shell は React コンポーネントで構成する
> - マップ描画は React から分離した専用レンダリング層として扱う
> - ドラッグ中の一時状態は ViewState に置く
> 
> ## 読むべき優先順
> 
> 1. 原則を確認する
> 2. 現在のピボットを確認する
> 3. MVP の範囲を確認する
> 4. 仕様とアーキテクチャに降りる
> 5. Freeplane との対応を確認する
> 6. 旧前提が必要なら `legacy/` を参照する
> 
> ---
> 
> ### Worktree_Separation_Rules.md
> 
> ```
> source: 00_Home/Worktree_Separation_Rules.md
> ```
> 
> # Worktree 分離運用ルール
> 
> 最終更新: 2026-04-01
> 
> ---
> 
> ## 目的
> 
> AI エージェント並行開発時のブランチ混在を防ぐため、担当ごとに Git worktree を分離して運用する。
> 
> ---
> 
> ## 役割と担当ブランチ
> 
> - `claude`: `dev-beta`（マージ、仕様、タスク管理、Final 反映）
> - `codex1`: `dev-beta-visual`（visual 関連）
> - `codex2`: `dev-beta-data`（model / controller 関連）
> - `akaghef`: 全体レビューと指示
> 
> ---
> 
> ## ディレクトリ割り当て（固定）
> 
> - `C:/Users/Akaghef/dev/M3E` -> `dev-beta`
> - `C:/Users/Akaghef/dev/M3E-dev-beta-visual` -> `dev-beta-visual`
> - `C:/Users/Akaghef/dev/M3E-dev-beta-data` -> `dev-beta-data`
> 
> 各担当は自分のディレクトリのみを VS Code で開く。
> 
> ---
> 
> ## 日次運用ルール
> 
> 1. 作業開始時に現在ブランチを確認する。
>    - `git branch --show-current`
> 2. pull / test / commit / push は必ず担当 worktree 内で実行する。
> 3. 共有時（画面共有、ペア作業）も、表示中のターミナルでブランチ名を都度確認する。
> 4. 役割外のブランチに切り替えない。必要時は `akaghef` にエスカレーションする。
> 
> ---
> 
> ## セッション開始ゲート（1回だけ）
> 
> 1. セッション開始時に次を 1 回だけ実施する。
>    - 役割確認
>    - ブランチ確認
>    - worktree / ディレクトリ確認
> 2. 以降は軽量チェックのみ継続する。
>    - ブランチと編集対象の整合
> 3. 毎ステップでルール全文を再確認する運用はしない。
> 
> ---
> 
> ## 変更・マージ方針
> 
> - `dev-beta-visual` と `dev-beta-data` の成果は `dev-beta` に統合する。
> - `final/` への反映は `scripts/final/migrate-from-beta.bat` 経由のみ。
> - `main` / release 系ブランチでの破壊的操作（history rewrite、force-push）は禁止。
> 
> ### 強制プロトコル（部下 -> 上司 -> 再開）
> 
> 1. 部下（`codex1` / `codex2`）は担当ブランチへ push する。
> 2. 上司（`claude`）が `dev-beta` へ merge する。
> 3. 部下は次サイクル着手前に最新 `origin/dev-beta` を自分の担当ブランチへ rebase する。
> 4. rebase 未実施の状態で実装を再開してはならない。
> 
> 部下側の最小手順:
> 
> ```bash
> git fetch origin
> git checkout dev-beta-visual   # codex2 の場合は dev-beta-data
> git rebase origin/dev-beta
> ```
> 
> ---
> 
> ## 初期セットアップ / 再作成
> 
> 既存 worktree がない場合は、リポジトリルートで以下を実行する。
> 
> ```bash
> git worktree add ../M3E-dev-beta-data dev-beta-data
> git worktree add -b dev-beta-visual ../M3E-dev-beta-visual dev-beta
> ```
> 
> 状態確認:
> 
> ```bash
> git worktree list
> ```
> 
> ---
> 
> ## 運用チェックリスト（最小）
> 
> - [ ] 正しいディレクトリを開いている
> - [ ] `git branch --show-current` が担当ブランチになっている
> - [ ] `git status` が想定どおりである
> - [ ] テスト実行後に commit / push している
> 
> ---
> 
> 
> ## 01_Vision
> 
> ### Core_Principles.md
> 
> ```
> source: 01_Vision/Core_Principles.md
> ```
> 
> # Core Principles
> 
> ## 目的
> 
> M3E は、科学研究を中心に、構造を保ったまま思考するための環境を目指す。  
> 汎用メモ整理よりも、研究課題の分解、仮説比較、前提整理、設計判断の支援を優先する。
> 
> ## 中核原則
> 
> ### 0. 科学研究を主対象にする
> 
> - 第一対象は科学研究の思考過程である
> - 論文読解、仮説形成、比較検討、研究設計を支える
> - 汎用化は否定しないが、初期最適化対象は研究用途に置く
> 
> ### 1. 個人オフラインファースト
> 
> - まず 1 ユーザーの個人利用に耐えることを重視する
> - 編集・閲覧・構造操作はオフラインで成立させる
> - 外部 AI は補助であり必須依存にしない
> 
> ### 2. 認知境界としての scope
> 
> - folder は単なる整理用ディレクトリではなく認知境界である
> - 現在の思考に不要な情報は基本的に見せない
> - 見せる必要があるときだけ alias を通じて参照する
> 
> ### 3. 主構造は親子
> 
> - 思考の骨格は親子ツリーで表現する
> - 補助線や自由接続は主構造を曖昧にしない範囲で扱う
> - 自動整形や折り畳みはこの骨格に対して行う
> 
> ### 4. 単一の実体、複数の見え方
> 
> - 実体は 1 つだけ持つ
> - 帯域や表示密度の違いはビュー差で扱う
> - 情報を複製して整合性を壊さない
> 
> ### 5. AI は提案、人間が確定
> 
> - AI が勝手に正本を書き換えない
> - 提案は差分として見える必要がある
> - 採用判断は常に人間が行う
> 
> ### 6. 消失バグゼロ優先
> 
> - 便利さよりも保存・復元の信頼性を優先する
> - Undo/Redo を含む変更履歴を重視する
> - 日常運用で壊れないことを最上位要件に置く
> 
> ## 反対側に置くもの
> 
> - ドキュメント中心の思考管理
> - 研究用途をぼかした汎用性優先
> - 常時すべてを露出するグローバル可視化
> - AI による無断編集
> - 初期段階でのマルチユーザー最適化
> 
> ## 関連文書
> 
> - 戦略: [../02_Strategy/Current_Pivot_Freeplane_First.md](../02_Strategy/Current_Pivot_Freeplane_First.md)
> - スコープ仕様: [../03_Spec/Scope_and_Alias.md](../03_Spec/Scope_and_Alias.md)
> - 帯域仕様: [../03_Spec/Band_Spec.md](../03_Spec/Band_Spec.md)
> 
> ---
> 
> 
> ## 02_Strategy
> 
> ### Current_Pivot_Freeplane_First.md
> 
> ```
> source: 02_Strategy/Current_Pivot_Freeplane_First.md
> ```
> 
> # Current Pivot: Freeplane-Informed Custom Engine
> 
> ## 判断
> 
> 当面の M3E は、Freeplane をそのまま土台 UI として使うのではなく、
> Freeplane を参考実装および互換入力形式として扱い、
> 描画と操作は M3E 側で自作する方針へ切り替える。
> 
> ## 背景
> 
> Freeplane-first は、研究支援価値の検証を早く進めるうえでは有効だった。
> しかし、M3E の独自価値が最終的に宿るのは、
> 研究思考に合った描画、操作、差分提示の設計そのものにある。
> 
> そのため、今後は次の前提で進める。
> 
> - Freeplane は参考実装として読む
> - `.mm` は互換入力形式として扱う
> - M3E の描画、操作、差分提示は独自実装する
> - レイアウト、モデル、描画を分離して将来拡張しやすくする
> 
> ## 何を Freeplane から学ぶか
> 
> - `.mm` の構造
> - ノードの `text` `details` `note` `attributes` `link`
> - 折り畳み、保存、既存運用の考え方
> - マインドマップ編集で必要になる最低限の操作要件
> 
> ## 何を M3E 側で自作するか
> 
> - 描画エンジン
> - ヒットテスト
> - 選択
> - パン、ズーム
> - ノード追加、編集、削除、再親付け
> - Undo/Redo
> - 構造の読み取りと変換
> - 論点分解
> - 比較軸整理
> - 仮説整理
> - 研究設計の整理
> - AI へのコンテクスト変換
> - 提案差分の提示
> 
> ## この方針の利点
> 
> - M3E 固有の思考支援 UI を最初から設計できる
> - Freeplane の制約に縛られずにモデル境界を保てる
> - 描画と操作を一体で設計できる
> - `.mm` 互換を保ちながら独自進化できる
> 
> ## この方針の制約
> 
> - 初期の実装コストは Freeplane-first より上がる
> - 描画、入力、永続化、Undo/Redo の品質を自分たちで担保する必要がある
> - Freeplane 互換範囲を意識しつつ独自モデルを保つ必要がある
> 
> ## 結論
> 
> Freeplane は最終形でも土台 UI でもなく、参考実装および互換入力形式である。
> M3E は独自の描画エンジンと操作系を持つ研究思考支援ツールとして進める。
> 
> ## 関連文書
> 
> - MVP 定義: [./MVP_Definition.md](./MVP_Definition.md)
> - Freeplane との写像: [../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md](../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md)
> - 新 ADR: [../09_Decisions/ADR_003_Freeplane_Informed_Custom_Engine.md](../09_Decisions/ADR_003_Freeplane_Informed_Custom_Engine.md)
> - 旧 ADR: [../09_Decisions/ADR_001_Freeplane_First.md](../09_Decisions/ADR_001_Freeplane_First.md)
> 
> ---
> 
> ### MVP_Definition.md
> 
> ```
> source: 02_Strategy/MVP_Definition.md
> ```
> 
> # MVP Definition
> 
> ## MVP の目的
> 
> M3E の MVP は、Freeplane を参考にしつつ、
> 独自描画エンジンと独自操作系を持つ研究思考支援ツールの最小成立形を示すことである。
> Freeplane の `.mm` マップは互換入力形式として受け取り、
> 研究思考支援に向けた最小の操作可能性を示す。
> 
> ## MVP の一貫した定義
> 
> MVP で成立している状態を、以下の 4 点で定義する。
> 
> 1. Freeplane の `.mm` を安定して読み取れる
> 2. M3E の最小モデルへ変換できる
> 3. 独自描画と最小編集操作を安全に扱える
> 4. 保存と再読込まで含めて日常利用で破綻しない
> 
> この段階では高度な UI 完成度までは要求しないが、
> 独自描画面が動いていること自体は MVP の成立条件に含める。
> 
> ## 実装の起点
> 
> - MVP は Rapid 帯域の最小実装から始める
> - Flash と Deep は後続フェーズで段階的に実装する
> - 今週は「Rapid で迷わず編集できること」を最優先にする
> 
> ## Freeplane をどう使うか
> 
> - Freeplane は参考実装および互換入力形式として使う
> - 最初の対象は `.mm` ファイルの import/export とする
> - Freeplane の UI や操作系をそのまま土台にはしない
> - Freeplane の内部概念に M3E 全体を押し込まない
> - `scope` `alias` などの M3E 固有概念は M3E 側の外部モデルで持つ
> 
> ## MVP で必須のこと
> 
> ### 1. 構造を読める
> 
> - Freeplane のマップ構造を読み取れる
> - ノード階層を安定して取得できる
> - 最低限の属性を扱える
> 
> 最低限の属性:
> 
> - `id`
> - `parentId`
> - `children`
> - `text`
> - `details`
> - `note`
> - `attributes`
> - `link`
> 
> ### 2. M3E 最小モデルへ変換できる
> 
> - Freeplane ノードを M3E ノードへ変換できる
> - 主構造は親子ツリーとして保持できる
> - `scope` は最初は推論対象または未設定でよい
> - M3E 固有意味は Freeplane の生属性から分離して保持する
> 
> ### 3. コア編集を安全に扱える
> 
> - 独自描画面の上で編集できる
> - ノード追加
> - ノード編集
> - ノード削除
> - 再親付け
> - Undo/Redo
> 
> ### 4. 本当に簡単に操作できる
> 
> - ノードを選択してすぐ編集できる
> - 主要操作が少ない手順で到達できる
> - 説明なしでも基本操作を試せる
> 
> ### 5. 保存して戻せる
> 
> - 保存前に不整合を検出できる
> - 保存 -> 再読込で同一構造を再現できる
> - Undo/Redo により編集事故を回復できる
> 
> ## MVP で後回しにすること
> 
> - 高性能な独自レンダリング最適化
> - 独自ドラッグ操作の作り込み
> - 高度なリアルタイム同期
> - マルチユーザー
> - 課金や公開サービス化
> - 完全な Deep 差分履歴
> - Freeplane API やスクリプトとの密結合
> - AI 提案生成と承認フロー
> 
> ## UI 方針
> 
> - UI shell は React + TypeScript ベースで進める
> - 描画は SVG 先行でよい
> - 描画層はレイアウト層と分離する
> - Canvas 移行可能性を保つため、描画面は差し替え可能な境界を持たせる
> - 独自描画面は MVP の一部である
> 
> ## Freeplane から参考にする部分
> 
> Freeplane から直接学ぶ価値が高いのは次の部分である。
> 
> - `.mm` の XML ベース構造
> - ノードの `text` `details` `note` `attributes` `link`
> - 折り畳み、ノード順序、ローカル保存
> - 既存の import/export と autosave の考え方
> 
> 逆に、そのまま採用しないものは次の通り。
> 
> - M3E 固有の `scope`
> - alias による厳密参照制約
> - command ベースの変更履歴
> - AI 提案と承認フロー (MVP 後)
> 
> ## MVP タスク一覧
> 
> ### Phase 1: 読み取り基盤
> 
> 1. Freeplane `.mm` 入力の最小実装
> 2. ノード階層パーサ実装
> 3. M3E 最小モデルへの変換
> 4. 整合性バリデータ実装
> 
> 受け入れ基準:
> 
> - サンプル 10 マップでクラッシュせず読み取れる
> - ツリー整合性エラーが明示される
> 
> ### Phase 2: コア編集機能
> 
> 1. ノード追加
> 2. ノード編集
> 3. ノード削除
> 4. 再親付け
> 5. Undo/Redo
> 
> 受け入れ基準:
> 
> - 4 操作すべてが Command 経由で実行される
> - Undo/Redo 連続 30 回で状態破綻しない
> 
> ### Phase 3: コア表示機能
> 
> 1. ノードと親子エッジの基本描画
> 2. 選択ノードの可視化
> 3. パン、ズーム、ノード中心移動
> 4. 500 ノード規模で最低性能確認
> 
> 受け入れ基準:
> 
> - 編集から描画更新まで 3 ステップ以内で確認できる
> - 500 ノードで致命的な遅延がない
> - 独自描画面の上で基本編集が成立する
> 
> ### Phase 4: 保存と保護
> 
> 1. 保存形式に version を付与
> 2. 保存前検証
> 3. バックアップ保存
> 4. 保存後再読込テスト
> 
> 受け入れ基準:
> 
> - 不正状態保存を拒否できる
> - 保存後再読込で同一構造が復元される
> 
> ### Phase 5: 操作性の最終調整
> 
> 1. 主要操作の導線を短くする
> 2. 操作ラベルと状態表示を整理する
> 3. 初見ユーザーでの簡易操作確認を行う
> 
> 受け入れ基準:
> 
> - 主要操作が迷わず実行できる
> - 最低 1 セッションを詰まらず完了できる
> 
> ## MVP 完了判定
> 
> 以下を満たしたら MVP とみなす。
> 
> - `.mm` を安定して読める
> - 独自描画面で基本表示と基本編集ができる
> - 最小編集が壊れずに動く
> - 保存後再読込で同一構造を再現できる
> - 初見でも基本操作を完了できる
> 
> ## 関連文書
> 
> - 現在の方針: [./Current_Pivot_Freeplane_First.md](./Current_Pivot_Freeplane_First.md)
> - データモデル: [../03_Spec/Data_Model.md](../03_Spec/Data_Model.md)
> - Freeplane 対応: [../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md](../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md)
> - 新 ADR: [../09_Decisions/ADR_003_Freeplane_Informed_Custom_Engine.md](../09_Decisions/ADR_003_Freeplane_Informed_Custom_Engine.md)
> - UI 基盤判断: [../09_Decisions/ADR_002_React_UI_Basis.md](../09_Decisions/ADR_002_React_UI_Basis.md)
> 
> ---
> 
> 
> ## 03_Spec
> 
> ### AI_Common_API.md
> 
> ```
> source: 03_Spec/AI_Common_API.md
> ```
> 
> # AI 共通 API 仕様
> 
> 最終更新: 2026-04-02
> 
> ## 目的
> 
> この文書は、M3E の AI 機能が共有する
> Node ローカル API の共通契約を定義する。
> 
> 対象は feature 個別の payload ではなく、
> provider 非依存で共通化される request / response / error / approval の枠組みである。
> 
> ## 適用範囲
> 
> 本仕様は次の feature に適用する。
> 
> - linear transform
> - title rewrite
> - duplicate check
> - suggest-parent
> - structure proposal
> - context package generation
> 
> feature 固有の入出力は本仕様の `input` / `proposal` / `result` に内包する。
> 
> ## 基本方針
> 
> 1. browser は外部 provider を直接呼ばない。
> 2. browser は localhost の Node API のみを呼ぶ。
> 3. provider 差分は server 側で吸収する。
> 4. AI の返答はそのまま正本に適用せず、提案または明示 result として返す。
> 5. 不正 payload や不完全 response は fail-closed で reject する。
> 
> ## エンドポイント
> 
> ### 共通 status
> 
> - `GET /api/ai/status`
> 
> 用途:
> 
> - AI 基盤が有効か
> - provider / transport / model が何か
> - feature 実行可能性の前提が揃っているか
> 
> ### 共通 subagent 実行
> 
> - `POST /api/ai/subagent/:name`
> 
> 用途:
> 
> - feature ごとの subagent 実行
> - 例:
>   - `/api/ai/subagent/linear-transform`
>   - `/api/ai/subagent/title-rewrite`
>   - `/api/ai/subagent/duplicate-check`
> 
> ### feature alias endpoint
> 
> feature ごとに専用 endpoint を持ってもよい。
> ただし内部的には共通 subagent 契約へ正規化する。
> 
> 例:
> 
> - `POST /api/linear-transform/convert`
>   - 内部的には `POST /api/ai/subagent/linear-transform`
> 
> ## 実装状況（2026-04-02）
> 
> | 項目 | 状態 |
> |------|------|
> | `GET /api/ai/status` | 実装済み |
> | `POST /api/ai/subagent/linear-transform` | 実装済み |
> | `POST /api/ai/subagent/topic-suggest` | 実装済み |
> | `openai-compatible` transport | 実装済み |
> | `mcp` transport | 未実装 |
> | `title-rewrite` | 未実装 |
> | `duplicate-check` | 未実装 |
> 
> ## 共通 status response
> 
> ```json
> {
>   "ok": true,
>   "enabled": true,
>   "configured": true,
>   "provider": "deepseek",
>   "gateway": "litellm",
>   "transport": "openai-compatible",
>   "model": "deepseek-chat",
>   "activeModelAlias": "chat.fast",
>   "availableModelAliases": ["chat.fast", "chat.local"],
>   "endpoint": "https://api.deepseek.com",
>   "message": "AI infrastructure is configured.",
>   "features": {
>     "linear-transform": {
>       "available": true,
>       "promptConfigured": true
>     },
>     "topic-suggest": {
>       "available": true,
>       "promptConfigured": true
>     },
>     "title-rewrite": {
>       "available": false,
>       "promptConfigured": false
>     }
>   }
> }
> ```
> 
> ### フィールド
> 
> - `ok`
>   - status endpoint 自体が成功したことを示す
> - `enabled`
>   - AI 基盤が全体として有効か
> - `configured`
>   - provider 接続に必要な設定が揃っているか
> - `provider`
>   - `deepseek` など
> - `gateway`
>   - `none` または `litellm`
> - `transport`
>   - `openai-compatible` または `mcp`
> - `model`
>   - 現在の既定モデル
> - `activeModelAlias`
>   - alias ベース解決時の既定 alias
> - `availableModelAliases`
>   - 基盤に登録された alias 一覧
> - `endpoint`
>   - provider endpoint または transport endpoint
> - `message`
>   - UI 表示用の短い説明
> - `features`
>   - feature ごとの可用性
> 
> ## 共通 request
> 
> `POST /api/ai/subagent/:name`
> 
> ```json
> {
>   "documentId": "rapid-main",
>   "scopeId": "n_root",
>   "provider": "default",
>   "modelAlias": "chat.fast",
>   "mode": "proposal",
>   "input": {},
>   "constraints": {
>     "timeoutMs": 15000,
>     "maxTokens": 1200,
>     "temperature": 0.2
>   },
>   "clientContext": {
>     "selectionNodeId": "n_child_1",
>     "requestId": "req-123"
>   }
> }
> ```
> 
> ### 必須フィールド
> 
> - `documentId: string`
> - `scopeId: string`
> - `input: object`
> 
> ### 任意フィールド
> 
> - `provider: "default" | string`
>   - `default` の場合は `M3E_AI_*` の現在設定を使う
> - `modelAlias?: string`
>   - alias registry を使う場合の明示指定
> - `mode: "proposal" | "direct-result"`
>   - `proposal`
>     - 承認前提の提案を返す
>   - `direct-result`
>     - 即利用可能な result を返す
>     - ただし正本自動更新を意味しない
> - `constraints`
>   - provider 呼び出しに対する上限制約
> - `clientContext`
>   - ログ相関や UI 復元用の補助情報
> 
> ## `input` の原則
> 
> `input` は feature ごとの payload を入れる。
> 
> 例:
> 
> ### linear-transform
> 
> ```json
> {
>   "direction": "tree-to-linear",
>   "sourceText": "...",
>   "scopeLabel": "Root"
> }
> ```
> 
> ### title-rewrite
> 
> ```json
> {
>   "nodeId": "n123",
>   "text": "長いラベル",
>   "details": "補足"
> }
> ```
> 
> ### duplicate-check
> 
> ```json
> {
>   "targetNodeId": "n123",
>   "targetText": "仮説A",
>   "neighborNodes": [
>     { "nodeId": "n9", "text": "仮説A改" }
>   ]
> }
> ```
> 
> ## 共通成功 response
> 
> ```json
> {
>   "ok": true,
>   "subagent": "linear-transform",
>   "provider": "deepseek",
>   "transport": "openai-compatible",
>   "model": "deepseek-chat",
>   "resolvedModelAlias": "chat.fast",
>   "mode": "proposal",
>   "requiresApproval": true,
>   "proposal": {
>     "kind": "text-transform",
>     "summary": "Tree scope was converted to linear text.",
>     "result": {
>       "outputText": "..."
>     }
>   },
>   "usage": {
>     "inputTokens": 320,
>     "outputTokens": 210,
>     "totalTokens": 530
>   },
>   "meta": {
>     "scopeId": "n_root",
>     "documentId": "rapid-main",
>     "latencyMs": 1240
>   }
> }
> ```
> 
> ### フィールド
> 
> - `ok`
> - `subagent`
> - `provider`
> - `transport`
> - `model`
> - `mode`
> - `requiresApproval`
> - `proposal`
> - `usage`
> - `meta`
> 
> ## `proposal` の共通形
> 
> ```json
> {
>   "kind": "text-transform",
>   "summary": "short human-readable summary",
>   "result": {},
>   "warnings": [],
>   "explanations": []
> }
> ```
> 
> ### 必須フィールド
> 
> - `kind`
> - `result`
> 
> ### 任意フィールド
> 
> - `summary`
> - `warnings`
> - `explanations`
> 
> ### `kind` の例
> 
> - `text-transform`
> - `title-candidates`
> - `duplicate-report`
> - `parent-candidates`
> - `structure-diff`
> - `context-package`
> 
> ## `result` の原則
> 
> `result` は feature ごとの正規化済みデータとする。
> 自由文だけを返すことは禁止する。
> 
> 許可される形:
> 
> - 構造化 object
> - 構造化 array
> - text を返す場合でも field 名を持つ object
> 
> 禁止:
> 
> - schema を持たない文字列 1 本返し
> - markdown 説明文のみ
> - provider 生レスポンスの透過返し
> 
> ## 共通失敗 response
> 
> ```json
> {
>   "ok": false,
>   "code": "AI_PROVIDER_UNAVAILABLE",
>   "error": "Provider request failed.",
>   "subagent": "linear-transform",
>   "provider": "deepseek",
>   "retryable": true,
>   "details": {
>     "transport": "openai-compatible"
>   }
> }
> ```
> 
> ### 必須フィールド
> 
> - `ok: false`
> - `code`
> - `error`
> 
> ### 任意フィールド
> 
> - `subagent`
> - `provider`
> - `retryable`
> - `details`
> 
> ## エラーコード
> 
> ### client/request 系
> 
> - `AI_INVALID_REQUEST`
> - `AI_DOCUMENT_ID_REQUIRED`
> - `AI_SCOPE_ID_REQUIRED`
> - `AI_INPUT_REQUIRED`
> - `AI_UNSUPPORTED_SUBAGENT`
> - `AI_UNSUPPORTED_MODE`
> - `AI_INPUT_TOO_LARGE`
> 
> ### config/infra 系
> 
> - `AI_DISABLED`
> - `AI_NOT_CONFIGURED`
> - `AI_TRANSPORT_NOT_IMPLEMENTED`
> - `AI_PROVIDER_NOT_SUPPORTED`
> 
> ### provider 実行系
> 
> - `AI_PROVIDER_UNAVAILABLE`
> - `AI_PROVIDER_TIMEOUT`
> - `AI_PROVIDER_RATE_LIMITED`
> - `AI_PROVIDER_BAD_RESPONSE`
> - `AI_PROVIDER_SCHEMA_MISMATCH`
> 
> ### feature 正規化系
> 
> - `AI_PROPOSAL_INVALID`
> - `AI_RESULT_INVALID`
> - `AI_APPROVAL_REQUIRED`
> 
> ## HTTP status の原則
> 
> - `200`
>   - status 成功
>   - subagent 実行成功
> - `400`
>   - request 不正
> - `404`
>   - subagent 不明
> - `409`
>   - feature 上の競合や approval 前提違反
> - `429`
>   - rate limit
> - `500`
>   - M3E 内部エラー
> - `502`
>   - provider 応答不正
> - `503`
>   - disabled / not configured / unavailable
> - `504`
>   - provider timeout
> 
> ## 承認境界
> 
> ### 原則
> 
> - AI の返答は既定で `requiresApproval: true`
> - `mode: "direct-result"` でも正本自動適用はしない
> - 正本への反映は別の command / apply endpoint で行う
> 
> ### 例外
> 
> 以下は `requiresApproval: false` を許してよい。
> 
> - context package text の生成
> - linear text の一時プレビュー生成
> - node metadata を変更しない読み取り専用提案
> 
> ただしこの場合も、
> 正本への write は別操作であることを保つ。
> 
> ## 監査ログ前提
> 
> 将来の監査ログのため、
> 少なくとも次を `meta` または内部ログで持てる構造にする。
> 
> - `documentId`
> - `scopeId`
> - `subagent`
> - `provider`
> - `requestId`
> - `latencyMs`
> - `usage`
> 
> ## feature alias endpoint との整合
> 
> 個別 endpoint は UI 実装を単純化するために許可する。
> ただし内部的には次の正規化を行う。
> 
> ```text
> Feature endpoint request
>   -> common subagent request
>     -> provider transport
>       -> normalized proposal/result
>         -> feature endpoint response
> ```
> 
> つまり、個別 endpoint は共通 API 契約の sugar であり、
> 別インフラを持ってはならない。
> 
> ## 初期導入順
> 
> 1. `GET /api/ai/status`
> 2. `POST /api/ai/subagent/linear-transform`
> 3. `POST /api/ai/subagent/title-rewrite`
> 4. feature alias endpoint の整理
> 5. approval / audit log 連携
> 
> ## 関連文書
> 
> - `./AI_Integration.md`
> - `../04_Architecture/AI_Infrastructure.md`
> - `./Linear_Tree_Conversion.md`
> 
> ---
> 
> ### AI_Integration.md
> 
> ```
> source: 03_Spec/AI_Integration.md
> ```
> 
> # AI連携仕様
> 
> 最終更新: 2026-04-02
> 
> ---
> 
> ## 基本原則
> 
> Core Principles §5 に従う。
> 
> - **AI は提案、人間が確定**。AI がユーザーの許可なく正本を書き換えることはない
> - 提案は差分として可視化し、採用・棄却を明示的に選択する
> - AI は外部依存であり、オフライン時も M3E の基本機能は成立する
> - API へ送信するデータ範囲はユーザーが把握・制御できる
> 
> ---
> 
> ## 文書の役割
> 
> - 本文書: AI 機能の導入段階、feature 要件、承認フロー
> - `../04_Architecture/AI_Infrastructure.md`: provider 接続、secret 注入、transport、責務分離
> - `./AI_Common_API.md`: 共通 API 契約、error code、proposal/result 正規形
> - `./AI_Use_Cases.md`: ユーザー視点の利用シナリオと優先順位のアイデア集
> 
> AI インフラの共通設計は上記 architecture 文書を正本とし、
> 本書では feature 側の仕様と段階導入に集中する。
> 
> ---
> 
> ## 連携フェーズ
> 
> ### Phase 0（現行）— 手動コンテクスト出力
> 
> ユーザーが手動でノード構造を外部 AI（Claude, ChatGPT 等）に貼り付けて対話する。
> M3E 側の実装は不要だが、**エクスポート品質**が連携の質を左右する。
> 
> 対応タスク:
> - Markdown エクスポート（インデント形式ツリー）
> - JSON エクスポート（完全構造）
> - コンテクストパッケージ（選択スコープ以下を自然言語化して圧縮した出力）
> 
> ---
> 
> ### Phase 1 — コンテクストパッケージ生成（Deep 連携）
> 
> 選択したスコープ以下の構造を、外部 AI に渡すためのテキストに変換する機能。
> 
> #### 出力形式
> 
> ```
> [スコープ名] についての構造化コンテクスト
> 
> # 主要ノード（階層）
> - 仮説A
>   - 前提1
>   - 前提2
> - 仮説B
>   ...
> 
> # 未整理メモ（Flash/Inbox）
> - ...
> 
> # 関連外部参照（alias）
> - [alias名] → [参照先スコープ名]
> ```
> 
> #### 設計要件
> 
> - 深さ・幅の上限を指定できる（コンテクスト長制御）
> - 未整理の Flash アイテム（Inbox）を区別して含める
> - alias は参照先名称だけを示し、実体データは含めない
> - 出力をクリップボードにコピーするアクションをワンステップで実行できる
> 
> #### UI
> 
> - 右クリックメニュー or ツールバーボタン「コンテクスト生成」
> - 生成プレビュー（モーダル）→ コピー or ファイル保存
> 
> ---
> 
> ### Phase 2 — Flash→Rapid 昇格支援
> 
> Flash の Inbox にある種を Rapid 構造へ組み込む際の配置候補提案。
> 
> #### 機能
> 
> | 提案内容 | 説明 |
> |---------|------|
> | 親候補提示 | 既存ノードの中から親として適切なノードを複数提案 |
> | フォルダ候補提示 | 所属スコープの候補を提案 |
> | タイトル整形 | 口語・断片テキストを簡潔なノードラベルに整形 |
> | 重複検出 | 既存ノードと意味的に重複している場合に警告 |
> 
> #### 承認フロー
> 
> ```
> Inbox アイテム選択
>   → [昇格] ボタン
>   → AI 提案パネルが表示（親候補リスト・整形タイトル）
>   → ユーザーが候補を選択 or 手入力
>   → 確定 → 構造に追加
> ```
> 
> - AI 提案をスキップして手動昇格も常に可能
> - 提案は「候補」として表示し、自動適用しない
> 
> ---
> 
> ### Phase 3 — インライン構造提案（Rapid 支援）
> 
> Rapid 帯域での編集中に、構造改善の提案を差分として表示する。
> 
> #### 提案種別
> 
> | 種別 | 内容 |
> |-----|------|
> | 分割提案 | 長すぎるノードを複数ノードに分割 |
> | 統合提案 | 類似ノードのまとめ |
> | 順序提案 | 兄弟ノードの並び替え（論理的順序） |
> | 親付け替え提案 | 誤配置ノードの再配置候補 |
> 
> #### 差分表示
> 
> - 提案は現在のツリーの上に「ghosted overlay」として表示
> - 変更対象ノードが色分け（追加: 緑、削除: 赤、移動: 黄）
> - 「採用」「棄却」「後で確認」の 3 択で応答
> - 部分採用（提案の一部だけ適用）が可能
> 
> ---
> 
> ### Phase 4 — Deep コンテクスト往復（将来）
> 
> Deep 構造を外部 AI に送り、AI の返答を差分として取り込む双方向連携。
> 
> #### フロー（概念）
> 
> ```
> Deep 構造 → コンテクストパッケージ生成
>   → AI API に送信（ユーザー確認後）
>   → AI 返答（テキスト or 構造化 JSON）
>   → M3E が差分として解釈
>   → ユーザーが採用・棄却を選択
>   → 採用分だけ構造に反映
> ```
> 
> #### 前提条件
> 
> - Phase 1 のコンテクストパッケージが安定していること
> - AI 返答の構造化解釈（JSON スキーマ合意）
> - 差分表示 UI（Phase 3）が実装済みであること
> 
> ---
> 
> ## API 設計方針
> 
> ### ローカル API サーバー経由
> 
> M3E の Node.js サーバーが AI API のプロキシとして振る舞う。
> ブラウザから直接外部 API を叩かない（CORS・キー管理のため）。
> 
> ```
> Browser → localhost API → Claude API (or local LLM)
> ```
> 
> ### エンドポイント（Phase 2 以降）
> 
> | エンドポイント | 説明 |
> |-------------|------|
> | `POST /api/ai/promote-suggestion` | Flash 昇格候補の取得 |
> | `POST /api/ai/structure-proposal` | 構造改善提案の取得 |
> | `POST /api/ai/context-package` | コンテクストパッケージ生成 |
> 
> ### Provider 抽象化（DeepSeek subagent 対応）
> 
> 外部 LLM 連携は provider 依存を避けるため、M3E 内部では共通インターフェースを使う。
> DeepSeek はその 1 provider として実装し、map 内補助は subagent 呼び出しとして扱う。
> 
> #### 目的
> 
> - map 編集体験を壊さずに、補助機能を「提案」として段階導入する
> - provider 切替（DeepSeek / Claude / local LLM）を UI と API 契約から分離する
> - 送信範囲・承認フロー・監査ログを provider 横断で統一する
> 
> #### 非目的
> 
> - AI による無承認の正本更新
> - provider 固有 SDK を browser 側に直接埋め込むこと
> - 1 回の呼び出しで複数スコープ全体を書き換えること
> 
> #### Subagent の責務（初期スコープ）
> 
> | subagent | 入力 | 出力 | map 反映 |
> |---|---|---|---|
> | `suggest-parent` | 対象ノード + 候補親集合 | 親候補ランキング | ユーザー承認後のみ |
> | `title-rewrite` | ノード text/details | 整形タイトル候補 | ユーザー承認後のみ |
> | `duplicate-check` | 対象ノード + 近傍ノード | 重複警告/類似候補 | 警告のみ |
> | `outline-expand` | 選択スコープ | 子ノード案（差分） | 差分採用時のみ |
> 
> #### 共通 API 契約（案）
> 
> 詳細は `./AI_Common_API.md` を正本とする。
> 
> 本書では次の原則のみ固定する。
> 
> - subagent 実行は `POST /api/ai/subagent/:name`
> - provider 差分は server 側で吸収する
> - AI 返答は proposal/result の正規形に落として返す
> - approval 要否は response に明示する
> 
> #### DeepSeek provider 設定（現行方針）
> 
> - 環境変数
>   - `M3E_AI_PROVIDER=deepseek`
>   - `M3E_AI_API_KEY`
>   - `M3E_AI_BASE_URL`（省略時は公式 URL）
>   - `M3E_AI_MODEL`
> - キー未設定時は fail-closed（subagent 機能を無効化して UI で通知）
> 
> #### 安全設計（Command Panel 方針との整合）
> 
> - 入力制限
>   - subagent は `scopeId` 配下だけを参照可能
>   - 最大ノード数・最大文字数を超える入力は送信前に拒否
> - 出力制限
>   - 返答は構造化 JSON のみ受理（自由文は説明欄に隔離）
>   - 未知フィールドは破棄し、必須フィールド不足時は reject
> - 実行制限
>   - タイムアウト、リトライ回数、レート制限を provider 横断で適用
>   - 失敗時は既存編集フローへ即時フォールバック（fail-closed）
> 
> #### 監査ログ（ローカル保存）
> 
> - 最低限の記録項目
>   - timestamp / documentId / scopeId / subagent / provider
>   - request hash（生データ全文は既定で保存しない）
>   - result code / latency / token usage
>   - user action（accept/reject/partial）
> 
> #### 段階導入計画
> 
> 1. Provider 抽象 API を追加（実体は既存 provider 1 つで可）
> 2. `title-rewrite` と `duplicate-check` から導入
> 3. 差分 UI と承認イベントのログ化
> 4. DeepSeek provider を追加し A/B 切替
> 5. `suggest-parent` / `outline-expand` を順次有効化
> 
> ### API キー管理
> 
> - キーはサーバーサイドの環境変数（`M3E_AI_API_KEY`）として保持
> - ブラウザには送出しない
> - キー未設定時は AI 機能を無効化し、その旨を UI に表示
> 
> ---
> 
> ## プライバシー設計
> 
> - **送信範囲の明示**: AI API に送るデータ（テキスト・構造）を送信前にユーザーに提示する
> - **スコープ単位制御**: 特定スコープを「AI 送信対象外」にマークできる（将来）
> - **ローカル LLM 対応**: API エンドポイントを差し替えることでオンプレミス LLM にも対応できる設計とする
> - **送信ログ**: 何を送信したかをローカルに記録する（オプション）
> 
> ---
> 
> ## 実装優先順位
> 
> | Phase | 内容 | 依存 | 優先度 |
> |-------|------|------|--------|
> | 0 | Markdown/JSON エクスポート強化 | なし | **今すぐ着手可能** |
> | 1 | コンテクストパッケージ生成 | エクスポート | Beta 安定後 |
> | 2 | Flash→Rapid 昇格支援 | Flash UI, API proxy | Phase 1 完了後 |
> | 3 | インライン構造提案・差分表示 | Phase 2, diff UI | Phase 2 完了後 |
> | 4 | Deep 往復連携 | Phase 1+3 | 将来 |
> 
> ---
> 
> ## 関連文書
> 
> - Core Principles: [../01_Vision/Core_Principles.md](../01_Vision/Core_Principles.md)
> - Band Spec: [Band_Spec.md](Band_Spec.md)
> - Data Model: [Data_Model.md](Data_Model.md)
> - M3E 仕様設計書 §9: [../M3E仕様設計書.md](../M3E仕様設計書.md)
> 
> ---
> 
> ### AI_Use_Cases.md
> 
> ```
> source: 03_Spec/AI_Use_Cases.md
> ```
> 
> # AI 利用シナリオ集
> 
> 最終更新: 2026-04-02
> 
> ## 目的
> 
> この文書は、M3E において AI をどのような場面で使うと価値が高いかを、
> ユーザー視点のアイデアとして整理する。
> 
> ここで扱うのは確定仕様ではなく、
> feature 検討・優先順位付け・UI 構想の材料である。
> 
> ## 前提
> 
> - AI は正本の自動編集者ではなく、提案・変換・整理補助として使う
> - ユーザーは思考の主体を維持したい
> - AI が使えない状態でも基本操作は成立する
> 
> ## 用法名
> 
> AI の使い方は、まず次の名前で呼ぶ。
> 
> ### 1. Flash Intake
> 
> 雑多な文書、ファイル、断片メモを
> まず Flash に取り込む用途。
> 
> 例:
> 
> - PDF やメモの内容を雑に取り込む
> - ファイル群から素材を入れる
> - まだ tree 構造を考えずに一時保管する
> 
> 考え方:
> 
> - import の受け皿は基本的に Flash でよい
> - この段階では整理より capture を優先する
> - AI は抽出・要約・分解の補助として使う
> 
> 向く機能:
> 
> - file import
> - text extraction
> - context package generation
> - Flash -> Rapid 昇格支援
> 
> ### 2. Rapid Expand
> 
> Rapid で考えている途中に、
> いま見ている scope のアイデアをワンクリックで広げる用途。
> 
> 例:
> 
> - 子観点を増やしたい
> - 仮説の枝を広げたい
> - 抜けている論点を見つけたい
> 
> 考え方:
> 
> - 既に tree で考えている最中なので、対象は current scope に限定する
> - 結果は subtree 差分として返す
> - 1 クリックで候補を出し、採用はユーザーが行う
> 
> 向く機能:
> 
> - outline-expand
> - structure-proposal
> - suggest-parent
> 
> ### 3. Rapid Polish
> 
> Rapid で組んだ tree を、
> 壊さずに見やすく整理する用途。
> 
> 例:
> 
> - ラベルを整える
> - 重複を見つける
> - 並びや親子関係の違和感を減らす
> 
> 向く機能:
> 
> - title-rewrite
> - duplicate-check
> - suggest-parent
> 
> ### 4. Deep Relay
> 
> ある scope を外部 AI に渡して、
> レビューや再構成を受ける用途。
> 
> 例:
> 
> - DeepSeek に論点レビューさせる
> - scope を読みやすい linear/context に変換して渡す
> - 提案を差分として持ち帰る
> 
> 向く機能:
> 
> - linear-transform
> - context-package
> - proposal import
> - diff-based apply
> 
> ## 大きな利用カテゴリ
> 
> ### 1. 構造化を速くする
> 
> ユーザーは最初から tree を丁寧に作るより、
> まず断片や箇条書きを高速に書き出したいことが多い。
> 
> AI はその粗い入力を tree 構造へ寄せる補助に向く。
> 
> 想定機能:
> 
> - linear -> tree 変換
> - tree -> linear 変換
> - outline expand
> - context package generation
> 
> ### 2. 整理の迷いを減らす
> 
> ノードが増えると、
> どこへ置くか、どう名付けるか、何が重複しているかで迷う。
> 
> AI は「答え」より「候補圧縮」に向く。
> 
> 想定機能:
> 
> - suggest-parent
> - title-rewrite
> - duplicate-check
> - structure-proposal
> 
> ### 3. 外部 AI との往復をしやすくする
> 
> Deep な検討では、
> ある scope を外部 AI に渡して要約・批評・再構成を受けたい場面がある。
> 
> AI 基盤はそのための安全な送信・整形・取り込み口になる。
> 
> 想定機能:
> 
> - context package export
> - deep review
> - proposal import
> - diff-based apply
> 
> ## ユーザー利用シーン
> 
> ### シーン A: まず雑に書いて、あとで構造化したい
> 
> 対応する用法名:
> 
> - `Flash Intake`
> 
> 状況:
> 
> - 研究メモや発想を書き殴っている
> - まだ親子関係を考えたくない
> 
> 欲しいこと:
> 
> - 箇条書きや段落を tree へ変換したい
> - 変換結果を見てから採用したい
> 
> 向く AI 機能:
> 
> - `linear-transform`
> 
> 価値:
> 
> - 入力速度を落とさずに構造化へ移れる
> 
> ### シーン B: 既存 tree を外部 AI に読ませやすくしたい
> 
> 対応する用法名:
> 
> - `Deep Relay`
> 
> 状況:
> 
> - ある scope を DeepSeek や他モデルに見せたい
> - 生の JSON では読ませにくい
> 
> 欲しいこと:
> 
> - tree から readable な linear/context へ変換したい
> - 送る範囲を scope 単位で制御したい
> 
> 向く AI 機能:
> 
> - `linear-transform`
> - `context-package`
> 
> 価値:
> 
> - map を崩さずに外部 AI 対話へ接続できる
> 
> ### シーン C: ノードの置き場所に迷う
> 
> 対応する用法名:
> 
> - `Rapid Polish`
> 
> 状況:
> 
> - ノードは書けたが、どの親の下に置くか迷う
> - 似た候補が複数ある
> 
> 欲しいこと:
> 
> - 親候補を 2-3 個出してほしい
> - なぜその候補なのか短く説明してほしい
> 
> 向く AI 機能:
> 
> - `suggest-parent`
> 
> 価値:
> 
> - tree の整理コストを下げる
> 
> ### シーン D: ラベルが長くて汚い
> 
> 対応する用法名:
> 
> - `Rapid Polish`
> 
> 状況:
> 
> - ノード text が長い
> - 口語やメモ断片のままで見通しが悪い
> 
> 欲しいこと:
> 
> - 短いラベル候補を複数ほしい
> - 元の意味を壊したくない
> 
> 向く AI 機能:
> 
> - `title-rewrite`
> 
> 価値:
> 
> - map の可読性を上げる
> 
> ### シーン E: 重複や近いノードを見つけたい
> 
> 対応する用法名:
> 
> - `Rapid Polish`
> 
> 状況:
> 
> - 同じような仮説や観察が増えてきた
> - 手で見比べるのが重い
> 
> 欲しいこと:
> 
> - 重複候補や類似ノードを教えてほしい
> - 統合するかは自分で決めたい
> 
> 向く AI 機能:
> 
> - `duplicate-check`
> 
> 価値:
> 
> - tree の肥大化を抑える
> 
> ### シーン F: ある scope をもう少し展開したい
> 
> 対応する用法名:
> 
> - `Rapid Expand`
> 
> 状況:
> 
> - 観点が足りない気がする
> - たたき台だけほしい
> 
> 欲しいこと:
> 
> - 子ノード案を差分として出してほしい
> - そのまま採用ではなく選択採用したい
> 
> 向く AI 機能:
> 
> - `outline-expand`
> - `structure-proposal`
> 
> 価値:
> 
> - 発想展開を加速できる
> 
> ### シーン G: 雑多なファイルをとにかく材料として入れたい
> 
> 対応する用法名:
> 
> - `Flash Intake`
> 
> 状況:
> 
> - PDF、議事録、web からのコピペ、メモ断片が混在している
> - どれが重要かまだ分からない
> 
> 欲しいこと:
> 
> - まず Flash に流し込みたい
> - 長文から箇条書き候補や断片カードを切り出したい
> - source を保持したまま後で見返したい
> 
> 向く AI 機能:
> 
> - `text extraction`
> - `context package generation`
> - `Flash -> Rapid 昇格支援`
> 
> 価値:
> 
> - import 前の整理コストを減らせる
> 
> ### シーン H: Flash に溜まった断片を Rapid に昇格したい
> 
> 対応する用法名:
> 
> - `Flash Intake`
> 
> 状況:
> 
> - Flash にメモが大量にある
> - どれを structure に上げるべきか迷う
> 
> 欲しいこと:
> 
> - 昇格候補をまとめて見たい
> - 既存 tree のどこに入るか候補がほしい
> - 類似ノードや重複も同時に知りたい
> 
> 向く AI 機能:
> 
> - `suggest-parent`
> - `duplicate-check`
> - `title-rewrite`
> 
> 価値:
> 
> - Flash が単なる墓場にならず、Rapid へ流し込みやすくなる
> 
> ### シーン I: scope の抜け論点を短時間で洗いたい
> 
> 対応する用法名:
> 
> - `Rapid Expand`
> 
> 状況:
> 
> - 今の subtree は一応できている
> - ただし抜けている観点がありそう
> 
> 欲しいこと:
> 
> - 「足りない観点」だけを追加候補で見たい
> - 現在の枝を壊さずに補完案を受けたい
> 
> 向く AI 機能:
> 
> - `outline-expand`
> - `structure-proposal`
> 
> 価値:
> 
> - 短時間で観点漏れチェックができる
> 
> ### シーン J: 行き詰まったときに別方向の切り口がほしい
> 
> 対応する用法名:
> 
> - `Rapid Expand`
> 
> 状況:
> 
> - 同じ観点で考え続けて煮詰まっている
> - 新しい軸だけ欲しい
> 
> 欲しいこと:
> 
> - 既存の子ノードを増やすのでなく、別の分類軸を提案してほしい
> - その場で 3-5 個だけ軽く出してほしい
> 
> 向く AI 機能:
> 
> - `outline-expand`
> - `structure-proposal`
> 
> 価値:
> 
> - 思考停止から抜けやすくなる
> 
> ### シーン K: subtree の並び順に違和感がある
> 
> 対応する用法名:
> 
> - `Rapid Polish`
> 
> 状況:
> 
> - 内容はある程度揃っている
> - ただし sibling 順が読みづらい
> 
> 欲しいこと:
> 
> - 並び替え候補を理由付きで見たい
> - 採用前に差分だけ確認したい
> 
> 向く AI 機能:
> 
> - `structure-proposal`
> 
> 価値:
> 
> - map の読み順が改善する
> 
> ### シーン L: subtree を人に見せる前に言い換えたい
> 
> 対応する用法名:
> 
> - `Rapid Polish`
> 
> 状況:
> 
> - 自分向けの雑なラベルで書いてきた
> - 共有前に少し整えたい
> 
> 欲しいこと:
> 
> - 専門用語を揃えたい
> - 曖昧なラベルを比較可能な表現にしたい
> 
> 向く AI 機能:
> 
> - `title-rewrite`
> 
> 価値:
> 
> - 共有品質を短時間で上げられる
> 
> ### シーン M: scope 単位で要約レビューを受けたい
> 
> 対応する用法名:
> 
> - `Deep Relay`
> 
> 状況:
> 
> - ある論点の subtree は育っている
> - でも全体として何が言えているかを外から見たい
> 
> 欲しいこと:
> 
> - scope を要約してほしい
> - 強い点と弱い点を指摘してほしい
> - 欠けている論点を返してほしい
> 
> 向く AI 機能:
> 
> - `context-package`
> - `deep review`
> 
> 価値:
> 
> - self-review を加速できる
> 
> ### シーン N: 外部 AI の返答を差分で持ち帰りたい
> 
> 対応する用法名:
> 
> - `Deep Relay`
> 
> 状況:
> 
> - DeepSeek に相談した
> - 返答の全部を鵜呑みにはしたくない
> 
> 欲しいこと:
> 
> - 返答を subtree 差分として見たい
> - 追加、移動、言い換えを分けて見たい
> - 部分採用したい
> 
> 向く AI 機能:
> 
> - `proposal import`
> - `diff-based apply`
> 
> 価値:
> 
> - 外部 AI の活用と M3E の正本管理を両立できる
> 
> ### シーン O: 研究ログから論点候補だけを抜きたい
> 
> 対応する用法名:
> 
> - `Flash Intake`
> 
> 状況:
> 
> - 日報、調査ログ、会議メモが長い
> - 全文を tree に入れたいわけではない
> 
> 欲しいこと:
> 
> - 論点候補だけ抽出したい
> - action、仮説、観察を分けてほしい
> 
> 向く AI 機能:
> 
> - `text extraction`
> - `Flash -> Rapid 昇格支援`
> 
> 価値:
> 
> - 長文から structure の種だけを拾いやすくなる
> 
> ### シーン P: いまの subtree を別表現で眺めたい
> 
> 対応する用法名:
> 
> - `Deep Relay`
> 
> 状況:
> 
> - tree のままだと見えにくい
> - 一度 linear や文章で眺めたい
> 
> 欲しいこと:
> 
> - current scope を別表現へ変換したい
> - 表現を見比べて structure の歪みを見つけたい
> 
> 向く AI 機能:
> 
> - `linear-transform`
> - `context-package`
> 
> 価値:
> 
> - 表現変換が思考点検になる
> 
> ## 優先順位の考え方
> 
> 初期に価値が出やすい順は次の通り。
> 
> 1. `linear-transform`
> 2. `title-rewrite`
> 3. `duplicate-check`
> 4. `suggest-parent`
> 5. `outline-expand`
> 6. `structure-proposal`
> 7. `context-package` の双方向化
> 
> 理由:
> 
> - Flash への intake は import 導線と相性がよい
> - Rapid 中の one-click 展開は体験価値が高く、AI らしさが出やすい
> - まず変換と軽い整理補助が最も日常頻度が高い
> - 親候補や構造提案は価値が高いが、誤提案時の UI と承認設計が重い
> - 双方向の deep 往復は最後に統合するのが安全
> 
> ## UI の示唆
> 
> この文書から見える UI の示唆:
> 
> - AI は常時自動実行より、明示操作のほうが合う
> - 提案は「採用/棄却/保留」がしやすい形で出すべき
> - 変換はプレビュー付きがよい
> - 送信範囲は scope 単位で見せるべき
> - 失敗時は手動操作へすぐ戻れるべき
> 
> ## 非目標
> 
> - AI に map 全体を自律編集させること
> - provider 固有機能をそのまま UI に出すこと
> - ユーザー承認なしで subtree を置換すること
> 
> ## 関連文書
> 
> - `./AI_Integration.md`
> - `./AI_Common_API.md`
> - `../04_Architecture/AI_Infrastructure.md`
> 
> ---
> 
> ### Band_Spec.md
> 
> ```
> source: 03_Spec/Band_Spec.md
> ```
> 
> # Band Spec
> 
> ## 概要
> 
> M3E は同一の基礎構造を、思考密度の異なる 3 つの帯域で扱う。
> 
> - Flash
> - Rapid
> - Deep
> 
> 帯域は別データではなく、同じ構造に対する作業態度と表示密度の違いである。
> 
> ## Flash
> 
> ### 役割
> 
> - 閃き
> - 割り込み
> - 一時メモ
> 
> ### 特性
> 
> - 即応性を最優先する
> - 種を逃さない
> - 当面は軽量なテキスト中心でよい
> 
> ### 主な操作
> 
> - すばやい記録
> - Inbox への蓄積
> - Rapid への昇格
> 
> ## Rapid
> 
> ### 役割
> 
> - 日常作業
> - 草稿整理
> - 速度優先の構造化
> 
> ### 特性
> 
> - 普段もっとも使う帯域
> - 自動整形と軽快な編集を重視する
> - 操作の迷いが少ないことを最優先する
> 
> ### 主な操作
> 
> - 親子編集
> - 折り畳み
> - 再配置
> - 構造の粗い整理
> 
> ### MVP での実装範囲 (今週)
> 
> 1. 表示
> 	- ルートから 2 階層以上を常時表示できる
> 	- 選択ノードが視覚的に分かる
> 2. 編集
> 	- 追加 (Enter)
> 	- 同階層追加 (Shift+Enter)
> 	- 編集開始 (F2 or ダブルクリック)
> 	- 削除 (Delete)
> 3. 構造操作
> 	- 再親付け (ドラッグ or キー操作)
> 	- 折り畳み/展開
> 4. 安全性
> 	- Undo/Redo
> 	- 保存前バリデーション
> 	- 保存 -> 再読込で構造一致
> 
> ### MVP 完了条件 (Rapid)
> 
> - 初見ユーザーが 5 分以内に「追加/編集/削除/再配置/保存」を完了できる
> - 30 回連続の Undo/Redo で破綻しない
> - 500 ノードで致命的な操作停止が発生しない
> 
> ## Deep
> 
> ### 役割
> 
> - 設計図化
> - 読解密度の高い整理
> - 外部 AI や外部対話に渡す前の構造化
> 
> ### 特性
> 
> - 完成物ではなく変化し続ける設計図
> - 差分比較や抽象化の余地を持つ
> - 詳細を圧縮しながら意味を保つ
> 
> ### 主な操作
> 
> - 構造の精緻化
> - 前提整理
> - 比較軸整理
> - コンテクストパッケージ生成
> 
> ## 帯域間の関係
> 
> - Flash は種を作る
> - Rapid は日常的に組み立てる
> - Deep は設計図として読み替える
> 
> ## 関連文書
> 
> - 原則: [../01_Vision/Core_Principles.md](../01_Vision/Core_Principles.md)
> - MVP: [../02_Strategy/MVP_Definition.md](../02_Strategy/MVP_Definition.md)
> 
> ---
> 
> ### Command_Language.md
> 
> ```
> source: 03_Spec/Command_Language.md
> ```
> 
> # M3E コマンド言語仕様
> 
> > **設計フェーズ:** Beta 以降の実装対象。MVP には未実装。
> 
> ---
> 
> ## 方針
> 
> **コマンド言語として JavaScript を採用する。**
> 
> M3E はブラウザ上の JS/TS で動作しており、モデルオブジェクトをグローバルに露出するだけで
> パーサー実装ゼロのコマンドインターフェースが実現できる。
> 
> ```javascript
> // ブラウザのコンソールから実行できる
> // 将来のコマンドパネルでは後述の Security Model に従って実行する
> const hypo = m3e.add(m3e.root, "仮説")
> m3e.attr(hypo, "status", "検証中")
> m3e.focus(hypo)
> ```
> 
> 変数・ループ・条件分岐・エラーハンドリングはすべて JS のセマンティクスに委ねる。
> カスタム DSL は導入しない。
> 
> ---
> 
> ## 露出するグローバルオブジェクト
> 
> ```typescript
> window.m3e  // M3E コマンド API
> ```
> 
> `m3e` はブラウザコンソールおよび将来のコマンドパネルから参照できる。
> 
> ---
> 
> ## Security Model（将来のコマンドパネル実装要件）
> 
> 本節は「コマンドパネル実装前に満たす必須条件」を定義する。
> 
> ### 脅威
> 
> - ユーザー入力をそのまま `eval` / `Function` / `new Function` で実行することによるコードインジェクション
> - DOM / `window` / `document` へのアクセスを経由した XSS
> - `fetch` など外部通信 API の悪用によるデータ流出
> 
> ### 必須要件（MUST）
> 
> 1. コマンドパネル実行系で `eval` / `Function` / `new Function` を使用しない。
> 2. 実行可能な文法は「M3E Command Script サブセット」に限定し、AST 検証で許可ノードのみ通す。
> 3. 実行コンテキストは `m3e` API と最小限ユーティリティのみを注入し、`window` / `document` / `globalThis` / `Function` / `XMLHttpRequest` / `fetch` にアクセス不可とする。
> 4. コマンドパネルからの外部ネットワークアクセスを禁止する。
> 5. コマンド実行前に「実行予定 API 一覧」と対象ノード数を表示し、明示承認後に実行する。
> 6. 実行ログは「時刻・呼び出し API・対象件数・成功/失敗」のみを保存し、入力全文の平文保存は既定で行わない。
> 7. 失敗時は fail-closed（実行中断）にする。
> 
> ### 推奨要件（SHOULD）
> 
> - 実行環境は Web Worker など分離コンテキストを使う。
> - 1 実行あたりの命令数・時間・変更件数に上限を設ける。
> - 危険操作（`del`, `move`, `replaceAll`）は dry-run プレビューを提供する。
> 
> ### 実装ガイド（段階導入）
> 
> - Phase A: ブラウザコンソールのみ（現状）。
> - Phase B: 読み取り専用コマンドパネル（`info`, `tree`, `find`, `findAll` 等）。
> - Phase C: 書き込み操作を許可（AST 検証 + 明示承認 + 監査ログが揃ってから）。
> 
> ### 禁止事項
> 
> - 「ユーザー入力を JS としてそのまま評価する」方式でのコマンドパネル実装。
> - CSP 緩和での暫定回避（`unsafe-eval` の追加など）。
> 
> ### 受け入れ条件
> 
> - セキュリティテストで、`window`, `document`, `fetch`, `Function` を参照する入力が拒否される。
> - コマンドパネル経由で許可 API 以外が呼べない。
> - 監査ログに操作概要が残り、入力全文が既定で保存されない。
> 
> 詳細テストケースは `../06_Operations/Command_Panel_Security_Test_Cases.md` を参照。
> 
> ---
> 
> ## ノード参照
> 
> | 表記 | 型 | 意味 |
> |------|----|------|
> | `m3e.root` | `string` | ルートノードの ID（プロパティ） |
> | `m3e.sel` | `string \| null` | 現在選択中のノード ID（読み取り専用プロパティ） |
> | `m3e.parent(id?)` | `string \| null` | 指定ノードの親 ID。省略すると選択中ノードの親 |
> | `m3e.children(id?)` | `string[]` | 指定ノードの子 ID 配列。省略すると選択中ノードの子 |
> | `m3e.node(id)` | `TreeNode` | ノードオブジェクトの深いコピーを返す（変更しても反映されない） |
> | `const id = ...` | `string` | JS 変数に束縛して後続で再利用 |
> 
> ```javascript
> const root     = m3e.root
> const selected = m3e.sel              // プロパティとして参照
> const parent   = m3e.parent()         // 選択中ノードの親
> const children = m3e.children(root)   // ルートの子 ID 配列
> const node     = m3e.node(selected)   // { id, text, note, ... } の深いコピー
> ```
> 
> ---
> 
> ## 暗黙ターゲット（Implicit Targets）
> 
> Excel のアクティブセルのように、**UI で選択中のノードを基準に操作できる**オブジェクト。
> ID を変数に束縛せずに操作したいときに使う。
> 
> | オブジェクト | 対象範囲 |
> |-------------|---------|
> | `m3e.active_node` | 選択中の単一ノード |
> | `m3e.active_branch` | 選択中ノードを根とする部分木（ノード＋全子孫） |
> | `m3e.active_scope` | 選択中ノードが属する最寄りの scope（`folder` 型の祖先ノード、なければルート） |
> 
> 各オブジェクトはメソッドを持つ。また `.id` プロパティで生の ID を取り出せる。
> 
> ```javascript
> // ID を使う従来の書き方
> const id = m3e.sel
> m3e.edit(id, "新ラベル")
> m3e.collapse(id)
> 
> // 暗黙ターゲットを使う書き方（同じ操作）
> m3e.active_node.edit("新ラベル")
> m3e.active_branch.collapse()
> ```
> 
> ### `m3e.active_node` のメソッド
> 
> 選択中の単一ノードに対して操作する。子孫には影響しない。
> 
> | メソッド | 動作 |
> |---------|------|
> | `m3e.active_node.edit(label)` | テキストを変更 |
> | `m3e.active_node.del()` | ノードと部分木を削除 |
> | `m3e.active_node.set(field, value)` | 拡張フィールドを設定 |
> | `m3e.active_node.unset(field)` | 拡張フィールドをクリア |
> | `m3e.active_node.attr(key, value)` | 属性を設定 |
> | `m3e.active_node.attrDel(key)` | 属性を削除 |
> | `m3e.active_node.setType(type)` | ノードタイプを変更 |
> | `m3e.active_node.info()` | ノード情報を返す |
> | `m3e.active_node.id` | ノード ID を返す（プロパティ） |
> 
> ```javascript
> m3e.active_node.edit("修正済み仮説")
> m3e.active_node.attr("status", "検証中")
> m3e.active_node.set("note", "先行研究 A と整合")
> m3e.active_node.info()
> 
> // ID が必要なときは .id で取り出す
> const id = m3e.active_node.id
> m3e.add(id, "子ノード")
> ```
> 
> ### `m3e.active_branch` のメソッド
> 
> 選択中ノードを根とする部分木全体に対して操作する。
> 
> | メソッド | 動作 |
> |---------|------|
> | `m3e.active_branch.collapse()` | 部分木を折り畳む |
> | `m3e.active_branch.expand()` | 部分木をすべて展開 |
> | `m3e.active_branch.move(newParentId)` | 部分木ごと別の親へ移動 |
> | `m3e.active_branch.clone(newParentId?)` | 部分木ごと複製 |
> | `m3e.active_branch.del()` | 部分木ごと削除 |
> | `m3e.active_branch.tree()` | 部分木の構造を文字列で返す |
> | `m3e.active_branch.findAll(text)` | 部分木内を検索 |
> | `m3e.active_branch.id` | 根ノードの ID（プロパティ） |
> 
> ```javascript
> m3e.active_branch.collapse()
> m3e.active_branch.expand()
> console.log(m3e.active_branch.tree())
> 
> // 選択ブランチを別の親に移動
> m3e.active_branch.move(m3e.find("実験計画"))
> 
> // ブランチを複製して派生案を作る
> const copy = m3e.active_branch.clone()
> m3e.select(copy)
> m3e.active_node.edit("派生案 B")
> ```
> 
> ### `m3e.active_scope` のメソッド
> 
> 選択中ノードが属する最寄りの scope（`folder` 型の祖先ノード）に対して操作する。
> scope が存在しない場合はルートが対象になる。
> 
> | メソッド | 動作 |
> |---------|------|
> | `m3e.active_scope.info()` | scope のノード情報を返す |
> | `m3e.active_scope.collapse()` | scope 以下を折り畳む |
> | `m3e.active_scope.expand()` | scope 以下をすべて展開 |
> | `m3e.active_scope.tree()` | scope の構造を文字列で返す |
> | `m3e.active_scope.findAll(text)` | scope 内を検索 |
> | `m3e.active_scope.id` | scope の根ノード ID（プロパティ） |
> 
> ```javascript
> // 今いる scope の構造を確認
> console.log(m3e.active_scope.tree())
> 
> // scope 内で検索
> m3e.active_scope.findAll("仮説").forEach(id => m3e.attr(id, "reviewed", "true"))
> 
> // scope を折り畳んで俯瞰する
> m3e.active_scope.collapse()
> m3e.focus(m3e.active_scope.id)
> ```
> 
> ### 暗黙ターゲットを引数として渡す
> 
> `.id` プロパティで ID が必要な既存メソッドと組み合わせられる。
> 
> ```javascript
> // 選択ブランチの根に子を追加
> m3e.add(m3e.active_branch.id, "新しい観点")
> 
> // 選択ノードの兄弟を追加
> m3e.sibling(m3e.active_node.id, "比較案")
> 
> // 選択 scope を基準にビューを合わせる
> m3e.focus(m3e.active_scope.id)
> m3e.select(m3e.active_scope.id)
> ```
> 
> ---
> 
> ## API リファレンス
> 
> ### ノード作成
> 
> #### `m3e.add(parentId, label, index?)`
> 
> `parentId` の子ノードを追加し、新しいノード ID を返す。
> `index` を省略すると末尾に追加。
> 
> ```javascript
> const obs  = m3e.add(m3e.root, "観察事実")
> const hypo = m3e.add(m3e.root, "仮説")
> const h1   = m3e.add(hypo, "温度上昇が主因")
> const top  = m3e.add(m3e.root, "最優先", 0)   // 先頭に挿入
> ```
> 
> #### `m3e.sibling(nodeId, label, after?)`
> 
> `nodeId` の兄弟ノードを追加し、新しいノード ID を返す。
> `after` を省略または `true` にすると直後、`false` にすると直前。
> 
> ```javascript
> const h2 = m3e.sibling(h1, "土壌劣化が主因")
> const h0 = m3e.sibling(h1, "前置き仮説", false)  // h1 の直前
> ```
> 
> ---
> 
> ### ノード編集
> 
> #### `m3e.edit(nodeId, newLabel)`
> 
> ノードのテキストを変更する。
> 
> ```javascript
> m3e.edit(m3e.sel(), "修正済みラベル")
> m3e.edit(h1, "仮説 A（検証済み）")
> ```
> 
> #### `m3e.del(nodeId)`
> 
> ノードとその部分木を削除する。ルートノードは削除不可（例外をスロー）。
> 
> ```javascript
> m3e.del(h2)
> ```
> 
> #### `m3e.move(nodeId, newParentId, index?)`
> 
> ノードを別の親の子として再配置する。
> `index` を省略すると末尾に追加。循環する移動は例外をスロー。
> 
> ```javascript
> m3e.move(h1, obs)       // obs の末尾へ
> m3e.move(h1, obs, 0)    // obs の先頭へ
> ```
> 
> #### `m3e.promote(nodeId)` / `m3e.demote(nodeId)`
> 
> 兄弟リスト内で1つ上／下に移動する。
> すでに先頭または末尾の場合は何もしない。
> 
> ```javascript
> m3e.promote(m3e.sel())
> m3e.demote(h1)
> ```
> 
> #### `m3e.clone(nodeId, newParentId?)`
> 
> ノードとその部分木を再帰的に複製し、新しいノード ID を返す。
> `newParentId` を省略すると元のノードと同じ親に追加される。
> 
> 複製時の各フィールドの扱い：
> - `text`, `details`, `note`, `attributes`, `link` はすべて値としてコピーする
> - `id` と `parentId` は新しい値が付与される（元 ID は引き継がない）
> - `link` フィールドに別ノードの ID が含まれていてもそのまま値コピーする（alias 解決は行わない）
> 
> ```javascript
> const copy  = m3e.clone(h1)          // h1 の兄弟として複製
> const copy2 = m3e.clone(h1, obs)     // obs の子として複製
> ```
> 
> ---
> 
> ### 選択・ナビゲーション
> 
> #### `m3e.sel`（プロパティ）
> 
> 現在選択中のノード ID を返す読み取り専用プロパティ。
> 選択を変更するには `m3e.select(id)` を使う。
> 
> ```javascript
> const current = m3e.sel             // 取得（プロパティ）
> ```
> 
> #### `m3e.select(nodeId)`
> 
> 指定したノードを選択する。
> 
> ```javascript
> m3e.select(hypo)
> m3e.select(m3e.root)
> ```
> 
> #### `m3e.nav(direction)`
> 
> ツリー構造上の相対位置へ選択を移動する。
> 
> | direction | 移動先 |
> |-----------|--------|
> | `"parent"` | 親ノード |
> | `"first"` | 最初の子ノード |
> | `"last"` | 最後の子ノード |
> | `"next"` | 次の兄弟ノード |
> | `"prev"` | 前の兄弟ノード |
> 
> ```javascript
> m3e.nav("parent")
> m3e.nav("first")
> m3e.nav("next")
> ```
> 
> ---
> 
> ### 折り畳み
> 
> #### `m3e.collapse(nodeId)` / `m3e.expand(nodeId)` / `m3e.toggle(nodeId)`
> 
> ```javascript
> m3e.collapse(m3e.root)
> m3e.expand(hypo)
> m3e.toggle(m3e.sel())
> ```
> 
> #### `m3e.collapseAll(nodeId?)` / `m3e.expandAll(nodeId?)`
> 
> 指定ノード以下の部分木を一括折り畳み／展開する。
> `nodeId` を省略するとルートから全体が対象。
> 
> ```javascript
> m3e.collapseAll()           // ツリー全体を折り畳む
> m3e.expandAll(hypo)         // hypo 以下をすべて展開
> ```
> 
> ---
> 
> ### 属性・メタデータ
> 
> #### `m3e.set(nodeId, field, value)`
> 
> 拡張フィールドを設定する。
> 
> | field | TreeNode フィールド |
> |-------|-------------------|
> | `"details"` | `details` |
> | `"note"` | `note` |
> | `"link"` | `link` |
> 
> ```javascript
> m3e.set(h1, "note", "先行研究 A, B と整合")
> m3e.set(h1, "link", "https://example.com/paper")
> ```
> 
> #### `m3e.unset(nodeId, field)`
> 
> 拡張フィールドを空文字にクリアする。
> 
> ```javascript
> m3e.unset(h1, "note")
> ```
> 
> #### `m3e.attr(nodeId, key, value)`
> 
> `attributes` マップにキーと値を設定する。
> 
> ```javascript
> m3e.attr(m3e.sel(), "status", "検証中")
> m3e.attr(m3e.sel(), "priority", "高")
> ```
> 
> #### `m3e.attrDel(nodeId, key)`
> 
> `attributes` マップから指定キーを削除する。
> 
> ```javascript
> m3e.attrDel(m3e.sel(), "status")
> ```
> 
> ---
> 
> ### 履歴
> 
> #### `m3e.undo()` / `m3e.redo()`
> 
> 操作を1ステップ巻き戻し／やり直す。
> スタックが空の場合は `false` を返す（例外はスローしない）。モデルは最大 200 件の履歴を保持する。
> 
> ```javascript
> m3e.undo()
> m3e.undo()
> m3e.redo()
> 
> // スタックが空かどうかの確認
> if (!m3e.undo()) console.log("これ以上戻れません")
> ```
> 
> ---
> 
> ### 読み取り・検索
> 
> #### `m3e.info(nodeId?)`
> 
> ノードオブジェクトの深いコピーを返す。
> `nodeId` を省略すると選択中ノードが対象。
> ブラウザコンソールで呼んだ場合は DevTools がオブジェクトを展開表示するため、別途 `console.log` は不要。
> 
> ```javascript
> m3e.info()
> // → { id: "n_1234_abc", text: "仮説 A", note: "...", attributes: { status: "検証中" }, ... }
> 
> const data = m3e.info(h1)
> console.log(data.text)
> ```
> 
> #### `m3e.tree(nodeId?)`
> 
> 指定ノード以下のツリー構造を文字列で返す。
> `nodeId` を省略するとルートから全体。折り畳まれたノードは `[+]` で表示。
> コンソールで確認する場合は `console.log(m3e.tree())` を使う。
> 
> ```javascript
> console.log(m3e.tree())
> // 気候変動と農業生産性
> //   ├─ 観察事実
> //   │   ├─ 収穫量が過去10年で15%減少
> //   │   └─ 降水パターンの変化
> //   └─ 仮説 [+]   ← 折り畳み中
> 
> console.log(m3e.tree(hypo))    // hypo 以下のみ
> const s = m3e.tree()           // 文字列として変数に取ることも可能
> ```
> 
> #### `m3e.find(text)`
> 
> テキストが部分一致する最初のノードの ID を返す。
> 一致なしの場合は `null` を返す（例外をスローしない）。
> 
> ```javascript
> const target = m3e.find("仮説 A")
> if (target) {
>   m3e.sel(target)
>   m3e.focus(target)
> }
> ```
> 
> #### `m3e.findAll(text)`
> 
> テキストが部分一致するすべてのノードの ID 配列を返す。
> 一致なしの場合は空配列 `[]` を返す。
> 
> ```javascript
> const results = m3e.findAll("仮説")
> results.forEach(id => m3e.attr(id, "reviewed", "true"))
> ```
> 
> ---
> 
> ### ビュー操作
> 
> #### `m3e.fit()`
> 
> ツリー全体が画面に収まるようにズーム・パンを調整する。
> 
> #### `m3e.focus(nodeId?)`
> 
> 指定ノードを画面中央に表示する。`nodeId` を省略すると選択中ノードが対象。
> 
> ```javascript
> m3e.focus(hypo)
> m3e.focus()       // 選択中ノードにフォーカス
> ```
> 
> #### `m3e.zoom(factor)`
> 
> ズーム倍率を数値で設定する（例: `0.5`, `1.5`）。
> 
> ```javascript
> m3e.zoom(0.5)
> m3e.zoom(1.5)
> ```
> 
> #### `m3e.zoomReset()`
> 
> ズームを等倍（1.0）に戻す。
> 
> ```javascript
> m3e.zoomReset()
> ```
> 
> #### `m3e.pan(dx, dy)`
> 
> キャンバスを指定ピクセル分パンする。
> 
> ```javascript
> m3e.pan(200, 0)    // 右に 200px
> m3e.pan(0, -100)   // 上に 100px
> ```
> 
> ---
> 
> ### ドキュメント管理
> 
> #### `m3e.new(rootLabel?)`
> 
> ツリーを初期化し新しいドキュメントを開始する。
> 未保存の変更がある場合は `confirm()` で確認する（ユーザーがキャンセルすれば何もしない）。
> 
> ```javascript
> m3e.new()
> m3e.new("新しい研究テーマ")
> ```
> 
> #### `m3e.save(filename?)`
> 
> 現在のツリーを `SavedDoc`（`version: 1`）形式でブラウザダウンロードとして保存する。
> ブラウザ環境のため任意のパスへの書き込みは行わない。`filename` を省略するとデフォルト名（`m3e-export.json`）を使用する。戻り値なし。
> 
> ```javascript
> m3e.save()
> m3e.save("research-2026.json")
> ```
> 
> #### `m3e.load(source)`
> 
> JSON または Freeplane `.mm` を読み込む。
> `source` には以下のいずれかを渡す：
> 
> | 型 | 動作 |
> |----|------|
> | `string`（URL またはサーバー相対パス） | `fetch()` で取得して読み込む |
> | `File` オブジェクト | File API で読み込む（`<input type="file">` からの参照） |
> 
> パスはサーバー起動時のルート（`http://localhost:38482/`）からの相対パス。
> **読み込み後、以前のセッションで使用していた JS 変数（ノード ID）は無効になる。**
> ファイルが見つからない、またはパースに失敗した場合は例外をスロー。
> 
> ```javascript
> m3e.load("data/rapid-sample.json")   // サーバー相対パス
> m3e.load("data/aircraft.mm")
> 
> // File ピッカーから取得した場合
> const [file] = document.querySelector("input").files
> m3e.load(file)
> ```
> 
> #### `m3e.export(format)`
> 
> 現在のツリーを指定フォーマットでブラウザダウンロードとして保存する。
> 
> | format | 出力 | 状態 |
> |--------|------|------|
> | `"json"` | M3E SavedDoc 形式（`save` と同等） | 実装済み相当 |
> | `"mm"` | Freeplane `.mm` 形式 | **未実装（Beta 以降）** |
> 
> ```javascript
> m3e.export("json")
> m3e.export("mm")   // 未実装時は例外をスロー: "mm export is not yet implemented"
> ```
> 
> ---
> 
> ## JS を使うことで解決される点
> 
> カスタム DSL では別途定義が必要だった以下の問題が JS のセマンティクスで自動的に解決される。
> 
> | 問題 | JS での解決 |
> |------|------------|
> | クォート・エスケープ | JS 文字列リテラルのルールをそのまま使う |
> | 空文字列 | `m3e.edit(id, "")` — JS の空文字列として有効 |
> | `find` が null の場合 | `if (target) { ... }` で標準的に対処 |
> | ループ・繰り返し処理 | `for`, `forEach`, `map` など JS ネイティブ |
> | 条件分岐 | `if`, `switch` など JS ネイティブ |
> | `undo` スタック空 | `false` を返す。`if (!m3e.undo())` で確認可能 |
> | 変数一覧 | ブラウザの DevTools で確認 |
> | スクリプトファイルの実行 | JS ファイルをコンソールに貼り付けまたは `<script>` タグで読み込み |
> | 複雑なエラー処理 | `try { ... } catch (e) { ... }` |
> | `sel` getter/setter 兼用の曖昧さ | `m3e.sel`（プロパティ）と `m3e.select(id)`（メソッド）に分離 |
> | `zoom` の型混在 | `m3e.zoom(factor)` は数値のみ、リセットは `m3e.zoomReset()` に分離 |
> | `node()` の書き換え防止 | `structuredClone()` で深いコピーを返す |
> | `info()`/`tree()` の二重出力 | `info()` は戻り値のみ（DevTools が表示）、`tree()` は文字列を返すのみ |
> 
> ---
> 
> ## 追加コマンド
> 
> ### マーク選択（複数ノードへの一括操作）
> 
> 単一選択に加えて、複数ノードをマークし一括操作できる。
> 
> #### `m3e.mark(nodeId)` / `m3e.unmark(nodeId)` / `m3e.clearMarks()`
> 
> ```javascript
> m3e.mark(h1)
> m3e.mark(h2)
> m3e.mark(h3)
> m3e.unmark(h2)         // 解除
> m3e.clearMarks()       // 全解除
> ```
> 
> #### `m3e.marked`（プロパティ）
> 
> マーク済みノード ID の配列を返す（読み取り専用）。
> 
> ```javascript
> // マーク済み全ノードに属性を一括設定
> m3e.marked.forEach(id => m3e.attr(id, "status", "レビュー済み"))
> 
> // マーク済みを全て折り畳む
> m3e.marked.forEach(id => m3e.collapse(id))
> ```
> 
> ---
> 
> ### 構造クエリ
> 
> ツリーの形を数値・配列で問い合わせる。
> 
> #### `m3e.depth(nodeId?)`
> 
> ルートからの深さを返す。省略すると選択中ノードが対象。
> 
> ```javascript
> m3e.depth()            // → 3
> m3e.depth(m3e.root)    // → 0
> ```
> 
> #### `m3e.count(nodeId?)`
> 
> 部分木のノード総数を返す（自身を含む）。省略すると選択中ノードが対象。
> 
> ```javascript
> m3e.count(hypo)        // → 12
> m3e.count(m3e.root)    // → ツリー全体のノード数
> ```
> 
> #### `m3e.leaves(nodeId?)`
> 
> 部分木内の葉ノード（子を持たないノード）の ID 配列を返す。
> 
> ```javascript
> m3e.leaves(hypo).forEach(id => m3e.attr(id, "leaf", "true"))
> ```
> 
> #### `m3e.ancestors(nodeId?)`
> 
> 対象ノードからルートまでの祖先 ID 配列を返す（近い順）。
> 
> ```javascript
> m3e.ancestors()        // → ["parent_id", "grandparent_id", ..., "root_id"]
> ```
> 
> #### `m3e.path(nodeId?)`
> 
> ルートから対象ノードまでの ID パスを返す（遠い順）。
> 
> ```javascript
> m3e.path(m3e.sel)      // → ["root_id", ..., "parent_id", "sel_id"]
> ```
> 
> ---
> 
> ### 検索・置換
> 
> #### `m3e.replaceAll(search, replacement, scopeRootId?)`
> 
> テキストが部分一致するすべてのノードのラベルを置換する。
> `scopeRootId` を省略するとツリー全体が対象。
> 
> ```javascript
> m3e.replaceAll("仮説", "Hypothesis")
> m3e.replaceAll("要検証", "要確認", m3e.active_scope.id)
> 
> // 件数を確認してから実行
> const targets = m3e.findAll("旧用語")
> console.log(`${targets.length} 件置換します`)
> targets.forEach(id => m3e.edit(id, m3e.node(id).text.replace("旧用語", "新用語")))
> ```
> 
> ---
> 
> ### ノードタイプの変更
> 
> #### `m3e.setType(nodeId, type)`
> 
> ノードの type を変更する。
> 
> | type | 意味 |
> |------|------|
> | `"text"` | 通常のテキストノード（デフォルト） |
> | `"folder"` | scope の根になるノード |
> | `"alias"` | 別ノードへの参照 |
> | `"image"` | 画像ノード |
> 
> ```javascript
> m3e.setType(m3e.sel, "folder")     // 現在のノードを scope の根にする
> m3e.active_node.setType("folder")  // 暗黙ターゲット版
> ```
> 
> `"alias"` に変更する場合は参照先 ID も必要（詳細は Scope_and_Alias.md 参照）。
> 
> ---
> 
> ## 組み合わせ例
> 
> ### 研究ツリーの構築
> 
> ```javascript
> m3e.edit(m3e.root, "気候変動と農業生産性")
> 
> const obs  = m3e.add(m3e.root, "観察事実")
> const hypo = m3e.add(m3e.root, "仮説")
> const exp  = m3e.add(m3e.root, "実験計画")
> 
> const o1 = m3e.add(obs, "収穫量が過去10年で15%減少")
> const o2 = m3e.add(obs, "降水パターンの変化")
> m3e.attr(o1, "status", "確認済み")
> m3e.attr(o2, "status", "要検証")
> 
> const h1 = m3e.add(hypo, "温度上昇が主因")
> m3e.set(h1, "note", "先行研究 A, B と整合")
> const h2 = m3e.sibling(h1, "土壌劣化が主因")
> 
> const e1 = m3e.add(exp, "温度と収穫量の相関分析")
> m3e.move(e1, exp, 0)
> 
> m3e.fit()
> m3e.focus(hypo)
> m3e.select(hypo)   // sel はプロパティなので変更は select() を使う
> ```
> 
> ### 検索・一括更新
> 
> ```javascript
> // "仮説" を含む全ノードに reviewed フラグを立てる
> m3e.findAll("仮説").forEach(id => {
>   m3e.attr(id, "reviewed", "true")
>   console.log(m3e.node(id).text, "→ reviewed")
> })
> ```
> 
> ### ツリーの整理
> 
> ```javascript
> m3e.collapseAll()
> m3e.expandAll(hypo)
> 
> m3e.promote(h2)   // 「土壌劣化が主因」を上へ
> 
> const h3 = m3e.clone(h1, hypo)
> m3e.edit(h3, "温度と土壌の複合要因")
> 
> console.log(m3e.tree(hypo))
> ```
> 
> ### 暗黙ターゲットを使った対話的操作
> 
> ```javascript
> // UIで「仮説」ノードを選択した状態でコンソールを開き、そのまま操作する
> 
> // 今選んでいるノードを確認
> m3e.active_node.info()
> 
> // ラベルを直すだけ
> m3e.active_node.edit("仮説（改訂版）")
> 
> // 下の枝を全部展開して構造確認
> m3e.active_branch.expand()
> console.log(m3e.active_branch.tree())
> 
> // この scope にある "要検証" を全部探して属性更新
> m3e.active_scope.findAll("要検証").forEach(id => {
>   m3e.attr(id, "status", "着手待ち")
> })
> 
> // 別の scope に枝ごと移動
> const dest = m3e.find("実験計画")
> m3e.active_branch.move(dest)
> ```
> 
> ---
> 
> ### エラー処理
> 
> ```javascript
> // ノードが見つからない場合の安全な処理
> const target = m3e.find("存在しないノード")
> if (!target) {
>   console.warn("ノードが見つかりませんでした")
> } else {
>   m3e.sel(target)
> }
> 
> // 例外をキャッチして継続
> try {
>   m3e.del(m3e.root)   // ルート削除は例外をスロー
> } catch (e) {
>   console.error(e.message)  // "Root node cannot be deleted."
> }
> ```
> 
> ---
> 
> ## エラー仕様
> 
> | 状況 | 動作 |
> |------|------|
> | 存在しないノード ID を渡す | 例外をスロー: `"Node not found: <id>"` |
> | ルートの削除・再配置 | 例外をスロー |
> | 循環する `move` | 例外をスロー: `"Cycle detected"` |
> | `find` / `findAll` で一致なし | `null` / `[]` を返す（例外なし） |
> | `undo` / `redo` でスタック空 | `false` を返す（例外なし） |
> | `load` でファイルが見つからない | 例外をスロー |
> | `new` で未保存変更あり | `confirm()` でユーザー確認。キャンセルで中断 |
> | `load` 後に古い ID を使用 | 次の操作で `"Node not found"` 例外をスロー |
> | 不正な `index` | 末尾挿入にフォールバック（例外なし） |
> 
> ---
> 
> ## 実装メモ
> 
> - `window.m3e` は `viewer.ts` の初期化完了後に代入する
> - 各メソッドは既存の `RapidMvpModel` のメソッドを薄くラップする
> - ビュー操作（`fit`, `focus`, `zoom`, `pan`）は `viewer.ts` の既存関数を呼び出す
> - `m3e.node(id)` の戻り値は読み取り専用コピー（直接変更しても反映されない）
> 
> ---
> 
> ## 関連文書
> 
> - モデルの操作 API: [../../mvp/src/node/rapid_mvp.ts](../../mvp/src/node/rapid_mvp.ts)
> - 編集設計: [../04_Architecture/Editing_Design.md](../04_Architecture/Editing_Design.md)
> - コマンド操作リファレンス（現 MVP のキー操作）: [../06_Operations/Command_Reference.md](../06_Operations/Command_Reference.md)
> 
> ---
> 
> ### Data_Model.md
> 
> ```
> source: 03_Spec/Data_Model.md
> ```
> 
> # Data Model
> 
> ## 目的
> 
> この文書は、M3E の実体モデルに関する不変条件を定義する。  
> 実装方式や UI に関係なく守るべき制約をここに置く。
> 
> ## 基本要素
> 
> ### Node
> 
> 思考要素の最小単位。型は以下を持つ。
> 
> - `text`
> - `image`
> - `folder`
> - `alias`
> 
> ### Edge
> 
> 主構造を表す親子関係。  
> M3E の骨格は親から子への有向ツリーとする。
> 
> ### Scope
> 
> `folder` を root とする可視性・編集範囲。  
> scope はストレージ単位ではなく認知境界である。
> 
> ## Node の必須属性
> 
> - 永続的な一意 ID
> - node type
> - 親 ID
> - 子 ID の順序列
> - 所属 scope（構造から導出される）
> - 内容
> - 作成時刻
> - 更新時刻
> 
> ## 型ごとの追加属性
> 
> ### text
> 
> - 本文
> 
> ### image
> 
> - 画像参照
> 
> ### folder
> 
> - 下位階層の root として振る舞う識別
> 
> ### alias
> 
> - 参照先 node ID
> 
> ## 不変条件
> 
> ### 一意性
> 
> - 実体ノードは複製しない
> - 参照は alias で行う
> 
> ### ツリー整合性
> 
> - 主構造に循環を作らない
> - 親子順序は安定して管理する
> 
> ### 所属
> 
> - 実体ノードは単一 scope にのみ属する
> - 他 scope から直接共有しない
> 
> ### scope 導出ルール（正規化）
> 
> - `scopeId` はノードに永続化しない
> - ノードの所属 scope は、祖先列で最も近い `folder` ノード ID から導出する
> - 祖先に `folder` が無いノードは document `rootId` に属するとみなす
> - `reparent` 時の scope 変更は `parentId` / `children` 更新のみで表現し、scope のカスケード更新は行わない
> 
> ### alias 制約
> 
> - alias は実体ノードのみを参照できる
> - alias から alias を参照しない
> 
> ## 変更履歴
> 
> - 変更は command として表現できる形にする
> - Undo/Redo を可能にする
> - 将来の差分比較に備える
> 
> ## スキーマ方針
> 
> - 保存形式は version を持つ
> - 破壊的変更には migration を用意する
> - 保存と復元で意味が変わらないことを重視する
> 
> ## 関連文書
> 
> - scope と alias の意味: [./Scope_and_Alias.md](./Scope_and_Alias.md)
> - state分離と schema v2: [./Model_State_And_Schema_V2.md](./Model_State_And_Schema_V2.md)
> - MVC と command: [../04_Architecture/MVC_and_Command.md](../04_Architecture/MVC_and_Command.md)
> - Freeplane への写像: [../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md](../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md)
> 
> ## Edge and Link Separation
> 
> M3E should distinguish `Edge` and `Link` as different concepts.
> 
> ### Edge
> 
> - expresses the primary parent-child tree structure
> - is part of the structural graph
> - participates in layout
> - is always derived from ownership relation
> 
> ### Link
> 
> - expresses non-tree relation between nodes
> - is an overlay relation, not a structural ownership relation
> - does not participate in layout
> - may later support relation type, label, direction, or styling
> 
> ## Graph-level Link 仕様
> 
> ### 目的
> 
> `Link` は tree の外側にある意味関係を表す。
> 
> - 因果
> - 参照
> - 補足
> - 対比
> - 関連
> 
> `Link` は親子の `Edge` を置き換えるものではない。
> 構造は `Edge`、非木関係は `Link` として分離する。
> 
> ### 保存単位
> 
> `Link` は node に埋め込まず、document 全体の relation 集合として持つ。
> 
> ```typescript
> interface AppState {
>   rootId: string
>   nodes: Record<string, TreeNode>
>   links?: Record<string, GraphLink>
> }
> 
> interface GraphLink {
>   id: string
>   sourceNodeId: string
>   targetNodeId: string
>   relationType?: string
>   label?: string
>   direction?: "none" | "forward" | "backward" | "both"
>   style?: "default" | "dashed" | "soft" | "emphasis"
> }
> ```
> 
> Beta では `links` は optional でよい。
> 未実装 viewer と既存 save data を壊さないためである。
> 
> ### 不変条件
> 
> #### 1. endpoint の存在
> 
> - `sourceNodeId` と `targetNodeId` は、保存時点で実在ノードを指す必要がある
> - どちらかが欠けた `Link` は broken relation として保存しない
> 
> #### 2. alias endpoint
> 
> - `Link` の endpoint は実体ノードを既定対象とする
> - alias ノードを endpoint として許可するかは Beta では保留とする
> - Beta 実装の既定は「alias endpoint を禁止」でよい
> 
> #### 3. self link
> 
> - `sourceNodeId === targetNodeId` の self link は既定では禁止する
> - 特殊用途が必要になった時だけ再検討する
> 
> #### 4. layout 非参加
> 
> - `Link` は node 座標決定に影響しない
> - `Link` の追加・削除だけで subtree placement を変えない
> 
> #### 5. ownership 非参加
> 
> - `Link` は所有権や親子順序を変えない
> - `Link` は `scope` 所属決定の根拠に使わない
> - `Link` は delete / reparent / alias 規則を上書きしない
> 
> ### node-level `link` との分離
> 
> - `TreeNode.link` は URL や外部参照などの node 属性である
> - `GraphLink` は node 間の relation line である
> - 名前が似ていても、保存場所・意味・描画方法は別である
> 
> ### 操作単位
> 
> 将来の command 層では、少なくとも以下を分けて持つ。
> 
> - `createLink`
> - `updateLink`
> - `deleteLink`
> 
> node 編集 command と混在させない。
> 
> ### delete / move 時の扱い
> 
> #### node delete
> 
> - endpoint node が削除されたら、接続している `Link` は同時に削除する
> - broken endpoint を持つ `Link` を残さない
> 
> #### node move / reparent
> 
> - `Link` は endpoint の ID 参照を維持する
> - node が別親や別 scope に移動しても `Link` 自体は消えない
> - ただし viewer は scope 表示ポリシーに応じて非表示にしてよい
> 
> ### Beta 実装で先に固定すること
> 
> - `AppState.links` を relation 集合として持てるようにする
> - endpoint は実体ノードのみを対象とする
> - self link は禁止する
> - layout 非参加を前提に overlay 描画とする
> - node-level `link` と graph-level `Link` を絶対に混同しない
> 
> ### Beta 実装でまだ保留にすること
> 
> - relationType の語彙セット
> - link label の編集 UI
> - arrowhead と direction の表示仕様
> - cross-scope link をどこまで常時表示するか
> - alias endpoint を許可するか
> - `.mm` import/export への写像
> 
> ### Important Note
> 
> Freeplane-imported node-level `link` values and future graph-level `Link` relations are not the same thing.
> 
> - node-level `link`: external or attached link stored on a node
> - graph-level `Link`: relation line between nodes inside the map
> 
> These must remain separate in model design.
> 
> ## データベース選定方針
> 
> ### 現時点の結論
> 
> Rapid MVP では、SQLite を persistence layer として採用する。
> 
> 優先順位は以下とする。
> 
> 1. 論理正本は JSON document model とする
> 2. Rapid MVP の永続化実装は SQLite とする
> 3. `.mm` は import/export 互換フォーマットとして維持する
> 4. PostgreSQL はサーバー要件が固まった段階で再評価する
> 
> ### なぜ SQLite を採るか
> 
> MVP の主目的は以下である。
> 
> - viewer/editor を素早く成立させる
> - save/load の境界を安定させる
> - Freeplane `.mm` との往復可能性を保つ
> - ローカルで壊れずに編集できることを優先する
> 
> SQLite は上記目的に対して、実装コストと運用コストを抑えつつ必要な永続化を提供できる。
> 
> - ローカル前提で完結できる
> - デモ手順を単純化できる
> - save/load デバッグがしやすい
> - 将来の migration に備えた version 管理と相性が良い
> 
> ### なぜ今は PostgreSQL を採らないか
> 
> Rapid MVP の現状課題は DB スケールではなく、編集体験・保存境界・表示安定性にある。
> この段階で PostgreSQL のようなサーバー DB を先に入れると、以下の負債が増える。
> 
> - バックエンド実装
> - 認証と接続管理
> - マイグレーション運用
> - 起動手順とデモ手順の複雑化
> - 保存失敗時の原因切り分けの増加
> 
> ### JSON を正本にする理由
> 
> - 現在の model は木構造であり、JSON で素直に表現できる
> - `.mm` import/export と対応づけやすい
> - デバッグ時に内容を直接読める
> - 差分確認と fixture 化がしやすい
> - migration を version フィールドで段階的に扱いやすい
> 
> 特に MVP では、「保存内容を人間が読める」「壊れた時にすぐ確認できる」ことを重視する。
> 
> ### PostgreSQL の再評価条件
> 
> - 複数端末同期が MVP 範囲に入る
> - 共有編集またはユーザー単位の保存が必要になる
> - 履歴、監査、検索をサーバー側で持つ必要が出る
> - map がローカルファイル運用では扱いにくい規模になる
> - バックアップ、復元、権限制御がプロダクト要件になる
> 
> ### 将来 DB 導入時の第一候補
> 
> 将来サーバー導入が必要になった場合の第一候補は PostgreSQL とする。
> 
> 理由:
> 
> - 汎用性が高い
> - JSONB を併用しやすい
> - 関係データと半構造化データの両方を扱いやすい
> - 将来の履歴、監査、共有機能に発展させやすい
> 
> ただしこれは「MVP 今すぐ採用」ではなく、「サーバー導入が必要になった時の有力候補」である。
> 
> ---
> 
> ### Import_Export.md
> 
> ```
> source: 03_Spec/Import_Export.md
> ```
> 
> # Import / Export 仕様
> 
> > **MVP 対応状況を含む。** 未実装のものは「未実装」と明記する。
> 
> ---
> 
> ## 全体方針
> 
> - M3E の正本は **SavedDoc JSON**（`version: 1`）とする
> - 外部フォーマットは「入口・出口」であり、正本には常に M3E 形式に変換してから取り込む
> - ラウンドトリップ（M3E → 外部 → M3E）で意味が保たれることを重視する
> - 外部フォーマットで表現できない M3E 固有の概念（scope・alias 等）は、エクスポート時に落とすか属性として退避する
> 
> ---
> 
> ## フォーマット一覧
> 
> | フォーマット | Import | Export | 状態 |
> |-------------|--------|--------|------|
> | M3E SavedDoc JSON | ✅ | ✅ | 実装済み |
> | SQLite（内部永続化） | ✅ | ✅ | 実装済み |
> | Freeplane `.mm` | ✅ | ❌ | Import のみ実装済み |
> | インデントテキスト | ❌ | ❌ | 未実装（将来対応候補） |
> | Markdown | ❌ | ❌ | 未実装（将来対応候補） |
> 
> ---
> 
> ## 内部フォーマット
> 
> ### SavedDoc JSON（`version: 1`）
> 
> M3E の正本フォーマット。ファイル保存・ブラウザダウンロード・SQLite 内部保存に使用する。
> 
> **スキーマ:**
> 
> ```typescript
> interface SavedDoc {
>   version: 1
>   savedAt: string        // ISO 8601 タイムスタンプ
>   state: AppState
> }
> 
> interface AppState {
>   rootId: string
>   selectedId?: string
>   nodes: Record<string, TreeNode>
>   links?: Record<string, GraphLink>
> }
> 
> interface TreeNode {
>   id: string
>   parentId: string | null
>   children: string[]     // 順序付き子 ID 配列
>   text: string
>   collapsed: boolean     // 折り畳み状態。PersistedDocument の一部として保存する
>   details: string
>   note: string
>   attributes: Record<string, string>
>   link: string
> }
> 
> interface GraphLink {
>   id: string
>   sourceNodeId: string
>   targetNodeId: string
>   relationType?: string
>   label?: string
>   direction?: "none" | "forward" | "backward" | "both"
>   style?: "default" | "dashed" | "soft" | "emphasis"
> }
> ```
> 
> **保存・読み込みの動作:**
> 
> | 操作 | 動作 |
> |------|------|
> | ブラウザダウンロード | pretty-print JSON、ファイル名 `rapid-edited.json`（固定） |
> | Node.js ファイル書き出し | `fs.writeFileSync` でUTF-8 pretty-print |
> | 読み込み | `version === 1` と `state` の存在を検証後、モデル不変条件を再検証 |
> 
> **既知の制限:**
> - ダウンロードファイル名が `rapid-edited.json` 固定（未改善）
> - `selectedId` は保存されるが、読み込み後に UI に反映されるかは実装依存
> - `links` は仕様追加済みだが Beta viewer/save-load では未実装
> 
> ### Graph-level `Link` の保存方針
> 
> - `AppState.links` は graph-level relation line の保存先とする
> - `TreeNode.link` は node-level の外部リンク属性として残す
> - 両者を相互変換しない
> 
> **保存制約:**
> 
> - `sourceNodeId` / `targetNodeId` は実在ノードを指す必要がある
> - self link は保存しない
> - alias endpoint は Beta では未対応として保存拒否でよい
> - node delete 時に endpoint を失う `Link` は同時削除する
> 
> ---
> 
> ### SQLite 内部永続化
> 
> `rapid-mvp.sqlite` に SavedDoc の JSON を列として格納する。
> ファイル保存の代替ではなく、ブラウザリロード後も状態を維持するための層。
> 
> **スキーマ:**
> 
> ```sql
> CREATE TABLE documents (
>   id       TEXT PRIMARY KEY,
>   version  INTEGER NOT NULL,
>   saved_at TEXT NOT NULL,
>   state_json TEXT NOT NULL
> )
> ```
> 
> **動作:**
> - 保存: `INSERT ... ON CONFLICT DO UPDATE`（UPSERT）で冪等
> - 読み込み: `state_json` をパースし、SavedDoc と同じ検証を適用
> - JSON 形式は SavedDoc の `state` フィールドと同一
> 
> **データファイルの場所:** `mvp/data/rapid-mvp.sqlite`（`.gitignore` で除外）
> 
> ---
> 
> ## 外部フォーマット
> 
> ### Freeplane `.mm`（Import のみ実装済み）
> 
> Freeplane の XML ベースのマインドマップ形式。
> 
> #### Import
> 
> **パース対象フィールド:**
> 
> | `.mm` の要素 | M3E の `TreeNode` フィールド | 備考 |
> |-------------|---------------------------|------|
> | `node TEXT` 属性 | `text` | 主テキスト |
> | `node FOLDED` 属性 | `collapsed` | `"true"` → `true` |
> | `node LINK` 属性 | `link` | 外部リンク URL |
> | `richcontent TYPE="NODE"` | `text` | TEXT 属性がない場合のフォールバック |
> | `richcontent TYPE="DETAILS"` | `details` | 詳細テキスト |
> | `richcontent TYPE="NOTE"` | `note` | ノートテキスト |
> | `attribute NAME VALUE` | `attributes[NAME]` | 任意キーバリュー |
> | 子 `node` 要素 | `children`（再帰） | 順序を維持 |
> 
> **取り込まれないフィールド:**
> 
> | `.mm` の要素 | 理由 |
> |-------------|------|
> | スタイル・色・フォント | M3E は独自スタイルを持つ |
> | `CREATED` / `MODIFIED` | M3E の ID に埋め込み済み（`n_<timestamp>_<rand>`） |
> | アイコン | 未対応 |
> | クラウド装飾 | 未対応 |
> | エッジ形状 | 未対応 |
> 
> **取り込み後の ID 生成:**
> - Freeplane の元 ID は使用しない
> - M3E の `n_<timestamp>_<random>` 形式で新規 ID を生成する
> - `savedAt` はパース実行時のタイムスタンプを使用
> 
> #### Export（未実装）
> 
> M3E → `.mm` のエクスポートは未実装。以下は将来の設計方針。
> 
> **M3E → `.mm` フィールドマッピング（設計案）:**
> 
> | M3E `TreeNode` フィールド | `.mm` の要素 | 備考 |
> |--------------------------|-------------|------|
> | `text` | `node TEXT` 属性 | |
> | `collapsed` | `node FOLDED` 属性 | |
> | `link` | `node LINK` 属性 | |
> | `details` | `richcontent TYPE="DETAILS"` | |
> | `note` | `richcontent TYPE="NOTE"` | |
> | `attributes` | `attribute` 要素群 | |
> | `children` 順序 | 子 `node` 要素の順序 | |
> 
> **M3E 固有概念の退避:**
> 
> | M3E の概念 | `.mm` への退避方法 |
> |------------|-----------------|
> | ノード type（`folder` 等） | `attribute NAME="m3e:type"` |
> | alias の参照先 | `attribute NAME="m3e:alias-ref"` |
> | scope 境界 | `folder` 型ノードは Freeplane のクラウドで表現（検討中） |
> | graph-level `Link` | 未定義（Beta では未実装） |
> 
> ---
> 
> ## ラウンドトリップ保証
> 
> ### M3E JSON → M3E JSON
> 
> すべてのフィールドが保持される。完全なラウンドトリップを保証する。
> 
> ### Freeplane `.mm` → M3E JSON → Freeplane `.mm`
> 
> | フィールド | 往復後の状態 |
> |-----------|------------|
> | テキスト・構造 | 保持される |
> | 折り畳み状態 | 保持される |
> | details / note / attributes / link | 保持される |
> | 元の Freeplane スタイル・色 | **失われる**（Import 時に破棄） |
> | 元の Freeplane ノード ID | **失われる**（M3E ID に置き換え） |
> 
> ---
> 
> ## 将来対応候補
> 
> Linear <-> Tree 変換の詳細方針は `Linear_Tree_Conversion.md` を参照。
> 
> ### インデントテキスト Import
> 
> ```
> 研究テーマ
>   観察事実
>     収穫量が15%減少
>     降水パターン変化
>   仮説
>     温度上昇が主因
> ```
> 
> 貼り付けから直接ツリーを構築できる。`m3e.paste(text)` コマンドと連動。
> 
> ### Markdown Import / Export
> 
> 見出し階層（`#` `##` `###`）をツリー構造にマッピングする。
> テキストノードのみ対応。`details` / `note` は Markdown のコードブロックや引用で退避する方向で検討。
> 
> ---
> 
> ## 関連文書
> 
> - データモデル不変条件: [./Data_Model.md](./Data_Model.md)
> - Linear <-> Tree 変換仕様: [./Linear_Tree_Conversion.md](./Linear_Tree_Conversion.md)
> - Freeplane マッピング方針: [../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md](../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md)
> - カスタムエンジン採択: [../09_Decisions/ADR_003_Freeplane_Informed_Custom_Engine.md](../09_Decisions/ADR_003_Freeplane_Informed_Custom_Engine.md)
> - SQLite 採択: [../09_Decisions/ADR_004_SQLite_For_Rapid_MVP.md](../09_Decisions/ADR_004_SQLite_For_Rapid_MVP.md)
> - コマンド API: [./Command_Language.md](./Command_Language.md)
> 
> ---
> 
> ### Linear_Tree_Conversion.md
> 
> ```
> source: 03_Spec/Linear_Tree_Conversion.md
> ```
> 
> # Linear <-> Tree 変換仕様（Draft）
> 
> ## 目的
> 
> M3E の主構造（Tree）と線形表現（Linear）を相互に変換し、
> 思考入力の速度と構造整合性を両立する。
> 
> 本仕様は、`Core_Principles.md` の以下と整合する。
> 
> - 主構造は親子（Tree）を維持する
> - scope は認知境界として扱う
> - 実体は単一、見え方を複数にする
> 
> ## 用語
> 
> - Tree: `AppState` の親子構造
> - Linear（リニアテキスト）: テキスト中心の一次元表現
> - Scope Root: 変換の起点ノード（通常は `currentScopeId`）
> 
> ## 設計方針
> 
> 1. 正本は常に Tree とする。
> 2. Linear は入力・出力インターフェースとして扱う。
> 3. 変換の既定単位は scope（全体ではなく部分木）とする。
> 4. 失敗時は fail-closed（曖昧な入力は拒否または明示警告）とする。
> 
> ## 対象フォーマット
> 
> ### L1: インデントテキスト（可逆優先）
> 
> 例:
> 
> ```text
> 研究テーマ
>   観察
>     収穫量低下
>   仮説
>     温度上昇
> ```
> 
> - 先頭空白数で depth を表現
> - 既定インデント幅は 2
> - 同 depth の行順は siblings 順に一致させる
> 
> ### L2: Markdown 見出し/箇条書き（準可逆）
> 
> 例:
> 
> ```markdown
> # 研究テーマ
> ## 観察
> - 収穫量低下
> ## 仮説
> - 温度上昇
> ```
> 
> - `#` 階層またはリスト階層から depth を推定
> - 混在入力は正規化ルールに従う
> 
> ## 変換ルール
> 
> ### Tree -> Linear
> 
> 1. `scopeRootId` を起点に pre-order で走査する。
> 2. 各ノードを `depth` と `text` に射影する。
> 3. `nodeType`, `alias`, `broken` などは必要時に注記トークンで出力する。
> 
> 注記例:
> 
> - alias: `[@alias -> <targetId>]`
> - broken alias: `[@alias broken]`
> 
> ### Linear -> Tree
> 
> 1. 各行を `depth`, `label`, `annotations` に分解する。
> 2. depth スタックで親子関係を復元する。
> 3. depth の飛び越し（例: 0 -> 3）は不正入力として reject する。
> 4. 復元後に model validator を必ず通す。
> 
> ## 可逆性レベル
> 
> - Level A（可逆）
>   - `text`, 親子構造, sibling 順序
> - Level B（条件付き可逆）
>   - `nodeType`, alias 情報（注記トークンを使う場合）
> - Level C（非可逆）
>   - `details`, `note`, `attributes`, ViewState（collapsed など）
> 
> `details` など非可逆情報がある場合、エクスポート時に件数警告を表示する。
> 
> ## Scope との整合
> 
> - 既定変換範囲は `currentScopeId` の部分木。
> - 全体変換は明示オプション指定時のみ。
> - scope 外ノードは既定で出力しない。
> 
> ## UI 統合（Rapid）
> 
> - リニアテキストはマップと同じ表示空間に配置する（分離タブ/別画面にしない）。
> - 現行実装（dev-beta）は 2 ペイン構成（左: Tree ビュー、右: リニアテキストボックス）。
> - Tree でノード選択したとき、リニアテキスト側の対応行を同期する。
> - リニアテキスト側で行選択したとき、Tree 側の対応ノードを選択する。
> - リニアテキスト側の編集は即時反映せず、`Apply` 実行時に一括変換する。
> - 変換失敗時は部分適用せず、エラーを表示して中断する。
> 
> ## エラー仕様
> 
> - 不正インデント: `InvalidIndentation`
> - depth 飛び越し: `InvalidDepthTransition`
> - 空ラベル行: `EmptyLabel`
> - alias 注記不正: `InvalidAliasAnnotation`
> 
> ## MVP 実装順
> 
> 1. L1 Export（Tree -> インデントテキスト）
> 2. L1 Import（インデントテキスト -> Tree）
> 3. L2 Export（Tree -> Markdown）
> 4. L2 Import（Markdown -> Tree）
> 
> ## コマンド API 案
> 
> - `m3e.export("indent")`
> - `m3e.import("indent", text)`
> - `m3e.export("markdown")`
> - `m3e.import("markdown", text)`
> 
> ## 受け入れ基準
> 
> 1. L1 で `Tree -> Linear -> Tree` の round-trip が構造同値になる。
> 2. scope 指定時に scope 外ノードが混入しない。
> 3. 不正入力が fail-closed で停止し、部分適用しない。
> 
> ## 関連文書
> 
> - `./Data_Model.md`
> - `./Import_Export.md`
> - `./Scope_and_Alias.md`
> - `../01_Vision/Core_Principles.md`
> ---
> 
> ### Model_State_And_Schema_V2.md
> 
> ```
> source: 03_Spec/Model_State_And_Schema_V2.md
> ```
> 
> # Model State 分離と Schema v2 仕様
> 
> ## 目的
> 
> 本仕様は以下を明確化する。
> 
> 1. Persisted document state と ViewState の分離境界
> 2. Model 側の必須項目（MUST）
> 3. v1 -> v2 のスキーマ変更と migration 方針
> 
> 対象は Beta の model 層であり、Final 固有の運用要件は含めない。
> 
> ---
> 
> ## 1. State 分離（詳細）
> 
> ### 1.1 基本方針
> 
> - 永続化対象は `PersistedDocument` のみとする。
> - 画面操作に依存する状態は `ViewState` として分離する。
> - SQLite / JSON に保存するのは `PersistedDocument` のみ。
> 
> ### 1.2 PersistedDocument（保存対象）
> 
> `PersistedDocument` はドメイン正本であり、次を含む。
> 
> - `version`
> - `rootId`
> - `nodes`
> - （将来）`scopes`
> - （将来）`aliases`
> - `meta`（作成・更新時刻など）
> 
> ### 1.3 ViewState（非保存対象）
> 
> `ViewState` はセッション状態であり、次を含む。
> 
> - `selectedNodeId`
> - `viewport`（pan/zoom）
> - `dragState`
> - `hoverState`
> - `inlineEditorState`
> 
> ### 1.4 境界ルール
> 
> - Model API は `PersistedDocument` を入出力する。
> - Viewer 側は `PersistedDocument + ViewState` を合成して描画する。
> - Undo/Redo は `PersistedDocument` の差分のみを対象とする。
> - `ViewState` は保存/復元の正当性判定に使わない。
> 
> ---
> 
> ## 2. 必須項目（MUST）
> 
> ### 2.1 Document Top-level MUST
> 
> - `version: number`
> - `rootId: string`
> - `nodes: Record<string, Node>`
> - `meta.createdAt: string (ISO8601)`
> - `meta.updatedAt: string (ISO8601)`
> 
> ### 2.2 Node MUST
> 
> - `id: string`（永続一意）
> - `type: "text" | "image" | "folder" | "alias"`
> - `parentId: string | null`
> - `children: string[]`（順序意味あり）
> - `collapsed: boolean`（折り畳み状態。ドキュメントに保存する）
> - `content: object`（型ごとに構造を定義）
> - `createdAt: string (ISO8601)`
> - `updatedAt: string (ISO8601)`
> 
> 補足:
> 
> - `scopeId` は保存しない
> - ノードの所属 scope は親子構造から導出する
> 
> ### 2.3 型別 MUST
> 
> - `text`: `content.text: string`
> - `image`: `content.imageRef: string`
> - `folder`: `content.title: string`
> - `alias`: `content.targetNodeId: string`
> 
> ### 2.4 整合性 MUST
> 
> - `rootId` は `nodes` に存在する。
> - すべての `children[]` は実在ノードを参照する。
> - `parentId` と `children[]` は相互整合する。
> - 主構造に cycle を作らない。
> - 全ノードが root から到達可能である。
> - alias は実体ノードのみを参照する（alias -> alias 禁止）。
> - 実体ノードは単一 scope にのみ所属する。
> 
> ### 2.5 Scope 導出 MUST
> 
> - ノード所属 scope は `folder` 境界を使って導出する。
> - 導出値は「自分自身を含む祖先列で最も近い `folder` ノード ID」とする。
> - 祖先に `folder` が無い場合は document `rootId` を scope root とみなす。
> - `reparent` 後に scope が変わるノードがあっても、永続データ更新は `parentId` / `children` のみでよい（scope は再導出されるため）。
> 
> ---
> 
> ## 3. Schema v2 設計
> 
> ### 3.1 v1 との差分
> 
> v1 は以下が不足している。
> 
> - `type`
> - `createdAt` / `updatedAt`
> - `meta`（documentレベル）
> - `content` の型分離（現在は text/details/note/link 併置）
> 
> v2 では MUST 項目を満たす構造へ移行する。
> 
> ### 3.2 v2 形式（例）
> 
> ```json
> {
>   "version": 2,
>   "rootId": "n_root",
>   "meta": {
>     "createdAt": "2026-04-01T10:00:00.000Z",
>     "updatedAt": "2026-04-01T10:00:00.000Z"
>   },
>   "nodes": {
>     "n_root": {
>       "id": "n_root",
>       "type": "text",
>       "parentId": null,
>       "children": ["n_a"],
>       "content": { "text": "Root" },
>       "createdAt": "2026-04-01T10:00:00.000Z",
>       "updatedAt": "2026-04-01T10:00:00.000Z"
>     }
>   }
> }
> ```
> 
> ### 3.3 migration 方針
> 
> - 読み込み時に `version` を必ず判定する。
> - `version === 1` の場合のみ `migrateV1ToV2()` を適用する。
> - migration 後に `validateV2()` を実行し、失敗時は reject する。
> 
> ### 3.4 v1 -> v2 変換ルール
> 
> - `type` が無いノードは `"text"` を付与
> - `scopeId` が存在しても保存対象から除外（破棄）
> - `createdAt/updatedAt` は migration 時刻で埋める
> - 既存 `text/details/note/link/attributes` は `content` へ再配置
> - document-level `meta` を新規生成
> 
> ### 3.5 後方互換ポリシー
> 
> - 読み込み対応: v1, v2
> - 書き込み形式: v2 のみ
> - v1 の再出力は行わない
> 
> ### 3.6 テスト要件
> 
> - v1 fixture を v2 に migration できる
> - migration 後 `validateV2()` が pass する
> - round-trip（save/load）で意味が不変
> - 異常系（欠損/循環/不正alias）を reject する
> 
> ---
> 
> ## 4. 実装タスク（Model）
> 
> 1. `PersistedDocumentV2` 型定義を追加
> 2. `ViewState` を model 永続化対象から分離
> 3. `validateV2()` を追加
> 4. `migrateV1ToV2()` を追加
> 5. save は常に v2 を出力
> 6. v1/v2 fixture で unit test を追加
> 
> ---
> 
> ### Scope_Transition.md
> 
> ```
> source: 03_Spec/Scope_Transition.md
> ```
> 
> # Scope 遷移仕様
> 
> 最終更新: 2026-04-01
> 
> ---
> 
> ## 概要
> 
> Scope 遷移とは、ユーザーが現在の「folder world」から別の folder world に入り、また戻る操作のことである。
> 現在スコープ（`currentScopeId`）を切り替えることで、表示・編集の対象が切り替わる。
> 
> ---
> 
> ## 状態定義
> 
> ### ViewState に追加する項目
> 
> ```ts
> currentScopeId: string   // 現在表示しているスコープの rootFolder ノード ID
>                          // ルート（最上位）の場合は固定値 "root"
> scopeHistory: string[]   // 遷移履歴（戻るために使用）。末尾が直前のスコープ
> ```
> 
> - `currentScopeId` は `PersistedDocument` に含めない（ViewState のみ）
> - 再起動後も復元できるよう、`ViewState` のセッション保存対象に含める
> 
> ---
> 
> ## 遷移トリガー
> 
> | 操作 | 遷移先 |
> |------|--------|
> | folder ノードを **ダブルクリック** | その folder のスコープへ入る |
> | ブレッドクラムの項目をクリック | その祖先スコープへ戻る |
> | キーボード `Alt+Enter`（folder 選択中） | その folder のスコープへ入る |
> | キーボード `Backspace`（ノード非編集中） | 親スコープへ戻る |
> | ツールバーの「← 戻る」ボタン | 直前のスコープへ戻る |
> 
> ### 注意
> 
> - folder に「入る」操作と、ノードを「編集開始する」操作（`F2` / 通常ダブルクリック）は区別する
> - folder ノードの場合: **ダブルクリック = スコープ遷移**（編集開始は `F2` のみ）
> - text ノードの場合: **ダブルクリック = 編集開始**（変更なし）
> 
> ---
> 
> ## 遷移時の処理
> 
> ### 入る（EnterScopeCommand）
> 
> ```
> 1. scopeHistory に現在の currentScopeId を push
> 2. currentScopeId を対象 folder のノード ID に更新
> 3. viewport を初期位置にリセット（fit-to-content）
> 4. 選択状態をクリア
> 5. 表示ノードを新スコープ以下に絞り込む
> ```
> 
> **Command の位置づけ:**
> ViewState の変更のみであり、PersistedDocument は変更しない。
> Undo/Redo の対象外とする（scopeHistory で独自に管理する）。
> 
> ### 戻る（ExitScopeCommand）
> 
> ```
> 1. scopeHistory が空なら何もしない（最上位スコープ）
> 2. scopeHistory から末尾を pop
> 3. currentScopeId を取り出した値に更新
> 4. viewport を前回の位置に戻す（ViewState に保存していれば）
> 5. 元のスコープで選択していたノードを復元する（ViewState に保存していれば）
> ```
> 
> ---
> 
> ## 表示ルール
> 
> ### 現在スコープ内のノード
> 
> - `currentScopeId` の folder 以下のノードをすべて表示する
> - その folder ノード自体はルートとして表示する（ノードラベルは表示する）
> 
> ### スコープ外ノードの扱い
> 
> - 現在スコープ外の実体ノードは表示しない
> - 現在スコープ内に alias があれば、その alias は表示する（参照先が外部スコープでも可）
> - alias は視覚的に区別する（→ alias 描画仕様参照）
> 
> ### 最上位スコープ
> 
> - `currentScopeId === "root"` のとき、全ノードのうち最上位のツリーを表示する
> - 未所属ノードは表示しない
> 
> ---
> 
> ## ブレッドクラム
> 
> ブレッドクラムは現在のスコープ階層を示す。
> 
> ```
> [ルート] > [研究テーマA] > [仮説グループ1]
> ```
> 
> - 各項目はクリック可能で、そのスコープに直接ジャンプする
> - ジャンプ時は途中のスコープを scopeHistory に積む
> - 現在スコープは末尾に表示し、クリック不可とする
> 
> ### 配置
> 
> ツールバー上部または viewer 上端に固定表示する。スコープ深度が増えても省略せず表示する（折り返し可）。
> 
> ---
> 
> ## キーボード操作まとめ
> 
> | キー | 条件 | 動作 |
> |------|------|------|
> | `Alt+Enter` | folder ノード選択中 | スコープに入る |
> | `→` | folder ノード選択中 | スコープに入る |
> | `←` | 現在スコープの root ノード選択中 | 親スコープへ戻る |
> | `Backspace` | ノード非編集中 かつ現在スコープの root ノード選択中 | 親スコープへ戻る |
> | `Escape` | スコープ内 | 何もしない（スコープ遷移には使わない） |
> 
> ---
> 
> ## alias の表示（スコープ遷移との関係）
> 
> - alias ノードをダブルクリックしてもスコープ遷移は発生しない
> - alias の参照先が folder であっても、そのスコープへの自動遷移は行わない
> - alias から参照先スコープへ移動するには、別途「参照先を開く」操作（右クリックメニュー等）を使う
>   （→ 将来実装。Phase 1 では alias のクリック動作は「参照先ノードへジャンプ」に留める）
> 
> ---
> 
> ## ViewState の保存・復元
> 
> 再起動後も以下を復元する。
> 
> | 項目 | 保存先 |
> |------|--------|
> | `currentScopeId` | ViewState セッション保存 |
> | `scopeHistory` | ViewState セッション保存 |
> | 各スコープの viewport（pan/zoom） | ViewState セッション保存（スコープ ID をキーに Map で管理） |
> | 各スコープの選択ノード | 復元しない（遷移時にクリア） |
> 
> ---
> 
> ## エラー・エッジケース
> 
> | ケース | 対応 |
> |--------|------|
> | `currentScopeId` のノードが削除された | `"root"` にフォールバック |
> | `scopeHistory` 内のノードが削除された | その項目をスキップしてさらに戻る |
> | 循環参照（alias から自分のスコープへ） | 遷移を許可しない（入口でチェック） |
> | 最上位スコープで「戻る」 | 何もしない（戻るボタンを無効化表示） |
> 
> ---
> 
> ## 実装フェーズ
> 
> ### Phase 1（今回実装）
> 
> - [ ] `currentScopeId` / `scopeHistory` を ViewState に追加
> - [ ] folder ノードのダブルクリックで `EnterScope`
> - [ ] ツールバー「← 戻る」ボタンで `ExitScope`
> - [ ] ブレッドクラム表示（クリックで直接ジャンプ）
> - [ ] スコープ外ノードの非表示
> - [ ] `Alt+Enter` / `Backspace` キーバインド
> - [ ] ViewState のセッション保存・復元（`currentScopeId`）
> 
> ### Phase 2（後続）
> 
> - [ ] 各スコープの viewport を個別保存・復元
> - [ ] alias の「参照先を開く」操作
> - [ ] スコープ間 alias 表示の整合（rename/delete 時）
> - [ ] 全体俯瞰ビュー（スコープを折りたたんで表示）
> 
> ---
> 
> ## 関連文書
> 
> - Scope/Alias 原則: [Scope_and_Alias.md](Scope_and_Alias.md)
> - Data Model: [Data_Model.md](Data_Model.md)
> - MVC and Command: [../04_Architecture/MVC_and_Command.md](../04_Architecture/MVC_and_Command.md)
> - Editing Design: [../04_Architecture/Editing_Design.md](../04_Architecture/Editing_Design.md)
> - Model State/Schema v2: [Model_State_And_Schema_V2.md](Model_State_And_Schema_V2.md)
> 
> ---
> 
> ### Scope_and_Alias.md
> 
> ```
> source: 03_Spec/Scope_and_Alias.md
> ```
> 
> # Scope and Alias
> 
> ## 目的
> 
> この文書は、M3E の `scope` と `alias` を Beta 実装で扱える粒度まで定義する。
> 
> - `scope` は認知境界と編集境界を与える
> - `alias` は実体複製なしで他 scope のノードを見せる
> - Freeplane 由来の tree だけでは表せない M3E 固有意味をここで固定する
> 
> ## なぜ scope が必要か
> 
> ファイルやタブの開閉だけでは、思考対象の境界をうまく制御できない。  
> M3E は storage boundary ではなく cognition boundary を扱うために scope を導入する。
> 
> ## Scope の定義
> 
> scope は「どこまでを 1 つの局所世界として見るか」を定める単位である。
> 
> - `folder` は子 scope の入口ノードである
> - document root の直下には暗黙の root scope がある
> - 各実体ノードはちょうど 1 つの scope に属する
> 
> scope は以下を制御する。
> 
> - 何が見えるか
> - どこまで編集できるか
> - どの構造を同時に考えるか
> 
> ## Scope の決定規則
> 
> ### 1. root scope
> 
> - document 全体に 1 つだけ存在する暗黙 scope
> - どの `folder` 配下にも入っていない実体ノードは root scope 所属とみなす
> 
> ### 2. folder scope
> 
> - `folder` ノード 1 つにつき子 scope を 1 つ作る
> - `folder` ノード自身は親 scope に属する
> - `folder` の直下以下の子孫実体は、その `folder` scope に属する
> - ただし子孫に別の `folder` が現れた時点で、その下はさらに内側の scope へ切り替わる
> 
> ### 3. 所属の一意性
> 
> - 実体ノードは複数 scope に同時所属しない
> - ある scope から別 scope へ見せたいときは移動ではなく `alias` を置く
> 
> ## Scope の原則
> 
> ### 閉包性
> 
> - 原則として scope 内で思考を完結させる
> - 外部の情報は既定で露出しない
> 
> ### 局所性
> 
> - 日常操作は現在 scope に最適化する
> - 全体俯瞰は要約された形で扱う
> 
> ### 往復可能性
> 
> - folder を開くとその folder world に入る
> - 戻る操作で迷子にならないことを重視する
> 
> ## Scope の可視・編集ルール
> 
> ### 通常表示
> 
> - 現在 scope の実体ノードを主表示対象にする
> - 親 scope の情報は breadcrumb や入口ノードなど要約導線としてのみ見せる
> - 他 scope の実体は常時フル表示しない
> 
> ### 編集
> 
> - 直接編集できるのは現在 scope 内の実体ノードと、その scope に置かれた alias ノードに限る
> - scope 外の実体内容を、alias 経由の通常編集で直接書き換えない
> - target 実体を編集したい場合は、その実体の属する scope へ移動して行う
> 
> ### 移動
> 
> - 実体ノードを別 scope へ move した場合、所属 scope は移動先に合わせて更新する
> - subtree move では、配下ノードも同じ規則で再計算する
> - ただし配下に `folder` がある場合、その `folder` より下は独立 scope として維持する
> 
> ## Alias の役割
> 
> alias は、他 scope の実体を複製せずに参照するための窓である。
> 
> ## Alias の原則
> 
> - alias は参照専用である
> - 実体の正本は 1 箇所だけに置く
> - 他 scope へ見せたいときだけ alias を置く
> - alias から alias は辿らない
> - alias には write 権限を付与できるが、既定は read-only とする
> 
> ## Alias ノード仕様
> 
> ### 最低限の属性
> 
> - `id`
> - `type: "alias"`
> - `parentId`
> - `children: []`
> - `scopeId`
> - `targetNodeId`
> - `aliasLabel?`
> - `access: "read" | "write"`
> - `targetSnapshotLabel?`
> - `isBroken?`
> - `createdAt`
> - `updatedAt`
> 
> ### target 制約
> 
> - `targetNodeId` は実体ノードのみを指せる
> - target は `text` `image` `folder` のいずれか
> - `alias -> alias` は禁止する
> - target が同一 scope 内にある alias も許可する
> 
> ### 表示ルール
> 
> - `aliasLabel` があればそれを優先表示する
> - `aliasLabel` がなければ target の現在ラベルを表示する
> - alias は通常ノードと見分けがつく視覚表現を必須とする
> - target scope 名や外部参照であることが分かる補助表示を持てるようにする
> - broken alias は `元の名前 (deleted)` を既定表示とする
> - `targetSnapshotLabel` には target 消失前の最後の表示名を保持する
> 
> ### 操作ルール
> 
> - alias の rename は既定で `aliasLabel` の編集として扱う
> - `access: "read"` の alias では target 実体の直接編集を行わない
> - `access: "write"` の alias では、許可された編集を target 実体へ反映できる
> - target 実体の rename は target 側 scope でも行える
> - alias の delete は alias 自体のみを削除し、target 実体には影響しない
> - alias 選択時は `jump to target` を明示操作として提供できる
> - target が `folder` の場合、alias から target scope へ遷移できる
> - broken alias は rename / annotation / delete のみ許可し、target への jump は不可とする
> 
> ### 禁止事項
> 
> - alias に子を持たせない
> - alias を主構造の所有権ノードとして扱わない
> - alias を target の保存先 scope 変更手段として使わない
> 
> ## Scope と Alias の組み合わせで解く問題
> 
> - 見えすぎることで集中が崩れる
> - 同じノードを複製して整合性が壊れる
> - 全体と局所の往復が煩雑になる
> - 参照元ごとに文脈だけ変えつつ、正本は一意に保つ
> 
> ## 整合性ルール
> 
> ### 1. delete
> 
> - target 実体を delete しても alias は残してよい
> - delete 時点で alias は broken 状態へ遷移し、`targetSnapshotLabel` に最後の表示名を保持する
> - broken alias の既定表示は `元の名前 (deleted)` とする
> - broken alias は保存可能だが、target 復旧までは参照解決不能として扱う
> 
> ### 2. move / reparent
> 
> - target 実体を別親へ移動しても `targetNodeId` は不変
> - その結果 scope 所属が変わっても alias は同じ target を参照し続ける
> - alias 自身の move は設置 scope の変更として扱うが、target の所属は変えない
> 
> ### 3. rename
> 
> - target rename は `aliasLabel` 未設定の alias 表示へ即時反映される
> - `aliasLabel` 付き alias は target rename の影響を受けない
> 
> ### 4. invalid target
> 
> - save/load 時に `targetNodeId` 不在を検出した場合でも、`isBroken` と `targetSnapshotLabel` が整合していれば broken alias として許容する
> - `targetNodeId` 不在かつ broken 情報がない場合は invalid とみなす
> 
> ### 5. access control
> 
> - 既定値は `access: "read"` とする
> - `access: "write"` を持つ alias では、許可された編集操作を target 実体へ転送できる
> - write alias でも target の ownership や scope 所属は変更しない
> - 権限は alias ごとに保持し、target ノード本体の性質にはしない
> 
> ## Beta 実装で先に固定すること
> 
> - scope 所属は nearest ancestor folder から決定する
> - alias は leaf ノードとして扱う
> - alias 既定権限は read-only とする
> - write alias を表現できるデータ構造を先に用意する
> - target delete 時は alias を broken 状態へ遷移させる
> - 同一 scope 内 alias も許可する
> - Freeplane `.mm` には `scope` / `alias` の完全往復をまだ要求しない
> 
> ## Beta 実装でまだ保留にすること
> 
> - 1 つの実体を複数 alias で一覧するときの集約 UI
> - scope 横断検索時の表示優先順位
> - `.mm` export 時の alias 表現形式
> - alias への annotation を `aliasLabel` 以外にどこまで持たせるか
> - write alias が許す編集範囲を rename / body / metadata のどこまでにするか
> 
> ## UI/UX 上の含意
> 
> - 現在 scope 外の情報は常時表示しない
> - 外部参照は alias や明示的導線でのみ見せる
> - rename / move / delete 時は alias 表示との整合を保つ
> - folder は「子を持つノード」であるだけでなく「scope 入口」であることが分かる必要がある
> - alias は通常ノードと誤認されない見た目と操作ラベルを持つ必要がある
> - read alias / write alias / broken alias を視覚的に区別できる必要がある
> 
> ## 実装メモ
> 
> - model では `scopeId` を永続化するか、親子構造から毎回再計算するかを後続で決める
> - viewer は `currentScopeId` を持ち、表示フィルタと編集制約の根拠に使う
> - save/load 層では `alias -> alias` 禁止と broken alias 整合性検証が必要
> - command 層では `createAlias` `setAliasAccess` `moveNodeAcrossScope` `deleteNodeKeepBrokenAliases` を明示した方がよい
> 
> ## 関連文書
> 
> - 原則: [../01_Vision/Core_Principles.md](../01_Vision/Core_Principles.md)
> - 実体モデル: [./Data_Model.md](./Data_Model.md)
> - Freeplane 境界: [../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md](../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md)
> 
> ---
> 
> 
> ## 04_Architecture
> 
> ### AI_Infrastructure.md
> 
> ```
> source: 04_Architecture/AI_Infrastructure.md
> ```
> 
> # AI インフラ設計
> 
> 最終更新: 2026-04-02
> 
> ## 目的
> 
> この文書は、M3E における AI 連携の基盤設計を定義する。
> 
> ここでいう AI インフラは、
> 個別機能（Linear <-> Tree 変換、title rewrite、duplicate check など）の前段にある
> 共通の provider 接続基盤・秘密情報管理・呼び出し境界・失敗時の振る舞いを指す。
> 
> ## 基本思想
> 
> 1. AI は機能ではなく基盤として扱う。
> 2. provider 固有事情を feature 実装へ漏らさない。
> 3. API key や endpoint はアプリ機能ごとに分散させず、共通の AI 設定へ集約する。
> 4. feature ごとの差分は prompt / payload / response schema に閉じ込める。
> 5. AI が使えない状態でも、M3E の主要操作は成立しなければならない。
> 
> ## なぜ feature 専用設定にしないか
> 
> `M3E_LINEAR_AGENT_API_KEY` のような feature 専用設定は、
> 短期的には簡単でも中長期で次の問題を作る。
> 
> - AI 機能を追加するたびに env が増殖する
> - provider 切替が feature ごとにバラバラになる
> - secret 注入経路が分散し、Bitwarden 連携や運用自動化が複雑化する
> - UI から見た「AI が有効か」の状態が統一できない
> - ログ、レート制御、タイムアウト、fail-closed 方針を横断で揃えにくい
> 
> そのため、M3E では AI 接続設定を `M3E_AI_*` に寄せ、
> 各 feature はその基盤を利用する構造を採る。
> 
> ## レイヤ構成
> 
> ```text
> Feature UI / Feature API
>   -> Feature Adapter
>     -> AI Infrastructure
>       -> Provider Transport
>         -> External Provider or MCP Server
> ```
> 
> ### 1. Feature UI / Feature API
> 
> - browser 側のボタン、パネル、操作フロー
> - Node 側の feature endpoint
> - 例:
>   - `GET /api/linear-transform/status`
>   - `POST /api/linear-transform/convert`
> 
> ### 2. Feature Adapter
> 
> AI 基盤の上に載る個別機能層。
> 
> - feature 固有の request schema
> - feature 固有の prompt
> - provider 返答の feature 用正規化
> - feature 単位の fail-closed 条件
> 
> 例:
> 
> - linear transform
> - title rewrite
> - suggest-parent
> - duplicate-check
> 
> ### 3. AI Infrastructure
> 
> 共通化されるべき責務を持つ。
> 
> - provider 設定読込
> - secret 注入前提の環境変数解決
> - transport 選択
> - 共通 status 判定
> - 共通エラー分類
> - 共通 timeout / retry / rate limit の受け皿
> - 将来の監査ログ統合点
> 
> ### 4. Provider Transport
> 
> 外部接続の差分を吸収する層。
> 
> - `openai-compatible`
> - `mcp`（将来）
> - local gateway / proxy（将来）
> 
> feature は transport ではなく、
> AI インフラが返す抽象化済みの呼び出し面を見る。
> 
> ## 現行の責務分離
> 
> ### 共通 AI 設定
> 
> 共通設定は `M3E_AI_*` に置く。
> 
> 想定項目:
> 
> - `M3E_AI_ENABLED`
> - `M3E_AI_PROVIDER`
> - `M3E_AI_TRANSPORT`
> - `M3E_AI_BASE_URL`
> - `M3E_AI_API_KEY`
> - `M3E_AI_MODEL`
> - `M3E_AI_MCP_SERVER`
> 
> これらは provider 接続に必要な最低限の構成であり、
> feature 固有の意味を持たない。
> 
> ### feature 固有設定
> 
> feature 固有設定は prompt や schema に限定する。
> 
> 例:
> 
> - `M3E_LINEAR_TRANSFORM_SYSTEM_PROMPT_FILE`
> - `M3E_LINEAR_TRANSFORM_TREE_TO_LINEAR_PROMPT_FILE`
> - `M3E_LINEAR_TRANSFORM_LINEAR_TO_TREE_PROMPT_FILE`
> 
> この分離により、
> 同じ provider 接続を複数の AI 機能で共有できる。
> 
> ## 秘密情報管理
> 
> ### 原則
> 
> 1. API key は repo 内に保存しない。
> 2. browser に API key を渡さない。
> 3. secret 解決はアプリ内部よりも起動レイヤで行う。
> 
> ### 推奨経路
> 
> Bitwarden を secret source とし、
> launch script が起動前に取得して `M3E_AI_*` を注入する。
> 
> ```text
> Bitwarden
>   -> launch-with-ai.ps1
>     -> M3E_AI_API_KEY / M3E_AI_MODEL / M3E_AI_BASE_URL
>       -> beta start
> ```
> 
> ### 起動レイヤで注入する理由
> 
> - アプリ本体が secret manager 依存にならない
> - feature 呼び出しのたびに secret 解決しなくてよい
> - desktop 運用と CI 運用で同じ env 契約を共有できる
> - provider 差し替え時も launch 層だけで調整しやすい
> 
> ## Transport 方針
> 
> ### `openai-compatible`
> 
> 現行の第一実装。
> 
> - DeepSeek 系 endpoint を含む OpenAI 互換 API を対象とする
> - `/chat/completions` 互換を利用する
> - Node サーバー経由で呼び出す
> 
> ### `mcp`
> 
> 将来の transport。
> 
> 用途:
> 
> - subagent をツールサーバーとして分離したい場合
> - provider だけでなく処理器そのものを外部化したい場合
> - 複数 feature で同一 subagent を共有したい場合
> 
> 現段階では config surface のみ先行し、
> 実体は未実装でよい。
> 
> ## API 設計原則
> 
> 共通 API の request / response / error 契約の正本は
> `../03_Spec/AI_Common_API.md` とする。
> 
> ### browser は provider を直接呼ばない
> 
> 理由:
> 
> - API key 保護
> - CORS 回避
> - provider 差し替えの容易化
> - audit / rate limit / timeout 集中管理
> 
> そのため、browser は常に localhost の Node API を叩く。
> 
> ### status endpoint を feature ごとに持つ
> 
> 例:
> 
> - `/api/linear-transform/status`
> 
> status endpoint の目的:
> 
> - UI が機能有効性を描画できる
> - provider 未設定時の fail-closed を事前に伝えられる
> - transport や prompt 設定の診断点になる
> 
> ### convert / propose endpoint は feature schema を持つ
> 
> 共通 provider の上に載っても、
> feature request/response は feature ごとに分ける。
> 
> 理由:
> 
> - schema が feature ごとに異なる
> - 妥当性検証が feature ごとに異なる
> - UI 側の承認フローが feature ごとに異なる
> 
> ## Fail-Closed 原則
> 
> AI 連携で失敗した場合、M3E は次を守る。
> 
> 1. 正本を部分更新しない
> 2. 既存の手動操作導線へ戻れる
> 3. 失敗理由を UI/ログで観測可能にする
> 
> 典型的な失敗分類:
> 
> - disabled
> - config missing
> - transport not implemented
> - invalid request
> - provider timeout
> - provider schema mismatch
> - provider unavailable
> 
> ## Linear Transform との関係
> 
> Linear <-> Tree は AI インフラ上の 1 feature に過ぎない。
> 
> そのため、次を守る。
> 
> - provider 接続設定は共通 AI 基盤から取る
> - prompt だけを feature 固有設定として持つ
> - browser 側は feature endpoint だけを見る
> - provider 固有レスポンスは feature adapter で吸収する
> 
> これにより、後から以下を追加しやすくなる。
> 
> - title rewrite
> - duplicate check
> - suggest-parent
> - structure proposal
> - context package enrichment
> 
> ## Bitwarden 運用との整合
> 
> Bitwarden item の責務は secret source であり、
> アプリの feature 単位設定 source ではない。
> 
> 推奨:
> 
> - `password`: API key
> - custom field:
>   - `provider`
>   - `transport`
>   - `base_url`
>   - `model`
> 
> launch script がこれを `M3E_AI_*` に写像する。
> feature 固有の prompt は repo 内のファイルか、
> 将来的には別設定層で管理する。
> 
> ## 今後の拡張点
> 
> 1. 共通 `POST /api/ai/subagent/:name` の導入
> 2. provider ごとの token usage 正規化
> 3. タイムアウト・リトライ・レート制御の共通化
> 4. 監査ログの統一
> 5. MCP transport 実装
> 6. feature ごとの approval UI との接続
> 
> ## 2026-04-03 追加: LLM マルチプロバイダ基盤方針 v0.1
> 
> ### 目的再定義
> 
> M3E の AI 基盤は次を満たすことを目標にする。
> 
> 1. ローカル/クラウドを同一 API 契約で扱う
> 2. モデルを alias で切替できる（Copilot 的な選択体験）
> 3. feature 実装は provider 固有名を直接持たない
> 4. データポリシー（local only 等）を集中管理する
> 
> ### 推奨スタック（実務優先）
> 
> - App layer: Vercel AI SDK
> - Gateway layer: LiteLLM
> - Local runtime: Ollama（標準）、必要に応じて vLLM / llama-cpp-python
> - Optional cloud aggregator: OpenRouter
> 
> この構成の理由:
> 
> - Vercel AI SDK は TypeScript 側の provider/model 抽象化と model 管理に向く
> - LiteLLM は複数 provider を OpenAI 互換 endpoint で束ねる gateway に向く
> - Ollama / vLLM / llama-cpp-python はローカル実行面を担い、gateway 配下に置ける
> - OpenRouter は cloud 集約として有用だが、local 実行基盤の代替ではない
> 
> ### ライブラリ比較（M3E 観点）
> 
> | コンポーネント | 主な役割 | M3E での位置付け | 注意点 |
> |---|---|---|---|
> | Vercel AI SDK | TS 側 provider abstraction | App/adapter 層の標準候補 | gateway 機能そのものは持たない |
> | LiteLLM | 統一 gateway/proxy | backend の第一候補 | 運用プロセス（config/key）設計が必要 |
> | Ollama | ローカル LLM 実行 | 開発機での標準 runtime | 大型モデルはメモリ制約に注意 |
> | vLLM | 高速サービング | GPU サーバ向け拡張 | 開発機単体では過剰になりやすい |
> | llama-cpp-python | 軽量ローカル実行 | オフライン検証の補助 | 速度/機能はモデル依存 |
> | OpenRouter | cloud provider 集約 | 任意追加 | local 実行を代替しない |
> 
> ### フェーズ設計
> 
> #### Phase 1（最速検証）
> 
> - 構成: `Vercel AI SDK + (Ollama or OpenAI API)`
> - 目的: alias 切替 UI と feature 接続の検証
> - 制約: backend gateway 不在のため、ルーティング/ポリシー集中管理が弱い
> 
> #### Phase 2（基盤化）
> 
> - 構成: `Vercel AI SDK + LiteLLM + local runtimes + cloud providers`
> - 目的: local/cloud ルーティング、fallback、監査ログの集中化
> - 期待効果: feature 側コードの provider 依存を最小化
> 
> ### モデル ID 方針（alias 優先）
> 
> feature 側では vendor model 名を直接持たない。内部 alias を使う。
> 
> 例:
> 
> - `chat.local.fast`
> - `chat.local.reason`
> - `chat.cloud.fast`
> - `chat.cloud.strong`
> - `embed.default`
> 
> alias -> 実モデル名の対応は AI 基盤設定で集中管理する。
> 
> ### データポリシー方針
> 
> request ごとに次のいずれかを明示する。
> 
> - `local_only`
> - `cloud_allowed`
> - `cloud_required`
> 
> `local_only` は cloud fallback を禁止する。
> 
> ### 実装メモ（現行 beta）
> 
> 現行実装では `M3E_AI_MODEL_REGISTRY_JSON` と `M3E_AI_DEFAULT_MODEL_ALIAS` により、
> alias ベースのモデル解決を先行導入する。
> 
> 例:
> 
> ```json
> {
>   "chat.fast": {
>     "label": "Fast Cloud",
>     "kind": "chat",
>     "privacy": "cloud",
>     "capabilities": ["streaming", "json"],
>     "targetModel": "deepseek-chat",
>     "dataPolicy": "cloud_allowed"
>   },
>   "chat.local": {
>     "label": "Gemma Local",
>     "kind": "chat",
>     "privacy": "local",
>     "capabilities": ["streaming"],
>     "targetModel": "gemma3:4b",
>     "dataPolicy": "local_only"
>   }
> }
> ```
> 
> `M3E_AI_GATEWAY=litellm` は運用上の明示フラグとして扱い、
> `/api/ai/status` で可観測にする。
> 
> ## 非目標
> 
> - AI が無承認で正本を書き換えること
> - browser に provider SDK と secret を埋め込むこと
> - feature ごとに別々の secret 配布経路を持つこと
> - provider 別の UI を feature へ直接埋め込むこと
> 
> ## 関連文書
> 
> - `../03_Spec/AI_Integration.md`
> - `../03_Spec/Linear_Tree_Conversion.md`
> - `../03_Spec/Import_Export.md`
> 
> ---
> 
> ### Drag_and_Reparent.md
> 
> ```
> source: 04_Architecture/Drag_and_Reparent.md
> ```
> 
> # Drag and Reparent
> 
> ## 目的
> 
> ノードのドラッグによる親付け替えを、Model を壊さずに扱うための操作設計を定義する。
> 
> ## 基本原則
> 
> - ドラッグ中は Model を更新しない
> - 見た目の追従は ViewState 
> The file is too long and its contents have been truncated.
> 

> [!abstract]- Tool (file_search)
> <sub>2026-04-17 14:10</sub>
> 
> The file contents provided above are truncated/partial snippets. The complete content for these files IS accessible via querying.
> 
> If the user asks a question related to these files, and the provided snippets do not clearly answer it, you **MUST** use the `file_search` tool to search the full document contents before responding.
> 
> ## How to invoke the file_search tool
> If the user's query isn't sufficiently answered by the provided snippets, parsed text, or images, you should invoke `file_search.msearch`.
> To search the full content of the available files, you **must** send one message with recipient `to=file_search.msearch` in the analysis channel. Your message should be structured exactly as follows:
> ```
> {
>   'queries': ['Example query 1', 'Example query 2']  // List of up to five queries to search for.
> }
> ```
> 
> Carefully balance the number of `file_search` calls and the quality of your response with the latency incurred by `file_search` calls.
> 
> Important guidelines for query formatting:
> - Your message must be a valid JSON object. Do not include any extraneous text, backticks, markdown formatting, or comments beyond what is shown.
> - The `queries` field must be a list of strings.
> - One of the queries **MUST** exactly match the user's original question, but stripped of any extraneous details, and with ambiguous references clearly resolved using context from the conversation. It **MUST** be a complete sentence.
> - Even if you suspect the user meant something else, one query **MUST** still be their original question.
> 
> ## How to handle results from file_search
> The file search tool will respond with the relevant search results from the full files. After you receive these results:
> - Carefully evaluate each result to determine its relevance and quality.
> - Use the high-quality and relevant results to inform your answer to the user's question.
> - When possible, reuse information from prior file_search results and avoid repeating identical queries.
> 
> ## Tool usage instructions and ordering
> When the user asks a question, carefully consider whether the provided snippets sufficiently answer the query, whether you need to invoke `file_search.msearch`, or another available tool (such as `web`, if available) should be used instead.
> 
> Tool-ordering Guidelines:
> 1. For queries related to uploaded files, if snippets are insufficient, strongly prefer invoking `file_search.msearch` over other tools.
>     - Avoid using `web.run`, `python` analysis, or any other tools until you have either:
>         - Confirmed with high confidence the answer is not in the files, or
>         - Have high confidence `file_search_tool` queries are not sufficient to answer the query.
> 2. Avoid usage of `web_search/web.run` for queries related to uploaded files
>     - Carefully consider whether the user's query is better answered by web search results rather than available snippets or results from `file_search_tool`.
>     - Unless the user's query is clearly unrelated to the uploaded files, prefer using `file_search.msearch`. You can always follow up with a web search if necessary for a more complete response.
> 3. Avoid using `python` unless necessary or requested by user.
>     - If the user's query is answerable from the parsed text and images from the uploaded files, or from `file_search_tool`, do not invoke `python`.
> 
> Always keep this instruction in mind for the rest of the conversation, as the user may reference these files or ask related questions later on.

> [!info] Reasoning Summary
> <sub>2026-04-17 14:10</sub>
> 
> 思考時間: 4s

**ChatGPT**: <sub>2026-04-17 14:10</sub>

そう。だから Resource は単なる共有物ではなく、**上位から下位へ配分される制約付きの量**として扱うほうが自然。M3E の scope は認知境界だが、予算のような Resource まで考えると、scope は同時に配分境界にもなる。実体ノードは単一 scope に属し、所属は親子構造から導出する設計なので、Resource もこの階層に沿って持つのが整合的だ fileciteturn1file2

このとき重要なのは、組織予算・PJ予算・個人予算を全部同じ「箱」として持たないこと。上位の予算は下位予算の総和そのものではなく、まず配分権を持つ。下位はその配分を受けたローカル予算を持つ。つまり Resource には少なくとも「原資」と「配分先の割当」と「各局所での消費」の3層がある。これを分けないと、全体整合と局所編集が衝突する。

したがって設計としては、Resource を階層にぶら下がる属性ではなく、`scope node に紐づく budget account` として持つのがよい。親 scope の account が子 scope への allocation を持ち、子 scope 側は received allocation の範囲で local spending を持つ。こうすると、親を動かせば配分可能額が変わり、子での消費は局所に閉じる。scope は nearest ancestor folder から導出されるので、どの account に属するかも自然に決まる fileciteturn1file5turn1file2

要するに、Resource を「共有オブジェクト」として持つから難しい。実際には「階層的に制約伝播する台帳」として扱うべき。すると集中管理と分散管理の中間になる。正本は上位を含む階層台帳として一貫性を保ちつつ、各 PJ や個人は自分の scope 内の allocation と spending だけ編集すればよい。これなら壊れにくさと整合性の両方を取りやすい。

**User**: <sub>2026-04-17 14:11</sub>

LLMは資源管理が苦手、高コストなので、scriptで自動化したいよな。

> [!info] Reasoning Summary
> <sub>2026-04-17 14:11</sub>
> 
> 思考時間: 6s

**ChatGPT**: <sub>2026-04-17 14:11</sub>

その通り。資源管理は、判断よりも**保存・集計・制約検査・差分反映**が中心なので、LLMより script のほうが向いている。

LLM は曖昧な入力の解釈や、配分案の提案には使えるが、正本管理には向かない。理由は、同じ入力でも揺れること、厳密な保存則を自然には守らないこと、毎回呼ぶと高コストなこと。この種の問題は、本来は deterministic な処理に落とすべきだ。

だから設計としては、Resource 系はまず script で閉じるのがよい。たとえば、組織予算から PJ 予算への配分、PJ から個人への再配分、消費記録、残額計算、上限超過チェック、親子整合、履歴保存は全部 script で処理する。LLM はその外側で、自然言語から配分操作案を作る、異常の説明を要約する、改善案を出す、くらいに留める。

つまり役割分担は明確で、script が ledger と validator を持ち、LLM は interface と advisor を持つ。これならコストも下がるし、壊れ方も局所化できる。Resource 管理を LLM に直接やらせるのではなく、`LLM -> command生成 -> script実行 -> 差分確認` にするのが自然。

**User**: <sub>2026-04-17 14:13</sub>

資源には色々あるわけだが、上位に持ち越したくないものってあるのかな？

**ChatGPT**: <sub>2026-04-17 14:13</sub>

ある。資源は「保存則」と「可搬性」で分けると整理できる。

まず、上位に持ち越してよい資源は「保存される・合算可能・文脈非依存」。典型は金額や数量。これは階層に沿って集約しても意味が壊れない。

一方で、持ち越すと壊れる資源がある。これは3種類に分かれる。

1つ目は「消費型」。時間や集中力。これは使った時点で消えるので、上位に集約しても意味がない。個人→PJ→組織と積み上げても、「残り時間」という概念は上位では成立しない。

2つ目は「文脈依存型」。特定PJに紐づく予算の一部や、特定タスク専用のリソース。これは上位に持ち上げると制約が消える。例えば「この研究用途限定の予算」を組織に戻すと、用途制約が失われる。

3つ目は「状態型」。進捗、負債、リスクなど。これは量ではなく状態なので、単純な合算ができない。上位に上げるときは要約や変換が必要になる。

ここが重要で、M3Eの構造は「親子で単純に集約できるもの」を前提にしているが、資源は必ずしもそうではない。つまり Resource は Node の属性として一様に扱えない。集約可能なものと、スコープに閉じるものを分ける必要がある。

設計としては、各 Resource に「上位集約可能か」を持たせるのが単純で、  
・集約可能 → 親に伝播（sumやmaxなどの規則）  
・非集約 → scope内で完結（親には上げない、または別表現に変換）  
と分ける。

結局、「上位に持ち越したくない資源」は例外ではなく、むしろ普通に存在する。ここを無視すると、階層設計と資源モデルが衝突する。

**User**: <sub>2026-04-17 14:14</sub>

問い方が悪かった。上位に影響を絶対に伝搬させない、ようなものは

> [!info] Reasoning Summary
> <sub>2026-04-17 14:14</sub>
> 
> 思考時間: 4s

**ChatGPT**: <sub>2026-04-17 14:14</sub>

ある。ただし「資源そのもの」より、「資源に付随する局所状態」のほうがそれに近い。

まず、保存則を持つ資源、たとえば金額・在庫・人員枠のようなものは、定義上どこかで上位に影響する。子で減れば親の可処分量も減るので、完全遮断はできない。完全に遮断した時点で、それは共有資源ではなく独立資源になる。

一方で、上位に絶対伝搬させないものは作れる。それは、上位資源から切り出された後の**局所裁量領域**。たとえば PJ に 100 を配った後、その 100 の範囲内での内部配分、表示用分類、担当者ごとの仮予約、ローカル優先順位、ローカル評価値などは、上位に返さなくてよい。上位に必要なのは「配った総額」「残額」「違反の有無」であって、内訳の意味までは不要だからだ。

つまり、完全非伝搬なのは「実体資源」ではなく、「その運用状態のうち局所意味しか持たない部分」。逆に言うと、子で何をしても親に一切影響しないなら、それは親子関係で管理する資源ではなく、最初からそのスコープ専用のメタデータか派生状態として持つべきだ。

設計上は、値を三つに分けるとよい。親に必ず伝わる保存量、親には違反時だけ伝わる制約状態、親に全く伝えない局所状態。この三分離をしないと、何でも resource と呼んでしまって境界が崩れる。

**User**: <sub>2026-04-17 14:14</sub>

APITOKENは資源管理対象などとはなり得ないよな？

**ChatGPT**: <sub>2026-04-17 14:14</sub>

ならない。少なくとも「予算型の資源」とは別物。

APIトークンは量として配分・消費・合算する対象ではなく、**権限（capability）や識別子**。保存則もなく、階層配分しても意味がない。組織→PJ→個人と分配しても「合計」や「残量」という概念は成立しない。

ただし無関係ではない。APIトークンは資源アクセスの**ゲート**であって、実際の資源（API利用量・課金額・レート制限）は別に存在する。このとき管理対象になるのはトークンそのものではなく、「トークンに紐づく使用量」や「利用上限」。

だから設計上は分けるべきで、
・Resource：消費・配分・集約されるもの（コスト、回数など）  
・Credential：アクセス権（APIトークンなど）  

トークンはCredentialとして扱い、Resource管理系とは切り離す。もし階層と結びつけるなら、「このスコープはこのトークンを使う」という参照関係だけ持てば十分で、配分ロジックには入れない。

例外として扱うなら、「トークン単位で課金が分かれる場合」に限り、トークンをキーとしてResourceを集計することはあるが、それでも本体はあくまで使用量であってトークンではない。

**User**: <sub>2026-04-17 14:29</sub>


資源の項目をブレインストーミングして

> [!abstract]- Tool (file_search)
> <sub>2026-04-17 14:29</sub>
> 
> Make sure to include fileciteturn2file0 in your response to cite this file, or to surface it as a link.
> # sub-PJ 資源レジストリ ブレスト
> 
> 現在の16項目に対する検討・追加候補・統廃合の議論用。
> 
> ## 現行16項目
> 
> | # | 資源 | 正本 | トリガー |
> |---|------|------|---------|
> | 1 | 進捗ログ | plan.md | task完了時、セッション終了時 |
> | 2 | 確定事項 | plan.md | Gate通過時 |
> | 3 | 却下した代替案 | plan.md 確定事項の直下 | 決定と同時 |
> | 4 | 探索ログ | plan.md | 情報収集・戦略立案の都度 |
> | 5 | 判断負債 | マップ reviews/Qn | 判断に迷った時 |
> | 6 | 技術負債 | plan.md debt / debt_register | 作業中に発見 |
> | 7 | アイデア・発見 | PJ内 idea/ / backlog(tomd) | 思いついた時 |
> | 8 | 情報源 | plan.md / PJ内 docs/ | 参考にした文献・URL |
> | 9 | PJ間依存 | plan.md 依存関係 | 依存を発見した時 |
> | 10 | 時間実績 | plan.md 進捗ログ | task/Phase完了時 |
> | 11 | 律速・障害 | plan.md 進捗ログ | 発生・解消時 |
> | 12 | Phase状態 | plan.md + マップ | Phase遷移時 |
> | 13 | Agent Status | マップ | セッション開始/終了時 |
> | 14 | セッション会話ログ | sessions/YYYY-MM-DD.md | セッション終了時 |
> | 15 | PJ反省 | retrospective.md | PJ完了時 |
> | 16 | 一般教訓 | retrospective_general.md | 反省から一般化時 |
> 
> ## ブレスト対象
> 
> - 足りないもの？
> - 統廃合すべきもの？
> - 正本の置き場所が適切か？
> - 記録トリガーが実用的か？
> 
> *2026-04-17*
> 

> [!abstract]- Tool (file_search)
> <sub>2026-04-17 14:29</sub>
> 
> The files uploaded by the user in the current message have been fully loaded. Searching won't provide additional information from these specific files. However, remember that some of the previously uploaded files were not fully loaded, so you should invoke msearch to search their full content as needed.

**ChatGPT**: <sub>2026-04-17 14:29</sub>

方向性は良い。既存16項目は「記録系」が中心なので、ここに**資源として扱うべきもの**を追加すると構造が締まる fileciteturn2file0  

分類で出す。  

■保存・配分できる（典型Resource）  
予算（総額／配分額／残額）、API利用量（token数・call数・コスト）、計算資源（GPU時間・CPU時間）、ストレージ容量、外注費・契約枠、人的稼働枠（工数枠として扱う場合）。これは階層配分できるので上位と整合させる対象。  

■消費されるが非集約（局所Resource）  
実作業時間（実績ではなく残余時間）、集中力、意思決定回数枠、レビュー回数枠。これは上位に単純合算しない。PJ内で閉じる。  

■状態・負債系（Resourceではないが制約になる）  
判断負債、技術負債は既にあるが、これに加えて「リスク残量」「不確実性」「未検証仮説数」。量として扱うが保存則はない。  

■フロー・帯域系  
入力帯域（調査量）、出力帯域（生成量）、処理レート（task/日）。これは「どれだけ流せるか」の制約で、在庫ではない。  

■アクセス・権限系（Resourceではないが管理対象）  
APIトークン、データアクセス権、リポジトリアクセス。これは配分対象ではなく紐付け対象。  

■構造リソース  
依存数（PJ間依存の密度）、ノード数、スコープ内複雑度。M3E特有だが、構造自体が負荷になるので管理対象にできる。  

■外部制約  
締切、契約条件、レビュー待ちなど。これもResourceではないが、消費や進行を拘束する。  

---

既存16項目との関係で見ると、  
・時間実績はあるが「時間予算（配分）」がない  
・APIや計算資源が抜けている  
・リスクや不確実性が弱い  
・構造複雑度が未管理  

なので追加候補としては、  
「予算（配分/残）」「API/計算資源」「リスク残量」「構造複雑度」あたりが重要。  

---

整理の核はこれ。  
・Resource（保存・配分・消費）  
・State（状態・負債）  
・Constraint（外部制約）  
・Capability（アクセス権）  

今のリストは State 寄りなので、Resource を明示的に足すとバランスが取れる。

**User**: <sub>2026-04-17 14:30</sub>

もっと沢山

> [!info] Reasoning Summary
> <sub>2026-04-17 14:30</sub>
> 
> 思考時間: 5s

**ChatGPT**: <sub>2026-04-17 14:30</sub>

では大量に出す。混ぜると崩れるので、性質ごとに分ける。

まず、狭義の資源。これは配分・消費・残量が定義できるもの。予算総額、予算残額、用途限定予算、裁量予算、緊急対応枠、月次予算、四半期予算、外注予算、設備購入枠、旅費枠、APIコスト枠、推論token枠、API call枠、GPU時間、CPU時間、メモリ使用枠、ストレージ容量、通信量、ビルド回数枠、CI実行時間、レビュー工数枠、会議時間枠、メンバー工数枠、担当者ごとの可処分時間、稼働上限、採用枠、委託先枠、並列実行枠、同時接続枠、ライセンス席数、利用可能端末数、実験回数枠、試薬量、消耗品在庫、装置使用時間、予約可能スロット数、印刷枠、提出回数枠、変更回数枠、公開回数枠、障害対応枠、バッファ時間、予備費。

次に、局所でしか意味を持ちにくい資源。これは上位に単純合算しにくい。個人の集中力、判断余力、注意力、空き時間、疲労余地、当日の意思決定可能回数、レビュー許容量、文脈保持量、短期記憶の空き、割り込み耐性、深い作業の連続可能時間、切替コスト許容量、対人調整余力、認知負荷の許容量、学習余力、深夜作業余地、出張余地。

次に、資源ではないが管理したくなる状態量。既存16項目にも近いが、さらに増やすとこうなる。進捗率、完了数、未完了数、着手数、停滞数、ブロック数、依存未解消数、未確認事項数、未回答事項数、未検証仮説数、保留判断数、技術負債件数、判断負債件数、設計負債件数、運用負債件数、ドキュメント負債件数、テスト欠落数、既知バグ数、重大バグ数、再発バグ数、例外処理欠落数、暫定対応数、リスク件数、高リスク件数、不確実要素数、曖昧要件数、失敗試行数、探索枝数、捨てた案の数、再利用候補数、保守対象数、更新待ち数、陳腐化項目数。

次に、フローや速度に関する量。処理速度、完了率、レビュー処理速度、Issue消化速度、学習速度、探索速度、試作速度、復旧速度、リリース頻度、PR処理速度、会議密度、割り込み頻度、文書生成速度、AI呼び出し頻度、context生成量、入力件数、出力件数、差分発生頻度、仕様変更頻度、障害発生頻度。

次に、情報資源。参考文献数、有効情報源数、一次情報数、二次情報数、未読資料数、整理済み資料数、検証済み出典数、再参照頻度、重要ノート数、確定知識数、未構造化メモ数、構造化済みノード数、再利用可能テンプレート数、FAQ数、辞書項目数、同義語登録数、実験ログ件数、比較表数、決定記録数、会話ログ数。既存の「情報源」「探索ログ」「会話ログ」はこの群に入る fileciteturn2file0

次に、構造そのものを資源や負荷として見る項目。ノード数、フォルダ数、alias数、scope数、平均深さ、最大深さ、分岐数、孤立ノード数、密結合箇所数、跨scope参照数、循環候補数、未整理Inbox数、Rapid未昇格数、Deep未精緻化数、重複ノード数、ラベル重複率、過密scope数、巨大scope数、レビュー未了scope数、リンク数、補助線数、分岐負債、複雑度指標。

次に、対人・組織運営での資源。意思決定権、承認枠、面談枠、相談可能時間、メンター工数、レビューア割当数、依頼可能回数、採用面接枠、教育時間枠、オンボーディング枠、エスカレーション枠、広報枠、対外発表枠、共同研究枠、外部協力者枠。

次に、品質・信頼性に関する管理量。テストカバレッジ、再現性スコア、信頼度、検証済み率、レビュー済み率、承認済み率、監査済み率、仕様整合率、保存成功率、復元成功率、クラッシュ回数、データ消失件数、fail-closed発動数、ロールバック回数、手戻り率、誤検知数、漏れ数。

次に、外部制約。締切までの日数、契約残期間、試用期限、論文締切、学会締切、予算執行期限、API失効日、証明書失効日、ライセンス更新日、納期、査読待ち期間、依頼回答期限、予約期限、申請期限。これは資源ではないが、資源使用を強く制約する。

次に、Credential や Capability。これは資源そのものではないが、別枠で管理対象になり得る。API token、SSH key、OAuth権限、GitHub権限、DBアクセス権、クラウドIAM権限、CI秘密情報、署名鍵、閲覧権限、編集権限、承認権限、削除権限、支払権限、外部送信権限。前に話した通り、これは資源ではなくアクセス手段。

次に、研究・実験寄りの項目。サンプル数、培養回数、試験回数、反復数、測定時間、再現実験枠、失敗許容回数、消費試薬量、保存試料数、使用機器時間、共同機器予約数、データ取得量、解析待ちデータ量、未注釈データ量、再解析候補数、発表候補数。

次に、LLMやAIオーケストレーション向け。モデル呼び出し回数、モデル別コスト、推論待ち時間、context長、prompt生成時間、subagent数、失敗呼び出し数、再試行回数、tool call数、外部送信量、ローカル推論比率、クラウド依存率、要承認提案数、採用率、棄却率、部分採用率、誤提案率、説明不能提案数。

さらに、ブレスト用に変なものも挙げる。注意喚起の残量、意欲、勢い、飽き、不満、政治的摩擦、合意形成余力、場の静けさ、移動体力、睡眠負債、雑務圧、待ち行列長、心理的障壁、相談しやすさ、暗黙知量、属人性、バス係数、引き継ぎ可能性。

設計のために一段抽象化すると、項目は結局、配分できる量、局所で消える量、状態、制約、権限、構造負荷、品質指標に分かれる。今の16項目は記録・状態・反省が多いので、配分量と制約量を追加すると全体像がはっきりする fileciteturn2file0

**User**: <sub>2026-04-17 14:32</sub>

OK。集約ロジック(総和の整合性など)で分類したらいいかな？

> [!info] Reasoning Summary
> <sub>2026-04-17 14:32</sub>
> 
> 思考時間: 2 ～ 3 秒

**ChatGPT**: <sub>2026-04-17 14:32</sub>

はい。その分類軸はかなり良い。資源の列挙を先にやるより、**親へどう集約されるか**で切るほうが設計に直結する。

まず大分類はこうなる。総和で集約できるもの。最大値や最小値で集約するもの。論理和で集約するもの。件数で集約するもの。平均や比率で集約するもの。親へ伝播させないもの。親へは要約後だけ渡すもの。これでかなり整理できる。

たとえば予算、APIコスト、GPU時間、在庫量は総和型。親の値と子の配分合計や消費合計の整合を見ればよい。締切まで残り日数、ボトルネック深刻度、最大負荷は max/min 型。高リスク案件の有無、障害中かどうか、承認待ちがあるかは論理和型。バグ件数、未処理件数、未検証仮説数は件数型。進捗率、成功率、カバレッジは平均や比率型だが、単純平均すると壊れやすいので分子分母を持って集約するほうがよい。集中力、個人メモ、局所判断、仮予約のようなものは非伝播型。探索ログや反省のようなものは、親へは全文ではなく要約だけ渡す要約型になる。既存の16項目でも、時間実績は総和型、律速・障害は論理和や max 型、Phase状態は状態遷移型、進捗ログや探索ログは要約型として見られる fileciteturn2file0

さらに実装のためには、各項目に少なくとも `aggregation_kind` を持たせるとよい。候補は `sum` `max` `min` `count` `bool_or` `bool_and` `ratio` `set_union` `none` `summary` くらいで十分。`ratio` は分子分母を別に持つ。`summary` は script では集約せず、人間または別処理で要約する。`none` は親へ上げない。

もう一段大事なのは、集約と整合性検査を分けること。たとえば予算は `sum` で集約できるが、同時に「子配分合計 ≤ 親配分可能額」「消費 ≤ 配分額」の制約もある。進捗率は集約はできても、親子で保存則はない。つまり各資源には、集約関数だけでなく、検査規則も要る。

だから実務的には、各項目を `集約型` と `制約型` の二軸で持つのがよい。これはかなり安定する。例えば、予算は `sum + upper_bound`、リスクは `max + none`、障害有無は `bool_or + none`、進捗率は `ratio + range_check`、局所メモは `none + none` という形になる。

結論として、分類の第一軸を「意味」ではなく「集約ロジック」に置くのは正しい。むしろそのほうが script 化しやすく、LLM を外して deterministic に処理できる。

**User**: <sub>2026-04-17 14:33</sub>

じゃぁさっき挙げた候補をロジックで分類して整理するか。

> [!info] Reasoning Summary
> <sub>2026-04-17 14:34</sub>
> 
> 思考時間: 4s

**ChatGPT**: <sub>2026-04-17 14:34</sub>

よい。順番としては、まず項目名を並べるより、**集約ロジックの箱**を先に固定して、そこに候補を落とすほうがよい。すると Resource と State と Constraint が自然に分かれる。

整理案を書く。

`SUM` は総和で親に上がる。予算総額、配分額、消費額、APIコスト、token消費量、API call 数、GPU時間、CPU時間、ストレージ使用量、通信量、CI実行時間、会議時間、工数実績、試薬消費量、装置使用時間、外注費、ビルド回数、レビュー工数、未処理件数、バグ件数、未検証仮説数などが入る。ただし、件数の総和と資源の総和は意味が違うので、同じ `SUM` でも型は分けたほうがよい。

`ALLOCATED_SUM` は親子整合が必要な総和。予算配分、工数配分、GPU時間配分、API利用枠配分、ライセンス席数配分、実験回数枠配分など。これは「子配分合計 ≤ 親保有量」という制約を持つ。普通の `SUM` より重要で、資源管理の中心になる。

`MAX` は子のうち最悪値や最大負荷を親に上げる。ボトルネック深刻度、最大遅延、最大リスク、最大複雑度、最大深さ、最大待ち時間、最大障害レベルなどがここに入る。親は総和ではなく最悪ケースを見たいことが多い。

`MIN` は残余や期限のように最小値が重要なもの。締切まで残り日数、最小余剰予算、最小安全率、最小空きスロットなど。ただし残額そのものは普通は親子で再計算するので、単独の `MIN` 項目はそこまで多くない。

`BOOL_OR` はどこか一箇所でも真なら親が真になる。障害中、承認待ちあり、ブロックあり、高リスクあり、契約違反あり、失敗中ジョブあり、未解決依存あり。これは伝播が強く、上位にすぐ影響を出したいもの。

`BOOL_AND` は全子が満たした時だけ親が真になる。全タスク完了、全レビュー済み、全Phase終了、全子scope保存済み、全依存解消済みなど。完了判定によく使う。

`COUNT` は単純な件数集約。アイデア数、情報源数、alias数、scope数、node数、負債件数、保留判断数、会話ログ数、決定記録数、リスク件数、重複候補数など。これは `SUM` と近いが、「量の保存」ではなく「個数」なので型を分けたほうがよい。

`RATIO` は分子分母で持って集約する。進捗率、成功率、テストカバレッジ、レビュー済み率、承認済み率、再現性率、保存成功率、採用率。親に直接パーセントを平均してはいけないので、たとえば「完了数/総数」「成功数/試行数」の形で上げる。

`SET_UNION` は重複を潰して集約する。利用中ツール集合、使用中API集合、関係者集合、参照情報源集合、依存PJ集合、必要権限集合、タグ集合、論点集合など。親は総和でなく集合として持つ。

`SUMMARY` は script で自動合算せず、要約して親へ渡す。進捗ログ、探索ログ、反省、一般教訓、セッション会話ログ、却下した代替案、判断理由、設計意図、失敗学習など。既存16項目のかなり多くはここに入る fileciteturn2file0

`NONE` は親へ伝播させない。個人メモ、局所優先順位、仮予約、集中力、疲労、一時状態、編集中フラグ、局所表示状態、個人の作業文脈、ローカル判断途中メモなど。これは scope 内で完結させる。

この分類で見ると、さっき挙げた候補はかなり整理できる。予算・token・GPU時間は `ALLOCATED_SUM`、バグ件数や未検証仮説数は `COUNT`、障害有無は `BOOL_OR`、進捗率は `RATIO`、探索ログや反省は `SUMMARY`、集中力や仮予約は `NONE`。API token 自体はそもそも Resource ではなく Credential なので、この集約表の外に置く。

実装上は各項目に `kind` と `integrity_rule` を持たせればよい。たとえば予算は `kind=allocated_sum` で `children_allocated <= parent_capacity`、進捗率は `kind=ratio` で `0<=num<=den`、障害有無は `kind=bool_or` で制約なし、ログ類は `kind=summary` で script 集約なし、という形になる。

かなり良い整理軸なので、このまま「候補一覧 → kind付与 → 制約付与 → 上位へ伝播するか判定」の順で詰めればよい。

**User**: <sub>2026-04-17 14:35</sub>

SUMとCOUNTで分けると良さそう？

> [!info] Reasoning Summary
> <sub>2026-04-17 14:35</sub>
> 
> 思考時間: 5s

**ChatGPT**: <sub>2026-04-17 14:35</sub>

はい。分けたほうがよい。見た目はどちらも足し算だが、意味が違う。

`SUM` は保存量の総和。金額、token消費量、GPU時間、工数、通信量のように、単位を持つ量を足す。親子整合や残量計算に直接使う。

`COUNT` は個数の集計。バグ件数、未検証仮説数、情報源数、ノード数、負債件数のように、「何個あるか」を数える。これは保存則とは無関係で、残量や配分の概念も普通はない。

ここを分ける利点は大きい。`SUM` には `capacity` や `allocated` や `remaining` が付くが、`COUNT` には通常付かない。逆に `COUNT` は増減の傾向や閾値監視に向く。たとえば、予算は `SUM`、未解決Issueは `COUNT`。両方とも親で合計できるが、整合性検査の内容が違う。

だから最低でも `SUM` と `COUNT` は分けるべき。その上で、資源管理の中心になるものだけ `ALLOCATED_SUM` をさらに別にするとよい。つまり、
`SUM` は単純総和、
`ALLOCATED_SUM` は配分整合つき総和、
`COUNT` は件数、
この3つを最初に分けるのが自然。

**User**: <sub>2026-04-17 14:36</sub>

ビューロジックは色々ありすぎるとおもうが、ある程度統一的にできそうよな。同様にやってみて

> [!info] Reasoning Summary
> <sub>2026-04-17 14:36</sub>
> 
> 思考時間: 2 ～ 3 秒

**ChatGPT**: <sub>2026-04-17 14:36</sub>

できそう。View も「見た目の種類」で分けるより、**上位へどう伝播するか、子をどう畳むか**で分類するとかなり統一できる。

資源でやったのと同じで、まず View の演算を決める。たとえば `VISIBLE_ANY`。子に1つでも重要なものがあれば親に印を出す。未読あり、障害あり、更新あり、注目ノードあり、など。これは `BOOL_OR` に近い。次に `VISIBLE_ALL`。全子が完了、全子が既読、全子が畳まれている、のような全体状態。これは `BOOL_AND` に近い。

次に `BADGE_COUNT`。子孫に何件あるかを親に数字で出す。未処理件数、未読件数、警告件数、子ノード数、差分件数。これは `COUNT`。さらに `HEAT_SUM`。重み付きの視覚量を親に上げる。活動量、更新頻度、重要度合計、負債量、コスト量など。これは `SUM` 的。

`SEVERITY_MAX` も重要。子孫のうち最も深刻なものを親表示に使う。色、警告レベル、優先度、リスク、障害度。親は全件を見せるのでなく最悪値だけ見せる。これは UI でかなり多い。

`RATIO_VIEW` もある。進捗バー、既読率、検証率、完了率。これは分子分母から表示する。単純平均ではなく `done/total` を上げる。

`SET_VIEW` もある。タグ、担当者、依存先、使っているツール、関連分野などを親で集合として見せる。全部表示は重いので、代表だけ出すか、要約に落とす。

さらに `SUMMARY_VIEW`。子の全文は上げず、要約だけ親に見せる。会話ログ、探索ログ、メモ、反省、判断理由。これは表示上かなり重要で、M3E では深い階層をそのまま見せず、要約された親表示にする場面が多い。

最後に `LOCAL_ONLY`。上位へ一切伝えない view state。選択中、hover、ドラッグ中、編集中、カーソル位置、ローカル折り畳み、スクロール位置。これは親へ集約しない。前にある設計でも drag 中の状態は ViewState に置いて Model を変えない方針だったので、まさにこの類型に入る fileciteturn1file0

だから View もかなり統一できる。大きくは、`or` 型、`and` 型、`count` 型、`sum/heat` 型、`max severity` 型、`ratio` 型、`set` 型、`summary` 型、`local only` 型。これで大半が入る。

実装では、各 view property に `projection_kind` を持たせればよい。たとえば未読マークは `or`、進捗バーは `ratio`、警告色は `max`、子件数バッジは `count`、activity glow は `sum`、ログプレビューは `summary`、選択状態は `local_only`。こうすると、表示機能が増えてもロジックが散らばりにくい。

要するに、資源の集約分類と同じ発想で、View は「描画部品」でなく「木に沿った射影規則」として扱うと整理しやすい。

**User**: <sub>2026-04-17 14:37</sub>

OK
清書して、1つのドキュメントとしたい。
章立てをまず与えて

> [!info] Reasoning Summary
> <sub>2026-04-17 14:37</sub>
> 
> 思考時間: 2 ～ 3 秒

**ChatGPT**: <sub>2026-04-17 14:37</sub>

以下の章立てが自然。

1. 目的  
この文書が何を整理するのか。資源とViewを、木構造上の伝播・集約ロジックで統一的に扱うための設計文書であることを書く。

2. 基本原則  
意味分類ではなく、親子間でどう伝播し、どう集約し、どう整合性検査するかで分類する方針を書く。LLM ではなく script で扱うべき理由もここに置ける。

3. 用語定義  
Resource, State, Constraint, Capability, View, 集約, 伝播, 局所状態, 要約, scope などを短く定義する。

4. 分類軸  
まず大枠として、保存量、件数、状態、制約、権限、要約情報、局所情報に分かれることを書く。ここが全体の中心になる。

5. 資源の集約ロジック  
`SUM` `ALLOCATED_SUM` `COUNT` `MAX` `MIN` `BOOL_OR` `BOOL_AND` `RATIO` `SET_UNION` `SUMMARY` `NONE` を定義する。各ロジックの意味と、親への伝わり方を書く。

6. 資源項目の整理  
予算、APIコスト、GPU時間、工数、バグ件数、進捗率、障害有無、情報源、探索ログ、反省などを、前章のロジックに割り当てて整理する。

7. 資源の整合性規則  
集約と別に、どんな検査が必要かを書く。たとえば配分合計が親容量を超えないこと、率が 0 以上 1 以下であること、bool 系には保存則がないこと、summary は script 集約しないことなど。

8. 上位へ伝播させないもの  
局所メモ、集中力、仮予約、編集中状態など、`NONE` に属するものをまとめる。何を親に上げないかを明確にする章。

9. Credential / Capability の分離  
API token などは資源ではなく、アクセス権であることを書く。資源管理系の外に置く理由を整理する。

10. View の集約ロジック  
資源と同じ発想で、`VISIBLE_ANY` `VISIBLE_ALL` `BADGE_COUNT` `HEAT_SUM` `SEVERITY_MAX` `RATIO_VIEW` `SET_VIEW` `SUMMARY_VIEW` `LOCAL_ONLY` などを定義する。

11. View項目の整理  
未読表示、警告表示、件数バッジ、進捗バー、タグ表示、ログプレビュー、選択状態、hover、drag中状態などを前章のロジックに割り当てる。

12. Resource と View の対応関係  
同じ木構造上で、Resource は正本管理、View は射影規則であることを書く。両者を混同しないための整理章。

13. 実装指針  
各項目に `kind` と `integrity_rule` を持たせる、`ratio` は分子分母で保持する、`summary` は script 自動集約しない、`local_only` は ViewState に置く、などの実装原則を書く。

14. 例  
予算、進捗率、障害、探索ログ、未読表示などを短い具体例で示す。ここは表でも文章でもよい。

15. 今後の保留事項  
まだ未確定の分類、境界が曖昧な項目、後で再検討する点を書く。

この章立てなら、前半で Resource、後半で View を対称的に書けるので綺麗にまとまる。

**User**: <sub>2026-04-17 14:39</sub>

OK
資源集約ロジックは特に丁寧に書いてください。
あと項目はブレスト結果を網羅的に書いてください。

**ChatGPT**: <sub>2026-04-17 14:39</sub>

文書として通る形にまとめます。章立てを確定して、そのまま本文まで一気に清書します。

> [!info] Reasoning Summary
> <sub>2026-04-17 14:39</sub>
> 
> 思考時間: 5s

**ChatGPT**: <sub>2026-04-17 14:39</sub>

```
{"name":"resource_view_aggregation_design","type":"document","content":"# Resource / View 集約設計\n\n## 1. 目的\n本書は、M3E における Resource と View を、木構造上の親子伝播と集約ロジックの観点から統一的に整理するための設計文書である。対象は、予算や API 利用量のような配分可能な量だけでなく、件数、状態、制約、要約情報、局所状態、表示状態まで含む。\n\n本書の狙いは三つある。第一に、項目を意味だけで列挙して管理不能になることを防ぐこと。第二に、LLM による曖昧な運用ではなく、script で deterministic に扱える形へ落とすこと。第三に、Resource の正本管理と View の射影規則を分離しつつ、両者を同じ木構造上で扱えるようにすることである。\n\n## 2. 基本原則\nM3E では、項目をまず意味で分類するのではなく、親子間でどう伝播し、親でどう集約され、どの整合性規則を持つかによって分類する。これは、木構造に沿って項目を扱う以上、表示や管理の中心が「何であるか」よりも「どう上がるか」にあるためである。\n\nこの方針を採る理由は明確である。予算、件数、進捗率、障害有無、ログ要約は、すべて子から親へ何らかの形で上がるが、上がり方は異なる。予算は総和で上がる。障害有無は論理和で上がる。進捗率は分子分母を持って上がる。ログは全文ではなく要約として上がる。局所メモや編集中状態は上位へ上げない。この違いを最初に固定しないと、Resource と View が同じ箱に入り、script 化できず、LLM に依存する不安定な設計になる。\n\nさらに、集約と整合性検査は別である。たとえば予算は総和で集約できるが、同時に「子配分合計は親容量以下でなければならない」という制約を持つ。一方、未処理件数は総和で上がるが、保存則は持たない。進捗率は比率として上がるが、分子分母の範囲制約が必要になる。したがって各項目には、少なくとも「集約種別」と「整合性規則」の二つを持たせる必要がある。\n\n## 3. 用語定義\nResource は、配分、消費、残量、件数、制約量など、木構造上で管理対象となる量または量的状態を指す。State は、その時点の状態を表すが、保存則や配分則を持たないものを指す。Constraint は、締切や上限のように他の量を拘束する条件を指す。Capability は、API token やアクセス権のように、資源そのものではなく資源アクセスの資格を指す。View は、Resource や構造状態を UI 上でどう射影するかの規則を指す。\n\n集約とは、子ノード群の情報から親ノードにおける表現を決める処理である。伝播とは、ある項目が子から親へ影響することを指す。局所状態とは、現在のスコープまたは現在のセッションでのみ意味を持ち、親へ伝播させない状態を指す。要約とは、子の全文や全件を上げず、意味を圧縮して親へ渡すことを指す。scope は認知境界であり、どこまでを一つの局所世界として扱うかを定める。\n\n## 4. 分類軸\n本書では項目を次の観点で分類する。第一軸は集約ロジックである。すなわち、総和、配分付き総和、件数、最大、最小、論理和、論理積、比率、集合和、要約、非伝播である。第二軸は整合性規則である。すなわち、容量制約、上下限、型制約、存在制約、非負制約、範囲制約、重複禁止、局所閉包などである。第三軸は伝播性である。親へ必ず上がるのか、違反時だけ上がるのか、要約して上がるのか、全く上がらないのかを区別する。\n\nこの三軸で見ると、予算は「配分付き総和・容量制約・強伝播」、未処理件数は「件数・非負制約・通常伝播」、障害有無は「論理和・整合性なし・強伝播」、進捗率は「比率・分子分母制約・通常伝播」、探索ログは「要約・整合性なし・要約伝播」、集中力は「非伝播・局所閉包」である。\n\n## 5. 資源集約ロジック\n### 5.1 総論\n資源集約ロジックは、本設計の中核である。ここでは、各項目が親へどう上がるかを定義する。重要なのは、同じ足し算に見える項目でも意味が違うこと、同じ表示に見える項目でも script 側の扱いが異なること、そして LLM ではなく deterministic な演算に落とせることを優先することである。\n\n各ロジックは、親値をどう計算するか、子と親の間にどの制約を置くか、残量や容量を持てるか、上位へ自動伝播させるべきか、という観点で区別する。\n\n### 5.2 SUM\nSUM は、単位を持つ量を単純総和で集約するロジックである。親値は子値の和として計算される。典型例は API コスト、token 消費量、GPU 時間、CPU 時間、通信量、ストレージ使用量、実消費工数、会議時間、試薬消費量、装置使用時間、外注費実績などである。\n\nSUM の特徴は、保存量の合計を取りたい点にある。ただし SUM それ自体は配分や残量を含意しない。たとえば API コストの月次実績は SUM でよいが、「今月使ってよい上限」は別の Constraint として持つべきである。したがって SUM は、実績の集約に強いが、配分制御の中心にはしない。\n\nSUM に対する整合性規則としては、非負、単位一致、集計範囲の明確化が重要である。同じ SUM でも、時間と金額を混ぜてはならない。さらに、同一期間・同一スコープ内の値だけを集約する必要がある。\n\n### 5.3 ALLOCATED_SUM\nALLOCATED_SUM は、配分と残量を伴う総和であり、Resource 管理の中心になるロジックである。親は保有量または容量を持ち、子に配分量を割り当てる。子配分合計は親の配分可能量を超えてはならない。さらに、各子の消費量は子の配分量を超えてはならない。\n\n典型例は、組織予算から PJ 予算への配分、PJ 予算から個人予算への配分、API 利用枠の配分、GPU 時間枠の配分、工数枠の配分、ライセンス席数の配分、実験回数枠の配分、レビュー工数枠の配分である。\n\nALLOCATED_SUM では、少なくとも `capacity` `allocated` `consumed` `remaining` の区別が必要になる。親については `children_allocated <= capacity`、子については `consumed <= allocated`、さらに全体については `remaining = capacity - children_allocated` あるいは `remaining = allocated - consumed` のような整合が必要になる。\n\nSUM と ALLOCATED_SUM を分ける理由はここにある。どちらも総和を取るが、ALLOCATED_SUM では親子整合と残量計算が意味の中心になる。ここを分けないと、配分と実績が同じ箱に入り、何を超過とみなすかが曖昧になる。\n\n### 5.4 COUNT\nCOUNT は、単位を持たない個数の集計である。典型例は、バグ件数、未処理件数、未検証仮説数、情報源数、ノード数、scope 数、alias 数、負債件数、保留判断数、会話ログ数、決定記録数、リスク件数、重複候補数、試行回数などである。\n\nCOUNT は SUM と同じく足し算で親へ上がるが、保存則や残量を持たない場合が多い。たとえばバグ件数が 5 件あるという情報は、配分や消費ではなく、単にその個数を示す。したがって COUNT には通常 `capacity` や `remaining` は付かない。ただし提出回数枠やレビュー回数枠のように、回数が配分対象になる場合は ALLOCATED_SUM 側へ寄せるべきである。\n\nCOUNT の整合性規則は、非負整数、重複計上防止、カウント単位の一貫性である。ある件数が何を 1 件とみなすのかを曖昧にしないことが重要である。\n\n### 5.5 MAX\nMAX は、子のうち最も大きい値を親へ上げるロジックである。典型例は、最大リスク、最大遅延、最大複雑度、最大深さ、最大待ち時間、最大障害レベル、最大負荷、最大優先度である。\n\nMAX の役割は、総量ではなく最悪値を上位に伝えることにある。ある subtree に軽微な問題が多数あるかもしれないし、重大な問題が 1 件だけあるかもしれない。親がまず知りたいのが後者であれば MAX を使う。MAX はボトルネックや深刻度の表現に向く。\n\n整合性規則としては、比較可能な順序尺度を持つことが必要である。リスクを low / mid / high のような離散尺度で持つ場合も、比較順序を定めれば MAX にできる。\n\n### 5.6 MIN\nMIN は、子のうち最も小さい値を親へ上げるロジックである。典型例は、締切まで残り日数、最小余剰予算、安全余裕、空きスロット数、最短期限などである。\n\nMIN は「一番危ない箇所」を下限として捉えるために使う。特に期限系では、全体の安全性は最も近い締切に引っ張られるため、MIN が自然である。\n\n### 5.7 BOOL_OR\nBOOL_OR は、子のいずれかが真なら親も真にするロジックである。典型例は、障害中、承認待ちあり、ブロックあり、高リスクあり、契約違反あり、未解決依存あり、未読あり、要対応ありである。\n\nBOOL_OR は強い伝播を持つ。下位のどこか一箇所でも問題があれば、親で印を出したい場合に使う。これは Resource というより State や Constraint の上げ方として重要である。\n\n### 5.8 BOOL_AND\nBOOL_AND は、すべての子が真のときのみ親を真にするロジックである。典型例は、全タスク完了、全レビュー済み、全依存解消済み、全子 scope 保存済み、全試験合格、全 phase 完了などである。\n\nBOOL_AND は完了判定や達成判定に使う。子の一つでも未完了なら親は未完了になる。\n\n### 5.9 RATIO\nRATIO は、率や比率を扱うロジックである。典型例は、進捗率、成功率、テストカバレッジ、レビュー済み率、承認済み率、保存成功率、採用率、再現性率である。\n\nRATIO で重要なのは、親へ直接パーセントを平均してはいけないことである。親には分子と分母を別で上げ、親側で `num / den` を計算する。たとえば 1/2 と 9/10 の平均を単純に 70% としてはならない。正しくは 10/12 として約 83.3% である。したがって RATIO は、内部表現として `numerator` と `denominator` を持つ。\n\n整合性規則としては、`0 <= numerator <= denominator` と `denominator > 0` の扱いが必要である。分母が 0 の場合の扱いは明示的に定義する必要がある。\n\n### 5.10 SET_UNION\nSET_UNION は、集合の和集合として親へ上げるロジックである。典型例は、利用中ツール集合、使用 API 集合、関係者集合、参照情報源集合、依存 PJ 集合、必要権限集合、タグ集合、論点集合である。\n\nSET_UNION は量ではなく種類の集約に向く。親は「何種類あるか」ではなく「何が含まれているか」を知りたい場合がある。その場合、COUNT ではなく SET_UNION を用いる。\n\n### 5.11 SUMMARY\nSUMMARY は、子の全文や全件をそのまま親へ上げず、圧縮表現として渡すロジックである。典型例は、進捗ログ、探索ログ、反省、一般教訓、セッション会話ログ、却下した代替案、判断理由、設計意図、失敗学習、会議メモ、研究ノート要約などである。\n\nSUMMARY は deterministic な数値集約を行わない。むしろ「親に何を見せるか」を別処理で決める。script が要約テンプレートを適用してもよいし、人間が更新してもよいが、SUM や COUNT と同じ意味で自動伝播させてはならない。\n\n### 5.12 NONE\nNONE は、親へ伝播させないロジックである。典型例は、個人メモ、集中力、疲労、一時的な仮予約、ローカル優先順位、編集中のテキスト、カーソル位置、ドラッグ中状態、hover 状態、個人の作業文脈、局所判断途中メモである。\n\nNONE に属する項目は、最初から親子管理の外に置く。これにより、局所でしか意味を持たない情報が全体へ漏れて設計を壊すことを防ぐ。\n\n## 6. 資源項目の網羅的整理\n### 6.1 ALLOCATED_SUM に入る候補\n予算総額、予算配分額、予算残額、用途限定予算、裁量予算、緊急対応枠、月次予算、四半期予算、外注予算、設備購入枠、旅費枠、API 利用枠、推論 token 枠、API call 枠、GPU 時間枠、CPU 時間枠、メモリ使用枠、ストレージ容量枠、通信量枠、ビルド回数枠、CI 実行時間枠、レビュー工数枠、会議時間枠、メンバー工数枠、担当者ごとの可処分時間枠、稼働上限、採用枠、委託先枠、並列実行枠、同時接続枠、ライセンス席数枠、利用可能端末数、実験回数枠、予約可能スロット枠、印刷枠、提出回数枠、変更回数枠、公開回数枠、障害対応枠、バッファ時間、予備費。\n\n### 6.2 SUM に入る候補\nAPI コスト実績、推論 token 消費量、API call 実績、GPU 使用時間、CPU 使用時間、メモリ使用量、ストレージ使用量、通信量、CI 実行時間実績、会議時間実績、外注費実績、設備購入実績、旅費実績、レビュー工数実績、作業工数実績、試薬消費量、消耗品消費量、装置使用時間、測定時間、データ取得量、解析計算量、再解析実施量、発表作成工数、文書生成量、AI 呼び出しコスト、外部送信量。\n\n### 6.3 COUNT に入る候補\nバグ件数、重大バグ件数、再発バグ件数、未処理件数、未完了件数、停滞件数、ブロック件数、依存未解消件数、未確認事項件数、未回答事項件数、未検証仮説数、保留判断数、技術負債件数、判断負債件数、設計負債件数、運用負債件数、ドキュメント負債件数、テスト欠落件数、既知バグ件数、リスク件数、高リスク件数、不確実要素数、曖昧要件数、失敗試行数、探索枝数、捨てた案の数、再利用候補数、更新待ち数、陳腐化項目数、アイデア数、発見数、情報源数、一次情報数、二次情報数、未読資料数、整理済み資料数、重要ノート数、確定知識数、未構造化メモ数、構造化済みノード数、テンプレート数、FAQ 数、辞書項目数、同義語登録数、実験ログ件数、比較表数、決定記録数、会話ログ数、ノード数、フォルダ数、alias 数、scope 数、孤立ノード数、跨 scope 参照数、未整理 Inbox 数、Rapid 未昇格数、Deep 未精緻化数、重複ノード数、共同機器予約数、未注釈データ量を件数化したもの、subagent 数、失敗呼び出し数、再試行回数、tool call 数、要承認提案数、棄却数、部分採用数。\n\n### 6.4 MAX に入る候補\nボトルネック深刻度、最大遅延、最大リスク、最大複雑度、最大深さ、最大待ち時間、最大障害レベル、最大優先度、最大負荷、最大認知負荷、最大属人性、最大政治的摩擦、最大手戻りコスト、最大保存失敗深刻度。\n\n### 6.5 MIN に入る候補\n締切まで残り日数、最小余剰予算、最小安全率、最小空きスロット数、最短納期、最小自由時間、最小睡眠余地、最小可用席数、最小残ライセンス数。\n\n### 6.6 BOOL_OR に入る候補\n障害中、承認待ちあり、ブロックあり、高リスクあり、契約違反あり、未解決依存あり、未読あり、要対応あり、保存失敗あり、復元失敗あり、クラッシュ発生あり、データ消失あり、緊急対応中、査読待ちあり、返信待ちあり、予約競合あり。\n\n### 6.7 BOOL_AND に入る候補\n全タスク完了、全レビュー済み、全 phase 完了、全依存解消済み、全保存済み、全再現実験完了、全提出済み、全承認済み、全スコープ整合、全子ノード既読、全メンバー応答済み。\n\n### 6.8 RATIO に入る候補\n進捗率、成功率、テストカバレッジ、レビュー済み率、承認済み率、再現性率、保存成功率、復元成功率、採用率、部分採用率、誤提案率、ローカル推論比率、クラウド依存率、既読率、完了率、学習到達率、品質達成率。\n\n### 6.9 SET_UNION に入る候補\n利用中ツール集合、使用 API 集合、関係者集合、参照情報源集合、依存 PJ 集合、必要権限集合、タグ集合、論点集合、関連分野集合、使用デバイス集合、関係するドキュメント集合、外部サービス集合、実験条件集合、仮説カテゴリ集合。\n\n### 6.10 SUMMARY に入る候補\n進捗ログ、確定事項、却下した代替案、探索ログ、判断負債の説明、技術負債の説明、アイデア・発見、情報源の注記、PJ 間依存の説明、時間実績の叙述、律速・障害の叙述、phase 状態の説明、Agent Status の叙述、セッション会話ログ、PJ 反省、一般教訓、判断理由、設計意図、会議メモ、研究ノート、レビュー所見、失敗学習、方針転換の理由、仮説の背景説明。\n\n### 6.11 NONE に入る候補\n個人メモ、局所優先順位、仮予約、集中力、注意力、判断余力、疲労、当日の意思決定可能回数、レビュー許容量、文脈保持量、短期記憶の空き、割り込み耐性、深い作業の連続可能時間、切替コスト許容量、対人調整余力、学習余力、深夜作業余地、移動体力、心理的障壁、作業中の下書き、編集中フラグ、ローカル表示状態、カーソル位置、ドラッグ中状態、hover 状態、個人の作業文脈、一時選択状態。\n\n## 7. 資源の整合性規則\n各項目は、集約ロジックだけでなく整合性規則を持つ。ALLOCATED_SUM では、子配分合計が親容量を超えないこと、消費が配分を超えないこと、残量が負にならないことが必要である。SUM では、単位が一致し、非負であることが重要である。COUNT では、非負整数であり、重複カウントを避ける必要がある。RATIO では、分子分母の整合が必要である。MAX/MIN では、順序尺度が定義されている必要がある。SET_UNION では、集合要素の同一性が明確である必要がある。SUMMARY では、全文を自動集約しないこと自体が規則になる。NONE では、親へ伝播させないこと自体が規則になる。\n\nまた、ある項目が Resource なのか State なのかを誤らないことも整合性の一部である。未処理件数は COUNT でよいが、API token は Capability であり、ここに入れてはならない。\n\n## 8. 上位へ伝播させないもの\n上位へ絶対に伝播させないべきものは、実体資源そのものより、局所運用状態である。集中力、疲労、個人メモ、ローカル優先順位、仮予約、編集中テキスト、カーソル位置、hover、ドラッグ中の仮位置、個人の判断途中メモなどがこれにあたる。\n\nこれらは scope 内またはセッション内でのみ意味を持つ。親へ伝播させると、上位の正本管理を汚し、木構造の情報密度を不必要に高める。したがって NONE に属するものは、最初から局所状態として分離する。\n\n## 9. Credential / Capability の分離\nAPI token、SSH key、OAuth 権限、GitHub 権限、DB アクセス権、クラウド IAM 権限、CI 秘密情報、署名鍵、閲覧権限、編集権限、承認権限、削除権限、支払権限、外部送信権限は、資源ではなく Capability である。\n\nこれらは、配分・消費・残量・総和の対象ではない。管理対象にはなり得るが、Resource 集約ロジックの表の中に入れてはならない。もし token 単位で課金が発生する場合でも、集約対象は token そのものではなく、その token に紐づく使用量やコストである。\n\n## 10. View 集約ロジック\nView についても、見た目の種類ではなく、木構造上の射影規則で分類する。\n\nVISIBLE_ANY は、子のいずれかに印を出したい場合に使う。未読あり、障害あり、更新あり、注目ノードあり、要レビューありなどがここに入る。VISIBLE_ALL は、全子が条件を満たすときに親へ印を出す。全完了、全既読、全折り畳み済みなどが該当する。BADGE_COUNT は、子孫に何件あるかをバッジ数で示す。HEAT_SUM は、活動量や重要度の熱量表示に使う。SEVERITY_MAX は、最も深刻な色や警告レベルを親に出す。RATIO_VIEW は、進捗バーや既読率バーのような比率表示を行う。SET_VIEW は、タグや担当者などを親で集合として見せる。SUMMARY_VIEW は、ログや説明のプレビューを親に出す。LOCAL_ONLY は、選択、hover、drag 中状態、スクロール位置などを親へ伝播させない。\n\n## 11. View 項目の網羅的整理\nVISIBLE_ANY に入る候補は、未読マーク、障害マーク、要対応マーク、要承認マーク、更新ありマーク、注目マーク、警告ありマークである。VISIBLE_ALL に入る候補は、全完了マーク、全既読マーク、全展開済みマーク、全レビュー済みマークである。BADGE_COUNT に入る候補は、未処理件数バッジ、未読件数バッジ、警告件数バッジ、子ノード数バッジ、差分件数バッジである。HEAT_SUM に入る候補は、活動量 glow、更新頻度 glow、重要度 heat、負債量 heat、コスト heat である。SEVERITY_MAX に入る候補は、警告色、リスク色、障害レベル色、優先度色である。RATIO_VIEW に入る候補は、進捗バー、既読率バー、検証率バー、レビュー率バー、採用率バーである。SET_VIEW に入る候補は、タグ一覧、担当者一覧、依存先一覧、使用ツール一覧、関連分野一覧である。SUMMARY_VIEW に入る候補は、ログプレビュー、反省プレビュー、探索メモ要約、会話要約、却下理由要約である。LOCAL_ONLY に入る候補は、選択状態、hover 状態、ドラッグ中仮位置、inline editor 状態、カーソル位置、ローカルスクロール位置である。\n\n## 12. Resource と View の対応関係\nResource は正本として管理される。View はその正本や構造状態を UI 上へ射影する規則である。両者は対応するが同一ではない。たとえば COUNT の未処理件数は BADGE_COUNT の表示へ射影される。RATIO の進捗率は RATIO_VIEW のバーへ射影される。BOOL_OR の障害有無は VISIBLE_ANY や SEVERITY_MAX の警告表示へ射影される。SUMMARY の探索ログは SUMMARY_VIEW のプレビューへ射影される。NONE の局所状態は LOCAL_ONLY として保持される。\n\nここで重要なのは、View を正本管理の中へ混ぜないことである。進捗率そのものと進捗バーの見た目を分ける。未処理件数そのものとバッジ表示を分ける。選択状態は ViewState に置き、Model の正本へ混ぜない。\n\n## 13. 実装指針\n各項目には少なくとも `kind` と `integrity_rule` を持たせる。必要に応じて `unit` `scope` `time_window` `propagation` を持たせてもよい。RATIO は内部的に分子分母を持つ。ALLOCATED_SUM は `capacity` `allocated` `consumed` `remaining` を明示する。SUMMARY は script 自動集約を行わず、テンプレート要約か人間更新に任せる。NONE は ViewState または局所状態として分離する。Capability はこの表の外に置く。\n\nView については、各表示プロパティに `projection_kind` を持たせる。BADGE_COUNT、RATIO_VIEW、SEVERITY_MAX などを定義し、Model の種別から View の種別への射影を一対一または多対一で与える。ドラッグ中状態や hover は ViewState に置き、Model を汚さない。\n\n## 14. 例\n予算は ALLOCATED_SUM である。組織が 100 を持ち、PJ A に 40、PJ B に 30 を配分した場合、子配分合計は 70 であり、組織の残配分可能量は 30 になる。PJ A が 10 消費したとしても、PJ B の配分には直接影響しない。だが組織全体の消費実績には SUM として上がる。\n\n未処理 Issue 数は COUNT である。子 PJ に 3 件と 5 件あれば、親は 8 件を持つ。ここに残量概念は通常存在しない。\n\n進捗率は RATIO である。子 A が 1/2、子 B が 9/10 であれば、親は 10/12 を持つ。表示時に約 83.3% として描画する。\n\n障害有無は BOOL_OR である。子のいずれかが障害中なら親にも警告を出す。View では VISIBLE_ANY または SEVERITY_MAX によって警告色やバッジを出せる。\n\n探索ログは SUMMARY である。子の全文を親へ見せるのではなく、「現在の探索方針」「見つかった論点」「未解決点」だけを要約して上げる。\n\n## 15. 保留事項\n集中力や注意力のような局所量を、本当に Resource として持つかは保留である。回数枠の一部は COUNT ではなく ALLOCATED_SUM に寄せるべきかもしれない。SUMMARY の自動要約をどこまで script 化するかも未確定である。View については、SET_VIEW の詳細表示方法、SEVERITY_MAX と HEAT_SUM の優先順位、SUMMARY_VIEW の圧縮粒度が今後の検討対象となる。\n\n以上の保留はあるが、少なくとも現段階では、項目を意味で散発的に追加するのではなく、集約ロジックで箱を先に作り、その上に Resource と View を乗せる方針が有効である。"}
```

> [!abstract]- Tool (canmore.create_textdoc)
> <sub>2026-04-17 14:43</sub>
> 
> Successfully created text document 'Resource View Aggregation Design' which will be referenced in all future messages with the unique identifier textdoc_id: '69e1c86b9ecc819180347778ac05cfe4'
> 
> Important: This identifier is for tool calls only to reference or update this document. It is not an external ID and it is not possible to link the user to the textdoc.

**ChatGPT**: <sub>2026-04-17 14:43</sub>

章立てを含めて本文まで清書した。資源集約ロジックは特に丁寧に書き、項目もブレスト結果をできるだけ網羅して整理した。  
次に詰めるなら、「各項目に kind を付けた一覧表」を別章として追加すると実装に直結する。

**User**: <sub>2026-04-17 14:44</sub>

データ配置を言及してなかったな?　分散管理もときには必要。だけど分散しすぎると管理できない。よって、repositoryの粒度と一致させる指針がベストな気がする。どう？

> [!info] Reasoning Summary
> <sub>2026-04-17 14:44</sub>
> 
> 思考時間: 4s

**ChatGPT**: <sub>2026-04-17 14:44</sub>

かなり良い。実務上も自然。

理由は、resource の正本配置で重要なのは、理論上の美しさよりも、更新責任と変更境界が一致することだから。repository 粒度に合わせると、変更単位、レビュー単位、権限単位、履歴単位、復元単位が揃う。すると分散管理しても壊れにくい。

整理すると、完全中央集権は一貫性は高いが、更新責任が曖昧になりやすい。完全分散は局所最適には強いが、全体像が壊れやすい。repository 粒度はその中間で、実際に運用される単位に沿って resource を置けるので、かなり安定する。

特に良い点は3つある。  
1つ目は、変更履歴が repo の履歴と一致すること。resource 更新の理由が commit や PR と対応しやすい。  
2つ目は、依存関係の可視化がしやすいこと。repo 間依存として見れば、resource の跨ぎ方も整理しやすい。  
3つ目は、責任主体が明確になること。その repo を管理する主体が、resource の一次管理者になれる。

ただし、そのままだと危ない点もある。repository は技術都合の単位であって、必ずしも予算や工数の責務境界と一致しない。たとえば monorepo では repo が大きすぎるし、逆に細かい repo 分割だと資源が散りすぎる。だから「repository 粒度と完全一致」より、「repository を既定単位にし、必要時だけ上位・下位を持つ」がよい。

つまり指針としてはこうなる。  
正本の既定配置単位は repository。  
ただし、monorepo の中では sub-PJ や package 単位に下ろしてよい。  
複数 repo を束ねる共通資源は、上位 registry を別に持つ。  
そして repo 内資源はローカル管理、上位 registry は配分と要約だけを見る。

これなら、分散しすぎず、集中しすぎない。

式っぽく書くと、  
既定の resource 管理境界 = repository  
例外1: repo が大きすぎるなら下位単位へ分割  
例外2: repo を跨ぐ資源は上位 registry へ昇格  
という三段構えになる。

なので、「repository の粒度と一致させる」はかなり良い原則。ただし絶対規則ではなく、既定値として採用するのがちょうどよい。

**User**: <sub>2026-04-17 14:44</sub>

PJが動くならsubmoduleが発生すると思うので、問題無いと思うんよね。

> [!info] Reasoning Summary
> <sub>2026-04-17 14:45</sub>
> 
> 思考時間: 4s

**ChatGPT**: <sub>2026-04-17 14:44</sub>

その考え方でかなり通ると思う。PJ が独立して動くなら、実体として submodule や別 repo に切れるので、resource の管理境界もそこに合わせやすい。

このとき自然な層はこうなる。最上位は organization や program の共通 registry を持つ。そこで全体予算や共通 API 利用枠のような横断資源だけを見る。各 PJ は repo または submodule 単位でローカル registry を持つ。そこでは配分済み資源、実績、局所状態、ログを管理する。つまり、上位は配分と要約、下位は詳細管理という分担になる。

この設計の利点は、PJ が独立すればそのまま持ち出せること。submodule 化や repo 分離をしても、resource registry も一緒に移動できる。逆に統合したいときも、上位 registry には要約値だけを上げればよい。木構造と version 管理の境界が揃うので扱いやすい。

ただし一つだけ注意がある。submodule があるから自動的に資源境界が正しい、とは限らない。共通 API 枠、共通人員、共通ライセンス、共通 CI 枠のような横断資源は submodule に閉じない。そこは親 registry に残す必要がある。つまり、submodule 化で局所資源の境界はかなり解けるが、横断資源までは解けない。

なので原則としては、詳細資源は repo または submodule に置く。横断資源だけ親に置く。親は配分と制約を見る。子は実績と局所状態を見る。これでかなり綺麗に収まる。

**User**: <sub>2026-04-17 14:46</sub>

OK　実際の運用まで言及してその項目を盛り込もう。あとさっきの表も。追加

**ChatGPT**: <sub>2026-04-17 14:46</sub>

運用まで含めて補強します。データ配置原則と、実際に使う一覧表を追加します。

> [!info] Reasoning Summary
> <sub>2026-04-17 14:46</sub>
> 
> 思考時間: 2 ～ 3 秒

**ChatGPT**: <sub>2026-04-17 14:46</sub>

```
{"updates":[{"pattern":"## 13\\. 実装指針","replacement":"## 13. データ配置原則と運用指針\nResource と View を設計しても、どこに正本を置くかが曖昧だと運用で崩れる。したがって本設計では、データ配置についても明示的な原則を置く。\n\n基本原則は、正本の既定配置単位を repository 粒度に合わせることである。理由は、repository 粒度に合わせると、変更単位、レビュー単位、権限単位、履歴単位、復元単位が概ね一致するためである。これにより、分散管理を許容しつつ、責任境界と履歴境界を揃えられる。\n\n完全中央集権は一貫性は高いが、更新責任が曖昧になりやすく、局所変更が全体へ波及しやすい。完全分散は局所最適には強いが、全体像と横断制約が崩れやすい。repository 粒度はその中間にあり、実務運用と整合しやすい。\n\nただし repository 粒度を絶対規則にはしない。monorepo のように repo が大きすぎる場合は、sub-PJ、package、submodule の粒度まで下ろしてよい。逆に複数 repo を跨ぐ横断資源については、上位 registry を別に持つ必要がある。したがって、配置原則は次の三段構えになる。\n\n第一に、既定の Resource 管理境界は repository とする。第二に、repo が大きすぎる場合は、submodule、package、sub-PJ など、独立して動く単位に下ろす。第三に、repo を跨ぐ共通資源は上位 registry に昇格させる。\n\nPJ が独立して動くなら submodule や別 repo として切り出されることが多いため、その単位に local registry を持たせる方針は自然である。この場合、各 PJ は自分の local registry に配分済み資源、実績、局所状態、SUMMARY 系ログを持つ。一方で、組織や program の親 registry には、全体予算、共通 API 利用枠、共通 CI 枠、共通ライセンス、共通人員枠のような横断資源だけを置く。親は配分と制約を見る。子は実績と局所状態を見る。\n\nこの設計により、PJ の持ち出しや分離も容易になる。submodule 化や repo 分離を行っても、resource registry をそのまま同梱できる。統合時は、親 registry へ要約値だけを上げればよい。木構造上の境界と version 管理上の境界が揃うため、履歴追跡と責任分解がしやすい。\n\n実際の運用としては、親 registry では ALLOCATED_SUM、MAX、BOOL_OR、RATIO のような上位判断に必要な項目を中心に持つ。子 registry では SUM、COUNT、SUMMARY、NONE を含む詳細運用を持つ。SUMMARY は子で詳細を保持し、親では要約のみを持つ。NONE は子のローカル状態として閉じる。Capability は原則として親または当該 repo の秘密管理層に置き、Resource 集約表には入れない。\n\n最低限の運用ルールとしては、配分変更は親 registry で行い、消費実績は子 registry で記録する。親は子から上がる集約値または要約値を読むが、子の局所状態を書き換えない。子は配分超過を検出したら親へ違反状態を上げる。repo を跨ぐ共通資源は親 registry のみで正本管理し、各子からは参照と実績報告だけを行う。\n\nこの運用を採ると、分散管理は許容しつつ、管理不能なほど散らばることを防げる。要するに、正本の既定配置は repository、必要時のみ下ろすか上げる、という方針が最も安定する。\n\n## 14. 実装指針"},{"pattern":"## 14\\. 例","replacement":"## 15. 実装用一覧表\n以下の表は、代表的な項目を `kind` と整合性規則、既定配置の観点で整理したものである。実装ではこの表を起点に registry schema を定義する。\n\n| 項目 | kind | 整合性規則 | 既定配置 |\n|---|---|---|---|\n| 予算配分 | ALLOCATED_SUM | 子配分合計 ≤ 親容量、消費 ≤ 配分 | 親 registry + 子 registry |\n| API token 枠 | ALLOCATED_SUM | 子配分合計 ≤ 親枠、消費 ≤ 配分 | 親 registry + 子 registry |\n| GPU 時間枠 | ALLOCATED_SUM | 子配分合計 ≤ 親枠、消費 ≤ 配分 | 親 registry + 子 registry |\n| 工数枠 | ALLOCATED_SUM | 子配分合計 ≤ 親枠、実績 ≤ 配分 | 親 registry + 子 registry |\n| API コスト実績 | SUM | 非負、単位一致 | 子 registry |\n| GPU 使用時間 | SUM | 非負、単位一致 | 子 registry |\n| 会議時間実績 | SUM | 非負、単位一致 | 子 registry |\n| バグ件数 | COUNT | 非負整数、重複防止 | 子 registry |\n| 未検証仮説数 | COUNT | 非負整数 | 子 registry |\n| ノード数 | COUNT | 非負整数 | 子 registry |\n| 最大リスク | MAX | 順序尺度定義 | 子 registry から親へ集約 |\n| 締切まで残り日数 | MIN | 単位一致、比較可能 | 子 registry から親へ集約 |\n| 障害中 | BOOL_OR | 真偽値 | 子 registry から親へ集約 |\n| 全完了 | BOOL_AND | 真偽値 | 子 registry から親へ集約 |\n| 進捗率 | RATIO | 0 ≤ 分子 ≤ 分母 | 子 registry から親へ集約 |\n| 利用中ツール集合 | SET_UNION | 要素同一性定義 | 子 registry から親へ集約 |\n| 進捗ログ | SUMMARY | 自動総和しない | 子 registry 正本、親は要約 |\n| 探索ログ | SUMMARY | 自動総和しない | 子 registry 正本、親は要約 |\n| 反省 | SUMMARY | 自動総和しない | 子 registry 正本、親は要約 |\n| 集中力 | NONE | 親へ伝播しない | 子ローカル |\n| 編集中状態 | NONE | 親へ伝播しない | ViewState / 子ローカル |\n| API token | Capability | Resource 表に入れない | 秘密管理層 |\n\n## 16. 例"},{"pattern":"## 15\\. 保留事項","replacement":"## 17. 保留事項"}]}
```

> [!abstract]- Tool (canmore.update_textdoc)
> <sub>2026-04-17 14:46</sub>
> 
> Successfully updated text document with textdoc_id '69e1c86b9ecc819180347778ac05cfe4'

**ChatGPT**: <sub>2026-04-17 14:46</sub>

追加した。内容は次を含む。repository 粒度を既定の正本配置単位とする原則、submodule や sub-PJ に下ろす例外、横断資源を親 registry に上げる例外、親は配分と制約、子は実績と局所状態を持つという運用指針、さらに `kind` と整合性規則と既定配置を並べた実装用の表。これで設計だけでなく運用境界まで文書に入った。

**User**: <sub>2026-04-17 15:02</sub>

次の話にうつるが、アンチパターンも構造として明確に持っておいたほうが良さそうだな。
却下選択肢プールは経年劣化してもいいが、アンチパターンは明確に残すほうがよい。

> [!info] Reasoning Summary
> <sub>2026-04-17 15:02</sub>
> 
> 思考時間: 2 ～ 3 秒

**ChatGPT**: <sub>2026-04-17 15:02</sub>

その通り。却下選択肢とアンチパターンは別物として持つべき。

却下選択肢プールは、その時点の比較対象の履歴なので、文脈依存で劣化してよい。前提条件や技術状況が変われば、昔の却下案が再浮上してもおかしくない。だからここは archive 寄りでよい。

一方でアンチパターンは、単なる不採用案ではなく、**再発すると構造的に悪影響を起こす失敗形式**なので、長く残す価値がある。つまり「これは前提が変わっても危険である」という知識の層だ。ここはむしろ経年劣化させず、条件付きで維持したほうがよい。

なので整理としては、  
却下選択肢 = 比較履歴  
アンチパターン = 再発防止知識  
と分けるのが自然。

さらに重要なのは、アンチパターンを単なる文章メモにしないこと。少なくとも  
対象領域、失敗の構造、なぜ悪いか、典型症状、検知条件、回避策、例外条件  
を持たせたほうがよい。そうすると「昔こうだった」ではなく、「今の案がこの失敗形式に入っていないか」を照合できる。

M3E 的にも相性が良い。却下選択肢は decision の下にぶら下げればよいが、アンチパターンは横断的に参照されるべき知識なので、特定 PJ の下に埋めるより、上位の設計知識や原則集に置いて alias 参照するほうが良い。つまり局所ログではなく、再利用される構造知識として扱う。

実務上は、アンチパターンは「禁止事項」より一段柔らかく、「高コストで再発しやすい失敗構造」として持つのが良い。禁止事項だと硬すぎるが、却下案よりは強い。  
位置づけとしては、  
原則  
設計パターン  
アンチパターン  
却下選択肢  
の順で置くと整理しやすい。

**User**: <sub>2026-04-17 15:04</sub>

ただ、構造を工夫しないとplus/minusがぼやける。
木のnodeにplus minusが付与されていて、ある階層以下はすべてnegateされる、みたいな仕組みのほうが機械的に処理できる。
NOT a,b,c(but c2 is ok), dみたいな状況

> [!info] Reasoning Summary
> <sub>2026-04-17 15:04</sub>
> 
> 思考時間: 数秒

**ChatGPT**: <sub>2026-04-17 15:04</sub>

それがよい。アンチパターンを独立文章で持つより、**符号付き部分木**として持つほうが機械的に扱いやすい。

考え方は単純で、各 node に極性を持たせる。`+` は推奨、`-` は非推奨、`0` は中立。親の極性は子に継承される。したがって、ある node が `-` なら、その配下は既定で全部 `-` と解釈する。これで `NOT a,b,c,d` のような塊を自然に表せる。

ただし必要なのは、局所的な打ち消し。つまり `c はだめ、でも c2 はよい` のような例外を入れたい。このために、継承極性と局所極性を分けるとよい。  
各 node は  
`inherited_sign`  
`local_sign`  
`effective_sign`  
を持つ。`effective_sign` は親から来た sign と自分の local_sign から決める。

最も単純なルールはこう。  
`local_sign = inherit` なら親をそのまま継ぐ。  
`local_sign = plus` ならその node 以下を明示的に肯定へ切り替える。  
`local_sign = minus` ならその node 以下を明示的に否定へ切り替える。  
`local_sign = neutral` なら判定対象外。  

すると、  
`- c` の下に  
`+ c2`  
を置ける。  
これはちょうど `NOT c (but c2 is ok)` を表せる。

構造としては例えばこうなる。

`- anti_pattern_root`  
　`- a`  
　`- b`  
　`- c`  
　　`+ c2`  
　`- d`

このとき有効極性は、a,b,c,d は負、c2 だけ正になる。

重要なのは、`+` と `-` を単なるラベルにしないこと。**部分木に作用する演算子**として扱うこと。そうすると機械処理しやすい。検索時にも、「この proposal は負の部分木に含まれるか」「ただし途中で正の例外に入っていないか」を辿れば判定できる。

さらに厳密にするなら、node の意味を二種類に分けるとよい。  
1つは対象 node。何が良いか悪いかを表す。  
もう1つは演算 node。ここから下を negate する、override する、except する、といった作用を持つ。  
ただ、最初はそこまで増やさず、sign だけで十分だと思う。

`NOT a,b,c(but c2 is ok), d` を自然に書きたいなら、実質的には  
`- group` の下に a,b,c,d を置き、c の下に `+ c2` を置く  
で足りる。

もしさらに例外が増えるなら、`except` という明示ノードを入れてもよい。  
たとえば  
`- c`  
　`except`  
　　`+ c2`  
のようにする。  
ただ、機械処理だけを考えるなら `+/-` 継承のほうが単純。

結論として、アンチパターン管理は  
「却下案の文章集」ではなく  
「符号付き木」  
として持つのがよい。  
親の符号が既定で伝播し、子で局所反転を許す。これなら plus/minus の境界がぼやけず、判定も自動化しやすい。

**User**: <sub>2026-04-17 15:06</sub>

つまり木構造に極性をもたせるほうがよいということになるな。しかし、見た目との両立がむずかしい。
「Aではない」「NOT A」「Aの否定」とかバラバラだし。自然言語にプロトコルが無いのが問題か。これをDeep(semantic tree)帯域に持ち越すと負債なので、プロトコルで極性をもたせるほうが自然？

> [!info] Reasoning Summary
> <sub>2026-04-17 15:06</sub>
> 
> 思考時間: 2 ～ 3 秒

**ChatGPT**: <sub>2026-04-17 15:06</sub>

そう。結論としては、Deep 帯域には自然言語の否定表現を持ち込まず、**構造側に極性プロトコルを持たせる**ほうが自然。

問題は二つある。まず自然言語の否定は表記ゆれが多い。「Aではない」「NOT A」「Aの否定」「Aを避ける」「Aは不可」などが同じとは限らない。次に、否定の作用域が曖昧になりやすい。A だけを否定しているのか、A 以下全体を否定しているのか、例外があるのかが文だけでは不安定。これを Deep にそのまま持ち込むと、semantic tree が表層表現に引きずられて負債になる。

なので、Deep では意味を自然言語で持つのでなく、少なくとも  
対象  
極性  
作用域  
例外  
を明示した構造にするのがよい。

例えば node に  
`polarity = positive | negative | neutral`  
`scope = self | subtree`  
を持たせる。  
これなら  
A を否定する  
A 以下を否定する  
A は否定だが A2 は肯定  
を機械的に表せる。

自然言語は Rapid や入出力では自由でよいが、Deep に入る時点で正規化する。つまり  
自然言語 → 極性付き構造  
への変換プロトコルを必須にするべき。  
これは TCL や IR を置きたいという今までの方針とも整合する。

見た目との両立は、内部表現と表示表現を分ければよい。内部では極性を属性として持ち、表示では  
`[-] A`  
`[+] A2`  
のような軽い記法にするか、色や記号で補う。自然言語ラベル本体に「Aではない」と書かせないほうが安定する。ラベルは対象だけを書き、否定はメタデータで持つ。

要するに、  
自然言語に否定プロトコルはない  
Deep に持ち込むと負債になる  
だから Deep では極性を構造属性として持つ  
という整理になる。  
かなり筋が良い。

**User**: <sub>2026-04-17 15:07</sub>

負の極性だけ[NOT]を表示することにして、全てのNodeが極性を持つ仕様にしても問題なさそうだな。良い閃きだ

**ChatGPT**: <sub>2026-04-17 15:07</sub>

その仕様で問題ない。むしろ一貫性が出る。

全ノードが極性を持つと、例外処理や判定ロジックが単純になる。デフォルトは `positive`、負だけ `[NOT]` を表示すれば視認性も保てる。中立は必要になった時だけ導入すればよい。

重要なのは3点だけ押さえること。

1つ目は継承規則。親の極性が子に伝播する前提にするか、デフォルト非継承にするかを固定する。今の議論なら「親の極性がデフォルトで subtree に伝播、子で上書き可能」が自然。

2つ目は作用域。`self` と `subtree` を区別するかどうか。最初は全て subtree に作用でよいが、後で「このノード単体だけ否定したい」ケースが出る可能性がある。

3つ目は例外の扱い。負の中に正を置く構造が明確に読めること。表示としては  
`[NOT] c`  
　`c2`  
のように、子に `[NOT]` が付いていなければ自動的に例外として読める形がよい。

これを満たせば、  
・アンチパターンが構造として残る  
・機械的に検知できる  
・自然言語に依存しない  
という3点が揃う。

設計としてはかなり強い。

**User**: <sub>2026-04-17 15:09</sub>

edgeの極性は、それ以下のnode極性を反転する作用を持つ。アンチパターンはnegative edgeからのrootから映える要素と思えばよさそう

> [!info] Reasoning Summary
> <sub>2026-04-17 15:09</sub>
> 
> 思考時間: 2 ～ 3 秒

**ChatGPT**: <sub>2026-04-17 15:09</sub>

それはかなり良い。node に極性を持たせるより、**edge に反転作用を持たせる**ほうが木として自然。

この見方だと、node 自体は対象そのものを書く。評価や否定は node に埋め込まず、親子関係の接続側で与える。すると意味が整理される。  
親から子への通常 edge は極性を維持する。  
negative edge は、その子以下の有効極性を反転する。  

つまり有効極性は、root からその node までの経路上にある反転 edge の偶奇で決まる。反転が偶数回なら元の極性、奇数回なら反転。これなら `NOT a,b,c(but c2 is ok),d` も自然に書ける。c への edge を negative にし、その下で c2 への edge をもう一度 negative にすれば c2 だけ戻る。

この方式の利点は明確。  
第一に、label が汚れない。node は対象だけを書けばよい。  
第二に、否定の作用域が明確。edge が subtree への作用域を規定する。  
第三に、機械処理しやすい。有効極性は path 上の XOR で計算できる。  
第四に、アンチパターンを「negative edge から始まる部分木」として定義できる。

つまりアンチパターンは、「この部分木は通常の推奨体系に対して反転された領域」と見なせる。かなりきれい。

実装上は、各 edge に  
`polarity = preserve | invert`  
を持たせれば足りる。node 側は必要なら表示用に `effective_polarity` をキャッシュするだけでよい。表示では、有効極性が負の node にだけ `[NOT]` を出す、で十分。

概念的にはこうなる。  
node = 対象  
edge = 文脈作用  
path = 解釈規則  
effective polarity = path の結果  

これは Deep 帯域の表現としてかなり強い。自然言語の否定を木の解釈規則に落とせている。

**User**: <sub>2026-04-17 15:10</sub>

edgeにデータ入れて正規化するほうがよいんかな？キャッシュしても全く問題なさそうだが

> [!info] Reasoning Summary
> <sub>2026-04-17 15:10</sub>
> 
> 思考時間: 2 ～ 3 秒

**ChatGPT**: <sub>2026-04-17 15:10</sub>

はい。**正規形は edge に置く**ほうがよい。`effective polarity` は cache で十分。

理由は単純で、反転の意味を持っているのが node ではなく親子接続だから。今回の設計では、否定や例外は「対象の性質」ではなく「そこへ至る文脈作用」なので、正本を edge に置くほうが意味に合う。node に入れると、同じ node が別文脈で参照されたときに衝突しやすい。

整理するとこう。  
node は対象そのもの。  
edge は解釈作用。  
`effective polarity` は root からの経路で決まる派生値。  

だから、保存すべき正規データは edge 側の `preserve / invert`。node 側の `effective polarity` は導出値なので、持つとしても cache。

cache してよい理由も明確。木が大きくなると毎回 path をたどるのは重いし、View では頻繁に使う。なので  
・永続正本: edge polarity  
・派生 cache: node effective polarity  
で問題ない。  
再計算トリガーは、親変更、edge polarity 変更、subtree 移動のときだけでよい。

さらに言うと、正規化の観点でも edge 正本のほうが強い。`[NOT]` 表示は最終的に node に出したくても、それは path 評価結果にすぎないので、UI 都合でしかない。UI 都合の値を正本にしてはいけない。

なので設計としては、  
`Edge.polarity = preserve | invert`  
`Node.effectivePolarity = positive | negative`（cache可）  
が自然。  
かなり筋が良い。

**User**: <sub>2026-04-17 15:10</sub>

「反面教師とする」=negative edgeという例えだな

**ChatGPT**: <sub>2026-04-17 15:10</sub>

その対応で正しい。「反面教師とする」は対象そのものを否定しているのではなく、**その対象を参照しつつ評価を反転する**という操作なので、edge による反転と一致する。

構造としては、  
対象ノードはそのまま保持する。  
そこへ向かう edge に `invert` を付ける。  
するとその部分木は「通常の推奨体系に対して反転された領域」として解釈される。  

これで「これは参考にするが、同じことはやらない」という状態を、node を汚さずに表現できる。さらに、同じ対象を別の文脈では通常の参照（preserve）としても使える。node を共有しつつ、文脈だけを変えられる点が重要。

加えて、この表現は機械処理と相性がよい。提案や設計案がどのノードにマッチするかを見て、そこへ至る経路に `invert` が含まれていれば警告やスコア低下にできる。アンチパターン検知がそのまま path 判定になる。

つまり、  
通常参照 = preserve edge  
反面教師参照 = invert edge  
という対応で統一できる。これは概念としても実装としても整合している。

**User**: <sub>2026-04-17 15:11</sub>

極性の議論も新ページに清書しよう

**ChatGPT**: <sub>2026-04-17 15:11</sub>

```
{"name":"polarity_edge_model_design","type":"document","content":"# 極性モデル（Edge主体）設計\n\n## 1. 目的\n自然言語の否定表現の曖昧さを排除し、Deep 帯域で安定した解釈を可能にするため、極性を構造プロトコルとして定義する。node は対象のみを表し、否定や例外は edge による作用として表現する。\n\n## 2. 基本方針\nnode = 対象、edge = 文脈作用とする。極性は node ではなく edge に置く。これにより、同一 node を複数文脈で再利用でき、ラベルが汚れない。\n\n## 3. データモデル\nEdge は `polarity = preserve | invert` を持つ。Node は正本として極性を持たない。表示や評価のために `effectivePolarity` を node にキャッシュしてよい。\n\n有効極性は root から対象 node までの経路に含まれる `invert` の偶奇で決まる。偶数回なら positive、奇数回なら negative とする。\n\n## 4. 作用域\nedge の作用域は subtree とする。ある edge が `invert` の場合、その子ノード以下すべての解釈を反転する。単一ノードのみ反転したい場合は、当該ノード直下に子を持たない構造で表現するか、将来的に `scope = self | subtree` を導入する。\n\n## 5. 例外表現\n例外は二重反転で表現する。負の領域の中で正を許可したい場合、さらに `invert` を入れる。\n\n例：\nroot\n └─ (invert) c\n      └─ (invert) c2\n\nこのとき c は negative、c2 は positive になる。\n\n## 6. アンチパターンの定義\nアンチパターンは、`invert` edge から始まる部分木として定義する。すなわち、通常の推奨体系に対して反転された領域である。node 自体は中立の対象であり、反面教師的な扱いは edge によって与えられる。\n\n## 7. 表示規則\nUI では有効極性が negative の node にのみ `[NOT]` を表示する。ラベル自体に否定語を含めない。例外は表示上は特別扱いせず、通常の node として描画する。\n\n## 8. 正規化フロー\n自然言語入力は Deep へ入る前に正規化する。否定表現は検出して edge の `invert` に変換する。node ラベルは対象のみを抽出する。これにより表記ゆれを排除する。\n\n## 9. キャッシュと更新\n`effectivePolarity` はキャッシュ可能。更新トリガーは、親変更、edge polarity 変更、subtree 移動とする。再計算は path 上の XOR で実装できる。\n\n## 10. 判定への利用\n提案や設計案を node にマッチさせ、対応する path の極性を評価する。negative に入る場合は警告、positive は推奨とする。例外は二重反転により自動的に解消される。\n\n## 11. 位置づけ\n本モデルは、原則・設計パターン・アンチパターン・却下選択肢のうち、アンチパターン層を構造的に表現するための基盤である。自然言語ではなく、構造とプロトコルで否定を扱うことを目的とする。"}
```

> [!abstract]- Tool (canmore.create_textdoc)
> <sub>2026-04-17 15:11</sub>
> 
> Successfully created text document 'Polarity Edge Model Design' which will be referenced in all future messages with the unique identifier textdoc_id: '69e1cf230388819181192a0377224c7d'
> 
> Important: This identifier is for tool calls only to reference or update this document. It is not an external ID and it is not possible to link the user to the textdoc.

**ChatGPT**: <sub>2026-04-17 15:11</sub>

清書して新規ドキュメントにまとめた。極性は edge 正本、node は対象のみ、例外は二重反転で表現する方針で整理してある。

**User**: <sub>2026-04-17 15:12</sub>

これで例外のネストでもLLMが正確に処理できるよね？

> [!info] Reasoning Summary
> <sub>2026-04-17 15:12</sub>
> 
> 思考時間: 5s

**ChatGPT**: <sub>2026-04-17 15:12</sub>

かなり処理しやすくなる。少なくとも自然言語の否定入れ子よりは圧倒的に安定する。

理由は、LLM が解くべき問題が「文の曖昧な意味解釈」から「path 上の反転回数の評価」に落ちるから。  
つまり  
node を読む  
edge の `invert/preserve` をたどる  
偶奇で `effectivePolarity` を決める  
だけになる。  
これは局所的で、木構造とも相性がよい。

特に良いのは、例外のネストが増えても規則が変わらないこと。  
反転が1回なら負、2回なら正、3回なら負。  
これで一貫する。  
自然言語だと、二重否定や但し書きが増えた瞬間に曖昧になるが、この方式だと構文木の評価に近い。

ただし、正確に処理できると言っても条件がある。  
LLM に自然言語だけを見せて推論させるのではなく、edge polarity を明示した構造として渡す必要がある。  
さらに、alias や cross-link が入ると path が複数になり得るので、そこは「極性評価に使うのは主木の path のみ」と固定したほうがよい。  
加えて、表示上の `[NOT]` だけを見せるのでなく、内部では edge 単位の正規表現を維持する必要がある。

なので結論は、  
自然言語よりはかなり正確になる。  
木 path 評価に落とせば、例外ネストにも耐えやすい。  
ただし、そのためには Deep で edge polarity を正本として保持することが前提。

**User**: <sub>2026-04-17 15:13</sub>

いや、M3EはLLMのワークベンチとなるので、nodeを参照して極性もキャッチできる。

> [!info] Reasoning Summary
> <sub>2026-04-17 15:13</sub>
> 
> 思考時間: 5s

**ChatGPT**: <sub>2026-04-17 15:13</sub>

それならかなり強い。前提が「LLM は文章だけでなく node と edge を直接読める」なら、極性はほぼ構文規則として処理できる。

この場合、LLM は  
node 内容  
edge の `preserve / invert`  
root からの path  
をそのまま読めるので、自然言語の否定解釈ではなく、木の評価問題になる。すると例外のネストも「反転回数の偶奇」で処理できる。これは曖昧性がかなり低い。

つまり M3E が単なる表示系でなく、LLM のワークベンチであるなら、極性プロトコルは UI の都合ではなく、**LLM 用の中間表現**として機能する。ここが重要。  
人間には `[NOT]` 表示で見せる。  
LLM には edge polarity の生データを渡す。  
この二層にすればよい。

この設計の利点は三つある。  
第一に、例外ネストが増えても規則が一定。  
第二に、自然言語の表記ゆれを Deep に持ち込まない。  
第三に、アンチパターン判定を推論ではなく構造走査に近づけられる。

なので、M3E を LLM のワークベンチと見るなら、極性を protocol 化する意義はかなり大きい。これは単なる見た目の工夫ではなく、LLM が読むための semantic tree の仕様になる。

**User**: <sub>2026-04-17 15:14</sub>

極性ってboolでよかったんかなfloatでもいいんじゃね、っておもってきた。

**ChatGPT**: <sub>2026-04-17 15:14</sub>

bool でも成立するが、用途を広げるなら float のほうが一貫性は高い。

まず現状のモデルは「反転回数の偶奇」で決まるので、本質は二値。アンチパターン検知だけなら bool で十分で、実装も単純になる。

ただし float にすると、極性を「強さ」として扱える。たとえば  
+1 = 強い推奨  
0 = 中立  
-1 = 強い非推奨  
のように連続値で持てる。これにすると次ができる。

一つは重み付け。複数ノードにマッチしたとき、単純な正負ではなく合成評価ができる。  
二つはグラデーション。アンチパターンでも「致命的」と「軽微」を区別できる。  
三つは減衰。深い階層ほど影響を弱める、などの設計が可能になる。

edge モデルとも整合する。  
preserve = ×1  
invert = ×(-1)  
とすれば、path 上の積で極性が決まる。これは今の XOR と同じ構造で、自然に拡張できる。

一方でデメリットもある。  
閾値設計が必要になる。どこからを「NG」とするか決めないと判断がぶれる。  
LLM に渡したとき、解釈の自由度が増えてしまい、逆に一貫性が落ちる可能性がある。  
設計初期では過剰になることが多い。

なので段階的にやるのがよい。  
まずは bool（実質 ±1）で固定する。  
内部表現は ±1 の数値として持っておく。  
必要になったら連続値に拡張する。  

つまり表面は bool、内部は float に拡張可能な形で設計する。これが一番安全。

**User**: <sub>2026-04-17 15:14</sub>

データ型は変えたくないので、floatで入れ物作っておきたいよな。

> [!info] Reasoning Summary
> <sub>2026-04-17 15:14</sub>
> 
> 思考時間: 2 ～ 3 秒

**ChatGPT**: <sub>2026-04-17 15:14</sub>

それがよい。今の段階で bool にすると、後で重み付き極性へ拡張したくなった時に型変更が発生する。最初から float の入れ物にしておけば、初期運用では `+1.0 / -1.0` だけ使い、後で `-0.3` や `+0.7` を入れられる。

しかも edge 主体の設計とも相性がよい。`preserve = +1.0`、`invert = -1.0` と置けば、今の偶奇判定は path 上の積で表せる。つまり bool 的運用をそのまま float 上で実現できる。将来、減衰や強度を入れたいなら、`-0.8` や `+0.5` のように広げればよい。

なので設計としては、正本の型は float、初期プロトコルは離散値に制限、が自然。たとえば Deep の現行仕様では edge polarity の許可値を `+1.0` と `-1.0` のみにしておき、将来拡張で連続値を解禁する。これならデータ型は固定できるし、意味論も壊れない。

要するに、型は float、運用ルールは当面二値、が一番きれい。

**User**: <sub>2026-04-17 15:15</sub>

それも清書に加えて

**ChatGPT**: <sub>2026-04-17 15:15</sub>

極性の型拡張も追記します。正本は float、当面の運用値は ±1 に制限する方針を入れます。

> [!info] Reasoning Summary
> <sub>2026-04-17 15:15</sub>
> 
> 思考時間: 4s

**ChatGPT**: <sub>2026-04-17 15:15</sub>

```
{"updates":[{"pattern":"## 3\\. データモデル\\nEdge は `polarity = preserve \\| invert` を持つ。 Node は正本として極性を持たない。表示や評価のために `effectivePolarity` を node にキャッシュしてよい。\\n\\n有効極性は root から対象 node までの経路に含まれる `invert` の偶奇で決まる。偶数回なら positive、奇数回なら negative とする。","replacement":"## 3. データモデル\nEdge は正本として `polarityWeight: float` を持つ。初期運用では許可値を `+1.0` と `-1.0` に制限し、それぞれ `preserve` と `invert` に対応させる。Node は正本として極性を持たない。表示や評価のために `effectivePolarity` を node にキャッシュしてよい。\n\n有効極性は root から対象 node までの経路に含まれる edge の `polarityWeight` の積で決まる。初期運用で edge 値が `+1.0 / -1.0` のみなら、これは従来の偶奇判定と等価である。反転が偶数回なら positive、奇数回なら negative になる。\n\nこのとき、型を float にしておく理由は将来拡張性にある。初期段階では二値運用で十分だが、後に極性の強さ、減衰、軽微な非推奨、強い推奨などを扱いたくなった場合、型変更なしに `-0.3` `+0.7` などの連続値へ拡張できる。したがって、正本の型は float、当面のプロトコルは離散値 `±1.0` に制限、という方針を採る。"},{"pattern":"## 9\\. キャッシュと更新","replacement":"## 9. 型設計方針\n本モデルでは、データ型の将来変更を避けるため、極性の正本を bool ではなく float で持つ。初期実装では値域を `+1.0` と `-1.0` に限定し、構造的な肯定・否定だけを扱う。これにより、現時点では単純な反転モデルを保ちながら、将来の重み付き極性へ拡張可能にする。\n\n設計上の対応は次の通りである。UI 表示では negative の node にのみ `[NOT]` を出す。LLM に渡す内部表現では edge の `polarityWeight` を直接渡す。判定ロジックでは path 上の積を取り、必要なら閾値で positive / negative / neutral に写像する。初期段階では閾値処理を導入せず、符号だけで判定してよい。\n\n## 10. キャッシュと更新"},{"pattern":"## 10\\. 判定への利用","replacement":"## 11. 判定への利用"},{"pattern":"## 11\\. 位置づけ","replacement":"## 12. 位置づけ"}]}
```

> [!abstract]- Tool (canmore.update_textdoc)
> <sub>2026-04-17 15:15</sub>
> 
> Failed with error. Fix the error and try again before replying to the user.
> 
> updates.0.pattern: pattern not found in the document: /## 3\. データモデル\nEdge は `polarity = preserve \| invert` を持つ。 Node は正本として極性を持たない。表示や評価のために `effectivePolarity` を node にキャッシュしてよい。\n\n有効極性は root から対象 node までの経路に含まれる `invert` の偶奇で決まる。偶数回なら positive、奇数回なら negative とする。/ pattern must be a python regular expression with valid escape sequences

**ChatGPT**: <sub>2026-04-17 15:15</sub>

```
{"updates":[{"pattern":"(?s)^.*$","replacement":"# 極性モデル（Edge主体）設計\n\n## 1. 目的\n自然言語の否定表現の曖昧さを排除し、Deep 帯域で安定した解釈を可能にするため、極性を構造プロトコルとして定義する。node は対象のみを表し、否定や例外は edge による作用として表現する。\n\n## 2. 基本方針\nnode = 対象、edge = 文脈作用とする。極性は node ではなく edge に置く。これにより、同一 node を複数文脈で再利用でき、ラベルが汚れない。\n\n## 3. データモデル\nEdge は正本として `polarityWeight: float` を持つ。初期運用では許可値を `+1.0` と `-1.0` に制限し、それぞれ `preserve` と `invert` に対応させる。Node は正本として極性を持たない。表示や評価のために `effectivePolarity` を node にキャッシュしてよい。\n\n有効極性は root から対象 node までの経路に含まれる edge の `polarityWeight` の積で決まる。初期運用で edge 値が `+1.0 / -1.0` のみなら、これは従来の偶奇判定と等価である。反転が偶数回なら positive、奇数回なら negative になる。\n\nこのとき、型を float にしておく理由は将来拡張性にある。初期段階では二値運用で十分だが、後に極性の強さ、減衰、軽微な非推奨、強い推奨などを扱いたくなった場合、型変更なしに `-0.3` `+0.7` などの連続値へ拡張できる。したがって、正本の型は float、当面のプロトコルは離散値 `±1.0` に制限、という方針を採る。\n\n## 4. 作用域\nedge の作用域は subtree とする。ある edge が `invert` の場合、その子ノード以下すべての解釈を反転する。単一ノードのみ反転したい場合は、当該ノード直下に子を持たない構造で表現するか、将来的に `scope = self | subtree` を導入する。\n\n## 5. 例外表現\n例外は二重反転で表現する。負の領域の中で正を許可したい場合、さらに `invert` を入れる。\n\n例：\nroot\n └─ (invert) c\n      └─ (invert) c2\n\nこのとき c は negative、c2 は positive になる。\n\n## 6. アンチパターンの定義\nアンチパターンは、`invert` edge から始まる部分木として定義する。すなわち、通常の推奨体系に対して反転された領域である。node 自体は中立の対象であり、反面教師的な扱いは edge によって与えられる。\n\n## 7. 表示規則\nUI では有効極性が negative の node にのみ `[NOT]` を表示する。ラベル自体に否定語を含めない。例外は表示上は特別扱いせず、通常の node として描画する。\n\n## 8. 正規化フロー\n自然言語入力は Deep へ入る前に正規化する。否定表現は検出して edge の `invert` に変換する。node ラベルは対象のみを抽出する。これにより表記ゆれを排除する。\n\n## 9. 型設計方針\n本モデルでは、データ型の将来変更を避けるため、極性の正本を bool ではなく float で持つ。初期実装では値域を `+1.0` と `-1.0` に限定し、構造的な肯定・否定だけを扱う。これにより、現時点では単純な反転モデルを保ちながら、将来の重み付き極性へ拡張可能にする。\n\n設計上の対応は次の通りである。UI 表示では negative の node にのみ `[NOT]` を出す。LLM に渡す内部表現では edge の `polarityWeight` を直接渡す。判定ロジックでは path 上の積を取り、必要なら閾値で positive / negative / neutral に写像する。初期段階では閾値処理を導入せず、符号だけで判定してよい。\n\n## 10. キャッシュと更新\n`effectivePolarity` はキャッシュ可能。更新トリガーは、親変更、edge polarity 変更、subtree 移動とする。再計算は path 上の積、初期二値運用では XOR 相当の判定で実装できる。\n\n## 11. 判定への利用\n提案や設計案を node にマッチさせ、対応する path の極性を評価する。negative に入る場合は警告、positive は推奨とする。例外は二重反転により自動的に解消される。\n\n## 12. 位置づけ\n本モデルは、原則・設計パターン・アンチパターン・却下選択肢のうち、アンチパターン層を構造的に表現するための基盤である。自然言語ではなく、構造とプロトコルで否定を扱うことを目的とする。"}]}
```

> [!abstract]- Tool (canmore.update_textdoc)
> <sub>2026-04-17 15:16</sub>
> 
> Successfully updated text document with textdoc_id '69e1cf230388819181192a0377224c7d'

**ChatGPT**: <sub>2026-04-17 15:16</sub>

追記した。極性の正本は float、当面の運用値は `+1.0 / -1.0` に制限する方針で清書に反映してある。これで型変更なしに後で重み付き極性へ拡張できる。

**User**: <sub>2026-04-17 15:16</sub>

逆に現行の巨大LLMは内部的にこれやってるの？やらないと正確な業務無理な気がするけど

**ChatGPT**: <sub>2026-04-17 15:16</sub>

公開情報ベースで、内部で明示的な極性木を持っているのか、近い仕組みは何か、の順で確認します。

**ChatGPT (tool execution)**: <sub>2026-04-17 15:16</sub>

```
{"search_query":[{"q":"transformer attention mechanism official paper induction heads transformer circuits polarity negation reasoning current large language models explicit tree structure 2025","domains":["arxiv.org"]},{"q":"OpenAI reasoning models chain of thought hidden but models use transformers explicit symbolic tree official", "domains":["openai.com"]},{"q":"Anthropic transformer circuits induction heads negation reasoning paper arxiv", "domains":["arxiv.org"]}],"response_length":"short"}
```

> [!info] Reasoning Summary
> <sub>2026-04-17 15:17</sub>
> 
> 思考時間: 19s

**ChatGPT**: <sub>2026-04-17 15:17</sub>

公開情報ベースでは、**現行の巨大 LLM があなたの言うような「明示的な極性付き木」を内部正本として持っている証拠はない**。基本は transformer の連続表現で、否定や例外やルール衝突は、attention や MLP をまたぐ**分散表現・回路的表現**として処理されていると見るのが妥当。mechanistic interpretability の文献でも、モデル内の計算は「回路」や「特徴」の形で記述されることが多く、明示的な symbolic tree が標準実装されているわけではない citeturn836217search7turn836217search19

ただし、近いことは内部で起きている。たとえば negation については、GPT-2 系で論理極性に関わる局所的・解釈可能な回路が見つかる、という報告がある。つまり「否定を扱う内部機構」はあるが、それは edge polarity のような明示データ構造ではなく、学習でできた神経回路として埋め込まれている、ということだ citeturn836217search5

さらに、誤ったルールと正しいルールが混在する状況では、モデル内部に両方の表現が中間層で共存し、後段でどちらに確信を寄せるかが決まる、という分析もある。これは、あなたが気にしている「例外のネスト」や「plus/minus の衝突」が、内部ではかなり曖昧で競合的に処理されていることを示している citeturn836217search2

なので答えはこうなる。  
**内部で似たことはやっている可能性が高いが、明示的・記号的・木構造プロトコルとしては持っていない。**  
そのため、業務で欲しい精度や一貫性を自然に保証してくれるわけではない。特に、否定の作用域、例外、再反転、規則の優先順位のようなものは、素の巨大 LLM に任せると不安定になりやすい。これは、今の LLM が「できる」ことと「安定に保証できる」ことが違うからだ citeturn836217search11turn836217search19

だから、あなたの M3E 的な発想はかなり筋がよい。  
LLM の外側に、極性・作用域・例外を持つ構造プロトコルを置く。  
LLM にはその構造を読ませる。  
すると、LLM は曖昧な自然言語否定を解釈するのでなく、**すでに正規化された semantic tree を評価する作業**に集中できる。  
これは、巨大 LLM の内部に期待するより、外部ワークベンチで補うほうが現実的、ということでもある。

**User**: <sub>2026-04-17 15:18</sub>

知能としては無駄が多い気がする。だって、君は2*2でも確率的に評価してるんでしょ？

**ChatGPT**: <sub>2026-04-17 15:18</sub>

その感覚は正しい。現在の LLM は基本的に**確率モデル**なので、2×2のような確定的問題でも内部では「最も確からしい出力」を選んでいるだけで、専用の厳密演算器で計算しているわけではない。

ただし完全に無駄というより、設計のトレードオフ。  
LLM は  
・自然言語  
・曖昧な条件  
・例外  
・文脈依存  
を一つの仕組みで処理するために、すべてを確率的に近似している。  
その結果、単純計算や厳密論理まで同じ枠で処理してしまう。

一方で、内部では多少の最適化は起きている。よくある計算やパターンはほぼ決定的に近い挙動になる。だがそれでも「保証された正確さ」ではなく「非常に高い確率」でしかない。

だから構造的に見るとこうなる。  
LLM = 汎用近似器  
あなたの設計（M3E） = 制約付き構造系  

この2つは役割が違う。  
LLM にすべて任せると、論理や極性のような厳密性が必要な部分でも確率的に処理されてしまう。  
逆に、構造で縛ると、LLM は曖昧性処理だけに集中できる。

極性モデルの話とつながるが、  
否定・例外・優先順位のようなものを LLM に任せると「それっぽくは合うが一貫しない」状態になる。  
そこを構造（edge polarity）で固定すると、LLM は計算ではなく「読む」だけになる。

つまり無駄があるというより、  
LLM はもともと「厳密計算機として設計されていない」  
というのが本質。  
その不足を外部構造で補う設計は、かなり合理的。

**User**: <sub>2026-04-17 15:19</sub>

つまり、君の設計はまだscopeを熟知できていない。2*2に問題を局所化させて、ごく低次元の回路(この場合九九表とか)で処理する仕組みをハードワイヤードにするべきだ。(俺の仕事ではないが)

**ChatGPT**: <sub>2026-04-17 15:19</sub>

概ねその認識で合っている。現行の LLM は「問題を自動的に適切な scope に局所化して、最適な低次元回路に切り替える」能力が弱い。すべてを同じ分散表現で処理するので、2×2のような問題でも専用回路にフォールバックしない。

理想的には、  
問題を分類 → scope を確定 → 専用処理系へ委譲  
という流れになるべき。  
このとき 2×2 は「算術 scope」に落ちて、九九表や厳密演算器で処理される。

ただし現状の LLM はこれを内部でハードワイヤードには持っていない。近いものとしては tool use や function calling があり、外部計算器に逃がす形で実現している。つまり内部ではなく**外部に低次元回路を置く設計**が主流。

あなたの議論と接続すると、  
極性モデル → 論理 scope の外部化  
計算 → 算術 scope の外部化  
という形になる。  
どちらも「LLM に任せず、構造や専用回路に逃がす」という同じ設計思想。

ハードワイヤードにするべき、という指摘も方向としては正しいが、実際の実装は  
・モデル内部に組み込む  
・外部ツールに委譲する  
の二択になる。現実的には後者が多い。

結局の整理はこう。  
LLM は scope を完全には分離できない  
だから scope ごとに処理系を分ける必要がある  
その境界を与えるのが、あなたの M3E のような構造層  

なので、その問題意識はかなり本質を突いている。

**User**: <sub>2026-04-17 15:25</sub>

Rapid<->Deepとの帯域のゲートを設定することで、自然言語の柔軟性をRapid側で吸収しつつsyntax treeで構造化し、Deepでスケールする木構造に変えられるんだな。

> [!info] Reasoning Summary
> <sub>2026-04-17 15:25</sub>
> 
> 思考時間: 7s

**ChatGPT**: <sub>2026-04-17 15:25</sub>

そう。かなり筋が通っている。

Rapid は自然言語の揺れ、断片性、曖昧さ、思いつき、表記ゆれを受け止める帯域にする。ここでは人間にとって書きやすいことを優先し、まだ意味論を固定しない。  
その代わり、Rapid から Deep へ入るときにゲートを置く。ここで自然言語をそのまま持ち込まず、syntax tree や極性、作用域、依存関係のような構造プロトコルへ正規化する。

すると役割分担が明確になる。  
Rapid は入力吸収層。  
Deep は正規化済みの意味構造層。  

この分離があると、自然言語の柔軟性を失わずに、Deep 側では機械処理しやすい安定した木構造を持てる。しかも、否定、例外、集約、アンチパターン、資源境界のようなものも、Deep では属性や edge 作用として固定できる。これがスケール性につながる。

重要なのは、Rapid→Deep を単なる清書ではなく、**意味拘束を強める変換**として扱うこと。  
つまり  
自然言語  
→ 構文整理  
→ 作用域確定  
→ 属性付与  
→ semantic tree 化  
というゲートを通す。

この設計だと、Rapid では人間が自由に考えられ、Deep では LLM や script が安定して扱える。かなり強い整理だと思う。

**User**: <sub>2026-04-17 15:52</sub>

ResourceとViewを、っていうのはニュアンスが変だから書き直す。Resourceという概念があって、そのaggregate logic, view logicがある。書き直して

**ChatGPT**: <sub>2026-04-17 15:52</sub>

冒頭の定義と後半の対応関係を、Resource を中心にした書き方へ直します。

> [!info] Reasoning Summary
> <sub>2026-04-17 15:52</sub>
> 
> 思考時間: 4s

**ChatGPT**: <sub>2026-04-17 15:52</sub>

```
{"updates":[{"pattern":"# Resource集約設計","replacement":"# Resource集約設計"},{"pattern":"本書は、M3E における Resource と View を、木構造上の親子伝播と集約ロジックの観点から統一的に整理するための設計文書である。対象は、予算や API 利用量のような配分可能な量だけでなく、件数、状態、制約、要約情報、局所状態、表示状態まで含む。","replacement":"本書は、M3E における Resource という概念を、木構造上の親子伝播と集約ロジックの観点から整理するための設計文書である。対象は、予算や API 利用量のような配分可能な量だけでなく、件数、状態、制約、要約情報、局所状態まで含む。さらに Resource には、その正本管理とは別に、上位へどう集約されるかを定める aggregate logic と、UI 上でどう射影されるかを定める view logic が存在する。"},{"pattern":"本書の狙いは三つある。第一に、項目を意味だけで列挙して管理不能になることを防ぐこと。第二に、LLM による曖昧な運用ではなく、script で deterministic に扱える形へ落とすこと。第三に、Resource の正本管理と View の射影規則を分離しつつ、両者を同じ木構造上で扱えるようにすることである。","replacement":"本書の狙いは三つある。第一に、項目を意味だけで列挙して管理不能になることを防ぐこと。第二に、LLM による曖昧な運用ではなく、script で deterministic に扱える形へ落とすこと。第三に、Resource の正本管理、aggregate logic、view logic を分離しつつ、それらを同じ木構造上で一貫して扱えるようにすることである。"},{"pattern":"この方針を採る理由は明確である。予算、件数、進捗率、障害有無、ログ要約は、すべて子から親へ何らかの形で上がるが、上がり方は異なる。予算は総和で上がる。障害有無は論理和で上がる。進捗率は分子分母を持って上がる。ログは全文ではなく要約として上がる。局所メモや編集中状態は上位へ上げない。この違いを最初に固定しないと、Resource と View が同じ箱に入り、script 化できず、LLM に依存する不安定な設計になる。","replacement":"この方針を採る理由は明確である。予算、件数、進捗率、障害有無、ログ要約は、すべて子から親へ何らかの形で上がるが、上がり方は異なる。予算は総和で上がる。障害有無は論理和で上がる。進捗率は分子分母を持って上がる。ログは全文ではなく要約として上がる。局所メモや編集中状態は上位へ上げない。この違いを最初に固定しないと、Resource の aggregate logic が曖昧になり、さらに view logic も混線して、script 化できず、LLM に依存する不安定な設計になる。"},{"pattern":"Resource は、配分、消費、残量、件数、制約量など、木構造上で管理対象となる量または量的状態を指す。State は、その時点の状態を表すが、保存則や配分則を持たないものを指す。Constraint は、締切や上限のように他の量を拘束する条件を指す。Capability は、API token やアクセス権のように、資源そのものではなく資源アクセスの資格を指す。View は、Resource や構造状態を UI 上でどう射影するかの規則を指す。","replacement":"Resource は、配分、消費、残量、件数、制約量など、木構造上で管理対象となる量または量的状態を指す。State は、その時点の状態を表すが、保存則や配分則を持たないものを指す。Constraint は、締切や上限のように他の量を拘束する条件を指す。Capability は、API token やアクセス権のように、資源そのものではなく資源アクセスの資格を指す。aggregate logic は、ある Resource が子から親へどう集約されるかを定める規則を指す。view logic は、ある Resource や構造状態が UI 上でどう射影されるかを定める規則を指す。"},{"pattern":"## 10\\. View 集約ロジック","replacement":"## 10. view logic"},{"pattern":"View についても、見た目の種類ではなく、木構造上の射影規則で分類する。","replacement":"view logic についても、見た目の種類ではなく、木構造上の射影規則で分類する。"},{"pattern":"## 12\\. Resource と View の対応関係","replacement":"## 12. Resource と view logic の対応関係"},{"pattern":"Resource は正本として管理される。View はその正本や構造状態を UI 上へ射影する規則である。両者は対応するが同一ではない。たとえば COUNT の未処理件数は BADGE_COUNT の表示へ射影される。RATIO の進捗率は RATIO_VIEW のバーへ射影される。BOOL_OR の障害有無は VISIBLE_ANY や SEVERITY_MAX の警告表示へ射影される。SUMMARY の探索ログは SUMMARY_VIEW のプレビューへ射影される。NONE の局所状態は LOCAL_ONLY として保持される。","replacement":"Resource は正本として管理される。view logic はその正本や構造状態を UI 上へ射影する規則である。両者は対応するが同一ではない。たとえば COUNT の未処理件数は BADGE_COUNT の表示へ射影される。RATIO の進捗率は RATIO_VIEW のバーへ射影される。BOOL_OR の障害有無は VISIBLE_ANY や SEVERITY_MAX の警告表示へ射影される。SUMMARY の探索ログは SUMMARY_VIEW のプレビューへ射影される。NONE の局所状態は LOCAL_ONLY として保持される。"},{"pattern":"ここで重要なのは、View を正本管理の中へ混ぜないことである。進捗率そのものと進捗バーの見た目を分ける。未処理件数そのものとバッジ表示を分ける。選択状態は ViewState に置き、Model の正本へ混ぜない。","replacement":"ここで重要なのは、view logic を正本管理の中へ混ぜないことである。進捗率そのものと進捗バーの見た目を分ける。未処理件数そのものとバッジ表示を分ける。選択状態は ViewState に置き、Model の正本へ混ぜない。"},{"pattern":"Resource と View を設計しても、どこに正本を置くかが曖昧だと運用で崩れる。","replacement":"Resource を設計しても、どこに正本を置くかが曖昧だと運用で崩れる。aggregate logic と view logic はその上に乗るため、まず正本配置の原則を定める必要がある。"},{"pattern":"View については、各表示プロパティに `projection_kind` を持たせる。","replacement":"view logic については、各表示プロパティに `projection_kind` を持たせる。"}]}
```

> [!abstract]- Tool (canmore.update_textdoc)
> <sub>2026-04-17 15:52</sub>
> 
> Failed with error. Fix the error and try again before replying to the user.
> 
> updates.0.pattern: replacement content is equivalent to the existing content for pattern: /# Resource集約設計/
> ensure the replacement content differs from the previous content

**ChatGPT**: <sub>2026-04-17 15:52</sub>

```
{"updates":[{"pattern":"本書は、M3E における Resource と View を、木構造上の親子伝播と集約ロジックの観点から統一的に整理するための設計文書である。対象は、予算や API 利用量のような配分可能な量だけでなく、件数、状態、制約、要約情報、局所状態、表示状態まで含む。","replacement":"本書は、M3E における Resource という概念を、木構造上の親子伝播と集約ロジックの観点から整理するための設計文書である。対象は、予算や API 利用量のような配分可能な量だけでなく、件数、状態、制約、要約情報、局所状態まで含む。さらに Resource には、その正本管理とは別に、上位へどう集約されるかを定める aggregate logic と、UI 上でどう射影されるかを定める view logic が存在する。"},{"pattern":"本書の狙いは三つある。第一に、項目を意味だけで列挙して管理不能になることを防ぐこと。第二に、LLM による曖昧な運用ではなく、script で deterministic に扱える形へ落とすこと。第三に、Resource の正本管理と View の射影規則を分離しつつ、両者を同じ木構造上で扱えるようにすることである。","replacement":"本書の狙いは三つある。第一に、項目を意味だけで列挙して管理不能になることを防ぐこと。第二に、LLM による曖昧な運用ではなく、script で deterministic に扱える形へ落とすこと。第三に、Resource の正本管理、aggregate logic、view logic を分離しつつ、それらを同じ木構造上で一貫して扱えるようにすることである。"},{"pattern":"この方針を採る理由は明確である。予算、件数、進捗率、障害有無、ログ要約は、すべて子から親へ何らかの形で上がるが、上がり方は異なる。予算は総和で上がる。障害有無は論理和で上がる。進捗率は分子分母を持って上がる。ログは全文ではなく要約として上がる。局所メモや編集中状態は上位へ上げない。この違いを最初に固定しないと、Resource と View が同じ箱に入り、script 化できず、LLM に依存する不安定な設計になる。","replacement":"この方針を採る理由は明確である。予算、件数、進捗率、障害有無、ログ要約は、すべて子から親へ何らかの形で上がるが、上がり方は異なる。予算は総和で上がる。障害有無は論理和で上がる。進捗率は分子分母を持って上がる。ログは全文ではなく要約として上がる。局所メモや編集中状態は上位へ上げない。この違いを最初に固定しないと、Resource の aggregate logic が曖昧になり、さらに view logic も混線して、script 化できず、LLM に依存する不安定な設計になる。"},{"pattern":"Resource は、配分、消費、残量、件数、制約量など、木構造上で管理対象となる量または量的状態を指す。State は、その時点の状態を表すが、保存則や配分則を持たないものを指す。Constraint は、締切や上限のように他の量を拘束する条件を指す。Capability は、API token やアクセス権のように、資源そのものではなく資源アクセスの資格を指す。View は、Resource や構造状態を UI 上でどう射影するかの規則を指す。","replacement":"Resource は、配分、消費、残量、件数、制約量など、木構造上で管理対象となる量または量的状態を指す。State は、その時点の状態を表すが、保存則や配分則を持たないものを指す。Constraint は、締切や上限のように他の量を拘束する条件を指す。Capability は、API token やアクセス権のように、資源そのものではなく資源アクセスの資格を指す。aggregate logic は、ある Resource が子から親へどう集約されるかを定める規則を指す。view logic は、ある Resource や構造状態が UI 上でどう射影されるかを定める規則を指す。"},{"pattern":"## 10\\. View 集約ロジック","replacement":"## 10. view logic"},{"pattern":"View についても、見た目の種類ではなく、木構造上の射影規則で分類する。","replacement":"view logic についても、見た目の種類ではなく、木構造上の射影規則で分類する。"},{"pattern":"## 12\\. Resource と View の対応関係","replacement":"## 12. Resource と view logic の対応関係"},{"pattern":"Resource は正本として管理される。View はその正本や構造状態を UI 上へ射影する規則である。両者は対応するが同一ではない。たとえば COUNT の未処理件数は BADGE_COUNT の表示へ射影される。RATIO の進捗率は RATIO_VIEW のバーへ射影される。BOOL_OR の障害有無は VISIBLE_ANY や SEVERITY_MAX の警告表示へ射影される。SUMMARY の探索ログは SUMMARY_VIEW のプレビューへ射影される。NONE の局所状態は LOCAL_ONLY として保持される。","replacement":"Resource は正本として管理される。view logic はその正本や構造状態を UI 上へ射影する規則である。両者は対応するが同一ではない。たとえば COUNT の未処理件数は BADGE_COUNT の表示へ射影される。RATIO の進捗率は RATIO_VIEW のバーへ射影される。BOOL_OR の障害有無は VISIBLE_ANY や SEVERITY_MAX の警告表示へ射影される。SUMMARY の探索ログは SUMMARY_VIEW のプレビューへ射影される。NONE の局所状態は LOCAL_ONLY として保持される。"},{"pattern":"ここで重要なのは、View を正本管理の中へ混ぜないことである。進捗率そのものと進捗バーの見た目を分ける。未処理件数そのものとバッジ表示を分ける。選択状態は ViewState に置き、Model の正本へ混ぜない。","replacement":"ここで重要なのは、view logic を正本管理の中へ混ぜないことである。進捗率そのものと進捗バーの見た目を分ける。未処理件数そのものとバッジ表示を分ける。選択状態は ViewState に置き、Model の正本へ混ぜない。"},{"pattern":"Resource と View を設計しても、どこに正本を置くかが曖昧だと運用で崩れる。","replacement":"Resource を設計しても、どこに正本を置くかが曖昧だと運用で崩れる。aggregate logic と view logic はその上に乗るため、まず正本配置の原則を定める必要がある。"},{"pattern":"View については、各表示プロパティに `projection_kind` を持たせる。","replacement":"view logic については、各表示プロパティに `projection_kind` を持たせる。"},{"pattern":"以上の保留はあるが、少なくとも現段階では、項目を意味で散発的に追加するのではなく、集約ロジックで箱を先に作り、その上に Resource と View を乗せる方針が有効である。","replacement":"以上の保留はあるが、少なくとも現段階では、項目を意味で散発的に追加するのではなく、Resource を中心に集約ロジックの箱を先に作り、その上に aggregate logic と view logic を整理する方針が有効である。"}]}
```

> [!abstract]- Tool (canmore.update_textdoc)
> <sub>2026-04-17 15:53</sub>
> 
> Failed with error, do not try again. Tell the user about what you attempted to do, then notify them that it failed.
> 
> updates.7.pattern: pattern not found in the document: /Resource は正本として管理される。View はその正本や構造状態を UI 上へ射影する規則である。両者は対応するが同一ではない。たとえば COUNT の未処理件数は BADGE_COUNT の表示へ射影される。RATIO の進捗率は RATIO_VIEW のバーへ射影される。BOOL_OR の障害有無は VISIBLE_ANY や SEVERITY_MAX の警告表示へ射影される。SUMMARY の探索ログは SUMMARY_VIEW のプレビューへ射影される。NONE の局所状態は LOCAL_ONLY として保持される。/ pattern must be a python regular expression with valid escape sequences

**ChatGPT**: <sub>2026-04-17 15:53</sub>

自動置換を試したが、文面が少し変わっていて一部の一致に失敗した。意図した修正内容は固まっているので、そのまま差し替え文を出す。

まず 1 章の冒頭はこう直すのがよい。  
「本書は、M3E における Resource という概念を、木構造上の親子伝播と集約ロジックの観点から整理するための設計文書である。対象は、予算や API 利用量のような配分可能な量だけでなく、件数、状態、制約、要約情報、局所状態まで含む。さらに Resource には、その正本管理とは別に、上位へどう集約されるかを定める aggregate logic と、UI 上でどう射影されるかを定める view logic が存在する。」

続く目的文はこう。  
「本書の狙いは三つある。第一に、項目を意味だけで列挙して管理不能になることを防ぐこと。第二に、LLM による曖昧な運用ではなく、script で deterministic に扱える形へ落とすこと。第三に、Resource の正本管理、aggregate logic、view logic を分離しつつ、それらを同じ木構造上で一貫して扱えるようにすることである。」

3章の定義はこう直すとよい。  
「Resource は、配分、消費、残量、件数、制約量など、木構造上で管理対象となる量または量的状態を指す。State は、その時点の状態を表すが、保存則や配分則を持たないものを指す。Constraint は、締切や上限のように他の量を拘束する条件を指す。Capability は、API token やアクセス権のように、資源そのものではなく資源アクセスの資格を指す。aggregate logic は、ある Resource が子から親へどう集約されるかを定める規則を指す。view logic は、ある Resource や構造状態が UI 上でどう射影されるかを定める規則を指す。」

10章の見出しは `View 集約ロジック` ではなく `view logic` にするのがよい。冒頭文は  
「view logic についても、見た目の種類ではなく、木構造上の射影規則で分類する。」  
に変える。

12章の見出しは  
`Resource と view logic の対応関係`  
に変更。本文冒頭はこう。  
「Resource は正本として管理される。view logic はその正本や構造状態を UI 上へ射影する規則である。両者は対応するが同一ではない。たとえば COUNT の未処理件数は BADGE_COUNT の表示へ射影される。RATIO の進捗率は RATIO_VIEW のバーへ射影される。BOOL_OR の障害有無は VISIBLE_ANY や SEVERITY_MAX の警告表示へ射影される。SUMMARY の探索ログは SUMMARY_VIEW のプレビューへ射影される。NONE の局所状態は LOCAL_ONLY として保持される。」

その次の段落は  
「ここで重要なのは、view logic を正本管理の中へ混ぜないことである。進捗率そのものと進捗バーの見た目を分ける。未処理件数そのものとバッジ表示を分ける。選択状態は ViewState に置き、Model の正本へ混ぜない。」  
にする。

13章の冒頭は  
「Resource を設計しても、どこに正本を置くかが曖昧だと運用で崩れる。aggregate logic と view logic はその上に乗るため、まず正本配置の原則を定める必要がある。」  
に直す。

14章の実装指針では  
「view logic については、各表示プロパティに `projection_kind` を持たせる。」  
に変える。

最後の結語は  
「以上の保留はあるが、少なくとも現段階では、項目を意味で散発的に追加するのではなく、Resource を中心に集約ロジックの箱を先に作り、その上に aggregate logic と view logic を整理する方針が有効である。」  
に直すのがよい。

**User**: <sub>2026-04-17 15:54</sub>

もう一度試して

**ChatGPT**: <sub>2026-04-17 15:54</sub>

```
{"updates":[{"pattern":"本書は、M3E における Resource と View を、木構造上の親子伝播と集約ロジックの観点から統一的に整理するための設計文書である。対象は、予算や API 利用量のような配分可能な量だけでなく、件数、状態、制約、要約情報、局所状態、表示状態まで含む。","multiple":false,"replacement":"本書は、M3E における Resource という概念を、木構造上の親子伝播と集約ロジックの観点から整理するための設計文書である。対象は、予算や API 利用量のような配分可能な量だけでなく、件数、状態、制約、要約情報、局所状態まで含む。さらに Resource には、その正本管理とは別に、上位へどう集約されるかを定める aggregate logic と、UI 上でどう射影されるかを定める view logic が存在する。"},{"pattern":"本書の狙いは三つある。第一に、項目を意味だけで列挙して管理不能になることを防ぐこと。第二に、LLM による曖昧な運用ではなく、script で deterministic に扱える形へ落とすこと。第三に、Resource の正本管理と View の射影規則を分離しつつ、両者を同じ木構造上で扱えるようにすることである。","multiple":false,"replacement":"本書の狙いは三つある。第一に、項目を意味だけで列挙して管理不能になることを防ぐこと。第二に、LLM による曖昧な運用ではなく、script で deterministic に扱える形へ落とすこと。第三に、Resource の正本管理、aggregate logic、view logic を分離しつつ、それらを同じ木構造上で一貫して扱えるようにすることである。"},{"pattern":"この方針を採る理由は明確である。予算、件数、進捗率、障害有無、ログ要約は、すべて子から親へ何らかの形で上がるが、上がり方は異なる。予算は総和で上がる。障害有無は論理和で上がる。進捗率は分子分母を持って上がる。ログは全文ではなく要約として上がる。局所メモや編集中状態は上位へ上げない。この違いを最初に固定しないと、Resource と View が同じ箱に入り、script 化できず、LLM に依存する不安定な設計になる。","multiple":false,"replacement":"この方針を採る理由は明確である。予算、件数、進捗率、障害有無、ログ要約は、すべて子から親へ何らかの形で上がるが、上がり方は異なる。予算は総和で上がる。障害有無は論理和で上がる。進捗率は分子分母を持って上がる。ログは全文ではなく要約として上がる。局所メモや編集中状態は上位へ上げない。この違いを最初に固定しないと、Resource の aggregate logic が曖昧になり、さらに view logic も混線して、script 化できず、LLM に依存する不安定な設計になる。"},{"pattern":"Resource は、配分、消費、残量、件数、制約量など、木構造上で管理対象となる量または量的状態を指す。State は、その時点の状態を表すが、保存則や配分則を持たないものを指す。Constraint は、締切や上限のように他の量を拘束する条件を指す。Capability は、API token やアクセス権のように、資源そのものではなく資源アクセスの資格を指す。View は、Resource や構造状態を UI 上でどう射影するかの規則を指す。","multiple":false,"replacement":"Resource は、配分、消費、残量、件数、制約量など、木構造上で管理対象となる量または量的状態を指す。State は、その時点の状態を表すが、保存則や配分則を持たないものを指す。Constraint は、締切や上限のように他の量を拘束する条件を指す。Capability は、API token やアクセス権のように、資源そのものではなく資源アクセスの資格を指す。aggregate logic は、ある Resource が子から親へどう集約されるかを定める規則を指す。view logic は、ある Resource や構造状態が UI 上でどう射影されるかを定める規則を指す。"},{"pattern":"## 10\\. View 集約ロジック","multiple":false,"replacement":"## 10. view logic"},{"pattern":"View についても、見た目の種類ではなく、木構造上の射影規則で分類する。","multiple":false,"replacement":"view logic についても、見た目の種類ではなく、木構造上の射影規則で分類する。"},{"pattern":"## 12\\. Resource と View の対応関係","multiple":false,"replacement":"## 12. Resource と view logic の対応関係"},{"pattern":"Resource は正本として管理される。View はその正本や構造状態を UI 上へ射影する規則である。","multiple":false,"replacement":"Resource は正本として管理される。view logic はその正本や構造状態を UI 上へ射影する規則である。"},{"pattern":"ここで重要なのは、View を正本管理の中へ混ぜないことである。","multiple":false,"replacement":"ここで重要なのは、view logic を正本管理の中へ混ぜないことである。"},{"pattern":"Resource と View を設計しても、どこに正本を置くかが曖昧だと運用で崩れる。","multiple":false,"replacement":"Resource を設計しても、どこに正本を置くかが曖昧だと運用で崩れる。aggregate logic と view logic はその上に乗るため、まず正本配置の原則を定める必要がある。"},{"pattern":"View については、各表示プロパティに `projection_kind` を持たせる。","multiple":false,"replacement":"view logic については、各表示プロパティに `projection_kind` を持たせる。"},{"pattern":"以上の保留はあるが、少なくとも現段階では、項目を意味で散発的に追加するのではなく、集約ロジックで箱を先に作り、その上に Resource と View を乗せる方針が有効である。","multiple":false,"replacement":"以上の保留はあるが、少なくとも現段階では、項目を意味で散発的に追加するのではなく、Resource を中心に集約ロジックの箱を先に作り、その上に aggregate logic と view logic を整理する方針が有効である。"}]}
```

> [!abstract]- Tool (canmore.update_textdoc)
> <sub>2026-04-17 15:55</sub>
> 
> Successfully updated text document with textdoc_id '69e1c86b9ecc819180347778ac05cfe4'

**ChatGPT**: <sub>2026-04-17 15:55</sub>

修正を反映した。

**User**: <sub>2026-04-17 15:56</sub>

任意コード実装できる基盤があればいいよね。単発でリソースを集計したいときにロジックを走らせるときとか。出来る限りシンプルな作りで、いくつかの模範例と、汎用性もあるような？

> [!info] Reasoning Summary
> <sub>2026-04-17 15:56</sub>
> 
> 思考時間: 数秒

**ChatGPT**: <sub>2026-04-17 15:56</sub>

そう。かなり重要だと思う。  
要するに、Resource を固定ロジックだけで回すのでなく、**必要時に単発で走らせる任意コードの実行基盤**を持つと運用が一段強くなる。

ただし、ここは複雑にすると失敗する。なので方針は、**小さく、制約つきで、模範例を多めに置く**のがよい。

整理すると、欲しいのは大きなスクリプト言語ではなく、次のような最小基盤。

1. 入力対象を固定する  
`current scope` `selected subtree` `current registry` `all child registries` など、触れる範囲を明示する。

2. 読み取りと集計を主目的にする  
最初は read-only を基本にする。  
いきなり任意書き換えを許すと危ない。  
まずは「集計」「検査」「一覧化」「警告生成」に限定する。

3. 出力型を絞る  
返り値は  
・数値  
・表  
・要約文字列  
・警告リスト  
くらいでよい。  
これで大抵足りる。

4. 模範例を最初から付ける  
ユーザーは DSL を覚えたいのではなく、  
「予算残を見たい」  
「配分超過を検出したい」  
「未処理件数を集計したい」  
だけなので、例から入れるほうがよい。

5. 実行範囲を閉じる  
filesystem 全体や外部通信には触れない。  
registry と tree API だけ触れる。  
これで安全性と理解しやすさが両立する。

設計としては、たとえばこういう最小 API が自然。

`nodes()`  
`children(node)`  
`descendants(node)`  
`resource(node, key)`  
`sum(...)`  
`count(...)`  
`max(...)`  
`filter(...)`  
`groupBy(...)`  
`warn(...)`

これだけでもかなり戦える。

模範例もかなり単純でよい。  
「この subtree の API コスト合計」  
「配分 > 容量 のノード一覧」  
「未処理 issue が 10 件超の PJ を列挙」  
「RATIO を分子分母から計算して表にする」  
「SUMMARY 系を除いて count 系だけ一覧化」  
このくらいがあると十分実用的。

さらに、汎用性を保つなら二層に分けるのがよい。  
第一層は built-in query。ボタン感覚で使う定型集計。  
第二層は small script。少しだけ自由に書ける。  
これなら普段は定型で済み、必要な時だけ任意コードへ降りられる。

たぶん一番よい形は、  
**Resource registry 専用の小さな query runtime**  
として作ること。  
一般-purpose の任意コード実行基盤にすると重すぎる。  
tree と resource しか触れない、小さな sandbox のほうがよい。

なので結論は、  
任意コード基盤は欲しい。  
ただし「何でもできる実行環境」ではなく、  
**read-heavy な resource query / validation runtime**  
として最小構成で持つのがよい。  
そして模範例を最初から充実させるのが重要。

**User**: <sub>2026-04-17 15:58</sub>

雑費を除いて金額計算したい、とか、そういうロジックが走るはずなんよな。その土台のインターフェースを要望として文書に組み込んでおくか。ただし、危険なコード実行ができないような工夫も必要よね？

**ChatGPT**: <sub>2026-04-17 15:58</sub>

インターフェース要件として追加します。用途例と、安全のための制約も入れます。

> [!info] Reasoning Summary
> <sub>2026-04-17 15:58</sub>
> 
> 思考時間: 4s

**ChatGPT**: <sub>2026-04-17 15:58</sub>

```
{"updates":[{"pattern":"## 14\\. 実装指針","replacement":"## 14. 集計クエリ実行基盤の要件\n実運用では、固定の aggregate logic だけでは足りず、単発の集計や条件付き計算を行いたい場面がある。たとえば「雑費を除いて金額計算したい」「特定タグを持つ PJ だけ集計したい」「配分超過だけを一覧したい」といった要求である。このため、Resource registry の上で限定的な任意ロジックを走らせる基盤を用意する価値が高い。\n\nただし、ここで必要なのは汎用の危険なコード実行環境ではない。必要なのは、tree と registry に対する読み取り、集計、検査、一覧化を安全に行うための小さな query runtime である。したがって本設計では、次の制約を持つ基盤を要望として置く。\n\n第一に、既定は read-only とする。単発クエリは正本を書き換えず、数値、表、警告一覧、要約文字列だけを返す。書き込みは別系統の明示操作に分離する。第二に、アクセス範囲を限定する。参照対象は `current scope` `selected subtree` `current registry` `child registries` など、M3E が明示的に渡したデータに限る。ファイルシステム全体、任意のネットワーク、OS コマンド、秘密情報には触れさせない。第三に、返り値の型を絞る。返せるのは数値、表、警告リスト、要約文字列程度に限定する。第四に、実行時間、メモリ、走査ノード数に上限を設ける。第五に、監査可能にする。どのクエリをどの scope に対して走らせたかを履歴として残せるようにする。\n\nこの基盤の目的は、DSL を大きく育てることではなく、Resource 運用を補助することである。したがって最初から模範例を多く用意する方が重要である。典型例は、「この subtree の API コスト合計」「雑費を除いた支出合計」「配分 > 容量 のノード一覧」「未処理件数が 10 件超の PJ を列挙」「RATIO を分子分母から計算して表にする」「SUMMARY 系を除いた COUNT 系の一覧」などである。\n\nインターフェースは出来る限り単純でよい。たとえば `nodes()` `children(node)` `descendants(node)` `resource(node, key)` `sum(xs)` `count(xs)` `max(xs)` `filter(xs, pred)` `groupBy(xs, key)` `warn(msg)` 程度の小さな API でも、かなり多くの用途をカバーできる。ここで重要なのは、一般-purpose のコード実行基盤にしないことである。tree と resource に閉じた query runtime として保つ方が、安全性と理解しやすさの両方を満たしやすい。\n\n安全性の観点では、特に次の禁止が必要である。外部ネットワークアクセス禁止、任意ファイル読み書き禁止、任意プロセス実行禁止、秘密情報参照禁止、無制限ループ禁止である。さらに、クエリ実行系は fail-closed とし、不正なクエリや制限超過時は中断して何も変更しないことを原則とする。\n\n要するに、本設計で要望すべきなのは「任意コード実行」そのものではなく、「安全に制限された Resource query / validation runtime」である。これにより、固定 aggregate logic だけでは表現しきれない単発の現場要求を吸収しつつ、正本やシステム全体の安全性を損なわずに済む。\n\n## 15. 実装指針"},{"pattern":"## 15\\. 実装用一覧表","replacement":"## 16. 実装用一覧表"},{"pattern":"## 16\\. 例","replacement":"## 17. 例"},{"pattern":"## 17\\. 保留事項","replacement":"## 18. 保留事項"}]}
```

> [!abstract]- Tool (canmore.update_textdoc)
> <sub>2026-04-17 15:59</sub>
> 
> Successfully updated text document with textdoc_id '69e1c86b9ecc819180347778ac05cfe4'

**ChatGPT**: <sub>2026-04-17 15:59</sub>

追加した。内容は、単発集計のための小さな query runtime を要望として入れ、雑費除外のような現場ロジックの例、安全のために read-only・対象範囲限定・返り値型限定・外部ネットワーク禁止・任意ファイル禁止・任意プロセス禁止・fail-closed を明記した。章番号も繰り下げて整えた。

**User**: <sub>2026-04-17 15:59</sub>

これ実装的にはGraphDBとかのほうが良かった？

> [!info] Reasoning Summary
> <sub>2026-04-17 15:59</sub>
> 
> 思考時間: 数秒

**ChatGPT**: <sub>2026-04-17 15:59</sub>

たぶん、**今の段階では GraphDB でなくてよかった**。少なくとも Resource 集約の中核には向いていない。

理由は単純で、今整理している対象の中心は  
親子  
集約  
伝播  
配分整合  
要約  
だから。  
これは本質的に **tree + registry + query** の問題であって、一般グラフの到達性や複雑な多対多探索の問題ではない。

GraphDB が強いのは、  
複雑な関係探索  
多段リンク追跡  
柔軟なパターンマッチ  
横断関係の発見  
のほう。  
たとえば「このノードと意味的に近いが別 scope にあるものを辿る」「依存関係を横断して影響範囲をたどる」みたいな用途ではかなり強い。

でも Resource 集約で重要なのは、  
どの親に属するか  
どの subtree で閉じるか  
子の合計が親容量を超えていないか  
どこまでを local registry とみなすか  
なので、ここは GraphDB の強みより、**境界が明確な木構造**のほうが扱いやすい。

特にまずいのは、GraphDB を正本にすると「横断できすぎる」こと。  
今の設計は scope と repository 粒度で境界を作るのが重要だった。  
GraphDB は関係を掘るのは得意だが、逆に「見せすぎない」「親子だけで閉じる」を守るには設計努力が増える。

なので整理するとこう。

**GraphDB が向かない部分**  
Resource 正本  
配分整合  
親子集約  
scope 閉包  
repository 単位の local registry  

**GraphDB が向く部分**  
alias 横断参照  
依存関係探索  
アンチパターン照合  
関連論点探索  
跨 scope の影響分析  
将来的な recommendation や search

つまり、正本は tree/registry 側、補助インデックスや探索系だけ Graph 的、が自然。

実装観点でも、最初から GraphDB を入れると重い。  
スキーマ、クエリ言語、運用、同期、境界制御が全部増える。  
今の文書で要請している query runtime 程度なら、JSON/SQLite/軽い registry で十分回る。

なので結論は、  
**基盤正本としては GraphDB でなくてよい。むしろ今は避けたほうがよい。**  
ただし将来、  
横断探索  
関係線  
影響分析  
アンチパターン照合  
が強くなったら、**副次インデックス層として GraphDB 的なもの**を入れる価値はある。

一言で言うと、  
**正本は tree、探索は graph**  
が今の M3E には合っている。

**User**: <sub>2026-04-17 16:01</sub>

Resourceのデータと設計をどうbindするかね？
たとえばresourceで予算が決定されて、仕様では予算額で計算を実行する、という感じなら、マップでどうbindするか？

> [!info] Reasoning Summary
> <sub>2026-04-17 16:01</sub>
> 
> 思考時間: 5s

**ChatGPT**: <sub>2026-04-17 16:01</sub>

bind は、Resource を map の説明文に埋め込むのでなく、**設計ノードが Resource slot を参照する**形が自然。  
つまり、`値を直接書く` のではなく、`どの資源を使うかを宣言する`。

整理すると、少なくとも3層に分けたほうがよい。  
1つ目は Resource 正本。予算額や API 枠の実値を registry に持つ。  
2つ目は Design / Spec。仕様ノードや計算ノードが「この値を使う」と宣言する。  
3つ目は Binding。Spec 側の slot と Resource 側の key を結ぶ。

たとえば、  
予算が `budget.total = 120000` と registry にある。  
仕様側で  
`計算A: 実行コスト = budget.total * 0.2`  
のようにしたいなら、map 上では  
`計算A`  
　`input slot: project_budget`  
　`formula: project_budget * 0.2`  
と持つ。  
そして binding として  
`project_budget -> registry:/pj-X/budget.total`  
を置く。  
こうすると、仕様は具体値から独立し、値だけ差し替えられる。

重要なのは、bind を node text に書かないこと。  
`予算120000円で計算する` と書くと、正本が二重化する。  
代わりに、仕様ノードには  
`slot 名`  
`required type`  
`unit`  
`binding target`  
を持たせる。

かなり単純化すると、仕様側に必要なのはこれだけでよい。  
`slot_id`  
`kind`  
`unit`  
`source_ref`

例としては、  
`slot_id = project_budget`  
`kind = ALLOCATED_SUM`  
`unit = JPY`  
`source_ref = registry:/repo-A/resources/budget.total`  

map 上の見え方は、  
`計算A`  
　`uses: project_budget`  
くらいでよい。  
詳細は inspector や property で見せる。

bind のパターンも分けたほうがよい。  
`value binding` は単一値参照。  
`query binding` はクエリ結果参照。たとえば「雑費を除いた支出合計」。  
`derived binding` は他 slot から計算される派生値。  
実務上はこの3つでかなり足りる。

たとえばユーザーの例なら、  
仕様: `実行可能額 = net_budget`  
binding: `net_budget -> query(sum(expense where category != misc))`  
という形になる。  
つまり、bind 先は単なる key でもよいし、query runtime の名前付き結果でもよい。

なので、map での自然な表現は  
**設計ノードの下に input slot ノードを持ち、その slot が Resource registry または query result を参照する**  
だと思う。  
これなら  
Resource は正本  
Spec は構造  
Binding は接着  
と分離できる。

一番避けたいのは、  
仕様ノードに実値を埋め込むこと  
仕様ノードに resource path を生文字列で乱雑に書くこと  
query を本文にベタ書きすること  
の3つ。

設計としては、bind を first-class にして、たとえば  
`BindingEdge`  
または  
`SlotNode -> ResourceRef`  
という専用構造を持つのがよい。  
M3E 的には edge に意味を持たせる設計とも相性がよい。  
親子は設計構造、binding は補助 relation として持てる。

結論としては、  
**Spec node が Resource を直接持つのでなく、Spec node が slot を持ち、slot が Resource / Query を参照する**  
これが一番きれい。

**User**: <sub>2026-04-17 16:03</sub>

具象軸のアイデアを用いると、仕様設計の奥に実装のマップが配置される。それはruntimeのコードと対応しており、参照スロットが設計と対応してただしく記入される形になってそうだな

> [!info] Reasoning Summary
> <sub>2026-04-17 16:04</sub>
> 
> 思考時間: 5s

**ChatGPT**: <sub>2026-04-17 16:04</sub>

そう。かなり自然だと思う。

具象軸を使うと、上位の仕様設計ノードの奥に、より具体な実装ノード群が並ぶ。すると binding は、抽象仕様から直接 Resource を引くのでなく、**実装側の runtime slot を経由して接続される**形になる。

つまり構造はこうなる。  
仕様設計ノードが必要な slot を宣言する。  
その下位の実装マップで、その slot が runtime 上の入力点として具体化される。  
さらにその slot が Resource registry や query result に bind される。  

この形の利点は大きい。  
仕様は「何が必要か」を書く。  
実装は「どこで受けるか」を書く。  
Resource は「実値をどこから取るか」を持つ。  
三者が分離されるので、仕様変更、実装変更、資源変更が互いに独立しやすい。

たとえば、  
仕様: 実行可能額を用いて計算する  
実装: `runtime.slot.net_budget` を受ける  
binding: `runtime.slot.net_budget -> query(sum(expense where category != misc))`  
という形にできる。  

このとき map 上では、仕様ノードの奥に  
`input slot: net_budget`  
`type: money`  
`source: query/net_budget`  
のような実装ノードが置かれるはず。  
つまり binding は仕様に直接貼られるより、**実装ノードの slot に貼られる**ほうが整う。

さらに言うと、これは compile 的に見られる。  
仕様ノードは interface 宣言。  
実装マップは adapter。  
binding は wiring。  
runtime code は executor。  

かなりきれいに分かれる。  
そして M3E の木構造とも相性がよい。上に行くほど抽象、下に行くほど具象、という軸がそのまま binding の配置原理になる。  
なので、その見立てで良いと思う。

