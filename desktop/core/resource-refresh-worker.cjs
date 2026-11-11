'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const ATK_BRANDS=['atk','vxe','vgn'];
const SINGLE_EXTRACTORS=new Set(['dareu','rapoo','aula','melgeek','keychron','monsgeek','akko','rk','redragon','inphic','xiberia','darmoshark','attackshark']);
async function refreshResources(brand,{load=require,resourceRoot=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'.local/share'),'One4All-Desktop/vendor-resources'),readCatalog=file=>JSON.parse(fs.readFileSync(file,'utf8'))}={}){
 let result,updatedBrands=[brand],counts;
 const catalogCount=item=>{const catalog=readCatalog(path.join(resourceRoot,item,'catalog.json')),models=catalog.devices||catalog.models;if(!Array.isArray(models))throw Error('资源目录缺少型号列表：'+item);return models.length;};
 if(ATK_BRANDS.includes(brand)){
  result=await load('../scripts/extract-atk-assets.cjs').main({resourceRoot});
  updatedBrands=[...ATK_BRANDS];
  counts=Object.fromEntries(updatedBrands.map(item=>[item,catalogCount(item)]));
 }else if(SINGLE_EXTRACTORS.has(brand)){
  result=await load('../scripts/extract-'+brand+'-assets.cjs').extract({outputRoot:path.join(resourceRoot,brand),updateRegistry:false});
  counts={[brand]:catalogCount(brand)};
 }
 else if(brand==='mchose')result=await load('../scripts/extract-mchose-assets.cjs').extractMchoseResources();
 else if(brand==='razer')result=await load('../scripts/extract-razer-assets.cjs').extract();
 else if(brand==='logitech')result=await load('../scripts/extract-logitech-assets.cjs').main();
 else throw Error('未登记的资源来源');
 result||={};counts??={[brand]:result.devices?.length??result.deviceCount??0};
 const warnings=[result.errors,result.stats?.errors,result.missingImages,result.stats?.missingImages,result.assets?.errors].flatMap(value=>Array.isArray(value)?value:[]);
 return {ok:true,brand,count:counts[brand],counts,updatedBrands,...warnings.length?{warnings}: {}};
}
if(process.parentPort)process.parentPort.on('message',async({data})=>{
 const {brand}=data;
 try{process.parentPort.postMessage(await refreshResources(brand));}
 catch(error){process.parentPort.postMessage({ok:false,brand,error:error.message});}
 finally{setTimeout(()=>process.exit(0),30);}
});
module.exports={refreshResources};
