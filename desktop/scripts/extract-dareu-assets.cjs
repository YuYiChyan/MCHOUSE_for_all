'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ORIGIN='https://dr.dareu.com',sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function extract({outputRoot=path.join(process.env.LOCALAPPDATA,'One4All-Desktop/vendor-resources/dareu'),offline=false,updateRegistry=true}={}){
 const sourceRoot=path.join(outputRoot,'source');fs.mkdirSync(sourceRoot,{recursive:true});
 async function fetchFile(relative,local){const file=path.join(sourceRoot,local||relative);if(offline&&fs.existsSync(file))return fs.readFileSync(file);const response=await fetch(ORIGIN+'/'+relative,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error(relative+': '+response.status);const buffer=Buffer.from(await response.arrayBuffer());fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,buffer);return buffer;}
 const bootstrap=await fetchFile('js/global.js?v=1.3.26','global.js'),protocolSource=await fetchFile('js/device/tgdevice.js?v=1.3.26','tgdevice.js');
 const ids=JSON.parse(bootstrap.toString().match(/AVAILABLE_PID_LIST=(\[[^\]]+\])/)[1]),rows=[],errors=[];let index=0;
 await Promise.all(Array.from({length:8},async()=>{while(index<ids.length){const pid=ids[index++],hex=pid.toString(16).padStart(4,'0').toUpperCase();try{const data=JSON.parse((await fetchFile(`products/${hex}/${hex}.json`)).toString());rows.push({pid,hex,data});}catch(error){errors.push({pid,error:error.message});}}}));
 rows.sort((a,b)=>a.pid-b.pid);
 const receivers=rows.filter(row=>row.data.Device.Type===2&&[0,1].includes(row.data.Device.FwType)).map(row=>({productId:row.pid,reportId:row.data.Device.FwType===1?10:0,fwType:row.data.Device.FwType}));
 const groups=new Map();for(const row of rows.filter(row=>row.data.Device.Type===0&&[0,1].includes(row.data.Device.FwType))){const name=row.data.Device.ProductName;if(!groups.has(name))groups.set(name,[]);groups.get(name).push(row);}
 const devices=[];for(const [name,entries]of groups){const id='dareu-'+name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),variants=[],identifiers=[],models=[];
  for(const row of entries){const d=row.data.Device,url=`${ORIGIN}/products/${row.hex}/${d.Model}.png?v=1.3.26`;try{const bytes=await fetchFile(`products/${row.hex}/${d.Model}.png?v=1.3.26`,`products/${row.hex}/${d.Model}.png`),digest=sha(bytes);if(!variants.some(v=>v.sha256===digest)){const imagePath=path.join(outputRoot,'assets',digest+'.png');fs.mkdirSync(path.dirname(imagePath),{recursive:true});fs.writeFileSync(imagePath,bytes);variants.push({id:row.hex,name:variants.length?'原厂图 '+(variants.length+1):'原厂图',imagePath,imageUrl:url,sha256:digest});}}catch(error){errors.push({pid:row.pid,image:url,error:error.message});}
   identifiers.push({vendorId:9741,productId:row.pid});models.push({productId:row.pid,reportId:d.FwType===1?10:0,fwType:d.FwType,hasBattery:!!d.HasBattery,polling:row.data.PollingRate||null});
  }
  devices.push({id,name,brand:'dareu',kind:'mouse',catalogRole:'device',identifiers,variants,source:{url:ORIGIN,records:entries.map(row=>`products/${row.hex}/${row.hex}.json`),version:'1.3.26'},support:{provider:'dareu-webhid',protocol:'dareu-tg-v1',version:'1.0.0',status:'unverified',hardwareVerified:false,interfaceImplemented:true,vendorId:9741,productIds:[...new Set([...models.map(m=>m.productId),...receivers.map(r=>r.productId)])],usagePages:[65282,65281],models,receivers}});
 }
 const catalog={schema:1,brand:'dareu',generatedAt:new Date().toISOString(),source:{url:ORIGIN,sourceVersion:'1.3.26',protocolSha256:sha(protocolSource),bootstrapSha256:sha(bootstrap)},stats:{models:devices.length,usbRecords:devices.reduce((s,d)=>s+d.identifiers.length,0),withImage:devices.filter(d=>d.variants.length).length,errors},devices};
 fs.writeFileSync(path.join(outputRoot,'catalog.json'),JSON.stringify(catalog,null,2));
 const registry={schema:1,provider:'dareu-webhid',source:catalog.source,models:devices.map(({id,name,identifiers,support})=>({id,name,brand:'dareu',kind:'mouse',identifiers,support}))};
 if(updateRegistry)fs.writeFileSync(path.join(__dirname,'../catalog/dareu-protocols.json'),JSON.stringify(registry,null,2));return catalog;
}
module.exports={extract};if(require.main===module)extract({offline:process.argv.includes('--offline')}).then(c=>console.log(JSON.stringify(c.stats))).catch(e=>{console.error(e);process.exitCode=1});
