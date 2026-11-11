'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fixture=require('./fixtures/fgg-wire-vectors.json');
const {packet,Session}=require('../app/fgg-provider.js');

// Expectations were produced by the pinned official Cr/Ks classes, independently
// of this provider. Their origin and exact generation method travel in the JSON.
// This test needs neither the research cache nor network access nor a HID device.
const fromHex=hex=>Uint8Array.from(hex.split(' '),part=>parseInt(part,16));
const expectedVector=name=>{
 const result=fixture.vectors.find(vector=>vector.name===name);
 assert.ok(result,'Missing independent official vector: '+name);return result;
};

for(const vector of fixture.vectors){
 test('official wire vector: '+vector.name,()=>{
  assert.match(fixture.source.sha256,/^[0-9a-f]{64}$/);
  assert.equal(fixture.source.generation.localCacheRequired,false);
  const expected=fromHex(vector.packetHex);
  assert.equal(expected.length,64,'Official expected frame must contain all 64 bytes');
  const payload=vector.payloadHex?fromHex(vector.payloadHex):undefined;
  assert.deepEqual(packet(vector.command,vector.address,vector.length,payload),expected,
   'Serialized request differs from the independently executed official class');
 });
}

const edits=[
 {name:'set-report-rate-2k',id:'pollingRate',value:2000,type:'select'},
 {name:'clear-win-lock',id:'winLock',value:false,type:'boolean'},
 {name:'set-light-effect',id:'lightingEffect',value:9,type:'select'},
 {name:'set-light-brightness',id:'lightingBrightness',value:37,type:'number'},
 {name:'set-light-speed-ui-3-wire-1',id:'lightingSpeed',value:3,type:'number'},
 {name:'set-rgb-single-color',id:'lightingColor',value:'#c9214d',type:'color'},
];
for(const edit of edits){
 test('official field edit and readback: '+edit.name,async()=>{
  const expected=expectedVector(edit.name),baseline=expectedVector('set-function-area-full-known-state');
  let current=fromHex(baseline.payloadHex);
  const writes=[],requests=[];
  // Session-level fake transport only: no synthetic ACK is passed off as a
  // physical capture. Full transport/ACK behavior has a separate test suite.
  const transport={closed:false,async request(command,address,length,payload){
   requests.push(command);
   assert.equal(address,expected.address,'Edit addressed the wrong onboard profile');
   assert.equal(length,56,'Function-area request must retain the entire area');
   if(command===6){
    assert.equal(payload.length,56);
    writes.push(payload.slice());current=payload.slice();return new Uint8Array(64);
   }
   assert.equal(command,5,'Only function-area reads and the requested write are allowed');
   const response=new Uint8Array(64);response.set(current,8);return response;
  }};
  const session=new Session(transport,{id:'fgg-wire-vector-fixture',name:'Independent fixture'});
  session.configIndex=2;
  session.capabilities=[{id:edit.id,type:edit.type,range:{min:0,max:100,step:1},options:[{value:edit.value}]}];
  const result=await session.execute(edit.id+'.set',{value:edit.value});
  assert.equal(result.ok,true);assert.equal(result.value,edit.value);
  assert.deepEqual(requests,[5,6,5],'Write must first read current state and then read it back');
  assert.equal(writes.length,1,'An edit must cause exactly one settings write');
  assert.deepEqual(writes[0],fromHex(expected.payloadHex),
   'Edited fields or unrelated retained settings differ from the official class output');
  assert.deepEqual(packet(6,expected.address,56,writes[0]),fromHex(expected.packetHex));
 });
}
