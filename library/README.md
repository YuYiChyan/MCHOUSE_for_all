# One4All Kit

可单独下载的共用开发库：设计语言、DOM 控件、前端设备调用接口、当前示范宿主、网页驱动桥接源码，以及安装/修复/卸载脚本。原创代码按 MIT 许可；不含迈从主程序、原厂压缩 JS/CSS、字体字库或设备绑定数据。

## 目录

| 路径 | 用途 |
| --- | --- |
| `ui/mchose-ui.css`、`ui/theme.css` | 三个示范复用的布局与亮暗覆盖；由现有实现提取的原创样式 |
| `ui/tokens.json` | 颜色、尺寸、圆角和字体降级规则，记录当前项目采用的设计值，不是官方规范 |
| `ui/components.js` | 页面外壳、导航按钮、配置卡、信息行、分段按钮、主题切换 |
| `ui/device-client.js` | 当前鼠标、充电器、键盘 preload 的显式调用适配，页面不接触原始 IPC |
| `bridge/adapter.cjs`、`contracts/adapter.d.ts` | 新控制器的串行状态/命令/清理接口，带固定命令白名单 |
| `contracts/ipc.json` | 当前三个示范的真实频道和来源限制对照表 |
| `host/` | 当前设备卡片、主题同步、WebContentsView、来源校验及 preload 的共用源码 |
| `web-driver/` | TANK68 原创外壳和原厂网页菜单/主题桥接源码；供其他网页驱动改编 |
| `install/` | 可复用的安装、修复、卸载、后台恢复入口脚本 |
| `runtime-map.json` | 哪些库文件需要复制到各个独立安装包，以及目标路径 |
| `examples/` | 可直接打开的控件页面和开源后端适配示例 |

## 前端复用

无需打包工具即可在普通 HTML 页面加载：

```html
<link rel="stylesheet" href="../ui/mchose-ui.css">
<link rel="stylesheet" href="../ui/theme.css">
<script src="../ui/components.js"></script>
<script src="../ui/device-client.js"></script>
```

```js
const UI = window.One4AllUI;
const page = UI.shell({title: '我的设备', status: '未连接'});
const config = UI.card('设备状态');
config.append(UI.row('实时功率', '—'));
page.content.append(config);
document.body.append(page.root);
UI.setTheme('light');
```

完整示例为 `examples/widgets.html`。控件使用 `textContent` 构造文本，不接受任意 HTML。分段按钮只触发操作；调用方应在真实回读后重绘选中状态。

前端客户端示例：

```js
const mouse = One4AllDeviceClient.razer(window.driveCenterLab);
const confirmed = await mouse.setPollRate(1000);
// 用 confirmed 更新界面，不自行假设设备已成功写入。
```

充电器使用 `One4AllDeviceClient.charger(window.charger)`，键盘使用 `One4AllDeviceClient.keyboard(window.driveCenterPage)`。它们只包装既有白名单方法，不会授予页面新的系统权限。

## 后端复用

```js
const {createAdapter} = require('./bridge/adapter.cjs');
const adapter = createAdapter({
  id: 'my-device',
  status: () => controller.readState(),
  commands: {setRate: value => controller.setRateAndReadBack(value)},
  close: () => controller.close()
});
```

`createAdapter` 串行执行已接受的状态读取和命令，固定操作白名单；`close()` 等待已接受任务并只清理一次。实际超时、参数取值验证、凭据隔离、取消和重连由控制器负责。推荐的状态结构见类型声明；适配器不会自动清洗不合适的后端字段，必须在返回前移除账号凭据。

现有鼠标和充电器页面已使用这里提取的 DOM 控件和前端客户端。新的后端适配器是一份可复用接口，**还需要在宿主中注册卡片、preload 和主进程频道**；它本身不会自动安装或识别设备。当前 `host/host.cjs` 是三个示范的共用宿主源码，打包时放进安装包的 `payload`，不是从开发库目录直接启动的独立应用。

修改共用文件后运行根目录 `scripts/Sync-Library.ps1`，同步到各个独立包并更新哈希。打包和贡献说明见随包附带的 `docs/` 与 `CONTRIBUTING.md`。

字体和图标使用系统字体降级。实际安装时由安装器提取本机迈从图标、按清单获取字体，不在开发库中分发厂商字库。商品图也不属于开发库代码授权范围。
