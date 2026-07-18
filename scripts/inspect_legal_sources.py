#!/usr/bin/env python3
"""Temporary diagnostics for reviewing embedded legal source text."""

import re

from generate_legal_pdfs import load_documents

TARGETS = {
    "01_user_agreement.md",
    "02_public_offer.md",
    "03_privacy_policy.md",
    "04_cookie_policy.md",
}
PATTERN = re.compile(
    r"адрес|местонахожд|место нахожд|вариант|заполнить|шаблон|реальному аудиту|8\.2",
    re.IGNORECASE,
)

for name, text in load_documents().items():
    if name not in TARGETS:
        continue
    lines = text.splitlines()
    print(f"=== {name} ===")
    indexes = set()
    for index, line in enumerate(lines):
        if PATTERN.search(line):
            indexes.update(range(max(0, index - 2), min(len(lines), index + 4)))
    for index in sorted(indexes):
        print(f"{index + 1:04d}: {lines[index]}")
