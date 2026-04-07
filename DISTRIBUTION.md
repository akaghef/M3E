# M3E — Distribution & Setup Guide

## Requirements

| Requirement | Version |
|-------------|---------|
| Windows     | 10 or later |
| Node.js     | 20 LTS or later ([nodejs.org](https://nodejs.org/)) |

No other software is needed. The app runs entirely offline via a local web server and opens in your default browser.

---

## First-time Setup (End User)

### Step 1 — Download the app

Clone or download this repository:

```
git clone <repo-url>
```

Or download and unzip the `.zip` archive from the release page.

### Step 2 — Run the installer

Double-click **`install.bat`** in the root folder.

The installer will:
1. Check that Node.js is installed
2. **Ask where to save your data file** (the SQLite database)
   - Press Enter to use the default: `%APPDATA%\M3E`
   - Or type any folder path, e.g. `D:\MyDocs\M3E`
3. Install dependencies and build the app
4. Save your chosen location to `%APPDATA%\M3E\m3e.conf`
5. Create a **desktop shortcut** (`M3E.lnk`)
6. Optionally launch the app immediately

> Your data is saved as a single file: `rapid-mvp.sqlite` in the folder you chose.

### Step 3 — Daily use

Double-click the **M3E** shortcut on your desktop.

The app starts a local server on port `38482` and opens your browser to:
```
http://localhost:38482/viewer.html
```

To quit, close the browser tab and close the terminal window (or press Ctrl+C in it).

---

## Changing the Save Location

Re-run `install.bat` — it will prompt for a new path and update the config.

Or edit `%APPDATA%\M3E\m3e.conf` directly:

```
M3E_DATA_DIR=D:\MyDocs\M3E
M3E_PORT=38482
```

---

## Updating the App

```bat
scripts\final\migrate-from-beta.bat
```

This pulls the latest source, rebuilds, backs up your database, and restarts the app.

---

## Distributing to Others

### What to share

Share the entire repository folder (or a zip of it). The recipient needs:
- The repo/zip
- Node.js installed

They run `install.bat` and the rest is automatic.

### What NOT to include in the zip

The following are excluded by `.gitignore` and should stay out of any distribution package:

```
final/node_modules/
final/dist/
beta/node_modules/
beta/dist/
*.sqlite
data/cloud-sync/
```

The installer builds everything fresh on the user's machine.

### Minimum file set for distribution

If you want to ship a minimal zip (not the full git repo), include:

```
install.bat
final/              (source only, no node_modules/dist)
scripts/final/
LICENSE
```

---

## Configuration Reference

All settings are optional. Defaults work out of the box.

| Variable | Default | Description |
|----------|---------|-------------|
| `M3E_DATA_DIR` | `%APPDATA%\M3E` | Folder where `rapid-mvp.sqlite` is stored |
| `M3E_PORT` | `38482` | HTTP port for the local server |
| `M3E_CLOUD_SYNC` | _(off)_ | Set to `1` to enable cloud sync |
| `M3E_CLOUD_DIR` | `<data>/cloud-sync` | Cloud sync directory |

Config file location: `%APPDATA%\M3E\m3e.conf`

---

## Troubleshooting

**"Node.js is not installed"**
Download from https://nodejs.org/ and run `install.bat` again.

**"Build failed"**
Run `install.bat` again. If it fails repeatedly, check that you have an internet connection (for `npm ci` to download packages).

**App won't start / port already in use**
The launcher kills any existing process on port `38482` automatically.
If you changed the port in `m3e.conf`, make sure no other app is using it.

**Data file location**
Check `%APPDATA%\M3E\m3e.conf` to see where your data is stored.
Your database file is: `<M3E_DATA_DIR>\rapid-mvp.sqlite`

**Reset to defaults**
Delete `%APPDATA%\M3E\m3e.conf` and re-run `install.bat`.
