'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {literal,balanced}=require('./atk-source.cjs');
function extractVgn({root}){
 const s=fs.readFileSync(path.join(root,'index.js'),'utf8'),art=fs.readFileSync(path.join(root,'images.js'),'utf8');
 const start=s.indexOf('ln={f1:')+3;if(start<3)throw Error('VGN model table missing');const records=literal(balanced(s,start)).f1;
 const deviceStart=s.indexOf('deviceList:[')+11,devices=literal(balanced(s,deviceStart));
 const filters=devices.filter(row=>row.vendorId===13652&&row.reportId===8&&row.customDeviceType==='vgn-f1-pm').map(({vendorId,productId,usagePage,usage,receiver})=>({vendorId,productId,usagePage,usage,...(receiver?{receiver:true}:{})}));
 const images={};for(const m of art.matchAll(/"([^"]+)":"(\/assets\/[^\"]+)"/g))images[m[1]]='https://drive.vgnlab.com.cn'+m[2];
 const rows=[];for(const [mid,record]of Object.entries(records)){if(!['VGN F1 Pro','VGN F1 Pro Max','VGN F1 Moba','VGN F1 S'].includes(record.product))continue;let row=rows.find(row=>row.name===record.product);if(!row){row={id:record.title.toLowerCase(),brand:'vgn',name:record.product,kind:'mouse',catalogRole:'device',identifiers:filters,variants:[],support:{provider:'atk-webhid',protocol:'atk-compx-v1',status:'unverified',hardwareVerified:false,interfaceImplemented:true,cidMid:[2,Number(mid)],cidMids:[],identityCommand:1,sensor:'PAW3395',dpiBounds:[50,26000,50],separateAxes:true,reportId:8,filters}};rows.push(row);}row.support.cidMids.push([2,Number(mid)]);if(images[record.cover]&&!row.variants.some(v=>v.id===record.cover)){const color=/BLACK/.test(record.cover)?'#202124':/WHITE/.test(record.cover)?'#f2f2f2':'#8e8e8e';row.variants.push({id:record.cover,name:/BLACK/.test(record.cover)?'黑色':/WHITE/.test(record.cover)?'白色':record.cover.replace('mouse-f1ProMax',''),color,imageUrl:images[record.cover]});}}
 return {schema:1,source:{url:'https://drive.vgnlab.com.cn/',bundle:'https://drive.vgnlab.com.cn/assets/index-CeliRb9v.js',sha256:crypto.createHash('sha256').update(s).digest('hex'),basis:'Official ln.f1 CID=2 model table, deviceList vgn-f1-pm, EncryptionData/CID-MID and COMPX EEPROM controller'},models:rows};
}
module.exports={extractVgn};if(require.main===module){const result=extractVgn({root:path.join(process.env.LOCALAPPDATA,'One4All-Desktop/vendor-resources/vgn/source')});fs.writeFileSync(path.join(__dirname,'../catalog/vgn-protocols.json'),JSON.stringify(result,null,2));console.log(result.models.map(m=>({name:m.name,cidMids:m.support.cidMids,images:m.variants.length})));}
