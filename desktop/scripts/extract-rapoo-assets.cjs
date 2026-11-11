'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {literal}=require('./extract-mchose-assets.cjs');
const ROOT='https://hid.rapoo.cn/AHUB_WEB/dist/',ENTRY='https://hub.rapoo.cn/';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function balanced(source,start){let level=0,quote='',escape=false;for(let i=start;i<source.length;i++){const c=source[i];if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c===quote)quote='';continue;}if(c==='"'||c==="'"||c==='`'){quote=c;continue;}if(c==='{'||c==='[')level++;else if(c==='}'||c===']'){if(--level===0)return source.slice(start,i+1);}}throw Error('Unterminated manifest');}
function parse(source){return literal(source.replace(/\b(\d+)e(\d+)\b/g,(_,m,e)=>String(Number(m)*10**Number(e))));}
function getField(object,key){const marker=key+':',start=object.indexOf(marker)+marker.length;if(start<marker.length)throw Error('Missing '+key);return parse(balanced(object,start));}
function extractModels(source){const out=[];for(const match of source.matchAll(/\b[A-Za-z_$][\w$]*=\{channel:\[/g)){const start=match.index+match[0].indexOf('{'),raw=balanced(source,start);if(!/driver:"VT_nrf54L"/.test(raw)||!/(?:^|,)type:"mouse"/.test(raw))continue;
 const name=JSON.parse(raw.match(/(?:^|,)model:("(?:\\.|[^"\\])*")/)[1]),hardware=getField(raw,'hardware'),ui=getField(raw,'ui'),caps=balanced(raw,raw.indexOf('capabilities:')+13);
 const config=/\bkt\b/.test(caps)?{min:10,max:45000,step:10,steps:[{from:10,to:10050,step:10},{from:10050,to:45000,step:50}]}:/\bU1\b/.test(caps)?{min:1,max:60000,step:1}:/\bHn\b/.test(caps)?{min:50,max:26000,step:50}:null;if(!config)continue;
 const rateCodes=/tier:"cybercafe"/.test(caps)?[1,132,130,129]:[8,4,2,1,132,130,129];
 out.push({name,hardware,ui,dpi:config,rateCodes,recordOffset:start});
 }return out;}
async function extract({outputRoot=path.join(process.env.LOCALAPPDATA,'One4All-Desktop/vendor-resources/rapoo'),offline=false,updateRegistry=true}={}){
 fs.mkdirSync(path.join(outputRoot,'source'),{recursive:true});let source,url;
 const file=path.join(outputRoot,'source/index.js'),meta=path.join(outputRoot,'source/source.json');
 if(offline&&fs.existsSync(file)){source=fs.readFileSync(file,'utf8');url=JSON.parse(fs.readFileSync(meta,'utf8')).url;}else{const html=await(await fetch(ENTRY)).text();url=html.match(/<script[^>]+src="([^"]+index-[^"]+\.js)"/)[1];source=await(await fetch(url)).text();fs.writeFileSync(file,source);fs.writeFileSync(meta,JSON.stringify({url}));}
 const models=extractModels(source),devices=[],errors=[];const cache=path.join(outputRoot,'assets');fs.mkdirSync(cache,{recursive:true});
 for(const row of models){const id='rapoo-'+row.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),filters=row.hardware.filters.filter(f=>f.type==='default').map(f=>({vendorId:row.hardware.vendorId,usagePage:f.usagePage,usage:f.usage}));
 const variants=(row.ui.colors?.series||[]).map(v=>{const key=v.key||'',label=source.match(new RegExp('(?:^|[,{])'+key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+':"([^"\\\\]+)"'))?.[1];return{id:key||'default',name:label||'原厂配色',color:Array.isArray(v.value)?v.value[0]:v.value,imageUrl:ROOT+(row.ui.assetsDir+'/thumb_'+key+'.png').split('/').map(encodeURIComponent).join('/')};});
 const ids=Array.isArray(row.hardware.productId)?row.hardware.productId:[row.hardware.productId];devices.push({id,name:row.name,brand:'rapoo',kind:'mouse',catalogRole:'device',identifiers:ids.map(productId=>({vendorId:row.hardware.vendorId,productId})),variants,source:{url,recordOffset:row.recordOffset,driver:'VT_nrf54L'},support:{provider:'rapoo-webhid',protocol:'rapoo-nrf54l-v1',version:'1.0.0',status:'unverified',hardwareVerified:false,interfaceImplemented:true,vendorId:row.hardware.vendorId,productIds:ids,filters:filters.flatMap(f=>ids.map(productId=>({...f,productId}))),usagePages:[...new Set(filters.map(f=>f.usagePage))],dpi:row.dpi,rateCodes:row.rateCodes}});
 }
 const images=devices.flatMap(d=>d.variants),oldFile=path.join(outputRoot,'catalog.json');let oldImages=[];if(fs.existsSync(oldFile))try{oldImages=JSON.parse(fs.readFileSync(oldFile)).devices.flatMap(d=>d.variants);}catch{}let index=0;
 await Promise.all(Array.from({length:8},async()=>{while(index<images.length){const image=images[index++],old=oldImages.find(v=>v.imageUrl===image.imageUrl);try{if(offline&&old?.imagePath&&fs.existsSync(old.imagePath)){Object.assign(image,{imagePath:old.imagePath,sha256:old.sha256});continue;}const r=await fetch(image.imageUrl,{signal:AbortSignal.timeout(15000)});if(!r.ok||!r.headers.get('content-type')?.startsWith('image/'))throw Error('Image HTTP '+r.status);const b=Buffer.from(await r.arrayBuffer()),digest=sha(b),dest=path.join(cache,digest+'.png');fs.writeFileSync(dest,b);Object.assign(image,{imagePath:dest,sha256:digest});}catch(error){errors.push({url:image.imageUrl,error:error.message});}}}));
 const seen=new Map();for(const d of devices)for(const p of d.identifiers){if(seen.has(p.productId))throw Error('Ambiguous Rapoo product ID '+p.productId);seen.set(p.productId,d.id);}
 const result={schema:1,brand:'rapoo',generatedAt:new Date().toISOString(),source:{url,sha256:sha(source),entry:ENTRY},stats:{models:devices.length,images:images.length,withImage:devices.filter(d=>d.variants.some(v=>v.imagePath)).length,errors},devices};
 fs.writeFileSync(path.join(outputRoot,'catalog.json'),JSON.stringify(result,null,2));if(updateRegistry)fs.writeFileSync(path.join(__dirname,'../catalog/rapoo-protocols.json'),JSON.stringify({schema:1,source:result.source,models:devices.map(({id,name,brand,kind,identifiers,support})=>({id,name,brand,kind,identifiers,support}))},null,2));return result;
}
module.exports={extract,extractModels,balanced};if(require.main===module)extract({offline:process.argv.includes('--offline')}).then(c=>console.log(JSON.stringify(c.stats))).catch(e=>{console.error(e);process.exitCode=1});
