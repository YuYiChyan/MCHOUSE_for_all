'use strict';
const catalog=require('../catalog/rapoo-protocols.json');
function getRapooSupport(model){if(model.brand!=='rapoo'||model.kind!=='mouse')return null;const row=catalog.models.find(row=>row.id===model.id);return row?{...row.support,modelId:model.id}:null;}
module.exports={getRapooSupport,getRapooModels:()=>catalog.models};
