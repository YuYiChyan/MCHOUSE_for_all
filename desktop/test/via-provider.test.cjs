'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
require('../app/via-provider.js');
const {connect,parseDefinition,createTransport}=globalThis.One4AllVia;
const definition={name:'Protocol fixture',vendorId:'0x1234',productId:'0x0001',matrix:{rows:1,cols:2},layouts:{keymap:[['0,0','0,1']]}};
class Device extends EventTarget {
  constructor(){super();this.vendorId=0x1234;this.productId=1;this.opened=false;this.calls=[];this.keycodes=[4,5];this.version=13;this.collections=[{usagePage:0xff60,usage:0x61,inputReports:[{reportId:0,items:[{reportSize:8,reportCount:32}]}],outputReports:[{reportId:0,items:[{reportSize:8,reportCount:32}]}]}];}
  async open(){this.opened=true;}async close(){this.opened=false;}
  async sendReport(reportId,packet){this.calls.push([...packet]);const response=Uint8Array.from(packet);if(packet[0]===1){response[1]=0;response[2]=this.version;}if(packet[0]===17)response[1]=2;if(packet[0]===4){const code=this.keycodes[packet[3]];response[4]=code>>8;response[5]=code&255;}if(packet[0]===5)this.keycodes[packet[3]]=(packet[4]<<8)|packet[5];queueMicrotask(()=>{const event=new Event('inputreport');event.reportId=reportId;event.data=new DataView(response.buffer);this.dispatchEvent(event);});}
}
function hidFor(device){const hid=new EventTarget();hid.requestDevice=async options=>{hid.filters=options.filters;return [device];};return hid;}
test('definition USB identity and physical matrix are required',()=>{
  assert.equal(parseDefinition(definition,{vendorId:0x1234,productId:1}).keys.length,2);
  assert.throws(()=>parseDefinition(definition,{vendorId:0x9999,productId:1}),/不匹配/);
  assert.throws(()=>parseDefinition({...definition,matrix:{rows:1,cols:1}}),/超出/);
});
test('connect probes real protocol fields; writes use selected coordinates and read back',async()=>{
  const device=new Device(),hid=hidFor(device);
  const session=await connect({definition,target:{vendorId:0x1234,productId:1},hid});
  assert.deepEqual(device.calls.map(packet=>packet[0]),[1,17,4]);
  assert.deepEqual(hid.filters,[{vendorId:0x1234,productId:1,usagePage:0xff60,usage:0x61}]);
  assert.equal(session.protocolVersion,13);assert.equal(session.layerCount,2);
  const second=await session.execute('via.keymap.read',{selection:{layer:1,key:'0,1'}});assert.equal(second.value.action,5);
  const written=await session.execute('via.keymap.write',{value:{layer:1,key:'0,1',action:6}});assert.equal(written.value.action,6);
  assert.deepEqual(device.calls.at(-2).slice(0,6),[5,1,0,1,0,6]);assert.equal(device.calls.at(-1)[0],4);
  await assert.rejects(session.execute('via.keymap.write',{value:{layer:5,key:'0,1',action:6}}),/无效/);
  await session.close();assert.equal(device.opened,false);
});
test('unrecognized protocol version closes the interface without exposing commands',async()=>{
  const device=new Device();device.version=655;
  await assert.rejects(connect({definition,hid:hidFor(device)}),/尚未接入/);assert.equal(device.opened,false);assert.deepEqual(device.calls.map(packet=>packet[0]),[1]);
});
test('timeout closes transport so stale responses cannot authorize later writes',async()=>{
  const device=new Device();device.sendReport=async()=>{};await device.open();
  const transport=createTransport(device,{timeout:10});
  await assert.rejects(transport.request(1),/没有响应/);assert.equal(transport.isClosed(),true);
  await assert.rejects(transport.request(5,[0,0,0,0,4]),/断开/);
});
