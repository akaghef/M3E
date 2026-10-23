#!/usr/bin/env bash
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
set +e
git grep -I -l -i 'nisimori[y]uuya' -- .
result=$?
set -e
if [ "$result" -eq 0 ]; then
  echo 'Retired personal identifier found. Rewrite source, fixtures, and historical documents before publishing.' >&2
  exit 1
fi
test "$result" -eq 1
