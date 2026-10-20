# Logitech G309 · 交接验收包

接收方：**肥鱼（DSH）**。阶段：前端与协议适配已实现，黑／白透明贴图已接入，尚无 G309 实机验收。此包属于 `v0.2.0-handoff.2` 预发布，不代表 Windows 硬件兼容性已经确认。

先读 [HANDOFF.md](HANDOFF.md)，再查看 [design/SPEC.md](design/SPEC.md)。前端可直接打开 `payload/g309.html`，离线时不显示伪造设备数据。

## 注入

解压本设备 ZIP 后运行 `Install.cmd`。程序定位 `Program Files/MCHOSE HUB/resources/app`，校验包内文件哈希，使用 `%USERPROFILE%/One4All` 保存扩展与数据，备份原入口并安装共用加载器；随后运行原迈从主程序。需要写安装目录时触发 Windows 提权。也可在 PowerShell 明确传入：

```powershell
.\Install.ps1 -Target 'C:\Program Files\MCHOSE HUB' -StateRoot (Join-Path $env:USERPROFILE 'One4All')
```

`Repair.cmd` 修复入口；`Uninstall.cmd` 只取消本卡片，最后一个卡片卸载时恢复原入口。更新恢复任务只在迈从退出、更新文件稳定后修复。仅支持可见 `resources/app/package.json` 的安装形式，ASAR-only 待适配。

## 范围与离线依赖

优先 LIGHTSPEED 接收器，蓝牙作为待验收的第二连接方式。读取电量、DPI、回报率和模式；设备支持时开放显式主机／板载切换、DPI 和回报率写入。参数以设备查询为准，写后必须回读。暂不提供按键宏、配对、固件升级和板载配置擦写。

包内带 CPython 3.13.16、Windows HIDAPI wheel、解包后的离线依赖 ZIP，以及固定提交的 Solaar 完整源码。Linux 的 Solaar 本身不会在 Windows 中启动；本项目从其协议实现适配了 Windows HID 传输。协议后端采用 GPL-2.0-or-later，公共界面／桥接 MIT，第三方许可证保留在源包和 wheel 元数据中。
