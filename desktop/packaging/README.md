# Windows 安装包构建

运行 `node packaging/build-windows.cjs prepare` 生成 `dist/win-unpacked`。确认本次页面与启动代码就绪后，运行 `node packaging/build-windows.cjs build` 重新收集代码并生成最终安装包；`compile` 仅重新编译已有 staging。脚本不会运行安装程序或卸载程序。

构建只需要 Node、Windows 自带 PowerShell/curl、已有 `vendor/electron` 和明确的公共依赖输入。NSIS 3.13 便携 ZIP 从 [官方 SourceForge 发布目录](https://sourceforge.net/projects/nsis/files/NSIS%203/3.13/) 下载到本机构建缓存，校验固定摘要后调用，不全局安装构建器。可通过 `--makensis` 指定现有编译器。

默认依赖输入为本机独立模块快照，命令可使用 `--payload <目录>`、`--resources <vendor-resources目录>`、`--electron <运行时目录>` 指定其他构建输入。无论输入根目录包含什么，公共依赖只复制 `python`、`openrazer-win`、`g309-deps` 三个目录，包含相应源码和许可；不复制旧注册表、用户设备数据或凭据。新电脑运行时不需要这些开发机路径。

发布结构：

```text
One4All.exe
resources/
  app/                 当前应用、控制器和提取脚本
  base-payload/        Python、OpenRazer、HIDAPI 公共库
  vendor-resources/    每品牌 catalog.json、引用的图片/资源
    melgeek/runtime/   轻量 WASM 与设备定义
  seed-manifest.json
  THIRD-PARTY-NOTICES.md
```

种子目录中的图片路径相对于各自品牌目录。跨品牌共用图片会复制为品牌内资源，启动时由 `core/desktop-bootstrap.cjs` 重定位。没有打入厂商完整安装器、拆包源文件、用户 registry 或 data；品牌驱动继续从应用内按需下载。

安装范围是当前用户，默认 `%LOCALAPPDATA%/Programs/One4All`，创建开始菜单及可选桌面快捷方式，并登记 Windows 已安装应用。覆盖安装保留应用外的个人配置。卸载默认保留数据，可选择仅清理 `%APPDATA%/One4All-Desktop` 和 `%LOCALAPPDATA%/One4All-Desktop`；不操作旧 One4All 或厂商目录。安装和卸载均支持 `/S`，静默卸载保留个人数据。

输出包括 `One4All-Setup-<version>.exe`、对应 `.sha256`、`artifact-manifest.json` 和可直接启动的 `win-unpacked`。当前构建没有代码签名或自动更新发布步骤；生成产物不等于已在本机执行安装或卸载。
