/* AULA eVision protocol reconstructed from official m8 / Iie / LA / Pze.
 * Only configuration reads and explicit setting changes; no firmware or reset. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.One4AllAula=api;})(globalThis,function(){
 'use strict';
 const RATES=[125,250,500,1000,2000,4000,8000];
 const bytes=value=>value instanceof DataView?new Uint8Array(value.buffer,value.byteOffset,value.byteLength):new Uint8Array(value);
 const integer=(value,min,max,label)=>{if(!Number.isInteger(value)||value<min||value>max)throw Error(label+'超出设备范围');return value;};
 function frame(command,length,offset=0,data=null,wireless=false){const packet=new Uint8Array(wireless?31:63);packet.set([0,0,command,length,offset&255,offset>>>8,0]);if(data)packet.set(data,7);return packet;}
 class Transport{
  constructor(device,wireless,{timeout=1600}={}){this.device=device;this.wireless=wireless;this.timeout=timeout;this.closed=false;this.owned=!device.opened;this.pending=null;}
  async exchange(packet,minimum=0){if(this.closed)throw Error('设备连接已关闭');if(!this.device.opened)await this.device.open();if(this.closed){if(this.owned&&this.device.opened)await this.device.close();throw Error('设备连接已关闭');}
   return new Promise((resolve,reject)=>{let timer;const cleanup=()=>{clearTimeout(timer);this.device.removeEventListener('inputreport',listener);this.pending=null;};
    const listener=event=>{if(event.reportId!==4)return;const data=bytes(event.data);if(data.length<7||data[3]<minimum||data.length<7+data[3])return;cleanup();resolve(data);};
    const fail=error=>{cleanup();this.closed=true;if(this.owned&&this.device.opened)Promise.resolve(this.device.close()).catch(()=>{});reject(error);};
    this.pending=fail;timer=setTimeout(()=>fail(Error('狼蛛设备响应超时，请重新连接')),this.timeout);this.device.addEventListener('inputreport',listener);Promise.resolve(this.device.sendReport(4,packet)).catch(fail);
   });
  }
  async command(command){return this.exchange(frame(command,this.wireless?24:56));}
  async transfer(command,length,data){const output=[],size=this.wireless?24:56;await this.command(1);try{for(let offset=0;offset<length;offset+=size){const count=Math.min(size,length-offset),reply=await this.exchange(frame(command,count,offset,data?.slice(offset,offset+count),this.wireless),data?0:count);if(!data)output.push(...reply.slice(7,7+count));}return new Uint8Array(output);}finally{if(!this.closed)await this.command(2);}}
  async close(){this.closed=true;this.pending?.(Error('设备页面已关闭'));if(this.owned&&this.device.opened)await this.device.close();}
 }
 class MouseSession{
  constructor(device,protocol,connection,options){this.device=device;this.protocol=protocol;this.connection=connection;this.transport=new Transport(device,connection.connectionType===2,options);this.queue=Promise.resolve();this.closed=false;}
  enqueue(operation){const promise=this.queue.then(()=>{if(this.closed)throw Error('设备页面已关闭');return operation();});this.queue=promise.catch(()=>{});return promise;}
  async identify(){if(this.connection.connectionType===2){const online=await this.transport.command(170);if(!online[7])throw Error('接收器已连接，鼠标尚未唤醒');}const info=await this.transport.transfer(3,10);if(info[7]!==this.connection.configId)throw Error('接收器中的实际型号与当前卡片不同');return info;}
  async readState(){await this.identify();const config=this.protocol.config,raw=await this.transport.transfer(5,config.profileSize),capabilities={},values={},errors={};
   const fields=config.functionZone.fields,dpi=config.dpi,at=key=>raw[fields[key].offset],rawIndices=[],stages=[];
   try{for(let i=0;i<dpi.count;i++){const offset=dpi.startOffset+i*dpi.bytesPerDpi;if(!raw[offset])continue;const x=raw[offset+2]|raw[offset+3]<<8,y=raw[offset+4]|raw[offset+5]<<8;integer(x,dpi.range.min,dpi.range.max,'DPI');integer(y,dpi.range.min,dpi.range.max,'DPI');rawIndices.push(i);stages.push([x,y]);}const active=rawIndices.indexOf(at('dpiRank'));if(active<0)throw Error('当前 DPI 档位未启用');values.dpi=stages[active];values.dpiStages={active:active+1,stages};capabilities.dpi={readable:true,writable:true,...dpi.range,separateAxes:raw[dpi.startOffset+rawIndices[active]*dpi.bytesPerDpi+1]===1};capabilities.dpiStages={readable:true,writable:true};}catch(error){errors.dpi=error.message;}
   const rateField=this.connection.connectionType===2?'reportRate1':'reportRate',rate=at(rateField);if(RATES[rate]){capabilities.pollRate={readable:true,writable:true,options:RATES.slice(fields[rateField].range.min,fields[rateField].range.max+1)};values.pollRate=RATES[rate];}
   if(config.features.lighting&&fields.brightness){const level=at('brightness'),maximum=fields.brightness.range.max;if(level<=maximum){capabilities.lighting={zones:{all:{brightness:{readable:true,writable:true,min:0,max:100,step:100/maximum}}}};values.brightness={all:level*100/maximum};}}
   if(this.connection.connectionType===2)try{const battery=await this.transport.command(26);integer(battery[7],0,100,'电量');capabilities.battery={readable:true,writable:false};values.battery=battery[7];}catch(error){errors.battery=error.message;}
   return {ok:true,connected:true,interfaceConfirmed:true,provider:'aula-webhid',verification:'unverified',capabilities,values,errors,_raw:{raw,rawIndices,rateField}};
  }
  status(){return this.enqueue(async()=>{const result=await this.readState();delete result._raw;return result;});}
  execute(command,value){return this.enqueue(async()=>{const before=await this.readState(),{raw,rawIndices,rateField}=before._raw,config=this.protocol.config,fields=config.functionZone.fields,dpi=config.dpi;let check;
   if(command==='dpi.set'){if(!before.capabilities.dpi)throw Error('设备未返回 DPI 设置');const pair=Array.isArray(value)?value:[value,value];if(pair.length!==2)throw Error('DPI 参数格式不正确');for(const n of pair){integer(n,dpi.range.min,dpi.range.max,'DPI');if((n-dpi.range.min)%dpi.range.step)throw Error('DPI 不符合设备步进');}const offset=dpi.startOffset+raw[fields.dpiRank.offset]*dpi.bytesPerDpi;if(!before.capabilities.dpi.separateAxes&&pair[0]!==pair[1])throw Error('当前设备使用联动 DPI');raw.set([pair[0]&255,pair[0]>>>8,pair[1]&255,pair[1]>>>8],offset+2);check=after=>after.values.dpi?.every((n,i)=>n===pair[i]);}
   else if(command==='dpiStage.set'){if(!before.capabilities.dpiStages)throw Error('设备未返回 DPI 档位');integer(value,1,rawIndices.length,'DPI 档位');raw[fields.dpiRank.offset]=rawIndices[value-1];check=after=>after.values.dpiStages?.active===value;}
   else if(command==='pollRate.set'){if(!before.capabilities.pollRate?.options.includes(value))throw Error('设备不支持此回报率');raw[fields[rateField].offset]=RATES.indexOf(value);check=after=>after.values.pollRate===value;}
   else if(command==='brightness.set'){if(value?.zone!=='all'||!before.capabilities.lighting)throw Error('设备未返回此灯区');const max=fields.brightness.range.max,level=Number(value.percent)*max/100;integer(level,0,max,'亮度');raw[fields.brightness.offset]=level;check=after=>after.values.brightness?.all===value.percent;}
   else throw Error('尚未接入此狼蛛设置');
   await this.transport.transfer(6,raw.length,raw);const after=await this.readState();delete after._raw;if(!check(after))throw Error('设备返回的设置与写入值不一致');return after;
  });}
  async close(){this.closed=true;await this.transport.close();await this.queue;}
 }
 function matching(device,protocol){return protocol.connections.find(c=>device.vendorId===c.vendorId&&device.productId===c.productId&&device.collections?.some(collection=>collection.usagePage===c.usagePage&&collection.usage===c.usage&&(collection.outputReports||[]).some(report=>report.reportId===4)));}
 function createApi({model,protocol=model.support,hid=globalThis.navigator?.hid,prepare=async()=>{},timeout}={}){
  const sessions=new Map(),ids=new WeakMap();let closed=false,next=0;
  const requireOpen=()=>{if(closed)throw Error('设备页面已关闭');if(!hid)throw Error('当前环境没有设备接口');};
  const metadata=(id,device)=>({id,modelId:model.id,name:model.name,brand:'aula',vendorId:device.vendorId,productId:device.productId});
  async function scan(){requireOpen();await prepare();requireOpen();const devices=await hid.getDevices();requireOpen();const output=[],seen=new Set(),errors=[];for(const device of devices){requireOpen();const connection=matching(device,protocol);if(!connection)continue;let id=ids.get(device);if(!id){id='aula-'+(++next);ids.set(device,id);}seen.add(id);let session=sessions.get(id);if(!session||session.transport.closed){session=new MouseSession(device,protocol,connection,{timeout});sessions.set(id,session);}try{await session.enqueue(()=>session.identify());requireOpen();output.push(metadata(id,device));}catch(error){if(closed)throw error;errors.push(error.message);}}for(const [id,session]of sessions)if(!seen.has(id)){await session.close();sessions.delete(id);}return {ok:true,devices:output,errors};}
  async function connect(){requireOpen();await prepare();requireOpen();await hid.requestDevice({filters:protocol.filters});requireOpen();return scan();}
  const selected=id=>{requireOpen();const session=sessions.get(id);if(!session)throw Error('设备已断开，请重新检测');return session;};
  async function status(id){const session=selected(id);return {...await session.status(),device:metadata(id,session.device)};}
  async function execute({deviceId,command,value}){const session=selected(deviceId);return {...await session.execute(command,value),device:metadata(deviceId,session.device)};}
  async function close(){closed=true;await Promise.allSettled([...sessions.values()].map(s=>s.close()));sessions.clear();}
  return {scan,connect,status,execute,close};
 }
 return {createApi,Transport,MouseSession,frame};
});
