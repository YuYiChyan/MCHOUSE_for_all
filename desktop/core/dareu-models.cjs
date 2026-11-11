'use strict';
const catalog=require('../catalog/dareu-protocols.json');
function getDareuSupport(model){if(model.brand!=='dareu'||model.kind!=='mouse')return null;const row=catalog.models.find(row=>row.id===model.id);return row?{...row.support,modelId:model.id}:null;}
module.exports={getDareuSupport,getDareuModels:()=>catalog.models};
