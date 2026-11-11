/* MCHOSE 0x4D mouse protocol, reconstructed from the official web driver's
 * getCommandBuffer / mcReadCommand / mcSetCommand / mouseDiffConfig.
 * Source and exact model identities: catalog/mchose-protocols.json.
 * No vendor app, background heartbeat, firmware or reset operations are used. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.One4AllMchose=api;})(globalThis,function(){
  'use strict';
  const REPORT_ID=77,WIRELESS_PIDS=[4116,4120,4124,4118,4125];
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const normalize=name=>String(name||'').replace(/^Realtek\s+/i,'').replace(/^MCHOSE\s+/i,'').replace(/\s+/g,' ').trim().toLowerCase();
  function integer(value,min,max,label){if(!Number.isInteger(value)||value<min||value>max)throw Error(`${label}超出设备范围`);return value;}
  function bytes(value){if(value instanceof DataView)return new Uint8Array(value.buffer,value.byteOffset,value.byteLength);return Uint8Array.from(value);}
  function requireLength(value,length){const b=bytes(value);if(b.length<length)throw Error('迈从设备返回的数据不完整');return b;}
  function encodeRequest(command,data=[]){
    integer(command,0,65535,'命令');if(data.length>55)throw Error('迈从命令数据过长');
    const out=new Uint8Array(64);out.set([REPORT_ID,1,1,data.length,command&255,command>>>8,0,0]);
    data.forEach((n,i)=>{out[8+i]=integer(n,0,255,'命令参数');});
    let check=0;for(let i=2;i<=7+data.length;i++)check^=out[i];out[8+data.length]=check;
    return {reportId:REPORT_ID,data:out.slice(1)};
  }
  function decodeDeviceInfo(value){const b=requireLength(value,14);return {vendorId:b[0]|b[1]<<8,productId:b[2]|b[3]<<8,maxProfiles:b[4],connectStatus:b[10],charging:b[11],battery:b[12],gameMode:b[13]};}
  function decodePerformance(value){
    const b=requireLength(value,9),rate=n=>n>1?n-1:n;
    return {profileIndex:b[0],usbDpiIndex:b[1]&15,usbRateIndex:rate(b[1]>>>4),gRateIndex:rate(b[2]>>>4),sleep:b[3],sleepMode:b[4]&1,sensor:b[5],rotateVal:b[6],leftKeyDebounce:b[7],rightKeyDebounce:b[8]};
  }
  function encodePerformance(state){
    const rate=n=>n>0?n+1:n;
    const out=[state.profileIndex,(rate(state.usbRateIndex)<<4)|state.usbDpiIndex,(rate(state.gRateIndex)<<4)|state.usbDpiIndex,state.sleep,state.sleepMode,state.sensor,state.rotateVal,state.leftKeyDebounce,state.rightKeyDebounce,...new Array(10).fill(0)];
    out.forEach(n=>integer(n,0,255,'性能参数'));return out;
  }
  function decodeDpi(value){
    const b=requireLength(value,17),out={profileIndex:b[0],direction:b[1],count:b[2],active:b[3],hasY:b[4],stages:[]};
    integer(out.count,1,6,'DPI 档数');integer(out.active,0,out.count-1,'DPI 档位');integer(out.hasY,0,1,'DPI 轴');
    for(let i=0;i<6;i++)out.stages.push(b[5+2*i]|b[6+2*i]<<8);return out;
  }
  function encodeDpi(state){
    const out=[state.profileIndex,state.direction,state.hasY,state.count,state.active];
    for(const value of state.stages){integer(value,0,65535,'DPI');out.push(value&255,value>>>8);}
    if(state.stages.length!==6)throw Error('DPI 数据必须保留设备的六个档位');return out;
  }
  class MouseSession{
    constructor(device,protocol,{timeoutMs=1800}={}){this.device=device;this.protocol=protocol;this.timeoutMs=timeoutMs;this.queue=Promise.resolve();this.operations=Promise.resolve();this.closed=false;this.owned=!device.opened;}
    enqueue(operation){const promise=this.operations.then(operation,operation);this.operations=promise.catch(()=>{});return promise;}
    command(command,data=[]){
      const perform=async()=>{
        if(this.closed)throw Error('设备连接已关闭');if(!this.device.opened)await this.device.open();
        if(this.closed)throw Error('设备连接已关闭');
        const frame=encodeRequest(command,data);let listener,timer;
        try{return await new Promise((resolve,reject)=>{
          timer=setTimeout(()=>reject(Error('迈从设备没有响应，请检查连接')),this.timeoutMs);
          // The official waitCommand binds to this HIDDevice and matches the
          // command bytes; it does not assume the input report ID equals 0x4D.
          listener=event=>{const response=bytes(event.data);if(response.length<7||(response[3]|response[4]<<8)!==command)return;resolve(response.slice(7));};
          this.device.addEventListener('inputreport',listener);
          Promise.resolve().then(()=>this.device.sendReport(frame.reportId,frame.data)).catch(reject);
        });}finally{clearTimeout(timer);if(listener)this.device.removeEventListener('inputreport',listener);}
      };
      const promise=this.queue.then(perform,perform);this.queue=promise.catch(()=>{});return promise;
    }
    async read(command,data=[]){for(let attempt=0;attempt<=4;attempt++){const response=await this.command(command,data);if(response[0]!==255)return response;if(attempt===4)throw Error('迈从设备暂时无法读取配置');await sleep(30);}}
    async identify(){
      const info=decodeDeviceInfo(await this.read(0x0900)),p=this.protocol;
      const exact=info.productId===p.wiredProductId;
      const named=normalize(this.device.productName)===normalize(p.name)&&p.productIds.includes(info.productId);
      if(info.vendorId!==p.vendorId||(!exact&&!named))throw Error('接收器返回的实际型号与当前卡片不同');
      if(WIRELESS_PIDS.includes(this.device.productId)&&info.battery===0)throw Error('接收器已连接，鼠标尚未唤醒');
      return info;
    }
    async readState(){
      const info=await this.identify(),errors={},capabilities={},values={};
      if(info.battery<=100){capabilities.battery={readable:true,writable:false};values.battery=info.battery;values.charging=info.charging===1;}
      let performance,x,y;
      try{
        performance=decodePerformance(await this.read(0x0002));integer(performance.profileIndex,0,2,'板载配置');
        const rates=this.protocol.rates[this.protocol.productIds.indexOf(this.device.productId)]||this.protocol.rates[0];
        if(rates[performance.usbRateIndex]!==undefined){capabilities.pollRate={readable:true,writable:true,options:rates};values.pollRate=rates[performance.usbRateIndex];}
        if(performance.leftKeyDebounce>=1&&performance.leftKeyDebounce<=20&&performance.rightKeyDebounce>=1&&performance.rightKeyDebounce<=20){capabilities.debounce={readable:true,writable:true,min:1,max:20,step:1};values.debounce=[performance.leftKeyDebounce,performance.rightKeyDebounce];}
        if(info.maxProfiles>0&&info.maxProfiles<=3){capabilities.profiles={readable:true,writable:true,options:Array.from({length:info.maxProfiles},(_,i)=>i+1)};values.profile=performance.profileIndex+1;}
        try{
          x=decodeDpi(await this.read(0x0003,[performance.profileIndex,0]));
          if(x.profileIndex!==performance.profileIndex||x.direction!==0)throw Error('DPI 配置与当前板载配置不同');
          if(x.hasY){y=decodeDpi(await this.read(0x0003,[performance.profileIndex,1]));if(y.profileIndex!==x.profileIndex||y.direction!==1||y.count!==x.count||y.active!==x.active)throw Error('DPI 两轴配置不一致');}
          const stages=x.stages.slice(0,x.count).map((n,i)=>[n,y?y.stages[i]:n]);
          for(const stage of stages)for(const n of stage)integer(n,this.protocol.dpiMin,this.protocol.dpiMax,'DPI');
          capabilities.dpi={readable:true,writable:true,min:this.protocol.dpiMin,max:this.protocol.dpiMax,step:1,separateAxes:!!x.hasY};
          capabilities.dpiStages={readable:true,writable:true};values.dpi=stages[x.active];values.dpiStages={active:x.active+1,stages};
        }catch(error){errors.dpi=error.message;}
      }catch(error){errors.performance=error.message;}
      return {ok:true,connected:true,interfaceConfirmed:true,provider:'mchose-webhid',verification:'unverified',hardwareVerified:false,capabilities,values,errors,_raw:{info,performance,x,y}};
    }
    status(){return this.enqueue(async()=>{const state=await this.readState();delete state._raw;return state;});}
    execute(command,value){return this.enqueue(async()=>{
      // Always read first: writes preserve the existing profile and unrelated fields.
      const before=await this.readState(),{performance,x,y}=before._raw;let check;
      if(command==='dpi.set'){
        if(!before.capabilities.dpi)throw Error('设备尚未提供 DPI 接口');
        const pair=Array.isArray(value)?value:[value,value];if(pair.length!==2)throw Error('DPI 参数格式不正确');
        pair.forEach(n=>integer(n,this.protocol.dpiMin,this.protocol.dpiMax,'DPI'));
        if(!x.hasY&&pair[0]!==pair[1])throw Error('设备未启用独立的 X/Y 轴 DPI');
        await this.command(0x0104,[performance.profileIndex,x.active,0,pair[0]&255,pair[0]>>>8]);
        if(x.hasY)await this.command(0x0104,[performance.profileIndex,x.active,1,pair[1]&255,pair[1]>>>8]);
        check=state=>state.values.dpi?.every((n,i)=>n===pair[i]);
      }else if(command==='dpiStage.set'){
        if(!before.capabilities.dpiStages)throw Error('设备尚未提供 DPI 档位接口');integer(value,1,x.count,'DPI 档位');
        await this.command(0x0103,encodeDpi({...x,active:value-1}));
        if(y)await this.command(0x0103,encodeDpi({...y,active:value-1}));
        check=state=>state.values.dpiStages?.active===value;
      }else if(command==='pollRate.set'){
        const options=before.capabilities.pollRate?.options;if(!options?.includes(value))throw Error('设备不支持这个回报率');
        const index=options.indexOf(value);await this.command(0x0102,encodePerformance({...performance,usbRateIndex:index,gRateIndex:index}));
        check=state=>state.values.pollRate===value;
      }else if(command==='debounce.set'){
        if(!before.capabilities.debounce)throw Error('设备尚未提供按键消抖接口');
        const pair=Array.isArray(value)?value:[value,value];if(pair.length!==2)throw Error('消抖参数格式不正确');pair.forEach(n=>integer(n,1,20,'消抖时间'));
        await this.command(0x0102,encodePerformance({...performance,leftKeyDebounce:pair[0],rightKeyDebounce:pair[1]}));check=state=>state.values.debounce?.every((n,i)=>n===pair[i]);
      }else if(command==='profile.set'){
        if(!before.capabilities.profiles?.options.includes(value))throw Error('设备不支持这个板载配置');
        await this.command(0x0906,[value-1]);check=state=>state.values.profile===value;
      }else throw Error('不支持的迈从控制操作');
      const after=await this.readState();delete after._raw;
      if(!check(after))throw Error('设备已应答，但重新读取的设置不一致，请重新检测');
      return after;
    });}
    async close(){this.closed=true;await this.operations;await this.queue;if(this.owned&&this.device.opened)await this.device.close();}
  }
  function hasInterface(device,protocol){
    if(device.vendorId!==protocol.vendorId||!protocol.productIds.includes(device.productId))return false;
    const visit=collections=>(collections||[]).some(c=>(protocol.usagePages.includes(c.usagePage)&&(c.outputReports||[]).some(r=>r.reportId===REPORT_ID))||visit(c.children));
    return visit(device.collections);
  }
  function createApi({model,protocol=model.support,hid=globalThis.navigator?.hid,prepare=async()=>{},timeoutMs}={}){
    if(!protocol||protocol.protocol!=='mchose-mouse-4d-v1')throw Error('此型号尚未接入迈从控制协议');
    const sessions=new Map(),ids=new WeakMap();let next=0,closed=false;
    function ensureActive(){if(closed)throw Error('控制页面已关闭');}
    const filters=protocol.productIds.flatMap(productId=>protocol.usagePages.map(usagePage=>({vendorId:protocol.vendorId,productId,usagePage})));
    const metadata=(id,device)=>({id,modelId:model.id,name:model.name,brand:'mchose',kind:'mouse',vendorId:device.vendorId,productId:device.productId,connected:true,verification:'unverified',hardwareVerified:false});
    async function scan(){
      if(!hid)throw Error('当前运行环境没有设备接口');ensureActive();
      await prepare(model.id);
      ensureActive();const available=await hid.getDevices();ensureActive();
      const devices=[],errors=[],seen=new Set();
      for(const device of available){
        ensureActive();
        if(!hasInterface(device,protocol))continue;
        let id=ids.get(device);if(!id){id='mchose-'+(++next);ids.set(device,id);}seen.add(id);
        let session=sessions.get(id);if(!session){session=new MouseSession(device,protocol,{timeoutMs});sessions.set(id,session);}
        try{await session.enqueue(()=>session.identify());ensureActive();devices.push(metadata(id,device));}catch(error){ensureActive();errors.push(error.message);}
      }
      for(const [id,session]of sessions)if(!seen.has(id)){await session.close().catch(()=>{});sessions.delete(id);}
      return {ok:true,devices,errors};
    }
    async function connect(){if(!hid)throw Error('当前运行环境没有设备接口');ensureActive();await prepare(model.id);ensureActive();await hid.requestDevice({filters});ensureActive();return scan();}
    function sessionFor(id){const session=sessions.get(id);if(!session)throw Error('设备已断开，请重新检测');return session;}
    async function status(id){const session=sessionFor(typeof id==='object'?id.deviceId:id);return {...await session.status(),device:metadata(typeof id==='object'?id.deviceId:id,session.device)};}
    async function execute({deviceId,command,value}){const session=sessionFor(deviceId);return {...await session.execute(command,value),device:metadata(deviceId,session.device)};}
    async function close(){closed=true;await Promise.allSettled([...sessions.values()].map(session=>session.close()));sessions.clear();}
    return {scan,status,execute,connect,close,scanRazer:scan,razerStatus:status,razerExecute:execute};
  }
  return {createApi,MouseSession,encodeRequest,decodeDeviceInfo,decodePerformance,encodePerformance,decodeDpi,encodeDpi,hasInterface};
});
