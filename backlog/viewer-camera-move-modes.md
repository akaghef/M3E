# viewer camera move modes — 設計

viewer のカメラ/ビューポート自動追従機能の全体設計。キーマップ割り当ては後回し。

## 0. ゴール

- scope 切替・選択変更・ノード変動などに応じて、カメラを自動で動かせるようにする
- ユーザの手動操作と衝突しない (操作中は止まる、意図を記憶する)
- 機能は直交する4軸 (トリガ × ターゲット × モーション × 意図保全) の組み合わせで定義する
- 最終的にユーザが使うのは「プリセット + 個別トグル」。内部は汎用の合成器

---

## 1. 状態モデル

`viewState` に以下を追加。

```ts
cameraMove: {
  // 有効な triggers (部分集合)
  triggers: Set<"scope" | "selection" | "layout" | "continuous" | "command">;
  // 同 targets。優先順位は array 順
  target: "scopeFit" | "subtreeFit" | "selectionCenter" | "selectionAdaptive"
        | "selectionNudge" | "lockedNode" | "scopeLandmark";
  motion: "snap" | "tween" | "spring" | "panTweenZoomSnap";
  intent: {
    toggle: boolean;                    // α: マスター ON/OFF
    pauseOnUserInput: boolean;          // β
    resumeAfterIdleMs: number | null;   // γ: null なら自動復活しない
    rememberZoomRatio: boolean;         // δ
  };
  // ランタイム状態
  lockedNodeId: string | null;          // F 用
  userFitZoom: number | null;           // δ 用
  userInteractedAt: number;              // β/γ 用
  pending: CameraTarget | null;          // 連続トリガのバッチ
}
```

`CameraTarget` は内部の「次のフレームで向かいたい位置」を表す値:
```ts
type CameraTarget = { cameraX: number; cameraY: number; zoom: number };
```

---

## 2. トリガ (いつ動かす)

| ID | 名前 | 発火元 | 備考 |
|---|---|---|---|
| a | scope | `EnterScopeCommand` / `ExitScopeCommand` | 現行最小挙動 |
| b | selection | `setSingleSelection`, `setRangeSelection`, `toggleSelection` | 選択変更の最後で dispatch |
| e | layout | ノード add / remove / reparent / collapse / expand / importance filter 変更 | `render()` に副作用で絡ませない、明示イベントにする |
| f | continuous | requestAnimationFrame ループ | `lockedNode` 追従時のみ稼働 |
| g | command | `CenterOnSelected` / `FitScope` などのコマンド | ユーザ明示の手動 fit。`intent.toggle` に関係なく常時動く |

**発火口の実装:**
```ts
function triggerCameraMove(reason: "scope"|"selection"|"layout"|"continuous"|"command") {
  if (!shouldFire(reason)) return;         // intent チェック
  const target = computeCameraTarget();     // section 3
  scheduleCameraMotion(target);            // section 4
}
```

`shouldFire` は `reason === "command"` なら常に true。それ以外は `intent.toggle && triggers.has(reason)` かつ β/γ の抑制をクリアしていること。

---

## 3. ターゲット (どこに合わせる)

各ターゲット関数は `() => CameraTarget | null` を返す。`null` なら何もしない。

### A. scopeFit (現 `fitDocument`)
- 現 scope サブツリー全体のバウンディングボックスを viewport にフィット
- ズーム: `min(viewportW/bboxW, viewportH/bboxH) * 0.92`

### B. subtreeFit
- `selectedNodeId` の子孫サブツリー bbox にフィット
- 選択なし or 子なしなら C にフォールバック

### C. selectionCenter
- 選択ノード位置を viewport 中央へ
- ズーム維持 (`viewState.zoom` そのまま)

### D. selectionAdaptive
- C と同じ中央揃え
- ズームは `周辺ノード密度 -> 目標倍率` テーブルで自動
  - 子ノード数 0-2: 1.2× / 3-7: 1.0× / 8-20: 0.7× / 20+: bbox fit
- `rememberZoomRatio (δ)` が ON ならユーザ倍率を基準に ±係数で調整

### E. selectionNudge
- 選択ノードが viewport 内にあれば何もしない (`null`)
- 画面外なら最短距離で選択が枠内 (余白 pad px) に入るよう `cameraX/Y` だけ移動
- ズーム維持

### F. lockedNode
- `lockedNodeId` を追従 (E と同じロジックを常時適用)
- `lockedNodeId === null` なら B → C の順でフォールバック

### G. scopeLandmark
- 現 scope path の末端 folder ノード (= scope root) を viewport 左上余白に寄せる
- サブツリー全体が見える倍率で固定 (scopeFit の左寄せバージョン)
- Miro の「次の部屋に入る」演出向け

**優先度と衝突:**
複数の trigger が短時間に発火したら、最後の target で上書き。ただし target 種類が違うと破綻するケース (fit 中に nudge が来るなど) は `pending` キューで一元化する。

---

## 4. モーション (どう動かす)

### i. snap
- `viewState.cameraX/Y, zoom` を目標値に即代入 → `applyZoom()` と再 render
- 現行 `fitDocument` の挙動

### ii. tween
- 150-250ms の ease-out
- `rAF` ループ、`t = clamp((now - t0) / duration, 0, 1)`, `eased = 1 - (1-t)^3`
- 中断: β が有効かつユーザ入力が来たら `cancelAnimationFrame` し、現在位置で停止

### iii. spring
- stiffness=k, damping=d, mass=1 の 2 次系
- 毎フレーム `v += k*(target-pos)*dt - d*v*dt; pos += v*dt`
- 閾値 (`|v| < 0.01 && |target-pos| < 0.5`) で停止
- 連続トリガに強い (target 差し替え時に速度は保存)

### iv. panTweenZoomSnap
- `zoom` だけ snap
- `cameraX/Y` は tween
- scope 切替時の「拡大率は先に決まってから滑らかにパン」演出

**実装:**
```ts
let motionState: {
  raf: number | null;
  from: CameraState;
  to: CameraState;
  startedAt: number;
  duration: number;
  kind: MotionKind;
} | null = null;

function scheduleCameraMotion(target: CameraTarget) {
  if (motion === "snap") { apply(target); return; }
  cancelMotion();
  motionState = { ...init, to: target };
  motionState.raf = requestAnimationFrame(stepMotion);
}
```

---

## 5. ユーザ意図の保全

### α. toggle
- toolbar 右上に ON/OFF ボタン (alias icon 的な visual)
- OFF の間、`triggers` 由来の発火を全てスキップ。`command` だけ通す

### β. pauseOnUserInput
- `board` の `wheel`, `mousedown (pan)`, `pinch`, `touchmove` に listener
- 発生時刻を `userInteractedAt` に記録、走行中の motion は即停止
- 次の自動発火は γ のルールで判定

### γ. resumeAfterIdleMs
- `null` なら一度止まったら次は α 再 ON まで復活しない
- 数値なら最終入力から N ms 経過後に `triggers` 受付再開
- 実装: フラグ `followPaused: boolean`。`userInteractedAt` からの経過を trigger 受付時にチェック

### δ. rememberZoomRatio
- ユーザが明示 `command` trigger (F / Ctrl+0 など) でフィットした直後、そのときの zoom を `userFitZoom` に保存
- `scopeFit` ターゲットは `userFitZoom` が存在する場合、新 bbox ベース zoom を `zoom_new = natural * (userFitZoom / zoomAtSave)` で比例換算
- 副作用: ユーザが「引き気味で見たい」意図を scope をまたいで保てる

---

## 6. ユーザ向け UI / プリセット

個別の a/A/i/α を露出すると学習コスト過大。**プリセット選択 + 必要な intent だけ個別トグル**。

### プリセット
| 名前 | trigger | target | motion | intent |
|---|---|---|---|---|
| **off** | (command only) | scopeFit | snap | α=off |
| **minimal** | scope | scopeFit | snap | α=on, β=on, γ=null |
| **follow-selection** | scope + selection | selectionNudge | tween | α=on, β=on, γ=2000ms |
| **cinematic** | scope + selection | selectionAdaptive | spring | α=on, β=on, γ=null, δ=on |
| **locked** | continuous | lockedNode | spring | α=on, β=on (自動再開不要) |

デフォルトは **minimal** (現行挙動と同等)。

### UI
- settings パネルに「Camera follow」セクション
- プリセット radio 5個
- 下に「Advanced」折りたたみ、α/β/γ/δ 個別トグル (プリセット選ぶと自動で埋まる、手で上書き可)
- toolbar に α の on/off ボタンだけ常駐

---

## 7. 実装手順 (段階)

1. **Phase 0 (完了済み)**: scope 切替時 snap fit — 現行
2. **Phase 1**: 状態モデル追加 + プリセット **minimal / off** のみ。UI トグル実装
3. **Phase 2**: `selectionNudge` (E) と β 実装 → プリセット **follow-selection** 追加
4. **Phase 3**: tween (ii) 実装。`panTweenZoomSnap` (iv) も同時
5. **Phase 4**: `selectionAdaptive` (D) + `rememberZoomRatio` (δ) → **cinematic**
6. **Phase 5**: `lockedNode` (F) + continuous trigger (f) + spring (iii) → **locked**
7. **Phase 6**: `subtreeFit` (B), `scopeLandmark` (G), `layout trigger` (e) — 需要あれば追加

Phase 1-2 で止めても単体で使える。以降はニーズ次第。

---

## 8. 既存コードの変更面

- **追加**: `beta/src/browser/camera_move.ts` (新規) — ターゲット計算とモーション統括
- **変更**:
  - [`viewer.ts` `fitDocument`](beta/src/browser/viewer.ts#L5477) → 内部で `snap` motion を呼ぶだけに
  - [`EnterScopeCommand`](beta/src/browser/viewer.ts#L3133), [`ExitScopeCommand`](beta/src/browser/viewer.ts#L3157) → fit 呼び出しを `triggerCameraMove("scope")` に置換
  - [`setSingleSelection`](beta/src/browser/viewer.ts#L3041) → 末尾に `triggerCameraMove("selection")`
  - パン/ズーム入力ハンドラ → `userInteractedAt` 更新
- **削除**: `requestAnimationFrame(() => fitDocument())` の二重 fit (tween 化で不要になる)

---

## 9. キーマッピング (予約、後回し)

現在未割当のキーに以下を割り当てる案。正式割当は別タスク。

| コマンド | 候補キー |
|---|---|
| FitScope (手動 `g` trigger) | `F` |
| CenterOnSelected (C ターゲットを手動実行) | `Shift+F` |
| ToggleAutoFollow (α) | `Shift+L` or toolbar のみ |
| LockOnSelected (F 用) | `Shift+K` |
| UnlockFollow | 再度 `Shift+K` / `Esc` |
| CyclePreset | `Alt+F` |

---

## 10. エッジケース / 注意

- **連続 scope 切替**: tween 中に次の trigger が来る → `pending` にキュー、motion を target 差し替えで継続 (spring は自然、tween は `from` を現在位置に更新して再計算)
- **選択が scope 外**: `selectionNudge` は scope サブツリー内の選択にのみ反応、scope 外選択は ignore
- **ロックノードが削除**: `lockedNodeId = null` にリセット、status bar 通知
- **δ の rememberZoomRatio**: scope サイズ差が極端だと倍率比換算が意図を外す → ratio は `[0.25, 4.0]` にクランプ
- **β + motion 進行中**: 停止位置は現フレーム値。中途半端なズームで固まっても OK (ユーザが操作したいから止めた、が主旨)
- **importance filter 変更時の layout trigger**: e にバンドル。`rebuildImportanceVisibility` 直後に発火

---

## 11. 未決事項 (review 必要)

- プリセット名の日本語化の是非
- `resumeAfterIdleMs` のデフォルト値 (2000ms? 5000ms?)
- `selectionAdaptive` の密度テーブルの閾値
- `lockedNode` を `attributes.locked=true` でマップに永続化するか、セッション限定にするか
- スマホ/タブレット (touch) でのパン検出の感度

→ 実装開始前に reviews/Qn として canvas に立てる。
