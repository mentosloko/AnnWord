from __future__ import annotations

import argparse
import base64
import json
import os
import re
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Callable

from PIL import Image, ImageEnhance, ImageOps

EXPECTED = [
    "HI", "KITE", "FINE", "RIDE", "DRIVE", "HOME", "TREE", "HOUSE",
    "CHAIR", "TABLE", "RADIO", "LOOK", "NICE", "BED", "LEG", "DESK",
    "FLY", "SKY", "BYE", "BONE", "ROSE", "GO", "RUN", "JUMP",
]
OUT = Path("free-ocr-benchmark")
PROMPT = (
    "Act as a strict OCR engine. The image contains only a vertical part of an English "
    "vocabulary notebook. Read handwritten English words from top to bottom. Ignore printed "
    "headings, ruling, transcription and any neighbouring content. Return only the words, one "
    "per line. Preserve visible spelling and never invent words."
)


def restore_image() -> Path:
    parts = sorted(Path("testdata/easyocr").glob("sample-v2.b64.*"))
    if not parts:
        raise RuntimeError("sample-v2 image chunks are missing")
    encoded = re.sub(r"[^A-Za-z0-9+/=]", "", "".join(p.read_text() for p in parts))
    encoded += "=" * ((-len(encoded)) % 4)
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / "dictionary.jpg"
    path.write_bytes(base64.b64decode(encoded, validate=False))
    with Image.open(path) as image:
        image.verify()
    return path


def make_variants(path: Path) -> dict[str, list[Path]]:
    image = Image.open(path).convert("RGB")
    # The first ~30 px contain the printed column header rather than vocabulary.
    image = image.crop((0, min(30, image.height - 1), image.width, image.height))
    variants: dict[str, list[Path]] = {}
    for name, prepared in {
        "original": image,
        "contrast": ImageEnhance.Contrast(ImageOps.grayscale(image)).enhance(1.8).convert("RGB"),
    }.items():
        whole = OUT / f"{name}-whole.png"
        prepared.save(whole)
        variants[f"{name}_whole"] = [whole]
        segments: list[Path] = []
        count, overlap = 4, 24
        step = prepared.height / count
        for index in range(count):
            top = max(0, round(index * step) - (overlap if index else 0))
            bottom = min(prepared.height, round((index + 1) * step) + (overlap if index < count - 1 else 0))
            crop = prepared.crop((0, top, prepared.width, bottom))
            scale = max(2, round(720 / max(1, crop.width)))
            crop = crop.resize((crop.width * scale, crop.height * scale))
            seg = OUT / f"{name}-segment-{index + 1}.png"
            crop.save(seg)
            segments.append(seg)
        variants[f"{name}_segments"] = segments
    return variants


def tokens(text: str) -> list[str]:
    return [x.upper() for x in re.findall(r"[A-Za-z]+", text)]


def distance(a: list[str], b: list[str]) -> int:
    prev = list(range(len(b) + 1))
    for i, left in enumerate(a, 1):
        cur = [i]
        for j, right in enumerate(b, 1):
            cur.append(min(cur[-1] + 1, prev[j] + 1, prev[j - 1] + (left != right)))
        prev = cur
    return prev[-1]


def evaluate(name: str, raw_outputs: list[str], elapsed: float, meta: dict[str, Any] | None = None) -> dict[str, Any]:
    recognized = [word for output in raw_outputs for word in tokens(output)]
    exact = [word for word in EXPECTED if word in recognized]
    return {
        "name": name,
        "elapsed_seconds": round(elapsed, 3),
        "raw_outputs": raw_outputs,
        "recognized_words": recognized,
        "exact_matches": exact,
        "exact_count": len(exact),
        "exact_recall": round(len(exact) / len(EXPECTED), 4),
        "ordered_word_error_rate": round(distance(EXPECTED, recognized) / len(EXPECTED), 4),
        "missing": [word for word in EXPECTED if word not in recognized],
        "extras": [word for word in recognized if word not in EXPECTED],
        "meta": meta or {},
    }


def json_request(url: str, payload: dict[str, Any], headers: dict[str, str], timeout: int = 180) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8", errors="replace"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code}: {body[:1000]}") from exc


def data_uri(path: Path) -> str:
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()


def run_groq(paths: list[Path], key: str) -> tuple[list[str], dict[str, Any]]:
    content: list[dict[str, Any]] = [{"type": "text", "text": PROMPT}]
    content += [{"type": "image_url", "image_url": {"url": data_uri(path)}} for path in paths]
    response = json_request(
        "https://api.groq.com/openai/v1/chat/completions",
        {"model": "meta-llama/llama-4-scout-17b-16e-instruct", "temperature": 0, "max_completion_tokens": 500,
         "messages": [{"role": "user", "content": content}]},
        {"Authorization": f"Bearer {key}"},
    )
    text = response["choices"][0]["message"]["content"]
    return [text], {"model": response.get("model"), "usage": response.get("usage")}


def run_gemini(paths: list[Path], key: str, model: str) -> tuple[list[str], dict[str, Any]]:
    parts: list[dict[str, Any]] = [{"text": PROMPT}]
    for path in paths:
        parts.append({"inline_data": {"mime_type": "image/png", "data": base64.b64encode(path.read_bytes()).decode()}})
    response = json_request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}",
        {"contents": [{"role": "user", "parts": parts}], "generationConfig": {"temperature": 0, "maxOutputTokens": 500}},
        {},
    )
    text = "\n".join(part.get("text", "") for part in response["candidates"][0]["content"]["parts"])
    return [text], {"model": model, "usage": response.get("usageMetadata")}


def run_cloudflare(paths: list[Path], token: str, account: str) -> tuple[list[str], dict[str, Any]]:
    images = [list(path.read_bytes()) for path in paths]
    # Workers AI vision models accept an image byte array. Multiple crops are called separately.
    outputs = []
    for image in images:
        response = json_request(
            f"https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/@cf/meta/llama-3.2-11b-vision-instruct",
            {"prompt": PROMPT, "image": image, "max_tokens": 500},
            {"Authorization": f"Bearer {token}"},
        )
        result = response.get("result") or {}
        outputs.append(str(result.get("response", result)))
    return outputs, {"model": "@cf/meta/llama-3.2-11b-vision-instruct"}


def benchmark_providers(variants: dict[str, list[Path]]) -> dict[str, Any]:
    candidates: list[tuple[str, Callable[[list[Path]], tuple[list[str], dict[str, Any]]]]] = []
    groq = (os.getenv("GROQ_API_KEY") or os.getenv("GROQ") or "").strip()
    gemini = (os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI") or "").strip()
    cf_token = (os.getenv("CLOUDFLARE_API_TOKEN") or os.getenv("CF_API_TOKEN") or "").strip()
    cf_account = (os.getenv("CLOUDFLARE_ACCOUNT_ID") or os.getenv("CF_ACCOUNT_ID") or "").strip()
    availability = {"groq": bool(groq), "gemini": bool(gemini), "cloudflare": bool(cf_token and cf_account)}
    if groq:
        candidates.append(("Groq Llama 4 Scout", lambda p: run_groq(p, groq)))
    if gemini:
        candidates += [
            ("Gemini 3.5 Flash", lambda p: run_gemini(p, gemini, "gemini-3.5-flash")),
            ("Gemini 3.1 Flash Lite", lambda p: run_gemini(p, gemini, "gemini-3.1-flash-lite")),
        ]
    if cf_token and cf_account:
        candidates.append(("Cloudflare Llama 3.2 Vision", lambda p: run_cloudflare(p, cf_token, cf_account)))
    results, errors = [], []
    for label, fn in candidates:
        for variant in ("original_whole", "original_segments"):
            start = time.perf_counter()
            try:
                output, meta = fn(variants[variant])
                results.append(evaluate(f"{label} / {variant}", output, time.perf_counter() - start, meta))
            except Exception as exc:
                errors.append({"name": f"{label} / {variant}", "error": f"{type(exc).__name__}: {exc}"})
    return {"mode": "providers", "availability": availability, "results": results, "errors": errors}


def run_florence(paths: list[Path], model: Any, processor: Any) -> list[str]:
    import torch
    outputs = []
    for path in paths:
        image = Image.open(path).convert("RGB")
        inputs = processor(text="<OCR>", images=image, return_tensors="pt")
        with torch.inference_mode():
            ids = model.generate(**inputs, max_new_tokens=512, num_beams=3)
        text = processor.batch_decode(ids, skip_special_tokens=False)[0]
        parsed = processor.post_process_generation(text, task="<OCR>", image_size=image.size)
        outputs.append(str(parsed.get("<OCR>", parsed)))
    return outputs


def run_got(paths: list[Path], model: Any, processor: Any) -> list[str]:
    import torch
    outputs = []
    for path in paths:
        inputs = processor(Image.open(path).convert("RGB"), return_tensors="pt")
        with torch.inference_mode():
            ids = model.generate(**inputs, do_sample=False, tokenizer=processor.tokenizer,
                                 stop_strings="<|im_end|>", max_new_tokens=512)
        outputs.append(processor.decode(ids[0, inputs["input_ids"].shape[1]:], skip_special_tokens=True))
    return outputs


def benchmark_local(variants: dict[str, list[Path]]) -> dict[str, Any]:
    results, errors = [], []
    import torch
    torch.set_num_threads(max(1, min(4, os.cpu_count() or 2)))
    try:
        from transformers import AutoModelForCausalLM, AutoProcessor
        model_id = "microsoft/Florence-2-base-ft"
        processor = AutoProcessor.from_pretrained(model_id, trust_remote_code=True)
        model = AutoModelForCausalLM.from_pretrained(model_id, trust_remote_code=True).eval()
        for variant in ("original_whole", "contrast_whole", "original_segments", "contrast_segments"):
            start = time.perf_counter()
            output = run_florence(variants[variant], model, processor)
            results.append(evaluate(f"Florence-2-base-ft / {variant}", output, time.perf_counter() - start,
                                    {"model": model_id}))
        del model, processor
    except Exception as exc:
        errors.append({"name": "Florence-2-base-ft", "error": f"{type(exc).__name__}: {exc}"})
    try:
        from transformers import AutoModelForImageTextToText, AutoProcessor
        model_id = "stepfun-ai/GOT-OCR-2.0-hf"
        processor = AutoProcessor.from_pretrained(model_id, use_fast=True)
        model = AutoModelForImageTextToText.from_pretrained(model_id).eval()
        for variant in ("original_whole", "contrast_whole", "original_segments"):
            start = time.perf_counter()
            output = run_got(variants[variant], model, processor)
            results.append(evaluate(f"GOT-OCR-2.0 / {variant}", output, time.perf_counter() - start,
                                    {"model": model_id}))
    except Exception as exc:
        errors.append({"name": "GOT-OCR-2.0", "error": f"{type(exc).__name__}: {exc}"})
    return {"mode": "local", "results": results, "errors": errors}


def write_report(report: dict[str, Any], name: str) -> None:
    path = OUT / f"{name}.json"
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["providers", "local"], required=True)
    args = parser.parse_args()
    image = restore_image()
    variants = make_variants(image)
    report = benchmark_providers(variants) if args.mode == "providers" else benchmark_local(variants)
    write_report(report, args.mode)


if __name__ == "__main__":
    main()
