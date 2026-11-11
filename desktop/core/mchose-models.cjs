'use strict';
const catalogue=require('../catalog/mchose-protocols.json');
const normalize=name=>String(name||'').replace(/^MCHOSE\s+/i,'').replace(/\s+/g,' ').trim().toLowerCase();
function getMchoseSupport(model){
  if(model.brand!=='mchose'||model.kind!=='mouse')return null;
  const protocol=catalogue.models.find(item=>normalize(item.name)===normalize(model.name));
  return protocol?{...protocol,modelId:model.id,source:catalogue.source,status:'unverified',provider:catalogue.provider,interfaceImplemented:true}:null;
}
function getMchoseModels(){return catalogue.models;}
module.exports={getMchoseSupport,getMchoseModels};
