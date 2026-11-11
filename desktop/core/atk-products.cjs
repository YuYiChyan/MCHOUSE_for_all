'use strict';

// Product cards group exact official names only; hardware settings remain per identity.
function uniqueFilters(filters){const seen=new Set();return filters.filter(filter=>{const key=[filter.vendorId,filter.productId,filter.usagePage,filter.usage,!!filter.receiver].join(':');if(seen.has(key))return false;seen.add(key);return true;});}
function mergeProducts(models){
 const groups=new Map();
 for(const row of models){
  const key=JSON.stringify([row.brand,row.name]);let product=groups.get(key);
  if(!product){product={...row,identifiers:[],variants:[],aliasIds:[],support:{provider:row.support.provider,protocol:row.support.protocol,status:'unverified',hardwareVerified:false,interfaceImplemented:true,reportId:row.support.reportId,hardwareProfiles:[]}};groups.set(key,product);}
  if(row.id!==product.id&&!product.aliasIds.includes(row.id))product.aliasIds.push(row.id);
  for(const id of row.aliasIds||[])if(id!==product.id&&!product.aliasIds.includes(id))product.aliasIds.push(id);
  product.identifiers.push(...row.identifiers);
  const profiles=row.support.hardwareProfiles||[{...row.support,id:row.id,identifiers:row.identifiers}];
  for(const profile of profiles)if(!product.support.hardwareProfiles.some(p=>p.id===profile.id))product.support.hardwareProfiles.push({...profile});
  for(const variant of row.variants){const previous=product.variants.find(v=>(v.id||v.name||v.imageUrl)===(variant.id||variant.name||variant.imageUrl));if(!previous)product.variants.push({...variant});else if(!previous.imagePath&&variant.imagePath)Object.assign(previous,variant);}
 }
 for(const product of groups.values()){
  product.identifiers=uniqueFilters(product.identifiers);
  const profiles=product.support.hardwareProfiles;
  product.support.cidMids=profiles.flatMap(p=>p.cidMids||[p.cidMid]);
  const identityCommands=[...new Set(profiles.map(p=>p.identityCommand||16))];
  if(identityCommands.length!==1)throw Error('Conflicting identity methods for '+product.name);
  product.support.identityCommand=identityCommands[0];
 }
 return [...groups.values()];
}
module.exports={mergeProducts,uniqueFilters};
