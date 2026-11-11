'use strict';
const fs=require('node:fs'),path=require('node:path');
const BRANDS=Object.freeze({mchose:'迈从',razer:'雷蛇',logitech:'罗技',atk:'ATK',vxe:'VXE',vgn:'VGN',dareu:'达尔优',rapoo:'雷柏',aula:'狼蛛',melgeek:'MelGeek'});
const OFFICIAL_SETTINGS=Object.freeze({atk:'https://hub.atk.pro/',vxe:'https://hub.atk.pro/',vgn:'https://drive.vgnlab.com.cn/',dareu:'https://dr.dareu.com/',rapoo:'https://hub.rapoo.cn/',aula:'https://hub.aulacn.com/',melgeek:'https://hive.melgeek.com/'});
const sources={atk:['atk','getAtkSupport'],vxe:['atk','getAtkSupport'],vgn:['atk','getAtkSupport'],dareu:['dareu','getDareuSupport'],rapoo:['rapoo','getRapooSupport'],aula:['aula','getAulaSupport'],melgeek:['melgeek','getMelgeekSupport']};
function getDomesticSupport(model){const entry=sources[model.brand];if(!entry)return null;const file=path.join(__dirname,entry[0]+'-models.cjs');if(!fs.existsSync(file))return null;const fn=require(file)[entry[1]];return typeof fn==='function'?fn(model):null;}
function hidTarget(model){const support=model.support||{},filters=support.filters|| (support.vendorIds||[support.vendorId]).flatMap(vendorId=>(support.productIds?.length?support.productIds:[undefined]).flatMap(productId=>(support.usagePages?.length?support.usagePages:[undefined]).map(usagePage=>({vendorId,...(productId===undefined?{}:{productId}),...(usagePage===undefined?{}:{usagePage}),...(support.usage===undefined?{}:{usage:support.usage})}))));
 const valid=filters.filter(f=>Number.isInteger(f.vendorId)&&f.vendorId>0&&f.vendorId<=65535&&['productId','usagePage','usage'].every(key=>f[key]===undefined||(Number.isInteger(f[key])&&f[key]>=0&&f[key]<=65535)));
 if(!valid.length)throw Error('此型号尚无明确的设备连接接口');
 return {id:model.id,filters:valid,productNames:support.productNames||[]};
}
function matchesHidTarget(device,target){
 if(!target)return false;
 const normalize=value=>String(value||'').replace(/[\s_-]+/g,'').toLowerCase();
 if(target.productNames?.length&&!target.productNames.some(name=>normalize(name)===normalize(device.productName||device.name)))return false;
 const collections=[];const visit=rows=>{for(const row of rows||[]){collections.push(row);visit(row.children);}};visit(device.collections);
 return (target.filters||[{vendorId:target.vendorId,productId:target.productId}]).some(filter=>device.vendorId===filter.vendorId&&(filter.productId===undefined||filter.productId===device.productId)&&(!device.collections||collections.some(c=>(filter.usagePage===undefined||c.usagePage===filter.usagePage)&&(filter.usage===undefined||c.usage===filter.usage))));
}
module.exports={BRANDS,OFFICIAL_SETTINGS,getDomesticSupport,hidTarget,matchesHidTarget};
