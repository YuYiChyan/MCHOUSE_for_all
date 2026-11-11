'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {normalizeCapabilities,assertValue,createController,catalogue}=require('../core/keyboard-capabilities.cjs');
const base={connected:true,interfaceConfirmed:true,provider:'test-provider',version:'1',evidence:['protocol handshake acknowledged'],capabilities:[]};
const rate={id:'pollingRate',supported:true,readable:true,writable:true,readCommand:'rate.read',writeCommand:'rate.write',options:[125,500,1000]};
const actuation={id:'actuation',supported:true,readable:true,writable:true,readCommand:'actuation.read',writeCommand:'actuation.write',range:{min:.1,max:4,step:.1}};
const report=(...capabilities)=>({...base,capabilities});

test('vendor identity or a loaded library alone never exposes settings',()=>{
  assert.deepEqual(normalizeCapabilities({vendorId:0x1532,capabilities:[rate]}),[]);
  for(const change of [{connected:false},{interfaceConfirmed:false},{provider:''},{version:''},{evidence:[]}])assert.deepEqual(normalizeCapabilities({...report(rate),...change}),[]);
});
test('only implemented, supported commands and device-provided ranges are visible',()=>{
  const result=normalizeCapabilities(report(rate,{...actuation,range:null},{...rate,id:'imaginary'},{...actuation,supported:false},{...actuation,readable:false},{...rate,readCommand:'bad command'}));
  assert.equal(result.length,1);assert.equal(result[0].id,'pollingRate');assert.equal(result[0].provider,'test-provider');
  assert.deepEqual(result[0].options.map(option=>option.value),[125,500,1000]);
  assert.equal(normalizeCapabilities(report(rate,rate)).length,1);
});
test('ranges and discrete choices are enforced before transport writes',()=>{
  const [a,r]=normalizeCapabilities(report(actuation,rate));
  assert.equal(assertValue(a,1.2),1.2);
  for(const value of [-1,4.1,1.25,'1',NaN])assert.throws(()=>assertValue(a,value));
  assert.throws(()=>assertValue(r,8000));assert.equal(assertValue(r,1000),1000);
});
test('magnetic compound controls require real bounds for every field',()=>{
  const rt={id:'rapidTrigger',supported:true,readable:true,writable:true,readCommand:'rt.read',writeCommand:'rt.write',ranges:{press:{min:.1,max:4,step:.1},release:{min:.1,max:4,step:.1}}};
  assert.equal(normalizeCapabilities(report({...rt,ranges:{press:rt.ranges.press}})).length,0);
  const [cap]=normalizeCapabilities(report(rt));
  assert.deepEqual(assertValue(cap,{enabled:true,press:.2,release:.3}),{enabled:true,press:.2,release:.3});
  assert.throws(()=>assertValue(cap,{enabled:'yes',press:.2,release:.3}));
});
test('successful writes return actual readback, including a device-adjusted setting',async()=>{
  const calls=[];
  const controller=createController({report:report(rate),execute:async(command,payload)=>{calls.push([command,payload]);return command==='rate.write'?{ok:true}:{value:500};}});
  assert.deepEqual(await controller.write('pollingRate',1000),{value:500});
  assert.deepEqual(calls.map(call=>call[0]),['rate.write','rate.read']);
  assert.equal(calls[0][1].value,1000);
});
test('rejected writes and missing readback do not report success',async()=>{
  let calls=0;
  const rejected=createController({report:report(rate),execute:async()=>{calls++;return {ok:false,error:'device disconnected'};}});
  await assert.rejects(rejected.write('pollingRate',1000),/device disconnected/);assert.equal(calls,1);
  const noReadback=createController({report:report(rate),execute:async(command)=>command==='rate.write'?{ok:true}:undefined});
  await assert.rejects(noReadback.write('pollingRate',1000),/未返回/);
  const readFailure=createController({report:report(rate),execute:async(command)=>command==='rate.write'?{ok:true}:{ok:false,error:'read failed'}});
  await assert.rejects(readFailure.write('pollingRate',1000),/read failed/);
});
test('operations serialize and a failure does not poison subsequent requests',async()=>{
  const calls=[];let failed=false;
  const controller=createController({report:report(rate),execute:async(command)=>{calls.push(command);await new Promise(resolve=>setTimeout(resolve,3));if(!failed){failed=true;throw Error('transient');}return {value:500};}});
  const results=await Promise.allSettled([controller.write('pollingRate',500),controller.write('pollingRate',1000),controller.read('pollingRate')]);
  assert.deepEqual(results.map(result=>result.status),['rejected','fulfilled','fulfilled']);
  assert.deepEqual(calls,['rate.write','rate.write','rate.read','rate.read']);
});
test('unreadable actions require explicit device acknowledgement',async()=>{
  const action={id:'calibration',supported:true,writable:true,writeCommand:'calibrate'};
  const controller=createController({report:report(action),execute:async()=>undefined});
  await assert.rejects(controller.write('calibration',{}),/尚未确认/);
  const good=createController({report:report(action),execute:async()=>({ok:true})});
  assert.deepEqual(await good.write('calibration',{}),{ok:true});
});
test('catalogue covers mechanical and magnetic keyboards without implying support',()=>{
  for(const id of ['keymap','layers','macros','lightingEffect','pollingRate','debounce','winLock','activeProfile','actuation','rapidTrigger','dks','socd','calibration'])assert.ok(catalogue[id]);
  assert.deepEqual(normalizeCapabilities(report()),[]);
});
