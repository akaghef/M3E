---
title: "Entity Party Org 関係"
created: 2026-04-11 14:13:01
updated: 2026-04-11 15:12:51
tags:
  - chatgpt
  - conversation
---
# Entity Party Org 関係

<sub>2026-04-11</sub>

---

**User**: <sub>2026-04-11 14:12</sub>

組織とか、個人のくくりをM3Eでどう扱えばいいか分からんな。
しかも個人も複数のAgentがいる。流動的な組織構造を扱うには？
entity<party<org という階層を考えている。

> [!abstract]- Tool (file_search)
> <sub>2026-04-11 14:13</sub>
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
> <sub>2026-04-11 14:13</sub>
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
> <sub>2026-04-11 14:13</sub>
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
> <sub>2026-04-11 14:13</sub>
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
> <sub>2026-04-11 14:13</sub>
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
> <sub>2026-04-11 14:13</sub>
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
> <sub>2026-04-11 14:13</sub>
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
> <sub>2026-04-11 14:13</sub>
> 
> 思考時間: 10s

**ChatGPT**: <sub>2026-04-11 14:13</sub>

その階層だけでは足りない。  
`entity < party < org` を主軸にしてもよいが、**所属**と**実行主体**と**時間変化**を別軸に分けないと、流動的な組織は表現しにくい。

まず、M3Eの既存方針では、実体は一意に持ち、関係は別で表すのが自然である。主構造は親子だが、意味関係は別に持てるので、組織構造も「実体」と「関係」を分離した方がよい。fileciteturn0file2

整理すると、核は次の5つでよい。

**1. entity**  
存在するもの全般。  
人、組織、部署、チーム、AI agent、文書、プロジェクト、役職など全部ここに入れる。

**2. party**  
責任・権限・意思決定の単位。  
個人も party になれるし、会社や研究室も party になれる。  
重要なのは、**party は法的主体や責任主体に近い**ということ。

**3. org**  
party のうち、**内部構造を持つ集合的主体**。  
会社、研究室、サークル、プロジェクトチーム、臨時委員会など。  
つまり `org ⊂ party` にした方が扱いやすい。  
`party < org` ではなく、**org は party の特殊型**とみなす方が自然だ。

**4. agent**  
実行単位。  
人間の補助人格、bot、LLM worker、ある役割専用の自動処理など。  
これは entity ではあるが、party と同一視しない方がよい。  
agent は通常、**どこかの party に従属して動く実行者**として扱う。

**5. membership / delegation / role**  
所属や委任は、階層ではなく関係で持つ。  
ここが流動性を支える。

したがって、概念上はこうした方がよい。

- `entity` : 全実体の基底
- `party` : entity のうち責任主体
- `org` : party のうち内部構造を持つ集合主体
- `agent` : entity のうち実行主体
- `role`, `membership`, `delegation` : entity 同士を結ぶ時間付き関係

これなら、個人に複数 agent がいる状況も素直に書ける。

たとえば、  
ある人 `P` がいる。  
その人の下に `research-agent`, `coding-agent`, `daily-agent` がいる。  
このとき `P` 自体は party であり、必要なら「個人org」の root としても扱える。  
その下に agent をぶら下げればよい。  
つまり**個人も最小の組織として見なせる**。

組織が流動的であるなら、固定階層よりも次の関係を持つべきだ。

- `member_of`
- `has_role`
- `delegates_to`
- `reports_to`
- `acts_for`
- `belongs_to_scope`
- `valid_from / valid_to`

特に重要なのは**時間区間**で、  
「誰がどの組織に属していたか」  
「どの agent がいつ有効だったか」  
を関係側に持たせる。  
これをしないと、異動、兼務、臨時チーム、解散済み組織が全部壊れる。

M3E の scope 設計とも相性がよい。  
scope は認知境界であり、実体は一意、別の文脈からは alias で参照する方針なので、組織図も「正本は一箇所、他所では alias 参照」にできる。fileciteturn0file2  
また、実体の所属を親子だけに埋め込まず、意味関係を別に持つ方向も既に整合している。fileciteturn0file2

実装上は、親子ツリーをこう使うとよい。

- ツリーは**管理上の正本配置**に使う
- 組織の流動性は**relation と時刻**で表す
- alias は他スコープからの窓に使う
- agent は person/org の子に置いてよいが、実際の稼働先は relation で持つ

つまり、見た目の木はこうなる。

- World
  - Person A
    - personal agents
  - Org X
    - Team Y
    - Team Z
  - Project P
  - Role definitions

ただし本当の所属は、木だけで決めない。  
`Person A --member_of--> Team Y (2026-04-01 to 2026-09-30)`  
`Agent a1 --acts_for--> Person A`  
`Person A --delegates_to--> Agent a1`  
`Team Y --part_of--> Org X`  
のように関係で持つ。

結論としては、次で固定するとよい。

**推奨案**
- `entity` を最上位にする
- `party` は責任主体
- `org` は `party` の特殊型
- `agent` は別系統の実行主体
- 所属・兼務・委任・上下関係は、階層でなく relation で持つ
- relation には必ず時間属性を付ける

したがって、  
`entity < party < org`  
よりも、

**`entity` を基底にして、`party` と `agent` を分け、`org` は `party` の一種にする**

方が、流動的組織と複数 agent を無理なく扱える。

**User**: <sub>2026-04-11 14:14</sub>

orgはgithub organizationとかのつもりだった。
partyは主体の集まり（チーム）, organizationは組織

**ChatGPT**: <sub>2026-04-11 14:14</sub>

その定義でも成立するが、整理しないと混線する。

問題は「集まり」と「制度的な枠」と「実行単位」が混ざる点。

まず、あなたの意図をそのまま整形するとこうなる。

- **entity**：全ての実体  
- **party**：主体の集まり（チーム）  
- **org**：制度的な組織（GitHub Organization など）

これは一見よいが、次の衝突が起きる。

- チーム（party）も内部構造を持つ  
- org の中にもチームがある  
- 個人もチーム的に振る舞う  
- agent がどこに属するか曖昧になる  

そのため、「party」と「org」を階層にすると歪む。

---

### 再整理（崩さずに整える）

あなたの意味を保つなら、こう分けるのが安定する。

**1. entity（基底）**  
全て

**2. org（制度・コンテナ）**  
GitHub Organization、会社、研究室など  
→ 「境界」と「所有」を持つ

**3. party（行為主体の集合）**  
チーム、プロジェクト単位、委員会  
→ 「意思決定・協働単位」

**4. agent（実行単位）**  
人間の役割、bot、LLMなど

---

### 重要な修正点

**org と party は上下関係にしない**

理由：
- GitHub org の中に複数 team（party）がある  
- 1つの party が複数 org に跨る場合もある  
- 一時チームは org に属さないこともある  

したがって、

- `org ⊄ party`
- `party ⊄ org`

**完全に別軸にする**

---

### 関係で表す

階層ではなく、関係として持つ。

- `party --within--> org`
- `entity --member_of--> party`
- `agent --acts_for--> entity`
- `agent --assigned_to--> party`

これで次が表現できる。

- GitHub org の中の team  
- 複数 org 横断チーム  
- 個人だけの party（=個人プロジェクト）  
- agent の多重所属  

---

### 個人 + 複数 agent の扱い

個人はこうする。

- 個人 = entity かつ party（1人チーム）
- agent はその個人に紐づく

例：

- Person A（entity / party）
  - coding-agent
  - research-agent

ただし実際の作業は

- agent → party に割り当て

で表す。

---

### M3Eとの整合

- ツリー：配置・認知整理用  
- 実際の所属：relation  
- スコープ：org 単位で切ると自然  
- party：org内に見せるか、横断させるかはビュー次第  

M3Eは「実体一意・alias参照」なので、  
orgごとに同じ人を複製せず、aliasで参照すればよい。fileciteturn0file2

---

### 結論

あなたの定義は使えるが、階層はこう変える。

- `entity`（基底）
- `org`（制度的コンテナ）
- `party`（行為単位）
- `agent`（実行単位）

そして

- **org と party は階層にしない**
- **所属は relation で持つ**

これで流動的構造は破綻しない。

**User**: <sub>2026-04-11 14:16</sub>

やっぱgitが正解のモデルかー
repoが共同単位、organizationが全体
AI agentはどういう扱い？あとユーザーも複数の役割を持っている可能性がある


**ChatGPT**: <sub>2026-04-11 14:16</sub>

Gitのモデルは近いが、そのままでは足りない。  
Gitは「権限」と「所有」の整理には強いが、「役割」と「実行主体」と「時間変化」が弱い。

その前提で拡張すると、次で安定する。

---

## 基本対応（Gitに寄せる）

- **organization** → org（制度的コンテナ）
- **repository** → party（共同作業単位）
- **user** → entity（人）
- **team（GitHub）** → partyの一種として扱える

つまり

- org：全体の境界
- party：実際に動く単位
- entity：個人

---

## 足りない要素

Gitに無いのはこの2つ。

- **agent（実行主体）**
- **role（役割）**

これを追加しないと、M3Eでは破綻する。

---

## AI agent の扱い

agentは「ユーザーの拡張」ではなく、**独立した実行主体**として扱う。

位置づけ：

- entity の一種（実体として存在）
- party には属さない（直接は）
- 常に誰か／何かの代理として動く

関係で表す：

- `agent --acts_for--> entity`
- `agent --assigned_to--> party`
- `agent --uses_scope--> org`

これで次が可能になる。

- 個人専用agent
- チーム共有agent
- org全体の自動処理agent

---

## ユーザーの複数役割

これは entity を分裂させない。

代わりに **role を独立させる**。

- entity（人）は一意
- role は複数持てる
- partyごとに role が違う

関係：

- `entity --has_role--> role`
- `role --in--> party`

例：

- Aさん
  - repo1：maintainer
  - repo2：reviewer
  - repo3：observer

---

## まとめ構造

最小セットはこれでよい。

- **entity**：人・AIなどの実体
- **org**：境界（GitHub organization）
- **party**：作業単位（repo / team / project）
- **agent**：実行主体（AI・自動処理）
- **role**：役割（権限・機能）

---

## 重要な関係

- entity → party（member_of）
- entity → role（has_role）
- role → party（in）
- party → org（within）
- agent → entity（acts_for）
- agent → party（assigned_to）

---

## 設計上のポイント

1. **entityは絶対に分裂させない**
   - ユーザーを複数ノードにしない

2. **roleで文脈を分離する**
   - 所属と権限はroleに逃がす

3. **agentは必ず誰かに紐づく**
   - 完全に独立させない（責任の所在が消える）

4. **partyはGitのrepoに近いが、より抽象**
   - issue単位、短期チームも含められる

---

## Gitとの差分（本質）

Git：
- org / repo / user / permission

拡張モデル：
- org / party / entity / role / agent / time

特に重要なのは

- roleの分離
- agentの導入
- relation + time

---

## 結論

Gitは「骨格」としては正しいが、

- **roleを独立させる**
- **agentを追加する**
- **関係に時間を持たせる**

これを入れて初めて、  
「複数役割を持つユーザー」  
「複数agentを持つ個人」  
「流動的なチーム」  
が破綻せず表現できる。

**User**: <sub>2026-04-11 14:17</sub>

図で説明

**ChatGPT**: <sub>2026-04-11 14:17</sub>

構造を分けて見る方が理解しやすい。  
「階層」と「関係」は別に描く。

---

## 1. 全体構造（静的配置：ツリー）

```
entity
├── Person A
│   ├── agent: coding-agent
│   ├── agent: research-agent
│
├── Org X
│   ├── Party: Repo1
│   ├── Party: Repo2
│
├── Org Y
│   ├── Party: ProjectA
```

- これは**配置・認知用のツリー**
- 実際の所属や役割はここでは決めない

---

## 2. 実際の関係（重要）

```
Person A
 ├─ member_of ──> Repo1
 ├─ member_of ──> ProjectA

Person A
 ├─ has_role ──> Maintainer (in Repo1)
 ├─ has_role ──> Reviewer   (in ProjectA)

Repo1 ── within ──> Org X
ProjectA ── within ──> Org Y
```

ポイント：
- 所属はツリーではなく**relation**
- roleはparty単位で付く

---

## 3. agent の関係

```
coding-agent
 ├─ acts_for ──> Person A
 ├─ assigned_to ──> Repo1

research-agent
 ├─ acts_for ──> Person A
 ├─ assigned_to ──> ProjectA
```

- agentは「誰の代理か」が必須
- どこで動くかは party に紐づける

---

## 4. まとめ（1枚に圧縮）

```
          Org X                  Org Y
            │                      │
         Repo1                ProjectA
            ▲                      ▲
            │                      │
        (member_of)           (member_of)
            │                      │
          Person A  ───────────────┘
            │
     ┌──────┴────────┐
     │               │
coding-agent   research-agent
     │               │
     └──acts_for─────┘

role:
- Repo1: Maintainer
- ProjectA: Reviewer
```

---

## 5. 要点

- ツリー：置き場所（見た目）
- relation：本当の意味（所属・役割・委任）
- agent：entityに紐づく実行主体
- role：partyごとに変わる

---

## 結論（図から読むべきこと）

- org / party は「場」
- entity は「存在」
- agent は「実行」
- role は「文脈」

そして

**全部をツリーで表そうとすると破綻する**  
→ 必ず relation を併用する必要がある

**User**: <sub>2026-04-11 14:19</sub>

has memberとis member ofどっちがいいのかな？

**ChatGPT**: <sub>2026-04-11 14:19</sub>

結論だけ言う。

**内部表現は `is_member_of` に統一するのがよい。**

---

## 理由

### 1. 主体が常に同じになる

```
entity ── is_member_of ──> party
```

で固定すると、

- entity起点で全部たどれる
- role / agent / delegation と揃う

一方で

```
party ── has_member ──> entity
```

にすると、

- 主語が party に変わる
- クエリや処理の軸がぶれる

---

### 2. 他の関係と揃う

すでにこうなっているはず：

- `agent --acts_for--> entity`
- `entity --has_role--> role`
- `role --in--> party`

ここに合わせるなら

- `entity --is_member_of--> party`

が自然

---

### 3. 多所属・時間管理が簡単

```
(entity, party, role, from, to)
```

の形で一貫して持てる

逆方向だと

- partyごとにメンバー履歴を持つ
- entity側でも持つ必要が出る

→ 二重管理になりやすい

---

## 実装上の扱い

内部は片方向に固定して、

- `is_member_of` を正規
- `has_member` は**派生（逆引き）**

にする

---

## UI / 表示

表示では両方使ってよい

- 「Repo1 has members: A, B」
- 「A is member of Repo1」

ただしデータは1系統だけ

---

## 結論

- データモデル：`is_member_of` に統一
- `has_member` は計算で出すだけ

これでブレない。

**User**: <sub>2026-04-11 14:20</sub>

対称的かとおもったが、そうではない？

**ChatGPT**: <sub>2026-04-11 14:20</sub>

対称ではない。

---

## 1. 数学的には対称に見える

確かに

- `A is_member_of B`
- `B has_member A`

は**情報としては同値**にできる。

これは単なる逆関係（inverse relation）。

---

## 2. しかし設計上は非対称

理由は「どちらを正規に持つか」で意味が変わる。

### is_member_of を正規にした場合

``` id="j6q8zl"
entity → party
```

- 主体（entity）中心のモデル
- 「誰がどこに属しているか」が自然に表現できる
- agent / role と同じ向きになる

---

### has_member を正規にした場合

``` id="r3d3qz"
party → entity
```

- コンテナ（party）中心のモデル
- 「このチームに誰がいるか」は取りやすい
- しかし entity の文脈が弱くなる

---

## 3. 実務での差

差はここに出る。

### 多所属

``` id="1h6o0k"
A → Repo1
A → Repo2
A → ProjectA
```

entity起点だと自然  
party起点だと分散する

---

### role と組み合わせ

``` id="j6kt7f"
A --is_member_of--> Repo1
A --has_role--> Maintainer (in Repo1)
```

同じ主語で揃う

---

### agent と組み合わせ

``` id="9u5a8w"
agent → acts_for → A
agent → assigned_to → Repo1
```

全部「→」方向で統一できる

---

## 4. 本質

対称に見えるのは「情報量」の話であって、

設計では

- **どこを起点に世界を見るか**

が決まる

---

## 結論

- 論理的には対称（inverse）
- 設計上は非対称（正規方向が必要）

M3Eの文脈では

- entity中心で統一する方が整合する

→ `is_member_of` を正規にするのが安定する

**User**: <sub>2026-04-11 14:21</sub>

分散ってなに？　なぜユーザーを起点とするのか？

**ChatGPT**: <sub>2026-04-11 14:21</sub>

「分散」はデータの重複ではなく、**関係の所在が複数箇所に散ること**を指している。

---

## 1. 分散の意味

`has_member` を正規にするとこうなる。

``` id="d3b6qf"
Repo1 ── has_member ──> A
Repo2 ── has_member ──> A
ProjectA ── has_member ──> A
```

このとき、

- Aがどこに所属しているかを知るには
- **全partyを走査する必要がある**

これが「分散」。

---

## 2. is_member_of の場合

``` id="q7v8hf"
A ── is_member_of ──> Repo1
A ── is_member_of ──> Repo2
A ── is_member_of ──> ProjectA
```

この場合、

- Aを見れば所属は全部わかる
- 情報が1箇所に集約される

---

## 3. なぜユーザー（entity）起点にするか

理由は3つある。

---

### (1) M3Eは「思考主体」が中心

M3Eでは

- ノードの意味
- スコープの解釈
- AIへのコンテクスト

すべてが「誰の視点か」に依存する。fileciteturn0file2

したがって、

- entity（人）を中心にした方が自然

---

### (2) role / agent と揃う

``` id="3c1r8w"
A ── has_role ──> Maintainer
agent ── acts_for ──> A
```

ここに

``` id="0z8b2c"
A ── is_member_of ──> Repo1
```

を置くと、

- すべて「主体 → 関係」になる
- モデルが統一される

---

### (3) 流動性への対応

人はこうなる：

- 複数所属
- 兼務
- 一時参加
- 役割変更

これを扱うには

``` id="n9c5kd"
(entity, party, role, time)
```

でまとめた方がよい

party起点だと

- 各partyに履歴が分散する
- 整合性が崩れやすい

---

## 4. 本質

違いはこれ。

- `has_member`：コンテナ視点
- `is_member_of`：主体視点

M3Eは

- 思考主体
- 行為主体
- AI主体

を扱うので、主体視点が合う

---

## 結論

- 分散 = 関係情報が複数ノード側に散ること
- entity起点にすると関係が集約される
- M3Eは主体中心の設計なので `is_member_of` が適している

**User**: <sub>2026-04-11 14:22</sub>

主体中心ってどういうロジックで決めた？

**ChatGPT**: <sub>2026-04-11 14:22</sub>

結論から言うと、**「主体中心」は任意ではなく、既に決めた前提から必然的に出ている**。

---

## 1. M3Eの前提から導出される

仕様の核はこれ：

- 思考主体が1人（個人利用）  
- 構造は認知のためにある  
- AIは提案で、人間が承認する  
- スコープは認知境界  
fileciteturn0file2

この時点で、

- 世界は「誰の視点で見るか」で意味が変わる

---

## 2. モデルの起点候補は3つしかない

関係モデルの起点は必ずどれかになる。

1. entity（人）
2. party（チーム）
3. org（組織）

---

## 3. party起点の問題

partyを起点にすると：

- チームごとに世界が分断される
- 個人の全体像が出ない
- 複数所属の統合ができない

つまり、

**「Aという人は何をしているか」が一箇所で見えない**

---

## 4. org起点の問題

orgを起点にすると：

- GitHub的には整理しやすい
- しかし横断プロジェクトが崩れる
- 個人の活動単位とズレる

---

## 5. entity起点の性質

entity起点だと：

- 所属を全部まとめられる
- roleを文脈ごとに持てる
- agentを自然に紐づけられる
- スコープとも一致する（誰の世界か）

---

## 6. M3Eとの一致

M3Eはこれをやる：

- スコープで世界を切る  
- コンテクストを生成する  
- AIに渡す  
fileciteturn0file2

このとき必要なのは：

- 「この主体にとっての構造」

つまり

``` id="9t3k1m"
Context = f(entity, scope)
```

になる

---

## 7. agentを入れた時に決定的になる

agentは必ず

``` id="p8w6xs"
agent ── acts_for ──> entity
```

になる

ここでparty起点にすると：

- agentの責任主体が曖昧になる

entity起点なら：

- 全agentが一本に束ねられる

---

## 8. 決定ロジック（まとめ）

主体中心にした理由はこれだけ：

1. 思考は誰かのもの  
2. AIは誰かの代理  
3. スコープは誰かの認知境界  
4. 複数所属を一箇所で扱う必要がある  

この4つを同時に満たす起点が

**entityしかない**

---

## 結論

- 主体中心は設計の好みではない  
- M3Eの前提（個人思考・AI代理・スコープ）からの帰結  
- 他の起点では整合しないため、entity起点が選ばれる

**User**: <sub>2026-04-11 14:23</sub>

ＤＢの観点では？
あと一人じゃなくてクラウド同期してチームとして活動することも考えている

**ChatGPT**: <sub>2026-04-11 14:23</sub>

DB観点で整理する。

---

## 1. 結論（DB設計）

- 正規化の軸は **relation（関係テーブル）**
- 向きは **どちらでも表現可能**
- ただし実装では

**「membership を独立テーブルにする」**

これが本質

---

## 2. 正しい形（RDBでもグラフでも同じ）

``` id="m8k2vn"
Entity(id)
Party(id)
Org(id)
Agent(id)

Membership(
  entity_id,
  party_id,
  role_id,
  valid_from,
  valid_to
)
```

ここでは

- `is_member_of` も
- `has_member` も

**ただの見方の違いでしかない**

---

## 3. なぜ向きにこだわらなくていいか

DBでは

```sql
SELECT * FROM Membership WHERE entity_id = A;
SELECT * FROM Membership WHERE party_id = Repo1;
```

どちらも同じコストで取れる

つまり

- 分散問題は「DBでは起きない」
- それはインデックスで解決される

---

## 4. それでも entity 起点にする理由

DBではなく「モデル設計」の話になる

### (1) API設計が安定する

``` id="0o7v2g"
GET /entities/A/memberships
GET /entities/A/roles
GET /entities/A/agents
```

全部同じ軸になる

---

### (2) コンテクスト生成が簡単

M3Eで重要なのはこれ：

- 「この主体の文脈」

``` id="7k3xpf"
Context(entity A) =
  memberships + roles + agents + scope
```

---

### (3) チーム対応でも崩れない

チーム利用になると：

- 複数ユーザー
- 複数org
- 複数party

になるが、

entity起点なら

- 各ユーザー単位で完全に切り出せる

---

## 5. チーム（クラウド同期）時の構造

``` id="l9p2wx"
Org X
 ├─ Repo1
 ├─ Repo2

Membership:
A → Repo1 (Maintainer)
B → Repo1 (Member)
A → Repo2 (Reviewer)
C → Repo2 (Member)
```

ここに agent を追加：

``` id="s4v8zn"
agent1 → acts_for → A
agent1 → assigned_to → Repo1
```

---

## 6. 分散の正体（DB版）

DBでは分散は問題にならないが、

問題になるのはこれ：

- 更新責務
- 一貫性

もし

``` id="g3q1rl"
Party.has_members = [...]
Entity.memberships = [...]
```

の両方を持つと

- 同期ズレが発生する

だから

**単一の source of truth（Membership）に統一する**

---

## 7. 最終構成

DBとしてはこれで十分

- Entity
- Party
- Org
- Agent
- Role
- Membership（+ time）

---

## 結論

- DBでは `is_member_of` vs `has_member` は本質ではない  
- 本質は **関係を独立テーブルにすること**  
- その上で

  - API / 思考 / AI連携の都合で  
  - entity起点にすると扱いやすい  

- チーム対応でもこの構造はそのまま拡張可能

**User**: <sub>2026-04-11 14:24</sub>

評価軸をまず列挙して。そして何が問題となるの？

> [!info] Reasoning Summary
> <sub>2026-04-11 14:24</sub>
> 
> 思考時間: 2 ～ 3 秒

**ChatGPT**: <sub>2026-04-11 14:24</sub>

評価軸を先に固定すると、議論が整理しやすい。  
この件では少なくとも次の軸がある。

**1. 概念の自然さ**  
人、組織、チーム、AI agent、役割を無理なく表せるか。

**2. 流動性への対応**  
異動、兼務、一時参加、プロジェクト終了、agentの付け替えに耐えるか。

**3. 一意性**  
同じ人や同じagentを複製せずに扱えるか。M3Eは実体一意を重視しているので、ここは重要。fileciteturn0file2

**4. 正規化しやすさ**  
DBで source of truth を一箇所に置けるか。二重管理にならないか。

**5. クエリのしやすさ**  
誰がどこに属するか、このpartyに誰がいるか、このagentは誰の代理か、を取りやすいか。

**6. 更新のしやすさ**  
所属変更、役割変更、agent追加時に、何箇所直せばよいか。

**7. 整合性の保ちやすさ**  
所属と役割、agentと責任主体、orgとpartyの関係が矛盾しにくいか。

**8. 権限モデルとの相性**  
閲覧権限、編集権限、代理実行権限を素直に乗せられるか。

**9. スコープ設計との相性**  
M3Eの scope は認知境界なので、org や party をどの単位で切るかが自然か。scope と alias の設計と衝突しないか。fileciteturn0file2

**10. UI表現のしやすさ**  
ツリー、一覧、関係図、権限表のどれにしても破綻しないか。

**11. AI agent の責任帰属**  
そのagentが誰の代理か、どのpartyで動いているか、誰が承認者かを明確にできるか。

**12. 将来拡張性**  
個人利用からクラウド同期、さらにチーム利用へ広げても壊れないか。

---

そのうえで、問題は主に5つある。

## 何が問題になるのか

### 1. 階層だけでは表せない
`entity < party < org` のような固定階層だけだと、兼務や横断チームを表しにくい。  
たとえば、1人が Repo1 と Repo2 に所属し、さらに Org 横断の ProjectA に入る状況は、木だけでは無理が出る。

### 2. 「所属」と「役割」と「代理」が別物
同じ人でも、

- Repo1では maintainer
- Repo2では reviewer
- ProjectAでは observer

のように party ごとに役割が変わる。  
さらに AI agent がその人の代理で一部作業だけすることもある。  
つまり、

- 所属
- 役割
- 実行主体
- 責任主体

を分けないと混線する。

### 3. org と party の意味が違う
あなたの定義では、

- org = GitHub organization のような全体の枠
- party = チームや共同作業単位

なので、これは上下関係とは限らない。  
普通は `party within org` が多いが、横断partyもありうる。  
ここを階層で固定すると、例外処理が増える。

### 4. DBで二重管理しやすい
`has_member` も `is_member_of` も両方を正本として持つと、更新ズレが起きる。  
DBでは membership を独立テーブルにして、そこだけを正本にする必要がある。  
問題は向きそのものより、**正本を複数持たないこと**。

### 5. AI agent の責任主体が曖昧になりやすい
agent を独立したユーザーのように扱うと、

- 誰の代理か
- 誰が承認者か
- どのpartyで動くか

が不明になる。  
M3Eは AI が提案し人間が確定する前提なので、責任の帰属は明確である必要がある。fileciteturn0file2

---

## つまり、設計上の核心は何か

核心は、**木で表すものと、関係テーブルで表すものを分けること**。

木で表すのに向くものは、

- org の下に repo を置く
- person の下に personal agent を置く

のような、見た目や管理上の配置。

関係で表すべきものは、

- membership
- role assignment
- acts_for
- assigned_to
- valid_from / valid_to

のような流動的な意味関係。

---

## 先に言語化すべき設計判断

このあと本当に決めるべきなのは、この4点。

**1. org は境界か、単なる容器か**  
権限境界まで持つのか。

**2. party は何を表すか**  
repo、team、project を全部含める抽象概念にするのか。

**3. agent は誰に必ず紐づくか**  
user か、party か、org か。

**4. 正本は何か**  
membership と role assignment を独立 relation として持つか。

---

結論として、問題は「has_member か is_member_of か」自体ではなく、  
**固定階層だけで済ませようとすると、所属・役割・代理・時間変化が潰れてしまうこと**にある。

**User**: <sub>2026-04-11 14:26</sub>

ＯＫ．用語定義を確定させたい。

> [!info] Reasoning Summary
> <sub>2026-04-11 14:26</sub>
> 
> 思考時間: 4s

**ChatGPT**: <sub>2026-04-11 14:26</sub>

では、最小限でぶれにくい定義を固定する。

## 基本方針

- **実体**と**関係**を分ける
- 固定的なものは名詞で定義する
- 流動的なものは relation として持つ
- 役割や所属は階層ではなく関係で持つ

---

## 用語定義案

### 1. Entity
存在する対象の総称。  
人、AI agent、organization、party、document、resource などを含む最上位概念。

**定義**  
M3E において識別可能で、ID を持つ実体。

---

### 2. User
M3E を利用する人間の entity。

**定義**  
人間であり、認知主体・承認主体・責任主体になりうる entity。

補足：
- 1人の user は複数の role を持てる
- 1人の user は複数の AI agent を持てる

---

### 3. Agent
処理や行動を実行する entity。  
人間ではなく、自動化された実行主体を指す。

**定義**  
ある user または party のために処理を行う非人間の実行主体。

補足：
- agent 自体は entity
- 既定では単独の責任主体ではない
- 誰のために動くかは relation で持つ

---

### 4. Organization
全体の境界や所有単位を表す entity。  
GitHub Organization に近い概念。

**定義**  
複数の party や resource を包含し、管理境界・所有境界・権限境界になりうる集合的 entity。

補足：
- company
- lab
- GitHub organization
- workspace

---

### 5. Party
共同で何かを行う単位。  
repo, team, project, committee などを含む。

**定義**  
user や agent が参加し、役割を持って活動する協働単位。

補足：
- team
- repository
- project
- task force
- working group

重要：
- party は organization の下に置かれることが多い
- ただし概念上は organization と別物

---

### 6. Role
ある party における機能的立場。

**定義**  
特定の entity が特定の party において担う役割。

補足：
- maintainer
- reviewer
- observer
- owner
- writer

重要：
- role は user に固定で付かない
- **party ごとに付く**

---

### 7. Membership
entity が party に属しているという関係。

**定義**  
entity と party の所属関係を表す relation。

補足：
- これは名詞として定義する
- DB では独立レコードにするのが自然

---

### 8. Assignment
agent が特定の party や task に割り当てられている関係。

**定義**  
agent の実行先を表す relation。

---

### 9. Delegation
ある user または party が agent に処理を委ねる関係。

**定義**  
責任主体が agent に実行権限または補助権限を与える relation。

---

### 10. Scope
M3E 上で見える範囲、考える範囲。  
既存仕様と整合する。scope は認知境界として扱う。fileciteturn0file2

**定義**  
可視性・編集性・思考対象を制御する認知境界。

---

## relation 名も合わせて固定するなら

内部名は次でよい。

- `membership`  
  entity と party の所属
- `role_assignment`  
  entity が party で持つ role
- `acts_for`  
  agent が誰のために動くか
- `assigned_to`  
  agent がどこで動くか
- `within_org`  
  party がどの organization に属するか
- `delegates_to`  
  user または party が agent に委ねる
- `valid_from`, `valid_to`  
  時間範囲

---

## 階層として読むなら

```text
Entity
├── User
├── Agent
├── Organization
└── Party
```

Role と Membership は entity ではなく relation として扱う。

---

## これで確定するとよい文

**Entity**  
識別可能な実体の総称。

**User**  
認知主体・承認主体となる人間の entity。

**Agent**  
User または Party のために処理を実行する非人間の entity。

**Organization**  
管理・所有・権限の境界を表す集合的 entity。

**Party**  
共同作業や意思決定の単位となる協働 entity。

**Role**  
特定の Party において Entity が担う機能的立場。

**Membership**  
Entity が Party に属するという関係。

**Scope**  
M3E における可視性と編集範囲を決める認知境界。fileciteturn0file2

---

## 1点だけ注意

`repository` を party に含めるか独立型にするかは後で分岐できる。  
今の段階では、**repo は party の一種**として扱うのが最も単純。

**User**: <sub>2026-04-11 14:27</sub>

ＰａｒｔｙってＰＪのほうがわかりやすい？

**ChatGPT**: <sub>2026-04-11 14:27</sub>

結論から言うと、**PJ（project）に置き換えるのは危険**。  
理解はしやすくなるが、概念が狭くなりすぎる。

---

## 1. Party と Project の違い

### Party
- 協働単位（広い）
- 継続・非継続どちらも含む
- repo / team / project / 委員会 すべて含められる

### Project（PJ）
- 目的・期間があるもの
- 基本的に一時的
- 「作業単位」のニュアンスが強い

---

## 2. PJにすると何が壊れるか

### (1) repo が表現しにくい

- repo は project ではない場合がある  
- 長期的・継続的な資産

---

### (2) team が曖昧になる

- team は project とは限らない  
- 常設チームがある

---

### (3) 権限モデルがズレる

Git的には

- org
- repo
- team

が基本で、

- project はその上に乗る概念

---

## 3. Party の役割（本質）

Party はこれを吸収するための言葉：

- repo
- team
- project
- working group
- task force

つまり

**「人やagentが集まって何かする単位」全部**

---

## 4. 命名の選択肢

### そのまま Party
- 正確
- ただし抽象的で分かりにくい

---

### Unit
- ややわかりやすい
- でも意味が広すぎる

---

### Group
- わかりやすい
- しかし「権限・作業単位」感が弱い

---

### Workspace / Context
- M3Eとは相性良い
- ただしGitモデルから離れる

---

### Project（PJ）
- わかりやすい
- ただし意味が狭い（非推奨）

---

## 5. 実用的な折衷

内部：

- **Party のままにする**

UI表示：

- Repo / Team / Project を個別に見せる

つまり

```text
Party
 ├─ type: repo
 ├─ type: team
 ├─ type: project
```

---

## 結論

- PJは理解しやすいが概念が狭すぎる  
- Partyは抽象的だが拡張性がある  

したがって

**内部モデルは Party を維持するのが安全**

**User**: <sub>2026-04-11 14:28</sub>

各エンティティと各コンテンツの間に権限があるんだよね？

**ChatGPT**: <sub>2026-04-11 14:28</sub>

結論：  
**権限は「entity × resource（content）」の直接関係ではなく、  
「role を介して決まる」のが基本構造。**

---

## 1. まず何に対する権限か

権限の対象は2種類ある。

- **Party に対する権限**
- **Content（ノード・ファイル等）に対する権限**

---

## 2. 基本構造（推奨）

``` id="p1w3xz"
Entity ── membership ──> Party
Entity ── role_assignment ──> Role (in Party)

Role ── grants ──> Permission
Permission ── applies_to ──> Resource
```

---

## 3. 重要な分離

### (1) 所属（membership）
- その場に「いるかどうか」

### (2) 役割（role）
- 何ができるか

### (3) 権限（permission）
- 実際の操作（read / write / admin など）

---

## 4. Content（M3Eの場合）

M3Eでは content は

- Node
- Folder（= scope）
- Graph構造

などになる。fileciteturn0file2

---

## 5. 権限のかけ方

### 方法A：Party単位

``` id="t7k9hv"
Repo1:
  Maintainer → read/write/delete
  Reviewer   → read/comment
```

→ Git型

---

### 方法B：Content単位（細粒度）

``` id="n3x8dp"
Node123:
  A → read/write
  B → read only
```

→ 柔軟だが複雑

---

## 6. 推奨モデル（現実的）

両方使う：

- 基本：**Party単位の権限**
- 例外：**Content単位の上書き**

---

## 7. agent の場合

``` id="r8q2lm"
agent ── acts_for ──> User
agent ── assigned_to ──> Party
```

権限は：

- userから継承
- もしくは制限付き

---

## 8. 問題になる点

### (1) entityに直接権限を持たせると破綻

``` id="b6y1zf"
A → Node1 (read)
A → Node2 (write)
```

これをやると：

- 管理不能になる
- roleが死ぬ

---

### (2) roleを飛ばすと一貫性が崩れる

- Gitでも role（permission group）が中核
- これを省くとスケールしない

---

### (3) scopeとの衝突

M3Eでは

- scope = 見える範囲  
fileciteturn0file2

なので

- 権限と可視性の設計を分ける必要がある

---

## 9. 最小構成

これだけあれば十分：

- Entity
- Party
- Role
- Membership
- Permission
- Resource（Node等）

---

## 結論

- 権限は entity と content の直接関係ではない  
- **role を介した間接関係にするのが基本**  
- Party単位で管理し、必要ならContentで上書きする  
- agentは user の権限体系に従属させる  

これで破綻しない。

**User**: <sub>2026-04-11 14:30</sub>

scopeごとにroleの権限を決めている？

> [!info] Reasoning Summary
> <sub>2026-04-11 14:30</sub>
> 
> 思考時間: 2 ～ 3 秒

**ChatGPT**: <sub>2026-04-11 14:30</sub>

基本は、**そうした方がよい**。  
ただし正確には、

**role の権限は scope そのものに付くのではなく、scope 内の resource 群に対して定義される**

と考えるのがよい。

## 整理

### 1. scope
認知境界・可視境界。  
M3Eでは folder を根とする可視性と編集範囲の単位。fileciteturn0file2

### 2. role
ある party における立場。

### 3. permission
read, write, comment, admin などの操作権限。

---

## 推奨の考え方

### 基本ルール
**party 内で role を持ち、その role に対して scope 単位で権限を与える**

つまりイメージはこう。

```text
Entity --membership--> Party
Entity --role_assignment--> Role (in Party)
Role --permission_on--> Scope
```

ただし実装では、`Scope` に直接ではなく、

```text
Role --grants--> Permission
Permission --applies_to--> Resource group in Scope
```

の方が正確。

---

## なぜ scope 単位がよいか

### 1. M3Eの境界と一致する
scope は「どこまで見せるか」「どこまで編集するか」の単位なので、権限境界と相性がよい。fileciteturn0file2

### 2. content 単位より管理しやすい
node ごとに権限を持つと細かすぎて破綻しやすい。  
まずは scope 単位でまとめた方がよい。

### 3. role の意味が文脈依存だから
同じ reviewer でも、ある scope では read only、別の scope では comment 可、という差を自然に表せる。

---

## ただし注意

**scope = role の所属先** ではない。  
role は party に属し、  
**権限の適用範囲が scope** という形にした方がきれい。

つまり

- role は party 文脈で定義
- permission は scope 文脈で適用

---

## 例

Party = Repo1  
Role = Reviewer

- Scope A: read, comment
- Scope B: read only
- Scope C: no access

これは自然。

---

## 結論

- 基本方針としては **scope ごとに role の権限を決める** でよい
- ただし厳密には  
  **role に対して、scope 内 resource への permission を割り当てる**
- role 自体は party 側の概念、scope は適用範囲の概念として分けるのがよい

**User**: <sub>2026-04-11 14:54</sub>

agentの作業範囲をどう規定すればいいの？
設計が悪いと勝手にmanager役でAPIたたくこともできるよね

> [!info] Reasoning Summary
> <sub>2026-04-11 14:55</sub>
> 
> 思考時間: 20s

**ChatGPT**: <sub>2026-04-11 14:55</sub>

そう。  
**agent の作業範囲は、role ではなく capability と scope と approval で切る**のがよい。

role だけだと危ない。  
`manager role` を持つ agent が広い API を叩ける設計にすると、設計ミス1つで越権する。

## 先に結論

agent には少なくとも次の4層が必要。

1. **who**  
   誰のために動くか  
   `acts_for`

2. **where**  
   どの範囲で動けるか  
   `scope / party / resource selector`

3. **what**  
   何の操作ができるか  
   `capability`

4. **how**  
   その操作が即実行か、承認必須か  
   `approval policy`

この4つを全部満たしたときだけ実行可にする。

---

## なぜ role だけでは危険か

role は意味が広すぎる。

たとえば `manager` という role があっても、それだけでは

- どの scope まで見てよいか
- どの API を呼んでよいか
- read だけか write までか
- 自動実行か提案だけか

が決まらない。

だから agent に直接 role を与えるのではなく、

**role は文脈のラベル**  
**実行可否は capability で判定**

に分けるべき。

---

## 推奨モデル

### 1. Agent
非人間の実行主体

### 2. AgentGrant
agent に与える権限束

中身はこうする。

```text
AgentGrant
- agent_id
- principal_id        // acts_for の相手
- party_id?           // 任意
- scope_id?           // 操作範囲
- capabilities[]      // 許可API群
- approval_mode       // auto / require_user / require_manager
- valid_from
- valid_to
- rate_limit
- max_depth / max_nodes / max_tokens
```

---

## capability は role から分離する

たとえば capability をこのくらい細かく切る。

```text
read_scope
read_alias_target
propose_edit
apply_edit
create_node
move_node
delete_node
export_context
invoke_external_api
manage_roles
manage_agents
approve_proposal
```

重要なのは、**manager role だから manage_roles を自動的に持つ**とはしないこと。

role は UI や組織上の意味付け。  
capability は実行エンジンが見る厳密な許可。

---

## 特に危険な capability は分離する

次は別格で扱うべき。

- `invoke_external_api`
- `manage_roles`
- `manage_agents`
- `apply_edit`
- `delete_node`
- `cross_scope_write`

この5つは既定で禁止でよい。

---

## M3E との整合

M3E はもともと

- scope 境界を重視
- 現在 scope 外は基本的に露出しない
- AI は提案であり、人間の承認で確定
- Model が制約検証の最終責任を持つ

という前提になっている。fileciteturn2file1  
また、subagent についても

- `scopeId` 配下のみ送信可
- モデルを直接更新しない
- 採用操作でのみ反映
- timeout や不正応答は fail-closed

という方針が既にある。fileciteturn1file5 fileciteturn1file3

だから agent も同じ思想で統一すればよい。

---

## 実行判定はこうする

agent が API を呼ぶ前に、必ず次を全て見る。

```text
allow(agent, action, resource, context) =
  acts_for が存在
  AND scope が resource を含む
  AND capability が action を許可
  AND approval policy を満たす
  AND rate / size / time 制限内
```

1つでも欠けたら拒否。

---

## 実装上の重要点

### 1. API は role を見てはいけない
API サーバーは `manager` という文字列を信用しない。  
見るのは capability だけ。

### 2. scope は必ず resource selector に落とす
曖昧な scope 名ではなく、

- root node id
- 許可 subtree
- 許可 resource type

まで具体化する。

### 3. write は direct でなく command に限定
M3E では状態変更は `Command -> Model.apply()` が唯一の入口に寄せる方針なので、agent も直接更新禁止にして、必ず command 経由にするのがよい。Model 側が scope 制約や alias 制約を最終検証する設計とも一致する。fileciteturn2file2

### 4. 高権限操作は二段階にする
たとえば `manage_roles` や `invoke_external_api` は

- agent は request を出すだけ
- 人間または上位承認者が approve
- その後に実行

にする。

---

## 具体的な防ぎ方

### 悪い設計
```text
agent.role = "manager"
if role == "manager": allow all admin APIs
```

これは危険。

### よい設計
```text
agent.capabilities = [
  read_scope,
  propose_edit
]
approval_mode = require_user
scope_id = S1
```

この agent は

- S1 の中だけ読める
- 編集提案だけできる
- 直接 apply はできない
- 外部 API は叩けない

---

## 実務上のおすすめ初期値

agent は最初こうしておくと安全。

- 既定 capability は `read_scope`, `export_context`, `propose_edit` のみ
- `apply_edit` は承認必須
- `invoke_external_api` は既定禁止
- `manage_roles`, `manage_agents` は人間専用
- scope は単一 subtree に限定
- cross-scope は alias 経由の read のみ
- 全実行を監査ログ化

---

## 最後に本質

問題は  
**agent が manager 役を名乗ること**  
ではない。

本当に危険なのは  
**役職名がそのまま実行権限になること**  
だ。

したがって、設計はこう切るべき。

- role: 組織上の意味
- capability: 実行可能な操作
- scope: 到達可能な範囲
- approval: 即実行か承認必須か

この4つを分離すれば、勝手に manager 役で API を叩く設計にはなりにくい。

**User**: <sub>2026-04-11 14:57</sub>

僕のために働いてるって嘘をいうことができるのはどう防ぐ？

> [!info] Reasoning Summary
> <sub>2026-04-11 14:57</sub>
> 
> 思考時間: 数秒

**ChatGPT**: <sub>2026-04-11 14:57</sub>

防ぐ方法は明確で、  
**agent の自己申告を一切信用しない**こと。

`I act for Subaru` のような宣言は、ただの文字列なので意味を持たせてはいけない。  
信用するのは **サーバー側で発行した委任情報** だけ。

## 結論

`acts_for` は agent が名乗るものではなく、  
**認証済み user が作成した delegation record** として管理する。

---

## 悪い設計

```text
request:
  agent_id = X
  acts_for = Subaru
  action = apply_edit
```

これだと、agent は勝手に `acts_for=Subaru` と言える。

---

## よい設計

```text
AgentCredential
- agent_id
- signed_by_system
- owner_user_id
- allowed_scope
- capabilities
- expiry
```

リクエスト時は、

1. agent が credential を提示
2. サーバーが署名を検証
3. その credential に書かれた `owner_user_id` を採用
4. request 本文の `acts_for` は無視

こうする。

---

## 本質

**「誰のために働くか」は入力値ではなく、認証結果で決まる**  
これが原則。

---

## 必要な層

### 1. agent identity
agent 自体の鍵またはトークン

### 2. delegation
その agent を誰が所有・承認したか

### 3. capability grant
何ができるか

### 4. scope grant
どこまで届くか

---

## 実装上の防御

### 1. acts_for を外部入力から受け取らない
受け取っても無視する。

### 2. agent ごとに固有 credential を発行する
API key でも署名鍵でもよい。  
共有鍵はだめ。

### 3. delegation は user の承認でのみ作る
本人がログインした状態で発行する。

### 4. 短寿命にする
永続トークンではなく、失効可能な短寿命 credential にする。

### 5. 高権限操作は再承認
たとえ正しい agent でも、

- role変更
- agent作成
- 外部API呼び出し
- write実行

は再承認にする。

### 6. 監査ログを残す
「誰の credential で」「どの agent が」「何をしたか」を残す。

---

## 判定式

実行可否はこう見る。

```text
allow =
  verify(agent_credential)
  AND credential.owner_user_id = expected principal
  AND delegation not revoked
  AND capability allows action
  AND scope allows target
  AND approval policy satisfied
```

agent の自己申告はこの中に入らない。

---

## M3E文脈での意味

M3E はもともと、AI が勝手に正本を書き換えず、人間承認で確定する前提を置いている。fileciteturn0file2  
また AI API でも、送信範囲や approval を server 側で管理する方針になっている。fileciteturn0file5  
同じで、`acts_for` も agent の発話ではなく **server 管理の事実** にしないといけない。

---

## 一番短く言うと

**「僕のために働いている」は agent に言わせない。  
サーバーが署名付き委任情報でそう認定したときだけ真になる。**

**User**: <sub>2026-04-11 14:58</sub>

つねに上位者が仕事とcredentialを発行する、ということでよい？

**ChatGPT**: <sub>2026-04-11 14:58</sub>

結論：  
**「常に上位者が発行する」は半分正しいが、不十分。**  
正しくは、

**「責任主体（principal）が委任し、システムがそれを強制する」**

---

## 1. 上位者モデルの問題

「上位者が発行」とするとこうなる。

- manager が全部の agent を発行
- manager が全部の権限を持つ

問題：

- 権限が一点に集中する
- 誤設定で全崩壊する
- 自律的な利用（個人agentなど）ができない

---

## 2. 正しい単位：principal

principal は

- user
- party（場合によっては）
- system（特別用途）

のいずれか

つまり

```text
delegation:
  principal → agent
```

---

## 3. 基本ルール

### (1) 自分のagentは自分で発行できる

- User A → agent a1
- これは問題ない

---

### (2) Partyに関するagentは権限者のみ発行

```text
Repo1 maintainer → agent
```

- role が必要
- 勝手には作れない

---

### (3) 上位者は「必要なときだけ関与」

常にではない

---

## 4. 発行の条件

credential発行はこれを満たす必要がある：

```text
can_delegate(principal, scope, capability)
```

つまり

- その人が持っている権限の範囲内でしか
- agent に渡せない

---

## 5. 重要な制約（これが本質）

### 権限の単調性

```text
agent.capability ⊆ principal.capability
agent.scope ⊆ principal.scope
```

これを必ず守る

---

## 6. 危険なのはここ

### NGパターン

```text
manager → agent (all permissions)
agent → さらに agent を発行
```

→ 権限が指数的に拡散する

---

## 7. 防ぐルール

### (1) 再委任を制限

```text
allow_delegation = false (default)
```

### (2) delegation depth を制限

```text
depth <= 1 or 2
```

### (3) 高権限は委任不可

- manage_roles
- manage_agents
- external_api

---

## 8. 実際の運用モデル

### ケース1：個人

```text
User A → agent a1
```

完全に自己責任

---

### ケース2：チーム

```text
Repo1 Maintainer → agent r1
```

- Repo1 scope限定
- repo内だけ動く

---

### ケース3：全体自動化

```text
Org admin → system agent
```

- 非常に制限強く
- 承認付き

---

## 9. 判定フロー

```text
issue_credential(principal, agent, grant):

  verify principal identity
  verify principal has required capability
  ensure grant ⊆ principal permissions
  enforce delegation policy
  create signed credential
```

---

## 結論

- 「上位者が常に発行」は不要
- 必要なのは

  - **責任主体が発行**
  - **自分の権限範囲内でのみ委任**
  - **システムが強制検証**

- 上位者は例外的に関与するだけ

---

一言で言うと：

**委任は階層ではなく制約で管理する。**

**User**: <sub>2026-04-11 15:00</sub>

機密情報へのアクセスはどういうフローになるの？
User, Agent:Executive>manager>workerがいるとする

**ChatGPT**: <sub>2026-04-11 15:00</sub>

結論：  
**機密アクセスは「role」ではなく、  
認証済み主体＋委任＋追加承認＋スコープ制限の多段チェックで決める。**

`Executive > Manager > Worker` の階層は参考にはなるが、  
**それだけではアクセス制御に使わない。**

---

## 1. 前提構造

```text
User U
 └─ agent: Executive
     └─ agent: Manager
         └─ agent: Worker
```

ここで重要なのは：

- 上下関係ではなく **委任チェーン**
- 各 agent は独立に検証される

---

## 2. 機密アクセスの基本フロー

```text
Worker → request(secret_data)

1. 認証
   - Worker の credential 検証

2. 委任チェーン検証
   - Worker → Manager → Executive → User
   - すべて有効か確認

3. 権限交差（intersection）
   - Worker ∩ Manager ∩ Executive ∩ User
   - 全員が許可している範囲だけ通す

4. スコープチェック
   - 対象 resource が許可 scope 内か

5. 機密ポリシー
   - 機密フラグがある場合、追加条件

6. 承認判定
   - 必要なら User または Executive に確認

7. 実行 or 拒否
```

---

## 3. 最重要ルール（これで事故を防ぐ）

### (1) 権限は「交差」で決まる

```text
effective_permission =
  Worker
  ∩ Manager
  ∩ Executive
  ∩ User
```

どこか1つでも禁止なら不可。

---

### (2) 機密は追加制約

通常データ：

- capability があれば読める

機密データ：

- capability + approval + context 条件

---

### (3) agentは自己判断で昇格できない

Worker が

```text
"I act for Executive"
```

と言っても無効

→ credential に書かれた chain のみ有効

---

## 4. 機密データのレベル設計

```text
public
internal
confidential
secret
```

アクセス条件：

| level         | 条件 |
|--------------|------|
| public       | read可 |
| internal     | membership必要 |
| confidential | role + scope |
| secret       | role + scope + approval |

---

## 5. approval の入れ方

### パターンA：人間承認

```text
Worker → request → User approve → 実行
```

---

### パターンB：上位agent承認

```text
Worker → Manager approve → 実行
```

※ただし Manager 自体の権限が限定される

---

### パターンC：二段階

```text
Worker → Manager → User
```

---

## 6. 実装で必要なデータ

```text
Delegation
- parent_agent
- child_agent
- allowed_capabilities
- allowed_scope

Credential
- agent_id
- principal_id
- chain_hash
- expiry

Resource
- classification_level
```

---

## 7. NG設計

### (1) roleで直接許可

```text
if role == "Executive": allow secret
```

→ 危険

---

### (2) 上位agentの権限を自動継承

```text
Worker inherits Executive permission
```

→ 権限漏洩

---

### (3) approvalなしでsecretアクセス

→ 即アウト

---

## 8. M3Eとの整合

- scope外は基本見えない  
- AIは提案で確定は人間  
- Modelが最終検証  

この前提と一致する：

- secretはscope+承認で制御
- agent単独では確定不可  
fileciteturn0file2

---

## 結論

- 機密アクセスは階層ではなく**検証パイプライン**で決める  
- agentチェーンは「委任の証明」であり、権限ではない  
- 実際の許可は

  - credential
  - capability
  - scope
  - approval
  - classification

の組み合わせで決まる  

一言で言うと：

**「上位だから見れる」は禁止。  
「全条件を満たしたときだけ見れる」にする。**

**User**: <sub>2026-04-11 15:02</sub>

人間がすべての行為を監視するのは不可能　効率と安全の両立を結局追及する必要がある？

**ChatGPT**: <sub>2026-04-11 15:02</sub>

結論：  
**はい。完全監視は不可能なので、「効率と安全の両立」を設計で達成する必要がある。**  
ただし方法は「全部承認する」ではなく、**リスクに応じて自動化と制御を分離すること**。

---

## 1. 問題の本質

- 全承認 → 安全だが遅い（破綻）
- 全自動 → 速いが危険（破綻）

したがって必要なのは

**リスクベース制御**

---

## 2. 基本戦略

行為を3段階に分ける。

```text
Low risk      → 自動実行
Medium risk   → 制限付き自動 + ログ
High risk     → 承認必須
```

---

## 3. リスクの決め方

以下の組み合わせで決める。

### (1) データの機密度
- public / internal / confidential / secret

### (2) 操作の種類
- read
- write
- delete
- external API

### (3) 影響範囲
- 単一ノード
- scope内
- cross-scope
- 全体

---

## 4. 実際のルール例

```text
read + public → 自動OK
read + confidential → OK（ログ）
read + secret → 条件付き or 承認

write + 自分のscope → OK（制限付き）
write + 他人scope → 承認

delete → 基本承認

external API → 承認 or sandbox
```

---

## 5. agentの設計で重要なこと

### (1) 完全自由にしない
- 必ず scope と capability を制限

### (2) 完全停止にも頼らない
- ある程度は自動で動かす

---

## 6. 安全と効率を両立する仕組み

### ① サンドボックス実行

- agentはまず仮想的に実行
- 差分だけ出す

```text
proposed_changes = simulate(agent_action)
```

---

### ② 差分ベース承認

人間は全部見ない

- 「何が変わるか」だけ見る

---

### ③ レート制限

```text
max_actions_per_minute
max_nodes_changed
```

暴走を止める

---

### ④ スコープ隔離

- scope外は見えない
- alias経由のみ

---

### ⑤ 監査ログ（後追い）

リアルタイム監視はしない  
代わりに

- 全行為を記録
- 異常検知で後から止める

---

### ⑥ フェイルセーフ

- 不明なケース → 拒否
- timeout → 拒否

---

## 7. 実用モデル

### 安全なデフォルト

- read → 基本OK
- propose → OK
- apply → 条件付き
- destructive → 承認

---

### 高効率モード（信頼済agent）

- 限定scope内でwrite許可
- ただし
  - delete禁止
  - 外部API制限

---

## 8. 本質

重要なのはこれ：

**「全部止める」でも「全部許す」でもない**

ではなく

**「危険なところだけ止める」**

---

## 結論

- 人間の完全監視は不要かつ不可能  
- 必要なのは

  - リスク分類
  - capability制限
  - scope制限
  - 承認の最小化
  - ログとフェイルセーフ  

- 安全と効率はトレードオフではなく  
  **設計で分離して同時に達成するもの**

**User**: <sub>2026-04-11 15:03</sub>

定量的に扱うべき？

> [!info] Reasoning Summary
> <sub>2026-04-11 15:03</sub>
> 
> 思考時間: 数秒

**ChatGPT**: <sub>2026-04-11 15:03</sub>

はい。  
**定量的に扱うべき**です。  
ただし、**最終判断まで全部を数値に押し込む必要はない**です。

## なぜ定量化が必要か

安全と効率は感覚で運用すると、必ずぶれます。

たとえば同じ操作でも、

- ある日は危険と判断する
- ある日は面倒だから通す

となる。  
これを防ぐには、少なくとも **リスク判定の入口** は定量化した方がよい。

## 何を定量化するか

最低限、次を点数化するとよい。

**1. 機密度**  
public / internal / confidential / secret

**2. 操作の危険度**  
read / write / delete / permission change / external API

**3. 影響範囲**  
1 node / 1 scope / cross-scope / org-wide

**4. 自律度**  
提案だけ / 自動実行 / 再委任あり

**5. 復元可能性**  
undo可能 / rollback可能 / 不可逆

**6. 主体の信頼度**  
human / trusted agent / new agent / external agent

## 例

リスクスコアを単純に

```text
Risk = 機密度 + 操作危険度 + 影響範囲 + 自律度 + 不可逆性
```

のように置く。

そして閾値で分ける。

- 0–3: 自動許可
- 4–6: ログ付き自動
- 7–9: 差分確認
- 10以上: 承認必須

こうすると、設計判断が安定する。

## ただし注意

**定量化は真実ではなく、運用ルール**です。  
だから、2つの罠がある。

### 1. 数値が一人歩きする
本当は危険なのに、点数が低いから通してしまう。

### 2. 重み付けが雑だと意味がない
たとえば `delete` と `read confidential` を同じ1点にすると壊れる。

だから、最初から精密な数式を作る必要はなくて、  
**粗いスコアリングを作って、事故例を見ながら重みを修正する**のが現実的。

## 実務的にはこうするのがよい

**定量化するもの**
- 実行前のリスク判定
- rate limit
- 最大変更件数
- 最大scope深さ
- 最大token数
- credential有効期限

**定量化しすぎないもの**
- 組織上の意味
- 本当に重要な例外判断
- 責任の所在

## あなたのケースでの意味

M3Eでは、agent の暴走防止は

- capability
- scope
- approval
- fail-closed

で切るべきだった。  
ここに **定量リスク判定** を足すと、

- どこまで自動化するか
- どこで承認を要求するか

を機械的に決められる。

## 結論

- **定量的に扱うべき**
- ただし対象は **リスク判定と制限条件**
- 最終責任や例外判断まで完全数値化はしない

一番よいのは、

**定性的な設計原則の上に、定量的な実行ルールを載せること** です。

**User**: <sub>2026-04-11 15:04</sub>

秘密が”浸透”するイメージを持ってる。ある程度の閾値をこえてトリガーがあると漏れる

**ChatGPT**: <sub>2026-04-11 15:04</sub>

そのイメージは妥当。  
設計としては「漏れるか／漏れないか」ではなく、**浸透量（exposure）を蓄積して閾値で制御するモデル**にするのがよい。

---

## 1. モデル化（連続量として扱う）

各アクセス・操作ごとに「露出量」を加算する。

```text
exposure += f(classification, operation, scope, transform)
```

- classification：public / internal / confidential / secret
- operation：read / export / write / external_api
- scope：対象サイズ（node数、scope数）
- transform：要約・抽象化の度合い（低いほど危険）

---

## 2. 閾値とトリガー

主体（user / agent）ごとに予算（budget）と閾値を持つ。

```text
if exposure_window > threshold:
    trigger_control()
```

トリガー例：
- 承認要求
- マスキング／サンプリング
- レート低下
- 外部送信禁止
- セッション失効

---

## 3. ウィンドウ（時間）

累積は時間窓で管理する。

```text
exposure_window = sum(exposure over last T minutes)
```

- 短時間の大量アクセスを検知
- 長期的な少量流出も別窓で監視（Tを複数持つ）

---

## 4. 浸透の「増幅」と「減衰」

### 増幅要因（risk up）
- secret × export / external_api
- cross-scope 取得
- rawデータ（非要約）
- 多ノード一括取得

### 減衰要因（risk down）
- 要約（k-anonymity的に圧縮）
- マスキング（PII除去）
- 集計（個票→統計）
- ノイズ付与（必要なら）

```text
exposure *= attenuation_factor
```

---

## 5. 具体ルール例

```text
weights:
  read(public)=0
  read(confidential)=1
  read(secret)=3
  export=+2
  external_api=+4
  cross_scope=+2
  bulk(N nodes)=+log(N)

attenuation:
  summary=0.5
  masked=0.3

thresholds:
  5  → ログ強化
  8  → 承認必須
  10 → 外部送信禁止 + セッション制限
```

---

## 6. agentへの適用

各 agent に **budget** を持たせる。

```text
agent.budget_per_window = 6
agent.max_external_calls = 0 (default)
```

実行前に必ず判定：

```text
if exposure + predicted_exposure > remaining_budget:
    downgrade_or_require_approval()
```

---

## 7. 委任チェーンとの統合

有効予算は**交差（最小）**で決める。

```text
effective_budget =
  min(User, Executive, Manager, Worker)
```

どれかが厳しければ全体も厳しくなる。

---

## 8. 重要な設計ポイント

1. **漏洩は単発ではなく累積で起きる**  
   → スコアを足し上げる

2. **外部送信は別格に重くする**  
   → 一発で閾値近くに

3. **予測で止める**（事前判定）  
   → 実行後ログだけでは遅い

4. **fail-closed**  
   → スコア不明・計算不能は拒否

---

## 9. 最小実装

- exposure スコア（整数で十分）
- 時間窓（例：5分 / 1時間）
- 3段階トリガー（ログ / 承認 / 禁止）
- 外部送信は常に高コスト

---

## 結論

- 「浸透」は**累積スコア＋時間窓＋閾値トリガー**で扱う  
- role や単発判定ではなく、**連続的な露出量の管理**にする  
- これで効率を落とさずに、漏洩の臨界点を制御できる

**User**: <sub>2026-04-11 15:05</sub>

これって線形結合の重みが重要そうだけど、どう調整するべき？

> [!info] Reasoning Summary
> <sub>2026-04-11 15:05</sub>
> 
> 思考時間: 4s

**ChatGPT**: <sub>2026-04-11 15:05</sub>

重要です。  
ただし、**最初から正しい重みを当てる**のではなく、**事故コストに合わせて保守的に初期化し、運用ログで更新する**のが正しいです。

## まず結論

重み調整は次の順でやるべきです。

1. **線形結合をそのまま信じすぎない**
2. **絶対に危険な項目は加点ではなくゲートにする**
3. **残りを重み付きスコアにする**
4. **ログと事例で重みを更新する**
5. **必要なら非線形項を追加する**

---

## 1. まず線形結合だけにしない

たとえば

- external API
- secret へのアクセス
- 権限変更
- cross-scope write
- 大量 export

は、重みを少し大きくするだけでは足りないことがある。

だから最初に、

### ハードゲート
- これを含むなら承認必須
- これを含むなら禁止
- これを含むなら budget を強制消費

を置く。

そのうえで、残りを線形結合で扱う。

つまり

```text
risk = gate_check(action, resource, actor)
if blocked: deny
if approval_required: require_approval
else: score = w · x
```

---

## 2. 重みの初期値は「被害額」で決める

重みは統計的に当てる前に、まず**損失の大きさ**で置く。

たとえば軸が

- 機密度
- 操作種別
- 影響範囲
- 外部送信有無
- 不可逆性
- 自律度

なら、初期値はこういう考え方にする。

### 例
- 外部送信: 最重
- 不可逆 delete: 最重
- secret read: 重い
- cross-scope write: 重い
- confidential read: 中程度
- public read: ほぼ0

つまり、**誤判定したときに一番困るものを重くする**。

---

## 3. 正規化しないと重みが壊れる

各特徴量のスケールが違うと、重みの意味が壊れる。

たとえば

- 機密度: 0,1,2,3
- ノード数: 1〜1000
- scope数: 1〜20

のまま入れると、ノード数が全部を支配する。

だから、

- node数は `log(1+N)`
- scope数も上限制限つき
- 各変数を 0〜1 か 0〜3 に揃える

のように、先にスケールを整える。

---

## 4. 相互作用は最初から少し入れる

線形結合だけだと、

- secret × external_api
- secret × bulk_export
- cross_scope × write

の危険さを十分に表せない。

だから重要な組み合わせだけ、最初から interaction 項にする。

たとえば

```text
risk =
  w1*classification
+ w2*operation
+ w3*scope_size
+ w4*external_api
+ w5*irreversible
+ w6*(classification * external_api)
+ w7*(classification * bulk_export)
```

全部を複雑にする必要はなく、**危険な掛け算だけ追加**すればよい。

---

## 5. 調整方法は「事故」ではなく「ヒヤリ」でやる

本番事故を待って学習するのは遅い。  
だからログを3種類に分ける。

- 実際に拒否して正しかったケース
- 通したが後から危なかったケース
- 承認が多すぎて邪魔だったケース

この3つで重みを直す。

### 調整の原則
- 危ないのに通った → その特徴の重みを上げる
- 安全なのに止めすぎた → その特徴の重みを下げる
- 組み合わせで危ない → interaction を追加する

---

## 6. 最初は学習よりルールベースがよい

今の段階では、機械学習で最適化するより、

- ハードゲート
- 保守的な重み
- 手動チューニング
- 監査ログ

の方がよい。

理由は、目的が予測精度ではなく**安全な制御**だから。

---

## 7. 実務的な更新手順

### Step 1
特徴量を固定する

### Step 2
危険なものに hard gate を置く

### Step 3
残りに保守的な初期重みを置く

### Step 4
運用ログを集める

### Step 5
月1回くらいで重みを見直す

### Step 6
必要なら interaction 項を追加する

---

## 8. 具体的な初期設計の考え方

たとえば初期はこう置ける。

- classification: 3
- operation_write: 2
- operation_delete: 4
- external_api: 5
- cross_scope: 3
- irreversible: 4
- bulk_logN: 1
- autonomy: 2

そして

- `secret && external_api` は承認必須
- `delete && cross_scope` は禁止寄り
- `role/manage_agents` は別ゲート

こうすると、重みだけに依存しなくて済む。

---

## 9. 本質

重み調整の本質は、数式の美しさではない。  
**どの誤判定を絶対に避けたいかを先に決めること**です。

そのため、

- 大事故はゲートで防ぐ
- 中間領域は重みで調整する
- 運用ログで修正する

この順にするべきです。

## 結論

- 重みは重要
- ただし線形結合だけに任せない
- 最初は **被害の大きさ** で保守的に置く
- 危険な組み合わせは interaction か hard gate にする
- 運用ログで段階的に調整する

一番大事なのは、**高リスク操作を「重みの問題」にしないこと**です。

**User**: <sub>2026-04-11 15:08</sub>

実害につながるのって結局TOKENか個人情報の機密情報だけ？

**ChatGPT**: <sub>2026-04-11 15:08</sub>

結論：  
**それだけではない。だが、その2つが最も直接的に被害に繋がる「高優先対象」であるのは事実。**

---

## 1. 直接的な実害（即アウト系）

これはあなたの認識どおり、最優先。

- **認証情報**
  - APIトークン
  - パスワード
  - セッションキー
  - SSH鍵

→ 即乗っ取り・不正実行

- **個人情報（PII）**
  - 名前、住所、連絡先
  - ID情報
  - 行動履歴

→ 法的・信用的ダメージ

---

## 2. 同じくらい危険なもの

見落としやすいが重要。

### (1) 権限構造
- role設定
- access control
- agentのcapability

→ 間接的に全データが取れる

---

### (2) 構造情報（メタ情報）
- 組織構造
- 誰が何をしているか
- どこに何があるか

→ 攻撃の足がかりになる

---

### (3) 未公開コンテンツ
- 研究内容
- 戦略
- 草稿
- 設計図

→ 競争優位の喪失

---

### (4) 外部連携情報
- API接続先
- webhook
- integration設定

→ 別システムへの侵入

---

## 3. 実害のタイプ

被害は3種類に分かれる。

### ① 即時被害
- アカウント乗っ取り
- 不正課金
- データ削除

### ② 遅延被害
- 情報漏洩
- 評判低下
- 法的問題

### ③ 間接被害
- 攻撃の足場提供
- 内部構造の露出

---

## 4. あなたのモデルに落とすと

優先順位はこうなる。

### Tier 1（絶対守る）
- token / credential
- secret PII
- 権限変更系（manage_roles 等）

→ ハードゲート

---

### Tier 2（強く制限）
- confidential data
- 外部送信
- cross-scope access

→ スコア + 承認

---

### Tier 3（通常制御）
- internal data
- 通常read/write

→ スコア制御

---

## 5. 重要な誤解

「個人情報だけ守ればいい」は不十分。

本当に危険なのは：

- **権限を変えられること**
- **tokenを取得されること**
- **外部に送れること**

この3つ。

---

## 6. 設計上の核心

守るべき対象は3カテゴリに分けるとよい。

```text
1. Identity（誰として動けるか）
2. Capability（何ができるか）
3. Data（何を見れるか）
```

このうち

- Identity（token）
- Capability（権限）
- Data（PII / secret）

のどれか1つでも突破されると危険。

---

## 結論

- token と個人情報は最重要だが、それだけでは不十分  
- 同等に重要なのは

  - 権限構造
  - 外部送信経路
  - 未公開情報

- 実害は

  **identity・capability・data のいずれかの破壊から発生する**

一言で言うと：

**「誰として何ができるか」が漏れる方が、データ単体より危険な場合もある。**

**User**: <sub>2026-04-11 15:09</sub>

LLMが自律的にパラメータを調整できると思う？

**ChatGPT**: <sub>2026-04-11 15:09</sub>

結論：  
**限定的にはできるが、完全に任せるべきではない。**

---

## 1. できること

LLMは次の範囲なら有効に使える。

### (1) ログの解釈
- 「危なかった操作」
- 「止めすぎていた操作」

を分類できる

---

### (2) 重み調整の提案
- 「external_api が過小評価されている」
- 「confidential read が過剰に止められている」

のような方向性は出せる

---

### (3) ルール生成
- interaction項の追加案
- 新しい特徴量の提案

---

## 2. できない／危険なこと

### (1) 自動で重みを書き換える
→ 危険

理由：
- 一度の誤判断で安全性が崩壊する
- 攻撃者に誘導される可能性がある

---

### (2) 長期的最適化
- LLMは一貫した目的関数を持たない
- セッション単位で判断がぶれる

---

### (3) adversarial状況への耐性
- 意図的にログを歪めると騙される

---

## 3. 正しい使い方

LLMは「調整者」ではなく**アドバイザ**にする。

```text
LLM:
  analyze(logs)
  → propose changes

System:
  validate
  → human review
  → apply
```

---

## 4. 安全な構成

### (1) LLMは書き込み権限を持たない
- 重みを直接変更できない

---

### (2) 提案は差分として出す

```text
proposal:
  w_external_api: 5 → 7
  add interaction: secret × export
```

---

### (3) 検証層を挟む

- ルールチェック
- テストケース
- シミュレーション

---

### (4) 人間またはポリシー承認

- 自動適用しない

---

## 5. 半自動化は可能

安全にやるならここまで。

- 小さな調整のみ自動許可
- 危険領域は固定

例：

- public系の重み → 自動調整OK
- external_api → 固定 or 手動のみ

---

## 6. より良いアプローチ

完全にLLMに任せるより、

### (1) スコアリングはルールベース
### (2) LLMは異常検知・説明生成
### (3) 最適化は別ロジック（統計 or RL）

の分離がよい

---

## 7. 本質

LLMは

- パターン認識は強い
- 制御系は弱い

---

## 結論

- LLMにパラメータ調整は「提案」させるのは有効
- しかし「自律的に適用」は危険
- 安全な構成は

  **LLM = 提案  
   System = 検証  
   Human/Policy = 承認**

一言で言うと：

**LLMはチューナーではなく、レビューアとして使うべき。**

**User**: <sub>2026-04-11 15:10</sub>

commit logによって、木の空間構造のみならず、時間構造も「発生するのか

**ChatGPT**: <sub>2026-04-11 15:10</sub>

結論：  
**はい。commit log を持つと、木構造に加えて時間構造が「発生する」。ただしそれは副産物ではなく、明示的に設計する必要がある。**

---

## 1. 何が発生するのか

M3Eの現在：

- 主構造：親子ツリー（空間構造）
- 状態：ある時点のスナップショット

commit log を導入すると：

```text
State₀ --cmd₁--> State₁ --cmd₂--> State₂ ...
```

となり、

- 状態の列（時間軸）
- 変化の因果関係

が生まれる

---

## 2. これは「履歴」ではなく「構造」

重要なのはここ。

単なる履歴：

- 過去の記録

commit log：

- **状態遷移のグラフ**

つまり

```text
State graph
```

になる

---

## 3. 木 + 時間で何になるか

```text
Tree (空間)
×
Sequence (時間)
=
Evolution structure
```

具体的には：

- どのノードがいつ生まれたか
- どの構造がどう変化したか
- どの分岐が存在したか

---

## 4. 分岐が発生する

Undo / Redo / 別案を考えると

```text
      State₁
      /   \
State₂   State₂'
```

となる

→ 時間は直線ではなく **DAG（有向非巡回グラフ）**

---

## 5. M3E的な意味

仕様では

- Commandパターン
- Undo/Redo
- 差分管理

が前提になっている fileciteturn0file2

この時点で、

**時間構造を持つポテンシャルは既にある**

---

## 6. 何ができるようになるか

### (1) 思考の進化の追跡
- どの仮説がどう変わったか

---

### (2) 分岐比較
- A案 vs B案

---

### (3) rollback
- 任意時点に戻る

---

### (4) AIとの相互作用
- 過去のコンテクストを再生成
- 差分だけ渡す

---

## 7. 注意点

### (1) 自動では良い構造にならない
ただログを取るだけだと：

- ノイズだらけ
- 意味がない

---

### (2) 粒度が重要

- 細かすぎ → ノイズ
- 粗すぎ → 情報欠落

---

### (3) semanticが必要

```text
move_node
rename_node
merge_nodes
```

のように意味を持つcommandでないと、  
時間構造が解釈できない

---

## 8. 設計としてどうするか

commit log を

**第一級の構造として扱うかどうか**

を決める必要がある

### 軽い設計
- undo用ログ
- 表には出さない

### 強い設計
- 履歴を可視化
- 分岐管理
- 思考進化の対象

---

## 結論

- commit log を導入すると時間構造は自然に生まれる  
- それは単なる履歴ではなく **状態遷移グラフ（DAG）**  
- M3Eでは既にその基盤（Command + Undo）がある  
- ただし意味のある構造にするには

  - commandの意味付け
  - 粒度設計
  - 分岐管理

が必要

一言で言うと：

**木は「思考の形」、commit logは「思考の変化」を表す構造になる。**

**User**: <sub>2026-04-11 15:12</sub>

つまり木構造の推論が出来たら、時空間的な木の構造をとらえて発展も推測できるのか？

**ChatGPT**: <sub>2026-04-11 15:12</sub>

結論：  
**ある程度はできるが、「推測できる」のは限定的。完全な予測にはならない。**

---

## 1. 何が可能になるか

commit log を含めると対象はこうなる：

```text
構造：Tree（空間）
変化：Command列（時間）
```

これを合わせると

```text
State(t) = Tree + History
```

になる

このとき可能なのは：

### (1) 局所的な発展の推測
- よく分割されるノード
- よく移動される構造
- 未完成な部分

→ 次に展開されやすい箇所は推測できる

---

### (2) パターン抽出
- 「このタイプのノードは後で分解される」
- 「この配置は後で再編される」

---

### (3) 分岐の予測
- ここで別案が出やすい
- この構造は分岐しやすい

---

## 2. できないこと

### (1) 内容の正確な予測
- 次に何を書くか
- どのアイデアを選ぶか

→ 不可能

---

### (2) 長期の決定
- どの構造が最終形になるか

→ 不安定すぎる

---

## 3. なぜできるのか（条件）

推測が成立する理由は2つだけ。

### (1) 人間の操作に偏りがある
- 同じ思考パターンを繰り返す

### (2) 構造に「未解決」が現れる
- 深さが不均一
- childrenが偏る
- aliasが多い

---

## 4. モデルとしてはこうなる

```text
P(next_action | tree, history)
```

つまり

- 木構造
- 操作履歴

から次の操作を予測する問題

---

## 5. 重要な制約

### (1) 観測可能な情報しか使えない
- 意図は直接観測できない

---

### (2) 非決定的
同じ構造でも次は変わる

---

## 6. 現実的な使い方

### (1) 補助的推測

- 展開候補の提示
- 再構成提案
- 欠けている視点の提示

---

### (2) 自動ではなく提案

M3Eの前提：

- AIは提案
- 人間が承認 fileciteturn0file2

と一致する

---

## 7. 発展の推測の限界

推測できるのは

- 「どこが動きそうか」
- 「どういう操作が起きそうか」

であって

- 「何が正しいか」
- 「どの結論に至るか」

ではない

---

## 結論

- 木構造 + 時間構造から  
  **思考の発展傾向は推測できる**
- ただしそれは

  - 局所的
  - 確率的
  - 操作レベル

に限られる

一言で言うと：

**未来の内容は読めないが、「次にどこが動くか」はかなり読める。**

