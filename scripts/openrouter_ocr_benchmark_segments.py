from __future__ import annotations

import base64
import importlib.util
import json
import os
import time
from pathlib import Path
from typing import Any

from PIL import Image, ImageEnhance, ImageFilter, ImageOps

MODULE_PATH = Path(__file__).with_name("openrouter_ocr_benchmark.py")
spec = importlib.util.spec_from_file_location("openrouter_base", MODULE_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError("Cannot load base OpenRouter benchmark module")
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

MODEL_IDS = [
    "nvidia/nemotron-nano-12b-v2-vl:free",
    "google/gemma-4-26b-a4b-it:free",
]
FALLBACK_MODEL_IDS = [
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "openrouter/free",
]
SEGMENT_BOUNDS = [(31, 266), (266, 501), (501, 736), (736, 950)]
PROMPT = """You are a strict OCR engine, not a conversational assistant.

The four attached images are consecutive enlarged segments of ONE handwritten English vocabulary column. Image 1 is the top, then images 2, 3 and 4 continue downward.

Extract only the handwritten English vocabulary words, in the exact top-to-bottom order.

Rules:
- Ignore notebook lines, the printed heading, brackets, transcription, Russian text and neighbouring columns.
- Preserve visible spelling. Never replace unclear writing with a guessed topic list.
- Do not translate, explain, categorise or invent words.
- A row can contain more than one English word.
- Include every visible row. For an unreadable row, return an empty words array.

Return JSON only with this exact shape:
{"rows":[{"row":1,"words":["example"]}],"all_words":["example"]}
"""


def make_segments(image_path: Path) -> tuple[list[Path], list[str]]:
    output_dir = Path("openrouter-benchmark-segments/segments")
    output_dir.mkdir(parents=True, exist_ok=True)
    paths: list[Path] = []
    uris: list[str] = []
    with Image.open(image_path) as source:
        source = source.convert("RGB")
        for index, (top, bottom) in enumerate(SEGMENT_BOUNDS, start=1):
            crop = source.crop((0, top, source.width, bottom))
            crop = ImageOps.autocontrast(crop, cutoff=1)
            crop = ImageEnhance.Contrast(crop).enhance(1.25)
            crop = ImageEnhance.Sharpness(crop).enhance(1.6)
            crop = crop.resize((crop.width * 4, crop.height * 4), Image.Resampling.LANCZOS)
            crop = crop.filter(ImageFilter.UnsharpMask(radius=1.2, percent=120, threshold=3))
            path = output_dir / f"segment-{index}.jpg"
            crop.save(path, quality=92, optimize=True)
            paths.append(path)
            uris.append("data:image/jpeg;base64," + base64.b64encode(path.read_bytes()).decode("ascii"))
    return paths, uris


def call_model(api_key: str, model_id: str, image_uris: list[str]) -> dict[str, Any]:
    content: list[dict[str, Any]] = [{"type": "text", "text": PROMPT}]
    content.extend({"type": "image_url", "image_url": {"url": uri}} for uri in image_uris)
    payload = {
        "model": model_id,
        "temperature": 0,
        "max_tokens": 1000,
        "messages": [{"role": "user", "content": content}],
    }
    started = time.perf_counter()
    last_error: Exception | None = None
    for attempt in range(2):
        try:
            response, headers = base.request_json(
                f"{base.API_BASE}/chat/completions",
                api_key,
                method="POST",
                payload=payload,
                timeout=180,
            )
            raw_content = base.extract_content(response)
            parsed = base.parse_model_json(raw_content)
            words, rows = base.normalize_words(parsed)
            result = base.evaluate(words, rows)
            result.update({
                "requested_model": model_id,
                "response_model": response.get("model"),
                "provider": response.get("provider"),
                "latency_seconds": round(time.perf_counter() - started, 3),
                "usage": response.get("usage"),
                "generation_id": response.get("id"),
                "raw_content": raw_content,
                "parsed": parsed,
                "rate_headers": {key: value for key, value in headers.items() if "rate" in key or "limit" in key},
            })
            return result
        except Exception as exc:
            last_error = exc
            if attempt == 0:
                time.sleep(6)
    raise RuntimeError(f"Model {model_id} failed after retries: {last_error}")


def main() -> None:
    api_key = os.environ.get("OPENROUTER", "").strip()
    if not api_key:
        raise SystemExit("GitHub secret OPENROUTER is unavailable")

    image_path = base.restore_image()
    segment_paths, image_uris = make_segments(image_path)
    available = base.discover_free_vision_models(api_key)
    available_ids = {str(item.get("id")) for item in available}

    requested = [model for model in MODEL_IDS if model in available_ids]
    for fallback in FALLBACK_MODEL_IDS:
        if len(requested) >= 2:
            break
        if fallback == "openrouter/free" or fallback in available_ids:
            requested.append(fallback)

    results: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []
    attempted: list[str] = []
    queue = requested + [model for model in FALLBACK_MODEL_IDS if model not in requested]
    for model_id in queue:
        if len(results) >= 2:
            break
        attempted.append(model_id)
        try:
            results.append(call_model(api_key, model_id, image_uris))
        except Exception as exc:
            errors.append({"model": model_id, "error": f"{type(exc).__name__}: {exc}"})

    report = {
        "mode": "four enlarged consecutive segments",
        "expected": base.EXPECTED,
        "expected_rows": base.EXPECTED_ROWS,
        "requested_models": requested,
        "attempted_models": attempted,
        "segment_files": [str(path) for path in segment_paths],
        "results": results,
        "errors": errors,
    }
    output_dir = Path("openrouter-benchmark-segments")
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "result.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    lines = [
        "# OpenRouter segmented OCR benchmark",
        "",
        "| Requested model | Actual model | Exact | Recall | Row exact | WER | Latency |",
        "|---|---|---:|---:|---:|---:|---:|",
    ]
    for result in results:
        lines.append(
            f"| {result.get('requested_model')} | {result.get('response_model')} | "
            f"{result.get('exact_count')}/{len(base.EXPECTED)} | {result.get('exact_recall'):.2%} | "
            f"{result.get('row_exact_count')}/{len(base.EXPECTED_ROWS)} | "
            f"{result.get('ordered_word_error_rate'):.4f} | {result.get('latency_seconds')} s |"
        )
    if errors:
        lines.extend(["", "## Errors", ""])
        lines.extend(f"- `{item['model']}`: {item['error']}" for item in errors)
    (output_dir / "summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))

    if not results:
        raise SystemExit("No segmented OpenRouter OCR request succeeded")


if __name__ == "__main__":
    main()
