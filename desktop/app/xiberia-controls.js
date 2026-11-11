/* XIBERIA controls use the original Core Audio / native SDK bridge. */
(() => {
 'use strict';
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const pages=[['output','声音输出'],['eq','均衡器'],['spatial','空间音效'],['input','麦克风'],['about','设备信息']];
 const presets=[['Balanced','均衡'],['Gaming','游戏'],['Music','音乐'],['Movie','电影'],['Voice','语音'],['Shooter','射击'],['Racing','竞速'],['Roleplay','角色扮演'],['Customize','自定义']];
 window.One4AllXiberia={render(container,{model,api,notify=()=>{},onBack=()=>{}}){
  let alive=true,state=null,tab='output',busy=false,reading=false,revision=0,error='',notice='',draft=null,draftEnabled=false,dirty=false,localBadge=null,feedback=null,closing=null;
  const root=el('section','o4-mouse o4-xiberia'),sidebar=el('aside','o4-mouse-sidebar'),main=el('div','o4-mouse-main'),heading=el('div','o4-mouse-heading');
  const back=el('button','o4-mouse-back','← 返回支持库');back.type='button';back.onclick=onBack;
  const connection=el('p','o4-mouse-muted','正在检测耳机…');heading.append(back,el('h2','',model.name),connection);
  const art=el('div','o4-mouse-art'),image=el('img');image.alt=model.name;const variants=(model.variants||[]).filter(v=>v.imageUrl||v.artUrl).map(v=>({...v,imageUrl:v.imageUrl||v.artUrl}));
  let remembered;try{remembered=localStorage.getItem('one4all-xiberia-color:'+model.id);}catch{}
  const selected=variants.find(v=>v.id===(model.selectedVariant||remembered))||variants[0];if(selected){image.src=selected.imageUrl;art.append(image);}
  const colors=el('div','o4-xiberia-colors');const picker=window.One4AllColorPicker?.mount(colors,{variants,selectedId:selected?.id,image,onSelect:variant=>{try{localStorage.setItem('one4all-xiberia-color:'+model.id,variant.id);}catch{}}});
  const rescan=el('button','secondary','重新检测');rescan.type='button';rescan.onclick=()=>read(true);
  sidebar.append(heading,art,colors,rescan);
  const tabs=el('nav','o4-mouse-tabs'),message=el('p','o4-mouse-message'),body=el('div','o4-mouse-body');tabs.setAttribute('aria-label','耳机设置');message.setAttribute('role','status');
  for(const [id,label]of pages){const button=el('button','',label);button.type='button';button.dataset.tab=id;button.onclick=()=>{tab=id;render();};tabs.append(button);}
  main.append(tabs,message,body);root.append(sidebar,main);container.replaceChildren(root);
  function syncDraft(){if(!dirty&&state?.effects?.eq){draft=[...state.effects.eq.gains];draftEnabled=state.effects.eq.enabled;}}
  function card(title){const n=el('section','o4-mouse-setting o4-xiberia-setting');n.append(el('h3','',title));body.append(n);return n;}
  function button(label,action,cls='secondary'){const n=el('button',cls,label);n.type='button';n.onclick=action;return n;}
  function row(parent,label,value){const n=el('div','o4-mouse-info-row');n.append(el('span','o4-mouse-muted',label),el('span','',value));parent.append(n);}
  function toggle(parent,label,value,enabled,action){const row=el('label','o4-xiberia-toggle'),input=el('input');input.type='checkbox';input.checked=value===true;input.disabled=!enabled||busy;input.setAttribute('aria-label',label);input.onchange=()=>action(input.checked);row.append(el('span','',label),input);parent.append(row);}
  async function write(command,value){
   if(busy||!alive)return;busy=true;revision++;error='';notice='';render();
   try{const result=await api.xiberiaExecute({modelId:model.id,command,value});if(!alive)return;if(command==='openOfficialApp'){notice='官方 APP 已打开';}else{state=result;dirty=false;syncDraft();}}
   catch(failure){if(alive)error=failure.message||String(failure);}finally{busy=false;if(alive)render();}
  }
  function volume(direction,title){
   const n=card(title),value=state?.values?.[direction+'Volume'],enabled=!!state?.capabilities?.[direction]&&!busy,output=el('output','o4-xiberia-volume',typeof value==='number'?Math.round(value)+'%':'—');
   const input=el('input','o4-xiberia-slider');input.type='range';input.min='0';input.max='100';input.step='1';input.value=value??0;input.disabled=!enabled;input.setAttribute('aria-label',title);input.oninput=()=>{output.textContent=input.value+'%';};
   const name=direction==='output'?'Output':'Input';input.onchange=()=>write('set'+name+'Volume',Number(input.value));n.append(output,input);toggle(n,'静音',state?.values?.[direction+'Muted'],enabled,value=>write('set'+name+'Mute',value));
  }
  function render(){
   if(!alive)return;localBadge?.dispose();localBadge=null;body.replaceChildren();
   for(const button of tabs.children){button.classList.toggle('active',button.dataset.tab===tab);button.setAttribute('aria-current',button.dataset.tab===tab?'page':'false');}
   connection.textContent=state?.connected?'USB · 已连接':'未连接';rescan.disabled=reading||busy;
   message.textContent=error||(busy?'正在应用…':notice|| (state?.ambiguous?'请保留一台同型号耳机连接':!state?.connected?'请连接 '+model.name:''));message.hidden=!message.textContent;
   const effects=state?.effects,ready=!!effects?.ready&&!busy;
   if(tab==='output'){
    volume('output','耳机音量');const n=card('音效预设'),select=el('select','o4-xiberia-select');select.setAttribute('aria-label','音效预设');
    for(const [value,label]of presets){const option=el('option','',label);option.value=value;select.append(option);}select.value=effects?.preset||'';select.disabled=!ready;select.onchange=()=>write('setPreset',select.value);n.append(select);
    if(state?.connected&&!effects?.ready)n.append(el('p','o4-mouse-muted','音效组件尚未就绪，可在设备信息中安装。'));
   }else if(tab==='input')volume('input','麦克风音量');
   else if(tab==='eq'){
    syncDraft();const n=card('均衡器');toggle(n,'启用均衡器',draftEnabled,ready&&!!draft,value=>{draftEnabled=value;dirty=true;write('setEq',{enabled:value,gains:[...draft]});});
    if(draft&&effects?.eq){const grid=el('div','o4-xiberia-eq');for(const [index,frequency]of effects.eq.frequencies.entries()){
     const band=el('label','o4-xiberia-band'),gain=el('output','',draft[index].toFixed(1)+' dB'),input=el('input');input.type='range';input.min='-12';input.max='12';input.step='.5';input.value=draft[index];input.disabled=!ready;input.setAttribute('aria-label',frequency+' Hz 增益');input.oninput=()=>{draft[index]=Number(input.value);dirty=true;gain.textContent=draft[index].toFixed(1)+' dB';};
     band.append(gain,input,el('span','',frequency>=1000?Math.round(frequency/100)/10+'k':Math.round(frequency)+' Hz'));grid.append(band);
    }n.append(grid);}else n.append(el('p','o4-mouse-muted','连接设备并启用音效组件后可调节。'));
    const actions=el('div','o4-xiberia-actions'),apply=button('应用',()=>write('setEq',{enabled:draftEnabled,gains:[...draft]}),'primary'),reset=button('恢复平直',()=>{draft=draft.map(()=>0);dirty=true;render();});apply.disabled=reset.disabled=!ready||!draft;actions.append(apply,reset);n.append(actions);
   }else if(tab==='spatial'){
    const n=card('音效设置');for(const [key,label]of [['surround','空间环绕'],['bassBoost','低音增强'],['voiceClarity','人声清晰'],['smartVolume','智能音量']])toggle(n,label,effects?.[key],ready&&typeof effects?.[key]==='boolean',value=>write('set'+key[0].toUpperCase()+key.slice(1),value));
   }else{
    const n=card('设备信息');row(n,'设备',model.name);row(n,'连接方式','USB');row(n,'控制组件','X HUB 原生接口');
    const verification=el('div','o4-xiberia-actions');n.append(verification);if(window.One4AllLocalVerification)localBadge=window.One4AllLocalVerification.mount(verification,{model,api,notify});
    if(window.One4AllValidation){const report=button('提交验证反馈',()=>{feedback?.dispose();feedback=window.One4AllValidation.open({model,providerVersion:model.support?.version,availableChecks:['volume','microphone','equalizer'],api,notify});});verification.append(report);}
    const actions=el('div','o4-xiberia-actions'),official=button('打开官方 APP',()=>write('openOfficialApp'));official.disabled=busy;actions.append(official);
    if(!effects?.ready&&api.downloadPackage&&api.installPackage){const install=button('安装音效组件',async()=>{if(busy)return;busy=true;render();try{await api.downloadPackage('xiberia');await api.installPackage('xiberia');if(alive)notice='音效组件安装流程已启动';}catch(failure){if(alive)error=failure.message||String(failure);}finally{busy=false;if(alive)render();}});install.disabled=busy;actions.append(install);}
    n.append(actions);
   }
  }
  async function read(force=false){
   if(!alive||reading||busy||!force&&(document.hidden||dirty||document.activeElement?.matches('input,select')||document.querySelector('dialog[open]')))return;
   const ticket=revision;reading=true;rescan.disabled=true;
   try{const result=await api.xiberiaStatus(model.id);if(alive&&ticket===revision){state=result;error='';if(!state.connected){draft=null;dirty=false;}syncDraft();}}
   catch(failure){if(alive&&ticket===revision){state=null;error=failure.message||String(failure);}}
   finally{reading=false;if(alive)render();}
  }
  render();const ready=read(true),timer=setInterval(()=>read(),5000);
  const visible=()=>{if(!document.hidden)read();};document.addEventListener('visibilitychange',visible);
  return {ready,dispose(){if(closing)return closing;alive=false;revision++;clearInterval(timer);document.removeEventListener('visibilitychange',visible);picker?.dispose();localBadge?.dispose();feedback?.dispose();root.remove();try{closing=Promise.resolve(api.closeXiberia?.(model.id)).catch(()=>{});}catch{closing=Promise.resolve();}return closing;}};
 }};
})();
