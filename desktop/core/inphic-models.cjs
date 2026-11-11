'use strict';
const catalog=require('../catalog/inphic-protocols.json');
function getInphicSupport(model){const row=catalog.models.find(r=>model.brand==='inphic'&&r.id===model.id);return row?{...row,provider:catalog.provider,protocol:'inphic-usb-feature-v1',version:'1.0.0',status:'unverified',hardwareVerified:false,interfaceImplemented:true,connectionLabel:'USB 有线设置',filters:row.connections,source:catalog.source}:null;}
module.exports={getInphicSupport};
