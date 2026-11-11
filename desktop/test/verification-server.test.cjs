'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createVerificationServer,serverAddress}=require('../core/verification-server.cjs');
function root(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'one4all-verification-server-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
const record={modelId:'logitech-g309',providerVersion:'hidpp-0.1',features:[{id:'dpi',status:'verified',reports:2},{id:'pollRate',status:'reported',reports:1}],updatedAt:'2026-11-12T01:00:00Z'};
const response=body=>({ok:true,status:200,json:async()=>body});
test('empty configuration and saving an address never contact a server',async t=>{
  let calls=0;const service=createVerificationServer({dataRoot:root(t),fetchImpl:async()=>{calls++;throw Error('must not connect');}});
  assert.equal(service.config().configured,false);assert.equal((await service.refresh()).configured,false);
  await assert.rejects(service.submit({}),/尚未配置/);
  service.saveConfig({baseURL:'https://example.test/verification/'});assert.equal(service.config().baseURL,'https://example.test/verification');assert.equal(calls,0);
  assert.throws(()=>serverAddress('https://token@example.test'),/凭据/);assert.throws(()=>serverAddress('https://example.test?key=secret'),/查询参数/);
});
test('refresh persists exact model/version/feature states and sends the cursor on later calls',async t=>{
  const dataRoot=root(t),urls=[];
  const service=createVerificationServer({dataRoot,fetchImpl:async url=>{urls.push(url);return response({records:urls.length===1?[record]:[{...record,features:[{id:'dpi',status:'disputed',reports:3}]}],nextCursor:'revision-'+urls.length});}});
  service.saveConfig({baseURL:'https://example.test/base'});
  const first=await service.refresh();assert.equal(first.updated,1);assert.equal(first.records[0].scope,'server');assert.equal(first.records[0].features[0].status,'verified');
  const restored=createVerificationServer({dataRoot});assert.equal(restored.list()[0].providerVersion,'hidpp-0.1');assert.equal(restored.config().cursor,'revision-1');
  await service.refresh();assert.equal(urls[0],'https://example.test/base/v1/verifications');assert.equal(new URL(urls[1]).searchParams.get('cursor'),'revision-1');assert.equal(service.list()[0].features[0].status,'disputed');
  assert.equal(service.list()[0].serverURL,'https://example.test/base');
});
test('changing server clears old cached state; failures preserve last valid state',async t=>{
  let broken=false;const service=createVerificationServer({dataRoot:root(t),fetchImpl:async()=>broken?{ok:false,status:503}:response({records:[record],nextCursor:'cursor'})});
  service.saveConfig({baseURL:'https://first.test'});await service.refresh();broken=true;await assert.rejects(service.refresh(),/503/);assert.equal(service.list().length,1);
  service.saveConfig({baseURL:'https://second.test'});assert.equal(service.list().length,0);assert.equal(service.config().cursor,null);
  service.saveConfig({baseURL:''});assert.equal(service.config().configured,false);
});
test('reports require hardware confirmation and only submit chosen public fields',async t=>{
  let calls=0,request;const service=createVerificationServer({dataRoot:root(t),fetchImpl:async(url,options)=>{calls++;request={url,options};return response({reportId:'report-123',status:'received',receivedAt:'2026-11-12T01:00:00Z'});}});
  service.saveConfig({baseURL:'https://example.test'});
  const report={modelId:record.modelId,providerVersion:record.providerVersion,features:['pollRate','dpi'],hardwareConfirmed:true,serial:'SECRET_SERIAL',hidPath:'SECRET_PATH',notes:'token: ghp_privatevalue'};
  await assert.rejects(service.submit({...report,hardwareConfirmed:false}),/实机/);assert.equal(calls,0);
  const [a,b]=await Promise.all([service.submit(report),service.submit(report)]);assert.equal(calls,1);assert.equal(a.reportId,b.reportId);assert.equal(a.status,'received');assert.equal(a.scope,'server');
  assert.equal(request.url,'https://example.test/v1/reports');assert.equal(request.options.method,'POST');assert.match(request.options.headers['Idempotency-Key'],/^[a-f0-9]{64}$/);
  for(const secret of ['SECRET_SERIAL','SECRET_PATH','ghp_privatevalue'])assert.ok(!request.options.body.includes(secret));
  assert.deepEqual(JSON.parse(request.options.body).features,['dpi','pollRate']);assert.deepEqual(service.list(),[]);
});
test('invalid server states never replace cached records or imply local confirmation',async t=>{
  const dataRoot=root(t),service=createVerificationServer({dataRoot,fetchImpl:async()=>response({records:[{...record,features:[{id:'dpi',status:'all-models-verified'}]}],nextCursor:'bad'})});
  service.saveConfig({baseURL:'https://example.test'});await assert.rejects(service.refresh(),/未知验证状态/);assert.deepEqual(service.list(),[]);assert.equal(fs.existsSync(path.join(dataRoot,'local-verifications.json')),false);
});
