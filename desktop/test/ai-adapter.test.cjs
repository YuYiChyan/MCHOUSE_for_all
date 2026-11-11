'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {createAiAdapter,completionEndpoint,parseCandidate} = require('../core/ai-adapter.cjs');
const sample = { manifest:{id:'sample',version:'0.1.0',entry:'adapter.cjs',verification:'passed'}, files:[{path:'adapter.cjs',content:'throw new Error("This must not execute while generating");'}], capabilities:[],report:{summary:'Needs device connection',verification:'passed'} };
function root(t) { const dir = fs.mkdtempSync(path.join(os.tmpdir(),'one4all-ai-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir; }
test('normalizes compatible endpoints without losing custom URL prefixes',()=>{
  assert.equal(completionEndpoint('https://api.deepseek.com'),'https://api.deepseek.com/v1/chat/completions');
  assert.equal(completionEndpoint('http://127.0.0.1:1234/v1/'),'http://127.0.0.1:1234/v1/chat/completions');
  assert.equal(completionEndpoint('https://example.test/custom/chat/completions'),'https://example.test/custom/chat/completions');
  assert.throws(()=>completionEndpoint('https://key@host/v1'));
});
test('persists encrypted credentials and exposes no API key from config()', t=>{
  const dir=root(t);
  const ai=createAiAdapter({dataRoot:dir,encryptString:value=>Buffer.from(value).map(byte=>byte^0x55),decryptString:value=>Buffer.from(value).map(byte=>byte^0x55).toString()});
  const result=ai.saveConfig({baseURL:'https://api.example.test/v1',model:'test',apiKey:'test-secret-key'});
  assert.equal(result.keyConfigured,true);assert.equal(result.apiKey,undefined);assert.equal(result.keyPersistence,'encrypted');
  assert.ok(!fs.readFileSync(path.join(dir,'ai-config.json'),'utf8').includes('test-secret-key'));
  ai.saveConfig({clearApiKey:true});assert.equal(ai.config().keyConfigured,false);
});
test('candidate files are saved without executing code, and verified claims are removed',async t=>{
  const dir=root(t);let request;
  const ai=createAiAdapter({dataRoot:dir,getPackageContext:()=>({evidenceStatus:'missing'}),fetchImpl:async (url,options)=>{request=JSON.parse(options.body);return {ok:true,status:200,text:async()=>JSON.stringify({model:'test',choices:[{message:{content:'```json\n'+JSON.stringify(sample)+'\n```'}}]})};}});
  ai.saveConfig({model:'test',apiKey:'session-secret'});
  const result=await ai.generate({packageId:'sample',context:'Exports have not been extracted.'});
  assert.equal(result.verification,'unverified');assert.equal(result.manifest.verification,'unverified');assert.equal(result.report.verification,'unverified');assert.equal(result.candidateReady,true);
  assert.ok(fs.existsSync(path.join(result.directory,'adapter.cjs')));
  assert.ok(request.messages[1].content.includes('missing'));
  assert.ok(!fs.readFileSync(path.join(dir,'ai-config.json'),'utf8').includes('session-secret'));
});
test('model paths cannot escape the candidate directory or pretend missing entries exist',()=>{
  for(const p of ['../outside.cjs','C:/outside.cjs','nested/../../outside.cjs','foo\\bar.cjs','helper.exe']) assert.throws(()=>parseCandidate(JSON.stringify({...sample,files:[{path:p,content:''}]})));
  assert.throws(()=>parseCandidate(JSON.stringify({...sample,files:[{path:'helper.js',content:''}]})),/入口/);
  const report=parseCandidate(JSON.stringify({...sample,files:[]})); assert.equal(report.candidateReady,false);
});
