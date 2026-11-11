# 达摩鲨原生鼠标控制

本轮接入 31 个 `0x1915` 有线鼠标身份及 4 种共享接收器。31 款均从官方设备配置取得商品图与配色。统一控件直接通过 WebHID 读取/设置 DPI（含 X/Y）、当前 DPI 档位、回报率，并读取电量；不启动官方软件。全部型号的实机状态仍为待验证。

## 官方来源

- [达摩鲨官网](https://www.darmoshark.cn/)直接链接[官方网页驱动](https://www.darmoshark.cc/)。
- 实际拆解包：`https://www.darmoshark.cc/main.47068c4b56a18ed4.js`；SHA-256：`78242bd7cbdde04b07ae8aa83bde5a1a615d116753ccf5a55cbda5974d980250`。
- 官方驱动的国内运行配置直接选择 `https://launcher.keychron.cn/vapi/` 与 `/static/`。只收录产品 API 中 `brand` 明确包含 `www.darmoshark.cc` 且配置 `type=mouse` 的型号。
- [M3pro 产品元数据实例](https://launcher.keychron.cn/vapi/v2/product/420808493)与[同型号配置](https://launcher.keychron.cn/static/device/420808493/json/v3.json)。各型号自己的 API、配置地址保存在目录 `source` 中。

## 协议及型号选择

原厂 `At` / `Ut` 两套 DMS 实现共用 `usagePage=0xFF0A, usage=1, reportId=0`，64 字节输出帧；末字节为 `(0xA1-sum(bytes[0..62])) & 255`，共享接收器路由位为首字节 `0x40`。

发现设备只发送原厂身份查询，不改变设置。共享接收器先读回在线状态和实际鼠标身份：第一代使用原包 `productFirmware` 精确表转换，第二代使用回包 VID/PID。接收器存在而鼠标睡眠、型号不同或未知，均不能作为当前型号连接成功。回报率上限读取接收器自身，不能以鼠标的最高值代替。

设置前读取原始配置，按原厂字段范围保留邻近档位、传感器选项和系统参数；设置后发送原厂保存命令并重新读取，只有读回值一致才返回成功。两代传感器/系统布局不同，分别编解码。没有推定宏、按键映射或固件升级接口。

## 文件与提取

- `scripts/extract-darmoshark-assets.cjs`：导出 `extract({outputRoot,offline,updateRegistry})`，直接 CLI 执行可以刷新；`--offline` 优先使用已缓存下载内容。
- `catalog/darmoshark-protocols.json`：型号、精确 USB 身份、共享接收器、传感器限制与官方来源。
- `core/darmoshark-models.cjs`：`getDarmosharkSupport(model)` / `getDarmosharkModels()`。
- `app/darmoshark-provider.js`：`One4AllDarmoshark.createApi({model,protocol,hid,prepare})`，提供统一 `scan/connect/status/execute/close`。
- 图片缓存与完整目录：`%LOCALAPPDATA%/One4All-Desktop/vendor-resources/darmoshark/`。产品卡保留原厂配色，不生成或替换商品图。

## 验证与未接入项

`node --test test/darmoshark-provider.test.cjs` 的 10 个无硬件夹具通过，覆盖两代读写/保留字段/保存读回、两代共享接收器身份和上限、原厂保存 ACK 无子命令/路由位格式、写入不生效时拒绝成功、超时后迟到 open 清理与借用连接不关闭、只读扫描及目录身份。未对真实鼠标写入，夹具结果不等于实机验证。

另 9 个官方条目使用不同 Feature Report 或 `0xFFC1` 接口，未标为已适配：M3 8K、N7（`0x0BDA` 身份）、M3 V2、M3Small、N3 PRO、N3、M3、M3S、M2EX。它们不能按相似名称塞进本轮 DMS 型号列表；后续需要各自协议接入。
