/* DAREU TG/HS protocol, derived from dr.dareu.com js/device/tgdevice.js 1.3.26.
 * Only read requests run during discovery. Settings preserve all other DPI stages. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.One4AllDareu=api;})(globalThis,function(){
 'use strict';
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const rates=[[[8,125],[4,250],[2,500],[1,1000]],[[64,125],[32,250],[16,500],[8,1000],[4,2000],[2,4000],[1,8000]]];
 const integer=(n,min,max,label)=>{if(!Number.isInteger(n)||n<min||n>max)throw Error(label+'超出设备范围');return n;};
 const u16=(b,i)=>(b[i]<<8)|b[i+1];
 function frame(target,group,command,size,profile=0,payload=[]){const b=new Uint8Array(64);b.set([target,size,group,command,profile,0]);b.set(payload,6);return b;}
 function normalizeResponse(value){const b=value instanceof DataView?new Uint8Array(value.buffer,value.byteOffset,value.byteLength):Uint8Array.from(value);return b.length===65?b.slice(1):(b[0]&15)?b:b.slice(1);}
 class Handle{
  constructor(device,reportId,{timeoutMs=1800}={}){this.device=device;this.reportId=reportId;this.timeoutMs=timeoutMs;this.queue=Promise.resolve();this.closed=false;this.owned=!device.opened;}
  command(target,group,command,size,profile=0,payload=[]){const run=async()=>{if(this.closed)throw Error('设备页面已关闭');let timer;
   const operation=(async()=>{if(!this.device.opened)await this.device.open();if(this.closed){if(this.owned&&this.device.opened)await this.device.close().catch(()=>{});throw Error('设备页面已关闭');}await this.device.sendFeatureReport(this.reportId,frame(target,group,command,size,profile,payload));for(let i=0;i<20;i++){if(this.closed)throw Error('设备连接已结束');const b=normalizeResponse(await this.device.receiveFeatureReport(this.reportId));if(b.length>=6&&(b[0]&15)===2&&b[2]===group&&b[3]===command&&(b[0]&240)===target)return b;await wait(10);}throw Error('设备没有确认本次命令');})();
   try{return await Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('达尔优设备响应超时')),this.timeoutMs);})]);}catch(error){this.closed=true;if(this.owned&&this.device.opened)await this.device.close().catch(()=>{});throw error;}finally{clearTimeout(timer);}
  };const task=this.queue.then(run,run);this.queue=task.catch(()=>{});return task;}
  async close(){this.closed=true;await this.queue;if(this.owned&&this.device.opened)await this.device.close();}
 }
 class MouseSession{
  constructor(handle,protocol,target=0,wireless=false){this.handle=handle;this.protocol=protocol;this.target=target;this.wireless=wireless;this.operations=Promise.resolve();}
  enqueue(fn){const job=this.operations.then(fn,fn);this.operations=job.catch(()=>{});return job;}
  call(group,command,size,profile=0,payload=[]){return this.handle.command(this.target,group,command,size,profile,payload);}
  async readState(){
   const fw=await this.call(0,128,3);if(fw.length<9)throw Error('固件信息不完整');
   const profile=(await this.call(5,131,0))[4],sensor=await this.call(4,128,8);
   if(sensor.length<14)throw Error('传感器信息不完整');const sensorId=sensor[6],maximum=u16(sensor,8),step=sensor[10],single=sensor[12]===1;
   integer(maximum,200,65535,'DPI 上限');integer(step,1,255,'DPI 步进');
   const capabilities={},values={firmware:[fw[6],fw[7],fw[8]].join('.')},errors={},raw={profile,sensorId,maximum,step,single};
   try{const b=await this.call(4,131,0,profile,[sensorId]),count=b[7],active=b[8];integer(count,1,6,'DPI 档数');integer(active,1,count,'DPI 档位');if(b.length<9+4*count)throw Error('DPI 档位数据不完整');const stages=[];for(let i=0;i<count;i++){const x=u16(b,9+i*4),y=u16(b,11+i*4);integer(x,200,maximum,'DPI');integer(single?x:y,200,maximum,'DPI');stages.push([x,single?x:y]);}raw.dpi={count,active,stages,rawStages:Array.from({length:count},(_,i)=>[u16(b,9+i*4),u16(b,11+i*4)])};capabilities.dpi={readable:true,writable:true,min:200,max:maximum,step,separateAxes:!single};capabilities.dpiStages={readable:true,writable:true};values.dpi=stages[active-1];values.dpiStages={active,stages};}catch(error){errors.dpi=error.message;}
   try{const b=await this.call(0,132,2,profile),usbType=b[6],period=b[7],map=(this.wireless?this.protocol.polling?.Wireless:this.protocol.polling?.USB)||rates[usbType];if(!map?.some(pair=>pair[0]===period))throw Error('设备未返回已知回报率');raw.rate={usbType,map};capabilities.pollRate={readable:true,writable:true,options:map.map(pair=>pair[1])};values.pollRate=map.find(pair=>pair[0]===period)[1];}catch(error){errors.pollRate=error.message;}
   if(this.protocol.hasBattery)try{const b=await this.call(7,128,3),level=b[7],maximum=b[8];if(!maximum||level>maximum)throw Error('电量数据无效');values.battery=Math.round(level*100/maximum);capabilities.battery={readable:true,writable:false};}catch(error){errors.battery=error.message;}
   return {ok:true,connected:true,interfaceConfirmed:true,provider:'dareu-webhid',verification:'unverified',capabilities,values,errors,_raw:raw};
  }
  status(){return this.enqueue(async()=>{const state=await this.readState();delete state._raw;return state;});}
  execute(command,value){return this.enqueue(async()=>{const before=await this.readState(),raw=before._raw;let check;
   if(command==='dpi.set'||command==='dpiStage.set'){
    if(!before.capabilities.dpi?.writable)throw Error('此设备尚未返回 DPI 设置');const dpi=raw.dpi,stages=dpi.rawStages.map(pair=>[...pair]);let active=dpi.active;
    if(command==='dpiStage.set'){integer(value,1,dpi.count,'DPI 档位');active=value;check=state=>state.values.dpiStages?.active===active;}
    else{const pair=Array.isArray(value)?value:[value,value];if(pair.length!==2)throw Error('DPI 参数格式错误');for(const n of pair){integer(n,200,raw.maximum,'DPI');if(n%raw.step)throw Error('DPI 不符合设备步进');}if(raw.single&&pair[0]!==pair[1])throw Error('此设备使用联动 DPI');stages[active-1]=raw.single?[pair[0],stages[active-1][1]]:pair;check=state=>state.values.dpi?.every((n,i)=>n===pair[i]);}
    const payload=[raw.sensorId,dpi.count,active];for(const pair of stages)for(const n of pair)payload.push(n>>8,n&255);await this.call(4,3,29,raw.profile,payload);
   }else if(command==='pollRate.set'){
    if(!before.capabilities.pollRate?.writable)throw Error('此设备尚未返回回报率设置');const pair=raw.rate.map.find(pair=>pair[1]===value);if(!pair)throw Error('设备不支持此回报率');await this.call(0,4,2,raw.profile,[raw.rate.usbType,pair[0]]);check=state=>state.values.pollRate===value;
   }else throw Error('尚未接入此达尔优操作');
   const after=await this.readState();delete after._raw;if(!check(after))throw Error('设备重新读取的设置与请求不同');return after;
  });}
 }
 function supportedInterface(device,support){if(device.vendorId!==support.vendorId||!support.productIds.includes(device.productId))return false;const entry=support.models.find(m=>m.productId===device.productId)||support.receivers.find(m=>m.productId===device.productId);const visit=rows=>(rows||[]).some(c=>support.usagePages.includes(c.usagePage)&&(c.featureReports||[]).some(r=>r.reportId===entry.reportId)||visit(c.children));return !!entry&&visit(device.collections);}
 function createApi({model,protocol=model.support,hid=globalThis.navigator?.hid,prepare=async()=>{},timeoutMs}={}){
  if(protocol?.protocol!=='dareu-tg-v1')throw Error('此型号尚未接入达尔优共用协议');const handles=new Map(),sessions=new Map();let closed=false,next=0;
  const check=()=>{if(closed)throw Error('设备页面已关闭');};
  const metadata=(id,session)=>({id,modelId:model.id,name:model.name,brand:'dareu',kind:'mouse',vendorId:protocol.vendorId,productId:session.protocol.productId,transport:session.wireless?'wireless':'wired'});
  async function scan(){check();if(!hid)throw Error('当前运行环境没有 HID 接口');await prepare(model.id);check();const found=await hid.getDevices();check();const devices=[],errors=[];sessions.clear();
   for(const device of found){check();if(!supportedInterface(device,protocol))continue;const direct=protocol.models.find(m=>m.productId===device.productId),receiver=protocol.receivers.find(m=>m.productId===device.productId),entry=direct||receiver;let row=handles.get(device);if(!row||row.handle.closed){row={id:++next,handle:new Handle(device,entry.reportId,{timeoutMs})};handles.set(device,row);}try{
     let targets=direct?[{target:0,entry:direct}]:[];
     if(!direct){const b=await row.handle.command(0,0,160,7);const count=b[6];integer(count,0,15,'连接数量');if(b.length<7+3*count)throw Error('接收器状态不完整');for(let i=0;i<count;i++)if(b[7+i*3]===1){const child=protocol.models.find(m=>m.productId===u16(b,8+i*3));if(child)targets.push({target:(i+1)<<4,entry:child});}}
     for(const {target,entry:child}of targets){check();const id=`dareu-${row.id}-${target}`,session=new MouseSession(row.handle,child,target,!!receiver);await session.status();check();sessions.set(id,session);devices.push(metadata(id,session));}
    }catch(error){errors.push(error.message);}
   }
   for(const [device,row]of handles)if(!found.includes(device)){await row.handle.close().catch(()=>{});handles.delete(device);}check();return {ok:true,devices,errors};
  }
  async function connect(){check();await prepare(model.id);check();await hid.requestDevice({filters:protocol.productIds.flatMap(productId=>protocol.usagePages.map(usagePage=>({vendorId:protocol.vendorId,productId,usagePage})))});check();return scan();}
  const get=id=>{check();const session=sessions.get(id);if(!session)throw Error('设备已断开，请重新检测');return session;};
  return {scan,connect,status:async id=>{const session=get(id);return {...await session.status(),device:metadata(id,session)};},execute:async({deviceId,command,value})=>{const session=get(deviceId);return {...await session.execute(command,value),device:metadata(deviceId,session)};},async close(){closed=true;await Promise.allSettled([...handles.values()].map(row=>row.handle.close()));sessions.clear();handles.clear();}};
 }
 return {createApi,Handle,MouseSession,frame,normalizeResponse,supportedInterface};
});
