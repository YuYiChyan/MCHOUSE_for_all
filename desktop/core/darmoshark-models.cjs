'use strict';
const catalog=require('../catalog/darmoshark-protocols.json');
function getDarmosharkSupport(model){if(model.brand!=='darmoshark'||model.kind!=='mouse')return null;const row=catalog.models.find(row=>row.id===model.id);return row?{...row.support,modelId:model.id}:null;}
module.exports={getDarmosharkSupport,getDarmosharkModels:()=>catalog.models};
