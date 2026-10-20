# Third-party sources

- One4All Kit (`library/`): original integration UI, widgets, frontend adapters, demo host and installer source extracted from this project, MIT. The device-specific open-source controllers and proprietary vendor binaries are not included in the standalone kit. Theme values document this project's implementation, not an official vendor design specification.

- MCHOSE HUB: proprietary, used from the user's existing installation. No app executables, vendor bundles, iconfont, or MiSans binaries are redistributed. Installer extracts icons locally and downloads fonts from the public vendor CDN with hashes.
- EWEADN HFD HUB: proprietary site https://hub.eweadn.cn/hfd68/web/. Original JS/CSS/images are downloaded to the user's machine during Tank68 installation, verified against the manifest; only the integration shell is included here.
- openrazer-win: https://github.com/Ar4ikov/openrazer-win, commit 6a626b2d11069ec8be6a7eda6e0dd8ee3ece0998. GPL-2.0-or-later. Python source, pyproject, upstream LICENSE and LICENSES retained in razer-mini-se/payload/openrazer-win.
- CUKTECH BLE server: https://github.com/kairui1108/cuktech-ble-server, commit 3baab13a6f5556aeb63b129d46f5a1bde441e4a7. Upstream README declares MIT; unmodified protocol/server source and source metadata retained under cuktech-10-ultra/payload/cuktech/upstream. Upstream did not provide a standalone root LICENSE at this revision; REFERENCE-LICENSE is explicitly from the reference project, not a substituted upstream license.
- BLE reference: https://github.com/zhyzhaogit/cuktech-ble-controller, MIT, reference license retained. Xiaomi login upstream credits PiotrMachowski/Xiaomi-cloud-tokens-extractor (MIT).
- Python: official CPython 3.13.16 Windows x64 embeddable distribution, PSF license and included licenses inside each runtime archive. Source URLs and SHA-256 are recorded in PYTHON-SOURCE.json.
- Python dependencies: exact installed versions in cuktech-10-ultra/DEPENDENCIES.json, wheel metadata and license files retained in vendor/charger-deps.zip. Rebuild with scripts/rebuild-deps.ps1.
- Product photographs: supplied by the user for their device cards; original image and trademark rights belong to their respective owners. They are not covered by the code license.

The current account's Mi Home token, BLE key, account data, device address, and binding configuration are not included in this repository or its packages.
# 新交接设备的依赖与来源（0.2.0-handoff.1）

| 项目 | 固定版本／提交 | 使用方式与许可 |
| --- | --- | --- |
| pwr-Solaar/Solaar | e7304c4c451cc9bb4f206a914844525e67856a28 | HID++ 后端参考与适配，GPL-2.0-or-later；完整源码快照随 G309 包携带 |
| trezor/cython-hidapi | wheel 0.15.0 cp313 win_amd64 | Windows HID 传输；保留 BSD／GPL／原始 HIDAPI 等上游许可文件 |
| AndreMiras/pycaw | wheel 20260927；源码 2890e07ab205adbe31346c5ee05b24743f1ba83c | Core Audio 端点接口，MIT；源码快照随耳机包携带 |
| enthought/comtypes | 1.4.17 | Windows COM 运行库，MIT；wheel 元数据中保留许可 |
| giampaolo/psutil | 7.2.2 win_amd64 | pycaw 依赖，BSD-3-Clause；wheel 元数据中保留许可 |
| Equalizer APO | 官方 Git bbfcc3e5024cbb9d61ba75fc88d78605cc4c9687 | 可选独立 GPL-2.0-or-later 引擎源码包；本项目通过文本配置适配，不复制 THX 模块 |

每个必要 Python wheel 的 SHA256 记录在设备 DEPENDENCIES.json 与 requirements-lock.txt。离线依赖解包 ZIP、原始 wheels、Python 运行时、上游源码和许可证随各自设备包提供。可选 EQ 的官方安装器下载受 403 限制未打包；SOURCE.json 记录来源与源码哈希。原有轮廓 SVG 为项目原创；handoff.2 新增五张用户提供的透明 PNG，保留原始文件字节并在 ARTWORK.json 记录尺寸和哈希。品牌图像版权归原权利人，不属于代码 MIT 许可。

---
