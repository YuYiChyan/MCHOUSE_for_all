# 给肥鱼（DSH）的两设备交接入口

此分支为 `handoff/g309-blackshark-v2`，预发布 `v0.2.0-handoff.1`。两个设备分别有独立 ZIP、README、HANDOFF、视觉规格、参考渲染图、布局报告、离线依赖、注入和卸载脚本。请按设备回复对应 Issue；基础功能和可选 EQ 的验收分开记录。

## 接手顺序

1. 阅读设备 HANDOFF 和 design/SPEC，先跑现有测试，不重新设计视觉。
2. 校验 SHA256SUMS。若从仓库接手，使用发布标签或该 Issue 指明的固定提交。
3. 在朋友机器只读探测硬件，再使用独立 Install 安装；可明确传 Target／StateRoot。安装会关闭迈从并备份原入口。
4. 按单设备清单先读后写，恢复原设置。实机结果优先，离线夹具不作为硬件验收。
5. 修改库内公共文件后运行 Sync-Library，更新清单和哈希。不要只修生成 payload，避免下次同步覆盖。
6. 以修复提交和回执回应 Issue；尚未完成的项目继续保留未验收。

## 无视觉能力的核对方式

在完整仓库运行：

```text
node --test tests/library.test.mjs tests/handoff.test.mjs
python -B tests/handoff_backend_test.py
powershell -NoProfile -File tests/Verify-Packages.ps1
powershell -NoProfile -File tests/Installers.ps1
powershell -NoProfile -File tests/optional-eq.ps1
node tests/visual-handoff.cjs
```

视觉测试需要 Node、Playwright 和本机 Edge；其余按各测试依赖执行。离线依赖锁位于设备目录，Windows 64 位运行时和设备库已随包携带。不要用截图测试替代真机音频、鼠标设置或系统更新验收。

`design/layout-report.json` 是结构化几何／颜色／菜单检查，`design/previews` 为实际代码渲染。首页测试使用自绘样式夹具，因此在真机还需核对原厂模板的类和测量值。前端的模拟 API 只注入测试浏览器，产品运行时从隔离 preload 获取接口。

## 回执格式

可复制 `acceptance.example.json` 到本地 acceptance.local.json 填写。设备序列号、Windows 用户名、HID 路径、端点实例 GUID、个人目录和任何账户数据请先脱敏再附 Issue。每项标明 pass／fail／not-tested／not-selected，不能把连接成功扩展成所有设置有效。

公开 Issue 的存在不代表远端 agent 已自动收到或启动；把该设备 Issue 链接交给肥鱼，即可从下载包和清单继续。
