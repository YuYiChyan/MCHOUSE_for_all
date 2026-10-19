import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {createAdapter}=require('../library/bridge/adapter.cjs');
const clients=require('../library/ui/device-client.js');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

test('accepted backend operations stay serialized; close drains them and rejects new work',async()=>{
  const events=[];let release;let closes=0;
  const gate=new Promise(resolve=>{release=resolve});
  const adapter=createAdapter({id:'test-device',status:async()=>{events.push('read');return {connected:false}},commands:{write:async()=>{events.push('write-start');await gate;events.push('write-end')}},close:()=>{closes++;events.push('close')}});
  const writing=adapter.invoke('write');
  const reading=adapter.status();
  const closing=adapter.close();
  await assert.rejects(adapter.status(),/closed/);
  release();await Promise.all([writing,reading,closing]);await adapter.close();
  assert.deepEqual(events,['write-start','write-end','read','close']);assert.equal(closes,1);
});

test('failed commands do not block recovery and the original whitelist cannot be expanded',async()=>{
  const commands={fail:()=>{throw Error('disconnected')}};
  const adapter=createAdapter({id:'test-device',status:()=>({connected:false}),commands});
  commands.shell=()=>true;
  await assert.rejects(adapter.invoke('fail'),/disconnected/);
  await assert.rejects(adapter.invoke('shell'),/Unsupported/);
  await assert.rejects(adapter.invoke('constructor'),/Unsupported/);
  assert.deepEqual(await adapter.status(),{connected:false});await adapter.close();
});

test('frontend clients preserve write acknowledgements and pairing selection without exposing IPC',async()=>{
  const mouse=clients.razer({razerSetPollRate:value=>({poll_rate:value}),closeEmbedded:()=>true});
  assert.deepEqual(await mouse.setPollRate(1000),{poll_rate:1000});
  await assert.rejects(mouse.status(),/设备接口/);
  assert.equal(mouse.invoke,undefined);
  let selected=null;
  const charger=clients.charger({pair:did=>{selected=did;return {ok:true}}});
  assert.deepEqual(await charger.pair('synthetic-device'),{ok:true});assert.equal(selected,'synthetic-device');
  assert.equal(charger.ipcRenderer,undefined);
});

test('example adapter requires a successful hardware readback',async()=>{
  const {fromBackend}=require('../library/examples/adapter.cjs');let rate=125;
  const adapter=fromBackend({transport:'private-usb',readState:()=>({connected:true,rate}),writeRate:()=>{},close:()=>{}});
  await assert.rejects(adapter.invoke('setRate',1000),/did not confirm/);
  await assert.rejects(adapter.invoke('setRate',999),/Unsupported rate/);
  await adapter.close();
});

test('every generated project contains the canonical library files and matching manifest entries',()=>{
  const mapping=JSON.parse(fs.readFileSync(path.join(root,'library/runtime-map.json'),'utf8'));
  const devices=JSON.parse(fs.readFileSync(path.join(root,'devices.json'),'utf8'));
  for(const device of devices){
    const manifest=JSON.parse(fs.readFileSync(path.join(root,device.folder,'manifest.json'),'utf8'));
    for(const entry of mapping){
      if(entry.projects&&!entry.projects.includes(device.folder))continue;
      assert.deepEqual(fs.readFileSync(path.join(root,'library',entry.source)),fs.readFileSync(path.join(root,device.folder,entry.target)),`${device.id}: ${entry.target}`);
      if(entry.target.startsWith('payload/'))assert.ok(manifest.files.some(file=>file.path===entry.target));
    }
  }
});
