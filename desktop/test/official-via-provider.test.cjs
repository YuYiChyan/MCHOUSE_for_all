'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
require('../app/via-provider.js');require('../app/official-via-provider.js');
const {officialDefinition,wooVariants}=require('../scripts/official-via-assets.cjs');
const {getOfficialViaModels,getOfficialViaSupport}=require('../core/official-via-models.cjs');
const definition={name:'Official-style fixture',vendorId:'0x3434',productId:'0x0810',matrix:{rows:2,cols:3},layouts:{keymap:[['0, 0','0, 2'],['1, 0']]}};
function model(){return {id:'fixture',brand:'keychron',name:'Fixture',support:{provider:'official-via',definition:officialDefinition(definition)}};}
class Device extends EventTarget{
 constructor(){super();this.vendorId=0x3434;this.productId=0x0810;this.opened=false;this.calls=[];this.keys=new Map();this.collections=[{usagePage:0xff60,usage:0x61,inputReports:[{reportId:0,items:[{reportSize:8,reportCount:32}]}],outputReports:[{reportId:0,items:[{reportSize:8,reportCount:32}]}]}];}
 async open(){this.opened=true;}async close(){this.opened=false;}
 async sendReport(reportId,packet){this.calls.push([...packet]);const bytes=Uint8Array.from(packet),key=[packet[1],packet[2],packet[3]].join(',');if(packet[0]===1){bytes[1]=0;bytes[2]=13;}if(packet[0]===17)bytes[1]=4;if(packet[0]===5)this.keys.set(key,packet[4]*256+packet[5]);if(packet[0]===4){const code=this.keys.get(key)||4;bytes[4]=code>>8;bytes[5]=code&255;}queueMicrotask(()=>{const event=new Event('inputreport');event.reportId=reportId;event.data=new DataView(bytes.buffer);this.dispatchEvent(event);});}
}
function hidFor(device,onRequest=()=>{}){const hid=new EventTarget();hid.requestDevice=async options=>{onRequest(options);return [device];};return hid;}
test('official spaced KLE coordinates normalize without changing the matrix',()=>{
 const normalized=officialDefinition(definition);assert.deepEqual(normalized.layouts.keymap,[['0,0','0,2'],['1,0']]);assert.equal(globalThis.One4AllVia.parseDefinition(normalized).keys.length,3);assert.deepEqual(normalized.matrix,{rows:2,cols:3});
});
test('product page bridge prepares exact HID and exposes actual VIA read/write with readback',async()=>{
 const device=new Device(),events=[],hid=hidFor(device,options=>{events.push('request');assert.deepEqual(options.filters,[{vendorId:0x3434,productId:0x0810,usagePage:0xff60,usage:0x61}]);});
 const session=await One4AllOfficialVia.connect({model:model(),prepare:async()=>events.push('prepare'),hid});assert.deepEqual(events,['prepare','request']);assert.deepEqual(device.calls.map(p=>p[0]),[1,17,4]);assert.equal(session.layerCount,4);assert.equal(session.capabilities[0].id,'keymap');
 const result=await session.execute('via.keymap.write',{value:{layer:2,key:'0,2',action:6}});assert.equal(result.value.action,6);assert.deepEqual(device.calls.at(-2).slice(0,6),[5,2,0,2,0,6]);assert.equal(device.calls.at(-1)[0],4);assert.equal((await session.readKey({layer:2,key:'0,2'})).action,6);await session.close();assert.equal(device.opened,false);
});
test('wrong USB product cannot connect using a family name',async()=>{
 const device=new Device();device.productId=0x9999;await assert.rejects(One4AllOfficialVia.connect({model:model(),hid:hidFor(device)}),/不匹配/);assert.equal(device.opened,false);assert.deepEqual(device.calls,[]);
});
test('aborted device chooser never opens a late returned device',async()=>{
 const abort=new AbortController(),device=new Device(),hid=new EventTarget();let release;hid.requestDevice=()=>new Promise(resolve=>release=resolve);const pending=One4AllOfficialVia.connect({model:model(),signal:abort.signal,hid});await new Promise(resolve=>setImmediate(resolve));abort.abort();await assert.rejects(pending,{name:'AbortError'});release([device]);await new Promise(resolve=>setImmediate(resolve));assert.equal(device.opened,false);assert.deepEqual(device.calls,[]);
});
test('aborting an established session closes its interface and disallows writes',async()=>{
 const abort=new AbortController(),device=new Device();const session=await One4AllOfficialVia.connect({model:model(),signal:abort.signal,hid:hidFor(device)});abort.abort();await new Promise(resolve=>setImmediate(resolve));assert.equal(device.opened,false);await assert.rejects(session.execute('via.keymap.write',{value:{layer:0,key:'0,0',action:7}}),{name:'AbortError'});assert.ok(!device.calls.some(packet=>packet[0]===5));await session.close();
});
test('official product variations exclude non-QMK domestic editions and duplicate switch SKUs',()=>{
 const rows=[{attributes:{color:'Purple (Non-QMK/Domestic)'},image:{url:'https://example.com/domestic.png'}},{attributes:{color:'Purple',switch:'A'},image:{url:'https://example.com/a.png'}},{attributes:{color:'Purple',switch:'B'},image:{url:'https://example.com/b.png'}}];const variants=wooVariants('<form data-product_variations="'+JSON.stringify(rows).replaceAll('"','&quot;')+'"></form>');assert.equal(variants.length,1);assert.equal(variants[0].name,'Purple');assert.equal(variants[0].imageUrl,'https://example.com/a.png');
});
test('layout-specific official photos do not mix ANSI and ISO editions',()=>{
 const rows=['ANSI','ISO'].map(layout=>({attributes:{'type-layout':'Barebone ('+layout+')',color:'Black'},image:{url:'https://example.com/'+layout+'.png'}}));const html='<form data-product_variations="'+JSON.stringify(rows).replaceAll('"','&quot;')+'"></form>';assert.equal(wooVariants(html,{layout:'ISO'})[0].imageUrl,'https://example.com/ISO.png');assert.equal(wooVariants(html,{layout:'ANSI'})[0].imageUrl,'https://example.com/ANSI.png');
});
test('bundled exact model definitions have valid matrix keys and are all unverified',()=>{
 for(const brand of ['keychron','monsgeek','akko','rk','redragon']){const rows=getOfficialViaModels(brand);assert.ok(rows.length>0);const ids=new Set();for(const row of rows){assert.ok(!ids.has(row.id));ids.add(row.id);const support=getOfficialViaSupport(row);assert.equal(support.status,'unverified');assert.equal(support.hardwareVerified,false);const parsed=One4AllVia.parseDefinition(support.definition);assert.equal(parsed.vendorId,support.filters[0].vendorId);assert.equal(parsed.productId,support.filters[0].productId);assert.ok(parsed.keys.length>0);}}
});
