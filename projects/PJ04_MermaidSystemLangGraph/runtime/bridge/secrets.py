"""Secret loader for PJ04 LangGraph bridge.

Resolution order for each key:
  1. Process env var (e.g. ANTHROPIC_API_KEY)
  2. Bitwarden vault item `api/<service>` (password field), via `bw` CLI
  3. raise KeyError

Usage:
    from runtime.bridge.secrets import get_secret
    api_key = get_secret("anthropic")          # → ANTHROPIC_API_KEY or bw api/anthropic

Vault contract:
    item name: "api/<service>"  (e.g. "api/deepseek", "api/anthropic")
    field    : password = the API key

Caller must have BW_SESSION set in env (i.e. `bw unlock --raw` already done),
or call `with-keys.sh` as the wrapper.
"""

from __future__ import annotations

import functools
import os
import shutil
import subprocess


class SecretNotFoundError(KeyError):
    """Raised when a secret cannot be resolved from env or Bitwarden."""


def _env_var_name(service: str) -> str:
    return f"{service.upper()}_API_KEY"


def _vault_item_name(service: str) -> str:
    return f"api/{service.lower()}"


@functools.lru_cache(maxsize=None)
def get_secret(service: str) -> str:
    """Return the API key for a given service.

    Looks up env var first, then Bitwarden vault item.
    Result is cached for the lifetime of the process.
    """
    env_name = _env_var_name(service)
    if val := os.environ.get(env_name):
        return val

    if not shutil.which("bw"):
        raise SecretNotFoundError(
            f"{env_name} not in env and `bw` CLI not installed"
        )

    session = os.environ.get("BW_SESSION")
    if not session:
        raise SecretNotFoundError(
            f"{env_name} not in env and BW_SESSION not set "
            f"(run `export BW_SESSION=$(bw unlock --raw)` first)"
        )

    item = _vault_item_name(service)
    try:
        result = subprocess.run(
            ["bw", "get", "password", item, "--session", session],
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as exc:
        raise SecretNotFoundError(
            f"bw failed for item {item!r}: {exc.stderr.strip()}"
        ) from exc

    val = result.stdout.strip()
    if not val:
        raise SecretNotFoundError(f"empty value for vault item {item!r}")
    return val


def try_get_secret(service: str) -> str | None:
    """Same as get_secret but returns None on failure instead of raising."""
    try:
        return get_secret(service)
    except SecretNotFoundError:
        return None


__all__ = ["get_secret", "try_get_secret", "SecretNotFoundError"]
