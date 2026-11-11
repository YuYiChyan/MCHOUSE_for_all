/* MelGeek Hive device WASM adapter. Every command below is taken from the
 * official Hive controls; official UI, login, analytics and firmware are absent. */
(function(root,factory){const api=factory(root);root.One4AllMelgeek=api;if(typeof module==='object'&&module.exports)module.exports=api;})(globalThis,function(root){
 'use strict';
 const PROVIDER='melgeek-hive',VERSION='hive-core-2026-10-12/one4all-1';
 const normalize=value=>String(value||'').replace(/^melgeek\s*/i,'').replace(/[\s_-]+/g,'').toLowerCase();
 const labels={None:'关闭',Bright:'常亮',Gradual:'渐变',Breathing:'呼吸',Wave:'波浪',Ripple:'涟漪',Reaction:'按键响应',Random:'随机'};
 function matches(device,support){const names=support.productNames||[];return support.vendorIds?.includes(device.vendorId)&&names.some(name=>normalize(name)===normalize(device.productName))&&(device.collections||[]).some(c=>support.usagePages.includes(c.usagePage));}
 const cap=(id,label,type,group,extra={})=>({id,label,type,group,supported:true,readable:true,writable:true,readCommand:id+'.get',writeCommand:id+'.set',provider:PROVIDER,version:VERSION,evidence:['Official Hive wasm device command API; live response for selected device'],...extra});
 function perfValue(id,perf,key){
  if(!Number.isInteger(key)||key<0)return undefined;
  if(id==='actuation'&&Number.isFinite(perf?.key_triggers?.[key]))return {key,distance:perf.key_triggers[key]};
  if(id==='deadzone'&&Number.isFinite(perf?.key_deads?.[key]))return {key,distance:perf.key_deads[key]};
  const rt=perf?.key_rapid_triggers?.[key];if(id==='rapidTrigger'&&rt&&typeof rt.use_rapid==='boolean'&&Number.isFinite(rt.p_rapid_value)&&Number.isFinite(rt.r_rapid_value))return {key,enabled:rt.use_rapid,press:rt.p_rapid_value,release:rt.r_rapid_value};
 }
 function capabilities(snapshot){
  const out=[],values={},led=snapshot.led,settings=snapshot.settings;
  if(led&&Array.isArray(led.keymodes)&&Number.isInteger(led.kmm_index)&&led.keymodes[led.kmm_index]){
   const mode=led.keymodes[led.kmm_index];
   out.push(cap('lightingEffect','灯光效果','select','灯效',{options:led.keymodes.map((m,index)=>({value:index,label:labels[m.mode_name]||m.mode_name||`效果 ${index+1}`}))}));values.lightingEffect=led.kmm_index;
   const min=Number(mode.min),max=Number(mode.max);
   if(Number.isInteger(mode.light)&&Number.isFinite(min)&&Number.isFinite(max)&&min>=0&&max>=min&&max<=255&&mode.light>=min&&mode.light<=max){out.push(cap('lightingBrightness','灯光亮度','number','灯效',{range:{min,max,step:1},description:'使用当前灯效返回的原生亮度范围'}));values.lightingBrightness=mode.light;}
   const version=String(snapshot.deviceInfo?.fw_ver||'').split('.').map(Number),independent=snapshot.deviceInfo?.alias==='centauri80fr'||version[0]>9||version[0]===9&&version[1]>=9;
   const speedMax=independent?12:Math.min(Math.floor(Number(mode.light)/3),12);
   if(Number.isInteger(mode.speed)&&mode.speed>=1&&mode.speed<=speedMax){out.push(cap('lightingSpeed','灯光速度','number','灯效',{range:{min:1,max:speedMax,step:1}}));values.lightingSpeed=mode.speed;}
  }
  if(settings&&typeof settings.use_n_key==='boolean'){out.push(cap('nkro','全键无冲','boolean','性能'));values.nkro=settings.use_n_key;}
  if(settings&&typeof settings.use_sleep==='boolean'&&[1,2,3,5,10,20,30].includes(settings.sleep_time)){out.push(cap('sleepTimeout','休眠时间','select','性能',{options:[0,1,2,3,5,10,20,30].map(value=>({value,label:value?`${value} 分钟`:'关闭自动休眠'}))}));values.sleepTimeout=settings.use_sleep?settings.sleep_time:0;}
  const perf=snapshot.perf,accuracies=perf?.key_accuracys,keycodes=snapshot.code?.keycodes?.[snapshot.code?.kcm_index??0];
  if(Array.isArray(accuracies)&&accuracies.length&&Array.isArray(keycodes)&&keycodes.length===accuracies.length&&!(snapshot.deviceInfo?.voltage_level>=2)){
   const keys=keycodes.map((item,key)=>({value:key,label:`${item.alias||item.name||'按键'} · ${key+1}`}));
   const intersect=fn=>{const ranges=accuracies.map(fn);if(ranges.some(r=>!r||![r.min,r.max,r.step].every(Number.isFinite)||r.step<=0||r.max<r.min))return null;const range={min:Math.max(...ranges.map(r=>r.min)),max:Math.min(...ranges.map(r=>r.max)),step:Math.max(...ranges.map(r=>r.step))};return range.max>=range.min?range:null;};
   const actuation=intersect(a=>({min:a.trigger_accuracy,max:Math.min(3.3,Math.round(a.max_trigger*10)/10),step:a.trigger_accuracy}));
   const rapid=intersect(a=>({min:a.min_rapid,max:a.max_rapid,step:a.rapid_accuracy}));
   const dead=intersect(a=>({min:a.switch_type===20?.01:['made68air','lumi68'].includes(snapshot.deviceInfo?.alias)?.02:0,max:a.max_dead,step:a.dead_accuracy}));
   for(const [id,label,range] of [['actuation','按键触发点',actuation],['rapidTrigger','快速触发（RT）',rapid],['deadzone','按键死区',dead]]){
    const value=perfValue(id,perf,0);if(!range||!value)continue;
    const fields=[{id:'key',label:'按键',type:'key'},...(id==='rapidTrigger'?[{id:'enabled',label:'启用',type:'boolean'},{id:'press',label:'按下灵敏度',type:'number',unit:'mm',range},{id:'release',label:'松开灵敏度',type:'number',unit:'mm',range}]:[{id:'distance',label:id==='deadzone'?'死区':'触发点',type:'number',unit:'mm',range}])];
    out.push(cap(id,label,'fields','磁轴',{keys,fields,description:'选择一个按键，读取并设置该键的当前参数'}));values[id]=value;
   }
  }
  return {capabilities:out,values};
 }
 function createSession({runtimeBridge,model,rawDevice,deviceInfo,onEvent,timeoutMs=3500}){
  let closed=false,closedError=null,closing=null,queue=Promise.resolve(),pending=null,snapshot={deviceInfo},selectedKeys={};
  const path=deviceInfo.path;
  const receive=event=>{
   if(closed||!pending)return;let data;try{data=typeof event.data==='string'?JSON.parse(event.data):event.data;}catch{return;}
   if(data?.path!==path)return;
   if(event.type==='up_dev_error'){const current=pending;pending=null;clearTimeout(current.timer);current.reject(Error(String(data.msg||data.error||'MelGeek 设备返回错误')));return;}
   if(event.type!==pending.type||!pending.accept(data))return;const current=pending;pending=null;clearTimeout(current.timer);current.resolve(data);
  };
  onEvent(receive);
  const enqueue=fn=>{const task=queue.catch(()=>{}).then(()=>{if(closed)throw closedError;return fn();});queue=task;return task;};
  function request(section,accept=()=>true){
   if(closed)return Promise.reject(closedError);
   return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{if(pending?.timer===timer)pending=null;reject(Error('MelGeek 设备读取超时，请重新连接'));},timeoutMs);
    pending={type:'load_'+section+'_info',resolve,reject,timer,accept};
    try{runtimeBridge.runtime.emit('dev_info',{func_name:'get_'+section+'_info',args:['--path',path,...(section==='setting'?['--need',JSON.stringify(['dev_cfg'])]:[])]});}catch(error){clearTimeout(timer);pending=null;reject(error);}
   });
  }
  const sectionFor=id=>id.startsWith('lighting')?'led':['actuation','rapidTrigger','deadzone'].includes(id)?'perf':'setting';
  const assign=(section,data)=>{snapshot[section==='setting'?'settings':section]=data;return capabilities(snapshot);};
  const valueFor=(id,data)=>sectionFor(id)==='perf'?perfValue(id,data,selectedKeys[id]??0):capabilities({...snapshot,[sectionFor(id)==='setting'?'settings':'led']:data}).values[id];
  const same=(a,b)=>typeof a==='number'&&typeof b==='number'?Math.abs(a-b)<.00001:a&&b&&typeof a==='object'&&typeof b==='object'?Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(key=>same(a[key],b[key])):a===b;
  function assertValue(descriptor,value){
   if(!descriptor?.writable)throw Error('设备当前没有此控制接口');
   if(descriptor.type==='fields'){if(!value||typeof value!=='object')throw Error('请填写按键设置');for(const field of descriptor.fields){if(field.type==='key'){if(!descriptor.keys.some(key=>key.value===value[field.id]))throw Error('请选择当前设备的按键');}else assertValue({...field,writable:true},value[field.id]);}return;}
   if(descriptor.type==='boolean'){if(typeof value!=='boolean')throw Error('请选择开关状态');}else if(descriptor.type==='select'){if(!descriptor.options.some(option=>option.value===value))throw Error('设备不支持此选项');}else{const r=descriptor.range;if(typeof value!=='number'||!Number.isFinite(value)||value<r.min||value>r.max||Math.abs((value-r.min)/r.step-Math.round((value-r.min)/r.step))>1e-5)throw Error('数值超出当前设备范围');}
  }
  const session={connected:true,interfaceConfirmed:true,device:{id:rawDevice.productId+'-'+model.id,modelId:model.id,name:model.name,brand:'melgeek',kind:'keyboard',interface:'USB HID',firmware:deviceInfo.fw_ver,connected:true},capabilities:[],values:{},firmware:deviceInfo.fw_ver,provider:PROVIDER,version:VERSION,verification:'unverified',errors:{},
   async initialize(){for(const section of ['led','setting','code','perf'])try{assign(section,await request(section,data=>section==='led'?Array.isArray(data.keymodes):section==='code'?data.keycodes&&typeof data.keycodes==='object':section==='perf'?Array.isArray(data.key_accuracys):typeof data.use_n_key==='boolean'||typeof data.use_sleep==='boolean'));}catch(error){if(closed)throw closedError;session.errors[section]=error.message;}if(closed)throw closedError;Object.assign(session,capabilities(snapshot));return session;},
   execute(command,payload={}){return enqueue(async()=>{
    const match=/^(lightingEffect|lightingBrightness|lightingSpeed|nkro|sleepTimeout|actuation|rapidTrigger|deadzone)\.(get|set)$/.exec(command);if(!match)throw Error('未开放的 MelGeek 操作');const [,id,operation]=match,section=sectionFor(id);
    if(section==='perf'&&(payload.selection?.key!==undefined||payload.value?.key!==undefined)){const key=operation==='set'?payload.value.key:payload.selection.key;if(!Number.isInteger(key)||key<0||key>=snapshot.perf?.key_accuracys?.length)throw Error('请选择当前设备的按键');selectedKeys[id]=key;}
    const current=await request(section,data=>valueFor(id,data)!==undefined);assign(section,current);
    if(operation==='get')return {ok:true,value:valueFor(id,current)};
    const descriptor=capabilities(snapshot).capabilities.find(item=>item.id===id),value=payload.value;assertValue(descriptor,value);
    let args;
    if(section==='perf'){
     args=['--key_ids',JSON.stringify([value.key])];
     if(id==='actuation'){const step=snapshot.perf.key_accuracys[value.key].trigger_accuracy,max=Math.min(3.3,Math.round(snapshot.perf.key_accuracys[value.key].max_trigger*10)/10),digits=Math.min(10,String(step).split('.')[1]?.length+5||5);args.push('--trigger',(value.distance+(value.distance<max?10**-digits:0)).toFixed(digits));}
     else if(id==='deadzone')args.push('--dead',String(value.distance));
     else{const rapid={...snapshot.perf.key_rapid_triggers[value.key],use_rapid:value.enabled,p_rapid_value:value.press,r_rapid_value:value.release};delete rapid.use_series_rapid;delete rapid.advance_rapid_mode;args.push('--rapid',JSON.stringify(rapid));}
    }
    else if(id==='lightingEffect')args=['--mode_index',String(value)];
    else if(id==='lightingBrightness'||id==='lightingSpeed'){const mode={...snapshot.led.keymodes[snapshot.led.kmm_index],index:snapshot.led.kmm_index};mode[id==='lightingBrightness'?'light':'speed']=value;args=['--mode_data',JSON.stringify(mode)];}
    else if(id==='nkro')args=['--use_n_key',String(value)];
    else args=['--use_sleep',String(value!==0),'--sleep_time',String(value||snapshot.settings.sleep_time)];
    runtimeBridge.runtime.emit('dev_info',{func_name:'set_'+section+'_info',args:['--path',path,...args]});
    const after=await request(section,data=>same(valueFor(id,data),value));assign(section,after);Object.assign(session,capabilities(snapshot));return {ok:true,value:valueFor(id,after)};
   });},
   close(reason){if(closed)return closing;closed=true;closedError=reason instanceof Error?reason:Error('MelGeek 连接已关闭');session.connected=false;session.device.connected=false;if(pending){clearTimeout(pending.timer);pending.reject(closedError);pending=null;}onEvent(null);closing=Promise.resolve().then(()=>runtimeBridge.close());return closing;}
  };
  return session;
 }
 async function connect({model,prepare=async()=>{},loadRuntime,hid=root.navigator?.hid,createRuntime=root.One4AllMelgeekRuntime?.createRuntime,timeoutMs=6000,signal}={}){
  if(!model?.support||model.support.provider!==PROVIDER)throw Error('此型号尚未接入 MelGeek 控制模块');if(!hid||!createRuntime||!loadRuntime)throw Error('MelGeek 设备模块未完整加载');
  const support=model.support;let bridge,bridgeClosing,rawDevice,rawClosing,session,listener=null,handshake,rejectHandshake,rejectAbort;
  const cancelled=Object.assign(Error('MelGeek 连接已取消'),{name:'AbortError'});
  const aborted=new Promise((resolve,reject)=>{rejectAbort=reject;});aborted.catch(()=>{});
  const check=()=>{if(signal?.aborted)throw cancelled;};
  const closeBridge=()=>{if(!bridge)return Promise.resolve();return bridgeClosing??=(Promise.resolve().then(()=>bridge.close()));};
  const removeAbort=()=>signal?.removeEventListener('abort',abort);
  const cleanup=reason=>{
   listener=null;clearTimeout(handshake);rejectHandshake?.(reason);rejectHandshake=null;
   if(session)return session.close(reason);
   if(bridge)return closeBridge();
   if(rawDevice?.opened)return rawClosing??=(Promise.resolve().then(()=>rawDevice.close()));
   return Promise.resolve();
  };
  const abort=()=>{rejectAbort(cancelled);void cleanup(cancelled).catch(()=>{});};
  // Race unabortable picker/IPC promises as well. Late results may not continue
  // into another stage; a runtime that finishes constructing late is closed.
  const wait=async task=>{check();const pending=Promise.resolve(task());const value=await (signal?Promise.race([pending,aborted]):pending);check();return value;};
  signal?.addEventListener('abort',abort,{once:true});
  try{
   await wait(()=>prepare(model.id));
   const selected=await wait(()=>hid.requestDevice({filters:support.vendorIds.flatMap(vendorId=>support.usagePages.map(usagePage=>({vendorId,usagePage})))}));
   const devices=selected.filter(device=>matches(device,support));if(devices.length!==1)throw Error(devices.length?'请只选择一台当前型号键盘':'没有选择当前型号的控制接口');rawDevice=devices[0];
   const bundle=await wait(()=>loadRuntime(model.id));
   await wait(()=>Promise.resolve(createRuntime({wasmBytes:Uint8Array.from(atob(bundle.wasmBase64),c=>c.charCodeAt(0)),devices:[rawDevice],resources:bundle.resources,onEvent:event=>listener?.(event)})).then(created=>{bridge=created;if(signal?.aborted)void cleanup(cancelled).catch(()=>{});return created;}));
   const waitInfo=new Promise((resolve,reject)=>{rejectHandshake=reject;const timer=setTimeout(()=>reject(Error('MelGeek 型号握手超时，请重新连接')),timeoutMs);handshake=timer;listener=event=>{if(event.type!=='load_opt_devices')return;let data;try{data=typeof event.data==='string'?JSON.parse(event.data):event.data;}catch{return;}const rows=(data?.usb_devs||[]).filter(item=>typeof item.path==='string'&&support.aliases.includes(item.alias)&&item.dev_type===2);if(rows.length!==1)return;clearTimeout(timer);rejectHandshake=null;resolve(rows[0]);};});
   // request only receives the exact selected interface. Global device listeners
   // and host-key monitoring are never enabled.
   const [info]=await wait(()=>Promise.all([waitInfo,(async()=>{await bridge.runtime.request([rawDevice]);check();bridge.runtime.emit('dev_info',{func_name:'get_opt_devices'});})()]));
   session=createSession({runtimeBridge:{runtime:bridge.runtime,close:closeBridge},model,rawDevice,deviceInfo:info,onEvent:fn=>{listener=fn;},timeoutMs});
   const close=session.close;session.close=reason=>{removeAbort();return close(reason);};
   return await wait(()=>session.initialize());
  }catch(error){removeAbort();const finishing=cleanup(signal?.aborted?cancelled:error).catch(()=>{});if(!signal?.aborted)await finishing;throw signal?.aborted?cancelled:error;}
 }
 return {connect,matches,capabilities,createSession,normalize,PROVIDER,VERSION};
});
