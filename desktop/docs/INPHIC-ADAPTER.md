# 英菲克 USB 控制接入

原厂下载页：https://www.inphic.cn/download 。网页驱动：https://hubbeta.inphic.cn/ 。原厂脚本版本和摘要保存在 `catalog/inphic-protocols.json`。

接入 ZHEN（2276/2279 两种 USB PID 合并一张商品卡）、IN10 升级版（2278）、IN9 PRO V2 升级版（2277）。VID 均为 1D57，通信集合为 usagePage 000B / usage 0000。三款有原厂商品图，全部标为待验证。

统一控件支持有线模式的 DPI、启用档位选择、125–1000 Hz 回报率和亮度。ZHEN 保留设备当前的 X/Y 独立设置；IN10 系列使用联动 DPI。每次修改前先读当前板载槽和参数，只修改对应字节，保存后回读。USB 回报率修改保留无线通道值。

数据依据：原厂 `getConfig` / `readReportTransaction` 的 A0 读取请求、协议 3 的 `eN/eA/eL` 和协议 4 的 `eZ/eY`。写入帧采用对应字段及校验和，协议与商品元数据随代码保存，联网刷新只更新官方资源。未运行原厂 APP，也不需要原厂后台进程。

本轮不包含 FA60/FA65 共用接收器。原厂需要另一套无线握手与回包解释，不能仅凭共享 PID 判断鼠标型号。旧 IN10 Pro、IN9 Ultra、X11 SE、XICHEN M003/M030 也未笼统归入三款的协议；它们使用不同的帧布局或身份确认流程。

验证：协议夹具覆盖有线帧、稀疏 DPI 档位、独立 Y、未知参数、共享接收器排除、写入后不一致和断开；没有把夹具结果标成实机验证。
