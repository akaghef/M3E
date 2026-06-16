# M3E macOS Installer

This directory contains the macOS install package scripts.

## Build Package

From the repository root:

```sh
install/mac/scripts/build-package.sh
```

The builder prepares:

- `install/mac/payload/app`
- `install/mac/payload/runtime`
- `install/mac/payload/seeds`
- `install/mac/manifest.json`

By default it builds `final/`, copies the final app payload, and uses the
currently installed M3E runtime if available. If no local runtime exists, it
downloads a macOS Node.js runtime matching the Node version used to run the
builder.

## Install

From the repository root or from an extracted `install/mac` package:

```sh
install/mac/setup.sh
```

Options:

- `--desktop-link` creates `~/Desktop/M3E.command`
- `--no-verify` skips post-install verification

The install target is:

```text
~/Library/Application Support/M3E
```

Runtime data is kept outside Git and is not removed by app updates.

## Runtime Commands

After setup:

```sh
"$HOME/Library/Application Support/M3E/launch.sh"
"$HOME/Library/Application Support/M3E/verify.sh"
"$HOME/Library/Application Support/M3E/collect_report.sh"
```

Uninstall modes:

```sh
"$HOME/Library/Application Support/M3E/uninstall.sh" --mode app
"$HOME/Library/Application Support/M3E/uninstall.sh" --mode app-logs
"$HOME/Library/Application Support/M3E/uninstall.sh" --mode all
```
