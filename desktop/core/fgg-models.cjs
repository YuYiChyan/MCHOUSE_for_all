'use strict';
const catalog=require('../catalog/fgg-protocols.json');
function getFggSupport(model){
 if(model?.brand!=='fgg'||model.kind!=='keyboard')return null;
 const row=catalog.models.find(item=>item.id===model.id);
 return row?{...row.support,modelId:row.id,source:catalog.source}:null;
}
module.exports={getFggSupport,getFggModels:()=>catalog.models};
