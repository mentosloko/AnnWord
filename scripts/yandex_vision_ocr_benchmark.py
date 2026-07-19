from __future__ import annotations

import base64
import json
import os
import re
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

API_URL = "https://ocr.api.cloud.yandex.net/ocr/v1/recognizeText"
EXPECTED_ROWS = [
    ["HI"], ["KITE"], ["FINE"], ["RIDE"], ["DRIVE"], ["HOME"],
    ["TREE", "HOUSE"], ["CHAIR"], ["TABLE"], ["RADIO"], ["LOOK"],
    ["NICE"], ["BED"], ["LEG"], ["DESK"], ["FLY"], ["SKY"], ["BYE"],
    ["BONE"], ["ROSE"], ["GO"], ["RUN"], ["JUMP"],
]
EXPECTED = [word for row in EXPECTED_ROWS for word in row]
OUT = Path("yandex-vision-benchmark")


def restore_image(prefix: str, output_name: str) -> Path:
    parts = sorted(Path("testdata/yandex-vision").glob(f"{prefix}.b64.*"))
    if not parts:
        raise RuntimeError(f"No base64 chunks found for {prefix}")
    encoded = "".join(part.read_text(encoding="utf-8").strip() for part in parts)
    output = OUT / output_name
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(base64.b64decode(encoded, validate=True))
    return output


def post_ocr(image_path: Path, iam_token: str, folder_id: str) -> tuple[dict[str, Any], float]:
    payload = {
        "mimeType": "JPEG",
        "languageCodes": ["en"],
        "model": "handwritten",
        "content": base64.b64encode(image_path.read_bytes()).decode("ascii"),
    }
    request = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {iam_token}",
            "Content-Type": "application/json",
            "x-folder-id": folder_id,
            "x-data-logging-enabled": "false",
            "User-Agent": "AnnWord-Yandex-Vision-Benchmark/1.0",
        },
    )
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            body = response.read().decode("utf-8", errors="replace")
            return json.loads(body), time.perf_counter() - started
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Yandex Vision HTTP {exc.code}: {body}") from exc


def collect_line_texts(payload: Any) -> list[str]:
    texts: list[str] = []

    def visit(node: Any) -> None:
        if isinstance(node, dict):
            lines = node.get("lines")
            if isinstance(lines, list):
                for line in lines:
                    if isinstance(line, dict) and isinstance(line.get("text"), str):
                        value = line["text"].strip()
                        if value:
                            texts.append(value)
            for key, value in node.items():
                if key != "lines":
                    visit(value)
        elif isinstance(node, list):
            for item in node:
                visit(item)

    visit(payload)
    if not texts:
        full_text_candidates: list[str] = []

        def find_full_text(node: Any) -> None:
            if isinstance(node, dict):
                for key, value in node.items():
                    if key in {"fullText", "full_text"} and isinstance(value, str):
                        full_text_candidates.append(value)
                    else:
                        find_full_text(value)
            elif isinstance(node, list):
                for item in node:
                    find_full_text(item)

        find_full_text(payload)
        for value in full_text_candidates:
            texts.extend(line.strip() for line in value.splitlines() if line.strip())
    return texts


def normalize_words(lines: list[str]) -> list[str]:
    words: list[str] = []
    for line in lines:
        words.extend(token.upper() for token in re.findall(r"[A-Za-z]+", line))
    return words


def levenshtein(left: list[str], right: list[str]) -> int:
    previous = list(range(len(right) + 1))
    for i, a in enumerate(left, start=1):
        current = [i]
        for j, b in enumerate(right, start=1):
            current.append(min(current[-1] + 1, previous[j] + 1, previous[j - 1] + (a != b)))
        previous = current
    return previous[-1]


def evaluate(lines: list[str]) -> dict[str, Any]:
    words = normalize_words(lines)
    remaining = list(words)
    exact_matches: list[str] = []
    for expected in EXPECTED:
        if expected in remaining:
            exact_matches.append(expected)
            remaining.remove(expected)
    return {
        "lines": lines,
        "recognized_words": words,
        "recognized_count": len(words),
        "exact_matches": exact_matches,
        "exact_count": len(exact_matches),
        "exact_recall": round(len(exact_matches) / len(EXPECTED), 4),
        "ordered_word_error_rate": round(levenshtein(EXPECTED, words) / len(EXPECTED), 4),
        "missing": [word for word in EXPECTED if word not in words],
        "extras": [word for word in words if word not in EXPECTED],
    }


def write_summary(report: dict[str, Any]) -> None:
    lines = [
        "# Yandex Vision handwritten OCR benchmark",
        "",
        f"Expected words: {len(EXPECTED)}",
        "",
        "| Input | Exact | Recall | WER | Latency | Recognized words |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for result in report["results"]:
        lines.append(
            f"| {result['name']} | {result['exact_count']}/{len(EXPECTED)} | "
            f"{result['exact_recall']:.2%} | {result['ordered_word_error_rate']:.4f} | "
            f"{result['latency_seconds']} s | {result['recognized_count']} |"
        )
        lines.extend([
            "",
            f"## {result['name']}",
            "",
            "Recognized lines:",
            "",
            "```text",
            *result["lines"],
            "```",
            "",
            "Exact matches: " + (", ".join(result["exact_matches"]) or "none"),
            "",
            "Extras: " + (", ".join(result["extras"]) or "none"),
        ])
    (OUT / "summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    iam_token = os.environ.get("YC_IAM_TOKEN", "").strip()
    folder_id = os.environ.get("YC_FOLDER_ID", "").strip()
    if not iam_token or not folder_id:
        raise SystemExit("YC_IAM_TOKEN and YC_FOLDER_ID are required")

    OUT.mkdir(parents=True, exist_ok=True)
    inputs = [
        ("full-source-photo", restore_image("full", "full-source-photo.jpg")),
        ("cropped-word-column", restore_image("crop", "cropped-word-column.jpg")),
    ]
    report: dict[str, Any] = {
        "service": "Yandex Vision OCR",
        "model": "handwritten",
        "language_codes": ["en"],
        "expected": EXPECTED,
        "results": [],
    }

    for name, image_path in inputs:
        response, latency = post_ocr(image_path, iam_token, folder_id)
        (OUT / f"{name}-response.json").write_text(
            json.dumps(response, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        result = evaluate(collect_line_texts(response))
        result.update({
            "name": name,
            "latency_seconds": round(latency, 3),
            "image_bytes": image_path.stat().st_size,
        })
        report["results"].append(result)
        print(json.dumps(result, ensure_ascii=False, indent=2))

    (OUT / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    write_summary(report)


if __name__ == "__main__":
    main()
