# 通用 HID 外设控件

版本：0.3.0-preview.4，更新时间：2026-10-22。作为通用控件公开发布，提供独立安装/修复/卸载脚本，在 M HUB 注入“通用 HID 外设”入口，与已有设备卡片共存。下载见 [通用控件入口](../generic-hid/README.md)。

## 设计与已实现范围

Windows HIDClass 已经为标准 HID 键盘提供系统驱动。这个控件复用系统驱动，提供设备识别、复合接口集合与报告长度诊断，以及前台标准按键状态检测。诊断不安装过滤驱动、不常驻读取输入、不发送 Output / Feature 报告；内置 VIA 支持按键测试与主动连接，仅在用户选择连接后进行自己的协议交互。

通用入口同时识别键盘和鼠标集合。标准用途 `0001/0006` 为键盘，`0001/0002` 为鼠标；与已确认型号交叉校验，不能唯一识别时显示复合设备，并允许手动指定类型保存在本机，不按产品名字符串猜测。

左侧统一“按键测试”，二级菜单按所选设备显示键盘或鼠标检测；复合类型可切换两种测试。键盘图提供按住高亮、松开保留标记、清空、全尺寸/TKL/主键区参考配列。鼠标图提供五键与滚轮方向，只处理检测区域，不监听鼠标移动或采样回报率。

用户点击开始键盘测试后，Electron 将当前窗口按键转发到检测图，Esc 参与测试；另启动一个仅拦截左右 Windows 键的临时系统钩子，避免打开开始菜单。钩子不输出其他键值、不保存日志，只在指定 M HUB 进程处于前台时生效。点击停止、切换应用、关闭页面或进程、最多 15 分钟后撤销。它不负责改键，不随开机启动。Ctrl+Alt+Del 等系统安全组合键和未上报的 Fn 不保证可检测；普通窗口事件也不能区分多块物理键鼠。

键位数据来自 `shawon9324/keyboard-mouse-tester-webApp`，MIT 许可，固定上游版本、原始键位文件和许可证在 `library/vendor/input-tester/`。改键方案调查与接入设计见 [通用改键路线](KEY-REMAPPING-OPTIONS.md)。

“改键”保留为左侧独立入口。内置 VIA GPL-3.0 离线版及 2061 组 VID/PID 定义索引，依赖、解码器、许可证与对应源码一并打包。官方型号表仅作参考：所有已选择的设备都显示“连接 VIA”或“尝试 VIA 连接”，同时提供“导入 VIA 定义”入口，支持厂商提供的未收录型号 JSON。连接后由 VIA 实际核验 Raw HID 接口和固件协议；导入布局本身不会让不支持 VIA 的固件获得改键能力。同型号多设备由用户选择，不默认绑定第一台。VIA 在右侧内嵌显示，只允许本机资源请求与选定型号的 HID 权限。自定义定义保存在本机 VIA 页面存储；本机服务优先沿用上次端口，端口被占用时换用新端口，此时需要重新导入定义。实际硬件连接结果单独验收，不把型号表匹配或导入成功当作硬件兼容证明。

HID 描述不能自动证明按键使用机械轴、磁轴或薄膜。鼠标、触控板和虚拟设备也可能包含标准键盘集合，因此通用诊断会如实列出这些集合，而不会将它们标成已确认的机械键盘型号。

标准 HID 规定报告与描述结构，不能据此推导所有品牌的 RGB、灯效、亮度、速度、改键或回报率协议。此类能力应由经过验证的型号配置和协议适配器逐步添加；协议未知时保留真实的诊断结果，不显示虚构设置。

## 可复用文件

| 文件 | 用途 |
| --- | --- |
| `library/hid/windows_keyboard.py` | Windows SetupAPI / HID 描述查询，仅使用系统库与 Python 标准库 |
| `library/hid/keyboard_model.py` | 按物理容器分组，清除实例路径、容器 GUID 和序列号等标识 |
| `library/hid/keyboard-service.cjs` | 主进程只读桥接，并发刷新合并，同一时刻只启动一次扫描 |
| `library/hid/appearance-store.cjs` | 本机名称、透明商品图和设备标识盐的持久化；不发送 HID 命令 |
| `library/ui/hid-keyboard.js`、`.css` | 共用页面、设备选择、接口表、前台按键测试；重复挂载不重复注册 |
| `library/examples/hid-keyboard.html` | 可打开的布局示例；没有本机 API 时明确显示未接入 |
| `library/examples/hid-keyboard-electron.cjs`、`hid-keyboard-preload.cjs` | 隔离的开发宿主与受限 IPC 示例 |

页面复用既有 One4AllUI、亮暗主题、60px 顶栏、320 / 240 / 180px 侧栏、40px 菜单和右侧设置框。按键测试只显示 `KeyboardEvent.code`，不保存输入文本，不导出按键记录。普通页面事件无法证明是哪一块物理键盘产生输入，界面会明确说明；后续若要区分多块键盘，应单独接入 Windows Raw Input 并绑定设备身份。

## 接口

```js
const {createKeyboardService}=require('./library/hid/keyboard-service.cjs');
const keyboard=createKeyboardService({
  python: '/path/to/bundled/python.exe',
  profileDirectory: '/path/to/app-user-data/one4all-hid-keyboard'
});
const state=await keyboard.status();
await keyboard.saveAppearance({deviceId: state.devices[0].id, name: '我的键盘', imageDataUrl: ''});
await keyboard.close();
```

设备读取接口只有 `status()`；另外的 `saveAppearance()` 只写本机外观设置。扫描由用户主动触发，不设置后台轮询定时器；并发扫描共享一个 Promise。配置 `profileDirectory` 后，设备 ID 使用仅保存在本机的随机盐计算，重开后保持一致，不暴露原始 HID 路径或容器 GUID。未配置存储目录时退回会话盐，命名与图片保存不可用。只能按真实容器 ID 合并集合；缺失容器时分开显示，不能凭相同 VID/PID 合并两台同型号设备。

```js
One4AllHidKeyboard.mount(container, {api: {
  status: () => keyboardBridge.status(),
  saveAppearance: value => keyboardBridge.saveAppearance(value)
}});
```

宿主刷新或页面关闭时释放组件和服务。开发宿主使用单实例锁；正式集成时在 MCHOSE 主进程只创建一个服务，页面刷新继续使用同一服务。卡片注册、来源校验、preload 与打包清单需要在具体设备适配时登记。

## 内置命名与商品图

左侧预览下方内置“命名”和“上传商品图”按钮，右侧“外观与命名”页提供名称输入、保存、选图与移除。名称最多 60 字，空名称恢复设备提供的产品名。名称会同步到左侧标题与设备选择列表。每个实际设备分别保存，不按 VID/PID 共用。

上传接受 PNG、JPEG、WebP，源文件最大 10 MB；页面解码为静态 PNG、保留透明背景、最长边缩至 1200 像素，主进程再次限制格式、尺寸与约 2 MB 大小。上传或保存失败时继续展示上次成功结果。图片通过受限 IPC 传入，不向页面开放任意本机路径；不会访问网络。外观配置保存在宿主用户数据目录的 `one4all-hid-keyboard/keyboard-appearance.json`，已加入忽略规则，不能打入公开安装包或归档的公共源码部分。

无序列号的设备若更换 USB 端口、系统重装或清空用户数据，Windows 容器标识可能变化，此时需要重新命名或选图。这是界面外观设置，不会修改键盘固件名称，也不会新增灯效、改键等协议能力。当前共用页面会展示设置；未来注册主页卡片时，还需由卡片宿主读取同一外观数据。

## 对两个新提案的应用

### 前行者 TK870 有线低配版，Issue #4

提案提供 `1A2C:9DFE` 与厂商集合 `FF01/0001`、8 字节 Output / Feature 报告信息。基础层会识别这种描述组合为待核验配置候选，提供连接与接口诊断。VID/PID 与描述相符不等于型号已唯一确认，灯效协议仍未验证。

需修正提案中的一个用途标记：Generic Desktop `0001/0080` 是 **System Control**；标准键盘集合是 `0001/0006`。不能把 System Control 集合当作键盘按键输入。

报告长度包含 Windows 要求的报告 ID 字节。后续 Feature 差分应先确定描述符实际声明的 Report ID，再让设备主人对明确的只读查询手动采样，配合 FN 操作比较。不能自动假定 `0x01..0x08` 都是有效 Report ID，也不能在状态查询时扫描或写入全部报告。没有输入报告不等于完全不能回读；没有可验证协议时不开放灯效写入。

### 西伯利亚 K03S，Issue #3

提案报告标准 USB 音频接口，优先沿 Windows Core Audio 路线复用声卡适配，而不是让键盘 HID 层承担音量控制。`36F9:F016` 的厂商 HID 可以作为后续扩展，当前不需要发送私有报文。

端点名称中的 `2-` 前缀本身不能证明存在多个同时在线的物理设备。应先按实际端点 ID 去重，再用真实 PnP 容器关联物理设备；同一容器仍可能存在多个有不同用途的输出端点，不能任意选一个。APO 模块存在也不代表 7.1 已启用。

## 验证与打包

```text
node --test tests/keyboard-hid.test.mjs
python -B tests/keyboard_hid_test.py
python -I -B library/hid/windows_keyboard.py --status
node tests/visual-keyboard-hid.cjs
```

基于真实 Windows 的扫描只查询描述元数据，不改变设备设置。测试夹具不代表 TK870 / K03S 已完成实机验收。当前不将它们加入正式支持列表，也不关闭两个提案 Issue。

## 规范来源

- [USB-IF HID 规范与 Usage Tables](https://www.usb.org/hid)
- [Microsoft HIDP_CAPS](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/hidpi/ns-hidpi-_hidp_caps)
- [Microsoft 设备容器 ID](https://learn.microsoft.com/en-us/windows-hardware/drivers/install/devpkey-device-containerid)
- [Microsoft Raw Input](https://learn.microsoft.com/en-us/windows/win32/inputdev/about-raw-input)
- [Chromium WebHID](https://developer.chrome.com/docs/capabilities/hid)：标准键盘等受保护集合不能直接交给普通网页任意读写，因此本项目通过受限本机桥接查询元数据。
