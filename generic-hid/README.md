# 通用 HID 键鼠控件

版本：**0.3.0-preview.4** · 更新：**2026-10-22**

让没有专用适配的键盘和鼠标也能在 M HUB 中查看标准 HID 信息、检测按键状态，并尝试已有的开放控制入口。

- 标准按键状态检测：键盘按下高亮、松开留痕；鼠标五键与滚轮方向检测。
- HID 设备、用途集合、输入/输出/Feature 报告长度显示，自动识别键盘与鼠标。
- 统一“按键测试”入口，按设备显示二级菜单；显式测试模式支持 Esc 与 Windows 键。
- 内置 VIA 离线页面，支持 VIA 按键测试、连接及厂商定义 JSON 导入；未被官方收录的型号也可以尝试连接。
- 内置命名、类型指定和透明商品图上传，本机保存，跟随 M HUB 亮暗主题。

## 安装

[下载独立安装包](https://github.com/YuYiChyan/MCHOUSE_for_all/releases/download/v0.3.0-preview.4/One4All-Generic-HID-0.3.0-preview.4.zip)，完整解压后运行 `Install.cmd`。包内带 Python、VIA 运行依赖、许可证和 VIA 对应源码，不需要下载整个仓库。

也可单独下载本目录的 `Install.cmd`、`Install.ps1` 到同一目录，再运行 `Install.cmd`；它会下载并校验固定版本的完整包，然后启动安装。安装后在 M HUB 点击“通用 HID 外设”。修复和卸载使用完整包内的 `Repair.cmd`、`Uninstall.cmd`。

VIA 是否可连接取决于设备是否暴露相应接口、固件是否实现 VIA 协议。厂商 JSON 用于描述布局和功能，不能把普通 HID 固件变成 VIA 固件；型号表匹配也不代表已完成硬件验收。本机没有可确认兼容 VIA 的设备，本次发布保留这一验收限制。

普通按键检测基于当前窗口的系统输入，不能独立区分多块同时输入的物理键鼠；未上报的 Fn 和系统安全组合键可能无法检测。通用接口诊断不提供未知型号的私有灯效或改键命令。

## 源码与开发

- [通用控件实现与接口说明](../docs/GENERIC-HID-KEYBOARD.md)
- [公共 HID 模块](../library/hid)、[前端控件](../library/ui/hid-keyboard.js)、[M HUB 宿主接入](../library/host/host.cjs)
- [独立包构建脚本](../scripts/Build-Generic-HID.ps1)、[VIA 离线构建](../scripts/Build-Via.cjs)、[源码打包](../scripts/Package-Via.py)
- [VIA 对应源码与依赖](https://github.com/YuYiChyan/MCHOUSE_for_all/releases/download/v0.3.0-preview.4/via-corresponding-source.zip)

原创包装与通用控件按 MIT 提供；VIA 按 GPL-3.0，按键参考数据保留上游 MIT 许可。运行包、上游版本与许可记录在 `library/vendor/`。欢迎提交新的设备适配包。
