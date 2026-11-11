(() => {
 'use strict';
 const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
 let active=null;
 function open({api=window.one4allDesktop,notify=()=>{},onChange=()=>{}}={}){
  active?.dispose();const previousFocus=document.activeElement,dialog=el('dialog','o4-server-settings'),heading=el('h2','','验证服务器');
  let disposed=false,busy=false;heading.id='o4-server-settings-title';dialog.setAttribute('aria-labelledby',heading.id);
  const note=el('p','o4-server-note','地址可留空。本机确认和 GitHub 上报仍可使用。');
  const label=el('label','o4-server-field'),input=el('input');input.type='url';input.placeholder='https://';input.autocomplete='url';input.spellcheck=false;input.maxLength=2048;label.append(el('span','','服务器地址'),input);
  const hint=el('p','o4-server-note','保存地址不会联网；点击“刷新验证状态”时再连接。');
  const status=el('p','o4-server-status');status.setAttribute('role','status');
  const actions=el('div','o4-server-actions'),cancel=el('button','secondary','取消'),save=el('button','primary','保存');cancel.type=save.type='button';save.disabled=true;actions.append(cancel,save);
  dialog.append(heading,note,label,hint,status,actions);document.body.append(dialog);
  function dispose(){if(disposed)return;disposed=true;dialog.close();dialog.remove();previousFocus?.focus?.();if(active?.dialog===dialog)active=null;}
  function setBusy(value){busy=value;input.disabled=save.disabled=cancel.disabled=value;}
  cancel.onclick=dispose;dialog.addEventListener('cancel',event=>{event.preventDefault();if(!busy)dispose();});
  save.onclick=async()=>{if(busy)return;setBusy(true);status.textContent='';try{const config=await api.saveVerificationServerConfig({baseURL:input.value.trim()});if(disposed)return;await onChange(config);dispose();notify(config.configured?'服务器地址已保存':'已停用验证服务器');}catch(error){if(!disposed){status.textContent=error.message||String(error);setBusy(false);}}};
  input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!save.disabled){event.preventDefault();save.click();}});
  const ready=Promise.resolve().then(()=>api.verificationServerConfig()).then(config=>{if(!disposed){input.value=config.baseURL||'';save.disabled=false;input.focus();}}).catch(error=>{if(!disposed)status.textContent=error.message||String(error);});
  dialog.showModal();active={dialog,ready,dispose};return active;
 }
 window.One4AllServerSettings=Object.freeze({open});
})();
