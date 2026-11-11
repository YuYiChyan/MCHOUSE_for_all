# 西伯利亚耳机控制

One4All 支持库包含以下 10 个原厂明确支持的型号及 34 个商品图配色。自有界面提供声音输出、均衡器、空间音效、麦克风、设备信息五个分页。硬件功能均保留“待验证”，用户可单独进行本机确认或提交反馈。

| 型号 | 对应 USB 标识 |
| --- | --- |
| XIBERIA T10 有线 | 36F9:D003 |
| XIBERIA T10G | 36F9:D003 |
| XIBERIA T10 无线 | 36F9:F001、36F9:F010 |
| XIBERIA K03S 超竞版 | 36F9:F016、36F9:F017 |
| XIBERIA K03 有线二代 | 36F9:E003 |
| XIBERIA K06S | 36F9:F002、36F9:F011 |
| CROCIRIS T7 | 36F9:F008、36F9:F014 |
| CROCIRIS T7 GT | 36F9:F009、36F9:F015 |
| XIBERIA S21 无线智充版 | 36F9:C001 |
| XIBERIA W30 | 36F9:F026 |

T10/T10G 共用 USB 标识，沿用原端点名称匹配区分。K03S 超竞版保留旧模块 ID `k03s`。旧 S21 MAX（36F9:D000）和旧 K03S 7.1 不在这份新 X HUB 支持名单中。

## 使用与依赖

音量、静音、麦克风使用 Windows Core Audio。EQ、预设、空间环绕、低音增强、人声清晰和智能音量使用官方 SDK/APO，只有实际读取成功的功能才开放操作。没有音效组件时，正常 Core Audio 控制仍可使用。

音效依赖通过设备信息中的“安装音效组件”按需从官网下载。安装音频驱动可能需要重启，程序不会自动安装。只有用户点击“打开官方 APP”才启动官方界面；日常调节由 One4All 的独立原生桥接子进程完成。

输入和输出必须属于同一实际设备容器。多台同型号设备存在歧义时不操作，也不回退到系统默认音频设备。页面关闭会结束该型号的控制会话；断开后重新连接可以恢复读取。

## 官方 0.3.1.0 核对结果

官方下载入口：[XIBERIA X-HUB 耳机驱动](https://www.xiberia.net/h-col-181.html)。该页面于 2026-11-12 标示 V0.3.1、更新日期 2026-10-27，下载文件为 `XIBERIA HUB Setup v0.3.1.0.exe`。文件由官方 `files.xiberia.net:9443` 提供，下载地址由官方页面取得。

| 文件 | 核对结果 |
| --- | --- |
| 安装包大小 | 273,743,040 字节 |
| 安装包 SHA256 | `1035097ae65a89e3d5da398bd7c7df67fe2c82cc3ca4910fef192b43bd6be748` |
| 安装包 Authenticode | Valid，签名主体 Dongguan Desheng Industrial Co.,Ltd. |
| LHDCX_XIBERIA_DLL.dll 程序集版本 | 1.0.19.0 |
| SDK SHA256 | `a4c99f0df9ebd24305f4ee31e71888e3079b3303879171c32e5085ae71f1def6` |

0.3.1.0 中的 SDK SHA256 与已对接的 0.3.0.6 SDK 完全相同。只读元数据核对也确认原桥接使用的端点选择、EQ 数组、预设及四项音效接口保持一致，例如：

```text
Int32 GetDeviceApoCount(String, UInt32, UInt32 ByRef)
Int32 GetDeviceApoInfo(UInt32, UInt32, String ByRef, String ByRef)
Int32 SetDeviceApoClsid(UInt32, String)
Int32 SetLhdcDevice(String)
Double[] GetEqualizerBandGains()
Int32 SetEqualizerBandGains(Double[])
Int32 SetEqualizerState(Boolean)
AudioSettingOption GetPreset()
Int32 SetPreset(AudioSettingOption)
```

上述核对通过解包和 `ReflectionOnlyLoadFrom` 完成，没有安装 X HUB、实例化厂商 SDK 或向真实硬件写入。SDK 一致证明接口兼容，不代表所有列出的型号已经实机验证。

## 开发接入

- 型号、图片与支持信息：`catalog/xiberia-headsets.json`。
- 原端点匹配与 SDK 桥接：`core/xiberia/audio_backend.py`、`core/xiberia/NativeBridge.cs`。
- 独立控制服务：`core/xiberia-models.cjs`，提供 `scan()`、`status(modelId)`、`execute({modelId,command,value})`、`closeModel(modelId)`、`close()`。
- 自有五分页：`app/xiberia-controls.js` 和 `app/xiberia-controls.css`。
- 资源导入：`scripts/extract-xiberia-assets.cjs`，使用已经提取的原厂商品图，无需安装驱动即可浏览卡片。

Core Audio 复用设备模块中的 Python 与 `xiberia-audio-deps`：pycaw 20260927、comtypes 1.4.17、psutil 7.2.2。原生桥接使用 .NET Framework 4.8，在独立 x86 进程加载官方安装目录中的 SDK。桥接自身编译产物位于用户数据目录 `native/xiberia`；默认数据目录为 `%APPDATA%\One4All-Desktop`，可通过 `ONE4ALL_DESKTOP_STATE` 覆盖。

官方默认安装目录为 `{autopf}\XIBERIA HUB`。桥接同时查找注册表安装目录、`%ProgramFiles(x86)%\XIBERIA HUB` 和 `%ProgramFiles%\XIBERIA HUB`。SDK 所需 .NET 系统库、Newtonsoft.Json 与原生依赖从官方安装目录加载，不向浏览器页面注入后端。

桥接与端点匹配代码沿用 MIT 许可。商品图版权归原厂；官方 SDK/APO 为厂商组件，不作为 One4All 的自由许可代码分发，也不在程序包中复制厂商 SDK DLL。

针对检查覆盖服务路由、共享 USB 标识区分、禁止默认端点回退、无音效组件时保留基础控制、页面关闭和同型号重开，以及五分页的假设备交互。检查不会产生真实硬件写入。
