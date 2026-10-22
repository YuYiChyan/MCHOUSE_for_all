/* SPDX-License-Identifier: MIT */
(() => {
  'use strict';
  const model=window.One4AllXiberiaCatalog.find(item=>item.id===document.body.dataset.device);
  if(!model)throw Error('未知西伯利亚型号');
  const displayName=new URLSearchParams(location.search).get('displayName');
  if(model.transportOnly&&displayName&&displayName.length<=80)model.title=displayName;
  document.title=model.title;
  const UI=window.One4AllUI,api=window.one4allDevice;
  const client=api?window.One4AllDeviceClient.xiberia(api):null;
  UI.setTheme(new URLSearchParams(location.search).get('dcTheme')==='dark'?'dark':'light');
  const shell=UI.shell({title:model.title,status:'正在连接',onBack:()=>client?.back()});
  const options=[['output','声音输出'],['eq','均衡器'],['spatial','空间音效'],['input','麦克风'],['about','设备信息']];
  let state=null,tab='output',writing=false,reading=false,disposed=false,error='',notice='',draft=null,draftEnabled=false,dirty=false;
  document.body.append(shell.root);
  const preview=UI.node('div','k03s-preview'),image=UI.node('img');image.alt=model.title;
  const colors=UI.node('select','k03s-select');colors.setAttribute('aria-label','设备配色');
  for(const color of model.colors){const option=UI.node('option','',color.label);option.value=color.id;colors.append(option);}
  const requested=new URLSearchParams(location.search).get('color');
  colors.value=model.colors.some(color=>color.id===requested)?requested:model.colors[0].id;
  function applyColor(){image.src='product-assets/'+model.colors.find(color=>color.id===colors.value).file;}
  colors.addEventListener('change',()=>{applyColor();client?.setColor(colors.value).catch(failure=>{error=failure.message;render();});});applyColor();
  preview.append(image,colors);shell.nav.before(preview);
  const errors=UI.node('div','k03s-error');errors.setAttribute('role','alert');shell.content.before(errors);
  const status=UI.node('div','k03s-status');status.setAttribute('role','status');shell.content.before(status);
  function button(text,action){const node=UI.node('button','dc-segment',text);node.type='button';node.addEventListener('click',action);return node;}
  function card(title,full=false){const node=UI.card(title);if(full)node.classList.add('k03s-full');shell.content.append(node);return node;}
  function toggle(parent,label,value,enabled,onChange){
    const row=UI.node('label','k03s-toggle-row');const input=UI.node('input','k03s-switch');input.type='checkbox';input.checked=value===true;input.disabled=!enabled||writing;input.setAttribute('aria-label',label);input.addEventListener('change',()=>onChange(input.checked));row.append(UI.node('span','',label),input);parent.append(row);
  }
  function syncDraft(){if(!dirty&&state?.effects?.eq){draft=[...state.effects.eq.gains];draftEnabled=state.effects.eq.enabled;}}
  async function write(command,value){
    if(writing||reading||!client)return;writing=true;error='';notice='';render();
    try{const result=await client[command](value);if(command==='openOfficialApp'){notice='官方 APP 已打开';}else{state=result;dirty=false;syncDraft();}}
    catch(failure){error=failure.message;}
    finally{writing=false;render();}
  }
  function volume(direction,title){
    const node=card(title,true),value=state?.values?.[direction+'Volume'];
    const enabled=!!state?.capabilities?.[direction]&&!writing;
    const output=UI.node('span','handoff-slider-label',typeof value==='number'?Math.round(value)+'%':'—');
    const input=UI.node('input','handoff-slider');input.type='range';input.min='0';input.max='100';input.step='1';input.value=value??0;input.disabled=!enabled;input.setAttribute('aria-label',title);
    input.addEventListener('input',()=>{output.textContent=input.value+'%';});
    const name=direction==='output'?'Output':'Input';input.addEventListener('change',()=>write('set'+name+'Volume',Number(input.value)));
    node.append(output,input);toggle(node,'静音',state?.values?.[direction+'Muted'],enabled,value=>write('set'+name+'Mute',value));
  }
  function render(){
    shell.nav.replaceChildren();shell.tabs.replaceChildren();shell.content.replaceChildren();
    shell.status.textContent=state?.connected?'USB · 已连接':'未连接';
    errors.textContent=error;errors.hidden=!error;
    status.textContent=writing?'正在应用…':notice||(state?.ambiguous?'请保留一台同型号耳机连接':state?.connected?'': '请连接 '+model.title);
    for(const [id,label] of options)shell.nav.append(UI.navButton({id,label,active:tab===id,onSelect:()=>{tab=id;render();}}));
    shell.tabs.append(UI.node('div','dc-tab active',options.find(([id])=>id===tab)[1]));
    const ready=!!state?.effects?.ready&&!writing;
    if(tab==='output'){
      volume('output','耳机音量');const node=card('音效预设',true);
      const select=UI.node('select','k03s-select');select.setAttribute('aria-label','音效预设');
      for(const [key,label] of [['Balanced','均衡'],['Gaming','游戏'],['Music','音乐'],['Movie','电影'],['Voice','语音'],['Shooter','射击'],['Racing','竞速'],['Roleplay','角色扮演'],['Customize','自定义']]){const option=UI.node('option','',label);option.value=key;select.append(option);}
      select.value=state?.effects?.preset||'Balanced';select.disabled=!ready;select.addEventListener('change',()=>write('setPreset',select.value));node.append(select);
    }else if(tab==='input')volume('input','麦克风音量');
    else if(tab==='eq'){
      const node=card('均衡器',true);syncDraft();const eq=state?.effects?.eq;
      toggle(node,'启用均衡器',draftEnabled,ready&&!!eq,value=>{draftEnabled=value;dirty=true;write('setEq',{enabled:value,gains:[...draft]});});
      if(eq&&draft){
        const grid=UI.node('div','handoff-eq-grid');grid.style.gridTemplateColumns='repeat('+draft.length+', minmax(44px, 1fr))';
        eq.frequencies.forEach((frequency,index)=>{
          const column=UI.node('label','handoff-eq-band'),output=UI.node('span','handoff-eq-gain',draft[index].toFixed(1)+' dB'),input=UI.node('input','handoff-eq-slider');
          input.type='range';input.min='-12';input.max='12';input.step='.5';input.value=draft[index];input.disabled=!ready;input.setAttribute('aria-label',frequency+' Hz 增益');
          input.addEventListener('input',()=>{draft[index]=Number(input.value);dirty=true;output.textContent=draft[index].toFixed(1)+' dB';});
          column.append(output,input,UI.node('span','',frequency>=1000?Math.round(frequency/100)/10+'k':Math.round(frequency)+' Hz'));grid.append(column);
        });node.append(grid);
      }else node.append(UI.node('div','k03s-empty','—'));
      const controls=UI.node('div','k03s-controls');const apply=button('应用',()=>write('setEq',{enabled:draftEnabled,gains:[...draft]})),reset=button('恢复平直',()=>{draft=draft.map(()=>0);dirty=true;render();});apply.disabled=reset.disabled=!ready||!draft;controls.append(apply,reset);node.append(controls);
    }else if(tab==='spatial'){
      const node=card('音效设置',true);
      for(const [key,label] of [['surround','空间环绕'],['bassBoost','低音增强'],['voiceClarity','人声清晰'],['smartVolume','智能音量']])toggle(node,label,state?.effects?.[key],ready&&typeof state?.effects?.[key]==='boolean',value=>write('set'+key[0].toUpperCase()+key.slice(1),value));
    }else{
      const node=card('设备信息',true);node.classList.add('k03s-about');node.append(UI.row('设备',model.title),UI.row('连接方式','USB'),UI.row('控制组件','X HUB 0.3.0.6'));
      const open=button('打开官方 APP',()=>write('openOfficialApp'));open.classList.add('k03s-official');open.disabled=writing||!client;node.append(open);
    }
    shell.content.querySelectorAll('button,input,select').forEach(node=>{if(reading)node.disabled=true;});
  }
  async function poll(){
    if(!client||writing||reading||disposed||document.hidden||dirty||document.activeElement?.matches('input,select'))return;
    reading=true;
    try{state=await client.status();if(!state.connected){draft=null;dirty=false;}syncDraft();}
    catch(failure){state=null;error=failure.message;}
    finally{reading=false;if(!disposed)render();}
  }
  render();poll();const timer=setInterval(poll,5000);
  window.addEventListener('pagehide',()=>{disposed=true;clearInterval(timer);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
})();
