# Razer BlackShark V2 USB 声卡

版本：**0.2.0**。有线 BlackShark V2：3.5mm 耳机接原配 USB 声卡，目标 `1532:0529`，无需雷云。设备基础功能经对方验证，项目主人已完成 App 视觉验收；见 [验收记录](../docs/ACCEPTANCE-0.2.0.md)。

先读 [HANDOFF.md](HANDOFF.md) 和 [design/SPEC.md](design/SPEC.md)。黑／绿／白三色透明贴图已接入首页与设置页，配色可以切换并记住。打开 `payload/blackshark.html` 可看离线界面：声音输出、麦克风、可选 EQ、声场与扩展、设备信息。

解压本设备 ZIP，运行 `Install.cmd`。也可明确指定：

```powershell
.\Install.ps1 -Target 'C:\Program Files\MCHOSE HUB' -StateRoot (Join-Path $env:USERPROFILE 'One4All')
```

包内含独立安装／修复／卸载、CPython 3.13.16、pycaw 20260927、comtypes 1.4.17、psutil 7.2.2 的离线依赖，以及 pycaw 固定源码快照。核心功能是目标声卡输出／输入音量、静音和回读；不调整其他系统默认设备。USB 声卡存在不等于能检测 3.5mm 耳机是否实际插入。

THX 有独立软件／APO 模块，但尚无已验证的该型号声场控制接口。项目不分发 THX DLL，不把检测到安装项视为声场已经启用。

十段 EQ 已接 Equalizer APO 配置接口。**默认仅导出，不安装或启用音频引擎**。若接收方选择使用，参见 [OPTIONAL-EQ.md](OPTIONAL-EQ.md)，运行包内 Install-EQ.cmd；已附官方 x64 安装器、对应源码和许可；基础卡片不要求它。卸载卡片会撤销本项目登记的 EQ include，保留既有其他音效配置和数据。
