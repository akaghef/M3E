# 操作の代数：要件（草稿 v1）

M3E の製品 Model を書き換える操作を、operation molecule（操作の分子）と operation atom（操作の原子）で厳密に定義するための要件。目的は、node のまわりに蓄積した文脈（Deep KB）を copy・移動・Undo・同期しても、何が起きるかが一意に決まることである。

- 状態: 草稿。【決定】は akaghef の決定、【仮決め】は推奨で仮に置いたもの（akaghef の確認待ち）、【提案】は未決。
- 関連: [DB 仕様書](../../../docs/03_Spec/Database_Spec.md)（不変条件・確定規則・再送・journal）、[record-schema](record-schema.md)、[draft-record-model](draft-record-model.md)、[draft-write-path-commands](draft-write-path-commands.md)、[実装ログ](implementation-log.md)。
- 兄弟順キーの保存形式（on-disk format）は DB 仕様書に書く。この文書は操作の意味論だけを持つ。

## 1. 用語と構造

- **operation atom**: レコード 1 件に対する最小の書き換え。7 種（node の作成・削除・項目の set、parent edge の parent と兄弟順キーは node の項目、scopen / unscopen を含む）。【決定】
- **operation molecule**: 利用者や API から見た一つの操作（set・create・group・dissolve・delete・reparent・join・split・copy・scopen・unscopen・relation edge の link / relink / unlink・alias の作成など）。意味は operation atom の列への展開で定義する。【決定】
- **Command**: operation molecule の順序付き列。確定（commit）の単位であり、Undo・再送（idempotency）の単位。【決定】
- **journal entry**: 確定した Command 1 件の記録。Command の envelope、workspace の seq、レコードごとの base revision と before / after の差分を持つ。Controller ではなく Model 側（サーバの永続化）に属する。【決定】

## 2. 対象範囲

- 製品 Model の全種別を対象にする。アカウントと確定の表は除く。【決定】
- details・配置値など、トポロジー（親子・scope・relation edge・alias の参照）に関わらない値の変更は、一括りの「値の変更」として扱ってよい。【決定】
- 値の不存在 ↔ 存在（field の作成・削除）は、その意味と逆を定義する。
- 「値」と「参照」の境界はレコード・field ごとに列挙する。宣言された参照位置だけを参照として扱い、ID に見える一般の文字列を参照として置換しない。

## 3. Command と確定

1. 不変条件（循環なし、parent edge は scope を 1 つ持ち scope ごとに 1 本の木、など）は Command の最終状態で検査する。拒否時は部分効果を公開も確定もしない。【決定】
2. 同じ基準状態・解決済み payload について、operation molecule の直接評価・operation atom への展開・確定差分の適用の三経路は、製品 Model 全体で一致する。非トポロジー値の存在 / 不存在も含める。
3. 依存閉包に対する局所検査は、同じ最終状態に対する全体検査と同じ結果を返す。全体走査はテストの参照器（oracle）に使う。
4. 公開読取りと snapshot は確定列の prefix に対応し、巨大 Command の部分反映を公開しない。

## 4. Undo

1. Undo は「元 Command の確定効果を復元する 1 Command」。revision は戻さず、新しい確定番号へ進める。【決定】
2. Undo の対象は元の確定効果から固定する。後続変更と衝突したら、初版では Undo 全体を拒否する。【決定】
3. 通常の逆 operation molecule（group と dissolve など）は厳密な逆とは限らない。Undo は逆 molecule ではなく確定差分の復元で定義する。

## 5. 再送（idempotency）

1. 再送の判定キーは `(workspaceId, commandId)`。map 単位ではない。【決定】
2. 保持期間内は、成功・no-op・確定的拒否のいずれも最初の結果を返す。期限切れでは再実行せず期限切れを返す。【決定】
3. 同じキーで内容が異なる依頼は拒否する。既知の結果の照合を、古い base の検査より先に行う。

## 6. replay と同期

1. replay の正本は確定したレコード差分。operation atom の列は意味の定義と検証に使い、確定前に差分との一致を検査する。【決定】
2. 確定 entry は intent から作り直さない。位置の解決・パーサ・scope の推測・ID の生成を replay で再実行しない。再解決するのは未確定の依頼だけ。【決定】
3. 保証するのは「一度決まった確定列に全端末が一致すること」。独立な依頼の到着順が変わっても同じ並びになること（到着順非依存の合流）は保証しない。
4. 作成・削除・復活は、不存在の版（tombstone）を含めて冪等にする。

## 7. 可換性

1. 独立と判定した二つの Command は、どちらの順に確定しても同じ結果になる。独立の判定には書き込み範囲（write footprint）だけでなく読み取り依存（read set）を使う。
2. 独立と証明できないことだけを拒否の理由にしない。順序の競合は 8 節の合流規則に従う。

## 8. 兄弟順

【決定】兄弟順は ID ではなく相対値（番号）で持つ。順序の決着（tie-break）に ID を使わない。同時の挿入・移動は拒否せず、柔軟に合流させる。

【決定】次の三点も推奨どおりに決めた。

1. **同じ node の同時移動**: 一つの node は一か所にしか置けないので、両方の依頼を処理したうえで、seq の順で後に確定した有効な依頼の位置を採る（LWW）。offline から遅れて届いた移動も反映する。cycle を作る move など最終不変条件に反するものは reject する。
2. **確定側による位置値の解決**: 確定側が、新規・移動対象自身の位置値だけを解決し直す（Figma 型の fractional indexing）。非対象の兄弟の再採番と、ID による tie-break は禁止する。
3. **ブロックの連続性と、失われた位置参照**: 同じ隙間に入る互いに交わらないブロックは混ぜない（non-interleaving）。後からブロックの内部へ挿入して分断されるのは許す。依頼が基準にした兄弟が消えていたら、右隣の直前 → 左隣の直後 → 末尾の順で解決し、解決後の位置を結果として返す。

保存形式:

- 兄弟順キーは parent edge の `ord`。`fractional-indexing` ライブラリの base62 の key（`0-9A-Za-z`、整数部の頭文字＋小数部、末尾 `0` なし）で、文字列として（code unit 順で）比べる。
- 同じ親の下で `ord` は一意（不変条件）。
- 等しい `ord` は移行前のデータにだけ起こりうる。その兄弟の間へ入れる Command は、等しい key を持つ兄弟の振り直しを同じ Command に含める。非対象の兄弟の再採番を禁じる規則の、唯一の例外である。
- 以前の base36 の key（`1`、`h` など）は有効な key ではない。読み込んだ時点で新しい key に振り直す（一度だけの移行）。

振る舞い:

| 場面 | Before → 依頼 | After |
|---|---|---|
| 同じ隙間への同時挿入 | `[L,R]`、X と Y が L・R の間へ。X → Y の順に確定 | `[L,X,Y,R]`。L・R の値は不変 |
| 同じ node の同時移動 | `[a,x,b]`、「x を a の前」→「x を b の後」の順に確定 | `[a,b,x]` |
| ブロック移動 | `[L,R]` へ `[a,b]` と `[x,y]` が同じ隙間へ | `[L,a,b,x,y,R]`（`[a,x,b,y]` にしない） |
| offline の合流 | `[L,R]`、offline の X 挿入の間に Y が確定 | 未確定の「L と R の間へ X」を `[L,Y,R]` に再適用し `[L,Y,X,R]` |
| replay | 上の確定列 | 確定した位置値を差分から適用する。位置の再計算はしない |

- 位置値の生成には `fractional-indexing`（`generateKeyBetween` / `generateNKeysBetween`）を使う。固定精度では表せなくなるので、可変長の表現にする。キー長の成長を計測する。
- Loro の MovableList・Tree は同じ位置の衝突を PeerID で決めるため、この方針のままでは使えない。Yjs の Y.Array は delete＋insert で move を表すので、同じ node の同時移動を解けない。
- 受入テスト: 上の五つの場面。参照の対応を保ったまま ID を全部置き換えても並びが変わらないこと。確定済み差分の配送順・重複を変えても、同じ確定列を適用すれば同じ結果になること。

## 9. scope と展開の方向

【決定】同じ node を root とする複数の scope は、同じ node から出る意味の違う展開の方向（たとえば detail の方向の木と、task だけの所属の整理）である。

1. scope ごとの parent edge の集合は互いに素。root は共有してよい。
2. 【保留】scope をまたぐ移動は当面実装せず、確定する側で未対応として拒否する（[同期の要件](sync-requirements.md) R2.4、[DB 仕様書](../../../docs/03_Spec/Database_Spec.md) 5.2 節規則 8 の【決定】）。将来実装するときの意味論は、対象の node に入る parent edge と、同じ scope の中で続く子孫側の parent edge の閉包を一緒に移し、別の方向の scope の parent edge には触れず、Undo は実際の所属変更を復元するものとする。
3. scopen / unscopen は主選択の 1 node だけを対象にする。複数の対象を列挙した依頼は拒否する。【決定】
4. scopen は、選んだ直接の枝の閉包を新しい scope に移す。任意の部分集合は指定できない。
5. unscopen は対象の scope を scopeId で指定し、戻し先を明示する。
6. 【仮決め】unscopen で、処分の方針が決まっていない所有データ（linear-text・注釈・既定でない Surface View の設定）があれば拒否する。明示した移管・削除だけを同じ Command に含める。同じ root の別の scope へ自動で合流させない。
7. 【仮決め】scope の移動だけでは relationType を変えず、推論もしない。
8. 同じ実体を二つの方向に置くときは alias を使う。alias は子を持てるが、その子はその alias が載る面での子であり、参照先の実体が正本の面で持つ子とは別の集まりである（[DB 仕様書](../../../docs/03_Spec/Database_Spec.md) 4 節不変条件 3・12.2 節の【決定】）。したがって、alias は子孫を共有して両方向に展開する仕組みではない。
9. 受入要件: scopen / unscopen の結果は viewer の有無に依存しない。

## 10. relation edge と alias

1. relation edge の向きは正規形で持つ。端点を交換するときは端点ごとの port も交換し、効果と逆に含める。両端を同時に付け替える relink を持つ。
2. 【決定】（akaghef、2026-11-22）同一端点・同一 relationType の relation edge の重複は不変条件では禁じない（多重エッジを構造上許容する）。重複抑止は link 操作の便宜に留め、relink や relationType の変更で重複が生じることは不変条件違反としない。
3. 【決定】参照先が削除された alias は「broken link」の状態として残す。target の ID を保持し、同じ identity が復活（Undo など）したら再解決する。その間に alias の target が別のものへ変わっていたら、古い参照へ戻さない。

## 11. copy

- 【合意済みの枠組み】hard copy は新しい実体（新しい ID）、alias は copy ではなく参照（ポインタ）である。部分木 copy と scope copy の保持義務は [MCP の操作規約](../../../docs/protocols/mcp-map-operations.md)の決定に従う。
- 【仮決め】copy の種類:

| 種類 | 範囲 | relation edge | alias | scope | attribute・collapsed | 来歴 |
|---|---|---|---|---|---|---|
| deep copy | 選んだ根とその子孫すべて。新しい ID | 両端が範囲内なら複製し端点を remap。境界をまたぐものは既定では複製しない | 範囲内の alias は複製。外側を指す target は共有 | 範囲内の scope は複製 | 複製（collapsed は Model なので複製） | 元・基準 revision・方式・ID 対応を記録 |
| shallow copy | 選んだ node だけ。選択内の直接の親子関係は保つ | 両端が選択内なら複製 | 同上 | 作らない | 複製 | 同上 |
| scope copy | scope を deep copy。同じ root の別の方向の scope は含めない | deep と同じ | deep と同じ | linear-text・注釈・scope の定義・Surface View の保存設定・内部の配置値の参照も保持 | 複製 | 同上 |
| alias の作成 | copy ではない | — | target を参照 | — | — | — |

1. 選択の和集合に一つの ID 対応を使う。選んだ根をまたぐ内部参照は一度だけ remap する。
2. 宣言された参照だけを remap する。
3. 【仮決め】deep copy の外側を指す参照は共有する。よって独立性が保証されるのは複製した実体と構造だけで、「copy 後は何を編集しても元に影響しない」ではない。
4. 【仮決め】copy の来歴は Deep KB の来歴として、journal を圧縮しても失わない形で残す。
5. 既存の [Multi_Select.md](../../../docs/03_Spec/Multi_Select.md) の貼り付け規則（alias・link のメタデータと collapsed を落とす）はこの節と食い違っている。この節の確定時に直す。

## 12. dissolve と join で失われる内容

骨格: 保持・移送・削除・拒否を値と参照ごとに定め、決めていないものを暗黙に捨てない。

【仮決め】既定の動作:

| 例 | Before → 操作 | 既定 |
|---|---|---|
| 条件と根拠を持つ中間 node | 中間 node「低温試験」の details に「−10℃以下で実施した結果のみ」、外から「根拠」の relation edge。これを dissolve | 拒否（条件と根拠の行き先がない） |
| 数値と単位を持つ葉の join | 葉「翼幅」の attribute 2.5 m、葉「重量」の attribute 18 kg。本文だけで join | 拒否（数値と単位が消える） |
| 中身のない仮の中間 node | 色と配置だけを持つ中間 node を dissolve | その node 自身の色と配置の削除を、操作の仕様として明示して許す |

移送は、移す先と意味を定めた場合だけ認める。

## 13. 正規化と対象

1. 対象の正規化は operation molecule ごとに定義する。
2. 異なる親にまたがる group は拒否する。split は明示したリストの範囲を固定する。

## 14. ViewState

ViewState だけの変化は、Model・journal・他者の選択や camera を変えない。見え方に依存する依頼は、具体的な値へ解決してから送る。

## 15. 網羅性

全製品 Model の作成・更新・削除を operation molecule / operation atom で表現できること。親子・scope・relation edge・alias の参照の変更を、未定義の副作用にしない。テスト: 公開操作と全レコード種別の網羅、値の作成・削除・Undo。

## 16. 実装者が決めてよいもの

- 位置値の符号化・比較・索引（`fractional-indexing` の採用、版の固定、ID 全置換試験、キー長の計測）。
- 「値」と「参照」の境界の field ごとの列挙。
- tombstone・適用記録・再送の receipt・巨大 Command の staging の保存方式。7 節までの保証を変えない範囲で選ぶ。
- unscopen が viewer の有無で結果を変える不具合の調査（scopeId・依頼の base・確定側の版・実際の競合対象を比べる）。
