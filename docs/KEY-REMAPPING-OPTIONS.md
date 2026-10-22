# 通用改键接入路线

调查日期：2026-10-22。以下为可复用方案和实现边界，不表示当前通用 HID 卡片已实现硬件改键。

| 方案 | 覆盖范围 | 接入方式 | 边界 |
| --- | --- | --- | --- |
| [VIA](https://github.com/the-via/app) | 启用 VIA 协议、具有匹配型号定义的键盘 | 复用型号定义、矩阵与键码选择界面；通过专用 Raw HID 适配器读写动态映射 | 标准 HID、机械轴甚至 QMK 固件本身都不等于启用 VIA |
| [Vial](https://github.com/vial-kb/vial-gui) | 兼容 Vial 固件的键盘 | 读取设备定义、版本与能力，接入层、组合键、宏等支持的功能 | 需要兼容固件，遵循设备解锁流程 |
| [Kanata](https://github.com/jtroo/kanata) | Windows / Linux / macOS 软件改键 | 作为独立电脑端 provider：生成配置、显式启停、健康检查、回滚、单实例管理 | 软件运行时才生效；Windows 默认钩子不能凭选中的 HID 容器保证只影响这一块键盘 |
| [PowerToys Keyboard Manager](https://learn.microsoft.com/en-us/windows/powertoys/keyboard-manager) | Windows 软件改键与快捷键重映射 | 作为用户已有工具的兼容选项与行为参考 | 依赖 PowerToys 常驻，不是板载配置 |

## 实现顺序

1. 按 HID Usage 识别键盘、鼠标与复合设备，与已确认型号配置交叉校验。复合接口不猜实物类型，允许用户在本机外观设置中纠正。
2. 分开标记诊断、前台输入检测、本机外观、硬件改键、软件改键。Output / Feature 报告存在不等于有通用改键协议。
3. 出现 QMK 默认 Raw HID 的 `FF60/0061` 时仅添加协议线索。这类接口也能承载其他应用，不能据此确认 VIA / Vial；还需型号定义、固件声明和受限协议握手。
4. 真正兼容的型号优先走 VIA / Vial：先读取协议版本、矩阵尺寸、层数、原键表和布局，再开放编辑。应用后逐项回读，支持导出原映射和恢复。未确认型号时禁止写入，不自动刷固件。
5. 未知硬件协议可选 Kanata 软件 provider：独立启用、说明电脑端生效与多键盘影响范围，单实例，关闭撤销。默认不安装 Interception 驱动，不自动叠加已有改键进程，不声称保存进键盘。

当前没有启动全局改键引擎、修改系统 Scancode Map、添加过滤驱动、写入设备键表或自动刷固件。本机雷蛇鼠标的 4K 设置不属于这条通用改键路线。

## Provider 和前端

建议固定接口为 `status()`、`readMap()`、`writeMapAndReadBack()`、`disable()`、`close()`。状态必须包含 provider、协议是否验证、生效范围、可读/可写能力。主进程校验设备身份、版本、矩阵范围、允许键码和操作白名单，不向页面开放任意 HID 路径或原始字节写入。断连后的编辑草稿不能冒充回读成功；软件配置验证不能冒充硬件回读。

后续“按键配置”页：上方显示 provider 与生效范围，中间复用键位图选原键，右侧选目标键/层，底部放读取、应用、恢复、导出。协议未确认时显示原因并禁用应用；软件模式显式开启，始终保留停用入口。

## 复用和许可证

检测图已复用 [shawon9324/keyboard-mouse-tester-webApp](https://github.com/shawon9324/keyboard-mouse-tester-webApp) 的 MIT 键位数据，固定版本与原始许可证随包保留，运行时无需网络。本项目将事件改为只在前台检测区域生效，不启用上游全局页面监听、声音、游戏手柄或 PWA。

VIA 仓库标注 GPL-3.0，Vial GUI 标注 GPL-2.0，Kanata 说明 LGPL-3.0-only 等许可范围。正式复用时保留各部分许可证、固定版本、修改记录及相应源码，不能统一标成项目 MIT。当前安装包预置 VIA 离线版、型号定义与对应源码，但没有安装 Vial 或 Kanata。VIA 需要用户主动连接匹配设备后才执行协议交互，普通诊断不会启动改键。

来源：[VIA 兼容固件](https://caniusevia.com/docs/configuring_qmk/)、[Vial 手册](https://get.vial.today/manual/)、[QMK Raw HID](https://docs.qmk.fm/features/rawhid)、[Kanata 输入后端](https://github.com/jtroo/kanata/releases)、[PowerToys 行为限制](https://learn.microsoft.com/en-us/windows/powertoys/keyboard-manager)。
