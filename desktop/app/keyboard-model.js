/* Product-level keyboard view. The connected provider supplies actual capabilities. */
(() => {
 'use strict';
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 window.One4AllKeyboardModel={render(container,{model,api,provider=model.support?.provider==='melgeek-hive'?window.One4AllMelgeek:null,notify=()=>{},onBack=()=>{}}){
  let alive=true,session=null,controls=null,connecting=null,connectController=null,disposal=null;
  const canConnect=typeof provider?.connect==='function';
  const root=el('section','o4-mouse o4-keyboard-model'),side=el('aside','o4-mouse-sidebar'),main=el('div','o4-keyboard-model-main');
  const heading=el('div','o4-mouse-heading'),back=el('button','o4-mouse-back','← 返回支持库'),status=el('p','o4-mouse-muted','未连接');back.onclick=onBack;
  heading.append(back,el('h2','',model.name),status);
  const art=el('div','o4-mouse-art'),image=el('img'),dots=el('div','device-palette'),variants=(model.variants||[]).filter(v=>v.imageUrl);
  const selected=variants.find(v=>v.id===model.selectedVariant)||variants[0];image.alt=model.name;if(selected){image.src=selected.imageUrl;art.append(image);}
  const picker=One4AllColorPicker.mount(dots,{variants,selectedId:selected?.id,image});
  const validationMount=el('div','device-local-confirmation');const localConfirmation=One4AllLocalVerification.mount(validationMount,{model,api,notify});
  const connect=el('button','primary','连接设备'),disconnect=el('button','secondary','断开连接');connect.type=disconnect.type='button';connect.hidden=!canConnect;disconnect.hidden=true;
  const message=el('p','o4-mouse-message');message.hidden=true;const panel=el('div');main.append(message,panel);side.append(heading,validationMount,art,dots,connect,disconnect);root.append(side,main);container.append(root);
  const fail=error=>{if(!alive)return;message.textContent=error.message||String(error);message.hidden=false;};
  async function feedback(){const info=await api.getAppInfo();if(!alive)return;const ids=(session?.capabilities||[]).map(c=>c.id),checks=['connection'];if(ids.some(id=>id.startsWith('lighting')))checks.push('lighting');if(ids.includes('sleepTimeout'))checks.push('sleep');for(const id of ['keymap','actuation','rapidTrigger'])if(ids.includes(id))checks.push(id);window.One4AllValidation.open({model,api,notify,availableChecks:checks,providerVersion:`${model.support.version||model.support.protocol||model.support.provider} / ${info.version}`,firmware:session?.device?.firmware||''});}
  function draw(){if(!alive)return;controls?.dispose();controls=window.One4AllKeyboard.render(panel,{device:session?{...session.device,name:model.name,connected:true}:{name:model.name,connected:false,interface:'USB'},capabilities:session?.capabilities||[],values:session?.values||{},execute:session?(command,payload)=>session.execute(command,payload):undefined,initialGroup:session?undefined:'设备信息',onError:fail,readErrors:session?.errors||{},infoActions:[{label:'打开官方设置',run:()=>model.brand==='mchose'?api.openBrand(model.brand):api.openOfficial(model.brand)},{label:'提交验证反馈',run:feedback}]});status.textContent=session?'已连接':'未连接';connect.hidden=!canConnect||Boolean(session);disconnect.hidden=!session;}
  connect.onclick=()=>{if(!canConnect||connecting||!alive)return;connect.disabled=true;message.hidden=true;status.textContent='正在连接…';connectController=new AbortController();connecting=(async()=>{let current;try{current=await provider.connect({model,signal:connectController.signal,prepare:()=>api.prepareVendorHid(model.id),loadRuntime:()=>api.getVendorRuntime(model.id)});if(!alive){await current.close();return;}session=current;draw();}catch(error){fail(error);if(alive)status.textContent='未连接';}finally{connecting=null;if(alive)connect.disabled=false;}})();};
  disconnect.onclick=async()=>{disconnect.disabled=true;const previous=session;session=null;controls?.dispose();controls=null;try{await previous?.close();}catch(error){fail(error);}finally{if(alive){disconnect.disabled=false;draw();}}};
  draw();
  return {ready:Promise.resolve(),dispose(){if(disposal)return disposal;alive=false;const previous=session,pending=connecting;session=null;
    const jobs=[()=>connectController?.abort(),()=>picker.dispose(),()=>localConfirmation.dispose(),()=>controls?.dispose(),()=>root.remove(),()=>previous?.close(),()=>pending];
    disposal=Promise.allSettled(jobs.map(run=>Promise.resolve().then(run))).then(results=>{for(const result of results)if(result.status==='rejected')console.warn('键盘页面资源清理失败',result.reason);});return disposal;
  }};
 }};
})();
