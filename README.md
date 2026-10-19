# MCHOUSE_for_all

将 TANK68 HE、Razer Viper Mini SE 和 CUKTECH 10 Ultra 接入 MCHOSE HUB 的三个独立卡片项目。沿用主页原生卡片，支持平铺/列表和亮暗主题，在主窗口打开设置。

| 项目 | 功能 | 一键入口 |
| --- | --- | --- |
| [TANK68 HE](tank68) | 七项左侧菜单、右侧原厂网页控件 | tank68/Install.cmd |
| [Razer Viper Mini SE](razer-mini-se) | 电量、DPI 档位、回报率 | razer-mini-se/Install.cmd |
| [CUKTECH 10 Ultra](cuktech-10-ultra) | 米家绑定、四端口数据、功率曲线 | cuktech-10-ultra/Install.cmd |

下载 [仓库 ZIP](https://github.com/YuYiChyan/MCHOUSE_for_all/archive/refs/heads/main.zip)，解压后双击需要的项目 Install.cmd。鼠标和充电器包含运行环境与依赖，无需安装 Python。键盘首次安装自动获取原厂网页；各卡片首次安装会准备本机图标及字体。

每个项目有 Install、Repair、Uninstall 三个入口。更新恢复任务在应用关闭后修复被覆盖的加载入口；绑定、依赖和项目文件存放在官方更新目录之外。无需修改硬件固件。

**状态：0.1.0，非官方扩展。** 目前适配资源解包存放的 Windows x64 MCHOSE HUB，厂商更改 DOM、页面地址或打包结构后可能需要调整。验证范围见 [VALIDATION.md](VALIDATION.md)。本仓库不包含账号凭据、原厂主程序或原厂驱动压缩 JS/CSS。

项目原创代码默认 MIT；鼠标项目及其 openrazer-win 依赖按该子目录 GPL-2.0-or-later 许可。第三方包、商标、商品图及厂商资源遵循各自权利和许可证，详见 [THIRD_PARTY.md](THIRD_PARTY.md)。
