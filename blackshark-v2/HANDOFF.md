> 2026-10-22 更新：本项目已完成开发并发布 0.2.0，详见 [验收记录](../docs/ACCEPTANCE-0.2.0.md)。以下保留原始交接研究与逐项排错计划，未测条目不自动勾选；历史状态不是当前发布状态。

# BlackShark V2 实现与接收清单

接收方：**肥鱼（DSH）**。设备主人没有安装雷云，优先稳定的独立接口。目标限定有线 BlackShark V2 原配 USB 声卡 `1532:0529`，不混用 V2 Pro／HyperSpeed 的协议。

## 调研与结论

- [OpenRazer #1254](https://github.com/openrazer/openrazer/issues/1254)记录了这块声卡和侧音支持请求。当前检索没有找到可直接用于该型号、已验证的完整原生控制器。
- [Synapse-for-Linux](https://github.com/bbesli/Synapse-for-Linux/tree/89fac49edb0a9086f941e5d5107453e1b7e3f127)有硬件 EQ 与侧音，但列出的对象是 `0565/056e/0566` HyperSpeed；不能据此向 `0529` 发相同写命令。HeadsetControl 和 openrazer-win 也未提供本次可验证的 `0529` 方案。
- [pycaw](https://github.com/AndreMiras/pycaw/tree/2890e07ab205adbe31346c5ee05b24743f1ba83c)的 Windows Core Audio 接口可用于端点音量和静音。本包固定 pycaw 20260927 wheel，完整依赖和哈希见 DEPENDENCIES.json。
- [Razer THX 集成说明](https://mysupport.razer.com/app/answers/detail/a_id/4657/)区分耳机版 Synapse 集成、PC 驻留 APO、独立虚拟音频驱动应用；它们不能直接互换。[THX 官方](https://www.thx.com/thx-spatial-audio-for-pros/)也确认可在 USB 驱动中集成 APO。
- [Razer 开发门户](https://developer.razer.com/audio/thx/)和 Wwise 插件面向游戏渲染。当前检索没有建立「该游戏接口可以控制系统已安装声卡的 THX 设置」这一链路，不作为可调用的设备 API。
- [Equalizer APO](https://sourceforge.net/projects/equalizerapo/)可作为独立开源 EQ；接口已经贯穿到十段页面和配置生成／可选保存，是否安装由接收方决定。

以上是本次检索边界，不是宣称所有未来或未公开接口都不存在。没有把有线版假装成无线版，也没有在用户机器安装 THX、雷云或 EQ 引擎。

## 已实现的接口链路

原厂卡片克隆 → `blackshark` 显式登记 → 独立 WebContentsView／隔离 preload → 按页面校验的 IPC → 串行服务 → 离线 Python + pycaw → **匹配声卡的** Core Audio 端点。

端点身份通过 Configuration Manager 的 AudioEndpoint 父链匹配 USB VID/PID，不靠名称包含 “Razer”，也不回退到系统默认扬声器／麦克风。只接受活动端点；同方向多个候选时禁用，避免任意选择。这个父链策略仍需在接收方的 Windows 驱动栈验证；若存在驱动包装层，应增加可靠的容器／拓扑关联，不能删掉设备身份边界。

| 方法 | 参数 | 行为 |
| --- | --- | --- |
| `status()` | 无 | 端点存在性、音量、静音、能力、时间戳、歧义状态、可选 EQ 状态 |
| `setOutputVolume(value)` | 0–100 有限数 | 只调整目标输出端点，读回误差 ≤1 个百分点 |
| `setInputVolume(value)` | 同上 | 只调整目标输入端点；不是专有硬件 mic boost |
| `setOutputMute(value)`／`setInputMute(value)` | 布尔 | 目标端点设置静音后严格回读 |
| `setEq({enabled,gains})` | 布尔＋10 段 ±12dB | 无 provider 时仅生成；显式启用后保存独立 EAPO 片段，回读文件 |
| `back()` | 无 | 返回首页 |

`spatial.installedComponents` 只读取 THX 卸载登记名称；`nativeControl=false`、`enabled=null`，不把安装登记或音量状态解释为声场运行状态。

EQ 后端依据当前匹配输出端点生成 GUID 条件及 post-mix 条件，不生成 `Device: all`，不碰麦克风。`audibleVerified=null` 始终表示本地程序没有音频测量证据。默认 export-only，安装选择和撤销见 OPTIONAL-EQ.md。

## 肥鱼的调试顺序

1. 校验发布哈希，保存原音量／静音状态。先只读测试，USB 声卡和另一块普通声卡同时连接，确认没有选到系统默认的其他设备。
2. 验证 `CM_Locate_DevNodeW` 与父链能把活动 render／capture 端点对应到 `USB/VID_1532&PID_0529`。若没匹配到，输出脱敏的关联层级、错误码及驱动版本；禁止直接移除 VID/PID 校验来“修好”。
3. 用低音量验证输出、输入音量与静音，读回并试听／录音；记录旋钮和物理静音键是否能反映到 Core Audio。硬件键若不反馈，界面仍只声称系统端点状态。
4. 拔掉声卡、禁用输入端点、插入两块同型声卡、热插拔、睡眠唤醒逐项测试。声卡在而耳机没插时，状态只能是声卡已连接，不能声称检测到耳机佩戴或插入。
5. 无雷云环境完成基础卡验收。THX 研究是扩展项，找到真实可调用接口、模块安装条件、授权和回读证据之后才能开放控制；不加载来历不明的 DLL，不把游戏渲染 SDK 接到错误用途。
6. 与主人决定是否选择 Equalizer APO。若选择，按 OPTIONAL-EQ.md 安装到单个目标输出端点，测试导出、保存、旁路、撤销、重启恢复和频响变化；若不选，记录“未采用”，保留 export-only。
7. 保持前端设计，修复功能和接口差异后提交代码、脱敏诊断和验收回执。

## 基础接收清单

- [ ] 确认是有线原配 USB 声卡 1532:0529；不匹配无线版本。
- [ ] 无雷云环境能够读取并控制正确的输出／输入端点。
- [ ] 其他声卡、默认设备、输出路由不被修改。
- [ ] 音量、静音严格回读，非法值和断开写入被拒绝。
- [ ] 多同型端点不会任意选择；缺失输入时输出仍可用。
- [ ] 热插拔、睡眠、禁用端点、旋钮／物理静音差异已记录。
- [ ] 五项菜单、亮暗主题、列表／网格、窗口缩放、返回与 Esc 正常。
- [ ] 共存安装、重装、更新后修复、卸载和原三卡回归完成。
- [ ] THX 状态未被误标；发现原生 EQ／声场新接口时附来源、版本和调用证据。
- [ ] 回执包含系统／迈从／声卡驱动版本、结果、限制和修复提交。

## 可选 EQ 接收清单

- [ ] 主人明确选择「不用／只导出／安装 Equalizer APO」，记录抉择。
- [ ] 若安装，引擎来源和版本已验证，只挂目标输出端点。
- [ ] 十段映射、±12dB 校验、预衰减、保存回读与 bypass 正确。
- [ ] 实测有频响变化；其他声卡和输入不受影响；不凭文件写入宣称生效。
- [ ] 现有 config.txt 和其他滤波／include 保留；重复启用不重复添加。
- [ ] Disable 或卡片卸载能撤销项目 include；EQ 引擎本身不被擅自卸载。

## 注入交接

脚本已写好：Install／Repair／Uninstall、scripts/Manage.ps1、Optional-EQ.ps1。扩展存放于 `%USERPROFILE%/One4All`，恢复任务使用绝对 PowerShell 路径与工作目录，规避应用容器 LocalAppData 路径视图差异。共用加载器先启动本卡宿主，再执行原厂入口；异常时保留原应用启动路径。无需重写原厂网页。

本分支已经修改 devices.json、四个共用 host／preload 文件、runtime-map 和公共客户端。修改 canonical 文件后执行 Sync-Library；当前包的版本固定为 0.2.0-handoff.2。未经过实机验收，不合并成稳定版，不关闭 Issue。

## handoff.2 贴图交接

已按用户提供原图接入透明 PNG，元数据在 ARTWORK.json。首页点击配色按钮循环，设置页点击独立色块；选择持久化并通过独立 setColor IPC 同步回首页，不向硬件发送任何配色命令。不要将这两色／三色重新降级成单色示意图。接口与素材已随独立包打包。
