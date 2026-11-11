/* Direct DMS v1/v2 WebHID, derived from Darmoshark's published launcher.
 * The model registry and notes retain the exact official source fingerprint. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.One4AllDarmoshark=api;})(globalThis,function(){
 'use strict';
 const bytes=value=>value instanceof DataView?new Uint8Array(value.buffer,value.byteOffset,value.byteLength):Uint8Array.from(value);
 const integer=(v,min,max,label)=>{if(!Number.isInteger(v)||v<min||v>max)throw Error(label+'超出设备范围');return v;};
 const word=(b,p)=>b[p]|b[p+1]<<8,putWord=(b,p,v)=>{b[p]=v&255;b[p+1]=v>>>8;};
 function packet(command,length,subcommand,{receiver=false,data=[]}={}){const b=new Uint8Array(64);b[0]=command|(receiver?64:0);b[2]=length;b[3]=subcommand;b.set(data,4);b[63]=(161-b.slice(0,63).reduce((a,v)=>a+v,0))&255;return b;}
 function match(device,protocol){return protocol.filters.find(f=>f.vendorId===device.vendorId&&f.productId===device.productId&&(device.collections||[]).some(c=>c.usagePage===f.usagePage&&c.usage===f.usage&&(c.outputReports||[]).some(r=>r.reportId===0)));}
 function decodeState(sensor,system,power,family,protocol,receiver,receiverRateMax){
  const v2=family==='dms_v2',mask=sensor[v2?14:6],count=mask.toString(2).replace(/0/g,'').length,active=sensor[v2?13:7];integer(count,1,5,'DPI 档数');if(mask!==(1<<count)-1)throw Error('设备返回不连续的 DPI 档位');integer(active,0,count-1,'DPI 档位');
  const stages=Array.from({length:count},(_,i)=>[word(sensor,(v2?15:8)+4*i),word(sensor,(v2?17:10)+4*i)]),[min,max,step]=protocol.dpiBounds;for(const pair of stages)for(const dpi of pair)integer(dpi,min,max,'DPI');
  const rateCode=v2?system[8]:sensor[5],rateIndex=rateCode>1?rateCode-1:0,limit=receiver?receiverRateMax:power[v2?5:10];integer(limit,1,protocol.reportRates.length,'设备回报率范围');
  const rates=protocol.reportRates.slice(0,limit).filter(r=>!r.type||r.type.includes(receiver?1:0)).map(r=>r.value),pollRate=rates[rateIndex];if(!pollRate)throw Error('设备返回未知回报率');
  const level=power[v2?11:6];integer(level,0,100,'电量');
  return {capabilities:{dpi:{readable:true,writable:true,min,max,step,separateAxes:true},dpiStages:{readable:true,writable:true},pollRate:{readable:true,writable:true,options:rates},battery:{readable:true,writable:false}},values:{dpi:stages[active],dpiStages:{active:active+1,stages},pollRate,battery:level,charging:power[v2?10:5]===1},_raw:{sensor,system,power,active,rates}};
 }
 class MouseSession{
  constructor(device,protocol,{timeoutMs=1600}={}){this.device=device;this.protocol=protocol;this.timeoutMs=timeoutMs;this.filter=match(device,protocol);if(!this.filter)throw Error('设备接口与型号不匹配');this.receiver=!!this.filter.receiver;this.owned=!device.opened;this.closed=false;this.broken=false;this.queue=Promise.resolve();this.pending=new Set();}
  check(){if(this.closed||this.broken)throw Error('设备连接已关闭，请重新连接');}
  enqueue(fn){const p=this.queue.then(()=>{this.check();return fn();});this.queue=p.catch(()=>{});return p;}
  bounded(promise){let timer,cancel;const fail=new Promise((_,reject)=>{cancel=()=>reject(Error('设备连接已关闭'));timer=setTimeout(()=>{this.broken=true;reject(Error('设备没有响应，请唤醒鼠标后重新连接'));},this.timeoutMs);this.pending.add(cancel);});return Promise.race([promise,fail]).finally(()=>{clearTimeout(timer);this.pending.delete(cancel);});}
  async ensureOpen(){this.check();if(this.device.opened)return;if(!this.opening)this.opening=Promise.resolve().then(()=>this.device.open()).then(async()=>{if(this.closed||this.broken){if(this.owned&&this.device.opened)await this.device.close();throw Error('设备连接已关闭');}});await this.bounded(this.opening);this.check();}
  async request(command,length,subcommand,{receiver=this.receiver,data=[]}={}){await this.ensureOpen();this.check();const b=packet(command,length,subcommand,{receiver,data});let listener;
   const response=new Promise((resolve,reject)=>{listener=event=>{if(event.reportId!==0)return;const r=bytes(event.data),sameCommand=command===4||command===10?[command,command|64].includes(r[0]):r[0]===b[0];if(r.length>=64&&sameCommand&&(command===10||r[3]===b[3]))resolve(r.slice(0,64));};this.device.addEventListener('inputreport',listener);Promise.resolve().then(()=>{this.check();return this.device.sendReport(0,b);}).catch(reject);});
   try{return await this.bounded(response);}finally{if(listener)this.device.removeEventListener('inputreport',listener);}
  }
  async identify(){const b=await this.request(1,129,1,{receiver:false});this.family=b[6]===0x15&&b[7]===0x19?'dms_v2':'dms';if(!this.receiver)return b;
   let vendorId,productId,online;if(this.family==='dms_v2'){vendorId=word(b,6);productId=word(b,8);online=b[4];}
   else{vendorId=word(b,5);const firmwarePid=word(b,11);productId=this.protocol.firmwareMap.find(m=>m.firmwarePid===firmwarePid)?.productId;online=(b[4]>>3)&1;}
   if(!online)throw Error('接收器已连接，鼠标尚未唤醒');if(!this.protocol.identifiers.some(i=>i.vendorId===vendorId&&i.productId===productId))throw Error('接收器当前连接的鼠标与此卡片不同');return b;
  }
  async readState(){const identity=await this.identify(),sensor=await this.request(4,129,1),system=this.family==='dms_v2'?await this.request(4,131,3):null,power=await this.request(1,129,1);const state=decodeState(sensor,system,power,this.family,this.protocol,this.receiver,identity[this.family==='dms_v2'?5:9]);return {ok:true,connected:true,interfaceConfirmed:true,provider:'darmoshark-webhid',verification:'unverified',hardwareVerified:false,protocolVersion:this.family,...state};}
  status(){return this.enqueue(async()=>{const state=await this.readState();delete state._raw;return state;});}
  execute(command,value){return this.enqueue(async()=>{const before=await this.readState(),v2=this.family==='dms_v2',raw=before._raw;let length,subcommand,data,check;
   if(command==='dpi.set'||command==='dpiStage.set'){
    const buffer=new Uint8Array(64);if(v2){buffer.set(raw.sensor.slice(4,35),4);buffer.set(raw.sensor.slice(43,58),43);length=188;}else{buffer.set(raw.sensor.slice(4,28),4);buffer[43]=raw.sensor[43];buffer[44]=raw.sensor[44];buffer.set(raw.sensor.slice(50,55),50);length=181;}
    if(command==='dpi.set'){const pair=Array.isArray(value)?value:[value,value],[min,max,step]=this.protocol.dpiBounds;if(pair.length!==2)throw Error('DPI 参数错误');for(const v of pair){integer(v,min,max,'DPI');if((v-min)%step)throw Error('DPI 不符合该型号步长');}putWord(buffer,(v2?15:8)+4*raw.active,pair[0]);putWord(buffer,(v2?17:10)+4*raw.active,pair[1]);check=state=>state.values.dpi.every((v,i)=>v===pair[i]);}
    else{integer(value,1,before.values.dpiStages.stages.length,'DPI 档位');buffer[v2?13:7]=value-1;check=state=>state.values.dpiStages.active===value;}subcommand=2;data=buffer.slice(4,v2?64:55);
   }else if(command==='pollRate.set'){
    const index=raw.rates.indexOf(value);if(index<0)throw Error('设备不支持该回报率');const code=index>0?index+1:0;subcommand=4;if(v2){data=raw.system.slice(4,20);data[4]=code;length=144;}else{data=Uint8Array.of(code);length=132;}check=state=>state.values.pollRate===value;
   }else throw Error('尚未开放此控制操作');
   await this.request(4,length,subcommand,{data});await this.request(10,129,1);const after=await this.readState();delete after._raw;if(!check(after))throw Error('设备读回值与设定不一致，请重新检测');return after;
  });}
  async close(){if(this.closed)return;this.closed=true;for(const cancel of this.pending)cancel();await this.queue;if(this.owned&&this.device.opened)await this.device.close();}
 }
 function createApi({model,protocol=model.support,hid=globalThis.navigator?.hid,prepare=async()=>{},timeoutMs}={}){
  if(protocol.protocol!=='darmoshark-dms')throw Error('尚未接入该型号协议');const sessions=new Map(),ids=new WeakMap();let closed=false,next=0;const check=()=>{if(closed)throw Error('控制页面已关闭');},meta=(id,d)=>({id,modelId:model.id,name:model.name,brand:model.brand,vendorId:d.vendorId,productId:d.productId});
  async function scan(){check();if(!hid)throw Error('当前环境没有 HID 接口');await prepare(model.id);check();const found=await hid.getDevices();check();const devices=[],errors=[];for(const d of found){check();if(!match(d,protocol))continue;let id=ids.get(d);if(!id){id='darmoshark-'+(++next);ids.set(d,id);}let session=sessions.get(id);if(session?.broken){await session.close();sessions.delete(id);session=null;}if(!session){session=new MouseSession(d,protocol,{timeoutMs});sessions.set(id,session);}try{await session.enqueue(()=>session.identify());check();devices.push(meta(id,d));}catch(e){errors.push(e.message);await session.close();sessions.delete(id);}}return {ok:true,devices,errors};}
  const get=id=>{check();const session=sessions.get(id);if(!session)throw Error('设备已断开，请重新连接');return session;};
  return {scan,async connect(){check();await prepare(model.id);check();await hid.requestDevice({filters:protocol.filters.map(({vendorId,productId,usagePage,usage})=>({vendorId,productId,usagePage,usage}))});check();return scan();},async status(id){const s=get(id);return {...await s.status(),device:meta(id,s.device)};},async execute({deviceId,command,value}){const s=get(deviceId);return {...await s.execute(command,value),device:meta(deviceId,s.device)};},async close(){closed=true;await Promise.allSettled([...sessions.values()].map(s=>s.close()));sessions.clear();}};
 }
 return {createApi,MouseSession,packet,decodeState,match};
});
