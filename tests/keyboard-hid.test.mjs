import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {createKeyboardService}=require('../library/hid/keyboard-service.cjs');
const {createAppearanceStore}=require('../library/hid/appearance-store.cjs');

test('refresh requests share one operation and the service exposes no HID writes',async()=>{
  let reads=0,release;
  const gate=new Promise(resolve=>{release=resolve});
  const service=createKeyboardService({run:async()=>{reads++;await gate;return {devices:[]}}});
  const first=service.status(),second=service.status();
  assert.equal(first,second);await Promise.resolve();assert.equal(reads,1);
  assert.deepEqual(Object.keys(service).sort(),['close','saveAppearance','status']);
  release();await first;await service.close();
  await assert.rejects(service.status(),/closed/);
});

test('appearance survives reopening and remains separate for identical device models',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'one4all-hid-'));
  const firstId='a'.repeat(20),secondId='b'.repeat(20);
  const run=async()=>({devices:[{id:firstId},{id:secondId}]});
  const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
  let service;
  try{
    const salt=createAppearanceStore(directory).salt;
    service=createKeyboardService({run,profileDirectory:directory});
    await assert.rejects(service.saveAppearance({deviceId:firstId,name:'test',imageDataUrl:''}),/先扫描/);
    await service.status();await service.saveAppearance({deviceId:firstId,name:' 我的键盘 ',imageDataUrl:png,deviceType:'keyboard'});
    await service.close();service=createKeyboardService({run,profileDirectory:directory});
    assert.equal(createAppearanceStore(directory).salt,salt);
    const devices=(await service.status()).devices;
    assert.deepEqual(devices[0].appearance,{name:'我的键盘',imageDataUrl:png,deviceType:'keyboard'});
    assert.deepEqual(devices[1].appearance,{name:'',imageDataUrl:'',deviceType:'auto'});
    await assert.rejects(service.saveAppearance({deviceId:firstId,name:'ok',imageDataUrl:'',deviceType:'joystick'}),/类型/);
    await assert.rejects(service.saveAppearance({deviceId:firstId,name:'x'.repeat(61),imageDataUrl:''}),/60/);
    await assert.rejects(service.saveAppearance({deviceId:firstId,name:'ok',imageDataUrl:'data:image/svg+xml,<svg/>'}),/PNG/);
    await assert.rejects(service.saveAppearance({deviceId:'../outside',name:'ok',imageDataUrl:''}),/先扫描/);
    assert.equal((await service.status()).devices[0].appearance.name,'我的键盘');
    await service.saveAppearance({deviceId:firstId,name:'',imageDataUrl:''});
    assert.deepEqual((await service.status()).devices[0].appearance,{name:'',imageDataUrl:'',deviceType:'auto'});
  }finally{await service?.close();fs.rmSync(directory,{recursive:true,force:true});}
});

test('a failed scan can be retried and cannot return an earlier connected result',async()=>{
  let reads=0;
  const service=createKeyboardService({run:async()=>{reads++;if(reads===1)return {devices:[{id:'sample'}]};if(reads===2)throw Error('unplugged');return {devices:[]};}});
  assert.equal((await service.status()).devices.length,1);
  await assert.rejects(service.status(),/unplugged/);
  assert.deepEqual(await service.status(),{devices:[]});await service.close();
});

test('closing before execution cancels the pending scan without spawning it',async()=>{
  let reads=0;
  const service=createKeyboardService({run:async()=>{reads++;return {devices:[]}}});
  const pending=service.status();const closed=service.close();
  await assert.rejects(pending,/closed/);await closed;assert.equal(reads,0);
});
