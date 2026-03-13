以下は「ノードAをドラッグして、別の親P’の子に付け替える」一連操作を、MVC（＋Command）で忠実に流した場合の連携です。Konva等の有無に依存しない抽象形で書きます。

前提の責務
Model：ツリー整合性を保証しつつ、Commandを適用・Undo記録・変更通知
View：Canvas描画のみ
Controller：入力列を解釈し、HitTest結果を用いてCommandを作りModelへ渡す
HitTest：座標→対象（nodeId等）を返す
ViewState：カメラ、選択、ドラッグ中のプレビュー状態

初期状態
ViewはModelのsnapshotを描画している。ControllerはIdle。

pointerdown（ノードA上）
(1) Browser → Controller に pointerdown
(2) Controller は HitTest(point) を呼ぶ
(3) HitTest は nodeId=A を返す
(4) Controller は内部状態を Pressed(A) にする（ドラッグ開始候補）
(5) ViewState に activeNode=A, dragStartPos を記録（任意）
(6) まだModelは変更しない（クリック判定のため）

pointermove（閾値超えでドラッグ開始）
(1) Browser → Controller に pointermove
(2) Controller は「移動距離が閾値超え」を確認し DraggingNode(A) に遷移
(3) Controller はドラッグ中プレビューを更新
　・ViewState.dragPos を更新（Aの表示位置だけ一時的に動かす）
(4) Controller は必要なら HitTest を呼び「ドロップ先候補」を検出
　・HitTest(point) → nodeId=P’（候補親）または background
(5) ViewState.hoverDropTarget=P’ を更新（ハイライト用）
(6) Modelはまだ変更しない（確定はdrop時）

pointermove（ドラッグ継続）
(1) 同様に dragPos を更新
(2) 同様に dropTarget候補を更新
(3) Viewは subscribe しているので、ViewStateの更新に応じて再描画（方式は任意）
　※ここは「Model変更通知」でなくても良い。ドラッグ中はViewState駆動で再描画してよい。

pointerup（ドロップ確定）
(1) Browser → Controller に pointerup
(2) Controller は最終位置で HitTest(point) を呼び、dropTarget候補を確定
　・HitTest(point) → nodeId=P’（候補親）
(3) Controller は「付け替えが成立する条件」を最低限チェック
　・P’が存在する
　・A自身ではない
　・（任意）Aの子孫ではないか、など
　※厳密チェックはModelに任せてもよいが、明らかな誤りはここで弾くとUXが良い。
(4) Controller は Command を生成
　・ReparentNodeCommand(nodeId=A, fromParent=P, toParent=P’, fromIndex=i, toIndex=j)
　※fromIndex/toIndexは並び順を保存したいなら必要。最小なら親だけでもよい。
(5) Controller → Model.apply(command) を呼ぶ（ここが唯一の状態変更入口）

Model.apply(command)
(1) Modelは内部で制約検証
　・ツリーが循環しない
　・scope制約、alias制約など
(2) OKなら状態を更新（親をP→P’へ）
(3) undoStackにcommandをpush（redoStackはクリア）
(4) Modelが “changed” を通知（emit/subscribe）

View更新
(1) View（Renderer）は Model.changed を受け取る
(2) 最新snapshotを読み、Canvasを再描画
(3) Controllerはドラッグ状態をIdleに戻し、ViewStateの一時状態をクリア
　・dragPos/hoverDropTargetなど

Undo/Redo（参考）
Undo操作（Ctrl+Z等）
(1) Browser → Controller に keydown
(2) Controller → Model.undo()
(3) Modelは最後のcommand.undoを実行し、changed通知
(4) View再描画

重要な設計上の注意
・ドラッグ中の「見た目の追従」は、Modelを書き換えずViewStateで行う方が安全です。確定時だけCommandを発行します。
・「親付け替え」の正当性（循環、scope、alias等）はModelが最終責任を持つべきです。ControllerはUX向上のための軽い事前判定まで。
・Commandには「元の親情報」を必ず入れます。Undoに必要です。