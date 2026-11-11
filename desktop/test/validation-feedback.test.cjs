'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {createValidationFeedback} = require('../core/validation-feedback.cjs');
const sample = {model:{id:'logitech-g502-test',name:'G502',brand:'logitech',support:{provider:'hidpp'},serial:'PRIVATE_SERIAL',path:'PRIVATE_HID_PATH'},providerVersion:'hidpp-0.1',checks:['dpi','pollRate'],hardwareConfirmed:true};
function root(t) {const dir=fs.mkdtempSync(path.join(os.tmpdir(),'one4all-validation-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
const cryptoCallbacks = {encryptString:value=>Buffer.from(value).map(byte=>byte^0x55),decryptString:value=>Buffer.from(value).map(byte=>byte^0x55).toString()};
test('requires actual hardware declaration and selected features; public report omits device identity',t=>{
  const service=createValidationFeedback({dataRoot:root(t)});
  assert.throws(()=>service.prepare({...sample,hardwareConfirmed:false}),/实物/);
  assert.throws(()=>service.prepare({...sample,checks:['inventedFeature']}),/至少一项/);
  assert.throws(()=>service.prepare({...sample,providerVersion:''}),/版本/);
  const report=service.prepare({...sample,notes:'token: ghp_12345678 序列号: private123 C:\\Users\\private\\device.log'});
  assert.equal(report.modelId,sample.model.id);assert.deepEqual(report.checks,['dpi','pollRate']);
  for(const secret of ['PRIVATE_SERIAL','PRIVATE_HID_PATH','private123','ghp_12345678','C:\\Users']) assert.ok(!report.body.includes(secret),secret);
  assert.match(report.body,/其他型号及未测试的功能仍待验证/);
  assert.match(report.body,/支持库型号 ID/);
});
test('without token opens a prefilled browser issue, never reports it submitted or calls API',async t=>{
  const opened=[];
  const service=createValidationFeedback({dataRoot:root(t),openExternal:async url=>opened.push(url),fetchImpl:()=>{throw Error('Must not POST');}});
  const report=service.prepare(sample),result=await service.submit(report.id);
  assert.equal(result.submitted,false);assert.equal(result.mode,'browser');assert.equal(opened.length,1);
  const url=new URL(opened[0]);assert.equal(url.origin,'https://github.com');assert.equal(url.pathname,'/YuYiChyan/MCHOUSE_for_all/issues/new');assert.equal(url.searchParams.get('body'),report.body);
  assert.deepEqual(service.list(),[]);
});
test('encrypted token stays out of public configuration, reports, and plaintext disk',t=>{
  const dir=root(t),service=createValidationFeedback({dataRoot:dir,...cryptoCallbacks});
  service.saveConfig({token:'arbitrary-secret-value'});
  assert.deepEqual(service.config(),{repository:'YuYiChyan/MCHOUSE_for_all',tokenConfigured:true,tokenPersistence:'encrypted'});
  assert.ok(!fs.readFileSync(path.join(dir,'validation-config.json'),'utf8').includes('arbitrary-secret-value'));
  assert.ok(!service.prepare({...sample,notes:'arbitrary-secret-value'}).body.includes('arbitrary-secret-value'));
  const restored=createValidationFeedback({dataRoot:dir,...cryptoCallbacks});assert.equal(restored.config().tokenConfigured,true);
  restored.saveConfig({clearToken:true});assert.equal(restored.config().tokenConfigured,false);
  const session=createValidationFeedback({dataRoot:dir});session.saveConfig({token:'session-secret'});
  assert.equal(session.config().tokenPersistence,'session');assert.ok(!fs.readFileSync(path.join(dir,'validation-config.json'),'utf8').includes('session-secret'));
});
test('a confirmed report posts once even across parallel clicks or restart; forged bodies are ignored',async t=>{
  const dir=root(t);let requests=0,posted;
  const fetchImpl=async(url,options)=>{requests++;posted=JSON.parse(options.body);assert.equal(url,'https://api.github.com/repos/YuYiChyan/MCHOUSE_for_all/issues');assert.equal(options.method,'POST');return {status:201,json:async()=>({number:72,html_url:'https://github.com/YuYiChyan/MCHOUSE_for_all/issues/72'})};};
  const service=createValidationFeedback({dataRoot:dir,...cryptoCallbacks,fetchImpl});service.saveConfig({token:'test-token'});
  const report=service.prepare(sample);
  const results=await Promise.all([service.submit({...report,body:'FORGED'}),service.submit(report.id)]);
  assert.equal(requests,1);assert.equal(posted.body,report.body);assert.equal(results[0].submitted,true);assert.equal(service.list()[0].url,results[0].url);
  const next=createValidationFeedback({dataRoot:dir,...cryptoCallbacks,fetchImpl});const repeated=await next.submit(next.prepare(sample));
  assert.equal(repeated.duplicate,true);assert.equal(requests,1);assert.equal(repeated.modelId,sample.model.id);
});
test('permission errors are actionable and do not mark the report verified',async t=>{
  const service=createValidationFeedback({dataRoot:root(t),fetchImpl:async()=>({status:401})});service.saveConfig({token:'invalid-token'});
  await assert.rejects(service.submit(service.prepare(sample)),/登录凭据无效/);
  assert.equal(service.list()[0].submitted,false);assert.equal(service.list()[0].status,'failed');
});
test('uncertain network result prevents an accidental duplicate POST',async t=>{
  let requests=0;
  const service=createValidationFeedback({dataRoot:root(t),fetchImpl:async()=>{requests++;throw Error('timeout');}});service.saveConfig({token:'test-token'});
  const report=service.prepare(sample);
  await assert.rejects(service.submit(report),/避免重复提交/);
  const next=await service.submit(report);assert.equal(next.status,'uncertain');assert.equal(next.submitted,false);assert.equal(requests,1);
});
