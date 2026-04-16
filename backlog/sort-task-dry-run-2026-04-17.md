# DAG Dry-Run: pj-vision-100 (2026-04-17)

**source**: [backlog/pj-vision-100.md](pj-vision-100.md)
**mode**: dry-run（未書き込み）

既存 `projects/deps.json` の PJ-00..PJ-08 は vision 1–8 に対応済みとして据え置き。
新規追加予定は **PJ-09..PJ-100（92 件）**。

## サマリ

- 新規ノード: 92
- 高確度エッジ: 37 本（backbone — meta → 各セクション、セクション内の明白な連鎖）
- review pool: 30 本（採否ユーザー判断）

## 命名規則

- ID: 連番 `PJ-NN`（vision 番号と 1:1、pj-vision-100.md の通し番号と一致）
- title: 英語ショートスラグ（既存 PJ-01..08 に倣う）

## 新規ノード（92 件）

### Meta/Foundation 追加（9–10）
| # | id | title | state |
|---|----|-------|-------|
| 9 | PJ-09 | TwoStageGate | draft |
| 10 | PJ-10 | PermMatrix | draft |

### Agent / AI（11–20）
| # | id | title | state |
|---|----|-------|-------|
| 11 | PJ-11 | SparringAgent | draft |
| 12 | PJ-12 | MapHygieneAgent | draft |
| 13 | PJ-13 | ResearchQueryAgent | draft |
| 14 | PJ-14 | AgentOrchestrator | draft |
| 15 | PJ-15 | DomainAgentPool | draft |
| 16 | PJ-16 | MetaCogAnnotate | draft |
| 17 | PJ-17 | AISendFilter | draft |
| 18 | PJ-18 | HallucDetect | draft |
| 19 | PJ-19 | PromptRegistry | draft |
| 20 | PJ-20 | GenCache | draft |

### Capture / Input（21–30）
| # | id | title | state |
|---|----|-------|-------|
| 21 | PJ-21 | UnivInbox | draft |
| 22 | PJ-22 | VoiceCapture | draft |
| 23 | PJ-23 | ScreenshotIngest | draft |
| 24 | PJ-24 | BrowserExt | draft |
| 25 | PJ-25 | MobileSlim | draft |
| 26 | PJ-26 | EmailIngest | draft |
| 27 | PJ-27 | PDFIngest | draft |
| 28 | PJ-28 | ZoteroLink | draft |
| 29 | PJ-29 | GitHubLink | draft |
| 30 | PJ-30 | CalendarLink | draft |

### Export / Output（31–38）
| # | id | title | state |
|---|----|-------|-------|
| 31 | PJ-31 | SlideGen | draft |
| 32 | PJ-32 | PaperDraft | draft |
| 33 | PJ-33 | EmailDraft | draft |
| 34 | PJ-34 | WeeklyReview | draft |
| 35 | PJ-35 | PJReport | draft |
| 36 | PJ-36 | PublicView | draft |
| 37 | PJ-37 | CiteAuto | draft |
| 38 | PJ-38 | ObsidianSync | draft |

### UX / Map（39–55）
| # | id | title | state |
|---|----|-------|-------|
| 39 | PJ-39 | KbdModes | draft |
| 40 | PJ-40 | QuickAdd | draft |
| 41 | PJ-41 | ReviewQueueUI | draft |
| 42 | PJ-42 | MapViews | draft |
| 43 | PJ-43 | SlideshowMode | draft |
| 44 | PJ-44 | FocusMode | draft |
| 45 | PJ-45 | TimeSlider | draft |
| 46 | PJ-46 | NodeTypeTemplate | draft |
| 47 | PJ-47 | AttrFirstClass | draft |
| 48 | PJ-48 | MultiAxisLayout | draft |
| 49 | PJ-49 | VisualCode | draft |
| 50 | PJ-50 | LinkVisual | draft |
| 51 | PJ-51 | SearchUp | draft |
| 52 | PJ-52 | UndoRedoFull | draft |
| 53 | PJ-53 | NodeLifecycle | draft |
| 54 | PJ-54 | DragReorg | draft |
| 55 | PJ-55 | Minimap | draft |

### Data / Persistence（56–65）
| # | id | title | state |
|---|----|-------|-------|
| 56 | PJ-56 | VaultSep | draft |
| 57 | PJ-57 | ClientEncrypt | draft |
| 58 | PJ-58 | SnapshotHist | draft |
| 59 | PJ-59 | ConflictRes | draft |
| 60 | PJ-60 | CRDTSync | draft |
| 61 | PJ-61 | Provenance | draft |
| 62 | PJ-62 | SchemaMig | draft |
| 63 | PJ-63 | ExportFormats | draft |
| 64 | PJ-64 | LocalFileLink | draft |
| 65 | PJ-65 | LargeMapOpt | draft |

### Collaboration（66–75）
| # | id | title | state |
|---|----|-------|-------|
| 66 | PJ-66 | CoauthorInvite | draft |
| 67 | PJ-67 | LockGranular | draft |
| 68 | PJ-68 | Comments | draft |
| 69 | PJ-69 | RoleModel | draft |
| 70 | PJ-70 | ShareLink | draft |
| 71 | PJ-71 | AnonFeedback | draft |
| 72 | PJ-72 | ReviewAssign | draft |
| 73 | PJ-73 | PermInherit | draft |
| 74 | PJ-74 | AuditShare | draft |
| 75 | PJ-75 | TeamVault | draft |

### Workflow / Cognitive（76–85）
| # | id | title | state |
|---|----|-------|-------|
| 76 | PJ-76 | SRS | draft |
| 77 | PJ-77 | QuestionDriven | draft |
| 78 | PJ-78 | MetaCogSupport | draft |
| 79 | PJ-79 | FocusTimer | draft |
| 80 | PJ-80 | MorningRoutine | draft |
| 81 | PJ-81 | WeeklyRitual | draft |
| 82 | PJ-82 | MonthlyReview | draft |
| 83 | PJ-83 | GoalTree | draft |
| 84 | PJ-84 | HabitTracker | draft |
| 85 | PJ-85 | ReadingQueue | draft |

### Concept / Experimental（86–92）
| # | id | title | state |
|---|----|-------|-------|
| 86 | PJ-86 | ThoughtPhysics | draft |
| 87 | PJ-87 | Unfinished | draft |
| 88 | PJ-88 | IntentForget | draft |
| 89 | PJ-89 | NodeEvolve | draft |
| 90 | PJ-90 | Gamify | draft |
| 91 | PJ-91 | SelfDiscovery | draft |
| 92 | PJ-92 | TimeAxes | draft |

### Tool Integration / Infrastructure（93–100）
| # | id | title | state |
|---|----|-------|-------|
| 93 | PJ-93 | MCPServer | draft |
| 94 | PJ-94 | Plugins | draft |
| 95 | PJ-95 | ForkKit | draft |
| 96 | PJ-96 | Telemetry | draft |
| 97 | PJ-97 | FeedbackPublic | draft |
| 98 | PJ-98 | CLI | draft |
| 99 | PJ-99 | PublicAPI | draft |
| 100 | PJ-100 | MobileApp | draft |

## 提案エッジ（高確度 37 本）

### meta 基盤 → 各セクション
- `PJ-01 TrustEng` → `PJ-11 SparringAgent`（autonomy 渡すのに trust 必要）
- `PJ-01 TrustEng` → `PJ-14 AgentOrchestrator`
- `PJ-01 TrustEng` → `PJ-15 DomainAgentPool`
- `PJ-02 HarnessTranspose` → `PJ-14 AgentOrchestrator`
- `PJ-04 InfoGather` → `PJ-13 ResearchQueryAgent`
- `PJ-04 InfoGather` → `PJ-21 UnivInbox`
- `PJ-06 PrivacyLayer` → `PJ-17 AISendFilter`
- `PJ-06 PrivacyLayer` → `PJ-56 VaultSep`
- `PJ-06 PrivacyLayer` → `PJ-57 ClientEncrypt`
- `PJ-07 Projection` → `PJ-31 SlideGen`
- `PJ-07 Projection` → `PJ-32 PaperDraft`
- `PJ-07 Projection` → `PJ-33 EmailDraft`
- `PJ-07 Projection` → `PJ-34 WeeklyReview`
- `PJ-07 Projection` → `PJ-35 PJReport`
- `PJ-08 AdoptionEng` → `PJ-09 TwoStageGate`（採用判断に 2段ゲート）
- `PJ-10 PermMatrix` → `PJ-14 AgentOrchestrator`
- `PJ-10 PermMatrix` → `PJ-69 RoleModel`

### 同一セクション内の明白な連鎖
- `PJ-19 PromptRegistry` → `PJ-20 GenCache`（資産管理が先、キャッシュは上に乗る）
- `PJ-21 UnivInbox` → `PJ-22 VoiceCapture`
- `PJ-21 UnivInbox` → `PJ-23 ScreenshotIngest`
- `PJ-21 UnivInbox` → `PJ-26 EmailIngest`
- `PJ-27 PDFIngest` → `PJ-28 ZoteroLink`
- `PJ-27 PDFIngest` → `PJ-37 CiteAuto`
- `PJ-37 CiteAuto` → `PJ-32 PaperDraft`
- `PJ-39 KbdModes` → `PJ-40 QuickAdd`
- `PJ-41 ReviewQueueUI` → `PJ-72 ReviewAssign`
- `PJ-47 AttrFirstClass` → `PJ-46 NodeTypeTemplate`
- `PJ-47 AttrFirstClass` → `PJ-49 VisualCode`
- `PJ-57 ClientEncrypt` → `PJ-75 TeamVault`
- `PJ-60 CRDTSync` → `PJ-59 ConflictRes`
- `PJ-60 CRDTSync` → `PJ-66 CoauthorInvite`
- `PJ-62 SchemaMig` → `PJ-65 LargeMapOpt`
- `PJ-66 CoauthorInvite` → `PJ-67 LockGranular`
- `PJ-69 RoleModel` → `PJ-73 PermInherit`
- `PJ-83 GoalTree` → `PJ-82 MonthlyReview`
- `PJ-93 MCPServer` → `PJ-94 Plugins`
- `PJ-99 PublicAPI` → `PJ-98 CLI`

## review pool（判断が必要）

**AI 周り**
- [ ] `PJ-16 MetaCogAnnotate` → `PJ-18 HallucDetect` ?
- [ ] `PJ-18 HallucDetect` → `PJ-32 PaperDraft` ?
- [ ] `PJ-14 AgentOrchestrator` → `PJ-15 DomainAgentPool` ?

**Capture 周り**
- [ ] `PJ-23 ScreenshotIngest` → `PJ-27 PDFIngest` ?
- [ ] `PJ-25 MobileSlim` → `PJ-100 MobileApp` ?（薄型はアプリの前駆）
- [ ] `PJ-24 BrowserExt` → `PJ-21 UnivInbox` ?

**UX 周り**
- [ ] `PJ-39 KbdModes` → `PJ-41 ReviewQueueUI` ?
- [ ] `PJ-42 MapViews` → `PJ-43 SlideshowMode` ?
- [ ] `PJ-42 MapViews` → `PJ-44 FocusMode` ?
- [ ] `PJ-45 TimeSlider` → `PJ-58 SnapshotHist` ?（時系列 UI は履歴基盤の上）
- [ ] `PJ-50 LinkVisual` → `PJ-55 Minimap` ?
- [ ] `PJ-51 SearchUp` → `PJ-47 AttrFirstClass` ?

**Data 周り**
- [ ] `PJ-56 VaultSep` → `PJ-75 TeamVault` ?
- [ ] `PJ-61 Provenance` → `PJ-58 SnapshotHist` ?
- [ ] `PJ-63 ExportFormats` → `PJ-38 ObsidianSync` ?
- [ ] `PJ-63 ExportFormats` → `PJ-95 ForkKit` ?

**Collaboration 周り**
- [ ] `PJ-68 Comments` → `PJ-72 ReviewAssign` ?
- [ ] `PJ-74 AuditShare` → `PJ-61 Provenance` ?（依存方向は逆かも）
- [ ] `PJ-70 ShareLink` → `PJ-36 PublicView` ?

**Workflow 周り**
- [ ] `PJ-34 WeeklyReview` → `PJ-81 WeeklyRitual` ?
- [ ] `PJ-83 GoalTree` → `PJ-77 QuestionDriven` ?
- [ ] `PJ-79 FocusTimer` → `PJ-84 HabitTracker` ?

**Concept / Infra 周り**
- [ ] `PJ-87 Unfinished` → `PJ-88 IntentForget` ?
- [ ] `PJ-87 Unfinished` → `PJ-89 NodeEvolve` ?
- [ ] `PJ-92 TimeAxes` → `PJ-45 TimeSlider` ?
- [ ] `PJ-93 MCPServer` → `PJ-99 PublicAPI` ?
- [ ] `PJ-94 Plugins` → `PJ-95 ForkKit` ?
- [ ] `PJ-96 Telemetry` → `PJ-05 ObserveSelf` ?（依存方向は逆かも）
- [ ] `PJ-99 PublicAPI` → `PJ-100 MobileApp` ?

## 予測される構造（高確度のみ commit した場合）

- 総ノード: 101（PJ-00..PJ-100）
- layers 深さ: 概ね 3–4（多くの新規 PJ は L1 か独立 L0）
- critical path 候補: `PJ-01 → PJ-03`（既存）は据え置き、新規で長い chain は `PJ-04 → PJ-21 → (capture 系)`
- ready: PJ-00..PJ-08 のうち draft のまま + 独立 L0 新規 PJ（UX/Workflow/Concept の多くは prereq なし）

## 採択手順

以下のどれかで指示してください:

1. **全採択** — 「高確度全部採用、review pool 全部却下」
2. **全採択 + review pool も」 — 「高確度 + review pool 全部採用」
3. **セクション単位** — 「Meta / Capture / Export だけ採用、他は後回し」
4. **個別指示** — 「PJ-09..PJ-20 の node だけ add、edge は高確度のみ」「review pool のうち #3, #7, #15 を採用」

採択後:
- `deps.py add` で ノード投入（92 件）
- `deps.py dep` でエッジ投入（高確度 + 採択された review pool）
- `deps.py check` で検証
- 希望あれば `render_map.mjs` で map 再描画
