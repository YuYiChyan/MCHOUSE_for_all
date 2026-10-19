# Third-party sources

- MCHOSE HUB: proprietary, used from the user's existing installation. No app executables, vendor bundles, iconfont, or MiSans binaries are redistributed. Installer extracts icons locally and downloads fonts from the public vendor CDN with hashes.
- EWEADN HFD HUB: proprietary site https://hub.eweadn.cn/hfd68/web/. Original JS/CSS/images are downloaded to the user's machine during Tank68 installation, verified against the manifest; only the integration shell is included here.
- openrazer-win: https://github.com/Ar4ikov/openrazer-win, commit 6a626b2d11069ec8be6a7eda6e0dd8ee3ece0998. GPL-2.0-or-later. Python source, pyproject, upstream LICENSE and LICENSES retained in razer-mini-se/payload/openrazer-win.
- CUKTECH BLE server: https://github.com/kairui1108/cuktech-ble-server, commit 3baab13a6f5556aeb63b129d46f5a1bde441e4a7. Upstream README declares MIT; unmodified protocol/server source and source metadata retained under cuktech-10-ultra/payload/cuktech/upstream. Upstream did not provide a standalone root LICENSE at this revision; REFERENCE-LICENSE is explicitly from the reference project, not a substituted upstream license.
- BLE reference: https://github.com/zhyzhaogit/cuktech-ble-controller, MIT, reference license retained. Xiaomi login upstream credits PiotrMachowski/Xiaomi-cloud-tokens-extractor (MIT).
- Python: official CPython 3.13.16 Windows x64 embeddable distribution, PSF license and included licenses inside each runtime archive. Source URLs and SHA-256 are recorded in PYTHON-SOURCE.json.
- Python dependencies: exact installed versions in cuktech-10-ultra/DEPENDENCIES.json, wheel metadata and license files retained in vendor/charger-deps.zip. Rebuild with scripts/rebuild-deps.ps1.
- Product photographs: supplied by the user for their device cards; original image and trademark rights belong to their respective owners. They are not covered by the code license.

The current account's Mi Home token, BLE key, account data, device address, and binding configuration are not included in this repository or its packages.
