'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {capabilities,createSession,connect,matches}=require('../app/melgeek-provider.js');
const {getMelgeekModels}=require('../core/melgeek-models.cjs');
const model=getMelgeekModels().find(m=>m.id==='melgeek-made68pro');
const device={vendorId:1046,productId:272,productName:'MelGeek MADE68 Pro',collections:[{usagePage:65376}],opened:false,async close(){this.opened=false;}};
function fixture(){return {
 led:{keymodes:[{mode_name:'Wave',light:21,min:'0',max:'60',speed:3,direction:1,delay:7}],kmm_index:0},
 settings:{use_n_key:true,use_sleep:true,sleep_time:5},
 code:{kcm_index:0,keycodes:{0:[{alias:'Esc'},{alias:'A'}]}},
 perf:{key_accuracys:[0,1].map(()=>({trigger_accuracy:.1,max_trigger:3.3,min_rapid:.01,max_rapid:2.4,rapid_accuracy:.01,dead_accuracy:.01,max_dead:.07,switch_type:17})),key_triggers:[1.5,2],key_deads:[.04,.03],key_rapid_triggers:[0,1].map(()=>({use_rapid:false,p_rapid_value:.5,r_rapid_value:.5,use_fast_rapid:false,use_series_rapid:true,advance_rapid_mode:2,rt_mode:0}))}
};}
function harness({acknowledge=true}={}){
 const state=fixture(),calls=[];let listener,closed=0;
 const bridge={runtime:{emit(channel,command){calls.push(command);const section=command.func_name.split('_')[1],field=section==='setting'?'settings':section,args=command.args;
  if(command.func_name.startsWith('set_')&&acknowledge){const arg=name=>args[args.indexOf(name)+1];if(section==='led'){if(args.includes('--mode_data'))Object.assign(state.led.keymodes[0],JSON.parse(arg('--mode_data')));if(args.includes('--mode_index'))state.led.kmm_index=Number(arg('--mode_index'));}
   if(section==='setting'){if(args.includes('--use_n_key'))state.settings.use_n_key=arg('--use_n_key')==='true';if(args.includes('--use_sleep')){state.settings.use_sleep=arg('--use_sleep')==='true';state.settings.sleep_time=Number(arg('--sleep_time'));}}
   if(section==='perf'){const key=JSON.parse(arg('--key_ids'))[0];if(args.includes('--trigger'))state.perf.key_triggers[key]=Math.round(Number(arg('--trigger'))*10)/10;if(args.includes('--dead'))state.perf.key_deads[key]=Number(arg('--dead'));if(args.includes('--rapid'))Object.assign(state.perf.key_rapid_triggers[key],JSON.parse(arg('--rapid')));}
  }
  if(command.func_name.startsWith('get_'))queueMicrotask(()=>listener?.({type:'load_'+section+'_info',data:JSON.stringify({path:'selected',...state[field]})}));
 }},async close(){closed++;}};
 const session=createSession({runtimeBridge:bridge,model,rawDevice:device,deviceInfo:{path:'selected',alias:'made68pro',fw_ver:'1.8.4'},onEvent:fn=>listener=fn,timeoutMs:35});
 return {session,state,calls,get closed(){return closed;}};
}
test('only exact current model and usage interface match',()=>{
 assert(matches(device,model.support));assert(!matches({...device,productName:'MADE68'},model.support));assert(!matches({...device,collections:[{usagePage:1}]},model.support));assert(!matches({...device,vendorId:1452},model.support));
});
test('capabilities require actual response fields and range; no fabricated magnetic values',()=>{
 assert.equal(capabilities({}).capabilities.length,0);const result=capabilities({...fixture(),deviceInfo:{alias:'made68pro',fw_ver:'1.8.4'}});
 assert.deepEqual(result.capabilities.map(c=>c.id),['lightingEffect','lightingBrightness','lightingSpeed','nkro','sleepTimeout','actuation','rapidTrigger','deadzone']);
 assert.deepEqual(result.capabilities.find(c=>c.id==='lightingBrightness').range,{min:0,max:60,step:1});
 assert.equal(capabilities({...fixture(),code:null}).capabilities.some(c=>c.id==='rapidTrigger'),false);
});
test('lighting keeps official mode fields and confirms device readback',async()=>{
 const h=harness();await h.session.initialize();assert.equal(h.calls.filter(c=>c.func_name.startsWith('set_')).length,0);
 assert.deepEqual(await h.session.execute('lightingBrightness.set',{value:30}),{ok:true,value:30});
 const command=h.calls.find(c=>c.func_name==='set_led_info');assert.equal(command.args[2],'--mode_data');assert.deepEqual(JSON.parse(command.args[3]),{mode_name:'Wave',light:30,min:'0',max:'60',speed:3,direction:1,delay:7,index:0});
 await h.session.close();await h.session.close();assert.equal(h.closed,1);await assert.rejects(h.session.execute('nkro.get'),/已关闭/);
});
test('sleep off preserves native interval and NKRO sends actual native booleans',async()=>{
 const h=harness();await h.session.initialize();await h.session.execute('sleepTimeout.set',{value:0});assert.equal(h.state.settings.sleep_time,5);assert.equal(h.state.settings.use_sleep,false);
 await h.session.execute('nkro.set',{value:false});assert.equal(h.state.settings.use_n_key,false);await h.session.close();
});
test('per-key trigger and RT use selected key, native ranges, preserved unrelated RT values',async()=>{
 const h=harness();await h.session.initialize();assert.deepEqual((await h.session.execute('actuation.get',{selection:{key:1}})).value,{key:1,distance:2});
 await h.session.execute('actuation.set',{value:{key:1,distance:1.2}});assert.deepEqual(h.state.perf.key_triggers,[1.5,1.2]);
 const command=h.calls.find(c=>c.args.includes('--trigger'));assert.equal(command.args.at(-1),'1.200001');
 await h.session.execute('rapidTrigger.set',{value:{key:1,enabled:true,press:.2,release:.3}});
 assert.equal(h.state.perf.key_rapid_triggers[1].use_series_rapid,true);assert.equal(h.state.perf.key_rapid_triggers[1].advance_rapid_mode,2);assert.equal(h.state.perf.key_rapid_triggers[0].use_rapid,false);
 assert.deepEqual((await h.session.execute('rapidTrigger.get')).value,{key:1,enabled:true,press:.2,release:.3});
 const count=h.calls.filter(c=>c.func_name.startsWith('set_')).length;await assert.rejects(h.session.execute('actuation.set',{value:{key:1,distance:8}}),/范围/);assert.equal(h.calls.filter(c=>c.func_name.startsWith('set_')).length,count);await h.session.close();
});
test('no successful result when device fails to return requested new value',async()=>{
 const h=harness({acknowledge:false});await h.session.initialize();await assert.rejects(h.session.execute('nkro.set',{value:false}),/超时/);await h.session.close();
});
test('runtime identity mismatch fails handshake and closes the isolated bridge',async()=>{
 let closed=0;await assert.rejects(connect({model,prepare:async()=>{},hid:{requestDevice:async()=>[device]},loadRuntime:async()=>({wasmBase64:'AA==',resources:{}}),timeoutMs:25,createRuntime:async({onEvent,devices})=>{assert.deepEqual(devices,[device]);return {runtime:{request:async()=>{},emit(){onEvent({type:'load_opt_devices',data:JSON.stringify({usb_devs:[{path:'selected',alias:'real67',dev_type:2}]})});}},close:async()=>closed++};}}),/握手超时/);assert.equal(closed,1);
});
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function promptly(promise){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Cancellation waited instead of settling')),200);})]);}finally{clearTimeout(timer);}}
function cancellationHarness(blockAt){
 const controller=new AbortController(),entered=deferred(),held=deferred(),calls=[],state=fixture();let onEvent,closed=0;
 const pause=async name=>{calls.push(name);if(blockAt===name){entered.resolve();await held.promise;}};
 const bridge={runtime:{async request(){await pause('handshake');},emit(channel,command){calls.push(command.func_name);if(command.func_name==='get_opt_devices'){onEvent({type:'load_opt_devices',data:JSON.stringify({usb_devs:[{path:'selected',alias:'made68pro',dev_type:2,fw_ver:'1.8.4'}]})});return;}if(command.func_name==='get_led_info'&&blockAt==='initialize'){entered.resolve();return;}const section=command.func_name.split('_')[1];queueMicrotask(()=>onEvent({type:'load_'+section+'_info',data:JSON.stringify({path:'selected',...state[section==='setting'?'settings':section]})}));}},async close(){closed++;}};
 const options={model,signal:controller.signal,timeoutMs:6000,prepare:()=>pause('prepare'),hid:{requestDevice:async()=>{await pause('picker');return [device];}},loadRuntime:async()=>{await pause('load');return {wasmBase64:'AA==',resources:{}};},createRuntime:async options=>{onEvent=options.onEvent;await pause('runtime');return bridge;}};
 return {options,controller,entered,held,calls,get closed(){return closed;},lateEvent:()=>onEvent({type:'load_led_info',data:JSON.stringify({path:'selected',...state.led})})};
}
test('already cancelled connection never starts preparation',async()=>{
 const h=cancellationHarness();h.controller.abort();await assert.rejects(connect(h.options),{name:'AbortError'});assert.deepEqual(h.calls,[]);
});
test('abort during prepare, picker or IPC returns immediately and rejects late continuation',async t=>{
 for(const stage of ['prepare','picker','load'])await t.test(stage,async()=>{
  const h=cancellationHarness(stage),pending=connect(h.options);await h.entered.promise;h.controller.abort();await promptly(assert.rejects(pending,{name:'AbortError'}));const calls=[...h.calls];h.held.resolve();await tick();assert.deepEqual(h.calls,calls);assert(!h.calls.includes('runtime'));
 });
});
test('runtime construction completing after cancellation is closed once without handshake',async()=>{
 const h=cancellationHarness('runtime'),pending=connect(h.options);await h.entered.promise;h.controller.abort();await promptly(assert.rejects(pending,{name:'AbortError'}));assert.equal(h.closed,0);h.held.resolve();await tick();assert.equal(h.closed,1);assert(!h.calls.includes('handshake'));
});
test('abort during handshake closes bridge and suppresses a late device request result',async()=>{
 const h=cancellationHarness('handshake'),pending=connect(h.options);await h.entered.promise;h.controller.abort();await promptly(assert.rejects(pending,{name:'AbortError'}));assert.equal(h.closed,1);h.held.resolve();await tick();assert(!h.calls.includes('get_opt_devices'));assert.equal(h.closed,1);
});
test('abort during the first initialization read clears pending work without reading the other sections',async()=>{
 const h=cancellationHarness('initialize'),pending=connect(h.options);await h.entered.promise;h.controller.abort();await promptly(assert.rejects(pending,{name:'AbortError'}));assert.equal(h.closed,1);h.lateEvent();await tick();assert.deepEqual(h.calls.filter(call=>/^get_(led|setting|code|perf)_info$/.test(call)),['get_led_info']);
});
test('completed session keeps cancellation active until close removes its listener',async()=>{
 const h=cancellationHarness();let removed=0;const remove=h.controller.signal.removeEventListener.bind(h.controller.signal);h.controller.signal.removeEventListener=(...args)=>{removed++;return remove(...args);};
 const session=await connect(h.options);assert.equal(removed,0);h.controller.abort();await tick();assert.equal(session.connected,false);assert.equal(h.closed,1);assert.equal(removed,1);await session.close();assert.equal(h.closed,1);
 const h2=cancellationHarness();let removed2=0;const remove2=h2.controller.signal.removeEventListener.bind(h2.controller.signal);h2.controller.signal.removeEventListener=(...args)=>{removed2++;return remove2(...args);};const session2=await connect(h2.options);await session2.close();assert.equal(removed2,1);h2.controller.abort();assert.equal(h2.closed,1);
});
