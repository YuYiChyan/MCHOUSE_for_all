'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createApi,Handle,MouseSession,frame,normalizeResponse}=require('../app/dareu-provider.js');
const catalog=require('../catalog/dareu-protocols.json');
const model=catalog.models.find(m=>m.name==='A980 PRO'),entry=model.support.models[0];
const officialSource=path.join(process.env.LOCALAPPDATA||'', 'One4All-Desktop/vendor-resources/dareu/source/tgdevice.js');
class Device{
 constructor(pid=entry.productId,reportId=entry.reportId){this.vendorId=9741;this.productId=pid;this.opened=false;this.collections=[{usagePage:65282,featureReports:[{reportId}]}];this.frames=[];this.active=1;this.stages=[[800,900],[1600,1700],[3200,3300]];this.rate=1;this.childPid=entry.productId;}
 async open(){this.opened=true;}async close(){this.opened=false;}
 async sendFeatureReport(id,data){this.frames.push({id,data:Array.from(data)});this.last=Uint8Array.from(data);if(data[2]===4&&data[3]===3){this.active=data[8];this.stages=Array.from({length:data[7]},(_,i)=>[(data[9+4*i]<<8)|data[10+4*i],(data[11+4*i]<<8)|data[12+4*i]]);}if(data[2]===0&&data[3]===4)this.rate=data[7];}
 async receiveFeatureReport(){const b=Uint8Array.from(this.last);b[0]|=2;
  if(b[2]===0&&b[3]===128)b.set([1,2,3],6);
  if(b[2]===5&&b[3]===131)b[4]=1;
  if(b[2]===4&&b[3]===128)b.set([1,9,0x65,0x90,50,1,0,0],6);
  if(b[2]===4&&b[3]===131){b.set([1,this.stages.length,this.active],6);this.stages.flat().forEach((n,i)=>b.set([n>>8,n&255],9+i*2));}
  if(b[2]===0&&b[3]===132)b.set([0,this.rate],6);
  if(b[2]===7&&b[3]===128)b.set([0,75,100,10],6);
  if(b[2]===0&&b[3]===160)b.set([1,1,this.childPid>>8,this.childPid&255],6);
  return new DataView(b.buffer);
 }
}
test('exact official TG methods produce identical DPI and rate output frames',{skip:!fs.existsSync(officialSource)&&'Run extract-dareu-assets.cjs to cache the official source'},async()=>{
 const source=fs.readFileSync(officialSource,'utf8');class Base{constructor(){this.REPORT_SIZE=64;this.TargetId=0;}}
 const context={MouseBase:class{},KeyboardBase:class{},HidUsbDeviceBase:Base,console:{log(){},error(){}}};vm.runInNewContext(source+';globalThis.Official=TgMouseHidDevice;',context,{timeout:1000});const driver=new context.Official();let captured;driver.CommandProcess=async(data,out)=>{captured=Uint8Array.from(data);out.Data=new Uint8Array(64);return true;};
 await driver.SetPollingRate(2,1,4);assert.deepEqual(captured,frame(0,0,4,2,2,[1,4]));
 await driver.SetDpiConfigure({ProfileId:2,SensorId:1,StageCount:2,Stage:1,DpiValue:{X:[800,1600],Y:[900,1700]}});assert.deepEqual(captured,frame(0,4,3,29,2,[1,2,1,3,32,3,132,6,64,6,164]));
 await driver.GetSensorAttribute({});assert.deepEqual(captured,frame(0,4,128,8));
});
test('real read commands expose ranges; explicit DPI writes preserve other stages and read back',async()=>{
 const device=new Device(),session=new MouseSession(new Handle(device,entry.reportId),{...entry,polling:null,hasBattery:true});const initial=await session.status();assert.deepEqual(initial.values.dpi,[800,900]);assert.equal(initial.values.battery,75);assert.equal(initial.capabilities.dpi.step,50);assert.ok(device.frames.every(f=>f.data[3]&128));
 const changed=await session.execute('dpi.set',[1200,1300]);assert.deepEqual(changed.values.dpi,[1200,1300]);assert.deepEqual(device.stages,[[1200,1300],[1600,1700],[3200,3300]]);
 assert.equal((await session.execute('dpiStage.set',2)).values.dpiStages.active,2);assert.equal((await session.execute('pollRate.set',500)).values.pollRate,500);
 const writes=device.frames.filter(f=>!(f.data[3]&128));await assert.rejects(session.execute('dpi.set',[1234,1300]),/步进/);assert.equal(device.frames.filter(f=>!(f.data[3]&128)).length,writes.length);await session.handle.close();assert.equal(device.opened,false);
});
test('shared receiver selects only the actual product ID in the returned connection table',async()=>{
 const receiver=model.support.receivers.find(x=>x.reportId===10)||model.support.receivers[0],device=new Device(receiver.productId,receiver.reportId);device.childPid=65534;let requests=0;
 const api=createApi({model,hid:{getDevices:async()=>[device],requestDevice:async()=>{requests++;return[device];}}});assert.equal((await api.scan()).devices.length,0);assert.equal(requests,0);device.childPid=entry.productId;const scan=await api.scan();assert.equal(scan.devices.length,1);assert.equal(scan.devices[0].modelId,model.id);const state=await api.status(scan.devices[0].id);assert.equal(state.device.productId,entry.productId);assert.equal(device.frames.find(f=>f.data[2]===4).data[0],16);await api.close();
});
test('protocol catalogue only includes exact TG/HS mouse identities and all remain unverified',()=>{
 assert.equal(catalog.models.length,7);assert.equal(catalog.models.reduce((n,m)=>n+m.identifiers.length,0),14);for(const row of catalog.models){assert.equal(row.support.status,'unverified');assert.ok(row.support.models.every(m=>[0,1].includes(m.fwType)));}assert.equal(catalog.models.some(m=>m.name==='AE7'),false);
});
test('65-byte feature reports strip their report ID and timeouts terminate the interface',async()=>{
 const b=new Uint8Array(65);b[0]=10;b[1]=2;b[3]=4;b[4]=128;assert.equal(normalizeResponse(new DataView(b.buffer))[2],4);
 const device=new Device();device.receiveFeatureReport=()=>new Promise(()=>{});const handle=new Handle(device,10,{timeoutMs:15});await assert.rejects(handle.command(0,4,128,8),/超时/);assert.equal(device.opened,false);await assert.rejects(handle.command(0,4,128,8),/关闭/);
});
test('leaving during permission enumeration cannot create a late open handle',async()=>{
 let release;const device=new Device(),api=createApi({model,hid:{getDevices:()=>new Promise(resolve=>{release=resolve;})}});const job=api.scan();await new Promise(resolve=>setImmediate(resolve));await api.close();release([device]);await assert.rejects(job,/关闭/);assert.equal(device.opened,false);
});
test('an owned handle that opens after its timeout and close is released without sending a command',async()=>{
 let release,closed=0;const device=new Device();device.open=()=>new Promise(resolve=>{release=()=>{device.opened=true;resolve();};});device.close=async()=>{closed++;device.opened=false;};
 const handle=new Handle(device,entry.reportId,{timeoutMs:5});await assert.rejects(handle.command(0,0,128,3),/超时/);await handle.close();release();await new Promise(resolve=>setImmediate(resolve));assert.equal(device.opened,false);assert.equal(closed,1);assert.equal(device.frames.length,0);
});
test('timeouts and closing do not release an interface opened by another owner',async()=>{
 const device=new Device();device.opened=true;let closed=0;device.close=async()=>{closed++;device.opened=false;};device.receiveFeatureReport=()=>new Promise(()=>{});const handle=new Handle(device,entry.reportId,{timeoutMs:5});await assert.rejects(handle.command(0,0,128,3),/超时/);await handle.close();assert.equal(device.opened,true);assert.equal(closed,0);
});
