# Flash 生成とスコープ追加 API

外部エージェントは、通常 Beta のローカル API に生成入力と配置先を渡す。
既存の Flash gateway が生成し、取得した木構造を Map Manager semantic service / Core 経由で指定親の末尾へ追加する。
生成結果の root だけが scope となり、内部ノードは通常ノード。既存兄弟は変更しない。

## 呼び出し

`POST /api/flash/jobs` (`Content-Type: application/json`)

```json
{
  "request_id": "caller-stable-request-key",
  "target": "m3e://maps/<map>/nodes/<parent>",
  "source": {"type": "text", "text": "生成対象の本文"},
  "language": "ja"
}
```

`target` は `m3e_get` で解決した canonical URI を推奨する。表示名パスも受理するが、受付時にURIへ固定する。
任意で `title`, `instruction` を指定できる。
sourceは既存Flash契約の `topic/text` + `text`、`url/audio/video` + `url`、またはファイル種別 + `filename/mime_type/base64`。
この入口のJSON全体は64 MiBまで（添付のbase64を含む）。生成サービス側の入力制限は別途適用される。ローカルパスの読み出しは行わない。

受付は202と `job_id`, `state`, `target` を返す。
`GET /api/flash/jobs/<job_id>` で状態を取得する。
`succeeded` は生成完了だけでなく、M3Eへの保存完了を意味する。
`result.scope` は作成したscopeのURI/name、`node_count` は生成木のノード数。

## 再試行と復旧

同じ `request_id` と同じ入力・targetは同じジョブを返す。異なる内容へのキー再利用は拒否する。
一つの生成木・scope境界・重複防止マーカーを一回のCore保存でcommitする。
保存成功後に応答／ジョブ記録が失われても、マーカーにより再追加を防ぐ。
ジョブはworkspaceの `flash-jobs/<DB filename>/` に保存し、通常起動時にprocessingを再開する。
35分で未確定なら `indeterminate` とし、新しいキーでの再生成前に既存結果を確認する。
生成失敗・不正な木・保存競合は成功扱いにせず、既存マップを保持する。

## 検証・境界

loopback/Host/Origin検査はMCP入口と共通。外部公開や認証変更を含まない。
Flash接続は既存clientの `connection.json` を利用する。`FLASH_CLIENT_CONFIG` で環境別のファイルを指定可能。
接続先・トークンはサーバー側だけで扱い、API応答には含めない。
ジョブファイルには入力資料が含まれるため、ディレクトリ0700／ファイル0600で保存する。

Map Managerの `m3e_create(kind=import_structure)` は明示的なscope取り込み操作。
単一root、最大1000ノード、重複ID・欠落・循環・所有矛盾・到達不能ノードを検査する。
各入力ノードの任意の `attributes` を既存の属性検証を通して保存する。
親子辺のラベルは子ノードの `attributes["m3e:edge-label"]`、出典は既存の属性として渡す。
ラベルをGraphLinkへ変換せず、本文・兄弟順序・scope境界も保持する。
不正な属性が一つでもあれば部分保存しない。rootの重複防止マーカーは入力属性では上書きできない。
生成内容の数学的正しさや参照の完全性は、このAPIの成功条件には含まれない。

単体試験は診断用providerと実Core・一時SQLiteで失敗時保持、指定親、scope化、再送、commit後再開を検査する。
実gateway→通常Beta→指定親の受け入れ結果は、個別の運用監査記録に残す。

## 生成済み結果の取り込み再開

`POST /api/flash/jobs/<job_id>/retry-import` は、生成サービス側の成功を再確認し、同じ生成結果・同じ配置先・同じ重複防止キーで取り込みだけを再開する。
生成未完了・生成拒否はこの操作の対象外であり、再生成を起こさない。成功済みジョブへの再送も追加を重複させない。
ノード本文は改行を含めてそのまま保持する。改行は既存TreeNodeの本文表現であり、木構造の不正とは扱わない。単一root、所有関係、到達性、重複ID等の検証は維持する。
