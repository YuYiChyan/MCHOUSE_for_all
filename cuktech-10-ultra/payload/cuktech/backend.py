"""Loopback-only host for the pinned CUKTECH open-source BLE server."""
import asyncio
import json
import os
from pathlib import Path
import secrets
import sys

BASE = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE / "python-deps"))
sys.path.insert(0, str(BASE / "upstream"))
DATA = Path(os.environ.get("ONE4ALL_DATA_DIR", str(BASE / "data")))
DATA.mkdir(parents=True, exist_ok=True)
os.environ["CUKTECH_CONFIG_PATH"] = str(DATA / "config.yaml")
os.environ["CUKTECH_LOG_FILE"] = str(DATA / "ble.log")
os.environ["CUKTECH_HISTORY_DB_PATH"] = str(DATA / "history.db")
os.environ["MQTT_ENABLED"] = "0"
os.environ["CUKTECH_LOG_LEVEL"] = "warning"
if not (DATA / "config.yaml").exists():
    (DATA / "config.yaml").write_text(
        'ble: {mac: "", token: "", ble_key: ""}\n'
        'mqtt: {enabled: false}\nbemfa: {enabled: false}\n'
        'server: {host: "127.0.0.1", port: 18199, log_level: warning}\n',
        encoding="utf-8",
    )

from aiohttp import web
import ha_server

TOKEN = os.environ.pop("ONE4ALL_CHARGER_SECRET", "")
if len(TOKEN) < 32:
    raise RuntimeError("Missing local service authentication")


@web.middleware
async def local_only(request, handler):
    if not secrets.compare_digest(request.headers.get("X-One4All-Key", ""), TOKEN):
        return web.json_response({"error": "Forbidden"}, status=403)
    response = await handler(request)
    response.headers["Cache-Control"] = "no-store"
    return response


async def local_summary(request):
    server = ha_server.get_server()
    return web.json_response({
        "configured": bool(server.config.ble.mac and server.config.ble.token),
        "mac": server.config.ble.mac,
        "quality": server.ble.connection_quality(),
    })


ha_server.app.middlewares.insert(0, local_only)
ha_server.app.router.add_get("/api/local/summary", local_summary)


async def wait_for_pairing(app):
    server = ha_server.get_server()
    if not (server.config.ble.mac and server.config.ble.token) and server._ble_task:
        server._ble_task.cancel()
        try:
            await server._ble_task
        except asyncio.CancelledError:
            pass
        server._ble_task = None


ha_server.app.on_startup.append(wait_for_pairing)


async def main():
    runner = web.AppRunner(ha_server.app, access_log=None)
    await runner.setup()
    site = web.TCPSite(runner, "127.0.0.1", 0)
    await site.start()
    port = site._server.sockets[0].getsockname()[1]
    print(json.dumps({"ready": True, "port": port}), flush=True)
    # The owning Electron process closes stdin on exit, allowing normal BLE cleanup.
    await asyncio.to_thread(sys.stdin.buffer.read)
    await runner.cleanup()


if __name__ == "__main__":
    asyncio.run(main())
