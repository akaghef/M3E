# 04. 構造変更系モード

ツリー構造そのものを変えるモード群。
共通: **誤操作のリスクが高い → undo / preview / 安全装置が重要**。

## M09. Restructure Mode

**シーン**: ノードの親変更や並び替えを連続的にやる。
通常モードでもやるが、**「何度も繰り返す時」に専用モードがあると速い**。

**1キーで打ちたい操作**:
- 上下キー → 兄弟内移動
- Tab / Shift+Tab → インデント / アウトデント
- 親変更 → 別の親をパレットで選択
- swap-with-sibling → 隣と入替
- promote-to-root → ルート直下へ
- demote-into-prev-sibling → 直前の兄弟の子に
- group-with-next-N → 続く N 件と一緒に新しい親にまとめる
- split-here → 現ノードを分割（前半／後半）
- extract-as-sibling → 子の1つを兄弟に昇格
- preview-before-commit → 移動先をハイライトして Enter で確定
- undo-last-move
- bulk: 選択中の複数ノードを一括移動

## M10. Link Mode

**シーン**: ノード間に関係（references / blocks / depends-on / contradicts 等）を張る。

**ステップ**: 1) 起点ノード選択 → 2) link mode 突入 → 3) 終点を1キー操作で指定 → 4) 種類を選択

**1キーで打ちたい操作**:
- pick-target-by-search → fuzzy 検索で終点
- pick-target-by-jump → 番号ジャンプ表示
- pick-target-by-recent → 最近触ったノード Top9
- 種類選択: r/b/d/c/q (references/blocks/depends-on/contradicts/question-of)
- bidirectional-toggle → 一方向 / 双方向
- weight-by-number → 数字キーでリンク強度
- delete-link → 既存リンクを外す
- inspect-link → 現リンクの詳細表示
- next-incoming / next-outgoing → 既存リンクを巡回

**派生**: M10a. **Citation mode** — 学術文脈で引用関係を貼ることに特化。
論文ノードと結論ノードを cite/cited-by で結ぶ操作だけに絞る。

## M11. Cleanup Mode

**シーン**: 古いノード、重複、空ノード、未参照ノードを掃除する。

**キュー定義候補**:
- 空 text のノード
- 1ヶ月以上更新なしの archive 候補
- 重複疑い（テキスト類似度 > 閾値）
- 未参照（リンクされていない）孤立ノード

**1キーで打ちたい操作**:
- delete → 即削除（safe: 30日 trash へ移動）
- archive → archive 配下へ
- merge-with-suggested → 重複候補とマージ
- keep → 「掃除対象から外す」マーク（除外リストへ）
- inspect → 削除前に詳細表示
- skip → 後回し
- restore-from-trash → 戻す

## M12. Bulk Select Mode

**シーン**: 複数ノードを選んで一括操作する。

**選択方法（1キー）**:
- click-to-add → 通常クリックを「追加」に変更
- select-siblings → 兄弟を全選択
- select-subtree → 配下全部
- select-by-attribute → 属性が一致するもの全部
- select-by-search-result → 検索結果を全選択
- invert → 反転
- clear → 解除

**一括操作（1キー）**:
- delete-all
- move-all-to → 親をパレットで指定
- tag-all
- status-all
- color-all
- export-all
- duplicate-all
- merge-into-one

**論点 St1**: 選択状態の永続性
- モード抜けたら解除 / 通常モードでも保持

## モードまたぎの観察

構造系は **「移動先・終点」の指定** が共通課題。
- 検索で指定 / 番号ジャンプ / 最近触った Top9 / マウスでクリック
- これらは `pickTarget()` として共通化可能

**論点 St2**: 構造変更の preview
- 即座に反映 / Enter まで preview / 全部 preview の3段階

**論点 St3**: 安全装置レベル
- すべて undo 可能なら preview 不要 → 軽い
- Vault 同期があるなら preview 必須 → 安全

**論点 St4**: 「なんとなく今これをやりたい」を推測する補助モード
- 例: 大量の scratch を選択した状態で起動 → triage を推奨
- 例: review queue が溜まっている → review mode を推奨
- 起動補助は便利だが、勝手に動くのは怖い → 「提案するだけ」程度
