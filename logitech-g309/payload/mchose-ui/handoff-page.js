/* SPDX-License-Identifier: MIT */
(() => {
  'use strict';
  const UI=window.One4AllUI;
  const id=document.body.dataset.device;
  const mouse=id==='g309';
  const client=window.one4allDevice?window.One4AllDeviceClient[id](window.one4allDevice):null;
  const params=new URLSearchParams(location.search);
  UI.setTheme(params.get('dcTheme')==='dark'?'dark':'light');
  let state=null,busy=false,tab=mouse?'performance':'output',disposed=false,eqDraft=null,eqEnabled=null,eqResult=null;
  const shell=UI.shell({title:mouse?'Logitech G309':'BlackShark V2',status:'等待设备',onBack:()=>client?.back()});
  document.body.append(shell.root);
  const banner=UI.node('div','handoff-banner','实机验收版 · '+(client?'正在读取设备':'离线设计预览，未连接设备接口'));
  banner.setAttribute('role','status');shell.content.before(banner);
  const preview=UI.node('div','dc-sidebar-preview handoff-preview');
  const image=UI.node('img');image.src=mouse?'product-assets/g309.svg':'product-assets/blackshark.svg';image.alt=mouse?'G309 鼠标轮廓示意图':'BlackShark V2 耳机轮廓示意图';
  preview.append(image,UI.node('span','dc-muted','黑色 · 轮廓示意'));
  shell.nav.before(preview);
  const options=mouse?[['performance','性能设置'],['connection','连接与电量'],['about','设备信息']]:[['output','声音输出'],['input','麦克风'],['eq','均衡器（可选）'],['spatial','声场与扩展'],['about','设备信息']];
  const errorBox=UI.node('div','handoff-error');errorBox.setAttribute('role','alert');shell.content.before(errorBox);
  let failure='';
  function button(label,action){const b=UI.node('button','dc-segment',label);b.type='button';b.addEventListener('click',action);return b;}
  function note(text){return UI.node('p','handoff-note dc-muted',text);}
  function card(title){const c=UI.card(title);shell.content.append(c);return c;}
  async function write(command,value){
    if(busy||!client)return;busy=true;failure='';render();
    try{state=await client[command](value);if(command==='setEq')eqResult=state.eq;}catch(error){failure=error.message;state=null;}
    finally{busy=false;render();}
  }
  function volume(direction,title){
    const c=card(title),enabled=!!state?.connected&&!!state?.capabilities?.[direction]&&!busy;
    const current=state?.values?.[direction+'Volume'];
    const label=UI.node('label','handoff-slider-label',typeof current==='number'?`${current}%`:'—');
    const slider=UI.node('input','handoff-slider');slider.type='range';slider.min='0';slider.max='100';slider.step='1';slider.value=typeof current==='number'?Math.round(current):0;slider.disabled=!enabled;
    slider.setAttribute('aria-label',title+'音量');
    slider.addEventListener('input',()=>{label.textContent=slider.value+'%（待应用）';});
    const command=direction==='output'?'Output':'Input';
    slider.addEventListener('change',()=>write('set'+command+'Volume',Number(slider.value)));
    const muted=state?.values?.[direction+'Muted'];
    const mute=button(muted===true?'取消静音':'静音',()=>write('set'+command+'Mute',!muted));mute.disabled=!enabled;
    if(typeof muted==='boolean')mute.setAttribute('aria-pressed',String(muted));
    c.append(label,slider,mute,note('仅控制这块雷蛇 USB 声卡；拖动结束后应用，并读取确认结果。'));
  }
  function render(){
    shell.nav.replaceChildren();shell.tabs.replaceChildren();shell.content.replaceChildren();
    shell.status.textContent=busy?'正在应用…':state?.connected?(mouse?(state.transport==='lightspeed'?'LIGHTSPEED · 已连接':'蓝牙 · 已连接'):'USB 声卡 · 已连接'):'未连接';
    banner.textContent=window.__one4allVisualFixture?'视觉测试样本（非实机）':client?'实机验收版 · '+(state?.sampledAt?'更新于 '+new Date(state.sampledAt).toLocaleTimeString():'等待设备响应'):'离线设计预览，未连接设备接口';
    errorBox.textContent=failure||state?.error||'';errorBox.hidden=!errorBox.textContent;
    for(const [key,label] of options)shell.nav.append(UI.navButton({id:key,label,active:tab===key,onSelect:()=>{tab=key;render();}}));
    const current=options.find(([key])=>key===tab)[1];
    const heading=UI.node('div','dc-tab active',current);heading.setAttribute('role','tab');heading.setAttribute('aria-selected','true');shell.tabs.append(heading);
    if(mouse&&tab==='performance'){
      const dpi=card('DPI 灵敏度'),list=state?.capabilities?.dpiValues||[];
      dpi.append(UI.row('当前 DPI',state?.values?.dpi??'—'));
      const select=UI.node('select','handoff-select');select.setAttribute('aria-label','目标 DPI');
      for(const value of list){const option=UI.node('option','',value);option.value=value;select.append(option);}
      if(!list.length){const placeholder=UI.node('option','','等待设备读取范围');placeholder.value='';select.append(placeholder);}
      select.value=state?.values?.dpi??'';select.disabled=busy||!state?.capabilities?.setDpi;
      const apply=button('应用 DPI',()=>write('setDpi',Number(select.value)));apply.disabled=select.disabled;dpi.append(select,apply);
      dpi.append(note('选项来自鼠标能力查询；板载模式仅展示读数。'));
      const rate=card('回报率'),rates=state?.capabilities?.reportRates||[];
      rate.append(UI.row('设备设置值',state?.values?.reportRate?`${state.values.reportRate} Hz`:'—'));
      const group=UI.segmented(rates,state?.values?.reportRate,value=>value+' Hz',value=>write('setReportRate',value));
      group.querySelectorAll('button').forEach(b=>{b.disabled=busy||!state?.capabilities?.setReportRate;});rate.append(group,note('仅在 LIGHTSPEED 和设备支持时开放修改；此值不是实测传输频率。'));
      if(state?.values?.onboardMode!=='host')rate.append(note('修改前需主动启用主机模式。本适配器不自动切换模式，不写入板载配置；断电后的行为需实机验证。'));
      const mode=button(state?.values?.onboardMode==='host'?'恢复板载模式':'启用主机模式',()=>write('setHostMode',state?.values?.onboardMode!=='host'));
      mode.disabled=busy||!state?.capabilities?.setHostMode;rate.append(mode);
      for(const [field,error] of Object.entries(state?.errors||{}))rate.append(note(field+'：'+error));
    }else if(mouse&&tab==='connection'){
      const c=card('连接状态');c.append(UI.row('连接方式',state?.transport==='lightspeed'?'LIGHTSPEED 接收器':state?.transport==='bluetooth'?'蓝牙':'—'),UI.row('电量',typeof state?.values?.battery==='number'?state.values.battery+'%':'未知'),UI.row('工作模式',state?.values?.onboardMode||'—'),note('休眠、断开或读取失败时显示未知，不沿用旧读数。AA 电池不显示充电动画。'));
    }else if(!mouse&&(tab==='output'||tab==='input')){
      volume(tab,tab==='output'?'耳机音量':'麦克风音量');
      if(state?.ambiguous?.[tab])shell.content.append(note('检测到多个同型号端点，已暂停此方向的控制。'));
      if(state?.errors?.[tab])shell.content.append(note(state.errors[tab]));
    }else if(!mouse&&tab==='eq'){
      const c=card('十段均衡器 · Equalizer APO');c.classList.add('handoff-eq-card');
      const frequencies=[31,63,125,250,500,1000,2000,4000,8000,16000];
      if(!eqDraft)eqDraft=[...(state?.eq?.gains||Array(10).fill(0))];
      if(eqEnabled===null)eqEnabled=!!state?.eq?.enabledConfiguration;
      c.append(note('独立开源 EQ 选项，不是雷蛇原生 EQ。未选择并安装引擎时，只生成配置，不改变声音。'));
      if(state?.eq?.error)c.append(note('可选 EQ 状态异常：'+state.eq.error));
      const grid=UI.node('div','handoff-eq-grid');
      frequencies.forEach((frequency,index)=>{
        const column=UI.node('label','handoff-eq-band');
        const value=UI.node('span','handoff-eq-gain',eqDraft[index].toFixed(1)+' dB');
        const input=UI.node('input','handoff-eq-slider');input.type='range';input.min='-12';input.max='12';input.step='0.5';input.value=eqDraft[index];
        input.setAttribute('aria-label',frequency+' Hz 增益');input.disabled=busy;
        input.addEventListener('input',()=>{eqDraft[index]=Number(input.value);value.textContent=eqDraft[index].toFixed(1)+' dB';});
        column.append(value,input,UI.node('span','',frequency>=1000?frequency/1000+'k':frequency+' Hz'));grid.append(column);
      });
      c.append(grid);
      const enableLabel=UI.node('label','handoff-eq-enable');const enable=UI.node('input');enable.type='checkbox';enable.checked=eqEnabled;enable.disabled=busy;
      enable.addEventListener('change',()=>{eqEnabled=enable.checked;});enableLabel.append(enable,UI.node('span','','在生成的配置中启用 EQ'));
      const controls=UI.node('div','handoff-eq-actions');
      const apply=button(state?.eq?.configured?'保存 EQ 配置':'生成 APO 配置',()=>write('setEq',{enabled:eqEnabled,gains:[...eqDraft]}));apply.disabled=busy||!state?.capabilities?.output;
      const reset=button('全部归零',()=>{eqDraft=Array(10).fill(0);render();});reset.disabled=busy;
      controls.append(apply,reset);c.append(enableLabel,controls,note('范围 ±12 dB；自动设置预衰减，为正增益留出余量。配置按输出端点限制；是否实际生效需实机试听或测量。'));
      if(eqResult){
        c.append(UI.row('配置结果',eqResult.saved?'已保存 · 效果待验证':'已生成 · 未启用引擎'));
        const output=UI.node('textarea','handoff-eq-export');output.readOnly=true;output.value=eqResult.configuration||'';output.setAttribute('aria-label','Equalizer APO 配置');c.append(output);
      }
    }else if(!mouse&&tab==='spatial'){
      const c=card('THX 空间声场');c.append(UI.row('原生内嵌控制','尚无已验证接口'),note('THX 确实有独立应用和驱动内的 APO 模块。当前未找到可稳定调用此型号声场设置的公开接口，因此这里不提供无效开关。'),note('基础音量与麦克风不依赖雷云。后续若有已安装、已授权且接口可验证的模块，可从接收清单继续集成。'));
      c.append(UI.row('THX 模块线索',state?.spatial?.installedComponents?.join('、')||'未发现独立应用登记（不代表没有驱动 APO）'));
    }else{
      const c=card('设备信息');c.append(UI.row('设备',mouse?'Logitech G309 LIGHTSPEED':'Razer BlackShark V2 · 有线 USB 声卡'),UI.row('接口',mouse?'Solaar 协议适配 · Windows HIDAPI':'pycaw · Windows Core Audio'),note(mouse?'首版覆盖读取与主机模式下的 DPI／回报率。按键映射、宏和板载配置写入待单独验证。':'只匹配 1532:0529 的 USB 声卡端点。3.5mm 直连电脑不能可靠识别这款耳机。'),note('产品图为项目自绘示意，最终图片与实机验证由接收方补充。'));
    }
    const refresh=button(busy?'读取中…':'重新读取',()=>poll());refresh.disabled=busy||!client;refresh.classList.add('handoff-refresh');banner.append(refresh);
  }
  async function poll(){
    if(busy||!client||disposed||document.hidden||document.activeElement?.matches('input,select,textarea'))return;
    busy=true;
    try{state=await client.status();failure='';}catch(error){state=null;failure=error.message;}
    finally{busy=false;if(!disposed)render();}
  }
  render();poll();
  const timer=setInterval(poll,5000);
  window.addEventListener('pagehide',()=>{disposed=true;clearInterval(timer);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
})();
