/* RAPOO VT_nrf54L: official Hx/Sx memory layout and JC/J6/Rx transport.
 * No driver service, pairing, resets, firmware updates or profile creation. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.One4AllRapoo=api;})(globalThis,function(){
 'use strict';
 const bases=[1536,2560,3584,4608,5632,6656,7680,8704],rateMap={8:125,4:250,2:500,1:1000,132:2000,130:4000,129:8000};
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const integer=(n,min,max,label)=>{if(!Number.isInteger(n)||n<min||n>max)throw Error(label+'超出设备范围');return n;};
 const address=n=>[n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];
 const readFrame=(connection,addr,length)=>new Uint8Array([connection,164,length,...addr]);
 const writeFrame=(connection,addr,data)=>new Uint8Array([connection,165,data.length,...addr,...new Array(Math.max(0,4-addr.length)).fill(0),...data]);
 function validateDpi(value,range){integer(value,range.min,range.max,'DPI');const step=range.steps?.find(part=>value>=part.from&&value<=part.to)?.step||range.step;if(value%step)throw Error('DPI 不符合此区间的设备步进');}
 class MouseSession{
  constructor(device,protocol,{timeoutMs=2000}={}){this.device=device;this.protocol=protocol;this.timeoutMs=timeoutMs;this.connection=device.productId===protocol.productIds[1]?165:255;this.owned=!device.opened;this.closed=false;this.queue=Promise.resolve();this.operations=Promise.resolve();}
  enqueue(fn){const job=this.operations.then(fn,fn);this.operations=job.catch(()=>{});return job;}
  command(payload){const run=async()=>{if(this.closed)throw Error('设备页面已关闭');let timer;const task=(async()=>{if(!this.device.opened)await this.device.open();if(this.closed){if(this.owned&&this.device.opened)await this.device.close().catch(()=>{});throw Error('设备页面已关闭');}await this.device.sendReport(6,payload);for(let i=0;i<5;i++){await wait(this.connection===165?10:1);if(this.closed)throw Error('设备页面已关闭');const b=await this.device.receiveFeatureReport(8);if(!b.byteLength)throw Error('设备返回空数据');const ack=b.getUint8(0);if(ack===1)return b;if(ack!==2)throw Error('雷柏设备拒绝命令（'+ack+'）');await wait(100);}throw Error('雷柏设备持续忙碌');})();
   try{return await Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('雷柏设备响应超时')),this.timeoutMs);})]);}catch(error){this.closed=true;if(this.owned&&this.device.opened)await this.device.close().catch(()=>{});throw error;}finally{clearTimeout(timer);}
  };const job=this.queue.then(run,run);this.queue=job.catch(()=>{});return job;}
  async read(addr,length){const response=await this.command(readFrame(this.connection,addr,length));if(response.byteLength<length+4)throw Error('雷柏设备返回的设置不完整');return new Uint8Array(response.buffer,response.byteOffset+4,length).slice();}
  async write(addr,data){await this.command(writeFrame(this.connection,addr,data));}
  async readState(){
   const fw=await this.command(new Uint8Array([this.connection,163,0]));if(fw.byteLength<9)throw Error('固件信息不完整');
   const profile=(await this.read([12,1],1))[0];integer(profile,0,7,'板载配置');const base=bases[profile],capabilities={},values={firmware:'0x'+fw.getUint32(1,true).toString(16).padStart(8,'0')},errors={},raw={profile,base};
   try{const x=await this.read(address(base+648),14),y=await this.read(address(base+712),14),enabled=(await this.read(address(base+662),1))[0],current=(await this.read(address(base+664),1))[0];integer(enabled,0,6,'启用档数');integer(current,0,enabled,'当前档位');const stages=[];for(let i=0;i<=enabled;i++){const pair=[x[i*2]|x[i*2+1]<<8,y[i*2]|y[i*2+1]<<8];for(const n of pair)validateDpi(n,this.protocol.dpi);stages.push(pair);}values.dpi=stages[current];values.dpiStages={active:current+1,stages};capabilities.dpi={...this.protocol.dpi,readable:true,writable:true,separateAxes:true};capabilities.dpiStages={readable:true,writable:true};raw.current=current;raw.enabled=enabled;}catch(error){errors.dpi=error.message;}
   try{const code=(await this.read(address(base+640),1))[0];if(!this.protocol.rateCodes.includes(code)||!rateMap[code])throw Error('设备返回未知回报率');values.pollRate=rateMap[code];capabilities.pollRate={readable:true,writable:true,options:this.protocol.rateCodes.map(code=>rateMap[code])};}catch(error){errors.pollRate=error.message;}
   return {ok:true,connected:true,interfaceConfirmed:true,provider:'rapoo-webhid',verification:'unverified',capabilities,values,errors,_raw:raw};
  }
  status(){return this.enqueue(async()=>{const state=await this.readState();delete state._raw;return state;});}
  execute(command,value){return this.enqueue(async()=>{const before=await this.readState(),raw=before._raw;let check;
   if(command==='dpi.set'){
    if(!before.capabilities.dpi?.writable)throw Error('设备尚未返回 DPI 设置');const pair=Array.isArray(value)?value:[value,value];if(pair.length!==2)throw Error('DPI 参数格式错误');for(const n of pair)validateDpi(n,this.protocol.dpi);await this.write(address(raw.base+648+raw.current*2),[pair[0]&255,pair[0]>>8]);await this.write(address(raw.base+712+raw.current*2),[pair[1]&255,pair[1]>>8]);check=state=>state.values.dpi?.every((n,i)=>n===pair[i]);
   }else if(command==='dpiStage.set'){
    if(!before.capabilities.dpiStages?.writable)throw Error('设备尚未返回 DPI 档位');integer(value,1,raw.enabled+1,'DPI 档位');await this.write(address(raw.base+664),[value-1]);check=state=>state.values.dpiStages?.active===value;
   }else if(command==='pollRate.set'){
    if(!before.capabilities.pollRate?.writable)throw Error('设备尚未返回回报率');const code=this.protocol.rateCodes.find(code=>rateMap[code]===value);if(code===undefined)throw Error('此型号不支持该回报率');await this.write(address(raw.base+640),[code]);check=state=>state.values.pollRate===value;
   }else throw Error('尚未接入此雷柏操作');
   const after=await this.readState();delete after._raw;if(!check(after))throw Error('设备重新读取的设置与请求不同');return after;
  });}
  async close(){this.closed=true;await this.operations;await this.queue;if(this.owned&&this.device.opened)await this.device.close();}
 }
 function supportedInterface(device,protocol){if(device.vendorId!==protocol.vendorId||!protocol.productIds.includes(device.productId))return false;const filters=protocol.filters.filter(f=>f.productId===device.productId);const visit=rows=>(rows||[]).some(c=>filters.some(f=>f.usagePage===c.usagePage&&f.usage===c.usage)&&(c.outputReports||[]).some(r=>r.reportId===6)&&(c.featureReports||[]).some(r=>r.reportId===8)||visit(c.children));return visit(device.collections);}
 function createApi({model,protocol=model.support,hid=globalThis.navigator?.hid,prepare=async()=>{},timeoutMs}={}){
  if(protocol?.protocol!=='rapoo-nrf54l-v1')throw Error('此型号尚未接入雷柏共用协议');const sessions=new Map(),ids=new WeakMap();let closed=false,next=0;const check=()=>{if(closed)throw Error('设备页面已关闭');};
  const metadata=(id,session)=>({id,modelId:model.id,name:model.name,brand:'rapoo',kind:'mouse',vendorId:session.device.vendorId,productId:session.device.productId,transport:session.connection===165?'wireless':'wired'});
  async function scan(){check();if(!hid)throw Error('当前运行环境没有 HID 接口');await prepare(model.id);check();const list=await hid.getDevices();check();const found=[],errors=[],seen=new Set();for(const device of list){check();if(!supportedInterface(device,protocol))continue;let id=ids.get(device);if(!id){id='rapoo-'+(++next);ids.set(device,id);}seen.add(id);let session=sessions.get(id);if(!session||session.closed){session=new MouseSession(device,protocol,{timeoutMs});sessions.set(id,session);}try{await session.status();check();found.push(metadata(id,session));}catch(error){if(closed)throw error;errors.push(error.message);}}for(const [id,session]of sessions)if(!seen.has(id)){await session.close().catch(()=>{});sessions.delete(id);}check();return {ok:true,devices:found,errors};}
  async function connect(){check();await prepare(model.id);check();await hid.requestDevice({filters:protocol.filters});check();return scan();}
  const get=id=>{check();const session=sessions.get(id);if(!session)throw Error('设备已断开，请重新检测');return session;};
  return {scan,connect,status:async id=>{const session=get(id);return {...await session.status(),device:metadata(id,session)};},execute:async({deviceId,command,value})=>{const session=get(deviceId);return {...await session.execute(command,value),device:metadata(deviceId,session)};},async close(){closed=true;await Promise.allSettled([...sessions.values()].map(s=>s.close()));sessions.clear();}};
 }
 return {createApi,MouseSession,readFrame,writeFrame,address,validateDpi,supportedInterface};
});
