# 独立安装包与注入方式

## 每个设备一个包

用户从 README 对应设备的下载链接取得 ZIP；不需要下载整个仓库或另外安装开发库。设备包必须包含自己的 Install / Repair / Uninstall、manifest、页面、控制器、共用运行代码和依赖。开发库是维护与复用入口，发布时把需要的库文件复制进各包，保证独立使用。

共用源码在 `library` 编辑，`runtime-map.json` 指定它们部署到各设备包中的位置：

```powershell
.\scripts\Sync-Library.ps1 -Version 0.1.1
.\tests\Verify-Packages.ps1
.\scripts\Build-Releases.ps1 -Version 0.1.1
```

输出目录默认为 `dist/v0.1.1`：三个独立设备 ZIP、一个开发库 ZIP 和 SHA256SUMS.txt。可用 `-OutputDirectory` 指定位置。构建脚本只打包 manifest 列出的 payload/依赖及明确的安装文档，不把本机数据目录一起归档。

新增设备时将目录登记到 `devices.json`。`manifest.json` 的 `files` 列出包内源文件及 SHA-256，`bundles` 指定离线依赖解压位置，`assets` 指定安装时获取的厂商资源及哈希。先登记文件，再运行同步/哈希更新；不要把带真实绑定数据的目录做成 payload。

根目录 `.gitignore` 排除认证与绑定文件、个人环境、日志、数据库、profile、缓存、临时测试目录和 `dist` 构建输出。离线 `vendor/*.zip` 和 openrazer 的公开 `devices/data/*.json` 是运行依赖，必须保留；不能用 `**/data/` 或 `*.zip` 一概忽略。构建器另按 manifest 文件清单归档，并拒绝常见私密配置与缓存路径。提交前仍应检查 Git 已跟踪的文件，新增 ignore 规则不会自动移除已跟踪内容。

当前鼠标使用系统 HID API，包内保留 openrazer-win 源码与许可证；充电器附带 Python BLE、加密、HTTP 等依赖和 wheel 元数据。两者都有独立 Python 运行环境，正常用户不需要 pip。依赖重建脚本为 `scripts/rebuild-deps.ps1`，有版本锁定与哈希更新；换 Python 版本时必须同时匹配本机原生 wheel 架构和 ABI。

## 如何注入当前运行目录

1. 自动定位默认安装目录，或接受 `-Target`。验证解包 `resources/app/package.json` 的应用名称与原始主入口。
2. 关闭目标安装目录内的应用进程。将卡片代码、依赖、注册信息和数据放入 `%USERPROFILE%/One4All`。
3. 在应用目录写入小型 `one4all-loader.cjs`，保存原始入口元数据，并把 `package.json.main` 改为该加载器。备份按原文件哈希存放在外部状态目录。
4. 加载器先注册扩展宿主，再加载厂商原主入口。扩展加载失败时继续尝试原主程序；不把第三方协议塞进原厂压缩代码。
5. 宿主为主页增加卡片，用独立 WebContentsView 打开详情页，通过受限 preload/IPC 或原厂网页的硬件 API 访问设备。
6. 自动恢复任务在登录后运行，每 15 秒检查，仅在应用关闭且入口连续两次稳定时恢复被官方更新覆盖的加载入口。ASAR-only 结构会停止安装，需要另行适配。
7. 卸载按卡片停用；最后一个卸载恢复最新厂商入口，保留用户配对和备份，方便重新安装。

默认 Program Files 目录和登录任务可能需要管理员权限，入口脚本会在需要时申请 Windows 授权。修复任务只保证重新接入加载入口，不能自动修复未来原厂页面 DOM、原生 ABI 或通信协议的变化。

## 从打包应用或自动化工具运行时的目录隔离

某些桌面应用环境对 LocalAppData 使用隔离视图。部署时应确认安装进程与 Windows 登录任务都能访问运行目录，不能只凭当前进程中安装成功就认定登录恢复也成功。

这类环境可以指定双方均可访问的个人目录，例如：

```powershell
.\Install.ps1 -StateRoot "$env:USERPROFILE\One4All"
```

迁移已有部署时要保留配对与鼠标状态，重新生成 `payload/lab-config.json` 的 Python 路径，重写原厂加载器与计划任务中的运行目录，并从系统任务实际启动验证。任务应使用系统 PowerShell 完整路径和明确的工作目录。若旧路径启动失败已被后端缓存，路径修正后还需重启客户端。

## 发布约定

每个新设备至少提供：完整项目目录、可单独运行的安装/修复/卸载脚本、全部运行依赖、合法来源/许可证、目标型号与固件验证记录、下载文件名和 SHA-256。不要提交米家令牌、BLE key、真实 MAC、账户资料、日志、profile 或个人配置。

发布新版本时同步 README 的设备直达下载链接，上传各设备 ZIP 和开发库 ZIP；旧版本附件保持可用。不要以仅含安装脚本、还需要用户从整库拷贝文件的 ZIP 冒充独立安装包。
