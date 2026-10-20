# SPDX-License-Identifier: MIT
"""Optional Equalizer APO configuration adapter; never installs/activates an APO."""
import json
import math
import os
from pathlib import Path
import re

FREQUENCIES = (31, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000)


def validate(value):
    if not isinstance(value, dict) or type(value.get("enabled")) is not bool:
        raise ValueError("EQ requires enabled boolean and ten gains")
    gains = value.get("gains")
    if not isinstance(gains, list) or len(gains) != 10:
        raise ValueError("EQ requires exactly ten bands")
    if any(type(v) not in (int, float) or not math.isfinite(v) or not -12 <= v <= 12 for v in gains):
        raise ValueError("EQ gains must be finite numbers between -12 and 12 dB")
    return {"enabled": value["enabled"], "gains": [round(v, 1) for v in gains]}


def configuration(endpoint_id, value):
    value = validate(value)
    match = re.search(r"(\{[0-9A-Fa-f-]{36}\})$", endpoint_id)
    if not match:
        raise ValueError("Audio endpoint GUID missing")
    # An If block avoids leaking Device/Channel selection into the user's later filters.
    guid = match[1].lower()
    lines = ["# One4All BlackShark V2 optional EQ; configuration, not proof of audible processing",
             'If: tolower(deviceGuid) == "' + guid + '" and stage == "post-mix"']
    if value["enabled"]:
        headroom = max(0, max(value["gains"]))
        lines.append("Preamp: %.1f dB" % -headroom)
        lines.append("GraphicEQ: " + "; ".join("%d %.1f" % (f, g) for f, g in zip(FREQUENCIES, value["gains"])))
    else:
        lines.append("# Bypassed: this include contributes no filters")
    return "\n".join(lines + ["EndIf:", ""])


def provider(root):
    metadata = root / "eq-provider.json"
    if not metadata.exists():
        return None
    config = json.loads(metadata.read_text(encoding="utf-8-sig"))
    if config.get("provider") != "equalizer-apo":
        raise ValueError("Unknown EQ provider")
    config_root = Path(config["configRoot"]).resolve()
    directory = config_root / "One4All-BlackShark-V2"
    if directory.resolve().parent != config_root or not directory.is_dir():
        raise ValueError("Optional EQ directory is unavailable")
    # No renderer-supplied filenames or paths.
    return directory / "blackshark-eq.txt"


def status(root):
    output = {"provider": "equalizer-apo", "configured": False, "audibleVerified": None,
              "gains": [0] * 10, "enabledConfiguration": False, "frequencies": list(FREQUENCIES)}
    if root is None:
        return output
    root = Path(root)
    destination = provider(root)
    output["configured"] = destination is not None
    saved = root / "eq-settings.json"
    if saved.exists():
        value = validate(json.loads(saved.read_text(encoding="utf-8")))
        output.update(gains=value["gains"], enabledConfiguration=value["enabled"])
    return output


def save(root, endpoint_id, value):
    value = validate(value)
    text = configuration(endpoint_id, value)
    result = status(root)
    result["configuration"] = text
    result["gains"] = value["gains"]
    result["enabledConfiguration"] = value["enabled"]
    if root is None or not result["configured"]:
        result["saved"] = False
        return result  # Export-only until the recipient explicitly enables a provider.
    root = Path(root)
    target = provider(root)
    temporary = target.with_suffix(".tmp")
    temporary.write_text(text, encoding="utf-8")
    os.replace(temporary, target)
    if target.read_text(encoding="utf-8") != text:
        raise OSError("EQ configuration readback mismatch")
    settings = root / "eq-settings.json"
    temporary_settings = settings.with_suffix(".tmp")
    temporary_settings.write_text(json.dumps(value), encoding="utf-8")
    os.replace(temporary_settings, settings)
    result["saved"] = True
    return result
