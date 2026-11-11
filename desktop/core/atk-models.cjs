'use strict';
const catalog=require('../catalog/atk-protocols.json');
const vgn=require('../catalog/vgn-protocols.json');
const {mergeProducts,uniqueFilters}=require('./atk-products.cjs');
const products=mergeProducts([...catalog.models,...vgn.models]);
function getAtkSupport(model){const source=model.brand==='vgn'?vgn:catalog,row=products.find(row=>(row.id===model.id||row.aliasIds.includes(model.id))&&row.brand===model.brand);return row?{...row.support,modelId:row.id,aliasIds:row.aliasIds,filters:uniqueFilters([...row.identifiers,...(source.receiverFilters||[])]),dpiTables:catalog.dpiTables,source:source.source}:null;}
module.exports={getAtkSupport,getAtkModels:()=>products};
