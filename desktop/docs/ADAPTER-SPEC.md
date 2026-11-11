# One4All 适配器规范 1

统一入口、设备控制器和品牌依赖分别发布。原厂组件优先官网下载；拆分的适配器由固定版本的 GitHub Release 提供。下载或安装原厂程序本身不代表已经完成设备适配。

## 输出与入口

AI 返回一个 JSON 对象：

```json
{
  "manifest": {
    "id": "brand-model",
    "version": "0.1.0",
    "entry": "adapter.cjs",
    "verification": "unverified",
    "matches": [{"vendorId": 0, "productId": 0, "interface": "由现有接口资料给出"}]
  },
  "files": [{"path": "adapter.cjs", "content": "适配器源码"}],
  "capabilities": [],
  "report": {"summary": "依据的接口与尚未完成的部分", "evidence": [], "missingEvidence": [], "manualChecks": []}
}
```

示例中的 USB 数值只是结构展示，不能原样用作未知设备匹配。仅输出 `.js`、`.cjs`、`.json`、`.md` 文件；路径相对适配器目录。入口为 CommonJS，导出 `createAdapter({packageRoot, device})`，返回 `{probe, execute, close}`。异步方法可以返回 Promise。依赖位于 packageRoot，不能假定原厂程序与 One4All 共用一个进程。所有待验证候选默认不自动激活。

## 设备能力

`probe()` 实际连接并读取设备接口后返回：

```json
{
  "connected": true,
  "interfaceConfirmed": true,
  "provider": "brand-model",
  "version": "0.1.0",
  "evidence": ["本次握手读回内容或已确认的 SDK 方法结果"],
  "capabilities": [{
    "id": "pollingRate", "supported": true,
    "readable": true, "writable": true,
    "readCommand": "polling.read", "writeCommand": "polling.write",
    "options": [125, 500, 1000]
  }]
}
```

示例回报率仅展示格式，实际 options/range 必须来自设备或已有接口资料。找到 VID/PID、DLL 文件、安装器或进程，均不能证明它提供了某个控制接口。未连上设备时返回 `connected:false`、`interfaceConfirmed:false`、空 capabilities。禁止硬编码成功的 probe、固定成功的 execute、将本地变量当设备回读。

统一能力 id：`keymap`、`layers`、`macros`、`winLock`、`nkro`、`lightingEffect`、`lightingColor`、`lightingBrightness`、`lightingSpeed`、`perKeyLighting`、`pollingRate`、`debounce`、`sleepTimeout`、`actuation`、`rapidTrigger`、`deadzone`、`dks`、`socd`、`calibration`、`activeProfile`、`saveProfile`。

普通设置必须实现 readCommand。只有实际实现 writeCommand 才能 writable。数值控件需要 `range:{min,max,step}`，选项控件需要 `options:[{value,label}]` 或标量列表。复合字段使用 `ranges:{fieldId:{min,max,step}}`：rapidTrigger 的 press/release、deadzone 的 top/bottom、dks 的 stage1/stage2。涉及按键的项提供 `keys:[{value,label}]`；keymap 还提供 actions、layers；宏提供 keys 和 maxEvents。

`execute(command,payload)` 只接受自身登记的命令。读操作返回 `{ok:true,value:实际设备读回值}`；写入普通设置后由前端调用 readCommand，写失败抛出具体错误。动作命令返回 `{ok:true}` 确认。写 payload 为 `{capability:id,value}`；keymap value 为 `{layer,key,action}`，对应 read payload 可带 `{capability:'keymap',selection:{layer,key}}`。close 释放设备句柄、取消轮询、清理自己的子进程。

## 证据与待验证状态

优先利用已经解出的导出表、IPC 协议、厂商 SDK 示例、现有项目控制器和实际报错记录。没有解包接口资料的 EXE/ZIP，只能据已知文档提出下一步拆包/采集步骤；不得编造 DLL 导出名、USB 报文、WebSocket 端口或 IPC 频道。无法实现入口时 files 可以为空，并写明 missingEvidence。候选是否有入口与硬件是否验证通过是两个状态。

生成报告必须列出实现了哪些接口、尚缺哪些证据、对应设备如何进行只读连接与写入回读验收。生成器只保存候选文件与报告，不直接执行模型代码，不修改现有设备包和系统驱动，也不自动发布。
