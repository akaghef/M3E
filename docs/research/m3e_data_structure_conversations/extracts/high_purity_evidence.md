# High Purity Evidence

TOON / MIOS / Command Patch / JSON正本 / 可変属性 / packed core に直接触れている証跡だけを抽出した版。
広域抽出は `high_value_evidence.md`、全ログは `../raw_conversations/` を見る。

## transport-toon

### 260425_MIOSMindmap_IO_Stack.md:1-31
- raw: [raw](../raw_conversations/260425_MIOSMindmap_IO_Stack.md)
> L1: ---
> L2: title: "MIOS（Mindmap I/O Stack)"
> L3: created: 2026-04-25 10:43:05
> L4: updated: 2026-04-25 11:06:27
> L5: tags:
> L6: - chatgpt
> L7: - conversation
> L8: ---
> L9: # MIOS（Mindmap I/O Stack)
> L11: <sub>2026-04-25</sub>
> L13: ---
> L15: **User**: <sub>2026-04-25 10:43</sub>
> L17: LLMでマインドマップ構造を扱う際、入力はTOONで効率化できるが、出力も同様に扱うと構造の厳密性が保証できないという問題がある。そこで、高知能のAI1がTOONを読み取り編集方針を生成し、軽量なAI2がそれを半プログラム化された編集要求として出力する役割分担を導入する。入出力はTOONベースの軽量形式で統一しつつ、内部ではその編集要求をCommandへ変換し、JSON正本に対して検証・修復を行う。APIとModelはAI2と一体となって、編集要求を安全な操作列へ落とし込み、validationに通るまで反復...
> L19: 了解です。**AI2の Request Program Layer と API/Model の Validate/Repair Layer を合体**させるなら、AI2は単独の層ではなく、検証・修復ループの中に入る実行補助になります。つまり、AI1が方針を作り、AI2 + TypeScript API + Model が一体で「通るCommand」まで落とします。
> L21: | 層 | 名前 | 主体 | 実体 | 入力 | 出力 |
> L22: | --- | --- | --- | --- | --- | --- |
> L23: | 1 | Intent Layer | User | UI / 自然言語入力 | 操作意図・問題意識 | 自然言語の編集意図 |
> L24: | 2 | Planning Layer | AI1 高知能LLM | ChatGPT / Claude strong model | 編集意図 + TOON context | 編集方針・対象範囲・変更理由 |
> L25: | 3 | Program-Guard Layer | AI2 + API + Model | fast LLM + TypeScript EditRequestCompiler + CommandValidator | 編集方針 + TOON context + Model state | Validated Command / ValidationError |
> L26: | 4 | Commit Layer | User + Model | React diff UI + Model.apply | Validated Command + dry-run diff | Applied Change + Undo log |
> L27: | 5 | Persist Layer | Storage | SQLite / JSON | Applied Model state | PersistedDocument |
> L29: この場合、3層目の中身はこうです。
> L31: | 内部処理 | 主体 | 内容 |

## command-apply

### 260304_MVC通信形式_Rapid.md:344-350
- raw: [raw](../raw_conversations/260304_MVC通信形式_Rapid.md)
> L344: 1. **Browser Event → Controller**
> L345: 2. **Controller → Command生成**
> L346: 3. **Controller → Model.apply(command)**
> L347: 4. **Model更新**
> L348: 5. **Model → change通知**
> L349: 6. **View再描画**

### 260304_MVC通信形式_Rapid.md:633-639
- raw: [raw](../raw_conversations/260304_MVC通信形式_Rapid.md)
> L633: Controller
> L634: ↓
> L635: Model.apply(command)
> L636: ↓
> L637: Model.notify(change)
> L638: ↓
> L639: View.onModelChange(change)

### 260304_MVC通信形式_Rapid.md:1674-1680
- raw: [raw](../raw_conversations/260304_MVC通信形式_Rapid.md)
> L1675: ```
> L1676: model.apply(command)
> L1677: ```
> L1679: ---

### 260304_MVC通信形式_Rapid.md:1835-1843
- raw: [raw](../raw_conversations/260304_MVC通信形式_Rapid.md)
> L1835: (5) Controller → Service：reparentNode(A, toParent=P’, …) のユースケース呼び出し
> L1836: (6) Service：Command生成（例：ReparentNodeCommand(nodeId=A, fromParent=P, toParent=P’, fromIndex=i, toIndex=j)）
> L1837: (7) Service → Model：model.apply(command)（状態変更の入口はここ） fileciteturn1file0
> L1839: 5) Model.apply(command)（確定処理）
> L1840: (1) Model：制約検証（循環禁止、scope制約、alias制約など）
> L1841: (2) Model：状態更新（親をP→P’へ付け替え）
> L1842: (3) Model：undoStackへ積み、redoStackをクリア
> L1843: (4) Model → View：changed通知（購読しているViewへイベント送出） fileciteturn1file0

### 260304_KGFとフレームワーク.md:303-309
- raw: [raw](../raw_conversations/260304_KGFとフレームワーク.md)
> L303: 1. Browserイベント → Controller。
> L304: 2. Controller → Command生成。
> L305: 3. Controller → Model.apply(command)。
> L306: 4. Model更新 → change通知。
> L307: 5. View再描画。
> L309: **ドラッグ操作の方針**

### 260304_開発言語選定.md:2355-2361
- raw: [raw](../raw_conversations/260304_開発言語選定.md)
> L2355: → Controller
> L2356: → Command生成
> L2357: → Model.apply(command)
> L2358: → Model.history更新
> L2359: → View再描画
> L2361: Undoは

### 260304_開発言語選定.md:2621-2627
- raw: [raw](../raw_conversations/260304_開発言語選定.md)
> L2621: new MoveNodeCommand(...)
> L2622: ↓
> L2623: model.apply(command)
> L2624: ```
> L2626: ---

### 260304_開発言語選定.md:2699-2705
- raw: [raw](../raw_conversations/260304_開発言語選定.md)
> L2699: → Controller
> L2700: → Command生成
> L2701: → Model.apply(command)
> L2703: ここでCommandは「何をする操作か」を表します。例えば
> L2705: CreateNode

### 260304_開発言語選定.md:2811-2817
- raw: [raw](../raw_conversations/260304_開発言語選定.md)
> L2811: User input
> L2812: → Controller
> L2813: → model.apply(command)
> L2814: → Model更新
> L2815: → View再描画
> L2817: です。

### 260304_開発言語選定.md:2828-2834
- raw: [raw](../raw_conversations/260304_開発言語選定.md)
> L2829: ```
> L2830: Controller → Model.apply(command)
> L2831: ```
> L2833: 経由になります。

### 260304_開発言語選定.md:2842-2856
- raw: [raw](../raw_conversations/260304_開発言語選定.md)
> L2842: → Controller
> L2843: → new MoveNode(...)
> L2844: → model.apply(command)
> L2845: → Canvas再描画
> L2847: Flash → Rapid昇格
> L2849: クリック
> L2850: → Controller
> L2851: → new PromoteNode(...)
> L2852: → model.apply(command)
> L2853: → Canvas再描画
> L2855: という形になります。

### 260304_開発言語選定.md:2961-2969
- raw: [raw](../raw_conversations/260304_開発言語選定.md)
> L2961: ・ReparentNodeCommand(nodeId=A, fromParent=P, toParent=P’, fromIndex=i, toIndex=j)
> L2962: ※fromIndex/toIndexは並び順を保存したいなら必要。最小なら親だけでもよい。
> L2963: (5) Controller → Model.apply(command) を呼ぶ（ここが唯一の状態変更入口）
> L2965: 5. Model.apply(command)
> L2966: (1) Modelは内部で制約検証
> L2967: ・ツリーが循環しない
> L2968: ・scope制約、alias制約など
> L2969: (2) OKなら状態を更新（親をP→P’へ）

### 260304_開発言語選定.md:3135-3141
- raw: [raw](../raw_conversations/260304_開発言語選定.md)
> L3135: new ReparentNodeCommand(...)
> L3136: ↓
> L3137: Model.apply(command)
> L3138: ↓
> L3139: View再描画
> L3140: ```

### 260311_外部ツール利用可否.md:112-120
- raw: [raw](../raw_conversations/260311_外部ツール利用可否.md)
> L112: ・ReparentNodeCommand(nodeId=A, fromParent=P, toParent=P’, fromIndex=i, toIndex=j)
> L113: ※fromIndex/toIndexは並び順を保存したいなら必要。最小なら親だけでもよい。
> L114: (5) Controller → Model.apply(command) を呼ぶ（ここが唯一の状態変更入口）
> L116: Model.apply(command)
> L117: (1) Modelは内部で制約検証
> L118: ・ツリーが循環しない
> L119: ・scope制約、alias制約など
> L120: (2) OKなら状態を更新（親をP→P’へ）

### 260330_役割分離の方法.md:533-539
- raw: [raw](../raw_conversations/260330_役割分離の方法.md)
> L533: LLM: "AをP'の子に移動"
> L534: → Command: Reparent(A, P')
> L535: → Model.apply(command)
> L536: ```
> L538: GUIは関与しない

## ssot-storage

### 260402_UIマトリクス視覚化.md:4265-4271
- raw: [raw](../raw_conversations/260402_UIマトリクス視覚化.md)
> L4265: #### `m3e.save(filename?)`
> L4267: 現在のツリーを `SavedDoc`（`version: 1`）形式でブラウザダウンロードとして保存する。
> L4268: ブラウザ環境のため任意のパスへの書き込みは行わない。`filename` を省略するとデフォルト名（`m3e-export.json`）を使用する。戻り値なし。
> L4270: ```javascript
> L4271: m3e.save()

### 260402_UIマトリクス視覚化.md:4302-4308
- raw: [raw](../raw_conversations/260402_UIマトリクス視覚化.md)
> L4302: | format | 出力 | 状態 |
> L4303: |--------|------|------|
> L4304: | `"json"` | M3E SavedDoc 形式（`save` と同等） | 実装済み相当 |
> L4305: | `"mm"` | Freeplane `.mm` 形式 | **未実装（Beta 以降）** |
> L4307: ```javascript
> L4308: m3e.export("json")

### 260402_UIマトリクス視覚化.md:4847-4853
- raw: [raw](../raw_conversations/260402_UIマトリクス視覚化.md)
> L4847: 優先順位は以下とする。
> L4849: 1. 論理正本は JSON document model とする
> L4850: 2. Rapid MVP の永続化実装は SQLite とする
> L4851: 3. `.mm` は import/export 互換フォーマットとして維持する
> L4852: 4. PostgreSQL はサーバー要件が固まった段階で再評価する

### 260402_UIマトリクス視覚化.md:4926-4932
- raw: [raw](../raw_conversations/260402_UIマトリクス視覚化.md)
> L4926: ## 全体方針
> L4928: - M3E の正本は **SavedDoc JSON**（`version: 1`）とする
> L4929: - 外部フォーマットは「入口・出口」であり、正本には常に M3E 形式に変換してから取り込む
> L4930: - ラウンドトリップ（M3E → 外部 → M3E）で意味が保たれることを重視する
> L4931: - 外部フォーマットで表現できない M3E 固有の概念（scope・alias 等）は、エクスポート時に落とすか属性として退避する

### 260405_M3E_vs_M3E.md:3863-3869
- raw: [raw](../raw_conversations/260405_M3E_vs_M3E.md)
> L3863: | フォーマット | Import | Export | 状態 |
> L3864: |-------------|--------|--------|------|
> L3865: | M3E SavedDoc JSON | ✅ | ✅ | 実装済み |
> L3866: | SQLite（内部永続化） | ✅ | ✅ | 実装済み |
> L3867: | Freeplane `.mm` | ✅ | ❌ | Import のみ実装済み |
> L3868: | インデントテキスト | ❌ | ❌ | 未実装（将来対応候補） |
> L3869: | Markdown | ❌ | ❌ | 未実装（将来対応候補） |

### 260405_M3E_vs_M3E.md:3873-3886
- raw: [raw](../raw_conversations/260405_M3E_vs_M3E.md)
> L3873: ## 内部フォーマット
> L3875: ### SavedDoc JSON（`version: 1`）
> L3877: M3E の正本フォーマット。ファイル保存・ブラウザダウンロード・SQLite 内部保存に使用する。
> L3879: **スキーマ:**
> L3881: ```typescript
> L3882: interface SavedDoc {
> L3883: version: 1
> L3884: savedAt: string        // ISO 8601 タイムスタンプ
> L3885: state: AppState
> L3886: }

## misc

### 260425_MIOSMindmap_IO_Stack.md:35-47
- raw: [raw](../raw_conversations/260425_MIOSMindmap_IO_Stack.md)
> L35: | Resolve | TypeScript API | selector / label / nodeId / index を解決する |
> L36: | Compile | TypeScript API | 内部Commandへ変換する |
> L37: | Validate | Model | 循環、scope、alias、存在、順序を検査する |
> L38: | Repair | AI2 + API | ValidationErrorを受けて修復する |
> L40: 図ではこうです。
> L42: ```
> L43: User  ↓AI1 Planning  ↓AI2 + API + Model  Program → Resolve → Compile → Validate ↔ Repair  ↓User approval + Model.apply  ↓SQLite / JSON
> L44: ```
> L46: したがって、EASはこの5層で十分です。

### 260311_Agent開発の基本.md:948-954
- raw: [raw](../raw_conversations/260311_Agent開発の基本.md)
> L948: **ChatGPT**: <sub>2026-03-11 08:59</sub>
> L950: You should build an MVP early because it lets you validate core functionality with minimal effort. It helps you test whether the concept works in practice, gather feedback, and iterate quickly. By focusing on the essentials, you avoid overbuilding and ensur...
> L951: <audio controls src="../../../Assets/Audio/file_000000005e9072068a6a7832d5f4d13f-1162df5b-29f2-4524-979c-e8a74cbd59ed.wav"></audio> *Audio (19.6s)*
> L953: **User**: <sub>2026-03-11 09:00</sub>

### 260330_役割分離の方法.md:753-759
- raw: [raw](../raw_conversations/260330_役割分離の方法.md)
> L753: for t in order:
> L754: worker.execute(t)
> L755: validate()
> L756: ```
> L758: ---

### 260403_クラウド同期マージ問題.md:888-894
- raw: [raw](../raw_conversations/260403_クラウド同期マージ問題.md)
> L888: candidate = applyWithoutConflicts(autoMerged)
> L890: invalid = validateModelConstraints(candidate)
> L891: conflicts += invalidToConflicts(invalid)
> L893: resolved = resolveConflictsByPolicyOrUI(conflicts)
> L894: finalMap = applyResolved(candidate, resolved)
