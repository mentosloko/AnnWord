from __future__ import annotations

import base64
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from PIL import Image

API_BASE = "https://openrouter.ai/api/v1"
EXPECTED_ROWS = [
    ["HI"], ["KITE"], ["FINE"], ["RIDE"], ["DRIVE"], ["HOME"],
    ["TREE", "HOUSE"], ["CHAIR"], ["TABLE"], ["RADIO"], ["LOOK"],
    ["NICE"], ["BED"], ["LEG"], ["DESK"], ["FLY"], ["SKY"], ["BYE"],
    ["BONE"], ["ROSE"], ["GO"], ["RUN"], ["JUMP"],
]
EXPECTED = [word for row in EXPECTED_ROWS for word in row]
PREFERRED_MODEL_IDS = [
    "nex-agi/nex-n2-pro:free",
    "moonshotai/kimi-k2.6:free",
    "moonshotai/kimi-vl-a3b-thinking:free",
]

PROMPT = """You are a strict OCR engine, not a conversational assistant.

The image contains one vertical column from a handwritten English vocabulary notebook. Extract only the handwritten English vocabulary words in that column, reading from top to bottom.

Rules:
- Ignore the printed heading, notebook ruling, brackets, transcription, Russian text and any neighbouring columns.
- Preserve the visible spelling. Do not translate, explain or invent missing words.
- A row may contain more than one English word.
- Include every readable vocabulary row and keep the original order.
- If a row is unreadable, include the row with an empty words array.

Return JSON only, using exactly this shape:
{"rows":[{"row":1,"words":["example"]}],"all_words":["example"]}
"""


def request_json(url: str, api_key: str, *, method: str = "GET", payload: dict[str, Any] | None = None, timeout: int = 120) -> tuple[dict[str, Any], dict[str, str]]:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://annword.ru",
        "X-Title": "AnnWord OCR benchmark",
        "User-Agent": "AnnWord-OCR-Benchmark/1.0",
    }
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            body = response.read().decode("utf-8", errors="replace")
            return json.loads(body), {k.lower(): v for k, v in response.headers.items()}
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        try:
            parsed: Any = json.loads(body)
        except json.JSONDecodeError:
            parsed = {"raw": body}
        raise RuntimeError(f"OpenRouter HTTP {exc.code}: {parsed}") from exc


def restore_image() -> Path:
    parts = sorted(Path("testdata/easyocr").glob("sample-v2.b64.*"))
    if not parts:
        raise RuntimeError("No sample-v2.b64 image chunks found")
    encoded = "".join(part.read_text(encoding="utf-8") for part in parts)
    encoded = re.sub(r"[^A-Za-z0-9+/=]", "", encoded)
    encoded += "=" * ((-len(encoded)) % 4)
    output = Path("openrouter-benchmark/dictionary.jpg")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(base64.b64decode(encoded, validate=False))
    with Image.open(output) as image:
        image.verify()
    with Image.open(output) as image:
        print("Restored image", image.size, image.mode)
    return output


def price_is_zero(value: Any) -> bool:
    try:
        return float(value) == 0.0
    except (TypeError, ValueError):
        return False


def discover_free_vision_models(api_key: str) -> list[dict[str, Any]]:
    query = urllib.parse.urlencode({"input_modalities": "image", "max_price": "0"})
    payload, _ = request_json(f"{API_BASE}/models?{query}", api_key)
    models = []
    for item in payload.get("data", []):
        if not isinstance(item, dict):
            continue
        architecture = item.get("architecture") or {}
        modalities = architecture.get("input_modalities") or []
        pricing = item.get("pricing") or {}
        model_id = str(item.get("id", ""))
        is_free = model_id.endswith(":free") or (
            price_is_zero(pricing.get("prompt")) and price_is_zero(pricing.get("completion"))
        )
        if "image" in modalities and is_free:
            models.append(item)
    return models


def model_rank(model: dict[str, Any]) -> tuple[int, int]:
    model_id = str(model.get("id", "")).lower()
    score = 0
    preferences = [
        ("qwen3-vl", 120), ("qwen2.5-vl", 110), ("nex", 100),
        ("kimi", 90), ("gemma", 80), ("llama", 70), ("vision", 60), ("vl", 50),
    ]
    for fragment, value in preferences:
        if fragment in model_id:
            score = max(score, value)
    return score, int(model.get("context_length") or 0)


def select_models(available: list[dict[str, Any]], count: int = 2) -> tuple[list[str], list[str]]:
    available_ids = {str(model.get("id")) for model in available}
    selected: list[str] = []
    unavailable_preferred: list[str] = []
    for model_id in PREFERRED_MODEL_IDS:
        if model_id in available_ids and model_id not in selected:
            selected.append(model_id)
        else:
            unavailable_preferred.append(model_id)
        if len(selected) >= count:
            return selected, unavailable_preferred
    for model in sorted(available, key=model_rank, reverse=True):
        model_id = str(model.get("id", ""))
        if model_id and model_id not in selected:
            selected.append(model_id)
        if len(selected) >= count:
            break
    return selected, unavailable_preferred


def extract_content(response: dict[str, Any]) -> str:
    choices = response.get("choices") or []
    if not choices:
        raise RuntimeError(f"No choices in response: {response}")
    content = (choices[0].get("message") or {}).get("content", "")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(str(item.get("text", "")) for item in content if isinstance(item, dict))
    return str(content)


def parse_model_json(content: str) -> dict[str, Any]:
    cleaned = content.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start < 0 or end < start:
        raise ValueError(f"No JSON object in model response: {content!r}")
    parsed = json.loads(cleaned[start:end + 1])
    if not isinstance(parsed, dict):
        raise ValueError("Model JSON is not an object")
    return parsed


def normalize_words(parsed: dict[str, Any]) -> tuple[list[str], list[dict[str, Any]]]:
    rows_raw = parsed.get("rows")
    rows: list[dict[str, Any]] = []
    words: list[str] = []
    if isinstance(rows_raw, list):
        for index, row in enumerate(rows_raw, start=1):
            if not isinstance(row, dict):
                continue
            row_number = row.get("row", index)
            row_words = row.get("words", [])
            if isinstance(row_words, str):
                row_words = [row_words]
            normalized_row: list[str] = []
            if isinstance(row_words, list):
                for value in row_words:
                    normalized_row.extend(token.upper() for token in re.findall(r"[A-Za-z]+", str(value)))
            rows.append({"row": row_number, "words": normalized_row})
            words.extend(normalized_row)
    if not words:
        all_words = parsed.get("all_words", [])
        if isinstance(all_words, str):
            all_words = [all_words]
        if isinstance(all_words, list):
            for value in all_words:
                words.extend(token.upper() for token in re.findall(r"[A-Za-z]+", str(value)))
    return words, rows


def levenshtein(a: list[str], b: list[str]) -> int:
    previous = list(range(len(b) + 1))
    for i, left in enumerate(a, start=1):
        current = [i]
        for j, right in enumerate(b, start=1):
            current.append(min(current[-1] + 1, previous[j] + 1, previous[j - 1] + (left != right)))
        previous = current
    return previous[-1]


def evaluate(words: list[str], rows: list[dict[str, Any]]) -> dict[str, Any]:
    exact_matches = [word for word in EXPECTED if word in words]
    row_map = {int(row["row"]): row.get("words", []) for row in rows if str(row.get("row", "")).isdigit()}
    row_exact = 0
    row_details = []
    for index, expected_row in enumerate(EXPECTED_ROWS, start=1):
        recognized = row_map.get(index, [])
        is_exact = recognized == expected_row
        row_exact += int(is_exact)
        row_details.append({
            "row": index,
            "expected": expected_row,
            "recognized": recognized,
            "exact": is_exact,
        })
    return {
        "recognized_words": words,
        "recognized_count": len(words),
        "exact_matches": exact_matches,
        "exact_count": len(exact_matches),
        "exact_recall": round(len(exact_matches) / len(EXPECTED), 4),
        "ordered_word_error_rate": round(levenshtein(EXPECTED, words) / len(EXPECTED), 4),
        "missing": [word for word in EXPECTED if word not in words],
        "extras": [word for word in words if word not in EXPECTED],
        "row_exact_count": row_exact,
        "row_count": len(EXPECTED_ROWS),
        "rows": row_details,
    }


def call_model(api_key: str, model_id: str, image_data_uri: str) -> dict[str, Any]:
    payload = {
        "model": model_id,
        "temperature": 0,
        "max_tokens": 800,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": PROMPT},
                {"type": "image_url", "image_url": {"url": image_data_uri}},
            ],
        }],
    }
    last_error: Exception | None = None
    started = time.perf_counter()
    for attempt in range(3):
        try:
            response, headers = request_json(f"{API_BASE}/chat/completions", api_key, method="POST", payload=payload, timeout=180)
            content = extract_content(response)
            parsed = parse_model_json(content)
            words, rows = normalize_words(parsed)
            result = evaluate(words, rows)
            result.update({
                "requested_model": model_id,
                "response_model": response.get("model"),
                "provider": response.get("provider"),
                "latency_seconds": round(time.perf_counter() - started, 3),
                "usage": response.get("usage"),
                "generation_id": response.get("id"),
                "raw_content": content,
                "parsed": parsed,
                "rate_headers": {key: value for key, value in headers.items() if "rate" in key or "limit" in key},
            })
            return result
        except Exception as exc:
            last_error = exc
            if attempt < 2:
                time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"Model {model_id} failed after retries: {last_error}")


def write_summary(report: dict[str, Any]) -> None:
    lines = [
        "# OpenRouter OCR benchmark",
        "",
        f"Expected words: {len(EXPECTED)}",
        "",
        "| Requested model | Actual model | Exact | Recall | Row exact | WER | Latency |",
        "|---|---|---:|---:|---:|---:|---:|",
    ]
    for result in report.get("results", []):
        lines.append(
            f"| {result.get('requested_model')} | {result.get('response_model')} | "
            f"{result.get('exact_count')}/{len(EXPECTED)} | {result.get('exact_recall'):.2%} | "
            f"{result.get('row_exact_count')}/{len(EXPECTED_ROWS)} | "
            f"{result.get('ordered_word_error_rate'):.4f} | {result.get('latency_seconds')} s |"
        )
    if report.get("errors"):
        lines.extend(["", "## Errors", ""])
        lines.extend(f"- `{item['model']}`: {item['error']}" for item in report["errors"])
    Path("openrouter-benchmark/summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    api_key = os.environ.get("OPENROUTER", "").strip()
    if not api_key:
        raise SystemExit("GitHub secret OPENROUTER is unavailable")

    image_path = restore_image()
    image_data_uri = "data:image/jpeg;base64," + base64.b64encode(image_path.read_bytes()).decode("ascii")

    key_info, _ = request_json(f"{API_BASE}/key", api_key)
    available = discover_free_vision_models(api_key)
    selected, unavailable_preferred = select_models(available, count=2)
    if not selected:
        selected = ["openrouter/free"]

    results: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []
    attempted: list[str] = []
    for model_id in selected:
        attempted.append(model_id)
        try:
            results.append(call_model(api_key, model_id, image_data_uri))
        except Exception as exc:
            errors.append({"model": model_id, "error": f"{type(exc).__name__}: {exc}"})

    if len(results) < 2 and "openrouter/free" not in attempted:
        attempted.append("openrouter/free")
        try:
            results.append(call_model(api_key, "openrouter/free", image_data_uri))
        except Exception as exc:
            errors.append({"model": "openrouter/free", "error": f"{type(exc).__name__}: {exc}"})

    report = {
        "expected": EXPECTED,
        "expected_rows": EXPECTED_ROWS,
        "key_info": key_info.get("data", {}),
        "preferred_models": PREFERRED_MODEL_IDS,
        "preferred_models_not_currently_available": unavailable_preferred,
        "available_free_vision_models": [
            {
                "id": model.get("id"),
                "name": model.get("name"),
                "context_length": model.get("context_length"),
                "pricing": model.get("pricing"),
                "input_modalities": (model.get("architecture") or {}).get("input_modalities"),
            }
            for model in sorted(available, key=model_rank, reverse=True)
        ],
        "selected_models": selected,
        "attempted_models": attempted,
        "results": results,
        "errors": errors,
    }
    Path("openrouter-benchmark/result.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    write_summary(report)
    print(json.dumps(report, ensure_ascii=False, indent=2))

    if not results:
        raise SystemExit("No OpenRouter OCR model completed successfully")


if __name__ == "__main__":
    main()
