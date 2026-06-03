---
title: "SPReADとARiSEの違い"
created: 2026-04-21 15:32:42
updated: 2026-04-22 23:58:11
tags:
  - chatgpt
  - conversation
---
# SPReADとARiSEの違い

<sub>2026-04-21</sub>

---

**User**: <sub>2026-04-21 15:32</sub>

AI for Scienceの２つのプロジェクト、SPReADとARiSEの違いがわからない 

> [!abstract]- Tool (file_search)
> <sub>2026-04-21 15:32</sub>
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
> <sub>2026-04-21 15:32</sub>
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
> <sub>2026-04-21 15:32</sub>
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
> <sub>2026-04-21 15:32</sub>
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
> <sub>2026-04-21 15:32</sub>
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
> <sub>2026-04-21 15:32</sub>
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
> <sub>2026-04-21 15:32</sub>
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

> [!note]- Internal Reasoning
> <sub>2026-04-21 15:32</sub>
> 
> **科学プロジェクト向けのAI案を調査中**: AIを使った科学プロジェクト名についてのリクエストがありそうなので、最新の情報に基づいて調査を行います。ニッチな分野に関しても調べながら、適切な提案を見つけ出したいと思います。

**ChatGPT (tool execution)**: <sub>2026-04-21 15:32</sub>

```
{"search_query":[{"q":"AI for Science SPReAD ARiSE project site"},{"q":"SPReAD ARiSE AI for Science"},{"q":"ARiSE project AI for Science SPReAD"}],"response_length":"short"}
```

> [!note]- Internal Reasoning
> <sub>2026-04-21 15:32</sub>
> 
> **公式な比較情報を調査中**: 特定の公式な比較情報が必要そうですね。詳細を深堀りして、公式なデータを元に正確な比較を行いたいと思います。それを集めて、最適な答えに繋げます。

**ChatGPT (tool execution)**: <sub>2026-04-21 15:32</sub>

```
{"search_query":[{"q":"site:mext.go.jp AI for Science SPReAD ARiSE 違い"},{"q":"site:jst.go.jp/program/arise SPReAD ARiSE 基本方針"},{"q":"site:mext.go.jp SPReAD 500万円 1000件 ARiSE 戦略ターゲット"}],"response_length":"short"}
```

> [!info] Reasoning Summary
> <sub>2026-04-21 15:33</sub>
> 
> 思考時間: 19s

**ChatGPT**: <sub>2026-04-21 15:32</sub>

違いは、**裾野を広げる小規模多件数の制度がSPReAD**、**重点領域に集中投資する大型の制度がARiSE**、と見るとほぼ整理できます。どちらも文科省の AI for Science 推進の枠組みですが、役割が違います。citeturn286024search4turn251825search1turn251825search4

まず **SPReAD** は、あらゆる分野の研究者が AI を使った研究を試しやすくするための、**萌芽的・探索的研究の支援**です。目的は AI for Science の「波及・振興」で、新しい研究の種や芽を多数生むことです。公募情報では、**1課題あたり500万円以下、約1000件、研究期間はおおむね1年以内**とされています。citeturn251825search0turn286024search0

一方 **ARiSE** は、文科省の戦略方針を先導する**フラグシップ事業**で、我が国の強みを活かせる**戦略ターゲットに集中投資**して、世界を先導する成果や国際連携を狙う制度です。概要資料では、**5領域×3チーム程度、1件あたり約20億円、原則3年**という大規模支援として示されています。さらに、AI基盤モデル、AIエージェント、次世代AI駆動ラボシステムなどを一体的に進めるとされています。citeturn251825search1turn251825search2turn251825search4

かなり雑に言うと、  
**SPReAD = 研究者個人が幅広く試す制度**  
**ARiSE = 国として勝ち筋の領域に大きく張る制度**  
です。citeturn251825search0turn251825search1turn251825search4

補足すると、公開元も少し違って見えます。SPReAD は文科省サイトで公募案内が前面に出ており、ARiSE は JST の事業ページで募集・選考の枠組みが示されています。ただし、どちらも文科省の AI for Science 戦略の中の制度です。citeturn286024search0turn251825search1turn286024search2

1行でまとめるなら、**SPReAD は「広く撒く」制度、ARiSE は「重点的に育てる」制度**です。

**User**: <sub>2026-04-22 20:35</sub>

I want to apply for spread. I want to study mathematics from the perspective of AI. I use AI and my application M3E to study mathematics. I want to use M3E as a core system to store knowledge and strategy for research. 

**ChatGPT**: <sub>2026-04-22 20:35</sub>

方向性は合っているが、そのままだと「ツール開発」に見えて落ちる可能性が高い。SPReADは**AIを使った科学研究**が対象であり、「M3Eを作る」ではなく「M3Eを使って数学研究を進める」に軸を置く必要がある。

構造は次のように整理する。

研究目的  
AIを用いて数学的知識の整理・生成・仮説形成の効率を向上させる。特に、証明探索や概念間関係の理解を対象にする。

研究課題  
AIと構造化知識基盤（M3E）を組み合わせたとき、数学研究の思考過程（問題設定・補題生成・証明構成）がどのように変化し、どこまで自動化・加速できるかを検証する。

方法  
M3Eを「知識構造」と「思考ログ」の基盤として使い、その上でAIを使う。流れは一貫させる。

① 数学対象を限定（例：線形代数・離散数学・初等数論など）  
② 定義・定理・例・反例をノードとして構造化  
③ AIにより以下を行う  
・関連定理の提案  
・補題候補の生成  
・証明方針の生成  
④ 人間が検証し、構造に反映（M3Eに保存）  
⑤ 思考過程をログとして蓄積し分析

評価  
単なる主観ではなく、測定可能な指標を置く。

・問題解決までの時間  
・生成された補題の有効率  
・証明ステップ数の変化  
・人間単独との比較（ベースライン）

新規性  
既存研究は「LLMで証明生成」か「形式証明系（Lean等）」に偏っている。ここでは**非形式的思考過程（仮説・整理・探索）を構造として扱う点**が新規性になる。

重要な修正点  
「M3Eを開発する」は前面に出さない。  
「M3Eを用いて数学研究の方法を検証する」と書く。  
M3Eはあくまで“実験装置”。

危険な書き方  
・アプリ開発が主目的  
・AIツールの便利さ紹介  
・抽象的で評価指標がない  

安全な書き方  
・対象分野が明確  
・検証可能な仮説がある  
・比較対象がある  

短くまとめると、  
「AI＋構造化知識基盤を用いた数学研究プロセスの検証」  
という形に落とすのが通りやすい。

**User**: <sub>2026-04-22 20:40</sub>

I think there are significant gaps between mechanical proofs and actual research frameworks. We have to bridge them with my application. It's not just an application but a user harness for LLM to effectively research new branches of mathematics with accuracy and efficiency. It has not just been done just by LLM and profile assistance. Proof assistance is rapidly evolving, but it cannot handle ideas and research strategy. M3E unites the ideas, proofs, and research strategy ideas in the common layout. Also, the current LLM is for general use, so it cannot be specialized to mathematics study. It takes many costs for learning. So I want to make an efficient way to study mathematics. Without that, we cannot grow more than chatting with AI. My tool is agent framework for actively evolving the branches of mathematics. 

**ChatGPT**: <sub>2026-04-22 20:40</sub>

主張の方向は明確だが、そのままだと「構想説明」で終わる。SPReADでは**検証可能な研究計画**に落とす必要がある。以下の形に再構成すれば通りやすい。

---

研究の核心  
現在のギャップは次の2点に分解できる。  
(1) 形式証明系は正確だが探索や発想を扱えない  
(2) LLMは発想や提案はできるが検証と蓄積が弱い  

この間に「研究プロセス層」が欠けている。  
あなたの提案はここを埋めるものとして定義する。

---

研究仮説  
「構造化された思考基盤（M3E）とLLMを統合すると、数学研究における仮説生成・証明方針探索・知識再利用の効率と精度が向上する」

---

システムの位置づけ  
M3Eはアプリではなく**研究プロセスの統合基盤**と定義する。

役割を分離すると明確になる。  

LLM：  
・仮説候補生成  
・証明方針提案  

M3E：  
・定義・定理・証明の構造化  
・思考過程の保存  
・研究戦略の明示化  

人間：  
・検証  
・選択  

---

研究方法  
「何をやるか」を具体化する。

対象領域を限定する（例：初等数論または組合せ論）。  

その上で以下を繰り返す。  

① 問題を設定  
② M3E上で既存知識を構造化  
③ LLMにより  
　・関連定理  
　・補題候補  
　・証明方針  
　を生成  
④ 人間が検証し採用  
⑤ M3Eに記録  
⑥ 次の問題へ展開  

---

評価設計  
ここが最重要。

比較対象を必ず置く。  

A：従来（人間＋通常のLLM対話）  
B：提案手法（M3E＋LLM）  

評価指標は定量にする。  

・問題解決までの時間  
・有効な補題生成率  
・誤り率（後から修正された割合）  
・再利用された知識の割合  

---

新規性の言い方  
重要なのはここ。

既存：  
・LLMによる証明生成  
・形式証明支援（Lean等）  

不足：  
・研究戦略  
・仮説探索  
・知識の構造的蓄積  

提案：  
「研究プロセス全体（発想・構造・検証）を統合する基盤」  

---

危険な主張（削る）  
・「新しい数学分野を作る」  
・「AIが研究を主導する」  

これらは過大評価に見える。

---

通る形の一文  
「本研究は、LLMの生成能力と構造化知識基盤を統合し、数学研究における仮説生成・証明方針探索・知識再利用のプロセスを定量的に検証する」

---

要点  
・目的は“数学研究の方法の検証”  
・M3Eは“手段”  
・評価は“比較実験”  

この形に落とせば、主張はそのまま保ちつつ制度に適合する。

**User**: <sub>2026-04-22 20:41</sub>

萌芽的・探索的研究
とある。What amount of effectiveness and hope for　実現可能性? 

**ChatGPT**: <sub>2026-04-22 20:41</sub>

公募趣旨と評価観点を確認して、どの程度の有効性と実現可能性が求められるかを整理します。公式文書ベースで答えます。

**ChatGPT (tool execution)**: <sub>2026-04-22 20:41</sub>

```
{"search_query":[{"q":"MEXT AI for Science SPReAD 公募 評価項目 萌芽的 探索的研究 実現可能性 有効性 2026","domains":["mext.go.jp"]},{"q":"site:mext.go.jp AI for Science SPReAD 公募要領 評価基準 2026","domains":["mext.go.jp"]},{"q":"site:mext.go.jp AI for Science SPReAD flyer 評価 研究計画 2026","domains":["mext.go.jp"]}],"response_length":"short"}
```

**ChatGPT (tool execution)**: <sub>2026-04-22 20:41</sub>

```
{"open":[{"ref_id":"turn523796search4"}],"response_length":"short"}
```

**ChatGPT (tool execution)**: <sub>2026-04-22 20:42</sub>

```
{"click":[{"ref_id":"turn636780view0","id":28}],"response_length":"short"}
```

**ChatGPT (tool execution)**: <sub>2026-04-22 20:42</sub>

```
{"click":[{"ref_id":"turn784188view0","id":3}],"response_length":"short"}
```

**ChatGPT (tool execution)**: <sub>2026-04-22 20:42</sub>

```
{"open":[{"ref_id":"https://mext.ent.box.com/s/ty4p0j0fqs6a8tbymhd0cum3j8n0w3oa"}],"response_length":"short"}
```

**ChatGPT (tool execution)**: <sub>2026-04-22 20:42</sub>

```
{"click":[{"ref_id":"turn674505view0","id":2}],"response_length":"short"}
```

**ChatGPT (tool execution)**: <sub>2026-04-22 20:42</sub>

```
{"search_query":[{"q":"site:mext.ent.box.com SPReAD 公募要領 PDF"},{"q":"site:mext.go.jp/aifors_spread SPReAD 公募要領 評価項目"},{"q":"令和8年度 AI for Science萌芽的挑戦研究創出事業 SPReAD 公募要領 PDF"}],"response_length":"short"}
```

> [!info] Reasoning Summary
> <sub>2026-04-22 20:42</sub>
> 
> 思考時間: 53s

**ChatGPT**: <sub>2026-04-22 20:42</sub>

ここでいう「萌芽的・探索的研究」は、**完成度の高い確実案件**を求めているというより、**短期間・小規模でも、新しい芽が出るかを見たい**という意味に近いです。公式には、SPReADは「あらゆる分野の研究者等がAIを利活用して科学研究の高度化・加速化を図る」ことで、「新たな研究の種や芽を創出する」ことを目指す事業とされ、さらに「萌芽的・探索的な研究を機動的に支援」すると明記されています。citeturn784188view0turn674505view0

したがって、求められる有効性は、**最終成果の大きさそのもの**より、**AIを入れることで研究の進め方が実際に前進することを示せるか**です。SPReADの公式例も、完成した大発見ではなく、追加学習による予測精度向上、AIシミュレーション、実験ログの統一・自動化、注釈付きデータ整備など、研究基盤や研究プロセスの改善を含んでいます。つまり、あなたの案でも「数学の大定理を証明する」まで要らず、**数学研究の仮説生成・証明方針探索・知識再利用がどれだけ改善するか**を示せれば十分に筋が通ります。citeturn674505view0

一方で、実現可能性は必要です。ただし、その意味は**大規模完成の実現可能性**ではなく、**この予算と期間で、検証可能な最小実証まで持っていけるか**です。SPReADは1課題あたり直接経費500万円以下、研究期間は第1回公募で交付決定日から2027年1月6日までの短期です。しかも対象は研究代表者個人で行う研究計画です。したがって審査側は、壮大な長期構想より、**短期間で回る実験設計**を重視すると考えるのが自然です。citeturn674505view0

あなたの案に引きつけて言うと、通りやすい水準は次です。**希望は大きくてよいが、検証単位は小さく切る**。つまり、「M3Eで数学全体を変える」ではなく、**特定の数学分野で、M3E＋LLMが通常のAIチャットより有効かを示す**形にするべきです。たとえば、初等数論や組合せ論など一つの分野に限定し、定義・定理・補題候補・証明方針を構造化したときに、通常の対話型LLMよりも、問題到達時間、補題の有効率、再利用率、誤り修正回数が改善するかを検証する、という形です。これはSPReADの「柔軟かつ独創的な発想に基づく提案を期待する」という趣旨には合いながら、短期実証にも収まります。citeturn674505view0

逆に危ないのは、**希望が大きすぎるのに、年度内で何を示すかが曖昧な案**です。SPReADは「独創的研究の芽出し支援」を掲げており、小規模でも将来的な波及効果を持つ試行を支援するとしていますが、その説明でも「創出と実証」を支援すると書かれています。つまり、アイデアだけでは弱く、**最低限の実証**は必要です。citeturn674505view0

結論だけ言うと、SPReADで求められるのは、**有効性は“研究を前に進める具体的改善が見えること”、実現可能性は“単年度・個人規模でその改善を実証できること”**です。あなたの案は、数学研究の大構想をそのまま出すより、**M3Eを研究プロセス層の実験装置として位置づけ、限定領域で比較実験する計画**にすると、萌芽的・探索的研究としてかなり自然になります。

**User**: <sub>2026-04-22 20:45</sub>

I have implemented many programs for calculating invariance of topologies and framework for handling topology with combinatorics. It works as test for the statement and we can deduce new theorems by the calculation. And AI is very convenient, good at implementing program and I'm very confident about accelerating the study of this field by 10 times speed. 

**ChatGPT**: <sub>2026-04-22 20:45</sub>

主張の核は強いが、そのままだと「能力アピール」と「過大主張」に見える。SPReADでは、**既存成果を土台にした検証計画**として整理する必要がある。

---

位置づけの整理  
あなたの強みはすでにある。  
・位相不変量の計算プログラム  
・組合せ的に位相を扱う枠組み  
これは**研究基盤（既に動くもの）**として使うべきで、「これから作る」ではない。

---

研究の骨格  
主張は次の形に変える。

「既存の計算基盤に対し、LLMと構造化知識基盤（M3E）を統合することで、定理探索・仮説生成・検証のサイクルを加速できるかを検証する」

---

重要な変換  
「10倍速い」はそのまま書かない。  
代わりに**測定可能な形に分解する**。

例としては以下。

・仮説生成から反例検出までの時間  
・有効な命題（後に成立した命題）の割合  
・探索された候補数  
・既存結果の再発見速度  

これで「加速」を定義する。

---

あなたの既存システムの役割  
役割を明確に分けると通る。

計算系（既存プログラム）：  
・命題の検証  
・反例探索  
・不変量計算  

LLM：  
・命題候補生成  
・構造の一般化提案  

M3E：  
・命題・定理・証明・失敗例の構造化  
・探索履歴の保持  
・再利用可能な知識基盤  

---

研究フロー（そのまま書ける形）

① 小規模な位相対象（例：有限複体など）を設定  
② 計算系で不変量を列挙  
③ LLMにより命題候補を生成  
④ 計算系で検証（成立 or 反例）  
⑤ 結果をM3Eに蓄積  
⑥ 蓄積構造を使って次の仮説生成  

---

新規性の出し方  
ここが重要。

既存：  
・計算的探索（単体）  
・LLMによる生成（単体）  

提案：  
「生成（LLM）＋検証（計算）＋構造蓄積（M3E）を一体化した探索ループ」

---

実現可能性の出し方  
ここで評価される。

・既に計算基盤がある → 強い  
・対象を有限構造に限定 → 実験可能  
・ループを回すだけ → 実装コスト低い  

つまり  
「新規開発は統合部分のみ」  
と書く。

---

危険な表現  
・「新しい定理を量産する」  
・「10倍速い」  
・「数学研究を変える」  

これらは削る。

---

安全な表現  
「探索効率の改善を定量的に評価する」  
「仮説生成と検証のループを自動化する」  

---

まとめ  
あなたの提案の本質はすでに十分強い。  
通すために必要なのは、

・既存資産を「完成済み基盤」として置く  
・加速を「測定可能な指標」に変換する  
・統合ループを「実験計画」として書く  

これだけ。

**User**: <sub>2026-04-22 20:47</sub>

夏休みかけて(2か月)MATLABプログラムを作った。AIでたった2日で、プログラムの技術負債を解消した上にJuliaに翻訳してテスト通過した。これはかなりの進歩である。最新の研究はとても手では計算できないが、計算しないと直感が働かず、伸び悩むところを打破できる。

**ChatGPT**: <sub>2026-04-22 20:47</sub>

内容自体は強いが、そのままだと「体験談」に見える。申請では**再現可能な改善として書き直す必要がある**。

---

事実の位置づけ  
あなたが示しているのは次の2点。

・AIにより既存コードの再構築（MATLAB→Julia、技術負債解消）  
・計算可能性の拡張により直感形成が加速  

これは**予備結果（preliminary result）**として使える。

---

書き換え方  
経験をそのまま書かず、一般化する。

「既存の数値計算コード（MATLAB）に対し、LLMを用いたリファクタリングおよび言語移植（Julia）を行い、短期間で動作検証まで完了した。この結果、従来は人手で数ヶ月を要した実装・最適化工程を大幅に短縮できることを確認した。」

ここで「2日」「2か月」はそのまま出してもよいが、**誇張せず比較として出す**。

---

研究への接続  
次に、この結果を研究計画に接続する。

「これにより、大規模計算を前提とする位相的不変量の探索において、計算環境の構築コストが大幅に低減され、仮説生成と検証の反復を高速に回すことが可能となる。」

---

本質の主張  
重要なのはここ。

あなたの主張は「速くなった」ではなく、  

「これまで計算コストの制約で探索できなかった領域に入れる」  

に変える。

---

SPReAD向けの意味づけ  
制度に合わせて言い換える。

・AIが“研究支援ツール”として機能している  
・研究プロセス（実装→検証）のボトルネックを解消している  

つまり  
「研究の進め方が変わる」ことを示す。

---

危険な書き方  
・「AIですごく速くなった」  
・「直感が働くようになった」  

これらは主観に見える。

---

安全な書き方  
・「計算規模の拡張が可能になった」  
・「仮説検証ループの回転速度が向上した」  

---

まとめ  
このエピソードは使えるが、役割は限定する。

・主張の根拠ではなく  
・「実現可能性を裏付ける予備結果」  

として置く。

これにより、「この人は実際に回せる」と評価される。

**User**: <sub>2026-04-22 20:48</sub>

改行少ない文章で書いてくれ。
予算について決めたい。塩梅がわからない。AIに分野体系を学習させるとそれなりの推論費用が必要である。

**ChatGPT**: <sub>2026-04-22 20:48</sub>

予算上限と使い方の考え方を確認して、現実的な置き方に落とします。研究内容に合わせて、通りやすい配分にします。

**ChatGPT (tool execution)**: <sub>2026-04-22 20:48</sub>

```
{"search_query":[{"q":"SPReAD 公募要領 直接経費 500万円以下 費目 2026","domains":["mext.go.jp"]},{"q":"SPReAD FAQ AI for Science 予算 費目 クラウド 利用料 2026","domains":["mext.go.jp"]},{"q":"文部科学省 SPReAD 公募要領 PDF 2026 AI for Science","domains":["mext.go.jp"]}],"response_length":"short"}
```

> [!info] Reasoning Summary
> <sub>2026-04-22 20:49</sub>
> 
> 思考時間: 19s

**ChatGPT**: <sub>2026-04-22 20:48</sub>

塩梅としては、**最初から上限近くを無理に積まず、200万〜350万円程度で「短期に回る最小実証」を組む**のが自然です。SPReAD系の個人支援は直接経費500万円以下で、しかも事業全体としては短期完了が前提なので、審査側は壮大な基盤整備より、**この期間で確実に検証できる設計**を見ます。計算資源についても、研究費で必要な計算資源の確保は想定されており、外部調達も候補に入っています。citeturn325145search5turn325145search2

あなたの案では、予算の中心を「AIに数学を学習させる費用」と書くより、**研究ループを回すための計算資源・実験資源**として書いた方が通しやすいです。つまり、「分野体系の埋め込み」「知識構造化」「仮説生成」「コード生成・検証」「ログ保存」の一連の実験に必要なクラウド推論費、計算機利用料、データ整備補助、必要最小限の人件費という整理です。SPReADは研究の種や芽の創出と、AIによる研究高度化・加速を狙う制度なので、研究プロセス改善に直結する費目として説明できれば不自然ではありません。citeturn325145search5turn325145search2

実務上は、まず予算を4つに割ると考えやすいです。**AI・計算資源 40〜55%、人件費 25〜40%、設備やソフト 5〜15%、旅費・その他 5〜15%**です。あなたのテーマは装置購入型ではないので、中心はどう見てもAI・計算資源です。ただし、そこを80%以上にすると、「本当にそこまで使うのか」「研究計画がAPI利用に依存しすぎていないか」と見られやすいです。逆に30%未満だと、AI for Scienceとしての説得力が弱まります。これは制度文言そのものではなく、申請書の見え方としての実務判断です。

推奨は3案あります。**小さめ案は220万円前後**で、AI・計算資源100万、人件費80万、雑費40万です。これは「まず成立性を示す」型です。**標準案は300万円前後**で、AI・計算資源140万、人件費110万、ソフト・旅費等50万です。いちばん書きやすいです。**強気案は420万円前後**で、AI・計算資源220万、人件費140万、その他60万です。これは複数モデル比較や大きめの推論実験をやるときです。上限500万円に張るのは、外部計算資源や外注整備をかなり明確に書けるときだけでよいです。citeturn325145search5turn325145search2

あなたの場合は、まず**300万円前後**を基準にするのがよいです。理由は、すでに計算基盤とM3Eの原型があり、ゼロから巨大開発をする計画ではないからです。申請上は「既存の位相不変量計算プログラムとM3Eを基盤とし、AIによる仮説生成・コード整備・構造化知識再利用の統合実験を行う。そのために、推論API利用料、計算資源利用料、検証補助、研究補助を計上する」と書けば十分です。

「AIに分野体系を学習させるので高い」とは書かない方がよいです。今のLLMは、事前学習を研究費で行う話ではなく、普通は**既存モデルを使って、必要部分を構造化して渡す**方が現実的だからです。あなたの主張とも整合します。つまり費用の本質は「モデル訓練費」ではなく、**M3E上で整理した数学知識を使った反復的推論・検証コスト**です。ここを明確にすると、予算の説得力が上がります。

申請書の言い方としては、次の形が安全です。  
「本研究では、数学知識の構造化、仮説生成、コード生成・検証を反復するため、生成AIのAPI利用料および関連計算資源利用料を主要経費として計上する。既存基盤を活用するため、大規模な新規開発費は要さず、短期間で実証可能な範囲に予算を集中させる。」

金額感だけ結論を言うと、**AI・計算資源 120万〜180万円、人件費 80万〜120万円、その他 30万〜60万円、合計 250万〜350万円**がいちばん自然です。

**User**: <sub>2026-04-22 20:51</sub>

人件費いるか？俺に給料くれって言ってるような感じになりそう。
数学だ。
短期(どれくらい？）の目標設定も明確にする必要があるな

**ChatGPT**: <sub>2026-04-22 20:51</sub>

人件費は必須ではない。個人研究であれば**人件費ゼロでも問題ない**し、その方が自然に見える場合も多い。特に今回のように「既存基盤があり、自分で回せる」タイプなら、無理に入れる必要はない。入れる場合は自分の給料ではなく、**単純作業（データ整形、ログ整理、検証補助）を外注する場合のみ**に限定するのが安全。迷うなら**人件費なしで出す方が一貫性がある**。

その分、予算はシンプルにする。  
「AI・計算資源」と「雑費（ソフト、クラウド、最小限の旅費）」の2本でよい。  
この場合は**200万〜300万円**が自然なラインになる。

---

短期の意味は制度的には**約半年〜1年未満**だが、実際の評価は「3ヶ月〜6ヶ月で何が出るか」で見られる。したがって、内部設計としては**3ヶ月で1回成果が出る設計**にするのがよい。

---

目標設定は3段階に切る。

第1段階（0〜2ヶ月）  
既存の位相不変量計算コードとM3Eを統合し、  
「命題生成 → 計算検証 → 構造保存」のループを動かす。  
ここでは性能ではなく**動くこと**が目標。

第2段階（2〜4ヶ月）  
LLMを入れて仮説生成を自動化し、  
・候補命題の生成  
・反例検出  
のサイクルを回す。  
ここで**比較実験（通常LLM vs M3E統合）**を開始。

第3段階（4〜6ヶ月）  
評価を出す。  
・探索速度  
・有効命題率  
・再利用率  
を測定して、「改善があるか」を示す。

---

書き方としてはこうなる。

「本研究では、6ヶ月以内に、位相的不変量に関する命題探索において、LLM単独利用と比較し、構造化知識基盤（M3E）を用いた統合手法の有効性を定量的に検証する。」

---

重要なのは、  
「何かを完成させる」ではなく  
「改善があるかを示す」  
にすること。

---

まとめると、  
・人件費は不要（むしろ無い方が自然）  
・期間は6ヶ月想定で設計  
・3ヶ月で一度回る構造にする  

これで「短期・探索的」に完全に一致する。

**User**: <sub>2026-04-22 20:52</sub>

知識基盤の構築なら、俺の見立てでは3か月でできる。半年とそれなりの推論費用与えられたらかなり世界にインパクトをもたらせると確信する。

**ChatGPT**: <sub>2026-04-22 20:52</sub>

感触は正しいが、そのまま書くと通りにくい。「確信」「世界にインパクト」は削って、**3か月で何が完成し、6か月で何を検証するか**に分解する。

まず前半を成果として固定する。「3か月で知識基盤を構築」はそのまま使えるが、内容を具体化する。  
「位相的不変量計算系と連携した構造化知識基盤（M3E）を構築し、命題・計算結果・反例・証明方針を統一形式で記録・参照できる状態を実現する」と書く。ここでは性能や成果ではなく**再現可能な状態の構築**をゴールにする。

後半は検証にする。「半年でインパクト」ではなく、  
「残り期間で、当該

**User**: <sub>2026-04-22 20:52</sub>

先にちょっと論理を整理したい。書くベースではなく

**ChatGPT**: <sub>2026-04-22 20:52</sub>

整理は次の3層に分けると崩れない。

第一に問題設定。  
現在の数学研究は「発想（仮説）」「検証（証明・計算）」「蓄積（知識）」が分断されている。形式証明は検証に強いが発想を扱えず、LLMは発想を出せるが検証と蓄積が弱い。さらに計算は存在しても研究プロセスに統合されていない。この分断がボトルネック。

第二に手段。  
あなたの構成は3要素の統合。  
LLMは仮説生成、計算系は検証、M3Eは構造化と蓄積。重要なのは単体性能ではなく、**仮説→検証→蓄積→再利用**のループが閉じること。このループが回ると、探索が累積的になる。

第三に効果。  
主張すべき効果は「速度」ではなく「探索空間の拡張と再利用性」。  
・計算があることで直感が得られる（探索可能領域が広がる）  
・構造化により過去の試行が再利用される（同じ探索を繰り返さない）  
・LLMにより仮説生成の初期コストが下がる  

結果として、研究プロセスが**単発探索から反復的探索に変わる**。

ここで重要なのは因果関係。  
LLM単体では誤りが蓄積する。  
計算単体では探索が局所的になる。  
人間単体ではスケールしない。  
→この3つを統合するとループが成立する、という構造。

最後に境界を明確にする。  
やることは「定理を自動生成すること」ではない。  
やることは「研究プロセスのループを成立させ、その効率を測ること」。  

この整理がそのまま研究の骨格になる。

**User**: <sub>2026-04-22 20:54</sub>

俺はChatGPT pro API, Deep seek APIなどで学習を進めていくつもりで、ほぼそれの費用かなと思ったが。どうだ？

**ChatGPT**: <sub>2026-04-22 20:54</sub>

API費用中心で組む考え方自体はありです。まず、研究費として説明しやすい形に直せるかと、実際の料金感を確認します。

**ChatGPT (tool execution)**: <sub>2026-04-22 20:54</sub>

```
{"search_query":[{"q":"OpenAI API pricing official 2026 ChatGPT Pro API pricing official","domains":["openai.com"]},{"q":"DeepSeek API pricing official 2026","domains":["deepseek.com"]}],"response_length":"short"}
```

**ChatGPT (tool execution)**: <sub>2026-04-22 20:54</sub>

```
{"open":[{"ref_id":"turn607870search1"},{"ref_id":"turn607870search0"},{"ref_id":"turn607870search10"}],"response_length":"short"}
```

> [!info] Reasoning Summary
> <sub>2026-04-22 20:54</sub>
> 
> 思考時間: 27s

**ChatGPT**: <sub>2026-04-22 20:54</sub>

その考え方自体は自然です。今回の研究なら、費用の中心を**API利用料・計算資源利用料**に置くのは十分ありです。ただし、申請書では「AIに分野体系を学習させる費用」と書くより、**数学知識の構造化、仮説生成、コード生成、検証を反復するための生成AI利用料**と書いた方が通りやすいです。OpenAIもChatGPTの有料プラン料金とAPI料金は別だと明記しており、DeepSeekもAPIを従量課金で提供しています。citeturn607870search4turn449119view0

一点だけ重要で、**ChatGPT ProはAPIではありません**。ChatGPTの月額プランとAPI課金は別建てなので、研究費として置くなら「ChatGPT Pro代」より「OpenAI API利用料」として整理する方が正確です。OpenAIの料金ページでも、ChatGPTの有料プランは月額、APIは別の従量課金として案内されています。citeturn607870search6turn607870search8turn607870search4

今の相場感でいうと、OpenAI APIはたとえばGPT-5.4 miniが入力$0.75/100万トークン、出力$4.50/100万トークン、GPT-5.4が入力$2.50/100万トークン、出力$15.00/100万トークンです。DeepSeek APIは `deepseek-chat` / `deepseek-reasoner` が、入力キャッシュミス$0.28/100万トークン、キャッシュヒット$0.028/100万トークン、出力$0.42/100万トークンです。価格だけ見ると、日常の大量試行はDeepSeekがかなり安く、OpenAIは高品質な要所に絞る設計が現実的です。citeturn449119view1turn449119view0

したがって、研究設計としては、**普段の大量探索はDeepSeek、重要局面の高精度推論や比較評価だけOpenAI**が一番きれいです。さらにOpenAIにはBatch APIで入出力コストを50%下げる仕組みがあるので、知識基盤の一括整形や既存ログの再処理はバッチに回す設計が合理的です。citeturn449119view1

予算感としては、6か月の萌芽研究なら、API中心でもまずは**50万〜150万円程度**を主要枠に置くのが自然です。かなり使う設計でも、DeepSeek中心なら相当回せますし、OpenAIを混ぜても「高価なモデルを全件に使う」のでなければ、いきなり数百万円をAPIだけで消化する計画にはなりにくいです。むしろ審査上は、**既存基盤を活用し、必要な推論に計算資源を集中する**という説明の方が強いです。これは料金水準から見ても妥当です。citeturn449119view1turn449119view0

論理としてはこうです。あなたの研究の核は「モデルを育てること」ではなく、**M3E上に整理した数学知識を用いて、仮説生成と検証のループを回すこと**です。だから費用は学習コストではなく、**反復推論コスト**です。この整理にすると、短期目標とも整合します。3か月で知識基盤構築、残り3か月で統合ループの比較実験、という形です。

結論として、**費用の中心がOpenAI APIとDeepSeek APIであること自体はおかしくない**です。ただし、書き方は「AIに学習させる費用」ではなく、「数学研究の仮説生成・検証・知識構造化を反復するための生成AI利用料」に直した方がよいです。また、実務上は**DeepSeekを主力、OpenAIを要所**にした方が、予算説明も運用も安定します。

**User**: <sub>2026-04-22 20:56</sub>

食わせる情報も問題だ。pdfを中心に考えているが、少なくとも俺の研究で出くわすpdf全部食わせたい。ただ、pdfを購入する、という行為があまり無い。(著作権保護などのため）

**ChatGPT**: <sub>2026-04-22 20:56</sub>

論点は「どのPDFをどう扱うか」であって、「全部食わせるか」ではない。研究費的にも法的にも、**入力源を整理して設計する必要がある**。

まず原則。  
研究で使う資料は3種類に分ける。

① 自分の生成物  
ノート、証明、コード、計算ログ。これは自由に使える。ここが最重要で、M3Eの中核になる。

② 公開されている資料  
arXivなどのオープンアクセス論文。これは問題ない。PDFでもテキスト抽出して使える。

③ 制限付き資料  
出版社の論文PDFなど。ここは注意が必要。APIにそのまま大量投入する前提で書くと危険に見える。

---

設計としてはこうする。

「PDFを丸ごと学習させる」のではなく、  
**必要な部分を抽出して構造化する**。

具体的には、  
・定義  
・定理  
・補題  
・証明の骨子  
だけを取り出してM3Eに入れる。

これなら  
・トークンコストが減る  
・著作権リスクも下がる  
・再利用性が上がる  

---

申請上の書き方は重要。

危険な書き方：  
「論文PDFを大量にAIに入力する」  

安全な書き方：  
「公開論文および既存資料から、数学的知識（定義・定理等）を抽出し、構造化知識基盤として整理する」

---

さらに重要な点。  
あなたの研究の価値は「知識量」ではない。

・どの知識を  
・どの構造で  
・どう再利用するか  

ここにある。

だから「全部食わせる」はむしろ逆効果で、  
**必要な構造だけを抽出する方が研究として強い**。

---

費用との関係。  
PDFを全部入れる設計だと、  
・トークンコストが爆発  
・処理設計が曖昧  
になる。

構造抽出にすれば、  
・API費用は抑えられる  
・実験設計が明確になる  

---

まとめると、  
・PDFはそのまま投入しない  
・抽出して構造化する  
・公開資料中心で組む  
・M3Eに入るのは「知識」であって「PDF」ではない  

この整理にすると、技術・費用・制度の全部が揃う。

**User**: <sub>2026-04-22 20:57</sub>

いきなり研究には行き着けない。体系的な知識のもとで成立する。それは人間でも同じだ。しかし、本のpdfがないと情報を食わせられない。ここが今戦略としてネックだ。どうする？

**ChatGPT**: <sub>2026-04-22 20:57</sub>

ネックは「PDFがない」ではなく、**知識取得の単位をPDFに依存していること**。ここを外せば解決する。

まず前提。数学の体系は「文書」ではなく、**定義・定理・関係の集合**で成立する。だから入力もその単位に揃えるべきで、PDFを丸ごと持つ必要はない。

戦略は3段階に分ける。

第一段階：公開ソース中心で骨格を作る。  
arXiv、講義ノート、Wikipedia、オープン教科書で十分に基礎体系は作れる。ここから  
・定義  
・基本定理  
・典型例  
を抽出してM3Eに入れる。これで「体系の骨格」ができる。

第二段階：自分の研究から知識を増やす。  
あなたはすでに計算系を持っているので、  
・計算結果  
・反例  
・成立した命題  
を直接M3Eに入れられる。これは既存PDFより価値が高い一次データになる。ここが他の研究と違う強み。

第三段階：必要な箇所だけ補う。  
市販本や有料論文は「全部入れる」のではなく、  
必要な定義や定理だけを人間が抽出して構造化する。  
全文を機械に流す必要はない。

---

重要な転換。  
「AIに本を読ませる」ではなく、  
**「人間が構造を作り、AIはその上で推論する」**。

これにすると、  
・著作権問題を避けられる  
・トークンコストが減る  
・精度が上がる  

---

さらに実務的な解決。  
PDFがどうしても必要な場合でも、丸ごとではなく  
・章単位  
・定理単位  
で分割して扱う。  
そのうえで要約・構造化して保存する。

---

結論。  
問題は資料量ではなく、**入力形式の設計**。  
PDFを集める戦略から、  
「定義・定理・関係を抽出して蓄積する戦略」に切り替える。  

これでボトルネックは消える。

**User**: <sub>2026-04-22 20:58</sub>

本を収集して、読み取って、非公開でデータを推論に用いるのってどうなん？

**ChatGPT**: <sub>2026-04-22 20:58</sub>

法的に変わりやすい論点なので、現行の公的情報ベースで確認します。私人の研究利用と、AI推論への投入でどこまで許されるかを切り分けます。

**ChatGPT (tool execution)**: <sub>2026-04-22 20:58</sub>

```
{"search_query":[{"q":"日本 著作権 AI 学習 30条の4 研究 利用 書籍 PDF 私的利用 2026","domains":["bunka.go.jp"]},{"q":"文化庁 AIと著作権 30条の4 解析 書籍 PDF 研究","domains":["bunka.go.jp"]},{"q":"AI and Copyright Japan Agency for Cultural Affairs 30-4 analysis copyrighted works AI training","domains":["bunka.go.jp"]}],"response_length":"short"}
```

> [!note]- Internal Reasoning
> <sub>2026-04-22 20:58</sub>
> 
> **検討しているプライベートコピーの使用について**: 答えは慎重にする必要がありそうです。契約条件やライセンスが制限をかけている可能性もあるし、第三者API送信がアップロードや機密性に関わることも考えられます。購入したPDFを非営利的に解析する目的で使用する場合、プライベートコピーとして許可されることもあります。ただし、出力やコンテンツ利用には制限があるかもしれません。

**ChatGPT (tool execution)**: <sub>2026-04-22 20:58</sub>

```
{"search_query":[{"q":"文化庁 私的使用 書籍 スキャン PDF 30条 研究","domains":["bunka.go.jp"]},{"q":"日本 書籍 自炊 私的使用 著作権 文化庁","domains":["bunka.go.jp"]},{"q":"書籍 PDF スキャン 私的使用 著作権 日本 文化庁"}],"response_length":"short"}
```

> [!info] Reasoning Summary
> <sub>2026-04-22 20:58</sub>
> 
> 思考時間: 35s

**ChatGPT**: <sub>2026-04-22 20:58</sub>

完全に黒とも白とも言い切れませんが、日本法ベースでかなり大事なのは、**目的が「読むこと」か「情報解析」か**です。文化庁の整理では、著作権法30条の4により、著作物に表現された思想・感情を自ら享受し又は他人に享受させることを目的としない利用、典型的には**AI学習データとしての収集や情報解析**は、原則として許諾なく可能とされています。ただし、権利者の利益を不当に害する場合は別です。citeturn619508search1turn619508search4turn619508search5

なので、**本を集めて、非公開で、研究用の解析データとして使う**という発想自体は、日本では一定の余地があります。特に、書籍の全文をそのまま人に読ませるのでなく、定義・定理・語彙・関係を抽出して比較・分類・検索・推論に使うなら、30条の4の「情報解析」にかなり近いです。citeturn619508search1turn619508search3turn619508search5

ただし、ここで危ない線があります。文化庁の整理では、**RAGなどで入力した著作物の創作的表現をそのまま、又は一部でも出力させることを狙う使い方**や、類似表現を意図的に出させるような追加学習は、30条の4の外に出やすいとされています。つまり、「内部で解析する」は比較的安全でも、「本の記述をそのまま答えさせる」「章の説明を再現させる」は危険です。citeturn619508search2turn619508search4

さらに、**私的使用のための複製**で整理するのは弱いです。文化庁系の説明では、私的使用は個人や家庭内など限られた範囲の利用が中心で、業務用利用は原則そこに乗りません。研究でも、少なくとも「単に自分用だから私的使用」とは言いにくいです。今回の論点は30条ではなく、むしろ30条の4の情報解析で考える方が筋です。citeturn142963search3turn142963search4

もう一つ重要なのは、**著作権法上できることと、契約上できることは別**という点です。電子書籍や有料PDFは、利用規約や契約でダウンロード、変換、外部送信、機械処理を制限していることがあります。著作権法上の余地があっても、契約違反は別問題です。文化庁の文書自体も、個別事例の最終判断は具体的事情によるとしており、確定的評価ではないとしています。citeturn619508search4turn142963search5

実務的には、次の線で設計するのが安全です。**公開論文や自分のノートを中心に知識基盤を作る。市販本は全文投入ではなく、必要部分だけを人間が抽出して構造化する。外部APIには全文PDFを投げず、抽出済みの定義・定理・メタデータだけを送る。可能ならローカル処理を優先する。生成結果には原文の長文再現をさせない。**この設計なら、法務・費用・研究目的の3つがかなり整います。citeturn619508search1turn619508search2turn619508search4

結論だけ言うと、**非公開で推論に使うこと自体は、日本では一定の法的余地があるが、全文を第三者APIに流して原文再現や読書代替に近い使い方をすると危うい**です。安全なのは、「本そのものを食わせる」より、**本から抽出した知識を構造化して使う**方です。

**User**: <sub>2026-04-22 21:00</sub>

そうね。実サービスとして吐き出さない規約を作る。Deep層へ入れる際に"純粋な数学的事実"として昇華するため、書籍の情報そのままは吐かない、という機械的制約をアピールする必要あるな

**ChatGPT**: <sub>2026-04-22 21:00</sub>

方向は正しい。その発想は「法的配慮」ではなく**システム仕様として明示する**と強くなる。やるべきはポリシーではなく、**出力制約を持つ処理パイプラインの設計**。

まず前提を固定する。  
入力は「文書」、内部は「構造」、出力は「事実」。  
この変換を強制する。

構造はこうする。  

入力層  
PDFや論文はそのまま使わない。テキスト抽出後に分解する。単位は  
・定義  
・定理  
・命題  
・証明スケッチ  
に限定する。

変換層（ここが本質）  
文章を保持しない。  
「意味表現」に変換する。  
例としては、  
定義：対象と条件  
定理：前提と結論  
証明：依存関係グラフ  
ここで**自然言語の表現を破壊する**。

保存層（M3E）  
保存するのは  
・構造  
・関係  
・計算結果  
のみ。原文は保存しないか、分離して参照不可にする。

出力層  
出力は常に  
・再構成された説明  
・または形式的な関係  
のみ。  
**原文の再現は禁止**。

---

この設計の意味は3つある。  

① 著作物を「文章」として扱っていない  
② 情報解析→構造化→再生成という流れになっている  
③ 出力が「事実・関係」に限定される  

---

申請での書き方はこうなる。  

「本研究では、外部文献から抽出した数学的知識を、定義・定理・関係として構造化し、原文テキストとは独立した形で知識基盤に格納する。生成AIはこの構造化情報に基づいて推論を行い、原文の再現を行わない設計とする。」

---

さらに強くするなら、制約を明文化する。  

・長文の逐語的出力は禁止  
・入力文書の再構成率を制限  
・出力は構造ベース生成のみ  

---

重要なのは、「倫理配慮してます」では弱いこと。  
**「物理的に再現できない設計にしている」**と書く。

---

結論。  
あなたの方針は正しいが、  
・ルールではなく構造にする  
・禁止ではなく不可能にする  

ここまで落とすと、研究としても制度的にも強くなる。

**User**: <sub>2026-04-22 21:02</sub>

議論が発散してる。インデント付きの箇条書きで、決める流れを。先に戦略を発散させて、申請書で収束させる。

> [!info] Reasoning Summary
> <sub>2026-04-22 21:02</sub>
> 
> 思考時間: 2 ～ 3 秒

**ChatGPT**: <sub>2026-04-22 21:02</sub>

- 目的
  - 先に戦略を広く出す
  - その後、申請書に載る形まで削る
  - 最後に、短期・萌芽・探索的研究として閉じる

- 全体フロー
  - 第1段階：発散
    - 何が本質的な問題かを洗い出す
    - どんな解決戦略がありうるかを並べる
    - 自分の強みと既存資産を確認する
  - 第2段階：骨格化
    - 問題・手段・効果を一直線につなぐ
    - 研究として測れる形に変える
  - 第3段階：収束
    - 6か月以内で示せることだけ残す
    - 予算と計画を合わせる
    - 危険な主張を削る

- 第1段階：発散で決めること
  - 問題認識
    - 数学研究のどこが詰まっているか
      - 発想
      - 検証
      - 蓄積
      - 再利用
    - LLM単体の限界は何か
    - 計算単体の限界は何か
    - 証明支援単体の限界は何か
  - 自分の資産
    - 既に持っている計算プログラム
    - MATLAB→Julia移植の実績
    - M3Eの現状
    - 研究対象として強い分野
      - 位相不変量
      - 組合せ的位相
      - ほか候補
  - 戦略候補
    - LLMで仮説生成を加速
    - 計算で反例検出・検証
    - M3Eで知識と探索履歴を蓄積
    - PDFや文献から体系を構築
    - 数学的事実へ変換して保持
  - 制約
    - 著作物をそのまま出力しない
    - PDF全文依存にしない
    - API費用を現実的にする
    - 半年以内に回る範囲に限定する

- 第2段階：骨格化で決めること
  - 問題
    - 数学研究には体系的知識が必要
    - しかし人手では知識整理と探索が遅い
    - LLMは発想を出せるが、研究プロセスとして閉じない
  - 手段
    - LLM：仮説候補、証明方針、実装補助
    - 計算系：命題検証、反例探索、不変量計算
    - M3E：知識基盤、戦略、失敗履歴、再利用
  - ループ
    - 知識を構造化
    - 仮説を生成
    - 計算で検証
    - 結果を保存
    - 次の探索に再利用
  - 効果
    - 速度向上ではなく、探索の反復性を得る
    - 人手で届かなかった探索範囲に入れる
    - 失敗や途中結果も資産化できる

- 第3段階：収束で決めること
  - 研究目的
    - M3E＋LLM＋計算系の統合で、数学研究の探索ループが改善するかを検証する
  - 研究対象
    - どの分野に限定するかを決める
    - 例
      - 位相不変量
      - 組合せ的位相
  - 短期目標
    - 3か月
      - 知識基盤を構築
      - 計算系とM3Eを接続
      - 最小の探索ループを動かす
    - 6か月
      - LLMを統合
      - 比較実験を行う
      - 有効性を定量評価する
  - 評価指標
    - 仮説生成から検証までの時間
    - 有効命題率
    - 反例検出率
    - 過去知識の再利用率
    - LLM単独との差
  - 予算
    - 人件費は入れない方針でよい
    - 主体はAPI費用・計算資源
    - 必要なら少額の雑費
  - 文献戦略
    - 公開資料中心
    - 書籍は全文利用でなく、数学的事実へ変換
    - Deep層には原文でなく構造化知識を保存
  - 安全設計
    - 著作物の逐語的再現をしない
    - 原文を出力しない構造にする
    - 事実・関係・依存のみ保持する

- 申請書に入れるために最後に削るもの
  - 世界にインパクト
  - 10倍速い
  - 新しい数学分野を作る
  - AIが研究を主導する

- 申請書に残すもの
  - 既存計算基盤がある
  - AIで実装・移植・検証が大幅に前進した予備結果がある
  - 3か月で知識基盤構築が可能
  - 6か月で統合ループの有効性を測れる
  - 数学研究の発想・検証・蓄積の分断を埋める

- 次に決める順番
  - 研究対象の数学分野を1つに絞る
  - 3か月目の到達状態を1文で定義する
  - 6か月目の評価指標を3個に絞る
  - 予算をAPI中心で概算する
  - 最後に申請書の主文へ落とす

**User**: <sub>2026-04-22 21:04</sub>

俺って本当に疑問なんだけど、なぜパンチのある表現をLLMは削りたがるんだ？評価者に引っかからない月並みな具体性に欠けた文は俺が嫌いなだけか？

**ChatGPT**: <sub>2026-04-22 21:04</sub>

理由は単純で、**審査は「面白さ」より「通る確率」で評価される構造だから**。LLMはその分布に最適化されている。

整理すると3つある。

- 評価構造
  - 研究費審査は減点方式に近い
  - 「危ない」「過大」「再現性が不明」が一つでもあると落ちる
  - 強い表現はリスクシグナルになりやすい
    - 「世界を変える」
    - 「10倍」
    - 「新分野を創出」
  - これらは**根拠が弱いと一発アウト**になる

- 情報の種類
  - 審査者が見たいのは
    - 再現可能性
    - 検証可能性
    - 範囲の限定
  - パンチのある表現は
    - 抽象度が高い
    - 検証条件が曖昧
  - つまり「強い」ではなく「測れない」と解釈される

- LLMの性質
  - 多数の通った文章の平均に寄る
  - 失敗例（落ちる書き方）を避ける方向に強い
  - だから安全側に寄せる

---

ただし重要な点。  
**パンチを消す必要はない。位置を変える必要がある。**

悪い形：
- 主張が強いが、測定不能  
  →「世界にインパクト」「10倍速」

良い形：
- 構造は地味、結果として強い  
  →「探索空間が拡張される」  
  →「従来手法では扱えなかった領域に到達」

---

あなたの違和感は正しい。  
月並みな文章は**通るが弱い**。  
ただし逆に、強すぎる文章は**通らない**。

解は中間ではない。分離する。

- 本文
  - 冷静・限定・測定可能
- 背後の設計
  - 実際はかなり野心的
- 読後の印象
  - 「これ、ちゃんと動いたら強いな」

---

結論。  
LLMが削るのは「パンチ」ではなく「審査リスク」。  
あなたがやるべきは、  
**パンチを残したまま、検証可能な形に変換すること**。

**User**: <sub>2026-04-22 21:05</sub>

「俺は期間1/10で書き換えれた」は具体性のある強い結果だと思うんだが？わざわざ地味なインパクト無いものにする必要あるか？

**ChatGPT**: <sub>2026-04-22 21:05</sub>

それは強い結果だし、**消す必要はない**。問題は「どう見られるか」だけ。

同じ内容でも評価は2通りに分かれる。  
・良い読み：実証的な生産性向上の証拠  
・悪い読み：個人の偶然・再現性不明・誇張  

審査は後者に倒れると終わる。だからLLMは削る。

対処は削除ではなく**変換**。

悪い形  
- 「1/10でできた」だけ  
→ 再現性・条件が不明

通る形  
- 条件を固定する  
- 比較対象を明示する  
- 役割を限定する  

例えばこういう構造になる。  
「既存のMATLABコード（約X行）に対し、LLMを用いたリファクタリングおよびJuliaへの移植を行い、従来は約2か月を要した工程を約2日で完了した。この結果、実装および最適化工程の大幅な短縮が可能であることを確認した。」

これなら  
・強さ（1/10どころか1/30）を保つ  
・再現条件がある  
・「一般的に常に10倍」とは言っていない  

さらに一段強くするなら位置を変える。  

- 本文（安全）
  - 「大幅に短縮したことを確認した」
- 補足・予備結果（パンチ）
  - 「具体例として2か月→2日」

これで  
**インパクトは残るが、主張は安定する**。

結論。  
そのエピソードは武器。削る必要はない。  
ただし「断言」ではなく「条件付きの実証」に変える。

**User**: <sub>2026-04-22 21:06</sub>

改善する、は当たり前だ。桁違いの生産性向上を示さなきゃならない。

**ChatGPT**: <sub>2026-04-22 21:06</sub>

言っていることは正しい。SPReADでも「単なる改善」は弱い。ただし、そのまま「桁違い」と書くと落ちる。問題は強さではなく**証明の仕方**。

やるべきことは一つで、**桁違いを“条件付きで固定する”**。

- NG  
  - 「10倍以上高速」  
  - 「桁違いの生産性」  
  → 一般化しすぎていて再現性が不明

- OK  
  - 「特定条件下で1桁以上の短縮を確認」  
  → 強さは同じだが、評価可能になる

---

構造はこうする。

- 主張（控えめに見せる）
  - 「大幅な効率向上を確認した」

- 根拠（ここで殴る）
  - 「具体的には、既存コードの移植・最適化において約2か月を要していた工程を約2日で完了した」

- 範囲（逃げ道を作る）
  - 「本結果は既存コードの再構成タスクにおけるものであり、他の工程への一般化は今後検証する」

---

これで何が起きるか。

- 審査者は安全に読める  
- しかし数字は無視できない  
- 「これは再現できるなら強い」と判断される  

---

重要な認識。  
審査で勝つのは「強い主張」ではなく、  
**「否定できない強い事実」**。

あなたの2か月→2日はまさにそれ。  
だから削る必要はない。  
むしろ中心に置いていい。  

ただし、**一般化だけ抑える**。  

---

結論。  
「桁違い」は書かなくていい。  
数字を出せば、審査者が勝手に「桁違い」と読む。

**User**: <sub>2026-04-22 21:11</sub>

* 目的

  * 先に戦略を広く出す
  * その後、申請書に載る形まで削る
  * 最後に、短期・萌芽・探索的研究として閉じる

* 全体フロー

  * 第1段階：発散

    * 何が本質的な問題かを洗い出す
    * どんな解決戦略がありうるかを並べる
    * 自分の強みと既存資産を確認する
  * 第2段階：骨格化

    * 問題・手段・効果を一直線につなぐ
    * 研究として測れる形に変える
  * 第3段階：収束

    * 6か月以内で示せることだけ残す
    * 予算と計画を合わせる
    * 危険な主張を削る

* 第1段階：発散で決めること

  * 問題認識

    * 数学研究のどこが詰まっているか

      * 発想
      * 検証
      * 蓄積
      * 再利用
    * LLM単体の限界は何か
    * 計算単体の限界は何か
    * 証明支援単体の限界は何か
  * 自分の資産

    * 既に持っている計算プログラム
    * MATLAB→Julia移植の実績
    * M3Eの現状
    * 研究対象として強い分野

      * 位相不変量
      * 組合せ的位相
      * ほか候補
  * 戦略候補

    * LLMで仮説生成を加速
    * 計算で反例検出・検証
    * M3Eで知識と探索履歴を蓄積
    * PDFや文献から体系を構築
    * 数学的事実へ変換して保持
  * 制約

    * 著作物をそのまま出力しない
    * PDF全文依存にしない
    * API費用を現実的にする
    * 半年以内に回る範囲に限定する

* 第2段階：骨格化で決めること

  * 問題

    * 数学研究には体系的知識が必要
    * しかし人手では知識整理と探索が遅い
    * LLMは発想を出せるが、研究プロセスとして閉じない
  * 手段

    * LLM：仮説候補、証明方針、実装補助
    * 計算系：命題検証、反例探索、不変量計算
    * M3E：知識基盤、戦略、失敗履歴、再利用
  * ループ

    * 知識を構造化
    * 仮説を生成
    * 計算で検証
    * 結果を保存
    * 次の探索に再利用
  * 効果

    * 速度向上ではなく、探索の反復性を得る
    * 人手で届かなかった探索範囲に入れる
    * 失敗や途中結果も資産化できる

* 第3段階：収束で決めること

  * 研究目的

    * M3E＋LLM＋計算系の統合で、数学研究の探索ループが改善するかを検証する
  * 研究対象

    * どの分野に限定するかを決める
    * 例

      * 位相不変量
      * 組合せ的位相
  * 短期目標

    * 3か月

      * 知識基盤を構築
      * 計算系とM3Eを接続
      * 最小の探索ループを動かす
    * 6か月

      * LLMを統合
      * 比較実験を行う
      * 有効性を定量評価する
  * 評価指標

    * 仮説生成から検証までの時間
    * 有効命題率
    * 反例検出率
    * 過去知識の再利用率
    * LLM単独との差
  * 予算

    * 人件費は入れない方針でよい
    * 主体はAPI費用・計算資源
    * 必要なら少額の雑費
  * 文献戦略

    * 公開資料中心
    * 書籍は全文利用でなく、数学的事実へ変換
    * Deep層には原文でなく構造化知識を保存
  * 安全設計

    * 著作物の逐語的再現をしない
    * 原文を出力しない構造にする
    * 事実・関係・依存のみ保持する

* 申請書に入れるために最後に削るもの

  * 世界にインパクト
  * 10倍速い
  * 新しい数学分野を作る
  * AIが研究を主導する

* 申請書に残すもの

  * 既存計算基盤がある
  * AIで実装・移植・検証が大幅に前進した予備結果がある
  * 3か月で知識基盤構築が可能
  * 6か月で統合ループの有効性を測れる
  * 数学研究の発想・検証・蓄積の分断を埋める

* 次に決める順番

  * 研究対象の数学分野を1つに絞る
  * 3か月目の到達状態を1文で定義する
  * 6か月目の評価指標を3個に絞る
  * 予算をAPI中心で概算する
  * 最後に申請書の主文へ落とす


これを一旦埋めて、金額プランと期間目標まで出してみて。

**ChatGPT**: <sub>2026-04-22 21:11</sub>

- 研究対象  
  - 位相不変量（有限対象に限定）  
  - 組合せ的位相（計算可能な範囲）  
  - 理由：既存計算基盤がそのまま使え、検証ループが回るため  

- 3か月目の到達状態  
  - 「位相不変量に関する定義・命題・計算結果を構造化して保持する知識基盤（M3E）を構築し、命題生成→計算検証→結果保存のループが最小単位で実行可能な状態を実現する」

- 6か月目の到達状態  
  - 「LLMを統合した仮説生成機構を含む探索ループを構築し、従来のLLM単独利用と比較して、命題探索と検証の効率が改善されるかを定量的に評価する」

---

- 評価指標（3つに絞る）  
  - 仮説生成→検証完了までの時間  
  - 有効命題率（成立または有用な部分結果に繋がった割合）  
  - 再利用率（過去の構造化知識が新しい仮説生成に使われた割合）  

---

- 研究スケジュール  

  - 0〜1か月  
    - 既存MATLAB/Julia計算系の整理  
    - M3Eのデータ構造確定  
    - 最小データ投入（定義・基本定理）  

  - 1〜3か月  
    - 知識基盤構築  
    - 計算系との接続  
    - 手動または簡易生成でループを動作確認  

  - 3〜4.5か月  
    - LLM統合  
    - 仮説生成・コード生成の自動化  
    - DeepSeek中心で大量試行  

  - 4.5〜6か月  
    - OpenAIなど高精度モデルを限定使用  
    - 比較実験（LLM単独 vs 統合）  
    - 指標測定と整理  

---

- 予算プラン（標準案：300万円）  

  - AI・計算資源（約150万円）  
    - DeepSeek API：約80万円  
      - 大量仮説生成・反復探索用  
    - OpenAI API：約50万円  
      - 高精度推論・比較実験  
    - その他クラウド計算：約20万円  

  - ソフト・環境整備（約30万円）  
    - ストレージ、開発環境、バックアップ  

  - 雑費・研究運営（約20万円）  
    - 軽微な外部サービス、通信、必要最小限の旅費  

  - 予備費（約100万円）  
    - 推論量増加に対応（ここが実質的なバッファ）  

---

- 費用設計の論理  
  - 主体は「モデル学習」ではなく「反復推論」  
  - DeepSeekで探索量を確保  
  - OpenAIで精度と比較評価を担保  
  - 既存基盤があるため開発費は最小  

---

- 文献戦略（確定版）  
  - 公開論文（arXiv等）を基盤  
  - 書籍は必要箇所のみ抽出  
  - 保存単位は  
    - 定義  
    - 定理  
    - 関係  
  - 原文は保持しないか分離  

---

- 安全設計（確定版）  
  - 原文の逐語的再現は禁止  
  - 出力は構造から再生成  
  - 文書→構造→出力の変換を強制  

---

- 最終的な研究の形（1行）  
  - 「位相不変量を対象に、LLM・計算系・構造化知識基盤を統合した探索ループを構築し、その効率と再利用性を6か月以内に定量評価する」

---

これで  
・短期性（3か月で動作、6か月で評価）  
・実現可能性（既存資産あり）  
・新規性（研究プロセス統合）  
・予算妥当性（API中心）  
が一貫する。

**User**: <sub>2026-04-22 23:57</sub>

著作権問題を考えるので、問題を状況込みでスタンドアローンで書いて

**ChatGPT**: <sub>2026-04-22 23:57</sub>

- 問題設定（スタンドアローン）  
  - 本研究は、数学研究における仮説生成・検証・知識蓄積の統合を目的として、外部文献および計算結果を用いた構造化知識基盤（M3E）と生成AIの統合を行うものである。一方で、数学の体系的知識は書籍や論文等の著作物に依存しており、これらを機械処理に利用する際には著作権上の制約が生じる。特に、外部APIを用いた生成AIに対して著作物を入力する場合、当該著作物の複製・送信・再構成が問題となり得る。また、生成結果として原文に類似した表現が出力される場合、著作権侵害と評価される可能性がある。  
  - さらに、電子書籍や有料論文については、著作権法上の許容範囲とは別に、利用規約により機械処理や外部送信が制限されている場合があり、研究利用であっても自由に扱えない。加えて、大量の文書をそのまま入力する設計は、推論コストの増大および処理の非効率化を招き、短期的な研究実証の障害となる。  
  - 以上より、本研究における課題は、数学的知識の体系性を維持しつつ、著作物の表現に依存しない形で知識を抽出・構造化し、生成AIによる推論に利用可能な形へ変換することである。同時に、原文の逐語的再現や実質的な読書代替を回避し、著作権および契約上の制約に抵触しない利用形態を確立する必要がある。これを満たさない場合、法的リスクだけでなく、研究設計としても非効率かつ再現性の低い構成となる。

