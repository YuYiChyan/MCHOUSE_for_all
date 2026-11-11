# 共用鼠标控制 · 0.5.0-preview.2

支持库中的“统一鼠标设置 · 待验证”卡片直接调用设备协议。主页原有 TANK68HE、Viper Mini SE、CUKTECH 三项继续使用原入口。新增页沿用黑白主题、蓝色选中态和圆点切色；支持库选择的商品颜色会带进设置页。

| 品牌 | 已接入的接口 | 当前有图的统一设置卡片 |
| --- | --- | --- |
| 迈从 | 官方 0x4D WebHID：DPI、DPI 档位、回报率、左右按键消抖、板载配置、电量 | 19 |
| 罗技 | HID++ 2：普通/扩展 DPI、普通/扩展回报率、电量、8040 整体亮度、软件控制模式 | 26 款原厂目录型号 + 原有 G309 |
| 雷蛇 | 原有 openrazer-win 共用控制器：DPI、回报率、档位、休眠、可读灯区亮度、电量 | 113 条 USB 型号记录（含有线/无线分别列出） |

具体功能以该台设备实际返回为准。原厂包下载和型号目录命中均不会直接启用可写控件。写入由用户点击“应用”发起，随后读回设备值；失败后显示实际读数。罗技需要软件模式的设备由用户显式切换，普通扫描不改变模式。

## 迈从型号

官方 `mouseDiffConfig` 的同协议名单有 23 款，静态身份和能力记录在 `catalog/mchose-protocols.json`；当前官方图卡精确匹配 19 款：

- A7 V3、A7 V3 Pro、A7 V3 Pro+、A7 V3 Ultra、A7 V3 Ultra+、A7 V3-X。
- K5 Pro、K5 Ultra、R7 Ultra、K7 V2 Pro+、K7 V2 Ultra+。
- A5 V3 Pro、A5 V3 Ultra、A5 V3 Ultra+、A5 V3 Ultra+(3955)。
- V7、V7 Pro、G3 V3、G3 S。

协议表另外含 K7 V2 Pro、K7 V2 Ultra、A7 V3 Magnetic、K5 V2，当前没有在所取图录中匹配到同名完整图卡，保留协议记录，未套用其他型号图片。旧 M7、旧 A7 等不同协议不列入这次接入。

协议逐字节参考官方 `getCommandBuffer`、`mcReadCommand`、`mcSetCommand`、`allInfoToObj/Arr`、`dpiToObj/Arr`。`core/mchose-source.cjs` 可从缓存官方 JS 重新提取名单。共享接收器必须读回具体型号；不同卡片不能只靠接收器 PID 认领设备。主进程只给当前卡片匹配的 VID/PID/usage 接口授权。

## 罗技型号与范围

G102、G203 LIGHTSYNC、G302、G303、G303 SHROUD EDITION、G305、G309、G402、G403 各变体、G502 各变体、G603、G604、G703 各变体、G900、G903 各变体、MX518、PRO、PRO HERO、PRO WIRELESS、PRO X SUPERLIGHT。完整 27 条精确 ID 见 `catalog/logitech-hidpp.json`。

G600、G602 尚未接入本控制器；RGB 特效 8070/8071、改键、宏尚未接入统一鼠标页。商品灯区和按键布局只是资源，不代表控制功能已实现。协议布局、来源版本及 API 详见 [罗技接口记录](../research/LOGITECH-HIDPP.md)。

## 社区验证

设备信息提供“打开官方 APP”和“提交验证反馈”。报告记录型号、适配器与应用版本、固件及用户实际勾选的功能。个人 GitHub Token 可直接提交，无 Token 使用浏览器登录后提交；详见 [验证反馈说明](DEVICE-VALIDATION.md)。全局待验证状态由维护者根据具体型号的报告更新。

## 本次证据

42 项 Node 检查和 11 项罗技协议夹具通过。真实 Electron 页面走通两品牌图卡到自己的统一内页、配色传递、反馈表单，以及七类控件的替代设备调用；记录在 `research/unified-mouse-smoke.json`。本机罗技只读扫描成功但无设备，新增迈从/罗技型号没有实机写入验证。未通过真实账号创建测试 Issue。
