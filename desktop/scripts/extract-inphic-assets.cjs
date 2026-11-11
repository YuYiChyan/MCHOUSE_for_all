'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),catalog=require('../catalog/inphic-protocols.json');
async function extract({outputRoot=path.join(process.env.LOCALAPPDATA,'One4All-Desktop/vendor-resources/inphic')}={}){
 fs.mkdirSync(path.join(outputRoot,'assets'),{recursive:true});const devices=[];
 for(const row of catalog.models){const file=path.join(outputRoot,'assets',path.basename(new URL(row.imageUrl).pathname));if(!fs.existsSync(file)){const response=await fetch(row.imageUrl,{signal:AbortSignal.timeout(30000)});if(!response.ok||!response.headers.get('content-type')?.includes('image'))throw Error('英菲克商品图下载失败');const bytes=Buffer.from(await response.arrayBuffer());fs.writeFileSync(file,bytes);}devices.push({id:row.id,brand:row.brand,kind:row.kind,name:row.name,identifiers:row.connections,source:catalog.source,variants:[{id:'original',name:'原厂配色',imageUrl:row.imageUrl,imagePath:file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}],support:{provider:catalog.provider,status:'unverified',hardwareVerified:false}});}
 const result={schema:1,source:catalog.source,generatedAt:new Date().toISOString(),devices};fs.writeFileSync(path.join(outputRoot,'catalog.json'),JSON.stringify(result,null,2));return result;
}
module.exports={extract};if(require.main===module)extract().then(r=>console.log(JSON.stringify({models:r.devices.length}))).catch(e=>{console.error(e);process.exitCode=1;});
