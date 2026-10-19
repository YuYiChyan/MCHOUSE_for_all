# Razer Viper Mini SE

电量、充电状态、DPI 档位、125–8000 Hz 回报率；附 openrazer-win 源码及独立 Python。

## 使用

Windows 10/11 x64，已安装使用解包 resources/app 的 MCHOSE HUB。从根 README 或发布页下载本设备的独立 ZIP 并完整解压，无需下载其他项目，双击本目录的 **Install.cmd**；需要时 Windows 会要求管理员权限。安装器自动定位默认安装位置，安装本卡片并注册登录时启动的修复任务。支持和另外两个卡片任意顺序安装。

- **Repair.cmd**：恢复被官方更新覆盖的入口。
- **Uninstall.cmd**：停用本卡片；最后一个卡片卸载时恢复厂商入口，保留配对、鼠标状态和备份。
- 自定义路径：

```powershell
.\Install.ps1 -Target 'D:\Apps\MCHOSE HUB'
```

安装会关闭目标目录内的 MCHOSE 进程；若原来有主窗口，安装后会重新启动。修复任务每 15 秒检查一次，仅在应用关闭且入口连续两次稳定时恢复注入；厂商 UI/协议发生重大变动时可能仍需更新本项目。ASAR-only 版本会停止安装并说明原因。

代码、依赖、配对和备份位于 `%LOCALAPPDATA%\One4All`，不放入厂商更新目录。三个卡片共用宿主和运行环境，但可以独立安装和停用。官方程序只新增一个加载入口和原入口元数据，并修改 package.json 的 main。加载扩展失败时仍会启动原厂主程序。

已打包独立 Python 3.13.16 x64，无需本机 Python 或 pip。鼠标 HID 使用 Windows 系统 API；充电器包另带全部 Python BLE/网络/加密依赖及许可证元数据。

图标从当前已安装的 MCHOSE 程序提取，MiSans 字体首次安装从厂商 CDN 获取并校验；公开包不含 MCHOSE 主程序、字体或图标字库。商品图为用户提供的展示图，不属于代码许可证授予范围，商标与图像权利属于原权利人。

openrazer-win 源码固定在 6a626b2d11069ec8be6a7eda6e0dd8ee3ece0998，按 GPL-2.0-or-later 保留源代码与许可证。

具体第三方来源见根目录 THIRD_PARTY.md；验证记录见根目录 VALIDATION.md。

共用控件和接口在 [One4All Kit](../library) 维护；本独立包已包含所需库文件，不需要另装开发库。
