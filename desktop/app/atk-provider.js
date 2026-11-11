/* ATK HUB 3.2.32 COMPX protocol. Exact source/model fingerprints are in
 * catalog/atk-protocols.json. Direct WebHID; no vendor app or background loop. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.One4AllAtk=api;})(globalThis,function(){
 'use strict';
 const RATES={125:8,250:4,500:2,1000:1,2000:16,4000:32,8000:64};
 const LIMITS={PAW3955MASTER:[1,50000,1],PAW3950Ultra:[10,42000,10],PAW3950:[50,36000,50],PAW3950DM:[50,36000,50],PAW3395:[100,30000,50],PAW3395Ultra:[100,30000,50],CORE26K:[50,26000,50],PAW3315:[200,16000,100],PAW3395SE:[200,18000,50],PAW3311:[200,15000,100]};
 const integer=(v,min,max,label)=>{if(!Number.isInteger(v)||v<min||v>max)throw Error(label+'超出设备范围');return v;};
 const bytes=value=>value instanceof DataView?new Uint8Array(value.buffer,value.byteOffset,value.byteLength):Uint8Array.from(value);
 const complement=value=>(85-value)&255;
 function encodeRequest(command,{address=0,data=[],length=data.length}={}){integer(command,0,255,'命令');integer(address,0,65535,'地址');integer(length,0,10,'长度');if(data.length>length)throw Error('命令数据过长');const b=new Uint8Array(16);b[0]=command;b[2]=address>>>8;b[3]=address&255;b[4]=length;b.set(data,5);b[15]=complement(8+b.slice(0,15).reduce((a,n)=>a+n,0));return b;}
 function decodeDpi(data,sensor,tables={}){const [x,y,flags]=data;
  if(sensor==='PAW3955MASTER'){const xBase=x|(y<<8),yBase=flags|(data[3]<<8),f=data[4];return [(xBase+1)*(f&1?2:1),(yBase+1)*(f&16?2:1)];}
  const lo=[x|((flags&12)>>2)<<8,y|((flags&192)>>6)<<8];
  if(sensor==='PAW3950Ultra')return lo.map((v,i)=>{const f=flags>>(i*4);return (f&2?v*50+10050:(v+1)*10)*(f&1?2:1);});
  if(['PAW3950','PAW3950DM','PAW3395Ultra','PAW3395'].includes(sensor))return lo.map((v,i)=>(v+1)*50*(flags&(1<<(i*4))?2:1));
  if(sensor==='CORE26K')return lo.map((v,i)=>{const f=flags>>(i*4);return (v+1)*(f&2?100:50)*(f&1?2:1);});
  const table=sensor==='PAW3315'?tables.je:tables.Ze;if(!table)throw Error('缺少该传感器的官方 DPI 表');
  return [x,y].map((value,i)=>{const row=table.find(r=>r.hex===value);if(!row)throw Error('设备返回未知 DPI 编码');return flags&(2<<(i*4))?row.double:row.target;});
 }
 function encodeDpi(pair,sensor,tables={},bounds){const [min,max]=bounds||LIMITS[sensor]||[];if(min===undefined)throw Error('未知传感器');pair.forEach(n=>integer(n,min,max,'DPI'));let data;
  if(sensor==='PAW3955MASTER'){const out=pair.map(n=>{const multiple=n>=40000;if(multiple&&n%2)throw Error('该档位 DPI 必须为偶数');return {base:n/(multiple?2:1)-1,multiple};});data=[out[0].base&255,out[0].base>>>8,out[1].base&255,out[1].base>>>8,(out[0].multiple?1:0)|(out[1].multiple?16:0)];}
  else if(['PAW3950Ultra','PAW3950','PAW3950DM','PAW3395Ultra','PAW3395','CORE26K'].includes(sensor)){let flags=0;const raw=pair.map((n,i)=>{let v,extra=0;if(sensor==='PAW3950Ultra'){if(n>10000){v=(n>30000?n/2:n)-10050;v/=50;extra=2|(n>30000?1:0);}else v=n/10-1;}else if(sensor==='CORE26K')v=n/50-1;else{v=n/(n>30000?100:50)-1;extra=n>30000?1:0;}integer(v,0,1023,'DPI 步长');flags|=(((v>>8)&3)<<2|extra)<<(i*4);return v&255;});data=[...raw,flags];}
  else {const table=sensor==='PAW3315'?tables.je:tables.Ze;let flags=0;data=pair.map((value,i)=>{const row=table?.find(row=>row.target===value||row.double===value);if(!row)throw Error('DPI 不在该传感器的官方档位表中');if(row.double===value)flags|=2<<(i*4);return row.hex;});data.push(flags);}
  const decoded=decodeDpi(data,sensor,tables);if(decoded.some((n,i)=>n!==pair[i]))throw Error('该 DPI 不能被设备精确表示');return [...data,complement(data.reduce((a,n)=>a+n,0))];
 }
 function hasInterface(device,protocol){return protocol.filters.some(f=>f.vendorId===device.vendorId&&f.productId===device.productId&&(device.collections||[]).some(c=>c.usagePage===f.usagePage&&c.usage===f.usage&&(c.outputReports||[]).some(r=>r.reportId===8)));}
 class MouseSession{
  constructor(device,protocol,{timeoutMs=1500}={}){this.device=device;this.catalogProtocol=protocol;this.protocol=protocol;this.timeoutMs=timeoutMs;this.queue=Promise.resolve();this.closed=false;this.broken=false;this.owned=!device.opened;}
  enqueue(fn){const p=this.queue.then(fn,fn);this.queue=p.catch(()=>{});return p;}
  async command(command,options={}){if(this.closed||this.broken)throw Error('设备连接已关闭，请重新连接');if(!this.device.opened)await this.device.open();if(this.closed)throw Error('控制页面已关闭');const request=encodeRequest(command,options);let listener,timer;
   try{return await new Promise((resolve,reject)=>{listener=event=>{if(event.reportId!==8)return;const b=bytes(event.data);if(b.length<16||b[0]!==command)return;if([7,8].includes(command)&&(b[2]!==request[2]||b[3]!==request[3]))return;if(b[1]!==0)return reject(Error('设备拒绝此操作（'+b[1]+'）'));resolve(b.slice(0,16));};timer=setTimeout(()=>{this.broken=true;reject(Error('设备没有响应，请唤醒鼠标后重新连接'));},this.timeoutMs);this.device.addEventListener('inputreport',listener);Promise.resolve().then(()=>this.device.sendReport(8,request)).catch(reject);});}finally{clearTimeout(timer);if(listener)this.device.removeEventListener('inputreport',listener);}}
  async identify(){const catalog=this.catalogProtocol;this.hardwareProfile=null;if(catalog.filters.some(f=>f.vendorId===this.device.vendorId&&f.productId===this.device.productId&&f.receiver)){const online=await this.command(3);if(online[5]!==1)throw Error('接收器已连接，鼠标尚未唤醒');}const legacy=catalog.identityCommand===1,b=legacy?await this.handshake():await this.command(16),offset=legacy?9:5,cidMid=[b[offset],b[offset+1]],profile=(catalog.hardwareProfiles||[catalog]).find(p=>(p.cidMids||[p.cidMid]).some(pair=>pair[0]===cidMid[0]&&pair[1]===cidMid[1]));if(!profile)throw Error('实际鼠标型号与当前卡片不同');this.protocol={...catalog,...profile,filters:catalog.filters,cidMid};this.hardwareProfile={id:profile.id||catalog.modelId,cidMid,sensor:profile.sensor};return b;}
  async handshake(){const random=new Uint8Array(4);globalThis.crypto?.getRandomValues?.(random);return this.command(1,{data:random,length:8});}
  async read(address,length){return (await this.command(8,{address,length})).slice(5,5+length);}
  async write(address,data){await this.command(7,{address,data});}
  async readState(){await this.identify();const capabilities={},values={},errors={},raw={};const attempt=async(key,fn)=>{try{await fn();}catch(error){errors[key]=error.message;}};
   await attempt('firmware',async()=>{const b=await this.command(18);values.firmware=b[5].toString(16)+'.'+b[6].toString(16).padStart(2,'0');});
   await attempt('battery',async()=>{const b=await this.command(4);integer(b[5],0,100,'电量');capabilities.battery={readable:true,writable:false};values.battery=b[5];values.charging=b[6]===1;});
   await attempt('connection',async()=>{const b=await this.handshake();raw.connection=b[11];});
   await attempt('performance',async()=>{const b=await this.read(0,10);raw.performance=b;if(b[1]!==complement(b[0])||b[3]!==complement(b[2])||b[5]!==complement(b[4]))throw Error('性能配置校验不符');const max=({0:1000,1:4000,2:1000,3:8000,4:2000,5:8000,6:2000,7:4000})[raw.connection],rate=Number(Object.keys(RATES).find(hz=>RATES[hz]===b[0]));if(rate){capabilities.pollRate={readable:true,writable:!!max,options:Object.keys(RATES).map(Number).filter(hz=>hz<=max)};values.pollRate=rate;}
    integer(b[2],1,8,'DPI 档数');integer(b[4],0,b[2]-1,'DPI 档位');
    const stages=[];raw.dpi=[];const master=this.protocol.sensor==='PAW3955MASTER';for(let index=0;index<b[2];index++){const address=master?6912+index*6:12+Math.floor(index/2)*8,length=master?6:8;let block=raw.dpi.find(row=>row.address===address);if(!block){block={address,data:await this.read(address,length)};raw.dpi.push(block);}const offset=master?0:(index%2)*4,unit=block.data.slice(offset,offset+(master?6:4));if(unit.at(-1)!==complement(unit.slice(0,-1).reduce((a,n)=>a+n,0)))throw Error('DPI 配置校验不符');const pair=decodeDpi(unit,this.protocol.sensor,this.protocol.dpiTables);pair.forEach(n=>integer(n,1,50000,'DPI'));stages.push(pair);}
    const [min,maxDpi,step]=this.protocol.dpiBounds||LIMITS[this.protocol.sensor]||[];if(min===undefined)throw Error('此传感器尚未接入');capabilities.dpi={readable:true,writable:true,min,max:maxDpi,step,separateAxes:this.protocol.separateAxes!==false};capabilities.dpiStages={readable:true,writable:true};values.dpi=stages[b[4]];values.dpiStages={active:b[4]+1,stages};
   });
   return {ok:true,connected:true,interfaceConfirmed:true,provider:'atk-webhid',verification:'unverified',hardwareVerified:false,hardwareProfile:this.hardwareProfile,capabilities,values,errors,_raw:raw};
  }
  status(){return this.enqueue(async()=>{const r=await this.readState();delete r._raw;return r;});}
  execute(command,value){return this.enqueue(async()=>{const before=await this.readState();let check;
   if(command==='dpi.set'){if(!before.capabilities.dpi?.writable)throw Error('DPI 接口尚未就绪');const pair=Array.isArray(value)?value:[value,value];if(pair.length!==2)throw Error('DPI 参数错误');if(this.protocol.separateAxes===false&&pair[0]!==pair[1])throw Error('设备只支持联动 X/Y DPI');const encoded=encodeDpi(pair,this.protocol.sensor,this.protocol.dpiTables,this.protocol.dpiBounds),index=before.values.dpiStages.active-1,master=this.protocol.sensor==='PAW3955MASTER',address=master?6912+index*6:12+Math.floor(index/2)*8,block=before._raw.dpi.find(x=>x.address===address),data=block.data.slice();data.set(encoded,master?0:index%2*4);await this.write(address,data);check=state=>state.values.dpi?.every((n,i)=>n===pair[i]);}
   else if(command==='pollRate.set'||command==='dpiStage.set'){const b=before._raw.performance?.slice();if(!b)throw Error('性能配置尚未就绪');if(command==='pollRate.set'){if(!before.capabilities.pollRate?.writable||!before.capabilities.pollRate.options.includes(value))throw Error('设备不支持该回报率');b[0]=RATES[value];b[1]=complement(b[0]);check=s=>s.values.pollRate===value;}else{if(!before.capabilities.dpiStages?.writable)throw Error('DPI 档位尚未就绪');integer(value,1,b[2],'DPI 档位');b[4]=value-1;b[5]=complement(b[4]);check=s=>s.values.dpiStages?.active===value;}await this.write(0,b);}
   else throw Error('尚未开放此控制操作');const after=await this.readState();delete after._raw;if(!check(after))throw Error('设备读回值与设定不一致，请重新检测');return after;
  });}
  async close(){this.closed=true;await this.queue;if(this.owned&&this.device.opened)await this.device.close();}
 }
 function createApi({model,protocol=model.support,hid=globalThis.navigator?.hid,prepare=async()=>{},timeoutMs}={}){if(protocol?.protocol!=='atk-compx-v1')throw Error('尚未接入该型号协议');const sessions=new Map(),ids=new WeakMap();let counter=0,closed=false;const check=()=>{if(closed)throw Error('控制页面已关闭');};const meta=(id,device)=>({id,modelId:model.id,name:model.name,brand:model.brand,vendorId:device.vendorId,productId:device.productId});
  async function scan(){check();if(!hid)throw Error('当前环境没有 HID 接口');await prepare(model.id);check();const found=await hid.getDevices();check();const devices=[],errors=[];for(const device of found){check();if(!hasInterface(device,protocol))continue;let id=ids.get(device);if(!id){id='atk-'+(++counter);ids.set(device,id);}let session=sessions.get(id);if(session?.broken){await session.close().catch(()=>{});sessions.delete(id);session=null;}check();if(!session){session=new MouseSession(device,protocol,{timeoutMs});sessions.set(id,session);}try{await session.enqueue(()=>session.identify());check();devices.push(meta(id,device));}catch(error){errors.push(error.message);}}return {ok:true,devices,errors};}
  async function connect(){check();if(!hid)throw Error('当前环境没有 HID 接口');await prepare(model.id);check();await hid.requestDevice({filters:protocol.filters.map(({vendorId,productId,usagePage,usage})=>({vendorId,productId,usagePage,usage}))});check();return scan();}
  const get=id=>{check();const session=sessions.get(id);if(!session)throw Error('设备已断开，请重新连接');return session;};
  return {scan,connect,async status(id){const session=get(id);return {...await session.status(),device:meta(id,session.device)};},async execute({deviceId,command,value}){const session=get(deviceId);return {...await session.execute(command,value),device:meta(deviceId,session.device)};},async close(){closed=true;await Promise.allSettled([...sessions.values()].map(s=>s.close()));sessions.clear();}};
 }
 return {createApi,MouseSession,encodeRequest,decodeDpi,encodeDpi,hasInterface};
});
