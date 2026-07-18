from __future__ import annotations

import base64
import json
import re
import time
from pathlib import Path
from typing import Any

import cv2
from PIL import Image

EXPECTED_ROWS = [
    ["HI"], ["KITE"], ["FINE"], ["RIDE"], ["DRIVE"], ["HOME"],
    ["TREE", "HOUSE"], ["CHAIR"], ["TABLE"], ["RADIO"], ["LOOK"],
    ["NICE"], ["BED"], ["LEG"], ["DESK"], ["FLY"], ["SKY"], ["BYE"],
    ["BONE"], ["ROSE"], ["GO"], ["RUN"], ["JUMP"],
]
EXPECTED = [word for row in EXPECTED_ROWS for word in row]
ROW_BOUNDS = [
    (31, 71), (71, 110), (110, 149), (149, 188), (188, 227), (227, 266),
    (266, 306), (306, 345), (345, 384), (384, 423), (423, 462), (462, 501),
    (501, 540), (540, 579), (579, 618), (618, 657), (657, 696), (696, 736),
    (736, 776), (776, 817), (817, 858), (858, 899), (899, 950),
]


def restore_image() -> Path:
    parts = sorted(Path("testdata/easyocr").glob("sample.b64.*"))
    encoded = "".join(p.read_text(encoding="utf-8") for p in parts)
    encoded = re.sub(r"[^A-Za-z0-9+/=]", "", encoded)
    encoded += "=" * ((-len(encoded)) % 4)
    out = Path("benchmark-output/dictionary.jpg")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(base64.b64decode(encoded, validate=False))
    with Image.open(out) as image:
        print("restored", image.size, image.mode)
    return out


def prepare_rows(image_path: Path) -> list[Path]:
    source = cv2.imread(str(image_path), cv2.IMREAD_GRAYSCALE)
    if source is None:
        raise RuntimeError("Cannot read sample")
    row_dir = Path("benchmark-output/rows")
    row_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    for index, (top, bottom) in enumerate(ROW_BOUNDS, start=1):
        crop = source[top + 1:bottom - 1, 4:source.shape[1] - 4]
        inv = cv2.threshold(crop, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(28, crop.shape[1] // 3), 1))
        lines = cv2.morphologyEx(inv, cv2.MORPH_OPEN, kernel)
        cleaned = cv2.bitwise_and(inv, cv2.bitwise_not(lines))
        points = cv2.findNonZero(cleaned)
        if points is not None:
            x, y, w, h = cv2.boundingRect(points)
            margin = 5
            cleaned = cleaned[max(0, y-margin):min(cleaned.shape[0], y+h+margin), max(0, x-margin):min(cleaned.shape[1], x+w+margin)]
        cleaned = cv2.bitwise_not(cleaned)
        cleaned = cv2.copyMakeBorder(cleaned, 12, 12, 16, 16, cv2.BORDER_CONSTANT, value=255)
        scale = max(2, int(round(72 / max(1, cleaned.shape[0]))))
        cleaned = cv2.resize(cleaned, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        out = row_dir / f"row-{index:02d}.png"
        cv2.imwrite(str(out), cleaned)
        paths.append(out)
    return paths


def alpha_tokens(text: str) -> list[str]:
    return [token.upper() for token in re.findall(r"[A-Za-z]+", text)]


def edit_distance(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        cur = [i]
        for j, cb in enumerate(b, start=1):
            cur.append(min(cur[-1] + 1, prev[j] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def evaluate(name: str, raw_rows: list[str], elapsed: float, scores: list[float | None] | None = None) -> dict[str, Any]:
    tokens = [token for text in raw_rows for token in alpha_tokens(text)]
    exact = [word for word in EXPECTED if word in tokens]
    row_details = []
    row_exact = 0
    for idx, expected_row in enumerate(EXPECTED_ROWS):
        text = raw_rows[idx] if idx < len(raw_rows) else ""
        row_tokens = alpha_tokens(text)
        ok = row_tokens == expected_row
        row_exact += int(ok)
        row_details.append({"row": idx + 1, "expected": expected_row, "raw": text, "tokens": row_tokens, "exact": ok, "score": scores[idx] if scores and idx < len(scores) else None})
    expected_text = " ".join(EXPECTED)
    recognized_text = " ".join(tokens)
    return {
        "mode": name,
        "elapsed_seconds": round(elapsed, 3),
        "expected_count": len(EXPECTED),
        "recognized_tokens": tokens,
        "exact_matches": exact,
        "exact_count": len(exact),
        "exact_recall": round(len(exact) / len(EXPECTED), 4),
        "missing": [word for word in EXPECTED if word not in tokens],
        "extras": [word for word in tokens if word not in EXPECTED],
        "cer": round(edit_distance(expected_text, recognized_text) / len(expected_text), 4),
        "row_exact_count": row_exact,
        "row_count": len(EXPECTED_ROWS),
        "rows": row_details,
    }


def run_paddle_whole(image_path: Path) -> dict[str, Any]:
    from paddleocr import PaddleOCR
    start = time.perf_counter()
    model = PaddleOCR(ocr_version="PP-OCRv5", lang="en", text_detection_model_name="PP-OCRv5_server_det", text_recognition_model_name="en_PP-OCRv5_mobile_rec", use_doc_orientation_classify=False, use_doc_unwarping=False, use_textline_orientation=False, text_rec_score_thresh=0.0)
    output = model.predict(input=str(image_path))
    texts, scores = [], []
    for result in output:
        texts.extend(str(x) for x in result.get("rec_texts", []))
        scores.extend(float(x) for x in result.get("rec_scores", []))
    result = evaluate("PP-OCRv5 whole column", texts, time.perf_counter() - start)
    result["detected_blocks"] = [{"text": t, "score": s} for t, s in zip(texts, scores)]
    return result


def run_paddle_rows(row_paths: list[Path]) -> dict[str, Any]:
    from paddleocr import TextRecognition
    start = time.perf_counter()
    output = TextRecognition(model_name="en_PP-OCRv5_mobile_rec").predict(input=[str(path) for path in row_paths], batch_size=8)
    texts = [str(result.get("rec_text", "")) for result in output]
    scores = [float(result.get("rec_score", 0.0)) for result in output]
    return evaluate("PP-OCRv5 row-by-row", texts, time.perf_counter() - start, scores)


def run_trocr_rows(row_paths: list[Path]) -> dict[str, Any]:
    import torch
    from transformers import TrOCRProcessor, VisionEncoderDecoderModel
    start = time.perf_counter()
    model_id = "microsoft/trocr-small-handwritten"
    processor = TrOCRProcessor.from_pretrained(model_id)
    model = VisionEncoderDecoderModel.from_pretrained(model_id)
    model.eval()
    texts = []
    with torch.inference_mode():
        for path in row_paths:
            image = Image.open(path).convert("RGB")
            values = processor(images=image, return_tensors="pt").pixel_values
            ids = model.generate(values, max_new_tokens=20, num_beams=4, early_stopping=True)
            texts.append(processor.batch_decode(ids, skip_special_tokens=True)[0].strip())
    return evaluate("TrOCR-small-handwritten row-by-row", texts, time.perf_counter() - start)


def main() -> None:
    image_path = restore_image()
    row_paths = prepare_rows(image_path)
    results, errors = [], []
    for label, fn in [("paddle_whole", lambda: run_paddle_whole(image_path)), ("paddle_rows", lambda: run_paddle_rows(row_paths)), ("trocr_rows", lambda: run_trocr_rows(row_paths))]:
        try:
            results.append(fn())
        except Exception as exc:
            import traceback
            traceback.print_exc()
            errors.append({"mode": label, "error": f"{type(exc).__name__}: {exc}"})
    report = {"expected": EXPECTED, "results": results, "errors": errors}
    Path("benchmark-output/benchmark.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("BENCHMARK_JSON")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(f"Benchmark incomplete: {errors}")


if __name__ == "__main__":
    main()
