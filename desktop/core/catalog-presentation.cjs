'use strict';

// Presentation grouping only. Members retain their real IDs, support and variants.
// Parenthesized transports and explicitly confirmed keyboard layout suffixes
// are grouped; generations, Pro/Max/Ultra, sizes and editions stay significant.
const TRANSPORT_SUFFIX=/\s*[（(](?:wired|wireless|receiver|bluetooth|usb|2\.4\s*g(?:hz)?|有线|无线|接收器|蓝牙)[)）]\s*$/i;
const text=value=>String(value??'').normalize('NFKC').replace(/\s+/g,' ').trim();
function displayName(model){
 const name=text(model.name)||String(model.id||'');
 // G HUB short labels omit these material revision names. Its description and
 // model record distinguish them, even though both cards are labelled "G502".
 if(model.brand==='logitech'&&['logitech-g502-core','logitech-g502-spectrum'].includes(model.id))return text(model.description)||name+' '+(model.id.endsWith('-core')?'Proteus Core':'Proteus Spectrum');
 if(model.brand==='logitech'&&model.id==='logitech-yeti-original-nano')return name+'（原版）';
 // MCHOSE cardList.json records 1/2/3 explicitly name the same Ace 60 Pro
 // product with base, ISO FR and Nordic layouts. Only their display is shared.
 if(model.brand==='mchose'&&model.kind==='keyboard'&&/^Ace 60 Pro (?:ISO FR|Nordic)$/i.test(name))return 'Ace 60 Pro';
 return name.replace(TRANSPORT_SUFFIX,'').trim();
}
function productKey(model){
 const name=displayName(model).toLocaleLowerCase('en-US');
 return JSON.stringify([text(model.brand).toLocaleLowerCase('en-US'),text(model.kind),model.catalogRole||'device',name||model.id]);
}
function imageKey(variant){
 const value=variant.originalImageUrl||variant.imageUrl||variant.artUrl||variant.image||variant.imagePath||variant.source?.thumbnail;
 if(!value)return null;
 const source=String(value);
 if(/^(?:file:|[a-z]:[\\/])/i.test(source)){try{return decodeURIComponent(source).replace(/^file:\/\/\//i,'').replace(/\\/g,'/').toLowerCase();}catch{return source.replace(/\\/g,'/').toLowerCase();}}
 return source;
}
function buildCatalogPresentation(devices){
 const grouped=new Map();
 for(const model of devices||[]){
  const key=productKey(model);let group=grouped.get(key);
  if(!group){group={...model,displayName:displayName(model),members:[],variants:[],presentationId:model.id};grouped.set(key,group);}
  group.members.push(model);
 }
 for(const group of grouped.values()){
  const variantsByKey=new Map(),usedIds=new Set();
  for(const member of group.members)for(const [index,variant]of (member.variants||[]).entries()){
   const originalId=String(variant.id??index),image=imageKey(variant),key=image?'image:'+image:'variant:'+member.id+':'+originalId;
   let target=variantsByKey.get(key);
   if(!target){let id=originalId;if(usedIds.has(id))id=String(member.id)+':'+originalId;let suffix=2;while(usedIds.has(id))id=String(member.id)+':'+originalId+':'+suffix++;usedIds.add(id);
    target={...variant,id,memberIds:[],sourceVariants:[]};variantsByKey.set(key,target);group.variants.push(target);
   }else if(!target.imageUrl&&variant.imageUrl){target.imageUrl=variant.imageUrl;if(variant.imagePath)target.imagePath=variant.imagePath;}
   if(!target.memberIds.includes(member.id))target.memberIds.push(member.id);
   if(!target.sourceVariants.some(v=>v.modelId===member.id&&v.variantId===originalId))target.sourceVariants.push({modelId:member.id,variantId:originalId});
  }
  group.hasImage=group.members.some(m=>m.hasImage===true)||group.variants.some(v=>Boolean(v.imageUrl||v.artUrl||v.image));
 }
 return [...grouped.values()];
}
module.exports={buildCatalogPresentation};
