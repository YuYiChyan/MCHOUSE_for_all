# 国产品牌补充调查：兰族、忍者、红龙、雷神

调查日期：2026-11-12。范围为官方下载入口、公开网页驱动、精确型号及 USB 定义与现有协议的对应关系。本轮只下载网页和脚本，没有安装官方程序、连接设备或发送硬件命令。以下“有官方定义”不等于“已经适配”或“硬件验证通过”。

## 结论

| 品牌 | 查到的官方资料 | 现有 provider 能否只加型号复用 | 本轮处理 |
| --- | --- | --- | --- |
| LAMZU 兰族 | Aurora 网页驱动、26 条鼠标配置记录、商品图路径、独立键盘网页入口 | 鼠标传输与现有 Darmoshark / ATK / INPHIC 不同；键盘尚未确认标准 VIA 命令及对应布局 | 记录精确来源与缺口，不加入可控制型号 |
| Ninjutso 忍者 | NinjaForce 网页驱动，Sora V2 及另一 VID 家族的过滤器和控制实现 | 不同长度、不同 Report ID 的 Feature Report 协议，不能仅因 VID 相同复用 Darmoshark | 保留脚本和协议线索，不冒认支持 |
| Redragon 红龙 | K715 PRO / K717 PRO QMK VIA 商品入口、原厂 JSON 和商品图 | 已核对原厂定义，复用现有 VIA 控件 | 本轮已接入两款的 USB 有线配置，硬件功能待验证 |
| 雷神 | 可直接访问的 ML8 网页驱动，精确 ML8 / 接收器 USB、配置和原厂图片 | Report 11 / 63 字节协议，与当前 ATK COMPX 等 provider 不同 | 记录完整源和接口线索，不写猜测协议 |

## LAMZU 兰族

- 官方下载页：[Software Download](https://lamzu.com/pages/download)，页面导航直接链接[鼠标网页驱动](https://www.lamzu.net/)和[键盘网页驱动](https://www.lamzu.net/kb/)。
- 鼠标配置：[Config/env-models.json](https://lamzu.net/Config/env-models.json)。此次返回首条应用配置 `LAMZU Aurora / 1.0.38`，后接 26 条型号/硬件变种记录。记录含 `ModelEN`、有线和无线 VID/PID、`UIFolder`、`IsNewProtocol`、DPI 和回报率范围；数量不代表 26 个已发布且可直接支持的独立产品。
- 示例：Maya X 为 `373E:001C / 001D / 001E`；TACHI 为 `37B0:0005 / 000B / 000C`；INCA 为 `37B0:0009 / 000F / 0010`。字段中存在空 PID、重复接收器 PID 和芯片变种，不能统一拿接收器 ID 当作具体鼠标身份。
- 控制主脚本：[index-DxSz_fAU.js](https://lamzu.net/static/js/index-DxSz_fAU.js)，使用 `sendFeatureReport(0, ...)` / `receiveFeatureReport(0)`，常见缓冲区 64 字节，并依赖 `IsNewProtocol`、`hidIndex` 和请求/回包偏移。DPI 档位读取包含命令字节 `2,10,1,129`。这与当前 Darmoshark 的 Output Report 0 + DMS 校验结构、ATK 的 Output Report 8 + COMPX 地址结构、INPHIC 的 Feature 160 读取入口不一致。
- 图片和配置映射脚本：[index-DE4vNd8L.js](https://lamzu.net/static/js/index-DE4vNd8L.js)，包含 `Config/<UIFolder>/Device*.png` 及 Atlantis 配色目录。下一步应按配置记录与图片映射建立完整表，再单独实现请求/回包、接收器身份和读回处理。
- 键盘页含独立 Next.js 程序及布局 JSON 模块，出现 `19F5:FEF0 / FF21` 等过滤器，也包含类似 VIA 的 usage 信息。仅有这些字段不足以确认标准 VIA；必须继续区分不同连接类、实际使用的命令和对应产品布局。官网另列 Atlantis PRO Keyboard 与 JET75 Keyboard 下载项，不能将鼠标 Aurora 支持表套到键盘。

## Ninjutso 忍者

- 官方[下载页](https://ninjutso.com/pages/download)的站点导航直接链接 [NinjaForce](https://www.ninjaforce.co/)，同时保留 Sora / Sora 4K 的独立 Windows 下载。
- `/_nuxt/CaGpxWb-.js` 中的 `soraV2` 过滤表包含 VID `1915`：鼠标 PID `AE11` 至 `AE16`，接收器 `AE1C / AE8C / AE8A`；还包括 VID `093A` 的另一组 PID。该合并过滤表不是每个 PID 对应成品型号、颜色、硬件代际的完整清单。
- Sora V2 路线在 `/_nuxt/BiYPX5p0.js`、`/_nuxt/YfBuKAA-.js` 使用 Feature Report 5 的 31 字节请求，完整配置读取使用 Feature Report 4，按设备分支分配 73 或 703 字节缓冲区，并处理校验、配置编号、接收器型号和固件最低版本。另一家族另有 Feature Report 6 的 15 字节请求。
- VID `1915` 也出现在 Darmoshark 设备，不代表报文可复用。当前 DMS provider 使用 Output Report 0 的 64 字节命令与自己的识别流程，不能直接发送 NinjaForce 的报文，也不能反向套用。
- 后续缺口：精确 PID → 销售型号/变种/图片映射、两套协议的状态字段和版本判断、接收器实际所连鼠标的识别。保留“待实现”，不产生虚假的“待验证已适配”卡片。

## Redragon 红龙

- [官方软件中心](https://redragonshop.com/pages/software)明确提供 K715 PRO、K717 PRO QMK VIA 产品条目和正常商品图。
- [K717 PRO 官方下载页](https://redragonshop.com/blogs/product-download/alcor-k717-pro-qmk-via)链接 [Redragon QMK VIA Software ZIP](https://cdn.shopify.com/s/files/1/0012/4957/4961/files/Redragon_QMK_VIA_Software_ed804286-6f1f-42d7-8144-f9437be88e9a.zip?v=1733305340)，本次 HEAD 返回 200 / 108055 字节；另有 [QMK 用户指南](https://s3.us-east-1.amazonaws.com/s3.downloadcenter/QMK%20User%20Guide.zip)。
- 官网图片路径分别为 `cdn/shop/files/RedragonK715PROQMKVIACustomGamingKeyboard_3.png` 与 `cdn/shop/files/RedragonK717PROQMKVIACustomGamingKeyboard_6.png`。
- 并行集成已将两款原厂 JSON 和图片接入 `catalog/redragon-protocols.json`，provider 为 `official-via`，范围为 USB 有线配置，保留 `unverified`。不能据此把所有红龙键盘、所有无线连接或红龙鼠标归入 VIA。

## 雷神

- 官网首页的空鼠标链接不代表没有网页驱动。实际入口为 [ML8 驱动中心](https://www.thunderobot.com/ML8/)。
- 主脚本：[index-DZ33G89u.js](https://www.thunderobot.com/ML8/assets/index-DZ33G89u.js)；设备和协议模块：[upgrader-ZhftLj3P.js](https://www.thunderobot.com/ML8/assets/upgrader-ZhftLj3P.js)。后者虽名为 upgrader，同时包含普通设备配置与日常控制命令。
- 官方表明确列出 `THUNDEROBOT ML8`：`363C:FF50`，`THUNDEROBOT ML8 Dongle`：`363C:FF51`；二者 usagePage `FFA0`、usage `2`，内部 ID 为 `THUNDEROBOT_ML8_2K_V1`，配置对象 `fe`、`getVersion() = 256`。表中 PAW3395 范围为 50–26000 DPI、步进 50，并分别列出有线/无线回报率，不能从营销名推断 8K。
- 普通传输为 `sendReport(11, ...)`，填充至 63 字节；例如信息请求 `[19,0,0]`，配置请求 `[21,0,0]`，通过 input report 分派回包。当前 ATK provider 使用 `sendReport(8, 16字节请求)`，Darmoshark 为 `sendReport(0, 64字节请求)`，INPHIC 使用 Feature Report，均不能仅增加 VID/PID 后复用。
- 原厂表与 VXE R1 ULTRA / G2 等条目共存，说明这份网页程序有共享配置实现；不代表当前 One4All ATK provider 已经实现这一路协议，也不代表表内所有产品均已完成商业发布或硬件验证。
- 正常商品图：[ML8.BLACK-Cf0khhV4.png](https://www.thunderobot.com/ML8/assets/ML8.BLACK-Cf0khhV4.png)；小图 `ML8.BLACK.smallsize-6_bosBM4.png`。
- 官网[下载中心](https://www.thunderobot.com/service/download)也有旧的“ML702 达摩鲨鼠标应用软件”条目。名称关联只能作为后续查包线索，不能证明 ML702 使用当前 DMS 网页协议。

## 可复核的本地材料

原始页面和脚本保存在 `research/domestic-extra/`，未运行网页中的设备连接函数。发布说明使用上述公开来源，开发机绝对路径不进入文档。

| 材料 | SHA-256 |
| --- | --- |
| LAMZU 主脚本 `index-DxSz_fAU.js` | `8edcbeb6aaec43d9a81174410fe5a2ce723a17fa6c99fceab669c8dc97b47457` |
| LAMZU `env-models.json` | `5ce9bd2f8d296c532ece2317fb3fdd3437a985ba919d912556a243674ff1f92d` |
| NinjaForce `CaGpxWb-.js` | `e2a9b261f808d4a27ac8735838d1d6518ff76cf072090fcb5d30141909007963` |
| NinjaForce `BiYPX5p0.js` | `cd9cf8fdfb6f96e62d9bef64e6bce179364fa4e0f9b37f23a74f4b2f7e296da3` |
| 雷神 `upgrader-ZhftLj3P.js` | `f0e84e56295d740d1c8db44db1213194042df36b3b0c17f2d150bd0896053a6f` |

以上仅证明本轮取得的源文件及静态分析结果。硬件功能验证仍须由具体型号、固件和连接方式的实际使用反馈确认。
