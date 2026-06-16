# Open Questions

会話ログから見て、まだ固める必要がある点。

## D1. 正本 schema

JSON document model をどの粒度で定義するか。`PersistedDocument` / `SavedDoc` / SQLite table の名前と責任を揃える必要がある。

## D2. tree vs edge

主親子構造を `tree` と呼ぶか、`edges(type=parent)` と呼ぶか。LLM通信では `tree` の方が混線が少ないが、内部モデルでは edge 一元化もありうる。

## D3. attrs 型体系

`type` を `str|int|num|bool|enum|list|json` 程度にするか、enum registry を持つか。

## D4. core_i64 vocabulary

`polarity`, `dependability`, `status`, `confidence` の enum/range を固定する必要がある。ここが M3E の意味論の中核になる。

## D5. Command op 語彙

最低限は `add_node`, `delete_node`, `move_node`, `set_label`, `set_attr`, `add_link`, `delete_link`。alias/scope専用 op を分けるかは未決。

## D6. validation failure

LLMが出した command が cycle/scope/alias 制約に反したとき、reject only か repair allowed かを op ごとに定義する必要がある。

## D7. format labels

MF-H / MF-L / MF-M / M3E.Context / M3E.Command の役割を混ぜない。MFは表示制御、M3E.*は通信DTOとして切るのがよい。
