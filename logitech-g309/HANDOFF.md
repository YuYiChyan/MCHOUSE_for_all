# G309 实现与接收清单

接收方：**肥鱼（DSH）**。目标：在朋友的 Windows + MCHOSE HUB 机器上完成实机调试、回归与最终验收。当前提供的是可继续开发的实现与独立注入包，不是已通过硬件认证的驱动。

## 调研依据

- [Solaar 的 G309 实机问题记录](https://github.com/pwr-Solaar/Solaar/issues/2816)给出了接收器 `046d:c547`、WPID `40b1`、蓝牙 ID `b03c` 及功能清单。该记录也说明不能只复用旧的普通回报率接口。
- [Solaar 源码](https://github.com/pwr-Solaar/Solaar/tree/e7304c4c451cc9bb4f206a914844525e67856a28)固定到 `e7304c4c451cc9bb4f206a914844525e67856a28`。本次参考其 HID++ 请求匹配、`0x2202`、`0x8061`、`0x1004`、`0x8100` 的处理。
- [libratbag G309 设备请求](https://github.com/libratbag/libratbag/issues/1685)是补充线索；没有把 Linux 守护进程当作可直接安装的 Windows 库。
- [cython-hidapi](https://github.com/trezor/cython-hidapi)提供 Windows Python HIDAPI；固定 wheel 0.15.0，哈希见 DEPENDENCIES.json。

## 已完成的链路

首页原厂卡片克隆 → 显式 `g309` 注册 → `WebContentsView` → `device-preload.cjs` 的白名单 → `device-service.cjs` 串行队列 → 隔离启动离线 Python → `g309_backend.py` → HIDAPI。

仅枚举目标 PID 的 vendor collection，先做 HID++ ping 与名称确认，再认定目标设备。接收器检查槽位 1/2；其他配对设备不能被当作 G309 操作。请求使用软件 ID，忽略其他槽位、异步通知、不匹配响应；有限超时，无限重试和盲发写入均未启用。

| 方法 | 参数 | 行为 |
| --- | --- | --- |
| `status()` | 无 | 返回连接、时间戳、values、capabilities、局部读取错误 |
| `setDpi(value)` | 设备上报列表中的整数 | `0x2202` 扩展 DPI；保留独立 Y／LOD 字段；读取确认 |
| `setReportRate(value)` | 125/250/500/1000Hz 且设备支持 | `0x8061` 以枚举值修改，仅 LIGHTSPEED 开放；读取确认 |
| `setHostMode(value)` | 布尔 | `true` 主机模式、`false` 板载模式；显式点击才发送；读取确认 |
| `back()` | 无 | 返回首页 |

普通状态查询不切模式、不写配置。未建立主机模式时 DPI／回报率只读。蓝牙不能套用接收器回报率选项。电量百分比未知时保留 null，AA 电池不展示充电动画。界面上的回报率是配置读数，不是实测鼠标事件频率。

## 肥鱼的调试顺序

1. 校验 Release 的 SHA256SUMS；阅读 design/SPEC.md，保留完成的布局。先运行包内 Diagnose.ps1 或只读状态，不要先改 DPI。
2. 插入 LIGHTSPEED 接收器、唤醒 G309，确认 PID／vendor collection。若 Windows 不开放所选 collection，优先修复 HIDAPI collection／报告长度选择；不要扩大到任意 Logitech 设备。
3. 验证 ping、名称与动态 feature index，核对 `values`，记录固件及支持的 feature 版本。公共回执隐藏序列号和实例路径。
4. 分别确认 DPI、模式与电量的读取，再由操作者显式切主机模式。修改 DPI 800→1600→原值，确认实际指针变化和回读；在开启独立 Y／LOD 时检查其值未被覆盖。
5. 验证所有设备报告的可用回报率并回读，使用独立测量工具复核；恢复原设置。切回板载模式，确认原生按键正常。记录拔插、断电后的模式行为，不声称临时设置已经持久化。
6. 另测蓝牙。若 vendor HID 不可用，保持明确不支持／未知的状态，不伪造 USB 读数。多设备、休眠和 G HUB 并发访问逐项记录。
7. 完成下列清单后提交修复和回执；未做实机项目继续保持未勾选。

## 验收

- [ ] 接收器真实 VID/PID、设备名称、固件和 features 已确认；未误控其他配对设备。
- [ ] 纯读取不改变模式或设置；休眠／拔出不会继续显示实时连接。
- [ ] DPI、回报率写入与回读一致；错误 ACK／超时不会被当成功。
- [ ] 独立 Y／LOD 保留；无板载擦写、配对或固件命令。
- [ ] 电量与参考读数合理，未知等级不冒充精确百分比。
- [ ] 主机／板载模式切换、恢复、重启后的行为已记录。
- [ ] 蓝牙能力单独验收；不支持项禁用并说明原因。
- [ ] 原厂首页列表／网格、亮／暗／毛玻璃继承正常，黑／白贴图切换与持久化正常。
- [ ] 全部菜单、返回、Esc、主题同步、窗口缩放和断开错误展示正常。
- [ ] 单独安装、与 BlackShark／原三卡共存、修复、卸载不互相破坏。
- [ ] 原厂更新后入口恢复、卡片数据保留；最后卸载恢复原入口。
- [ ] 交回测试系统版本、迈从版本、连接方式、结果表、必要的脱敏诊断和修复提交。

## 注入交接

Install／Repair／Uninstall 和 `scripts/Manage.ps1` 已备齐；不需要重新设计安装入口。`devices.json`、`library/host/{host.cjs,cards.js,native-cards.js,main-preload.cjs}`、`library/runtime-map.json` 已显式登记新卡片。修改公共源码后运行 `scripts/Sync-Library.ps1 -Version 0.2.0-handoff.2`，不要只改某个生成包。测试必须使用副本或临时夹具。

目前无此设备，协议单测、离线布局和模拟接口检查不能替代以上硬件清单。保持 Issue 开放，直至接收方完成实际验收。

## handoff.2 贴图交接

已按用户提供原图接入透明 PNG，元数据在 ARTWORK.json。首页点击配色按钮循环，设置页点击独立色块；选择持久化并通过独立 setColor IPC 同步回首页，不向硬件发送任何配色命令。不要将这两色／三色重新降级成单色示意图。接口与素材已随独立包打包。
