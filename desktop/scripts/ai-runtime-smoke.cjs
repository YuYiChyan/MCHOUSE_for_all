'use strict';
// Isolated protocol fixture: no hardware calls and no real provider credentials.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {app,utilityProcess}=require('electron');
const {createAiAdapter}=require('../core/ai-adapter.cjs');
const {createAdapterRunner}=require('../core/adapter-runner.cjs');
app.whenReady().then(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'one4all-ai-smoke-'));
 const candidate={manifest:{id:'fixture-adapter',version:'0.1.0',entry:'adapter.cjs',matches:[]},files:[{path:'adapter.cjs',content:"exports.createAdapter=()=>({probe:async()=>({connected:false,interfaceConfirmed:false,provider:'fixture',version:'1',evidence:[],capabilities:[]}),execute:async()=>{throw Error('fixture has no hardware')},close:async()=>{}})"}],capabilities:[],report:{summary:'Protocol fixture only'}};
 const server=http.createServer((req,res)=>{let data='';req.on('data',chunk=>data+=chunk);req.on('end',()=>{const request=JSON.parse(data);assert.equal(req.url,'/v1/chat/completions');assert.equal(req.headers.authorization,'Bearer fixture-key');res.setHeader('content-type','application/json');res.end(JSON.stringify({model:'fixture',choices:[{message:{content:request.messages.length===1?'OK':JSON.stringify(candidate)}}]}));});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const ai=createAiAdapter({dataRoot:root,getPackageContext:()=>({evidenceStatus:'fixture'})});const runner=createAdapterRunner({stateRoot:root,utilityProcess});
 try{ai.saveConfig({baseURL:'http://127.0.0.1:'+server.address().port,model:'fixture',apiKey:'fixture-key'});assert.equal((await ai.testConnection()).ok,true);const draft=await ai.generate({packageId:'mchose',instructions:'Fixture only'});const report=await runner.start(draft,root,{});assert.equal(report.connected,false);assert.deepEqual(report.capabilities,[]);assert.throws(()=>runner.execute({id:draft.id,command:'write',payload:{capability:'keymap'}}));console.log(JSON.stringify({ok:true,checks:['compatible HTTP request','draft persisted','real utility process loaded adapter','unconnected fixture exposes no controls','unreported commands rejected']}));}
 finally{runner.stop();server.close();setTimeout(()=>app.quit(),1800);}
}).catch(error=>{console.error(error);app.exit(1);});
