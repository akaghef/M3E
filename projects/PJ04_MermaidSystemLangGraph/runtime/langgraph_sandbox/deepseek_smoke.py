"""DeepSeek API smoke test — confirm key + endpoint + 1 round-trip.

Run with:
    ./projects/PJ04_MermaidSystemLangGraph/scripts/with-keys.sh \
        python projects/PJ04_MermaidSystemLangGraph/runtime/langgraph_sandbox/deepseek_smoke.py

Requires:
    pip install openai
    Bitwarden vault item `api/deepseek` (password = sk-...)
"""

from __future__ import annotations

import sys
from pathlib import Path

# Allow `from runtime.bridge.secrets import ...` when run from repo root or here.
_PJ04_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_PJ04_ROOT))

from runtime.bridge.secrets import get_secret  # noqa: E402

try:
    from openai import OpenAI
except ImportError:
    print("openai package missing. `pip install openai`", file=sys.stderr)
    sys.exit(2)


def main() -> int:
    api_key = get_secret("deepseek")
    client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com")

    resp = client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "system", "content": "Reply in one short sentence."},
            {"role": "user", "content": "Say hello from PJ04."},
        ],
    )
    msg = resp.choices[0].message.content
    print("model:", resp.model)
    print("reply:", msg)
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
