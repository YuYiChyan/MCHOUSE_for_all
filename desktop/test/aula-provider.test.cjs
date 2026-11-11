'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {frame,createApi,Transport}=require('../app/aula-provider.js');
const {getAulaSupport}=require('../core/aula-models.cjs');
const model={id:'aula-v9pro',brand:'aula',kind:'mouse',name:'AULA V9 Pro'};model.support=getAulaSupport(model);
class FakeDevice extends EventTarget{
 constructor(configId){super();const c=model.support.connections.find(c=>c.connectionType===1);Object.assign(this,{vendorId:c.vendorId,productId:c.productId,productName:c.productName,opened:false,configId:configId??c.configId});this.collections=[{usagePage:c.usagePage,usage:c.usage,outputReports:[{reportId:4}]}];this.sent=[];this.raw=new Uint8Array(128);for(let i=0;i<6;i++){const offset=14+i*9,value=400*(i+1);this.raw.set([1,0,value&255,value>>>8,value&255,value>>>8,10,20,30],offset);}this.raw[2]=2;this.raw[10]=3;this.raw[11]=3;this.raw[70]=8;this.raw[100]=231;}
 async open(){this.opened=true;}async close(){this.opened=false;}
 async sendReport(id,value){assert.equal(id,4);const request=new Uint8Array(value);this.sent.push(request);if(this.silent)return;const command=request[2],length=request[3],offset=request[4]|request[5]<<8;let payload=new Uint8Array(0);if(command===3){payload=new Uint8Array(length);if(offset===0&&length>7)payload[7]=this.configId;}else if(command===5)payload=this.raw.slice(offset,offset+length);else if(command===6)this.raw.set(request.slice(7,7+length),offset);else if(command===170)payload=Uint8Array.of(1);else if(command===26)payload=Uint8Array.of(88);
  const response=new Uint8Array(63);response[2]=command;response[3]=payload.length;response.set(payload,7);queueMicrotask(()=>{const event=new Event('inputreport');event.reportId=4;event.data=new DataView(response.buffer);this.dispatchEvent(event);});
 }
}
test('AULA request layout matches official report 4 chunk boundaries and LE offsets',()=>{
 assert.deepEqual([...frame(5,56,0).slice(0,9)],[0,0,5,56,0,0,0,0,0]);
 const packet=frame(6,3,0x1234,Uint8Array.of(10,20,30),true);assert.equal(packet.length,31);assert.deepEqual([...packet.slice(0,10)],[0,0,6,3,0x34,0x12,0,10,20,30]);
});
test('AULA identity is read from the actual device, not inferred from a shared PID',async()=>{
 const device=new FakeDevice(255),api=createApi({model,hid:{getDevices:async()=>[device]}});
 assert.equal((await api.scan()).devices.length,0);assert(!device.sent.some(p=>p[2]===6));await api.close();assert.equal(device.opened,false);
});
test('AULA settings preserve unrelated profile bytes and return fresh readback',async()=>{
 const device=new FakeDevice(),api=createApi({model,hid:{getDevices:async()=>[device]}}),scan=await api.scan(),id=scan.devices[0].id;
 const initial=await api.status(id);assert.equal(initial.values.pollRate,1000);assert.deepEqual(initial.values.dpi,[400,400]);assert.equal(initial.capabilities.dpi.separateAxes,false);assert(!device.sent.some(p=>p[2]===6));
 let state=await api.execute({deviceId:id,command:'dpi.set',value:[1200,1200]});assert.deepEqual(state.values.dpi,[1200,1200]);assert.equal(device.raw[100],231);assert.equal(device.raw[70],8);assert.deepEqual([...device.raw.slice(20,23)],[10,20,30]);
 state=await api.execute({deviceId:id,command:'pollRate.set',value:2000});assert.equal(state.values.pollRate,2000);assert.equal(device.raw[10],3);
 state=await api.execute({deviceId:id,command:'dpiStage.set',value:2});assert.equal(state.values.dpiStages.active,2);
 state=await api.execute({deviceId:id,command:'brightness.set',value:{zone:'all',percent:75}});assert.equal(state.values.brightness.all,75);
 const writes=device.sent.filter(p=>p[2]===6).length;await assert.rejects(api.execute({deviceId:id,command:'dpi.set',value:[1234,1234]}),/步进/);assert.equal(device.sent.filter(p=>p[2]===6).length,writes);await api.close();
});
test('AULA timeout closes a session so delayed packets cannot satisfy later writes',async()=>{
 const device=new FakeDevice();device.silent=true;const transport=new Transport(device,false,{timeout:5});await assert.rejects(transport.command(1),/超时/);assert.equal(transport.closed,true);assert.equal(device.opened,false);await assert.rejects(transport.command(5),/关闭/);
});
test('AULA close during permission preparation cannot open a late device',async()=>{
 let done;const preparing=new Promise(resolve=>{done=resolve;}),device=new FakeDevice(),api=createApi({model,prepare:()=>preparing,hid:{getDevices:async()=>[device]}});const scan=api.scan();await api.close();done();await assert.rejects(scan,/关闭/);assert.equal(device.opened,false);
});
