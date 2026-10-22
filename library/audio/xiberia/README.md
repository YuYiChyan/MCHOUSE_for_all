# XIBERIA X HUB 独立设备包

本目录维护 XIBERIA X HUB 0.3.0.6 明确列出的十款耳机。每款产品有自己的商品图、卡片、安装包和卸载入口。安装一款仅注册该款卡片；卡片不会随 USB 插拔自动增删。

| 产品 | 包目录 | 原厂配色图 |
| --- | --- | ---: |
| T10 有线 | `xiberia-t10` | 4 |
| T10G | `xiberia-t10g` | 4 |
| T10 无线 | `xiberia-t10-wireless` | 3 |
| K03S 超竞版 | `xiberia-k03s` | 5 |
| K03 有线二代 | `xiberia-k03-wired` | 4 |
| K06S | `xiberia-k06s` | 2 |
| CROCIRIS T7 | `xiberia-t7` | 7 |
| CROCIRIS T7 GT | `xiberia-t7-gt` | 2 |
| S21 无线智充版 | `xiberia-s21` | 1 |
| W30 | `xiberia-w30` | 2 |

原厂目录共有 34 张配色图。T10G 与 T10 有线在原厂资源中共用相应图片。旧版 S21 MAX 和 K03S 7.1 使用另外的驱动，不在 X HUB 这批包中；仅在 INF 驱动表中出现的 USB 标识也未作为产品收录。

完整解压单款 ZIP 后运行该目录的 `Install.cmd`。每包已离线携带 Python、音频依赖、原厂商品图、原版 X HUB 0.3.0.6 安装器和本项目的控制桥接程序。安装入口核对原厂安装器哈希和签名后安装原厂组件并注册卡片；Windows 可能要求重启。`Uninstall.cmd` 取消该款卡片，保留其他卡片。官方 X HUB 的卸载由其自己的卸载程序负责。

页面包含声音输出、均衡器、空间音效、麦克风和设备信息五个分页；“打开官方 APP”位于设备信息。设备未连接时，音量、静音与音效操作依状态禁用。正常设备控制使用 Windows Core Audio 和原厂 SDK，由独立本地进程执行，页面只通过受限接口调用。

当前全部型号标记为**待验证**。T10 首页卡片、分页和官方 APP 按钮已在本机确认可见可点，但未连接 T10 耳机；其他型号还未逐款视觉验收。真实设备的端点匹配、音量、麦克风、EQ、音效、返回和卸载，请通过 [型号验证 Issue](https://github.com/YuYiChyan/MCHOUSE_for_all/issues/new?template=device-validation.yml) 逐项反馈。收到可复现的实机结果后再更新各型号的验证状态。

官方安装器、商品图及 SDK 的权利属于原权利人。来源与哈希在 `official-source.json`、`DEPENDENCIES.json` 和各型号 `manifest.json` 中；项目原创代码沿用仓库许可。
