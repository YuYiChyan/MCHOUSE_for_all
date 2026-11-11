# 国产鼠标补充调查与未接入项

本轮新增达摩鲨 31 款（57 个原厂图/配色条目）与 Attack Shark 两款 USB 直连（两张原厂图）。全部保留“实机待验证”。下面项目没有满足“完整型号 ↔ 精确身份 ↔ 已实现协议”的证据链，未标 `interfaceImplemented`，也未添加会冒认连接的卡片。

## 多彩 DELUX

已读取[多彩官网下载页](https://www.deluxworld.com/service.html)，直接指向[ControlHub 多彩驱动](https://www.controlhub.top/delux/)。已下载实际前端 `app.js`、`cfg.json`、`sensor.json`、英文界面和商品图。配置版本 2.0.1，VID `3554`，有线 PID `FB25`、无线 `FB26/FB23`；CID 93 的 MID 1–6 明确分 PAW3395 / PAW3950。

前端以 `img/devices/mouse/<CID十六进制><MID十六进制>.png` 显示产品，已成功取回 [5d01 原厂图](https://www.controlhub.top/delux/img/devices/mouse/5d01.png)。图中没有完整型号文字；配置和前端也没有 MID 到 M900/M700/M600 及 Pro+/Ultra 的明确名称表。不能仅看外观把六个身份命名。

继续追到官网的桌面包：`uploads/admin/file/20241104/DELUX Gaming Mouse Driver.rar`、`20250324/M900Ultra M900pro+ 驱动.zip`、`20250715/DELUX Gaming Driver_v1.0.1.2_2025.06.zip`。本次下载分别在 45/180 秒内未完整返回；尚未取得可拆包文件。下一步优先读取这些原包的设备配置，以确认名称与 MID，再复用已拆出的 COMPX 指令；传感器超频 DPI 编码不能直接套 ATK 的阈值。

## 黑爵 AJAZZ

[黑爵官网网页驱动列表](https://www.a-jazz.com/h-col-156.html)明确把 **T520 PRO** 链接至 [ControlHub AJAZZ](https://controlhub.top/AJAZZ/)。其他 AJ159/AJ179/AJ139 等型号分别指向 QMK、YJX、R-Z、SparkChip 等驱动，不能按品牌一并套用。

已取回实际 `assets/index-C8ONmvSx.js`、`cfg.json`、`ref.json`、英文界面与 [1411 原厂图](https://controlhub.top/AJAZZ/img/devices/mouse/1411.png)。配置 1.18、VID `3554`、CID 20、MID 17/18/19；传感器和 USB 版本不同。`ref.json` 是键盘布局坐标，未提供鼠标名字映射。商品图只有 AJAZZ 标记，不能证明三个身份都属于同一 T520 PRO 型号。需要原厂安装包/型号配置中的对应表后再接入。

官网另有[自研 HUB 入口](https://www.a-jazz.com/h-col-157.html)，链接 `https://www.ajazz-hub.com/`。本轮未完成该独立产品线协议。

## Attack Shark 的其余产品线

[官网驱动页](https://attackshark.cn/system.aspx?ClassID=18)分别列出 QMK、ControlHub、Inputdrv、SZSLXD 几套方案。本轮只将官网明确关联 Inputdrv 的 X11PRO V2 / X11SE 等高线 USB 直连接入；详见 [协议说明](ATTACKSHARK-CONTROLS.md)。

ControlHub 已拆 `assets/index-CxS_PH0T.js` 与 `cfg.json`，CID 124，配置中 20 个 MID 身份，涉及 3950/3955 及不同 USB PID。官网给出 X8Ultra、V5、RS6Ultra、R11Ultra、X8ULTIMATE、V8 等产品清单，但清单顺序不构成 MID 对应证据。不能把其中同外壳型号按外观或顺序分配。Inputdrv 包还嵌入其他 22 条命名配置，本轮未把包中残留/跨入口配置直接视为官方支持声明。

## Incott 鹰珂

调查入口为 `https://incott.net/mouse/index.html` 与 `https://www.szironcat.com/`。本次浏览器抓取分别返回 502 / 超时，本机 HTTPS/HTTP 下载也未取得页面；目前没有可核对的原厂 JS、USB 型号表或协议包。未根据第三方说明书的 G23 V2/G23 V2 Pro 名字创建假适配。后续需先取回原厂入口或安装包，确认是否为同一产品线；不能从与其他品牌形似推导共用协议。

## Zaopin

检索到[原站 Z1PRO 驱动页](https://www.zaopinworld.com/article_76505.html)，页面标明 2023-07-24、深圳市金乐码电子科技有限公司。浏览器能读取旧文章，本机请求和首页请求未取回有效内容；文章的可读结果没有完整驱动包链接。另有 `zaopintechnology.com` 公司站，但本次未取得其设备驱动资源。尚没有新旧 Z1/Z2 型号的精确 USB/接收器协议证据，未混入其他品牌协议。

## Mad Catz 与 MADLIONS 分开处理

已读取 [Mad Catz 官方下载页](https://www.madcatz.com/En/Support/Downloads/)和它自己的两个 GET 接口：`/En/Support/GetDownloadsProducts?language=En&productCategoryId=1`、`/En/Support/GetProductDownloadsResult?language=En&productId=3`。实际返回 R.A.T. 产品列表及 `/FileUploads/SupportFile/RAT_8+ADV_x64.1.0.70.exe`、x86 包和 PDF；这是逐型号的桌面驱动，没有取得与上述国产 WebHID 方案共用的证据，本轮未拆其二进制控制库。

[MADLIONS 官方支持页](https://f.gg/pages/product-manuals)和 [FGG HUB](https://hub.fgg.com.cn/)属于另一套公开品牌/型号入口。没有把它们与 `madcatz.com` 的 R.A.T.、B.A.T. 等目录合并。

## 留存位置

原厂下载页面、JS、配置、已取回图片、Mad Catz GET 返回内容保留在 `%LOCALAPPDATA%/One4All-Desktop/vendor-resources/{brand}/source/`。发布源码只含提取器、协议目录、provider、夹具及文档；临时调查文件和不完整下载不作为依赖发布。
