#!/usr/bin/env python3
"""Temporary diagnostics for reviewing embedded legal source text."""

import re

from generate_legal_pdfs import load_documents

PATTERN = re.compile(
    r"\[[^\]]+\]|до публикации|необходимо выбрать|необходимо заполнить|"
    r"выбрать и заполнить|заполнить по|реальному аудиту|вариант [А-ЯA-Z]|"
    r"таблица должна быть дополнена|требует технической проверки|"
    r"предусмотрены или обнаружены|если активен|можете выбрать|вставить адрес|"
    r"указать адрес|указать страну|шаблон",
    re.IGNORECASE,
)

for name, text in load_documents().items():
    lines = text.splitlines()
    matches = []
    for index, line in enumerate(lines):
        if PATTERN.search(line):
            matches.append((index + 1, line))
    if not matches:
        continue
    print(f"=== {name} ===")
    for line_number, line in matches:
        print(f"{line_number:04d}: {line}")
