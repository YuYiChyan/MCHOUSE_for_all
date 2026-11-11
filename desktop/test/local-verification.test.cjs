'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createLocalVerification}=require('../core/local-verification.cjs');
const target={modelId:'logitech-g309',providerVersion:'hidpp2-0.1'};
function root(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'one4all-local-verification-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
test('local confirmation survives restart without changing any public catalog',t=>{
  const dataRoot=root(t),service=createLocalVerification({dataRoot});
  assert.equal(service.status(target).confirmed,false);
  const record=service.set({...target,confirmed:true});
  assert.equal(record.scope,'local');assert.equal(record.confirmed,true);assert.ok(record.confirmedAt);
  const restored=createLocalVerification({dataRoot});assert.deepEqual(restored.status(target),record);
  assert.deepEqual(fs.readdirSync(dataRoot),['local-verifications.json']);
});
test('confirmations are isolated by exact model ID and adapter version',t=>{
  const service=createLocalVerification({dataRoot:root(t)});service.set({...target,confirmed:true});
  assert.equal(service.status({...target,providerVersion:'hidpp2-0.2'}).confirmed,false);
  assert.equal(service.status({...target,modelId:'logitech-g305'}).confirmed,false);
  service.set({modelId:'same:member',providerVersion:'a:b',confirmed:true});
  assert.equal(service.status({modelId:'same',providerVersion:'member:a:b'}).confirmed,false);
  assert.equal(service.list().length,2);
});
test('revocation persists and leaves other confirmations intact',t=>{
  const dataRoot=root(t),service=createLocalVerification({dataRoot}),other={...target,providerVersion:'hidpp2-0.2'};
  service.set({...target,confirmed:true});service.set({...other,confirmed:true});
  const revoked=service.set({...target,confirmed:false});assert.equal(revoked.confirmed,false);assert.equal(revoked.confirmedAt,null);
  const restored=createLocalVerification({dataRoot});assert.equal(restored.status(target).confirmed,false);assert.equal(restored.status(other).confirmed,true);assert.equal(restored.list().length,1);
});
test('requires explicit boolean and a usable model/version identity',t=>{
  const service=createLocalVerification({dataRoot:root(t)});
  assert.throws(()=>service.set({...target,confirmed:'true'}),/确认或撤销/);
  assert.throws(()=>service.set({...target,providerVersion:'',confirmed:true}),/版本/);
  assert.throws(()=>service.status({...target,modelId:''}),/型号/);
  assert.equal(service.list().length,0);
});
