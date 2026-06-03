# Swingby 定例会 公開リンク運用メモ

日付: 2026-05-02

## 目的

Swingby 定例会マップを、akaghef ホストの M3E beta viewer から一時公開する。

## 固定値

- workspace: `ws_team_swingby`
- map: `map_team_swingby_monthly_2604`
- map label: `定例会`
- April scope 表示: `4月`
- public base: `https://akaghef-dell.tail6206ae.ts.net`

## 配布リンク

閲覧用:

```text
https://akaghef-dell.tail6206ae.ts.net/viewer.html?ws=ws_team_swingby&map=map_team_swingby_monthly_2604&access=view
```

編集用:

```text
https://akaghef-dell.tail6206ae.ts.net/viewer.html?ws=ws_team_swingby&map=map_team_swingby_monthly_2604&access=edit
```

## 起動

```bat
scripts\internal\launch-swingby-server.bat
```

この launcher は `localhost:4173` を `ws_team_swingby` / `map_team_swingby_monthly_2604` で起動する。
Tailscale Funnel は Secretary 側で有効化済み。

## VM からの公開リンク検証

```bat
scripts\ops\vm_public_meeting_link_test.bat
```

成功条件:

- `viewer.html` が HTTP 200
- `/api/maps/map_team_swingby_monthly_2604` が HTTP 200
- root が `定例会`
- `4月` scope が存在
- node count が 80 以上

## 会議後の停止

```bat
tailscale funnel --https=443 off
```

URL を持つ人は tailnet 外からもアクセスできるため、会議後は Funnel を止める。
