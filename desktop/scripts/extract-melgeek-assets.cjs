'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const protocols=require('../catalog/melgeek-protocols.json');
const {RESOURCE_FILES}=require('../core/melgeek-runtime.cjs');
const ORIGIN='https://hive.melgeek.com/';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function fetchBytes(url){const response=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error('MelGeek 资源下载失败：'+response.status);return Buffer.from(await response.arrayBuffer());}
function write(file,bytes){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',bytes);fs.renameSync(file+'.tmp',file);}
async function extract({outputRoot=path.join(process.env.LOCALAPPDATA||process.cwd(),'One4All-Desktop/vendor-resources/melgeek')}={}){
 const runtimeRoot=path.join(outputRoot,'runtime');
 const wasm=await fetchBytes(protocols.runtime.url);
 if(hash(wasm)!==protocols.runtime.sha256)throw Error('MelGeek 官方设备模块版本已变化，需要同步控制接口后更新');
 write(path.join(runtimeRoot,'mghive_core_bg.wasm'),wasm);
 await Promise.all(RESOURCE_FILES.map(async name=>{const bytes=await fetchBytes(ORIGIN+'default/devices/'+name+'.json');JSON.parse(bytes.toString('utf8'));write(path.join(runtimeRoot,name+'.json'),bytes);}));
 const devices=[],missingImages=[];
 for(const model of protocols.models){
  const variants=[];
  for(const image of model.artwork){
   const url=ORIGIN+'device_picture/keyboard/'+encodeURIComponent(image.asset)+'.png';
   try{const bytes=await fetchBytes(url);if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('原厂商品图暂不可用');const imagePath=path.join(outputRoot,'images',image.asset+'.png');write(imagePath,bytes);variants.push({id:image.asset,name:image.name,color:image.color,imagePath,imageUrl:url,sha256:hash(bytes)});}catch(error){missingImages.push({model:model.name,asset:image.asset,error:error.message});}
  }
  devices.push({...model,variants,catalogRole:'device',source:protocols.source});
 }
 const result={schema:1,brand:'melgeek',source:protocols.source,generatedAt:new Date().toISOString(),devices,stats:{models:devices.length,withImages:devices.filter(d=>d.variants.length).length,images:devices.reduce((sum,d)=>sum+d.variants.length,0),missingImages,runtimeBytes:wasm.length}};
 write(path.join(outputRoot,'catalog.json'),JSON.stringify(result,null,2)+'\n');
 return result;
}
module.exports={extract};
if(require.main===module)extract().then(result=>console.log(JSON.stringify(result.stats))).catch(error=>{console.error(error.message);process.exitCode=1;});
