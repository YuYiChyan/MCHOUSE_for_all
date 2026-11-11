'use strict';
const catalog=require('../catalog/aula-protocols.json');
function getAulaSupport(model){const row=catalog.models.find(row=>model.brand==='aula'&&row.id===model.id);if(!row)return null;return {provider:catalog.provider,protocol:catalog.protocol,version:'1.0.0',status:'unverified',hardwareVerified:false,interfaceImplemented:true,configKey:row.configKey,config:row.config,connections:row.connections,filters:row.connections.map(({vendorId,productId,usagePage,usage})=>({vendorId,productId,usagePage,usage})),source:catalog.source};}
module.exports={getAulaSupport};
