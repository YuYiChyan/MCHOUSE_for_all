'use strict';
// Reproducible data-only extraction from the cached official MCHOSE web driver.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const SOURCE_URL='https://cdn.mchose.com.cn/customPage/prod/assets/main-uPmmEh_1.js';
function extract(source){
  const start=source.indexOf('mouseDiffConfig={'),end=source.indexOf('},allowUpdateDevice=',start);
  if(start<0||end<start)throw Error('Official mouseDiffConfig table was not found');
  const key='mchose_secret_2024';
  const table=source.slice(start,end+1).replace(/\[\(globalThis&&globalThis\.\w+\?globalThis\.\w+:\w+\)\("([A-Za-z0-9+/=]+)"\)\]/g,(_,encoded)=>JSON.stringify(Array.from(Buffer.from(encoded,'base64'),(n,i)=>String.fromCharCode(n^key.charCodeAt(i%key.length))).join('')));
  const models=[];
  for(const match of table.matchAll(/"([^"]+)":\{([^}]+)\}/g)){
    const body=match[2],pids=JSON.parse(body.match(/pids:(\[[^\]]+\])/)[1]).map(Number),dpiMax=Number(body.match(/dpiMax:([\de.]+)/)[1]);
    const rates=[...body.matchAll(/rateMap\[([\de.]+)\]/g)].map(([,rate])=>Number(rate)===1000?[125,500,1000]:[125,500,1000,2000,4000,8000]);
    models.push({name:match[1].replace(/^MCHOSE /,''),productName:match[1],protocol:'mchose-mouse-4d-v1',vendorId:14391,wiredProductId:pids[0],productIds:pids,usagePages:[65281,65291],reportId:77,dpiMin:200,dpiMax,rates,verification:'unverified',hardwareVerified:false});
  }
  if(models.length<15)throw Error('Official model table extraction was incomplete');
  return {schema:1,provider:'mchose-webhid',source:{url:SOURCE_URL,sha256:crypto.createHash('sha256').update(source).digest('hex'),symbols:['getCommandBuffer','calculateXorSum','mcReadCommand','mcSetCommand','allInfoToObj','allInfoToArr','dpiToObj','dpiToArr','setSingleDpi','mouseDiffConfig','newMouseWirelessPids'],characterOffsets:{codec:source.indexOf('getCommandBuffer=async'),modelTable:start,modelTableEnd:end+1}},models};
}
module.exports={extract};
if(require.main===module){const sourceFile=process.argv[2]||path.join(process.env.LOCALAPPDATA,'One4All-Desktop/vendor-resources/mchose/source/app.js'),output=path.join(__dirname,'../catalog/mchose-protocols.json');const data=extract(fs.readFileSync(sourceFile,'utf8'));fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify({output,models:data.models.length,names:data.models.map(m=>m.name)}));}
