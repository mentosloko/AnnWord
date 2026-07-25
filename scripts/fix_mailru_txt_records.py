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
        raise RuntimeError((result.stderr or result.stdout).strip())
    return result.stdout


def unpack(payload: Any, keys: tuple[str, ...]) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict):
        for key in keys:
            if isinstance(payload.get(key), list):
                return [item for item in payload[key] if isinstance(item, dict)]
    raise RuntimeError("Unexpected YC JSON response")


def normalize_txt(parts: list[str]) -> str:
    cleaned = []
    for part in parts:
        text = str(part).strip()
        if len(text) >= 2 and text[0] == text[-1] == '"':
            text = text[1:-1]
        cleaned.append(text)
    return "".join(cleaned)


zones = unpack(json.loads(run(["yc", "dns", "zone", "list", "--format", "json"])), ("dns_zones", "zones"))
zone = next((item for item in zones if item.get("zone") == DOMAIN), None)
if not zone:
    raise RuntimeError("annword.ru zone not found")
zone_id = str(zone["id"])
records = unpack(json.loads(run(["yc", "dns", "zone", "list-records", zone_id, "--format", "json"])), ("record_sets", "recordsets", "records"))
root_txt = next((r for r in records if r.get("name") == DOMAIN and r.get("type") == "TXT"), None)
ttl = int((root_txt or {}).get("ttl") or 600)
values = list((root_txt or {}).get("data") or [])

# Preserve non-SPF TXT values while replacing the malformed SPF record.
retained: list[str] = []
for value in values:
    text = str(value).strip()
    if text.startswith('"') and text.endswith('"'):
        text = text[1:-1]
    if text.lower().startswith("v=spf1") or text.lower() == "redirect=_spf.mail.ru":
        continue
    retained.append(text)

root_args = ["yc", "dns", "zone", "replace-records", zone_id]
for value in retained + [SPF_VALUE]:
    root_args += ["--record", f'{DOMAIN} {ttl} TXT "{value}"']
run(root_args)
run([
    "yc", "dns", "zone", "replace-records", zone_id,
    "--record", f'{DKIM_NAME} 600 TXT "{DKIM_VALUE}"',
])

print("DNS records replaced with quoted TXT values")
