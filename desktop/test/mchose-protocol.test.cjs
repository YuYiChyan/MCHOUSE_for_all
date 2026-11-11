'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const protocol=require('../app/mchose-provider.js'),manifest=require('../catalog/mchose-protocols.json');
const model=manifest.models.find(m=>m.name==='A7 V3');
const performance={profileIndex:0,usbDpiIndex:1,usbRateIndex:2,gRateIndex:2,sleep:3,sleepMode:0,sensor:18,rotateVal:4,leftKeyDebounce:8,rightKeyDebounce:9};
const dpi={profileIndex:0,direction:0,count:3,active:1,hasY:1,stages:[400,800,1600,3200,6400,26000]};

test('0x4D request golden vectors preserve command endian, report boundary and XOR',()=>{
  const read=protocol.encodeRequest(0x0900);assert.equal(read.reportId,77);assert.equal(read.data.length,63);
  assert.deepEqual([...read.data.slice(0,8)],[1,1,0,0,9,0,0,8]);
  const write=protocol.encodeRequest(0x0104,[0,1,0,0x40,6]);
  assert.deepEqual([...write.data.slice(0,13)],[1,1,5,4,1,0,0,0,1,0,64,6,70]);
});
test('performance encoding preserves all unrelated fields and the skipped report-rate index',()=>{
  const wire=protocol.encodePerformance(performance);assert.deepEqual(wire,[0,0x31,0x31,3,0,18,4,8,9,0,0,0,0,0,0,0,0,0,0]);
  assert.deepEqual(protocol.decodePerformance(wire),performance);
  const encoded=protocol.encodeDpi(dpi);assert.deepEqual(encoded.slice(0,9),[0,0,1,3,1,0x90,1,0x20,3]);
  // The official read and write layouts intentionally differ at bytes 2..4.
  const read=[encoded[0],encoded[1],encoded[3],encoded[4],encoded[2],...encoded.slice(5)];
  assert.deepEqual(protocol.decodeDpi(read),dpi);
});

const officialFile=path.join(process.env.LOCALAPPDATA||'','One4All-Desktop/vendor-resources/mchose/source/app.js');
test('encoders match the cached official driver functions byte for byte',{skip:!fs.existsSync(officialFile)},async()=>{
  const source=fs.readFileSync(officialFile,'utf8');
  assert.equal(require('node:crypto').createHash('sha256').update(source).digest('hex'),manifest.source.sha256);
  function extract(name){const start=source.indexOf(name+'='),arrow=source.indexOf('=>{',start);assert.ok(start>=0&&arrow-start<200);let depth=1,quote='',escape=false,end=arrow+3;
    for(;depth&&end<source.length;end++){const ch=source[end];if(quote){if(escape)escape=false;else if(ch==='\\')escape=true;else if(ch===quote)quote='';}else if('"\'`'.includes(ch))quote=ch;else if(ch==='{')depth++;else if(ch==='}')depth--;}
    return vm.runInNewContext('('+source.slice(start+name.length+1,end)+')',{calculateXorSum:(b,start,end)=>Array.from(b.slice(start,end+1)).reduce((a,n)=>a^n,0),console:{log(){}}},{timeout:1000});
  }
  const officialFrame=extract('getCommandBuffer'),officialPerformance=extract('allInfoToArr'),officialDpi=extract('dpiToArr'),officialSingle=extract('setSingleDpi');
  for(const command of [0x0900,0x0002,0x0003,0x0102,0x0103,0x0104,0x0906])for(const data of [[],[0,1],[0,1,0,64,6]]){
    const actual=protocol.encodeRequest(command,data),expected=await officialFrame({commandId:command,data});assert.deepEqual([actual.reportId,...actual.data],[...expected]);
  }
  assert.deepEqual(protocol.encodePerformance(performance),Array.from(officialPerformance(performance)));
  const sourceDpi={profileIndex:0,dpiDirection:0,dpiHasY:1,dpiSum:3,usbDpiIndex:1,...Object.fromEntries(dpi.stages.map((n,i)=>['dpi'+i,n]))};
  assert.deepEqual(protocol.encodeDpi(dpi),Array.from(officialDpi(sourceDpi)));
  assert.deepEqual(Array.from(officialSingle({profileIndex:0,dpiIndex:1,dpiDirection:0,dpiValue:1600})),[0,1,0,64,6]);
});

class FakeDevice extends EventTarget{
  constructor({pid=model.wiredProductId,reportedPid=model.wiredProductId,suppress=false}={}){super();this.vendorId=model.vendorId;this.productId=pid;this.productName='MCHOSE A7 V3';this.collections=[{usagePage:65281,outputReports:[{reportId:77}]}];this.opened=false;this.commands=[];this.writes=[];this.reportedPid=reportedPid;this.suppress=suppress;this.performance={...performance};this.x={...dpi,stages:[...dpi.stages]};this.y={...dpi,direction:1,stages:[...dpi.stages]};this.listeners=new Set();}
  addEventListener(type,listener,...args){if(type==='inputreport')this.listeners.add(listener);return super.addEventListener(type,listener,...args);}
  removeEventListener(type,listener,...args){this.listeners.delete(listener);return super.removeEventListener(type,listener,...args);}
  async open(){this.opened=true;}async close(){this.opened=false;}
  async sendReport(reportId,raw){assert.equal(reportId,77);const b=Uint8Array.from(raw),command=b[3]|b[4]<<8,data=b.slice(7,7+b[2]);this.commands.push(command);let result=[];
    if(command===0x0900)result=[0x37,0x38,this.reportedPid&255,this.reportedPid>>>8,3,0,0,0,0,0,1,0,90,0];
    else if(command===0x0002)result=protocol.encodePerformance(this.performance);
    else if(command===0x0003){const d=data[1]===1?this.y:this.x;result=[this.performance.profileIndex,d.direction,d.count,d.active,d.hasY,...d.stages.flatMap(n=>[n&255,n>>>8])];}
    else{this.writes.push({command,data:[...data]});if(command===0x0102)this.performance=protocol.decodePerformance(data);else if(command===0x0104)(data[2]?this.y:this.x).stages[data[1]]=data[3]|data[4]<<8;else if(command===0x0103){const d=data[1]?this.y:this.x;d.active=data[4];d.count=data[3];}else if(command===0x0906)this.performance.profileIndex=data[0];else throw Error('Unexpected write');}
    if(this.suppress)return;const response=Uint8Array.from([1,1,result.length,command&255,command>>>8,0,0,...result]);
    queueMicrotask(()=>{const e=new Event('inputreport');e.reportId=77;e.data=new DataView(response.buffer);this.dispatchEvent(e);});
  }
}
test('scan and status only read; every setting change is read back and preserves independent fields',async()=>{
  const device=new FakeDevice(),session=new protocol.MouseSession(device,model);
  const initial=await session.status();assert.equal(initial.values.pollRate,1000);assert.deepEqual(initial.values.dpi,[800,800]);assert.equal(initial.values.battery,90);assert.equal(device.writes.length,0);
  const result=await session.execute('dpi.set',[1200,1400]);assert.deepEqual(result.values.dpi,[1200,1400]);assert.deepEqual(device.x.stages,[400,1200,1600,3200,6400,26000]);
  assert.equal((await session.execute('pollRate.set',4000)).values.pollRate,4000);assert.equal(device.performance.sensor,18);assert.equal(device.performance.rotateVal,4);assert.equal(device.performance.leftKeyDebounce,8);
  assert.equal((await session.execute('dpiStage.set',3)).values.dpiStages.active,3);
  assert.deepEqual((await session.execute('debounce.set',[2,3])).values.debounce,[2,3]);
  assert.equal((await session.execute('profile.set',2)).values.profile,2);
  const writes=device.writes.length;await assert.rejects(session.execute('pollRate.set',123),'unsupported rate');assert.equal(device.writes.length,writes);
  assert.equal(device.listeners.size,0);await session.close();assert.equal(device.opened,false);
});
test('shared receiver identity cannot claim a different card; scan does not request access',async()=>{
  const device=new FakeDevice({pid:4116,reportedPid:16433});device.productName='MCHOSE A7 V3 Pro';let requests=0,prepared=0;
  const api=protocol.createApi({model:{id:'a7-v3',name:'A7 V3',support:model},prepare:async()=>prepared++,hid:{getDevices:async()=>[device],requestDevice:async()=>{requests++;return [device];}}});
  assert.equal((await api.scan()).devices.length,0);assert.equal(requests,0);assert.equal(prepared,1);assert.equal(device.writes.length,0);await api.close();
});
test('timeouts remove listeners and let the next command proceed',async()=>{
  const device=new FakeDevice({suppress:true}),session=new protocol.MouseSession(device,model,{timeoutMs:5});
  await assert.rejects(session.command(0x0900),/没有响应/);assert.equal(device.listeners.size,0);device.suppress=false;
  assert.equal((await session.identify()).productId,model.wiredProductId);await session.close();
});
test('catalog distinguishes legacy and current protocols without broad brand matching',()=>{
  const {getMchoseSupport}=require('../core/mchose-models.cjs');
  assert.equal(getMchoseSupport({brand:'mchose',kind:'mouse',name:'M7 Ultra'}),null);
  assert.equal(getMchoseSupport({brand:'mchose',kind:'mouse',name:'A7 V3'}).wiredProductId,16432);
  assert.equal(manifest.models.length,23);
});
test('closing during permission or enumeration never creates or opens a late session',async()=>{
  for(const stage of ['prepare','getDevices','requestDevice']){
    const device=new FakeDevice();let release,entered;const ready=new Promise(resolve=>entered=resolve),pending=new Promise(resolve=>release=resolve);
    const wait=async value=>{entered();await pending;return value;};
    const api=protocol.createApi({model:{id:'a7-v3',name:'A7 V3',support:model},prepare:stage==='prepare'?()=>wait():async()=>{},hid:{getDevices:stage==='getDevices'?()=>wait([device]):async()=>[device],requestDevice:()=>wait([device])}});
    const operation=stage==='requestDevice'?api.connect():api.scan();const rejected=assert.rejects(operation,/已关闭/);
    await ready;await api.close();release();await rejected;assert.equal(device.opened,false);assert.equal(device.commands.length,0);
  }
});
test('input reports match command bytes without assuming the output report ID',async()=>{
  const device=new FakeDevice({suppress:true}),session=new protocol.MouseSession(device,model,{timeoutMs:100});
  const pending=session.command(0x0900);await new Promise(resolve=>setImmediate(resolve));
  const report=new Event('inputreport');report.reportId=78;report.data=new DataView(Uint8Array.from([1,1,2,0,9,0,0,55,56]).buffer);device.dispatchEvent(report);
  assert.deepEqual([...await pending],[55,56]);await session.close();
});
