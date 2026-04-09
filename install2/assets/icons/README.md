# Icon Assets (install2)

このディレクトリは `install2` 用のアイコン資産をまとめる場所。

## ファイル

- `m3e-app.svg`
  - アイコンの編集元
- `m3e-app.png`
  - 256x256 プレビュー
- `m3e-app.ico`
  - Windows ショートカット / Inno Setup 用

## 差し替え手順（macOS）

```bash
magick install2/assets/icons/m3e-app.svg install2/assets/icons/m3e-app.png
magick install2/assets/icons/m3e-app.png -define icon:auto-resize=256,128,64,48,32,16 install2/assets/icons/m3e-app.ico
```

## 差し替え手順（Windows PowerShell）

ImageMagick 導入済みの場合:

```powershell
magick install2\assets\icons\m3e-app.svg install2\assets\icons\m3e-app.png
magick install2\assets\icons\m3e-app.png -define icon:auto-resize=256,128,64,48,32,16 install2\assets\icons\m3e-app.ico
```
