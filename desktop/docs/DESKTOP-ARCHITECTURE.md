# One4All Desktop 当前架构

One4All Desktop 是独立 Electron 应用：自带 Chromium 页面运行环境，通过自己的主进程管理设备接口、文件和后台任务。0.6.0 的 Windows 打包结构包含应用、公共控制库与可重定位的商品资源，支持全新用户目录启动，也兼容已有模块迁移。

## 窗口与本地模块

`app/main.cjs` 创建应用窗口，加载本地 `app/index.html`；`app/preload.cjs` 通过 `contextBridge` 向页面暴露固定调用入口。页面不直接使用 Node.js 文件或进程 API。主进程接收 `one4all-desktop:*` IPC，并把请求分派给设备服务、资源目录、下载管理器或适配器运行器。

`core/desktop-bootstrap.cjs` 处理三种启动状态：已有独立注册表或模块时保留原内容；发现旧 One4All 时迁移已安装模块和设备数据；全新电脑则从安装包 `resources/base-payload` 复制 Python、OpenRazer 与 HIDAPI 公共库，创建空的已安装卡片注册表，并导入支持库种子。新机器可直接使用支持库和统一控件，无需先安装旧宿主。

迁移后的模块位于 `%APPDATA%/One4All-Desktop/modules/imported`，由 `runtime/host.cjs` 挂载原有卡片及设备页。旧宿主的更新不会直接覆盖该独立快照。发行包只收录公共运行库，没有复制开发机旧卡片注册表、设备数据、账户凭据或浏览器状态。

原有商品图、主题与圆点切色继续由本地卡片和设置页使用。统一鼠标、键盘页按 provider 实际报告的能力生成控件。不同控制方式保留清晰的执行位置：

| 路径 | 执行位置与作用 |
| --- | --- |
| 已接入的 WebHID 品牌协议 | 页面中的 provider 直接读写已授权 HID 接口；主进程为当前型号准备匹配范围 |
| 雷蛇、罗技本地控制器 | 主进程服务按队列调用本机 Python/HID 控制库，设置独立超时并处理返回结果 |
| 原有独立设备卡片 | 本地模块页及其已有控制服务，由 `runtime/host.cjs` 管理 |
| 官方网页入口 | 独立 `WebContentsView` 和品牌会话加载官方页面 |
| 适配工作台生成的候选 | 经用户点击试用后，在 `utilityProcess` 内调用适配器 |

官方入口与统一控制器是不同功能。存在产品图或下载完成并不代表该型号已经实机验证；待验证状态继续保留。

## 资源与依赖按需取得

Windows 安装器使用 NSIS，安装到当前用户的 `%LOCALAPPDATA%/Programs/One4All`，登记开始菜单、可选桌面快捷方式和系统卸载入口。覆盖安装保留个人配置；卸载默认只移除应用文件，可选择清理本账户的两个 `One4All-Desktop` 数据目录。安装与卸载支持 `/S`，静默卸载保留数据。构建入口及输出清单见 [安装包构建说明](../packaging/README.md)。

`core/vendor-packages.cjs` 管理品牌依赖。用户选择品牌后优先从登记的官网地址下载；需要独立分发的拆分组件可使用固定版本 GitHub Release。下载和运行安装器是两个明确操作，界面不会把“安装器已启动”当作“安装完成”。当前没有把所有厂商驱动塞入主程序包。

型号、商品图、原厂 JS、设备定义及需要的 WASM 缓存放在 `%LOCALAPPDATA%/One4All-Desktop/vendor-resources/{brand}`。`core/resource-refresh.cjs` 将提取工作放进 `utilityProcess`，避免下载和解包占用界面主线程。ATK、VXE、VGN 共用一次提取任务，但各自写独立目录并返回各自型号数量；其他品牌分别刷新。资源任务最长等待 15 分钟，超时终止；退出应用时停止仍在运行的任务。

运行时产物写用户缓存目录。达尔优、雷柏的资源刷新传入 `updateRegistry:false`，不改应用内的协议清单；雷蛇、罗技的提取报告也写各品牌缓存目录。提取器没有运行厂商安装器，也不会因刷新型号图片而启动官方 APP。

## 候选适配器的进程生命周期

适配规范见 [ADAPTER-SPEC.md](ADAPTER-SPEC.md)。生成的文件先保存为草稿，不自动启动。运行接口由 `core/adapter-runner.cjs` 和 `core/adapter-worker.cjs` 实现：

1. `start()` 停止上一份试用，创建 `utilityProcess`，发送 `init`。子进程加载入口，调用 `createAdapter({packageRoot,device})`，再调用 `probe()`。主进程规范化返回能力后交给统一控件。
2. `execute()` 只分派已报告的命令，写入参数先按对应能力范围检查。同一适配器的执行请求按队列运行，使用请求 ID 匹配回复。
3. 单次初始化或执行等待上限为 15 秒。超时后结束该请求并调用现有停止流程，不会自动重新启动候选。
4. `stop()` 拒绝仍等待中的请求，再向子进程发 `close`。子进程调用适配器自身的 `close()` 后退出；若未及时退出，主进程在 1.5 秒后终止它。适配器自己的 `close()` 负责释放设备句柄、轮询和它创建的子进程。
5. 子进程退出会结束剩余等待请求并清除当前运行记录。`adapter-runs.jsonl` 记录探测、错误、标准错误输出、停止请求和退出码。

这里的独立进程用于隔开界面与适配执行，并非权限受限的操作系统服务。目前没有安装后台服务、登录自启动或崩溃自动重启机制。

## 退出与文件位置

关闭主窗口会关闭嵌入设备页；所有窗口关闭后应用退出。`before-quit` 停止候选适配器和资源任务，并调用鼠标、键盘及原有设备服务的清理入口。页面 provider 在离页时关闭自己打开的接口。正常关闭有清理路径，不能把强制结束整个应用进程描述成已保证完成所有硬件清理。

| 内容 | 默认位置 |
| --- | --- |
| 设置、浏览器会话、注册表、模块快照、设备数据 | `%APPDATA%/One4All-Desktop` |
| 原厂依赖下载及解包目录 | `%LOCALAPPDATA%/One4All-Desktop/downloads`、`installers` |
| 品牌型号、图片与运行资源 | `%LOCALAPPDATA%/One4All-Desktop/vendor-resources/{brand}` |
| AI 适配草稿 | `%APPDATA%/One4All-Desktop/adapter-drafts` |
| 适配器试用日志 | `%APPDATA%/One4All-Desktop/adapter-runs.jsonl` |
| 主窗口与原有模块日志 | `%APPDATA%/One4All-Desktop/desktop.log`、`host.log` |

`ONE4ALL_DESKTOP_STATE` 可覆盖应用状态目录。开发启动脚本和安装后的 `One4All.exe` 使用同一套应用入口；安装包之外的大型品牌驱动仍由用户按需要下载。安装器是否生成、其大小及摘要以 `dist/artifact-manifest.json` 为准；构建过程本身不执行安装或卸载。
