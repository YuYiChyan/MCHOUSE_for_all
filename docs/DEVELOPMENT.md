# 接入路线与开发约定

## 选择路线

有成熟网页驱动时先评估保留原厂页面：用统一左栏控制官方菜单，把原厂键盘/设备区域放入右侧同源 iframe。TANK68 的 `vendor-bridge.js` 和 `vendor-theme-init.js` 演示菜单映射及原厂亮暗主题初始化。仅调整布局和重复导航，不把复杂原厂组件拆成失去状态联系的 HTML 碎片。

网页不允许嵌入、依赖登录或跨源访问时，应使用官方允许的集成方式或隔离的 WebContentsView。不要把放宽所有来源、关闭隔离或扩大全部 HID 权限当作适配方案。网页使用 WebUSB、Web Serial 或 Web Bluetooth 时需要另行处理相应权限、选择设备和 Chromium 兼容性；现有 WebHID 权限处理不能直接替代它们。

有开源 USB/HID 或 BLE 控制器时，把控制器作为底层依赖，页面使用统一控件。Razer 示范复用 openrazer-win，CUKTECH 示范复用开源 BLE server；前端都通过 preload → 主进程 → 控制器获取状态或执行操作。两者不是复用原厂 UI，也不意味着所有私有协议都已有可用实现。

## UI 与协议分层

1. 在 `library/examples/widgets.html` 验证同款布局、亮暗主题、菜单和配置项。
2. 复用 `One4AllUI.row/card/segmented/navButton/shell`；设计值见 `ui/tokens.json`，不要在设备页面另写一套颜色。
3. 定义控制器适配层，返回 UI 需要的字段和数据时间戳；禁止返回 token、BLE key、整份云端设备对象或扫码会话。
4. 仅提供明确的方法，如 `status`、`setPollRate`、`setDpiStage`、`reconnect`。主进程验证参数与发送者，preload 不暴露原始 `ipcRenderer`。
5. 写入后回读，断线时显示缺失值，退出时关闭 HID/BLE 句柄及子进程。一个设备的页面不应拿到其他设备的硬件权限。

`library/bridge/adapter.cjs` 是可选的新后端接口；它提供串行执行和命令白名单，不会替开发者实现硬件协议。`contracts/adapter.d.ts` 描述推荐状态形状，`contracts/ipc.json` 记录已登记设备的真实前端接口。二者分别是新适配器约定与既有示范 API 对照，不能混同为已自动互通的注册机制。

## 新增卡片的注册位置

当前宿主显式登记原三个示范与两款交接设备；贡献新设备时需一并完成下列注册，然后同步共用库：

| 文件 | 需要改动的部分 |
| --- | --- |
| `devices.json` | 设备 id、项目目录、路线和发布文件名前缀 |
| `library/host/host.cjs` | 设备标题、颜色/商品图、打开路径、隔离 session、专用 preload、主进程 IPC 和退出清理 |
| `library/host/native-cards.js` | 卡片名称、图标、颜色、状态字段、轮询与图片列表；保留原厂列表/主题同步 |
| `library/host/cards.js` | 主页允许的设备 id、商品图和状态消息转发 |
| `library/host/main-preload.cjs`、设备专用 preload | 新增白名单接口，检查对应页面的调用范围 |
| `library/contracts/ipc.json`、`library/ui/device-client.js` | 记录新增方法，并提供受限的前端客户端 |
| 设备目录的 `manifest.json` | 源文件、哈希、第三方资源地址、依赖压缩包和部署目标 |
| `library/runtime-map.json` | 若新增公共文件，写清哪些包需要它以及复制位置 |

使用全新稳定 id，不能覆盖现有 `keyboard`、`razer`、`charger`、`g309`、`blackshark`。开发库目前没有自动加载任意描述文件的插件发现机制；注册位置明确可审查，也便于限制设备权限。新网页驱动不能继续复用 TANK68 的 VID/PID 常量或特定 DOM 选择器。

## 测试建议

覆盖主页平铺/列表、皮肤切换、亮暗主题、窄窗口、隐藏窗口恢复、返回主页、断线/重连。网页驱动确认原厂设置页切换和目标设备权限；私有协议确认每个写入操作的回读；BLE 区分通知频率、轮询频率和过期数据，不把前端定时器频率当作实际采样频率。

先在临时 MCHOSE 目录验证安装与卸载，再记录真实型号、固件、系统及控制器版本。测试数据必须说明是模拟还是实机。贡献时附上依赖版本、来源、许可证与可复现验证步骤。

## 参考

- [Electron 进程与 preload](https://www.electronjs.org/docs/latest/tutorial/process-model)
- [Electron WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view)
- [WebHID API](https://developer.mozilla.org/en-US/docs/Web/API/WebHID_API)
- [openrazer-win](https://github.com/Ar4ikov/openrazer-win)
- [CUKTECH BLE Server](https://github.com/kairui1108/cuktech-ble-server)
