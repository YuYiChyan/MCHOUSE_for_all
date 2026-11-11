'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),os=require('node:os'),path=require('node:path'),fs=require('node:fs');
const {createXiberiaService,loadCatalog,getXiberiaSupport}=require('../core/xiberia-models.cjs');
function fixture(t,options={}){const root=fs.mkdtempSync(path.join(os.tmpdir(),'one4all-xiberia-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const service=createXiberiaService({payloadRoot:root,stateRoot:root,...options});t.after(()=>service.close());return service;}
test('catalog contains exactly ten proven X HUB models and all thirty-four original product variants',()=>{
 const catalog=loadCatalog();assert.equal(catalog.models.length,10);assert.equal(catalog.models.reduce((n,m)=>n+m.variants.length,0),34);
 assert.ok(catalog.models.every(m=>m.support.status==='unverified'));
 assert.equal(getXiberiaSupport({id:'xiberia-s21-max'}),null);assert.equal(getXiberiaSupport({id:'xiberia-k03s-7-1'}),null);
 assert.deepEqual(catalog.models.find(m=>m.id==='k03s').identifiers.map(id=>id.productId),[0xf016,0xf017]);
});
test('normal state routes original model and exact render endpoint to native SDK without opening official UI',async t=>{
 const core=[],native=[];const service=fixture(t,{runCore:async(id,command,value)=>{core.push({id,command,value});return {connected:true,values:{outputVolume:42,inputVolume:35},capabilities:{output:true,input:true},_renderEndpoint:'exact-render-endpoint'};},nativeFactory:()=>({request:async(command,value,endpoint)=>{native.push({command,value,endpoint});return {ready:true,eq:{enabled:true,gains:[0,1],frequencies:[100,1000]}};},close(){}})});
 const state=await service.status('xiberia-t10');assert.equal(core[0].id,'xiberia-t10');assert.equal(native[0].endpoint,'exact-render-endpoint');assert.equal(native[0].command,'status');assert.equal(state._renderEndpoint,undefined);assert.equal(state.capabilities.effects,true);assert.equal(state.verification,'unverified');
 await service.execute({modelId:'xiberia-t10',command:'setOutputVolume',value:55});assert.equal(core.at(-1).command,'setOutputVolume');assert.equal(core.at(-1).value,55);assert.ok(!native.some(call=>call.command==='openOfficialApp'));
});
test('disconnected or ambiguous endpoints never reach native controls and absent effects retain Core Audio',async t=>{
 let nativeCalls=0,connected=false;const service=fixture(t,{runCore:async()=>({connected,values:{outputVolume:30},capabilities:{output:connected},_renderEndpoint:connected?'target':null}),nativeFactory:()=>({request:async()=>{nativeCalls++;throw Error('APO missing');},close(){}})});
 const unplugged=await service.status('k03s');assert.equal(unplugged.connected,false);assert.equal(nativeCalls,0);
 connected=true;const state=await service.status('k03s');assert.equal(state.values.outputVolume,30);assert.equal(state.capabilities.output,true);assert.equal(state.capabilities.effects,false);assert.equal(nativeCalls,1);
});
test('only an explicit official app command launches that branch; invalid writes and unknown models fail',async t=>{
 const native=[];let core=0;const service=fixture(t,{runCore:async()=>{core++;return {connected:false,capabilities:{}};},nativeFactory:()=>({request:async command=>{native.push(command);return {launched:true};},close(){}})});
 await assert.rejects(service.status('xiberia-s21-max'),/支持列表/);
 await assert.rejects(service.execute({modelId:'k03s',command:'setOutputVolume',value:101}),/音量范围/);
 await assert.rejects(service.execute({modelId:'k03s',command:'setEq',value:{enabled:true,gains:[99]}}),/均衡器/);
 const result=await service.execute({modelId:'k03s',command:'openOfficialApp'});assert.equal(result.launched,true);assert.equal(core,0);assert.deepEqual(native,['openOfficialApp']);
 await service.close();await assert.rejects(service.status('k03s'),/已关闭/);
});
test('closing an in-flight read prevents stale native access and a reopened model owns a new session',async t=>{
 let resolveRead,coreCalls=0;const natives=[];
 const service=fixture(t,{runCore:async()=>{coreCalls++;if(coreCalls===1)return new Promise(resolve=>{resolveRead=resolve;});return {connected:true,values:{outputVolume:70},capabilities:{output:true},_renderEndpoint:'new-endpoint'};},nativeFactory:()=>{const entry={calls:[],closed:false,request:async function(command,value,endpoint){this.calls.push(endpoint);return {ready:true};},close(){this.closed=true;}};natives.push(entry);return entry;}});
 const read=service.status('k03s');await new Promise(resolve=>setImmediate(resolve));const closing=service.closeModel('k03s');
 resolveRead({connected:true,values:{outputVolume:10},capabilities:{output:true},_renderEndpoint:'old-endpoint'});await read;await closing;
 assert.equal(natives[0].closed,true);assert.deepEqual(natives[0].calls,[]);
 const fresh=await service.status('k03s');assert.equal(fresh.values.outputVolume,70);assert.deepEqual(natives[1].calls,['new-endpoint']);assert.equal(natives[1].closed,false);
});
