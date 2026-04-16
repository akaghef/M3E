# 04. Runtime UX — 取り込み体験の UI / 操作系

「入れる瞬間」のユーザー体験。視覚・聴覚・触覚フィードバック、入力 UI のバリエーション。
**摩擦ゼロ感** と **入った確信** の両立が鍵。

---

## U1. メニューバー / システムトレイ常駐ウィジェット

### バリエーション
| 案 | 起動方式 | UI | フォーカス |
|---|---|---|---|
| U1-a クリック起動 | アイコンクリック | popover | 奪取 |
| U1-b ホットキー起動 | グローバル shortcut | popover | 奪取 |
| U1-c ホバー表示 | アイコンホバー | tooltip | 奪取しない |
| U1-d 常時表示 | 画面端 sticky | inline input | 奪取しない |
| U1-e Stage Manager 風 | 画面端から swipe | floating panel | 奪取 |

### 入力 UI
- 単一行 input
- 複数行 textarea
- voice button + text
- 直近 capture 履歴付き
- 親ノード dropdown
- AI 提案チップ（タグ候補）

---

## U2. ホットキー（グローバル）

### 候補
| 操作 | 例 keybind | 用途 |
|---|---|---|
| Quick capture | Cmd+Shift+. | 即 input pop |
| Voice capture | Cmd+Shift+V | 録音開始 |
| Clipboard capture | Cmd+Shift+C | クリップボードを scratch |
| Last URL capture | Cmd+Shift+L | アクティブブラウザ URL |
| Image capture | Cmd+Shift+I | screenshot region |

### 衝突回避
- 既存アプリの shortcut と被らない設計
- Karabiner / PowerToys ベース vs ネイティブ実装
- keyboard_modes ブレストの「mode」概念と衝突しない（こちらはグローバル）

---

## U3. 音声常時待機 UI

### バリエーション
| 案 | 録音状態の可視化 | 終了判定 |
|---|---|---|
| U3-a 常時録音 + 波形表示 | 画面隅 mini wave | 句点 |
| U3-b 押下中録音 | アイコン色変化 | キーリリース |
| U3-c wake word | 起動時に通知 | 無音 |
| U3-d ペダル踏みながら | フットスイッチ対応 | リリース |
| U3-e 専用デバイス | Bluetooth ボタン | ボタン |

### フィードバック
- 録音中は赤丸
- 文字起こし中はスピナー
- 完了時に小さな音
- エラー時は赤フラッシュ

---

## U4. メールベース UX

「送信したら忘れる」体験。

### バリエーション
- 送信後の確認: 受信通知メール返信 / アプリ通知 / 静かに保存
- subject パース UI: ダッシュボードで rule 編集
- 取り込み済み通知: 「3件 capture しました」

---

## U5. モバイル共有シート UX

iOS/Android の標準共有から呼ばれる時。

### 案
| 案 | UI | 摩擦 |
|---|---|---|
| U5-a 即保存（UI なし） | 何も出ない、保存して通知 | 最低 |
| U5-b 確認ダイアログ | 「scratch に保存？」 | 低 |
| U5-c タグ選択 | quick tag picker | 中 |
| U5-d 親ノード選択 | recent nodes | 中 |
| U5-e フル編集 | 編集画面 | 高 |

**推し度**: U5-a を default、長押しで U5-c。

---

## U6. ブラウザ拡張 UI

### 表示位置
| 案 | UI |
|---|---|
| U6-a popup | 拡張アイコン → popup |
| U6-b sidebar | サイドバーパネル常駐 |
| U6-c floating | ページ上に floating |
| U6-d context menu | 右クリック |
| U6-e overlay | ハイライト時のミニ UI |

### 取り込み元の事前推定
- arXiv ページなら「論文として取り込み」
- GitHub なら「コード/issue として」
- 一般ページなら「メモとして」

---

## U7. CLI / npx コマンド

開発者向け。

### 例
```
$ m3e capture "今日の発見"
$ m3e capture --voice
$ m3e capture --pdf paper.pdf
$ m3e capture --clip   # クリップボード
$ m3e capture --parent node123
$ cat note.md | m3e capture --stdin
```

### バリエーション
- 同期 vs 非同期
- 結果出力（node id 表示）
- エディタ起動（`$EDITOR` で書く）
- `m3e c` shortcut alias

---

## U8. ドラッグ&ドロップ

### 受け先
- マップ画面に file drop → ノード化
- ノード上に drop → そのノードに添付
- scratch エリア drop → scratch 化
- ブラウザのテキスト drop

### 受け取れる型
- ファイル（PDF/画像/MD）
- テキスト
- URL
- 画像（クリップボード由来）

---

## U9. クリップボード監視

### バリエーション
- 完全自動（コピー全部 → 候補に）
- パターン一致時のみ（URL, DOI 等）
- ユーザーが「直近コピーを捕捉」hotkey
- 履歴ビュー（最近 N 個から選択）

### Privacy 配慮
- opt-in 必須
- パスワード形式は除外
- 機微パターンの除外フィルタ

---

## U10. Markdown ファイル監視

### バリエーション
- `~/m3e-inbox/*.md` を監視 → scratch 化 → ファイル削除
- Obsidian vault 監視 → 特定 frontmatter のみ
- Logseq journal 監視 → 行ベース取り込み
- iCloud / Dropbox 経由でモバイルから

---

## U11. 専用 capture ページ（/capture）

M3E アプリ内の「入力専用」ビュー。

### バリエーション
| 案 | レイアウト | 特徴 |
|---|---|---|
| U11-a シンプル input | 中央に大きな入力欄 | 集中 |
| U11-b ジャーナル風 | 上から下へ追記スタイル | 連続入力 |
| U11-c カード | 入力後即カード化 | 視覚 |
| U11-d ダッシュボード | 直近 capture + 入力 | ステータス感 |
| U11-e タブレット最適 | 大きめタッチ UI | iPad |

---

## U12. 取り込み確認のフィードバック

「ちゃんと入った」感の演出。

| 案 | 視覚 | 聴覚 | 触覚 | 持続 |
|---|---|---|---|---|
| U12-a 無 | 無 | 無 | 無 | - |
| U12-b ミニトースト | 「保存」 | 無 | 無 | 1秒 |
| U12-c フェード | 入力欄が ✓ にフェード | 無 | 無 | 0.5秒 |
| U12-d 音 | 無 | 「pop」 | 無 | - |
| U12-e リッチ | アニメ + 音 + マップ上で着地 | yes | iOS haptic | 2秒 |
| U12-f 統計 | 「今日 12件目」 | 無 | 無 | 1秒 |

**推し度**: チャネル別に変える（C6 と整合）。  
- ホットキー: U12-c（控えめ）
- 音声: U12-d（手は塞がってる）
- モバイル: U12-e（楽しさ）

---

## U13. オフライン挙動とキューイング

### 案
- ネット無し: 全部 localStorage に貯めて、復帰時に flush
- ネット弱い: 同期試行 + リトライ表示
- 完全ローカル: そもそも外部依存無し（PWA + IndexedDB）

### UI
- pending 件数バッジ
- 失敗キューの表示
- 手動再送

---

## U14. 1ノードずつ vs バッチ

### 案
- U14-a 1 capture = 1 ノード（典型）
- U14-b 連続 capture をまとめて1ノード（短時間内）
- U14-c 「セッション開始」「終了」で囲ってバッチ
- U14-d 後で分割可能 / 統合可能

---

## U15. capture 後にすぐ表示するか後でまとめて triage か

### 案 U15-a: 即マップに表示
- ノードが scratch エリアに即出現
- 利点: 確認感、欠点: 注意散漫

### 案 U15-b: 表示せず（バッジのみ）
- 「scratch (12)」のような件数バッジ
- 利点: 集中継続

### 案 U15-c: 別ビュー（capture inbox）
- マップとは別画面
- 利点: 棲み分け明確

### 案 U15-d: ユーザー選択
- 「このセッションは即表示 / 後でまとめて」を切替

---

## U16. capture と triage モードの遷移

「入れる」と「整理する」のモード分離。

### 案
| 案 | 遷移方法 | 利点 |
|---|---|---|
| U16-a 完全分離 | 別画面 | 集中 |
| U16-b モード切替 | 同画面で切替 | 軽快 |
| U16-c 連続フロー | capture → triage が1フロー | 即整理派 |
| U16-d スケジュール | triage は時間予約（朝9時） | 習慣化 |

keyboard_modes の M02 Triage mode と直接接続。

---

## U17. 取り込み中の進捗表示

長時間処理（PDF, OCR, Whisper）の UX。

### 案
- プログレスバー
- ステップ表示（「OCR中...」「構造化中...」）
- バックグラウンドで進めて「完了」通知
- キャンセル可能か
- 部分結果のプレビュー

---

## U18. 取り込み「やり直し」UX

直前 capture を取り消したい時。

### 案
- Cmd+Z で直近 capture 取り消し
- 「最近の capture」リストから削除
- N秒以内なら確認ダイアログで取消可能
- ゴミ箱に入る（完全削除ではない）

---

## U19. 親ノード指定 UI

「どのノードの子として入れるか」をどう選ぶか。

### 案
| 案 | 選び方 | 速さ |
|---|---|---|
| U19-a 常に scratch | 選ばない | ◎ |
| U19-b 直前選択ノード | マップで選んだ最後 | ○ |
| U19-c fuzzy search | 名前検索 | ○ |
| U19-d recent picker | 最近触ったノード | ○ |
| U19-e パンくず picker | 木を辿る | △ |
| U19-f AI 推定 | 自動 suggest | ○ |
| U19-g Bookmark から | bookmark 済から選択 | ○ |

**推し度**: U19-a default + opt-in U19-d/U19-f。

---

## U20. 取り込みプリセット（テンプレート）

繰り返す capture パターンをテンプレ化。

### 例
- 「論文メモ」テンプレ: title / claim / question / mycomment フィールド
- 「日記」テンプレ: 日付プレフィックス + 自由記述
- 「アイデア」テンプレ: idea / 動機 / 障害

### UI
- ホットキー → テンプレ選択 → 入力
- スラッシュコマンド `/idea` `/paper`
- 直近使ったテンプレ優先

---

## UX 横断比較

| UI 案 | 摩擦 | 学習 | 楽しさ | 継続性 |
|---|---|---|---|---|
| U1 menu bar | ◎ | ◎ | ○ | ◎ |
| U2 hotkey | ◎ | ○ | △ | ◎ |
| U3 voice | ◎ | △ | ○ | ○ |
| U6 拡張 | ○ | ◎ | △ | ○ |
| U11 capture page | ○ | ◎ | ○ | △ |
| U12-e リッチ | - | - | ◎ | ○ |

---

## アンチパターン

- ❌ capture に5秒以上かかる UI
- ❌ 「保存しますか？」のような確認ダイアログ多発
- ❌ オフライン時にエラーで突き返す
- ❌ 親ノード必須にする（必要なら scratch にデフォルト）
- ❌ 「適切なタグを選んでください」を強制
- ❌ AI 結果待ちでブロック

---

## 関連 idea/

- `idea/keyboard_modes/05_capture_navigation.md` — Capture mode のキー設計
- `idea/keyboard_modes/09_numpad_quick_input.md` — テンキー高速入力
- `idea/keyboard_modes/02_inbox_modes.md` — Triage mode との接続

---

## 論点 ID 一覧（このファイル）

- U1. メニューバー widget
- U2. ホットキー
- U3. 音声常時待機 UI
- U4. メール UX
- U5. モバイル共有シート
- U6. ブラウザ拡張 UI
- U7. CLI
- U8. ドラッグ&ドロップ
- U9. クリップボード監視
- U10. ファイル監視
- U11. 専用 capture ページ
- U12. 取り込みフィードバック
- U13. オフライン
- U14. 1ノード vs バッチ
- U15. 即表示 vs 後で
- U16. capture/triage モード遷移
- U17. 進捗表示
- U18. やり直し
- U19. 親ノード指定
- U20. プリセット

次ファイル `05_data_privacy.md` でデータ・暗号化・互換性。
