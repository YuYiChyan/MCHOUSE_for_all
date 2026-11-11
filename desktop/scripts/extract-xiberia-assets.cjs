'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const catalog=require('../catalog/xiberia-headsets.json');
async function extract({outputRoot=path.join(process.env.LOCALAPPDATA||process.cwd(),'One4All-Desktop/vendor-resources/xiberia')}={}){
 fs.mkdirSync(path.join(outputRoot,'assets'),{recursive:true});
 const devices=catalog.models.map(model=>({...model,variants:model.variants.map(variant=>{
  const original=path.join(__dirname,'../core/xiberia/product-assets',variant.file),target=path.join(outputRoot,'assets',variant.file),bytes=fs.readFileSync(original);
  if(crypto.createHash('sha256').update(bytes).digest('hex')!==variant.sha256)throw Error('西伯利亚商品图与原厂资源记录不一致：'+variant.file);
  fs.writeFileSync(target,bytes);return {...variant,imagePath:target};
 })}));
 const result={schema:1,generatedAt:new Date().toISOString(),source:catalog.source,stats:{models:devices.length,variants:devices.reduce((n,model)=>n+model.variants.length,0)},devices};
 fs.writeFileSync(path.join(outputRoot,'catalog.json'),JSON.stringify(result,null,2));return result;
}
module.exports={extract};if(require.main===module)extract().then(result=>console.log(JSON.stringify(result.stats))).catch(error=>{console.error(error);process.exitCode=1;});
