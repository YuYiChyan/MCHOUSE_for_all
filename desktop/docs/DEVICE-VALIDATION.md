# 设备实机验证反馈

控制页设备信息中的「提交验证反馈」打开报告表单。用户选择自己在实物设备上测试通过的功能，确认型号、适配器版本及备注，然后点击「确认并提交验证」。所有功能默认未勾选。页面能打开、模拟设备返回成功、协议测试通过，都不属于实机验证。

默认报告发往 `YuYiChyan/MCHOUSE_for_all` 的 GitHub Issues，只包含支持库型号 ID、名称、品牌、适配器及版本、选填固件版本、用户勾选的功能和备注。不会复制设备序列号、HID 路径或运行日志。备注中的常见凭据和本机路径会隐藏；用户仍应在提交前检查公开内容。

0.6.0 增加两种独立入口：卡片上的“待验证”徽章可由用户实测后确认到本机，支持撤销；支持库的“服务器设置”可填写未来部署的统一验证服务地址。地址配置后，反馈窗口可以选择该服务器，支持库可刷新服务端的功能状态。当前未绑定或部署服务器，保存地址本身不发送请求。

本机确认、GitHub 回执、服务器收件和服务端功能状态分别保存。服务器返回“已收到反馈”不等于“功能已验证”，也不自动修改本机确认。详细接口见 [验证服务契约](VERIFICATION-SERVER-API.md)。

## 提交方式

- 未配置 Token：打开带有标题、正文的 GitHub 新 Issue 页面。用户需要登录 GitHub 并在网页中提交；应用仅提示“等待网页提交”，不假定报告已经发布。
- 配置 GitHub Token：点击确认后直接调用 GitHub 创建 Issue 接口，成功返回报告链接。Token 由 Electron 系统密钥服务加密保存；系统服务不可用时只存在当前进程内存中。不会读取其他软件或 `gh` 的账号配置，也不会把维护者的共用 Token 打包分发。

GitHub 不提供游客直接创建 Issue。创建接口要求认证；细粒度令牌需要目标仓库的 **Issues: write** 权限。普通贡献者不一定能给他人的公开仓库创建具备该权限的细粒度令牌，因此浏览器登录是默认入口。真正的免账号投稿需要另外部署由维护者管理的转发服务，目前未实现。

官方参考：[创建 Issue 的 API](https://docs.github.com/en/rest/issues/issues#create-an-issue)、[通过 URL 填充 Issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-an-issue#creating-an-issue-from-a-url-query)、[个人访问令牌及限制](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)。

## 状态含义

成功提交保存到数据目录的 `validation-receipts.json`。记录包含该型号、适配器版本、通过功能和 Issue 链接；不改变支持库的全局 `unverified` 标记。维护者根据报告与后续复核，更新具体型号及具体功能的验证状态。

同一报告内容有稳定指纹。重复点击、并发点击、程序重启后的相同报告会复用已成功的 Issue。网络中断或返回结果不完整时保留“结果未确认”，防止自动重发。用户应先去仓库检查是否已发布；程序不会将浏览器打开视作提交成功。

## 接入接口

`createValidationFeedback({ dataRoot, encryptString, decryptString, fetchImpl, openExternal })` 返回：

- `config()`：目标仓库、是否已配置 Token、保存方式，始终不返回 Token。
- `saveConfig({ token, clearToken })`：保存用户主动填写的凭据。留空保留原设置；`clearToken: true` 清除。
- `prepare({ model, providerVersion, firmware, checks, notes, hardwareConfirmed })`：从真实支持库模型筛选公开字段，生成预览；必须明确版本、至少一项有效检查、`hardwareConfirmed: true`。返回 `id/title/body/url/modelId/providerVersion/checks`。
- `submit(report.id)`：只提交本进程生成的报告，不接受调用者替换的正文或仓库。返回 `submitted/mode/status/url`，直接提交成功还包含 `number`。
- `list()`：已保存的提交记录。

渲染端 `window.One4AllValidation.open({ model, providerVersion, firmware, availableChecks, api, notify, onSubmitted })` 返回 `{ ready, dispose }`。`availableChecks` 可传检查 ID 数组或 `{ id, label }` 数组，标签以内置中文文本为准。传入空数组不会凭空出现控制功能。若允许离线补报，应传该型号已实现的能力列表，用户自行勾选过去实际验证过的项目。

渲染端 API 方法为 `validationConfig/saveValidationConfig/prepareValidation/submitValidation/listValidations`。`onSubmitted` 仅在 GitHub API 确认创建成功后调用。

开发测试使用替代网络函数和替代浏览器打开函数，不向 GitHub 创建测试 Issue。
