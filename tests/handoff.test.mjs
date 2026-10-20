import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createService}=require('../library/bridge/device-service.cjs');

test('device writes validate before reaching the backend and preserve acknowledgements',async()=>{
  const calls=[];
  const service=createService('g309','unused',{run:async(command,value)=>{calls.push([command,value]);return {connected:true,values:{dpi:value}};}});
  await assert.rejects(service.invoke('setDpi',NaN));
  await assert.rejects(service.invoke('setReportRate',8000));
  await assert.rejects(service.invoke('setHostMode',1));
  await assert.rejects(service.invoke('setOutputVolume',10));
  assert.equal(calls.length,0);
  assert.equal((await service.invoke('setDpi',1600)).values.dpi,1600);
  await service.close();
});
test('status requests coalesce and failed writes do not return stale connected state',async()=>{
  let reads=0;
  const service=createService('blackshark','unused',{run:async(command)=>{
    if(command!=='status')throw Error('unplugged');
    reads++;return {connected:reads===1,sampledAt:Date.now(),values:{}};
  }});
  const [a,b]=await Promise.all([service.status(),service.status()]);
  assert.equal(reads,1);assert.equal(a,b);
  await assert.rejects(service.invoke('setInputMute',true),/unplugged/);
  assert.equal((await service.status()).connected,false);assert.equal(reads,2);
  await service.close();
});
