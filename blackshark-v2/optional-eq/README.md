# 可选 EQ：由肥鱼与设备主人决定

当前未找到有线声卡 1532:0529 已验证的原生 EQ 接口。提供了独立的 Equalizer APO 配置桥接，而非模拟雷云原生功能。十段参数已经从页面贯穿到后端生成器；接收方可以决定只使用基础音量、仅导出预设，或安装开源 EQ 引擎后启用保存。

## 启用路径

1. 使用 [Equalizer APO 官方 1.4.2 文件目录](https://sourceforge.net/projects/equalizerapo/files/1.4.2/)中的 x64 安装器，检查来源。下载器本次返回 403，交接包未混入第三方镜像的安装器。另提供固定官方源码快照、GPL 许可证与哈希；源码包不是预编译引擎。
2. 由设备主人决定安装，在 Device Selector 中仅选择 BlackShark 的 USB **输出**端点，按工具要求完成音频服务重启或系统重启。本卡片不偷偷安装 APO，也不设置其他默认播放设备。
3. 在管理员 PowerShell 中，以该用户的 StateRoot 运行本包 `Optional-EQ.ps1 -Action Enable -ConfigDirectory 'C:\Program Files\EqualizerAPO\config' -StateRoot (Join-Path $env:USERPROFILE 'One4All')`。不同安装路径必须据实传入。若提权使用另一管理员账号，StateRoot 必须明确指向原用户目录。
4. 脚本备份原 config.txt，仅追加有标记的 Include；创建 `One4All-BlackShark-V2` 子目录，仅赋予当前操作者对该目录的修改权限。不会扩大整个 Equalizer APO 目录权限。
5. 回到卡片，读取状态，勾选「在生成的配置中启用 EQ」并保存。参数被限制在 ±12dB，自动按最大正增益加预衰减；后端以匹配 USB 设备的输出端点 GUID 约束 `If` 条件，只在 post-mix 阶段处理，不影响话筒。

未运行启用脚本时，「生成 APO 配置」只返回文本，不改音频系统。运行后「保存 EQ 配置」写入本项目独有的片段，进行文件回读；**这不是 APO 已加载或音频效果有效的证明**。

## 调试与撤销

低音量下试听明显但温和的切换；再用受控信号或合适的回环测量验证目标端点的频响变化。确认系统其他声卡和麦克风不受影响。检查独占／RAW 音频、其他 APO、THX 若另装时的叠加行为；不能只看 UI 判断生效。

取消 EQ 勾选后保存会生成无滤波的 bypass 片段。彻底撤销运行同一脚本 `-Action Disable`，传相同 ConfigDirectory 和 StateRoot；它只移除本项目的 include 标记和 provider 登记。卡片卸载也会调用撤销；原 config.txt、其他 Include 和滤波应保留，备份仍在。Equalizer APO 本身是否卸载由主人决定。

配置接口详见 [官方配置文档](https://sourceforge.net/p/equalizerapo/wiki/Configuration%20reference/)。FxSound 也有开源实现和命令行接口，但需要另一路音频路由和应用进程，本次未接第二套引擎，避免混淆选择。
