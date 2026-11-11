'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const catalog=require('../catalog/fgg-protocols.json');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function extract({outputRoot=path.join(process.env.LOCALAPPDATA,'One4All-Desktop/vendor-resources/fgg'),offline=false,fetchImpl=globalThis.fetch}={}){
 const assetsRoot=path.join(outputRoot,'assets'),sourceRoot=path.join(outputRoot,'source');
 fs.mkdirSync(assetsRoot,{recursive:true});
 const images=new Map();
 for(const model of catalog.models)for(const variant of model.variants){
  if(images.has(variant.imageUrl))continue;
  const file=path.join(assetsRoot,path.basename(variant.imageFile)),cached=path.join(sourceRoot,path.basename(variant.imageFile));
  let bytes;
  if(fs.existsSync(file))bytes=fs.readFileSync(file);
  else if(fs.existsSync(cached))bytes=fs.readFileSync(cached);
  else{
   if(offline)throw Error('缺少 FGG 原厂图片缓存：'+variant.imageFile);
   const response=await fetchImpl(variant.imageUrl,{signal:AbortSignal.timeout(30000)});
   if(!response.ok||!response.headers.get('content-type')?.includes('image'))throw Error('FGG 原厂图片下载失败：'+variant.imageFile);
   bytes=Buffer.from(await response.arrayBuffer());
  }
  if(sha(bytes)!==variant.sha256)throw Error('FGG 原厂图片版本已变化：'+variant.imageFile);
  fs.writeFileSync(file,bytes);images.set(variant.imageUrl,file);
 }
 const devices=catalog.models.map(model=>({...model,variants:model.variants.map(variant=>({...variant,imagePath:images.get(variant.imageUrl)}))}));
 const result={schema:1,brand:'fgg',source:catalog.source,generatedAt:new Date().toISOString(),stats:{models:devices.length,products:new Set(devices.map(d=>d.name)).size,images:images.size,variants:devices.reduce((n,d)=>n+d.variants.length,0)},devices};
 fs.writeFileSync(path.join(outputRoot,'catalog.json'),JSON.stringify(result,null,2));return result;
}
module.exports={extract};
if(require.main===module)extract({offline:process.argv.includes('--offline')}).then(result=>console.log(JSON.stringify(result.stats))).catch(error=>{console.error(error);process.exitCode=1;});
