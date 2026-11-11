'use strict';
const fs=require('node:fs'),path=require('node:path');
const brands=new Set(['keychron','monsgeek','akko','rk','redragon']);
function getOfficialViaModels(brand){if(!brands.has(brand))return [];const file=path.join(__dirname,'../catalog',brand+'-protocols.json');return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')).models:[];}
function getOfficialViaSupport(model){const row=getOfficialViaModels(model.brand).find(row=>row.id===model.id);return row?{...row.support,modelId:row.id}:null;}
module.exports={getOfficialViaModels,getOfficialViaSupport};
