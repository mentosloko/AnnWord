import json
import subprocess
import sys
from typing import Any

DOMAIN = "annword.ru."
DKIM_NAME = "mailru._domainkey.annword.ru."
SPF_VALUE = "v=spf1 redirect=_spf.mail.ru"
DKIM_VALUE = "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCnk6GAUaz8HY54TiaQaeYA5r++Kn4ixocss6lywM6N7PtB8OfgHgJyfNmXNRcwgeFQKvhATQUKqLTrCVC6gZ2/lWVt/e5wi/j2LIRDQgCT/ME4vJ6gSnBWBKa5b2OU7Otipmt9wPW9hqtraUZHTLm9tuxoqEMjdHqNKSK40rnUCwIDAQAB"


def run(args: list[str]) -> str:
    result = subprocess.run(args, text=True, capture_output=True)
    if result.returncode != 0:
        message = (result.stderr or result.stdout).strip().replace("\n", " ")
        raise RuntimeError(f"{' '.join(args[:5])}: {message[:500]}")
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

    root_txt = next(
        (item for item in records if item.get("name") == DOMAIN and item.get("type") == "TXT"),
        None,
    )
    root_ttl = int((root_txt or {}).get("ttl") or 600)
    root_values = list((root_txt or {}).get("data") or [])
    retained_root_values = [
        value for value in root_values
        if not plain(value).lower().startswith("v=spf1")
    ]

    root_args = ["yc", "dns", "zone", "replace-records", zone_id]
    for value in retained_root_values + [SPF_VALUE]:
        root_args += ["--record", f"{DOMAIN} {root_ttl} TXT {value}"]
    run(root_args)

    run([
        "yc", "dns", "zone", "replace-records", zone_id,
        "--record", f"{DKIM_NAME} 600 TXT {DKIM_VALUE}",
    ])

    after_payload = json.loads(run(["yc", "dns", "zone", "list-records", zone_id, "--format", "json"]))
    after = unpack_list(after_payload, ("record_sets", "recordsets", "records"))
    selected = [
        item for item in after
        if (item.get("name"), item.get("type")) in {
            (DOMAIN, "MX"),
            (DOMAIN, "TXT"),
            (DKIM_NAME, "TXT"),
        }
    ]
    print("AFTER=" + json.dumps(selected, ensure_ascii=False, separators=(",", ":")))

    root_txt_values = [
        plain(value)
        for item in selected
        if item.get("name") == DOMAIN and item.get("type") == "TXT"
        for value in item.get("data", [])
    ]
    dkim_values = [
        plain(value)
        for item in selected
        if item.get("name") == DKIM_NAME and item.get("type") == "TXT"
        for value in item.get("data", [])
    ]

    if SPF_VALUE not in root_txt_values:
        raise RuntimeError(f"SPF verification failed: {root_txt_values}")
    if DKIM_VALUE not in dkim_values:
        raise RuntimeError(f"DKIM verification failed: {dkim_values}")

    print("RESULT=SUCCESS")
except Exception as error:
    print(f"RESULT=ERROR: {error}")
    sys.exit(1)
