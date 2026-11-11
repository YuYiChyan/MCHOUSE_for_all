'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {MouseSession,createApi,readFrame,writeFrame,address}=require('../app/rapoo-provider.js');
const {balanced}=require('../scripts/extract-rapoo-assets.cjs');
const catalog=require('../catalog/rapoo-protocols.json'),model=catalog.models.find(m=>m.support.dpi.max===45000&&m.support.productIds.length===2),support=model.support;
const officialSource=path.join(process.env.LOCALAPPDATA||'', 'One4All-Desktop/vendor-resources/rapoo/source/index.js');
class Device{
 constructor(pid=support.productIds[0]){this.vendorId=support.vendorId;this.productId=pid;this.opened=false;this.frames=[];this.memory=new Uint8Array(65536);this.memory[268]=1;this.base=2560;this.memory[this.base+662]=2;this.memory[this.base+664]=0;this.memory[this.base+640]=1;for(let i=0;i<7;i++){this.put(this.base+648+i*2,800*(i+1));this.put(this.base+712+i*2,900*(i+1));}this.collections=[{usagePage:support.filters[0].usagePage,usage:support.filters[0].usage,outputReports:[{reportId:6}],featureReports:[{reportId:8}]}];}
 put(a,n){this.memory[a]=n&255;this.memory[a+1]=n>>8;}
 async open(){this.opened=true;}async close(){this.opened=false;}
 async sendReport(report,data){assert.equal(report,6);this.last=Uint8Array.from(data);this.frames.push(Array.from(data));if(data[1]===165&&!this.ignoreWrite){const a=(data[3]|data[4]<<8|data[5]<<16|data[6]<<24)>>>0;this.memory.set(data.slice(7,7+data[2]),a);}}
 async receiveFeatureReport(report){assert.equal(report,8);const out=new Uint8Array(64);out[0]=1;const data=this.last;if(data[1]===163)out.set([1,2,3,4,0,0,5,1],1);if(data[1]===164){let a=0;for(let i=3;i<data.length;i++)a+=data[i]*2**(8*(i-3));out.set(this.memory.slice(a,a+data[2]),4);}return new DataView(out.buffer);}
}
test('Rapoo frames match exact official J6/Rx builders including short-read address and padded writes',{skip:!fs.existsSync(officialSource)&&'Run extract-rapoo-assets.cjs to cache the official source'},()=>{
 const source=fs.readFileSync(officialSource,'utf8');const fn=name=>{const start=source.indexOf('function '+name+'('),body=source.indexOf('{',start);return source.slice(start,body)+balanced(source,body);};const context={};vm.runInNewContext('const q6=4;'+fn('J6')+fn('Rx')+';globalThis.read=J6;globalThis.write=Rx;',context,{timeout:1000});
 const proto={readCmd:[164],writeCmd:[165]};assert.deepEqual(Array.from(context.read(proto,255,[12,1],1)),Array.from(readFrame(255,[12,1],1)));assert.deepEqual(Array.from(context.write(proto,165,[12,1],[1,2])),Array.from(writeFrame(165,[12,1],[1,2])));assert.deepEqual(Array.from(context.write(proto,255,address(3208),[176,4])),Array.from(writeFrame(255,address(3208),[176,4])));
});
test('read-only discovery exposes actual values, then isolated writes preserve other stages',async()=>{
 const device=new Device(),session=new MouseSession(device,support),state=await session.status();assert.deepEqual(state.values.dpi,[800,900]);assert.equal(state.values.pollRate,1000);assert.ok(device.frames.every(p=>[163,164].includes(p[1])));const old=device.memory.slice();
 assert.deepEqual((await session.execute('dpi.set',[1200,1300])).values.dpi,[1200,1300]);for(let i=0;i<old.length;i++)if(![device.base+648,device.base+649,device.base+712,device.base+713].includes(i))assert.equal(device.memory[i],old[i]);
 assert.equal((await session.execute('dpiStage.set',2)).values.dpiStages.active,2);assert.equal((await session.execute('pollRate.set',4000)).values.pollRate,4000);const writes=device.frames.filter(p=>p[1]===165);assert.equal(writes.length,4);await session.close();assert.equal(device.opened,false);
});
test('split DPI ranges reject unsupported values before sending writes',async()=>{
 const device=new Device(),session=new MouseSession(device,support);await assert.rejects(session.execute('dpi.set',[10060,10060]),/步进/);assert.equal(device.frames.some(p=>p[1]===165),false);await session.close();
});
test('dedicated receiver uses the official wireless connection prefix and failed readback reports failure',async()=>{
 const device=new Device(support.productIds[1]),session=new MouseSession(device,support);assert.equal((await session.status()).connected,true);assert.ok(device.frames.every(p=>p[0]===165));device.ignoreWrite=true;await assert.rejects(session.execute('dpi.set',[1200,1300]),/重新读取/);await session.close();
});
test('exact models have unique physical IDs, known DPI ranges and remain unverified',()=>{
 assert.equal(catalog.models.length,76);const pids=new Set();for(const m of catalog.models){assert.equal(m.support.status,'unverified');assert.equal(m.support.protocol,'rapoo-nrf54l-v1');for(const p of m.support.productIds){assert.equal(pids.has(p),false);pids.add(p);}assert.ok(m.support.dpi.max>m.support.dpi.min);assert.ok(m.support.filters.every(f=>f.usage===2));}
});
test('scan does not ask permission and close during enumeration cannot open a late session',async()=>{
 const device=new Device();let requests=0;const api=createApi({model,hid:{getDevices:async()=>[device],requestDevice:async()=>{requests++;return[device];}}});const scan=await api.scan();assert.equal(scan.devices[0].modelId,model.id);assert.equal(requests,0);await api.close();assert.equal(device.opened,false);
 let release;const late=createApi({model,hid:{getDevices:()=>new Promise(resolve=>{release=resolve;})}}),pending=late.scan();await new Promise(resolve=>setImmediate(resolve));await late.close();release([device]);await assert.rejects(pending,/关闭/);assert.equal(device.opened,false);
});
test('timeout shuts down the interface so an old feature response cannot satisfy a later command',async()=>{
 const device=new Device();device.receiveFeatureReport=()=>new Promise(()=>{});const session=new MouseSession(device,support,{timeoutMs:15});await assert.rejects(session.status(),/超时/);assert.equal(device.opened,false);await assert.rejects(session.status(),/关闭/);
});
test('an owned interface that opens after its timeout and close is released without sending a command',async()=>{
 let release,closed=0;const device=new Device();device.open=()=>new Promise(resolve=>{release=()=>{device.opened=true;resolve();};});device.close=async()=>{closed++;device.opened=false;};
 const session=new MouseSession(device,support,{timeoutMs:5});await assert.rejects(session.status(),/超时/);await session.close();release();await new Promise(resolve=>setImmediate(resolve));assert.equal(device.opened,false);assert.equal(closed,1);assert.equal(device.frames.length,0);
});
test('timeouts and closing do not release an interface opened by another owner',async()=>{
 const device=new Device();device.opened=true;let closed=0;device.close=async()=>{closed++;device.opened=false;};device.receiveFeatureReport=()=>new Promise(()=>{});const session=new MouseSession(device,support,{timeoutMs:5});await assert.rejects(session.status(),/超时/);await session.close();assert.equal(device.opened,true);assert.equal(closed,0);
});
