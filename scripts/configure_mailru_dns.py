import json
import re
import subprocess
import sys
from typing import Any

DOMAIN = "annword.ru."


def run(args: list[str]) -> str:
    result = subprocess.run(args, text=True, capture_output=True)
    if result.returncode != 0:
        message = (result.stderr or result.stdout).strip().replace("\n", " ")
        raise RuntimeError(f"{' '.join(args[:4])}: {message[:400]}")
    return result.stdout


def unpack_list(payload: Any, keys: tuple[str, ...]) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict):
        for key in keys:
            value = payload.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
    raise RuntimeError(f"unexpected Yandex CLI JSON shape: {type(payload).__name__}")


def plain(value: object) -> str:
    text = str(value).strip()
    if len(text) >= 2 and text[0] == text[-1] == '"':
        return text[1:-1]
    return text


try:
    zones_payload = json.loads(run(["yc", "dns", "zone", "list", "--format", "json"]))
    zones = unpack_list(zones_payload, ("dns_zones", "zones"))
    zone = next((item for item in zones if item.get("zone") == DOMAIN), None)
    if not zone:
        print("RESULT=ZONE_NOT_FOUND: annword.ru DNS is not managed in this Yandex Cloud folder")
        sys.exit(2)

    zone_id = str(zone["id"])
    records_payload = json.loads(run(["yc", "dns", "zone", "list-records", zone_id, "--format", "json"]))
    records = unpack_list(records_payload, ("record_sets", "recordsets", "records"))
    root_records = [
        item for item in records
        if item.get("name") == DOMAIN and item.get("type") in {"MX", "TXT"}
    ]
    print("BEFORE=" + json.dumps(root_records, ensure_ascii=False, separators=(",", ":")))

    root_txt = next((item for item in root_records if item.get("type") == "TXT"), None)
    ttl = int((root_txt or {}).get("ttl") or 600)
    original_values = list((root_txt or {}).get("data") or [])
    spf_values = [plain(value) for value in original_values if plain(value).lower().startswith("v=spf1")]
    if len(spf_values) > 1:
        raise RuntimeError("multiple SPF values already exist; refusing unsafe replacement")

    if spf_values:
        spf = spf_values[0].strip()
        if "redirect=_spf.mail.ru" not in spf.lower():
            spf = re.sub(r"\s+[+?~-]?all\s*$", "", spf, flags=re.I).strip()
            spf = f"{spf} redirect=_spf.mail.ru"
    else:
        spf = "v=spf1 redirect=_spf.mail.ru"

    retained = [value for value in original_values if not plain(value).lower().startswith("v=spf1")]
    txt_args = ["yc", "dns", "zone", "replace-records", zone_id]
    for value in retained + [spf]:
        txt_args += ["--record", f"{DOMAIN} {ttl} TXT {value}"]
    run(txt_args)
    run([
        "yc", "dns", "zone", "replace-records", zone_id,
        "--record", f"{DOMAIN} 600 MX 10 emx.mail.ru.",
    ])

    after_payload = json.loads(run([
        "yc", "dns", "zone", "list-records", zone_id,
        "--record-name", DOMAIN, "--format", "json",
    ]))
    after = unpack_list(after_payload, ("record_sets", "recordsets", "records"))
    root_after = [
        item for item in after
        if item.get("name") == DOMAIN and item.get("type") in {"MX", "TXT"}
    ]
    print("AFTER=" + json.dumps(root_after, ensure_ascii=False, separators=(",", ":")))

    mx_values = [
        plain(value)
        for item in root_after if item.get("type") == "MX"
        for value in item.get("data", [])
    ]
    txt_values = [
        plain(value)
        for item in root_after if item.get("type") == "TXT"
        for value in item.get("data", [])
    ]
    if "10 emx.mail.ru." not in mx_values:
        raise RuntimeError(f"MX verification failed: {mx_values}")
    if not any("redirect=_spf.mail.ru" in value.lower() for value in txt_values):
        raise RuntimeError(f"SPF verification failed: {txt_values}")

    print(f"RESULT=SUCCESS; SPF={spf}")
except Exception as error:
    print(f"RESULT=ERROR: {error}")
    sys.exit(1)
