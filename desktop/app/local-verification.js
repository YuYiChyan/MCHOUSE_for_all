(() => {
  'use strict';
  const eventName='one4all-local-verification-change';
  const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
  let activeDialog=null;
  function versionOf(model){
    return String(model.support?.version || model.support?.protocol || model.support?.provider || model.protocol || model.provider || model.source?.version || '当前适配器');
  }
  function mount(container,{model,api=window.one4allDesktop,onChange=()=>{},notify=()=>{}}={}) {
    const target={modelId:model.id,providerVersion:versionOf(model)},badge=node('button','o4-local-verification','待验证');
    badge.type='button';badge.disabled=true;badge.title='查看或修改本机确认';
    let current={...target,confirmed:false,confirmedAt:null,scope:'local'},disposed=false,revision=0,dialog=null;
    container.append(badge);
    function apply(record){
      if(disposed)return;
      current={...record};badge.disabled=false;badge.textContent=current.confirmed?'本机已确认':'待验证';
      badge.classList.toggle('is-confirmed',current.confirmed);badge.setAttribute('aria-label',model.name+'：'+badge.textContent+'，点击修改');
      onChange({...current});
    }
    function changed(event){const record=event.detail;if(record?.modelId===target.modelId&&record?.providerVersion===target.providerVersion){revision++;apply(record);}}
    window.addEventListener(eventName,changed);
    function closeDialog(){if(!dialog)return;const closing=dialog;dialog=null;closing.close();closing.remove();if(activeDialog?.dialog===closing)activeDialog=null;if(!disposed)badge.focus();}
    function openDialog(){
      if(disposed||dialog)return;
      activeDialog?.dispose();
      dialog=node('dialog','o4-local-dialog');const opened=dialog;
      const heading=node('h2','','本机验证'),details=node('p','o4-local-details',model.name+' · '+target.providerVersion);
      heading.id='o4-local-title';opened.setAttribute('aria-labelledby',heading.id);
      const note=node('p','o4-local-note','仅保存在本机，可随时撤销。');
      const checkbox=node('input');checkbox.type='checkbox';checkbox.checked=current.confirmed;
      const label=node('label','o4-local-checkbox');label.append(checkbox,node('span','','本人已实测，确认这款设备功能正常。'));
      const status=node('p','o4-local-status');status.setAttribute('role','status');
      const actions=node('div','o4-local-actions'),cancel=node('button','secondary','取消'),revoke=node('button','secondary','撤销确认'),save=node('button','primary','保存到本机');
      cancel.type=revoke.type=save.type='button';save.disabled=!checkbox.checked;revoke.hidden=!current.confirmed;
      let busy=false;
      checkbox.onchange=()=>{save.disabled=busy||!checkbox.checked;};
      cancel.onclick=closeDialog;
      opened.addEventListener('cancel',event=>{event.preventDefault();if(!busy)closeDialog();});
      async function persist(confirmed){
        if(busy||confirmed&&!checkbox.checked)return;
        busy=true;for(const item of [checkbox,cancel,revoke,save])item.disabled=true;status.textContent='';
        try {
          const record=await api.setLocalVerification({...target,confirmed});
          window.dispatchEvent(new CustomEvent(eventName,{detail:record}));
          if(!disposed){closeDialog();notify(confirmed?'已保存本机确认':'已撤销本机确认');}
        } catch(error){if(!disposed&&dialog===opened){status.textContent=error.message||String(error);busy=false;for(const item of [checkbox,cancel,revoke])item.disabled=false;save.disabled=!checkbox.checked;}}
      }
      save.onclick=()=>persist(true);revoke.onclick=()=>persist(false);
      actions.append(cancel,revoke,save);opened.append(heading,details,note,label,status,actions);document.body.append(opened);
      activeDialog={dialog:opened,dispose:closeDialog};opened.showModal();checkbox.focus();
    }
    badge.onclick=event=>{event.stopPropagation();openDialog();};
    const initialRevision=revision;
    const ready=Promise.resolve().then(()=>api.localVerificationStatus(target)).then(record=>{if(!disposed&&revision===initialRevision)apply(record);return {...current};}).catch(error=>{if(!disposed){badge.disabled=false;notify('本机确认读取失败：'+(error.message||String(error)));}return {...current};});
    function dispose(){if(disposed)return;disposed=true;closeDialog();window.removeEventListener(eventName,changed);badge.remove();}
    return {ready,dispose,status:()=>({...current})};
  }
  window.One4AllLocalVerification=Object.freeze({mount,versionOf});
})();
