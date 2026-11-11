/* INPHIC wired protocol 3/4: original getConfig/readReportTransaction,
 * eN/eZ DPI layouts and eL dual-channel rates. Exact identities are in the
 * catalogue. The shared FA60/FA65 receivers require a separate identity path. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.One4AllInphic=api;})(globalThis,function(){
 'use strict';
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const bytes=v=>v instanceof DataView?new Uint8Array(v.buffer,v.byteOffset,v.byteLength).slice():Uint8Array.from(v);
 const integer=(n,min,max,label)=>{if(!Number.isInteger(n)||n<min||n>max)throw Error(label+'超出设备范围');return n;};
 function checksum(packet,from,to,offset){let sum=0;for(let i=from;i<=to;i++)sum+=packet[i];packet[offset]=sum>>>8&255;packet[offset+1]=sum&255;return packet;}
 function decodeDpi(raw,light,protocol){
  const indices=[],stages=[];for(let i=0;i<8;i++)if(raw[5]&(1<<i)){const value=raw[8+i]|raw[16+i]<<8,x=protocol.family===3?(value+1)*50:value;const y=protocol.family===3&&(light[34]&(1<<i))?((light[11+i]|light[19+i]<<8)+1)*50:x;for(const n of [x,y]){integer(n,protocol.dpi.min,protocol.dpi.max,'DPI');if(n%protocol.dpi.step)throw Error('设备返回的 DPI 步进无效');}indices.push(i);stages.push([x,y]);}
  const active=indices.indexOf(raw[24]-1);if(active<0)throw Error('当前 DPI 档位未启用');return {indices,stages,active,separateAxes:protocol.family===3&&Boolean(light[34]&(1<<indices[active]))};
 }
 class MouseSession{
  constructor(device,protocol,{delay=wait,timeoutMs=2500}={}){this.device=device;this.protocol=protocol;this.delay=delay;this.timeoutMs=timeoutMs;this.closed=false;this.owned=!device.opened;this.queue=Promise.resolve();this.cancel=null;}
  enqueue(fn){const job=this.queue.then(()=>{if(this.closed)throw Error('设备页面已关闭');return fn();});this.queue=job.catch(()=>{});return job;}
  async io(fn){if(this.closed)throw Error('设备页面已关闭');let timer;const task=Promise.resolve().then(()=>{if(this.closed)throw Error('设备页面已关闭');return fn();});try{return await Promise.race([task,new Promise((_,reject)=>{this.cancel=reject;timer=setTimeout(()=>reject(Error('英菲克设备响应超时，请重新连接')),this.timeoutMs);})]);}catch(error){this.closed=true;if(this.owned&&this.device.opened)Promise.resolve(this.device.close()).catch(()=>{});throw error;}finally{clearTimeout(timer);this.cancel=null;}}
  async open(){if(!this.device.opened)await this.io(async()=>{await this.device.open();if(this.closed){if(this.owned&&this.device.opened)await this.device.close();throw Error('设备页面已关闭');}});if(this.closed)throw Error('设备页面已关闭');}
  async send(packet){await this.open();const reports=[];const visit=rows=>{for(const row of rows||[]){reports.push(...row.featureReports||[]);visit(row.children);}};visit(this.device.collections);const report=reports.find(r=>r.reportId===packet[0]);if(!report)throw Error('设备缺少此原厂功能报告');const length=Math.ceil((report.items||[]).reduce((n,item)=>n+item.reportSize*item.reportCount,0)/8);if(length<packet.length-1)throw Error('设备功能报告长度与原厂协议不符');const data=new Uint8Array(length);data.set(packet.slice(1));await this.io(()=>this.device.sendFeatureReport(packet[0],data));}
  async read(report,length,profile=1){await this.send(Uint8Array.from([160,report,length&255,length>>>8,profile,0,0,0]));await this.delay(300);const value=bytes(await this.io(()=>this.device.receiveFeatureReport(report)));if(value[0]!==report||value.length<length)throw Error('英菲克设备返回的数据格式不符');return value.slice(0,length);}
  async readState(){
   const profile=(await this.read(12,9))[3];integer(profile,1,4,'板载配置');const capabilities={},values={},errors={},raw={profile};
   try{raw.dpi=await this.read(4,56,profile);raw.light=await this.read(5,37,profile);raw.decoded=decodeDpi(raw.dpi,raw.light,this.protocol);capabilities.dpi={readable:true,writable:true,min:this.protocol.dpi.min,max:this.protocol.dpi.max,step:this.protocol.dpi.step,separateAxes:raw.decoded.separateAxes};capabilities.dpiStages={readable:true,writable:true};values.dpi=raw.decoded.stages[raw.decoded.active];values.dpiStages={active:raw.decoded.active+1,stages:raw.decoded.stages};}catch(error){errors.dpi=error.message;}
   try{raw.rate=await this.read(6,9,profile);if(raw.rate[1]!==9||raw.rate[4]!==((~raw.rate[3])&255))throw Error('回报率数据无效');const rate=this.protocol.rates.find(r=>r.code===(raw.rate[3]&15));if(!rate)throw Error('设备返回未知回报率');capabilities.pollRate={readable:true,writable:true,options:this.protocol.rates.map(r=>r.hz)};values.pollRate=rate.hz;}catch(error){errors.pollRate=error.message;}
   if(raw.light){const maximum=this.protocol.family===3?10:8,minimum=this.protocol.family===3?0:1,level=raw.light[5]&15;if(level>=minimum&&level<=maximum){capabilities.lighting={zones:{all:{brightness:{readable:true,writable:true,min:minimum*100/maximum,max:100,step:100/maximum}}}};values.brightness={all:level*100/maximum};}}
   if(this.closed)throw Error('设备连接已关闭');return {ok:true,connected:true,interfaceConfirmed:true,provider:'inphic-webhid',verification:'unverified',capabilities,values,errors,_raw:raw};
  }
  status(){return this.enqueue(async()=>{const result=await this.readState();delete result._raw;return result;});}
  execute(command,value){return this.enqueue(async()=>{
   const before=await this.readState(),r=before._raw;let check;
   if(command==='dpi.set'||command==='dpiStage.set'){
    if(!before.capabilities.dpi)throw Error('设备尚未返回 DPI 设置');
    if(command==='dpiStage.set'){integer(value,1,r.decoded.indices.length,'DPI 档位');r.dpi[24]=r.decoded.indices[value-1]+1;check=after=>after.values.dpiStages?.active===value;}
    else{const pair=Array.isArray(value)?value:[value,value];if(pair.length!==2)throw Error('DPI 参数格式错误');for(const n of pair){integer(n,this.protocol.dpi.min,this.protocol.dpi.max,'DPI');if(n%this.protocol.dpi.step)throw Error('DPI 不符合设备步进');}if(!r.decoded.separateAxes&&pair[0]!==pair[1])throw Error('当前设备使用联动 DPI');const index=r.decoded.indices[r.decoded.active],x=this.protocol.family===3?pair[0]/50-1:pair[0];r.dpi[8+index]=x&255;r.dpi[16+index]=x>>>8;if(r.decoded.separateAxes){const y=pair[1]/50-1;r.light[11+index]=y&255;r.light[19+index]=y>>>8;}check=after=>after.values.dpi?.every((n,i)=>n===pair[i]);}
    r.dpi[49]=1;checksum(r.dpi,3,49,50);await this.send(r.dpi);await this.delay(300);if(this.protocol.family===3){checksum(r.light,3,34,35);await this.send(r.light);}
   }else if(command==='pollRate.set'){
    if(!before.capabilities.pollRate)throw Error('设备尚未返回回报率');const rate=this.protocol.rates.find(r=>r.hz===value);if(!rate)throw Error('设备不支持此回报率');r.rate[3]=(r.rate[3]&240)|rate.code;r.rate[4]=(~r.rate[3])&255;await this.send(r.rate);check=after=>after.values.pollRate===value;
   }else if(command==='brightness.set'){
    if(value?.zone!=='all'||!before.capabilities.lighting)throw Error('设备未返回此灯区');const maximum=this.protocol.family===3?10:8,minimum=this.protocol.family===3?0:1,level=Number(value.percent)*maximum/100;integer(level,minimum,maximum,'亮度');r.light[5]=(r.light[5]&240)|level;if(this.protocol.family===3)checksum(r.light,3,34,35);else checksum(r.light,3,10,11);await this.send(r.light);check=after=>after.values.brightness?.all===value.percent;
   }else throw Error('尚未接入此英菲克设置');
   await this.delay(300);const after=await this.readState();delete after._raw;if(!check(after))throw Error('设备重新读取的设置与请求不同');return after;
  });}
  async close(){this.closed=true;this.cancel?.(Error('设备页面已关闭'));if(this.owned&&this.device.opened)await this.device.close();await this.queue;}
 }
 function matching(device,protocol){return protocol.connections.some(c=>device.vendorId===c.vendorId&&device.productId===c.productId&&device.collections?.some(r=>r.usagePage===c.usagePage&&r.usage===c.usage));}
 function createApi({model,protocol=model.support,hid=globalThis.navigator?.hid,prepare=async()=>{},...options}={}){
  const sessions=new Map(),ids=new WeakMap();let closed=false,next=0;
  const ready=()=>{if(closed)throw Error('设备页面已关闭');if(!hid)throw Error('当前环境没有设备接口');};
  const metadata=(id,device)=>({id,modelId:model.id,name:model.name,brand:'inphic',vendorId:device.vendorId,productId:device.productId});
  async function scan(){ready();await prepare();ready();const devices=await hid.getDevices();ready();const output=[],seen=new Set();for(const device of devices){if(!matching(device,protocol))continue;let id=ids.get(device);if(!id){id='inphic-'+(++next);ids.set(device,id);}seen.add(id);if(!sessions.has(id)||sessions.get(id).closed)sessions.set(id,new MouseSession(device,protocol,options));output.push(metadata(id,device));}for(const [id,session]of sessions)if(!seen.has(id)){await session.close();sessions.delete(id);}return {ok:true,devices:output};}
  async function connect(){ready();await prepare();ready();await hid.requestDevice({filters:protocol.filters});return scan();}
  function selected(id){ready();const session=sessions.get(id);if(!session)throw Error('设备已断开，请重新检测');return session;}
  async function status(id){const s=selected(id);return {...await s.status(),device:metadata(id,s.device)};}
  async function execute({deviceId,command,value}){const s=selected(deviceId);return {...await s.execute(command,value),device:metadata(deviceId,s.device)};}
  async function close(){closed=true;await Promise.allSettled([...sessions.values()].map(s=>s.close()));sessions.clear();}
  return {scan,connect,status,execute,close};
 }
 return {createApi,MouseSession,decodeDpi,checksum,matching};
});
