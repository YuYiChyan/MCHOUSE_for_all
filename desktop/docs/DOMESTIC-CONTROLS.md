# 国产品牌统一控件 · 0.5.0-preview.3

这批卡片使用自己的设置页，沿用商品图、圆点切色、黑白主题。接口由明确的原厂协议或独立设备模块提供。未连接设备时仍可查看商品图和设备信息，连接后按实际读回开放对应控件。全部新增型号保留“待验证”。

| 品牌 | 有图产品卡 | 已接入范围 |
| --- | ---: | --- |
| ATK | 98 | COMPX 分支：DPI、档位、回报率、电量、固件；按实际传感器处理分轴与数值范围 |
| VXE | 17 | 同上；同款不同硬件版本共用卡片，连接后按 CID/MID 选协议 |
| VGN | 4 | 旧 F1 Pro、Pro Max、Moba、F1 S；沿用该分支特定握手与 DPI 范围 |
| 达尔优 | 7 | A980、CM610 PRO、A980 PRO MAX、A980 PRO、CM610 V2、A950 AIR、CM620：DPI、档位、回报率、电量及固件读取 |
| 雷柏 | 76 | 官方 VT_nrf54L 分支：DPI、档位、回报率；245 个官方配色资源 |
| 狼蛛 | 12 | V9/Pro/ProPlus/Plus/Ultra/UltraPlus/Max/MaxPlus，X9/Pro/Max/Ultra：DPI、档位、回报率、亮度，无线电量 |
| MelGeek | 14 | 官方 Hive 设备模块；灯效、亮度、速度、全键无冲、休眠，以及逐键触发点、RT、死区，按设备返回能力呈现 |

合计 228 张新增图卡。ATK/VXE/VGN 的底层 164 条硬件记录合并成 128 张产品卡，其中 119 张有图，未把底层记录数量当成不同产品数。共享接收器需要读回实际设备身份；未覆盖的芯片分支不会套用同品牌协议。

支持库总计 503 条有图的普通产品/USB记录，其中仍含原有雷蛇按有线/无线拆分的 USB 记录；不能将该总数等同于 503 个已实测型号。

## 暂缺商品图

这九款保留明确协议记录，未展示图卡，未套用别款商品图：

- ATK X1 EXTREME 2.0、X1 EXTREME GT、F1 EXTREME 2.0、F1 LEVIATAN 2.0、X EXTREME、Flow 7。
- VXE X3、X3 Pro、X3 Turbo。

## 资源与运行方式

每家目录位于 `%LOCALAPPDATA%/One4All-Desktop/vendor-resources/<brand>`。应用内“更新型号与商品图”从官方资源按需获取；ATK/VXE/VGN 共用一次提取任务。原厂 JSON、图片与 MelGeek WASM 放在本地资源库，设置页不加载官方整页。

WebHID 适配器使用桌面自带 Chromium 的设备接口；需原生库的雷蛇、罗技继续由主进程调用本地后端。长时间运行的适配模块由独立工作进程承载，见 [桌面架构](DESKTOP-ARCHITECTURE.md)。

设备信息中的“打开官方设置”和“提交验证反馈”保留。用户验证后可用个人 Token 提交 GitHub Issue，或打开预填网页登录提交；详见 [反馈流程](DEVICE-VALIDATION.md)。

## 实现依据

- [ATK / VXE / VGN](../research/ATK-CONTROLS.md)
- [达尔优](../research/DAREU-CONTROLS.md)
- [雷柏](../research/RAPOO-CONTROLS.md)
- [狼蛛协议对照](../research/AULA-PROTOCOL-REVIEW.md)
- [MelGeek Hive 控制模块](../research/MELGEEK-CONTROLS.md)

协议夹具与页面检查只证明代码和控件链路可运行，不替代对应硬件实测。

本机 Electron 检查记录在 `research/domestic-ui-smoke.json`：七品牌均进入统一设置页，原卡保留，商品配色传入内页，离线不显示硬件设置，逐键选择读回与连接取消可运行；MelGeek 原厂 WASM 也在实际 Chromium 中加载、退出。没有修改真实硬件设置或创建测试 Issue。
