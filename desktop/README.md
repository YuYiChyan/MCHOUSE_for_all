# One4All Desktop · 0.7.0-preview.1

独立设备中心。Windows 用户运行 `dist/One4All-Setup-0.7.0-preview.1.exe` 安装，随后从桌面或开始菜单打开；卸载入口在系统“已安装的应用”及开始菜单中。开发目录仍可双击 `启动 One4All.cmd`。无须先打开 MCHOSE HUB。

[下载 Windows 安装包](https://github.com/YuYiChyan/MCHOUSE_for_all/releases/download/desktop-v0.7.0-preview.1/One4All-Setup-0.7.0-preview.1.exe) · [本版发布说明](https://github.com/YuYiChyan/MCHOUSE_for_all/releases/tag/desktop-v0.7.0-preview.1)

本版新增达摩鲨、Attack Shark、英菲克、Keychron、MonsGeek、Akko、RK、红龙的原生控制接入，并把西伯利亚已有十款接到独立桌面支持库。保留卡片叠层、柔和投影和玻璃质感。选色圆点用偏心黑白弧面与少量暖金过渡，叠加当前商品配色；色盘支持连续展开、收起和中途反向。支持库把连接方式、地区布局和重复配色收进同一产品卡，当前 625 条型号/接口记录合并为 553 张带图产品卡片，真实型号和控制入口完整保留。

“待验证”徽章可由用户实测后确认到本机，支持撤销。GitHub 上报继续可用，另外预留统一服务器的提交反馈和刷新状态接口，地址默认空，详见 [验证服务契约](docs/VERIFICATION-SERVER-API.md) 与 [安装包说明](docs/WINDOWS-INSTALLER.md)。

新增卡片全部标记为待验证。西伯利亚 EQ/音效按需从官网下载 X HUB 0.3.1.0；核心 SDK 与已适配 0.3.0.6 字节一致。音量/麦克风使用系统接口，普通控制不启动官方 APP。美加狮（Mad Catz）仍未列为已接入。

## 本轮新增

| 品牌 | 支持库产品卡 | 接入功能 |
| --- | ---: | --- |
| 达摩鲨 | 31 | DMS 两代协议，DPI、档位、回报率、电量 |
| Attack Shark | 2 | X11PRO V2、X11SE 等高线，有线 DPI、档位、回报率 |
| 英菲克 | 3 | ZHEN、IN10 升级版、IN9 PRO V2 升级版，有线 DPI、档位、回报率、亮度 |
| Keychron | 12 | Q Max 官方 VIA 布局及基础改键 |
| MonsGeek | 9 | 明确 QMK/VIA 版本，基础改键 |
| Akko | 10 | 官方 VIA 型号，基础改键 |
| RK | 3 | R65/R75/R87 Pro 的 QMK/VIA 版，基础改键 |
| 红龙 | 2 | K715 PRO / K717 PRO 官方 VIA 定义，基础改键 |
| 西伯利亚 | 10 | 原有五分页、系统音量/麦克风和原厂 EQ/音效 |

键盘共有 55 份精确 USB/布局定义，随 APP 提供，卡片内切换版本。未连接时仍可查看商品图、切色及设备信息。详见 [官方 VIA 型号](docs/OFFICIAL-VIA-BRANDS.md)、[Attack Shark](docs/ATTACKSHARK-CONTROLS.md)、[达摩鲨](docs/DARMOSHARK-CONTROLS.md)、[英菲克](docs/INPHIC-ADAPTER.md)、[西伯利亚](docs/XIBERIA-CONTROLS.md)。

## 原有接入范围

新增 ATK、VXE、VGN、达尔优、雷柏、狼蛛、MelGeek 的 228 张带官方图卡片和直接控制接口，见 [国产品牌接入范围与缺图清单](docs/DOMESTIC-CONTROLS.md)。原有型号与圆点切色继续保留。迈从、罗技和雷蛇已接入的接口继续保留，见 [原有控制接入范围](docs/CONTROL-INTEGRATION.md)。新型号均待实机验证。

这是自带 Chromium 的 Electron 桌面 APP。自己的资源库、下载与本地进程管理位于桌面端，设备模块可按需启动并记录异常；详见 [桌面架构](docs/DESKTOP-ARCHITECTURE.md)。

- 沿用原有商品图、黑白主题、蓝色选中态、圆点切色和设备设置页；颜色与主题保存在本机。
- 本机已有 One4All 注册的设备首次启动时复制为独立模块快照。当前三项是 TANK68 HE、Razer Viper Mini SE、CUKTECH 10 Ultra。后续旧宿主更新不会改写此快照。
- 统一键盘入口读取实际 Windows HID 信息；键盘页每五秒检查插拔变化。标准按键测试与厂商硬件设置分别呈现。
- 统一控件词汇覆盖改键、层、宏、灯效、回报率、去抖、Win 锁、板载配置及磁轴触发、RT、DKS、SOCD、校准。只有适配器确认可调用的能力才显示。VIA 提供真实握手和基础键码读写；本轮五品牌型号已内置原厂 JSON 定义，其他 VIA 设备仍可手工导入。新增型号未做实机验收。
- 支持库优先从迈从、雷蛇、罗技、西伯利亚官网下载驱动；安装由页面中的“运行安装器”启动。拆分组件的下载协议支持固定版本 GitHub Release。当前没有新增发布的 GitHub 适配模块。
- 迈从 0x4D 共用协议通过 WebHID 直连，罗技 HID++ 2 通过现有便携 HIDAPI 直接控制。先识别具体型号并读取功能，再生成设置控件；新型号全标待验证。其他协议仍保留原厂入口。
- 设备信息提供“提交验证反馈”：用户选择实测通过的功能并确认，配置个人 GitHub Token 后可直接发 Issue；未配置则打开预填网页，登录后提交。报告绑定型号和版本，不自动清除整个型号族的待验证标记。
- 适配工作台配置兼容 OpenAI Chat Completions 的地址、模型和密钥。内置规范与静态包检查器，生成待验证模块，可在独立工作进程中试用并保留日志。

## 模型适配流程

1. 在支持库下载需要的品牌包。
2. 在适配工作台填写接口地址、模型、API Key，保存并测试连接。兼容 DeepSeek 与自建代理；不读取聊天应用的订阅凭据。
3. 选择驱动包、填写所需功能，可补充协议或错误资料，然后生成。
4. 工作台自动附上已有官方安装目录中可读取的 IPC、schema、FFI 等证据和 [适配规范](docs/ADAPTER-SPEC.md)。尚未解出真实接口时，结果应说明缺失资料。
5. 查看生成结果并点击试用。试用先调用 `probe`，由返回的实际能力生成控件。模块在独立进程运行，不能将进程隔离视为操作系统权限隔离；不要运行不信任的代码。

厂商安装器可能只是在线引导程序，并不直接包含驱动实现。已取得迈从和上述国产品牌的原厂协议/设备模块、雷蛇现有控制库与本机接口资料，以及罗技 G HUB 的组件目录、产品资源；罗技控制协议参考固定版本 Solaar 实现。

## 本机路径

| 内容 | 路径 |
| --- | --- |
| 应用设置、模块快照、配对数据 | `%APPDATA%/One4All-Desktop` |
| 按需下载的原厂安装器、只读拆包缓存 | `%LOCALAPPDATA%/One4All-Desktop` |
| AI 草稿 | `%APPDATA%/One4All-Desktop/adapter-drafts` |
| 试用记录 | `%APPDATA%/One4All-Desktop/adapter-runs.jsonl` |

本机已有依赖的迁移快照不属于主程序发行包。安装包自带 Electron、通用 Python/HID 控制库与设备图片资源；新机创建独立数据目录，已有安装继续保留模块和设置。完整厂商安装器仍按需从官网下载。开发运行时位于 `vendor/electron`，正式安装包位于 `dist`。

## 开发接口

- `core/keyboard-capabilities.cjs`：能力规范化、输入范围与读写结果。
- `core/vendor-packages.cjs`：目录、下载、安装与来源。
- `core/package-inspector.cjs`：静态接口证据。
- `core/ai-adapter.cjs`：兼容 API 请求、配置与草稿。
- `core/adapter-runner.cjs`：`createAdapter({packageRoot,device})` → `probe/execute/close` 的试用运行接口。
- `app/preload.cjs`：界面的固定调用接口。设备页继续使用各自已有的 preload。

检查：`node --test test/*.test.cjs`。`scripts/ai-runtime-smoke.cjs` 用本地模拟 API 和无硬件测试模块验证真实 Electron 工作进程链路；它不代表实际模型或设备验证。

## 当前验证记录

2026-11-12（0.7.0-preview.1）：新增型号的协议帧、读回、精确身份与关闭路径通过针对性夹具；使用自带 Chromium 检查新机支持库、商品图、未连接详情和返回导航。硬件功能仍标记待验证。

2026-11-12（0.6.0-preview.3）：按用户要求把选色圆点改为黑白交错弧面、少量暖金过渡，保留当前配色滤层和连续收放动画。已对照官方配色组件的当前色提示与展开方式；底纹是本项目设计，原生参考见 [配色按钮参考](docs/COLOR-PICKER-REFERENCE.md)。

2026-11-12（0.6.0-preview.2）：修复未连接设备时，目录卡片直接打开官方网页且离页后覆盖层残留的问题。键盘及其他目录产品先显示自己的商品图、配色和设备信息，官方设置由用户主动打开；切页关闭覆盖层，旧请求和清理异常不会阻断后续页面。安装版实际走通 Ace 60 Pro、S9 Pro 离线详情、主导航及官方页返回，原三张卡和配色设置一致，记录见 `research/preview2-installed-check.json`。珠光圆点同步当前色，展开/收起可中途反向衔接，记录见 `research/color-picker-smoke.json`。

2026-11-12（0.6.0-preview.1）：本地确认、服务接口、目录分组和新机初始化检查通过。真实 Electron 页面走通渐变配色入口、展开/收起、切图及恢复原配色；合并卡保留成员选择，未配置服务时不发请求。本地确认保存/撤销用内存替代服务验证，没有替用户确认真实型号。三张原卡保持，记录见 `research/surface-ui-smoke.json`。

2026-11-11（preview.3）：新增七品牌路由与资源刷新后，90 项 Node 检查通过；随后加入连接取消路径，相关 MelGeek 检查扩展至 16 项并全部通过。实际 Electron 中走通七品牌商品卡到统一内页、配色传递、逐键读回、离页取消和反馈入口；原厂 MelGeek WASM 在自带 Chromium 中加载并退出，记录见 `research/domestic-ui-smoke.json`。原有三张卡仍在，本轮没有写入实物设置或提交真实 Issue。

2026-11-11（preview.2）：42 项 Node 检查、11 项罗技协议夹具通过；真实 Electron 中走通迈从/罗技卡片到统一内页、圆点配色传递、七类控件的模拟读写调用和反馈表单。罗技实际只读扫描成功、当时未接入罗技设备；迈从与罗技新增型号均未做实机写入验证。本次未创建真实 GitHub Issue。

2026-11-11：三个已有卡片及入口已载入独立宿主；实际打开三项设备页并返回。官网三项安装包下载完成，未执行新安装。能力、VIA 协议模拟、下载与模型配置共 21 项测试通过，模拟 API → 草稿 → Electron 工作进程试用通过。未使用用户模型密钥，未确认三家全部型号或磁轴功能。
