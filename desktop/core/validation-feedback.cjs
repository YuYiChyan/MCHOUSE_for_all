'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const REPOSITORY = 'YuYiChyan/MCHOUSE_for_all';
const ISSUE_ROOT = 'https://github.com/' + REPOSITORY + '/issues';
const CHECKS = Object.freeze({
  dpi:'DPI 调节', dpiStages:'DPI 档位', pollRate:'回报率', lighting:'灯光与颜色',
  keymap:'按键映射', macro:'宏', battery:'电量读取', profile:'配置切换',
  persistence:'断开重连后设置保留', volume:'音量与静音', microphone:'麦克风控制',
  equalizer:'均衡器', rapidTrigger:'快速触发', actuation:'触发行程',
  debounce:'消抖设置', sleep:'休眠设置', connection:'连接与设备识别'
});

function clean(value, maxLength = 160) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/[<>`|]/g,'').trim().slice(0,maxLength);
}
function publicText(value, maxLength) {
  return clean(value,maxLength)
    .replace(/(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]+/g,'[已隐藏凭据]')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}/g,'[已隐藏凭据]')
    .replace(/(?:api[_ -]?key|token|password|secret|序列号|serial(?:number)?|s\/n)\s*[:=：]\s*[^\s,，;；]+/gi,'[已隐藏私密字段]')
    .replace(/(?:\\\\\?\\|[a-zA-Z]:\\)[^\s,，;；]+/g,'[已隐藏本机路径]');
}
function createValidationFeedback({dataRoot,encryptString,decryptString,fetchImpl = globalThis.fetch,openExternal} = {}) {
  if (!dataRoot || !path.isAbsolute(dataRoot)) throw new TypeError('dataRoot must be an absolute path');
  fs.mkdirSync(dataRoot,{recursive:true});
  const configFile = path.join(dataRoot,'validation-config.json');
  const receiptsFile = path.join(dataRoot,'validation-receipts.json');
  let stored = {}, token = '', receipts = [];
  try { stored = JSON.parse(fs.readFileSync(configFile,'utf8')); } catch {}
  try { const data = JSON.parse(fs.readFileSync(receiptsFile,'utf8')); if (Array.isArray(data)) receipts = data; } catch {}
  if (stored.encryptedToken && decryptString) try { token = decryptString(Buffer.from(stored.encryptedToken,'base64')); } catch {}
  const prepared = new Map(), inFlight = new Map();
  const config = () => ({repository:REPOSITORY,tokenConfigured:!!token,tokenPersistence:token ? stored.encryptedToken ? 'encrypted' : 'session' : 'none'});
  function saveConfig(input = {}) {
    let nextToken = token;
    if (input.clearToken === true) nextToken = '';
    else if (typeof input.token === 'string' && input.token.trim()) nextToken = input.token.trim();
    if (nextToken.length > 1024 || /\s/.test(nextToken)) throw new Error('GitHub Token 格式不正确');
    const next = {};
    if (nextToken && encryptString && decryptString) next.encryptedToken = Buffer.from(encryptString(nextToken)).toString('base64');
    fs.writeFileSync(configFile,JSON.stringify(next,null,2),{mode:0o600});
    stored = next; token = nextToken;
    return config();
  }
  function saveReceipt(receipt) {
    const next = [receipt,...receipts.filter(item => item.id !== receipt.id)];
    const temp = receiptsFile + '.tmp';
    fs.writeFileSync(temp,JSON.stringify(next,null,2),{mode:0o600});
    fs.renameSync(temp,receiptsFile); receipts = next;
  }
  function prepare(input = {}) {
    const model = input.model;
    if (!model || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,159}$/.test(model.id || '') || !model.name) throw new Error('请选择支持库中的具体型号');
    if (input.hardwareConfirmed !== true) throw new Error('请确认已在这款实物设备上完成所选功能的测试');
    const checks = [...new Set((Array.isArray(input.checks) ? input.checks : []).filter(id => Object.hasOwn(CHECKS,id)))].sort();
    if (!checks.length) throw new Error('请勾选至少一项实际测试通过的功能');
    const providerVersion = publicText(input.providerVersion,100);
    if (!providerVersion || /^(?:unknown|未知|未提供)$/i.test(providerVersion)) throw new Error('请填写本次测试使用的适配器版本');
    const redact = (value,length) => publicText(token ? String(value ?? '').split(token).join('[已隐藏凭据]') : value,length);
    const report = {
      modelId:model.id,modelName:redact(model.name,160),brand:redact(model.brand,60),
      provider:redact(model.support?.provider || model.source?.provider || model.brand,100),
      providerVersion:redact(providerVersion,100),firmware:redact(input.firmware,100),checks,notes:redact(input.notes,800)
    };
    // Only public catalog fields are selected; never copy the connected HID device object.
    const id = crypto.createHash('sha256').update(JSON.stringify(report)).digest('hex');
    const title = '[设备验证] ' + report.modelName + ' · ' + report.providerVersion;
    const body = [
      '## 用户实机验证报告','',
      '| 项目 | 本次验证 |','| --- | --- |',
      '| 型号 | ' + report.modelName + ' |',
      '| 支持库型号 ID | ' + report.modelId + ' |',
      '| 品牌 | ' + report.brand + ' |',
      '| 适配器 | ' + report.provider + ' |',
      '| 适配器版本 | ' + report.providerVersion + ' |',
      '| 固件版本 | ' + (report.firmware || '未填写') + ' |','',
      '### 实际测试通过的功能',...checks.map(id => '- [x] ' + CHECKS[id]),'',
      '我已在上述实物设备上测试所选功能，并确认这些功能正常。未勾选的功能不在本次确认范围内。',
      '', '### 备注',report.notes || '无','',
      '此报告只适用于以上型号与适配器版本；其他型号及未测试的功能仍待验证。',
      '', '<!-- one4all-validation:' + id + ' -->'
    ].join('\n');
    const url = ISSUE_ROOT + '/new?' + new URLSearchParams({title,body}).toString();
    const result = {...report,id,title,body,url,repository:REPOSITORY};
    prepared.set(id,result);
    if (prepared.size > 128) prepared.delete(prepared.keys().next().value);
    return structuredClone(result);
  }
  function receiptBase(report) {
    return {id:report.id,modelId:report.modelId,modelName:report.modelName,providerVersion:report.providerVersion,checks:report.checks,createdAt:new Date().toISOString()};
  }
  async function perform(report) {
    const previous = receipts.find(item => item.id === report.id);
    if (previous?.submitted) return {...previous,duplicate:true};
    if (previous && ['pending','uncertain'].includes(previous.status)) return {...previous,status:'uncertain',submitted:false,message:'上次提交的结果尚未确认，请先在 GitHub 检查是否已生成报告，避免重复发布。'};
    if (!token) {
      if (!openExternal) throw new Error('无法打开浏览器，请复制报告到 GitHub 提交');
      await openExternal(report.url);
      return {...receiptBase(report),mode:'browser',submitted:false,status:'awaiting-browser-submit',url:report.url,message:'已打开填写好的 GitHub Issue，请登录后在网页中提交。'};
    }
    const pending = {...receiptBase(report),mode:'api',submitted:false,status:'pending',url:ISSUE_ROOT};
    saveReceipt(pending);
    let response;
    try {
      response = await fetchImpl('https://api.github.com/repos/' + REPOSITORY + '/issues',{
        method:'POST',redirect:'error',headers:{Accept:'application/vnd.github+json','Content-Type':'application/json',Authorization:'Bearer ' + token,'X-GitHub-Api-Version':'2022-11-28'},
        body:JSON.stringify({title:report.title,body:report.body}),signal:AbortSignal.timeout(30000)
      });
    } catch {
      saveReceipt({...pending,status:'uncertain'});
      throw new Error('未收到 GitHub 的提交结果。请先到仓库的 Issues 检查报告是否已发布，避免重复提交。');
    }
    if (response.status !== 201) {
      saveReceipt({...pending,status:'failed'});
      const reasons = {401:'登录凭据无效，请重新设置 GitHub Token',403:'Token 没有提交权限，或 GitHub 暂时限制了请求；也可清除 Token 后改用网页提交',404:'Token 无法访问目标仓库；可清除 Token 后登录 GitHub 网页提交',410:'目标仓库已关闭 Issues',422:'GitHub 未接受报告，请稍后重试'};
      throw new Error(reasons[response.status] || 'GitHub 提交失败（HTTP ' + response.status + '）');
    }
    let data;
    try { data = await response.json(); } catch {}
    const issuePattern = new RegExp('^https://github\\.com/' + REPOSITORY + '/issues/[1-9][0-9]*$','i');
    if (!data || !Number.isSafeInteger(data.number) || !issuePattern.test(data.html_url || '')) {
      saveReceipt({...pending,status:'uncertain'});
      throw new Error('GitHub 已接受报告，但返回的报告链接不完整。请到仓库 Issues 查看，勿重复提交。');
    }
    const receipt = {...pending,status:'submitted',submitted:true,url:data.html_url,number:data.number};
    saveReceipt(receipt); return receipt;
  }
  function submit(input) {
    const id = typeof input === 'string' ? input : input?.id;
    const report = prepared.get(id);
    if (!report) return Promise.reject(new Error('报告预览已失效，请重新打开验证表单'));
    if (inFlight.has(id)) return inFlight.get(id);
    const promise = perform(report).finally(() => inFlight.delete(id));
    inFlight.set(id,promise); return promise;
  }
  return {config,saveConfig,prepare,submit,list:() => structuredClone(receipts),checks:() => ({...CHECKS})};
}

module.exports = {createValidationFeedback,CHECKS,REPOSITORY};
