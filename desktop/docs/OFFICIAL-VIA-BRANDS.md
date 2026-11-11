# 原厂 VIA 键盘接入范围

这批型号直接使用原厂提供的 VIA USB 定义接入统一键盘控件。随包提供 USB 标识、按键矩阵和布局，不需要用户手工下载或导入 JSON。未进行实机验证，全部保留 `unverified` / `hardwareVerified:false`。

## 当前名单

| 品牌 | 精确 USB / 布局定义 | 展示卡片 | 商品图引用 |
| --- | ---: | ---: | ---: |
| Keychron 渴创 | 27 | 12 | 27 |
| MonsGeek 魔极客 | 10 | 9 | 36 |
| Akko 艾酷 | 10 | 10 | 31 |
| RK Royal Kludge | 6 | 3 | 6 |
| Redragon 红龙 | 2 | 2 | 2 |

合计 55 份精确定义、36 张产品卡片。布局和有线/无线成员合并展示，但选择入口与连接路由仍区分成员。

- Keychron：Q0、Q1、Q2、Q3、Q5、Q6、Q8、Q10、Q12、Q13、Q14、Q15 **Max**。仅包含官方 JSON 明确列出的 ANSI / ISO / JIS 成员。商品图取官网对应型号展示图，`imageScope:model-family`，没有推断这些图片的具体配色；布局成员保留独立 USB 路由，展示时可合并为产品家族。
- MonsGeek：M1 QMK 国际版、M2/M3/M5/M6/M7 QMK、M1W V3 VIA、M1 V5 VIA（ANSI/ISO）、M2 V5 VIA。产品页中的 Non-QMK / Domestic 版本已排除，M1 V5 的商品图按 ANSI/ISO 区分，重复轴体 SKU 不生成重复配色。
- Akko：Gem 01/02 VIA、Mineral 01/02 VIA、5075B VIA、YU01、MOD 007 V3 VIA、5087S VIA、ACR TOP 40、5075S VIA。5087S 的已确认 QMK/VIA 外观作为配色归在同一型号，不包括普通 5087S 私有固件。
- RK：R65、R75、R87 Pro 的有线版与无线版 QMK/VIA，共 6 个独立 PID，按型号合并为 3 张卡并保留版本选择。使用原厂档案中的 Windows JSON；无线型号也通过 USB 有线接口设置。
- Redragon：FINKE K715 PRO、ALCOR K717 PRO 的 QMK/VIA 版本。原厂 ZIP 中各有一份明确型号定义；K715 为 `369B:0021`、6×16 矩阵，K717 为 `342D:E470`、5×14 矩阵。各使用专用下载页的对应商品图，没有根据图片推断配色名，也不代表同品牌其他键盘已接入。

具体 VID/PID、矩阵和来源保存在 `catalog/{keychron,monsgeek,akko,rk,redragon}-protocols.json`；当前数据汇总在 `research/official-via-catalog-check.json`。

## 已实现的功能

连接时读取 VIA 版本（命令 `0x01`）、层数（`0x11`）和首个真实矩阵位置（`0x04`）。兼容版本由现有 VIA provider 决定，当前为 9–13。匹配原厂 VID/PID、usage page `0xff60`、usage `0x61` 和 32 字节报告后，才向统一页提供按键映射能力。

按键映射使用原厂矩阵坐标及所选层，通过 `0x05` 写基础键码，再用 `0x04` 回读并比较。连接过程不写设备。当前没有宣称 RGB、宏、编码器、磁轴或私有厂商命令已接入，也不会刷写固件。

`app/official-via-provider.js` 提供 `One4AllOfficialVia.connect({model,signal,prepare,hid?})`，复用 `app/via-provider.js` 的传输实现。返回 `device/capabilities/values/execute/readKey/close`。页面取消会立即结束连接 Promise 并关闭已建立的接口；不等待原生设备选择窗口返回，迟到的选择结果也不会打开设备。

## 官方来源

- Keychron 定义及型号图：[Firmware and JSON files](https://www.keychron.com/pages/firmware-and-json-files-of-the-keychron-qmk-keyboards)。下载文件使用该页直接链接的官方 Shopify CDN。
- MonsGeek 定义：[Download](https://www.monsgeek.com/download/)。[M1 国际版说明](https://www.monsgeek.com/faq/where-to-purchase-the-m1-international-version/)明确区分 Non-QMK 国内版；[M1 V5 VIA 产品页](https://www.monsgeek.com/product/m1-v5-via-rapid-disassembly/)提供版本与配色。
- Akko 定义：[Download](https://en.akkogear.com/download/)；[VIA 兼容型号说明](https://en.akkogear.com/faq/how-to-check-if-your-akko-keyboard-supports-via/)明确与 Akko Cloud 私有驱动型号区分。图片取各条目的原厂产品页及官方商店。
- RK 定义及对应型号图：[Software Center](https://rkgamingstore.com/pages/software)。页面链接的 `VIA_Software_Download_Guide*.zip` 内包含逐型号 Windows JSON，不只是说明书。[RK 原厂说明](https://en.rkgaming.com/news/14/)要求匹配 QMK/VIA 版本、布局和连接型号。
- Redragon：[软件下载中心](https://redragonshop.com/pages/software)、[K715 PRO 专用下载页](https://redragonshop.com/blogs/product-download/finke-k715-pro)、[K717 PRO 专用下载页](https://redragonshop.com/blogs/product-download/alcor-k717-pro-qmk-via)。两页的 Software 链接指向同一原厂 Shopify CDN ZIP（108,055 字节），其中分别保存 `FINKE K715 PRO.json`、`ALCOR K717 PRO.json`；商品图来自各页的 `product-image`，完整原文件和网页保存在品牌缓存。
- 协议：[QMK via.h](https://github.com/qmk/qmk_firmware/blob/master/quantum/via.h)、[QMK via.c](https://github.com/qmk/qmk_firmware/blob/master/quantum/via.c)。

## 资源刷新与验证

五个 `scripts/extract-{brand}-assets.cjs` 均导出 `extract({outputRoot?,offline?,updateRegistry=false})`，返回 `{devices,stats,source,generatedAt}`。缺省写 `%LOCALAPPDATA%/One4All-Desktop/vendor-resources/{brand}`；原始网页和定义保存在品牌 `source`，图片在 `assets`。仅显式 `updateRegistry:true` / CLI `--update-registry` 会更新工程注册表，运行时不会写应用安装目录。共用辅助文件为 `scripts/official-via-assets.cjs`，无需额外 npm 包或原厂安装程序。

`node --test test/official-via-provider.test.cjs`：8 项通过，注册表检查已包含新增红龙两款。覆盖厂商带空格的 KLE 坐标、prepare 顺序、真实命令字段及写后回读、错误 PID、取消选择、取消连接、排除 Non-QMK 和区分 ANSI/ISO 图片。55 份注册定义与 102 个图片引用：0 缺图，0 重复 USB 身份的矩阵冲突。使用模拟 HID 夹具，没有写真实硬件。

## 本轮仍未纳入

- Keychron Q60 Max / Q65 Max：官方定义存在，但本轮抓到的下载页没有与它们对应的型号商品图，未生成卡片；其他 Keychron 系列未通过这次提取器，不代表全品牌已支持。
- NuPhy：[原厂 JSON 页](https://nuphy.com/pages/json-files-for-nuphy-keyboards)列出 Air60/75/96 V2、Gem80、Halo65/75/96 V2、Nos75、Kick75 QMK；本次直接读取返回 HTTP 429，网页读取返回 403，未取得可随包核对的原厂 JSON，因此没有注册为已接入。原厂支持中心还区分同名 IO 与 QMK/VIA 版本，不能直接按系列名套用。
- Lofree、Kzzi、黑爵键盘、贱驴等候选本轮没有完成逐型号公开定义和商品图的关联，保留为后续研究项；不据此宣称不支持或已支持。
