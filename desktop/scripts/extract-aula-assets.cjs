'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const catalog=require('../catalog/aula-protocols.json');
async function extract({outputRoot=path.join(process.env.LOCALAPPDATA,'One4All-Desktop/vendor-resources/aula')}={}){
 fs.mkdirSync(path.join(outputRoot,'assets'),{recursive:true});
 let cookie='';const first=await fetch(catalog.source.url,{signal:AbortSignal.timeout(15000)});cookie=first.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
 const images=new Map();for(const model of catalog.models)for(const variant of model.images)images.set(variant.url,path.join(outputRoot,'assets',path.basename(new URL(variant.url).pathname)));
 for(const [url,file]of images){if(fs.existsSync(file)&&fs.statSync(file).size>100)continue;const response=await fetch(url,{headers:{cookie},signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('狼蛛商品图下载失败：'+response.status);const bytes=Buffer.from(await response.arrayBuffer());if(!response.headers.get('content-type')?.startsWith('image/')||bytes.length<100)throw Error('狼蛛返回的内容不是商品图');fs.writeFileSync(file,bytes);}
 const devices=catalog.models.map(model=>({id:model.id,brand:'aula',kind:'mouse',name:model.name,identifiers:model.connections.map(({vendorId,productId,usagePage,usage})=>({vendorId,productId,usagePage,usage})),variants:model.images.map(image=>({id:image.id,name:image.id==='white'?'白色':'黑色',color:image.id==='white'?'#f2f2f2':'#202124',imageUrl:image.url,imagePath:images.get(image.url),sha256:crypto.createHash('sha256').update(fs.readFileSync(images.get(image.url))).digest('hex')})),source:catalog.source,support:{provider:catalog.provider,status:'unverified',hardwareVerified:false}}));
 const result={schema:1,generatedAt:new Date().toISOString(),source:catalog.source,devices};fs.writeFileSync(path.join(outputRoot,'catalog.json'),JSON.stringify(result,null,2));return result;
}
module.exports={extract};if(require.main===module)extract().then(result=>console.log(JSON.stringify({models:result.devices.length}))).catch(error=>{console.error(error);process.exitCode=1;});
