# Attack Shark 原生控制

当前接入 X11PRO V2 与 X11SE contour lines（等高线版）两款的 USB 数据线直连。两款均有原厂商品图，统一控件提供 DPI、当前档位、回报率读写；全部实机状态待验证。

## 来源与准确范围

[Attack Shark 官方驱动下载页](https://attackshark.cn/system.aspx?ClassID=18)的“ATTACK SHARK WEB 2”明确列出 `X11PROV2 (X11SE Contour Line)`，链接到 [inputdrv 官方入口](https://inputdrv.com/Attack-Shark/)。该入口实际包为：

`https://inputdrv.com/Attack-Shark/_next/static/chunks/app/page-992e15056d14b0ca.js`

SHA-256：`89036940dbe622093b571196cf367f5df8d779c8f196922c7b4ff57c731a5654`。

包中 `products` 表直接对应完整名称、产品图、设备身份。X11SE contour lines 的 deviceId 为 20、直连 USB 为 `1D57:2414`；X11PRO V2 的 deviceId 为 169、直连 USB 为 `1D57:22A9`。通讯集合使用原厂默认 `usagePage=11, usage=0`，要求 FeatureReport `0xA0`。同包其他配置未自动宣称为此入口支持。

两款的无线接收器共用 `1D57:FA60`，原厂另开监听接口，根据主动上报的 deviceId 确定实际鼠标。本轮未完成那条身份绑定，接收器不在授权 filters 中，卡片适配说明明确要求 USB 数据线。没有按相同 PID 猜鼠标型号。

## 实际控制

原厂 `getConfig` 先用 FeatureReport `0xA0` 发送报告号、长度和板载配置，轮询 `0xA0` 就绪后读取目标报告。当前配置取报告 12 的字节 2，并验证字节 3 是其按位取反；这与其他外观相似的 KP 方案布局不同。

- X11PRO V2 的 DPI 使用原厂 `eM` 布局：每档低/高字节位于报告 4 的 `8+i` / `16+i`，实际 DPI 16 位数值，50–30000。
- X11SE 等高线版使用原厂 `eL` / `T` 映射表和高速位，50–22000。10000 以上只接受能精确编码的值（200 的倍数），不默默近似成另一个 DPI。
- 两款原厂配置均禁用 Y 轴独立设置，因此统一控件显示联动 DPI。
- 保留原始其他档位、颜色、传感器位及板载配置；DPI 写入按原厂对字节 3–49 求和，放入字节 50/51。
- 回报率报告 6 使用原厂 8/4/2/1 编码，对应 125/250/500/1000 Hz，并更新取反字节。
- 设置后重新读取配置并核对结果。没有接入的灯光、按键、宏、电量、无线功能不返回可用能力。

## 文件与验证

`scripts/extract-attackshark-assets.cjs` 导出 `extract({outputRoot,offline,updateRegistry})`；生成 `catalog/attackshark-protocols.json` 及用户缓存中的商品图目录。`core/attackshark-models.cjs` 提供型号支持查询。`app/attackshark-provider.js` 导出 `One4AllAttackshark.createApi`，实现通用 `scan/connect/status/execute/close`。

`node --test test/attackshark-provider.test.cjs` 的 9 个无硬件夹具验证：两款的原厂布局、板载配置、读写字段保留、编码表、高 DPI 不近似、共享接收器/其他型号拒配、异常读回、就绪超时、迟到 open 资源清理及页面关闭竞态。未写入真实硬件。
