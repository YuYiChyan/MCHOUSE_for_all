/* Shared mouse UI; protocol providers own discovery, reads and writes. */
(() => {
  'use strict';
  const node=(tag,className,text)=>{const element=document.createElement(tag);if(className)element.className=className;if(text!==undefined)element.textContent=text;return element;};
  const zoneNames={all:'整体灯光',backlight:'背光',logo:'标志灯',scroll:'滚轮灯',left:'左侧灯',right:'右侧灯',charging:'充电灯',fast_charging:'快充灯',fully_charged:'充满提示灯'};
  const batteryText=values=>Number.isFinite(values?.battery)?`${values.battery}%${values.charging?' · 充电中':''}`:({8:'满',4:'良好',2:'低',1:'极低',0:'空'}[values?.batteryLevel]||'百分比未提供');
  window.One4AllMouse={render(container,{model,api,provider,notify=()=>{},onBack=()=>{}}){
    const controller=provider||{scan:()=>api.scanRazer(),status:id=>api.razerStatus(id),execute:request=>api.razerExecute(request)};
    let alive=true,version=0,devices=[],selectedId=null,state=null,busy=false,activeTab='performance',disposal=null;
    const root=node('section','o4-mouse'),sidebar=node('aside','o4-mouse-sidebar'),main=node('div','o4-mouse-main');
    const heading=node('div','o4-mouse-heading'),back=node('button','o4-mouse-back','← 返回支持库');back.type='button';back.onclick=onBack;
    const connection=node('p','o4-mouse-muted','正在检测设备…');heading.append(back,node('h2','',model.name||'鼠标'),connection);
    const art=node('div','o4-mouse-art'),image=node('img');image.alt=model.name||'鼠标';
    const variants=Array.isArray(model.variants)?model.variants:[];
    const imageSource=variant=>variant?.imageUrl||variant?.artUrl||variant?.image||null;
    const selectedVariant=variants.find(v=>v.id===model.selectedVariant)||variants[0];
    const initialImage=imageSource(selectedVariant)||model.imageUrl||model.artUrl;
    if(initialImage){image.src=initialImage;art.append(image);}
    const colors=node('div','device-palette');
    const picker=One4AllColorPicker.mount(colors,{variants:variants.map(v=>({...v,name:v.label||v.name,imageUrl:imageSource(v),color:v.swatch||v.color})),selectedId:selectedVariant?.id,image});
    const verificationMount=node('div','device-local-confirmation');let verificationLabel;
    const localConfirmation=One4AllLocalVerification.mount(verificationMount,{model,api,notify,onChange:record=>{if(verificationLabel)verificationLabel.textContent=record.confirmed?'本机已确认':'待验证';}});
    const deviceLabel=node('label','o4-mouse-field'),selector=node('select');selector.setAttribute('aria-label','选择已连接的鼠标');deviceLabel.append(node('span','','已连接的设备'),selector);
    const rescan=node('button','secondary','重新检测');rescan.type='button';
    sidebar.append(heading,verificationMount,art,colors,deviceLabel,rescan);const connectionHint=model.support?.connectionLabel||model.support?.connectionHint;if(connectionHint)sidebar.append(node('p','o4-mouse-muted',connectionHint));
    if(controller.connect){const connect=node('button','primary','连接设备');connect.type='button';connect.onclick=async()=>{if(busy)return;busyUI(true);try{await controller.connect();if(alive)await scan();}catch(error){if(alive)showError(error);}finally{if(alive)busyUI(false);}};sidebar.append(connect);}
    const tabs=node('nav','o4-mouse-tabs'),body=node('div','o4-mouse-body'),message=node('p','o4-mouse-message');message.hidden=true;message.setAttribute('role','status');
    tabs.setAttribute('aria-label','鼠标设置');main.append(tabs,message,body);root.append(sidebar,main);container.replaceChildren(root);

    function current(ticket){return alive&&ticket===version&&root.isConnected;}
    function showError(error){const text=error?.message||String(error);message.textContent=text;message.hidden=false;notify(text);}
    function busyUI(value){busy=value;for(const control of root.querySelectorAll('input,select,button'))if(!control.classList.contains('o4-mouse-back'))control.disabled=value||control.dataset.readonly==='true';}
    function row(label,value){const result=node('div','o4-mouse-info-row');result.append(node('span','o4-mouse-muted',label),node('span','',String(value)));return result;}
    function card(title){const section=node('section','o4-mouse-setting');section.append(node('h3','',title));return section;}
    function number(label,value,cap){const wrap=node('label','o4-mouse-field'),control=node('input');control.type='number';control.min=String(cap.min);control.max=String(cap.max);control.step=String(cap.step||1);control.value=String(value);if(cap.steps?.length){const updateStep=()=>{const current=Number(control.value),step=cap.steps.find(part=>current>=part.from&&current<=part.to)?.step||cap.step||1;control.step=String(step);control.min=String(Math.ceil(cap.min/step)*step);};control.addEventListener('input',updateStep);updateStep();}wrap.append(node('span','',label),control);return {wrap,control,get(){if(!control.reportValidity()||control.value==='')throw Error('请填写设备允许的数值');return Number(control.value);}};}
    function choices(label,value,items){const wrap=node('label','o4-mouse-field'),control=node('select');for(const item of items){const option=node('option','',item.label);option.value=String(item.value);control.append(option);}control.value=String(value);wrap.append(node('span','',label),control);return {wrap,control,get:()=>Number(control.value)};}
    function apply(section,label,command,getValue){const button=node('button','primary',label);button.type='button';button.onclick=async()=>{
      if(busy||!selectedId)return;let value;try{value=getValue();}catch(error){showError(error);return;}
      const id=selectedId,ticket=version;message.hidden=true;busyUI(true);
      try{const result=await controller.execute({deviceId:id,command,value});if(!current(ticket)||selectedId!==id)return;if(result?.ok===false)throw Error(result.error||'设备没有确认此设置');state=result;draw();notify('设置已更新');}
      catch(error){if(!current(ticket)||selectedId!==id)return;try{state=await controller.status(id);if(current(ticket)&&selectedId===id)draw();}catch{}if(current(ticket))showError(error);}
      finally{if(current(ticket))busyUI(false);}
    };section.append(button);}
    function performance(){const caps=state.capabilities||{},values=state.values||{};
      if(caps.hostMode?.readable){const box=card('配置模式'),field=choices('控制模式',values.onboardMode==='host'?1:0,[{value:0,label:'板载配置'},{value:1,label:'软件控制'}]);box.append(field.wrap,node('p','o4-mouse-muted','部分型号需要切到软件控制后才能修改 DPI 和回报率。'));if(caps.hostMode.writable)apply(box,'应用模式','hostMode.set',()=>field.get()===1);else{field.control.dataset.readonly='true';field.control.disabled=true;}body.append(box);}
      if(caps.dpi?.readable&&Array.isArray(values.dpi)){
        const separate=caps.dpi.separateAxes!==false,box=card('灵敏度'),fields=node('div','o4-mouse-fields'),x=number(separate?'水平 DPI':'DPI',values.dpi[0],caps.dpi),y=number('垂直 DPI',values.dpi[1],caps.dpi.y||caps.dpi);fields.append(x.wrap);if(separate)fields.append(y.wrap);box.append(fields);
        if(caps.dpi.writable)apply(box,'应用 DPI','dpi.set',()=>[x.get(),separate?y.get():x.get()]);else{x.control.disabled=true;y.control.disabled=true;x.control.dataset.readonly='true';y.control.dataset.readonly='true';}body.append(box);
      }
      if(caps.pollRate?.readable&&values.pollRate!==undefined){const box=card('回报率'),field=choices('回报率',values.pollRate,caps.pollRate.options.map(hz=>({value:hz,label:`${hz} Hz`})));
        if(!caps.pollRate.options.includes(values.pollRate)){const option=node('option','',`${values.pollRate} Hz（当前）`);option.value=String(values.pollRate);field.control.append(option);field.control.value=String(values.pollRate);}
        box.append(field.wrap);if(caps.pollRate.writable)apply(box,'应用回报率','pollRate.set',field.get);else{field.control.disabled=true;field.control.dataset.readonly='true';}body.append(box);
      }
      if(caps.dpiStages?.readable&&values.dpiStages?.stages?.length){const box=card('DPI 档位'),field=choices('当前档位',values.dpiStages.active,values.dpiStages.stages.map((pair,index)=>({value:index+1,label:`档位 ${index+1} · ${pair[0]===pair[1]?pair[0]:pair.join(' / ')} DPI`})));
        box.append(field.wrap);if(caps.dpiStages.writable)apply(box,'切换档位','dpiStage.set',field.get);else{field.control.disabled=true;field.control.dataset.readonly='true';}body.append(box);
      }
      if(caps.idleTime?.readable&&values.idleTime!==undefined){const box=card('休眠'),field=number('闲置时间 · 秒',values.idleTime,caps.idleTime);box.append(field.wrap);if(caps.idleTime.writable)apply(box,'应用休眠时间','idleTime.set',field.get);else{field.control.disabled=true;field.control.dataset.readonly='true';}body.append(box);}
      if(caps.debounce?.readable&&Array.isArray(values.debounce)){const box=card('按键消抖'),fields=node('div','o4-mouse-fields'),left=number('左键 · 毫秒',values.debounce[0],caps.debounce),right=number('右键 · 毫秒',values.debounce[1],caps.debounce);fields.append(left.wrap,right.wrap);box.append(fields);if(caps.debounce.writable)apply(box,'应用消抖','debounce.set',()=>[left.get(),right.get()]);else for(const field of [left,right]){field.control.dataset.readonly='true';field.control.disabled=true;}body.append(box);}
      if(caps.profiles?.readable&&values.profile!==undefined){const box=card('板载配置'),field=choices('当前配置',values.profile,caps.profiles.options.map(value=>({value,label:`配置 ${value}`})));box.append(field.wrap);if(caps.profiles.writable)apply(box,'切换配置','profile.set',field.get);else{field.control.dataset.readonly='true';field.control.disabled=true;}body.append(box);}
    }
    function lighting(){const zones=state.capabilities?.lighting?.zones||{};for(const [zone,descriptor]of Object.entries(zones)){if(!descriptor.brightness?.readable||state.values?.brightness?.[zone]===undefined)continue;const box=card(zoneNames[zone]||zone),field=number('亮度 · %',state.values.brightness[zone],descriptor.brightness);box.append(field.wrap);if(descriptor.brightness.writable)apply(box,'应用亮度','brightness.set',()=>({zone,percent:field.get()}));else{field.control.disabled=true;field.control.dataset.readonly='true';}body.append(box);}}
    function information(){const box=card('设备信息'),device=state?.device||{};box.append(row('型号',device.name||model.name),row('连接',state?.connected?'已连接':'未连接'));
      if(device.vendorId!==undefined&&device.productId!==undefined)box.append(row('USB 标识',`${device.vendorId.toString(16).padStart(4,'0')}:${device.productId.toString(16).padStart(4,'0')}`.toUpperCase()));
      if(state?.values?.battery!==undefined)box.append(row('电量',batteryText(state.values)));
      if(state?.values?.firmware)box.append(row('固件',state.values.firmware));
      const verificationRow=row('适配状态',localConfirmation.status().confirmed?'本机已确认':'待验证');verificationLabel=verificationRow.lastElementChild;box.append(verificationRow);
      const official=node('button','secondary',['mchose','razer','logitech'].includes(model.brand)?'打开官方 APP':'打开官方设置');official.type='button';official.onclick=async()=>{try{await api.openOfficial(model.brand);}catch(error){showError(error);}};
      const feedback=node('button','primary','提交验证反馈');feedback.type='button';feedback.onclick=async()=>{try{const info=await api.getAppInfo();if(!alive)return;const caps=state?.capabilities||{},availableChecks=['connection'];for(const key of ['dpi','dpiStages','pollRate','battery','debounce'])if(caps[key]?.readable)availableChecks.push(key);if(caps.idleTime?.readable)availableChecks.push('sleep');if(caps.hostMode?.readable||caps.profiles?.readable)availableChecks.push('profile');if(Object.values(caps.lighting?.zones||{}).some(zone=>zone.brightness?.readable))availableChecks.push('lighting');One4AllValidation.open({model,providerVersion:`${model.support.version||model.support.protocol||model.support.provider} / ${info.version}`,firmware:state?.values?.firmware||'',availableChecks,api,notify});}catch(error){showError(error);}};
      box.append(official,feedback);body.append(box);if(Object.keys(state?.errors||{}).length){const details=node('details','o4-mouse-errors');details.append(node('summary','','本次读取记录'));for(const [key,error]of Object.entries(state.errors))details.append(node('p','',`${key}：${error}`));body.append(details);}}
    function draw(){if(!alive)return;body.replaceChildren();tabs.replaceChildren();const caps=state?.capabilities||{},hasPerformance=['dpi','pollRate','dpiStages','idleTime','hostMode','debounce','profiles'].some(k=>caps[k]?.readable),hasLighting=Object.values(caps.lighting?.zones||{}).some(z=>z.brightness?.readable),available=[...(hasPerformance?[{id:'performance',label:'性能'}]:[]),...(hasLighting?[{id:'lighting',label:'灯效'}]:[]),{id:'information',label:'设备信息'}];
      if(!available.some(tab=>tab.id===activeTab))activeTab=available[0].id;
      for(const tab of available){const button=node('button',tab.id===activeTab?'active':'',tab.label);button.type='button';button.setAttribute('aria-current',String(tab.id===activeTab));button.onclick=()=>{activeTab=tab.id;draw();};tabs.append(button);}
      if(state?.connected){connection.textContent=state.values?.battery!==undefined?`已连接 · 电量 ${batteryText(state.values)}`:'已连接';}
      if(activeTab==='performance')performance();else if(activeTab==='lighting')lighting();else information();
    }
    function offline(text){tabs.replaceChildren();body.replaceChildren();const box=card('连接鼠标');box.append(node('p','o4-mouse-muted',text));body.append(box);information();connection.textContent='未连接';}
    async function load(id){const ticket=++version;selectedId=id;state=null;message.hidden=true;busyUI(true);connection.textContent='正在读取…';body.replaceChildren(node('p','o4-mouse-muted','正在读取设备设置…'));tabs.replaceChildren();
      try{const report=await controller.status(id);if(!current(ticket))return;if(report?.ok===false)throw Error(report.error||'读取失败');state=report;draw();if(!report.interfaceConfirmed){connection.textContent='已发现设备';message.textContent='设备暂未返回设置，请重新检测。';message.hidden=false;}}
      catch(error){if(current(ticket)){offline('暂时无法读取设备设置，请确认连接后重新检测。');showError(error);}}
      finally{if(current(ticket))busyUI(false);}
    }
    async function scan(){const ticket=++version;state=null;selectedId=null;message.hidden=true;busyUI(true);connection.textContent='正在检测设备…';body.replaceChildren();tabs.replaceChildren();try{
      const result=await controller.scan();if(!current(ticket))return;if(result?.ok===false)throw Error(result.error||'检测失败');
      devices=(Array.isArray(result)?result:result.devices||[]).filter(device=>device.modelId===model.id);selector.replaceChildren();
      for(const [index,device]of devices.entries()){const option=node('option','',`${device.name}${devices.length>1?' · '+(index+1)+' / '+device.id.slice(-6):''}`);option.value=device.id;selector.append(option);}
      deviceLabel.hidden=devices.length<2;
      if(!devices.length){offline(controller.connect?'接入这款鼠标或其接收器，然后点击“连接设备”。':'连接这款鼠标或其接收器，然后点击“重新检测”。');return;}
      await load(devices[0].id);
    }catch(error){if(current(ticket)){offline('检测没有完成，请重新检测。');showError(error);}}finally{if(current(ticket))busyUI(false);}}
    selector.onchange=()=>{if(!busy)load(selector.value);};rescan.onclick=()=>{if(!busy)scan();};const ready=scan();
    return {ready,dispose(){if(disposal)return disposal;alive=false;version++;
      disposal=Promise.allSettled([()=>picker.dispose(),()=>localConfirmation.dispose(),()=>root.remove(),()=>controller.close?.()].map(run=>Promise.resolve().then(run))).then(results=>{for(const result of results)if(result.status==='rejected')console.warn('鼠标页面资源清理失败',result.reason);});return disposal;
    }};
  }};
})();
