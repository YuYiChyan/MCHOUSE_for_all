'use strict';
const catalog=require('../catalog/melgeek-protocols.json');
function getMelgeekModels(){return catalog.models;}
function getMelgeekSupport(model){const row=catalog.models.find(row=>row.id===model.id&&model.brand==='melgeek');return row?{...row.support,modelId:row.id,source:catalog.source}:null;}
module.exports={getMelgeekModels,getMelgeekSupport};
