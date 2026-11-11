# Windows 安装包

`dist/One4All-Setup-0.6.0-preview.3.exe` 是面向 64 位 Windows 的完整用户安装包。默认安装到当前账户的 `LocalAppData/Programs/One4All`，可选择安装位置和桌面快捷方式；开始菜单提供启动和卸载入口，系统“已安装的应用”也会登记卸载器。

安装包包含 Electron/Chromium、应用、产品目录及图片、Python/HID 等公共控制库和轻量 MelGeek 运行模块。迈从、雷蛇、罗技的完整原厂安装器继续在 APP 中按需从官网获取，没有全部塞入主程序包。

全新电脑无需先安装旧版 One4All。首次启动创建自己的数据目录并打开支持库。原有安装的注册表、模块和配对数据继续保留；升级不会把本机已经确认的卡片和设置替换为默认值。

卸载默认只移除软件，保留设置、设备模块和下载缓存。卸载页可额外选择清除本账户的 One4All-Desktop 数据；该选项不删除旧 One4All 目录，也不卸载厂商驱动。安装和卸载都支持 `/S` 静默模式。

构建命令：`node packaging/build-windows.cjs build`。无需全局安装构建工具，构建脚本使用固定版本的官方 NSIS 便携编译器，并生成 `artifact-manifest.json` 与 SHA-256 文件。公开下载入口为 [GitHub 桌面版发布页](https://github.com/YuYiChyan/MCHOUSE_for_all/releases/tag/desktop-v0.6.0-preview.3)。

预留的验证服务地址在“支持库 → 服务器设置”填写，默认为空。保存地址不发请求；用户点击“刷新验证状态”或选择服务器提交反馈后才访问相应接口，见 [验证服务器契约](VERIFICATION-SERVER-API.md)。本地确认和 GitHub 上报独立可用。
