/* A hardware report is sent only when the user confirms the selected checks. */
(() => {
  'use strict';
  const checks = {
    dpi:'DPI 调节',dpiStages:'DPI 档位',pollRate:'回报率',lighting:'灯光与颜色',keymap:'按键映射',macro:'宏',
    battery:'电量读取',profile:'配置切换',persistence:'断开重连后设置保留',volume:'音量与静音',microphone:'麦克风控制',
    equalizer:'均衡器',rapidTrigger:'快速触发',actuation:'触发行程',debounce:'消抖设置',sleep:'休眠设置',connection:'连接与设备识别'
  };
  const node = (tag,cls,text) => {const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
  const field = (label,input) => {const el=node('label','o4-validation-field');el.append(node('span','',label),input);return el;};
  let active = null;
  function open({model,providerVersion,firmware='',availableChecks,api=window.one4allDesktop,notify=()=>{},onSubmitted=()=>{}} = {}) {
    active?.dispose();
    const previousFocus=document.activeElement,dialog=node('dialog','o4-validation'),form=node('form','o4-validation-form');
    let disposed=false,busy=false,settings=null,serverConfig=null;
    const header=node('div','o4-validation-header'),close=node('button','o4-validation-close','×');close.type='button';close.setAttribute('aria-label','关闭验证报告');
    const heading=node('h2','','确认设备功能');heading.id='o4-validation-title';header.append(heading,close);dialog.setAttribute('aria-labelledby',heading.id);
    const subtitle=node('p','o4-validation-muted',(model?.name||'设备')+' · 只记录你已经在实物上试过的功能');
    const destination=node('p','o4-validation-destination','公开提交到 GitHub：YuYiChyan/MCHOUSE_for_all');
    const method=node('select');method.setAttribute('aria-label','验证反馈提交方式');
    const githubOption=node('option','','GitHub Issue'),serverOption=node('option','','统一验证服务器');githubOption.value='github';serverOption.value='server';serverOption.disabled=true;method.append(githubOption,serverOption);
    const methodHint=node('p','o4-validation-muted','统一验证服务器尚未配置，可到支持库的“服务器设置”填写地址。');
    const version=node('input');version.type='text';version.maxLength=100;version.required=true;version.value=providerVersion||model?.source?.version||'';version.placeholder='本次使用的适配器版本';
    if(providerVersion)version.readOnly=true;
    let githubVersion=version.value;
    const serverVersion=()=>window.One4AllLocalVerification?.versionOf(model)||String(model.support?.version||model.support?.protocol||model.support?.provider||model.protocol||model.provider||'当前适配器');
    const firmwareInput=node('input');firmwareInput.type='text';firmwareInput.maxLength=100;firmwareInput.value=firmware;firmwareInput.placeholder='选填';
    const versions=node('div','o4-validation-columns');versions.append(field('适配器版本',version),field('固件版本',firmwareInput));
    const selection=node('fieldset','o4-validation-checks');selection.append(node('legend','','实际测试通过的功能'));
    const rawChecks=Array.isArray(availableChecks)?availableChecks:availableChecks&&typeof availableChecks==='object'?Object.keys(availableChecks).filter(id=>!!availableChecks[id]):Object.keys(checks);
    const ids=[...new Set(rawChecks.map(item=>typeof item==='string'?item:item?.id).filter(id=>Object.hasOwn(checks,id)))];
    const inputs=[];
    for(const id of ids){const label=node('label','o4-validation-check'),input=node('input');input.type='checkbox';input.value=id;inputs.push(input);label.append(input,node('span','',checks[id]));selection.append(label);}
    if(!ids.length)selection.append(node('p','o4-validation-muted','当前接口尚无可确认的控制功能。'));
    const notes=node('textarea');notes.rows=3;notes.maxLength=800;notes.placeholder='例如测试了哪些档位、重连后是否保留。请勿填写序列号、账号或密钥。';
    const hardware=node('input');hardware.type='checkbox';
    const declaration=node('label','o4-validation-declaration');declaration.append(hardware,node('span','','我已在这款实物设备上测试所选功能，并确认功能正常。'));
    const auth=node('details','o4-validation-auth');auth.append(node('summary','','GitHub 提交方式'));
    const authText=node('p','o4-validation-muted','正在读取提交设置…');
    const token=node('input');token.type='password';token.autocomplete='off';token.maxLength=1024;token.placeholder='选填 GitHub Token；留空使用浏览器登录';
    const saveToken=node('button','secondary','保存 Token'),clearToken=node('button','secondary','改用浏览器登录');saveToken.type=clearToken.type='button';
    const tokenActions=node('div','o4-validation-actions');tokenActions.append(saveToken,clearToken);
    auth.append(authText,field('GitHub Token',token),node('p','o4-validation-muted','Token 需要对目标仓库创建 Issue 的权限。未配置时，将打开填写好的网页，由你登录 GitHub 后提交。'),tokenActions);
    const preview=node('details','o4-validation-preview');preview.append(node('summary','','查看提交内容'));
    const previewText=node('pre');previewText.textContent='选择功能后可预览报告。';const previewButton=node('button','secondary','更新预览');previewButton.type='button';preview.append(previewText,previewButton);
    const status=node('p','o4-validation-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const submit=node('button','primary','确认并提交验证');submit.type='submit';submit.disabled=true;
    const footer=node('div','o4-validation-footer');footer.append(node('p','o4-validation-muted','报告只确认本型号、本版本和所选功能。'),submit);
    form.append(header,subtitle,field('提交方式',method),methodHint,destination,versions,selection,field('备注',notes),declaration,auth,preview,status,footer);dialog.append(form);document.body.append(dialog);
    const payload=()=>({model,providerVersion:version.value,firmware:firmwareInput.value,checks:inputs.filter(input=>input.checked).map(input=>input.value),notes:notes.value,hardwareConfirmed:hardware.checked});
    function serverPayload(){const selected=inputs.filter(input=>input.checked).map(input=>input.value);if(!hardware.checked||!selected.length)throw Error('请勾选实测功能并确认已完成实机测试');return {modelId:model.id,providerVersion:serverVersion(),features:selected,notes:notes.value,hardwareConfirmed:hardware.checked};}
    function update(){submit.disabled=busy||!(method.value==='server'?serverConfig?.configured:settings)||!hardware.checked||!inputs.some(input=>input.checked)||!version.value.trim();}
    function setBusy(value){busy=value;for(const item of form.querySelectorAll('input,textarea,button,select'))item.disabled=value;update();}
    method.onchange=()=>{const server=method.value==='server';if(server){githubVersion=version.value;version.value=serverVersion();version.readOnly=true;}else{version.value=githubVersion;version.readOnly=!!providerVersion;}auth.hidden=server;firmwareInput.parentElement.hidden=server;destination.textContent=server?'提交到验证服务器：'+serverConfig.baseURL:'公开提交到 GitHub：YuYiChyan/MCHOUSE_for_all';previewText.textContent='选择功能后可预览报告。';status.textContent='';submit.textContent='确认并提交验证';update();};
    function showSettings(value){settings=value;authText.textContent=value.tokenConfigured?'将直接使用你的 GitHub 账号创建 Issue。Token '+(value.tokenPersistence==='encrypted'?'已由系统加密保存。':'仅保留在本次运行中。'):'将打开填写好的 GitHub Issue 网页；需要登录 GitHub 后提交。';clearToken.hidden=!value.tokenConfigured;update();}
    function fail(error){if(!disposed){status.textContent=error.message||String(error);status.dataset.error='true';}}
    function dispose(){if(disposed)return;disposed=true;dialog.close();dialog.remove();previousFocus?.focus?.();if(active?.dialog===dialog)active=null;}
    close.onclick=dispose;dialog.addEventListener('cancel',event=>{event.preventDefault();if(!busy)dispose();});
    form.addEventListener('input',()=>{status.textContent='';delete status.dataset.error;submit.textContent='确认并提交验证';update();});
    saveToken.onclick=async()=>{setBusy(true);try{showSettings(await api.saveValidationConfig({token:token.value}));token.value='';status.textContent='提交设置已保存。';}catch(error){fail(error);}finally{if(!disposed)setBusy(false);}};
    clearToken.onclick=async()=>{setBusy(true);try{showSettings(await api.saveValidationConfig({clearToken:true}));token.value='';}catch(error){fail(error);}finally{if(!disposed)setBusy(false);}};
    previewButton.onclick=async()=>{setBusy(true);try{if(method.value==='server'){previewText.textContent=JSON.stringify(serverPayload(),null,2);}else{const report=await api.prepareValidation(payload());if(!disposed)previewText.textContent=report.title+'\n\n'+report.body;}}catch(error){fail(error);}finally{if(!disposed)setBusy(false);}};
    form.onsubmit=async event=>{
      event.preventDefault();if(busy||submit.disabled)return;
      setBusy(true);status.textContent=method.value==='server'?'正在提交反馈…':settings.tokenConfigured?'正在提交验证报告…':'正在打开 GitHub…';delete status.dataset.error;
      try {
        if(method.value==='server'){
          const request=serverPayload();previewText.textContent=JSON.stringify(request,null,2);
          const result=await api.submitVerificationServerReport(request);if(disposed)return;
          if(result.status!=='received')throw Error('服务器未确认收到反馈');
          status.textContent='服务器已收到反馈';submit.textContent='反馈已提交';notify('服务器已收到反馈');return;
        }
        const report=await api.prepareValidation(payload());
        if(disposed)return;
        previewText.textContent=report.title+'\n\n'+report.body;
        const result=await api.submitValidation(report.id);
        if(disposed)return;
        if(result.submitted){status.textContent='验证报告已提交：'+result.url;submit.textContent='报告已提交';notify('已提交 '+model.name+' 的验证报告');onSubmitted(result);return;}
        status.textContent=result.message||'已打开 GitHub，请在网页中完成提交。';
      } catch(error){fail(error);}
      finally {if(!disposed){const done=['报告已提交','反馈已提交'].includes(submit.textContent);setBusy(false);if(done)submit.disabled=true;}}
    };
    const ready=Promise.allSettled([Promise.resolve().then(()=>api.validationConfig()),Promise.resolve().then(()=>api.verificationServerConfig?.()||{configured:false,baseURL:''})]).then(results=>{if(disposed)return;if(results[0].status==='fulfilled')showSettings(results[0].value);else fail(results[0].reason);serverConfig=results[1].status==='fulfilled'?results[1].value:{configured:false,baseURL:''};serverOption.disabled=!serverConfig.configured;methodHint.textContent=serverConfig.configured?'可选择 GitHub 或统一验证服务器提交。':'统一验证服务器尚未配置，可到支持库的“服务器设置”填写地址。';update();}).catch(fail);
    dialog.showModal();close.focus();active={dialog,dispose,ready};return active;
  }
  window.One4AllValidation=Object.freeze({open,checks:Object.freeze(checks)});
})();
