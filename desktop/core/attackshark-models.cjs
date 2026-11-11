'use strict';
const catalog=require('../catalog/attackshark-protocols.json');
function getAttacksharkSupport(model){if(model.brand!=='attackshark'||model.kind!=='mouse')return null;return catalog.models.find(m=>m.id===model.id)?.support||null;}
module.exports={getAttacksharkSupport,getAttacksharkModels:()=>catalog.models};
