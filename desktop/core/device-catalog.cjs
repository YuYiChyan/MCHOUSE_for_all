'use strict';
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {getMchoseSupport}=require('./mchose-models.cjs');
const {getLogitechSupport,loadCatalog:logitechModels}=require('./logitech-models.cjs');
const {BRANDS,getDomesticSupport}=require('./domestic-models.cjs');
function createDeviceCatalog({resourceRoot}){
 function read(){const devices=[],sources=[];for(const brand of Object.keys(BRANDS)){const file=path.join(resourceRoot,brand,'catalog.json');if(!fs.existsSync(file))continue;const data=JSON.parse(fs.readFileSync(file,'utf8'));const rows=data.devices||data.models||[];sources.push({brand,count:rows.length,source:data.source,stats:data.stats||{},generatedAt:data.generatedAt});for(const row of rows){const variants=(row.variants||[]).map((v,index)=>{let imageUrl=null;if(v.imagePath&&fs.existsSync(v.imagePath))imageUrl=pathToFileURL(v.imagePath).href;return {...v,id:String(v.id??index),imageUrl,originalImageUrl:v.imageUrl};});if(!variants.length&&row.imagePath&&fs.existsSync(row.imagePath))variants.push({id:'original',name:'原厂图',imageUrl:pathToFileURL(row.imagePath).href});devices.push({...row,brand,id:row.id||brand+'-'+devices.length,variants,hasImage:variants.some(v=>v.imageUrl),support:row.support||{status:'catalog-only'}});}}return {devices,sources};}
 function supported(){const catalog=read();
  // Reuse the original, separately packaged G309 artwork and exact protocol entry.
  if(!catalog.devices.some(model=>model.id==='logitech-g309')){const model=logitechModels().models.find(model=>model.id==='logitech-g309');if(model){const variants=['black','white'].map(color=>({id:color,name:color==='black'?'黑色':'白色',color:color==='black'?'#202124':'#f2f2f2',imagePath:path.join(__dirname,'../app/assets/logitech/g309-'+color+'.png')})).filter(v=>fs.existsSync(v.imagePath)).map(v=>({...v,imageUrl:pathToFileURL(v.imagePath).href}));if(variants.length)catalog.devices.push({...model,variants,hasImage:true,catalogRole:'device',source:{...model.source,artwork:'Original One4All logitech-g309 package'}});}}
  for(const model of catalog.devices){const implemented=model.brand==='mchose'?getMchoseSupport(model):model.brand==='logitech'?getLogitechSupport(model):getDomesticSupport(model);if(implemented)model.support={...model.support,...implemented};}return catalog;
 }
 return {list:supported,get(id){const found=supported().devices.find(d=>d.id===id||d.aliasIds?.includes(id));if(!found)throw Error('没有找到该型号');return found;}};
}
module.exports={createDeviceCatalog};
