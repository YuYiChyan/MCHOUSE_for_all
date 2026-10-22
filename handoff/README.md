# G309 与 BlackShark 的实现和维护

当前版本 **0.2.0**，已纳入主分支。对方验证基础功能可用，项目主人完成 App 视觉验收并授权发布、关闭两项开发 Issue；详细范围见 [验收记录](../docs/ACCEPTANCE-0.2.0.md)。

每款设备有独立 ZIP、离线运行时和依赖、透明贴图、视觉规格、接口与 Install / Repair / Uninstall 脚本。G309 使用 HID++ 与 Windows HIDAPI；有线 BlackShark 使用指定 USB 声卡的 Core Audio 端点，不依赖雷云。十段 EQ 已接 Equalizer APO 配置接口，官方引擎安装器、对应版本源码与许可已打包；按需使用 Install-EQ.cmd，基础卡片无需启用它。

原 [G309 清单](../logitech-g309/HANDOFF.md) 和 [BlackShark 清单](../blackshark-v2/HANDOFF.md) 保留调研与排错路线；未单测能力继续按实际反馈记录。不要根据“开发完成”推定全部固件、蓝牙或声场功能已测。

公共文件只修改 library 内 canonical 源码，然后执行 Sync-Library 更新各独立包和文件哈希。独立包只包含其 manifest 列出的文件；本机绑定、配置、日志、测试资料和账号凭据必须忽略。

常用验证：Node 合约测试、Python 后端夹具、Verify-Packages、Installers 和 optional-eq 隔离配置测试。design 中的布局报告与渲染图属于离线设计参考；产品视觉验收在实际 MCHOSE HUB 内进行。
