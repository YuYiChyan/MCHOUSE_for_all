import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {viaEligibility}=createRequire(import.meta.url)('../library/hid/via-eligibility.cjs');
const device={id:'fixture',vendorId:0x1234,productId:0x5678,collections:[{usagePage:0xFF60,usage:0x61,inputBytes:33,outputBytes:33}]};
const catalog={[device.vendorId*65536+device.productId]:true};
test('unlisted VIA devices remain connectable and missing interfaces still allow an attempt',()=>{
  assert.equal(viaEligibility(device,[device],{}).available,true);
  assert.equal(viaEligibility(device,[device],{}).catalogListed,false);
  const unknown=viaEligibility({...device,collections:[]},[device],{});assert.equal(unknown.available,false);assert.equal(unknown.canAttempt,true);
  const value=viaEligibility(device,[device],catalog);assert.equal(value.available,true);assert.equal(value.protocolVerified,false);
  assert.equal(viaEligibility({...device,collections:[{...device.collections[0],outputBytes:8}]},[device],catalog).canAttempt,true);
});
test('duplicate VID/PID devices are not silently bound to the wrong keyboard',()=>{
  const value=viaEligibility(device,[device,{...device,id:'other'}],catalog);assert.equal(value.available,true);assert.equal(value.multiple,true);assert.equal(value.canAttempt,true);
});
