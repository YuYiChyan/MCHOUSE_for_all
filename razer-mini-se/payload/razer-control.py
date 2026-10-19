"""Structured Razer controller bridge for the local card lab."""
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).parent
DATA = Path(os.environ.get("ONE4ALL_DATA_DIR", str(ROOT)))
DATA.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(ROOT / "openrazer-win"))

from openrazer_win.core.manager import DeviceManager
from openrazer_win.core.persistence import Persistence
from openrazer_win.hid import get_backend

TARGET_PID = 0x009F
ALLOWED_RATES = {125, 500, 1000, 2000, 4000, 8000}


def optional(call):
    try:
        return call(), None
    except Exception as exc:
        return None, str(exc)


def _dpi_state_once(device):
    dpi_x, dpi_y = device.get_dpi()
    active, stages = device.get_dpi_stages()
    if not stages:
        raise RuntimeError("设备尚未返回 DPI 档位")
    return {
        "dpi": [int(dpi_x), int(dpi_y)],
        "active_stage": int(active),
        "dpi_stages": [[int(x), int(y)] for x, y in stages],
    }


def dpi_state(device):
    last_error = None
    for _ in range(4):
        try:
            return _dpi_state_once(device)
        except Exception as exc:
            last_error = exc
            time.sleep(0.25)
    raise last_error


def read_poll_rate(device):
    last_error = None
    for _ in range(4):
        try:
            return device.get_poll_rate()
        except Exception as exc:
            last_error = exc
            time.sleep(0.2)
    raise last_error


def wait_for_dpi_stage(device, requested):
    last_state = None
    for _ in range(12):
        try:
            state = dpi_state(device)
            last_state = state
            if state["active_stage"] == requested:
                return state
        except Exception:
            pass
        time.sleep(0.25)
    if last_state is not None:
        return last_state
    raise RuntimeError("设备没有返回 DPI 档位")


def main():
    action = sys.argv[1] if len(sys.argv) > 1 else "status"
    result = {"backend": "openrazer-win", "action": action, "ok": False}
    manager = None
    try:
        backend = get_backend()
        manager = DeviceManager(
            backend=backend,
            persistence=Persistence(str(DATA / "razer-state.json")),
            bluetooth=False,
        )
        devices = [device for device in manager.scan() if device.info.pid == TARGET_PID]
        if not devices:
            raise RuntimeError("未找到 Razer Viper Mini SE Wireless")
        device = devices[0]
        supported = device.supported_poll_rates()
        result.update(
            {
                "name": device.name,
                "vendor_id": f"{device.info.vid:04X}",
                "product_id": f"{device.info.pid:04X}",
                "device_type": device.info.type,
                "dpi_max": device.info.dpi_max,
                "supported_poll_rates": supported,
                "poll_rate": read_poll_rate(device),
            }
        )
        battery, battery_error = optional(device.get_battery_level)
        charging, charging_error = optional(device.is_charging)
        result["battery_percent"] = battery
        result["charging"] = charging
        if battery_error:
            result["battery_error"] = battery_error
        if charging_error:
            result["charging_error"] = charging_error
        try:
            result.update(dpi_state(device))
        except Exception as exc:
            result["dpi_error"] = str(exc)

        if action == "set-poll-rate":
            requested = int(sys.argv[2])
            if requested not in ALLOWED_RATES or requested not in supported:
                raise ValueError(f"不支持的回报率：{requested} Hz")
            result["poll_rate_before"] = read_poll_rate(device)
            device.set_poll_rate(requested)
            time.sleep(0.5)
            actual = read_poll_rate(device)
            result["poll_rate_requested"] = requested
            result["poll_rate"] = actual
            result["ok"] = actual == requested
        elif action == "cycle-poll-rate":
            rates = result["supported_poll_rates"]
            if not rates:
                raise RuntimeError("设备没有可用的回报率档位")
            current = result["poll_rate"]
            index = rates.index(current) if current in rates else 0
            next_rate = rates[(index - 1) % len(rates)]
            result["poll_rate_before"] = current
            result["poll_rate_requested"] = next_rate
            device.set_poll_rate(next_rate)
            time.sleep(0.5)
            actual = read_poll_rate(device)
            result["poll_rate"] = actual
            result["ok"] = actual == next_rate
        elif action == "cycle-dpi":
            before = dpi_state(device)
            stages = before["dpi_stages"]
            if not stages:
                raise RuntimeError("设备没有可用的 DPI 档位")
            next_stage = before["active_stage"] + 1 if before["active_stage"] < len(stages) else 1
            target = stages[next_stage - 1]
            device.set_dpi_stages(next_stage, [(x, y) for x, y in stages])
            device.set_dpi(target[0], target[1])
            after = wait_for_dpi_stage(device, next_stage)
            result.update(after)
            result["dpi_before"] = before["dpi"]
            result["active_stage_before"] = before["active_stage"]
            result["requested_stage"] = next_stage
            result["ok"] = after["active_stage"] == next_stage
        elif action == "set-dpi-stage":
            requested = int(sys.argv[2])
            before = dpi_state(device)
            stages = before["dpi_stages"]
            if requested < 1 or requested > len(stages):
                raise ValueError(f"DPI 档位超出范围：{requested}")
            target = stages[requested - 1]
            device.set_dpi_stages(requested, [(x, y) for x, y in stages])
            device.set_dpi(target[0], target[1])
            after = wait_for_dpi_stage(device, requested)
            result.update(after)
            result["requested_stage"] = requested
            result["ok"] = after["active_stage"] == requested
        elif action == "status":
            result["ok"] = True
        else:
            raise ValueError(f"未知操作：{action}")
    except Exception as exc:
        result["error"] = str(exc)
    finally:
        if manager is not None:
            manager.close()
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
