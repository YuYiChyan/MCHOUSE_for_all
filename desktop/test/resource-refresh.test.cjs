'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{EventEmitter}=require('node:events');
const {createResourceRefresh}=require('../core/resource-refresh.cjs');
const {refreshResources}=require('../core/resource-refresh-worker.cjs');
function processDouble(){const children=[];return {children,utilityProcess:{fork(){const child=new EventEmitter();child.postMessage=value=>{child.request=value;};child.kill=()=>{child.killed=true;child.emit('exit',0);};children.push(child);return child;}}};}
test('ATK family refreshes once and returns each callers own brand and count',async()=>{
 const fake=processDouble(),refresh=createResourceRefresh(fake),atk=refresh.run('atk'),vxe=refresh.run('vxe'),vgn=refresh.run('vgn');assert.equal(fake.children.length,1);
 const counts={atk:18,vxe:4,vgn:7};fake.children[0].emit('message',{ok:true,brand:'atk',count:18,counts,updatedBrands:['atk','vxe','vgn']});
 const results=await Promise.all([atk,vxe,vgn]);assert.deepEqual(results.map(r=>[r.brand,r.count]),[['atk',18],['vxe',4],['vgn',7]]);
 const retry=refresh.run('vgn');assert.equal(fake.children.length,2);fake.children[1].emit('message',{ok:true,brand:'vgn',count:7,counts});await retry;refresh.close();
});
test('different brands remain independent; failure releases its job for retry',async()=>{
 const fake=processDouble(),refresh=createResourceRefresh(fake),rapoo=refresh.run('rapoo'),dareu=refresh.run('dareu');assert.equal(fake.children.length,2);
 const rejected=assert.rejects(rapoo,/下载失败/);fake.children[0].emit('message',{ok:false,error:'下载失败'});await rejected;
 fake.children[1].emit('message',{ok:true,brand:'dareu',count:7,counts:{dareu:7}});assert.equal((await dareu).count,7);
 const retry=refresh.run('rapoo');assert.equal(fake.children.length,3);fake.children[2].emit('message',{ok:true,brand:'rapoo',count:76});assert.equal((await retry).count,76);await assert.rejects(refresh.run('unknown'),/未知品牌/);refresh.close();
});
test('closing and timing out terminate only their pending refreshes',async()=>{
 const fake=processDouble(),refresh=createResourceRefresh(fake),pending=refresh.run('aula'),rejected=assert.rejects(pending,/停止/);refresh.close();await rejected;assert.equal(fake.children[0].killed,true);
 const second=processDouble(),timed=createResourceRefresh({...second,timeoutMs:5});await assert.rejects(timed.run('melgeek'),/超时/);assert.equal(second.children[0].killed,true);
});
test('ATK worker reads separate completed catalogues rather than the aggregate count',async()=>{
 const calls=[],root=path.resolve('fixture-resources'),counts={atk:18,vxe:4,vgn:7};const result=await refreshResources('vxe',{resourceRoot:root,load(file){calls.push(file);return {main:async options=>{assert.equal(options.resourceRoot,root);return {models:29,errors:[]};}};},readCatalog(file){return {devices:new Array(counts[path.basename(path.dirname(file))])};}});
 assert.deepEqual(calls,['../scripts/extract-atk-assets.cjs']);assert.equal(result.brand,'vxe');assert.equal(result.count,4);assert.deepEqual(result.counts,counts);assert.deepEqual(result.updatedBrands,['atk','vxe','vgn']);
});
test('new single-brand counts come from saved catalogues despite different extractor return shapes',async()=>{
 const summaries={dareu:{devices:[{}]},rapoo:{modelCount:76},aula:{models:12},melgeek:{stats:{models:20}}},counts={dareu:7,rapoo:76,aula:12,melgeek:20};
 for(const brand of Object.keys(summaries)){let calls=0;const root=path.resolve('fixture-resources'),result=await refreshResources(brand,{resourceRoot:root,load(file){assert.equal(file,'../scripts/extract-'+brand+'-assets.cjs');return {extract:async options=>{calls++;assert.equal(options.outputRoot,path.join(root,brand));assert.equal(options.updateRegistry,false);return {...summaries[brand],missingImages:[{url:'official-image',error:'404'}]};}};},readCatalog(file){assert.equal(file,path.join(root,brand,'catalog.json'));return {[brand==='aula'?'models':'devices']:new Array(counts[brand])};}});assert.equal(calls,1);assert.equal(result.brand,brand);assert.equal(result.count,counts[brand]);assert.deepEqual(result.updatedBrands,[brand]);assert.equal(result.warnings[0].error,'404');}
});
