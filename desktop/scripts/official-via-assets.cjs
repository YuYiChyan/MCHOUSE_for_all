'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
require('../app/via-provider.js');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const slug=value=>String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
function entities(value){return String(value).replace(/&(?:quot|#34);/g,'"').replace(/&(?:apos|#39|#039);/g,"'").replace(/&(?:amp|#38|#038);/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)));}
function links(html,base){return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(match=>({url:new URL(entities(match[1]),base).href,text:entities(match[2].replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim(),html:match[2]}));}
function jsonDocuments(bytes){
 if(bytes.readUInt16LE(0)!==0x4b50)return [{file:'definition.json',definition:JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''))}];
 let end=-1;for(let at=bytes.length-22;at>=Math.max(0,bytes.length-65557);at--)if(bytes.readUInt32LE(at)===0x06054b50){end=at;break;}
 if(end<0)throw new Error('原厂定义 ZIP 缺少目录');
 const count=bytes.readUInt16LE(end+10),out=[];let at=bytes.readUInt32LE(end+16);
 for(let i=0;i<count;i++){
  if(bytes.readUInt32LE(at)!==0x02014b50)throw new Error('原厂定义 ZIP 目录无效');
  const method=bytes.readUInt16LE(at+10),size=bytes.readUInt32LE(at+20),nameBytes=bytes.readUInt16LE(at+28),extra=bytes.readUInt16LE(at+30),comment=bytes.readUInt16LE(at+32),local=bytes.readUInt32LE(at+42),name=bytes.subarray(at+46,at+46+nameBytes).toString('utf8');at+=46+nameBytes+extra+comment;
  if(!/\.json$/i.test(name)||name.startsWith('__MACOSX/'))continue;
  if(bytes.readUInt32LE(local)!==0x04034b50)throw new Error('原厂定义 ZIP 文件头无效');
  const start=local+30+bytes.readUInt16LE(local+26)+bytes.readUInt16LE(local+28),compressed=bytes.subarray(start,start+size);
  const data=method===0?compressed:method===8?zlib.inflateRawSync(compressed,{maxOutputLength:4*1024*1024}):null;
  if(!data)throw new Error('原厂定义 ZIP 压缩格式不支持');
  out.push({file:name,definition:JSON.parse(data.toString('utf8').replace(/^\uFEFF/,''))});
 }
 return out;
}
const knownColors={black:'#202124',white:'#f2f2f2',silver:'#bfc2c6',gray:'#80838c',grey:'#80838c',purple:'#9c7ac0',pink:'#edb6cd',blue:'#779ecc',red:'#ba4350',green:'#82a793',gold:'#c7a467'};
function colorFor(name){const found=Object.entries(knownColors).filter(([key])=>new RegExp('(?:^|[ -])'+key+'(?:$|[ -])','i').test(name));return found.length===1?found[0][1]:null;}
function wooVariants(html,{layout}={}){
 const raw=html.match(/data-product_variations=["']([\s\S]*?)["']/)?.[1];let rows=[];if(raw)try{rows=JSON.parse(entities(raw));}catch{}
 const out=[];for(const row of Array.isArray(rows)?rows:[]){const attributes=Object.values(row.attributes||{}).join(' '),declaredLayout=attributes.match(/\b(ANSI|ISO|JIS)\b/i)?.[1]?.toUpperCase();if(layout&&declaredLayout&&declaredLayout!==layout)continue;const imageUrl=row.image?.full_src||row.image?.url||row.image?.src;if(!imageUrl)continue;const names=Object.entries(row.attributes||{}).filter(([key,value])=>value&&!/switch|plate|layout/i.test(key)).map(([,value])=>entities(value));const rawName=names.join(' · ')||row.image?.alt||'原厂配色';if(/plate|switch tester|non-qmk|domestic/i.test(rawName))continue;const name=rawName.replace(/\s*\(Discontinued\)/gi,'').replace(/,Discontinued/gi,'').trim();if(out.some(v=>v.name===name))continue;out.push({id:slug(name)+'-'+hash(imageUrl).slice(0,6),name,color:colorFor(name),imageUrl,...(declaredLayout?{layout:declaredLayout}:{})});}
 return out;
}
function officialDefinition(value){
 // Official Keychron KLE labels include "0, 0"; canonicalize only the matrix
 // coordinate label, preserving other legends and every row/column number.
 const keymap=value.layouts?.keymap?.map(line=>Array.isArray(line)?line.map(item=>typeof item==='string'?item.split('\n').map(label=>label.replace(/^\s*(\d+)\s*,\s*(\d+)\s*$/,'$1,$2')).join('\n'):item):line);
 const normalized={...value,layouts:{...value.layouts,keymap}},parsed=globalThis.One4AllVia.parseDefinition(normalized);
 return {name:parsed.name,vendorId:parsed.vendorId,productId:parsed.productId,matrix:{rows:parsed.rows,cols:parsed.cols},layouts:{keymap}};
}
function rowFor(brand,definition,{label,sourceUrl,sourceFile,productUrl,variants}){
 const parsed=officialDefinition(definition),id=brand+'-via-'+parsed.vendorId.toString(16)+'-'+parsed.productId.toString(16);
 return {id,brand,name:label||parsed.name,kind:'keyboard',variants,productUrl,source:{url:sourceUrl,file:sourceFile,definitionName:parsed.name,protocol:'https://github.com/qmk/qmk_firmware/blob/master/quantum/via.h'},support:{status:'unverified',hardwareVerified:false,provider:'official-via',protocol:'qmk-via',version:'1',vendorId:parsed.vendorId,productIds:[parsed.productId],usagePages:[0xff60],usage:0x61,filters:[{vendorId:parsed.vendorId,productId:parsed.productId,usagePage:0xff60,usage:0x61}],connection:'USB wired',capabilities:['keymap'],definition:parsed,limitations:['仅适用于原厂明确的 VIA/QMK 版本，通过 USB 有线接口连接；不包含同名私有固件版本。','当前接入基础按键映射与键盘层读取，写入后回读确认。']}};
}
function createContext(brand,{outputRoot,offline=false,updateRegistry=false}={}){
 const root=outputRoot||path.join(process.env.LOCALAPPDATA,'One4All-Desktop/vendor-resources',brand),warnings=[];fs.mkdirSync(path.join(root,'source'),{recursive:true});fs.mkdirSync(path.join(root,'assets'),{recursive:true});
 async function load(url,label,{refresh=false,validate}={}){
  const dest=path.join(root,'source',label||hash(url).slice(0,24));
  if(fs.existsSync(dest)&&(!refresh||offline))return fs.readFileSync(dest);
  if(offline)throw new Error('离线缓存缺少 '+url);
  try{const response=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!response.ok)throw new Error('HTTP '+response.status);const data=Buffer.from(await response.arrayBuffer());if(data.length>10*1024*1024)throw new Error('原厂资源过大');if(validate&&!validate(data))throw new Error('原厂返回内容无效');fs.writeFileSync(dest,data);return data;}catch(error){if(fs.existsSync(dest)){warnings.push(url+': '+error.message+'，沿用现有缓存');return fs.readFileSync(dest);}throw error;}
 }
 async function images(variants){const result=[];for(const variant of variants){try{const url=new URL(variant.imageUrl);if(url.protocol!=='https:')throw new Error('商品图地址必须使用 HTTPS');const suffix=/\.(png|jpe?g|webp|avif)(?:\?|$)/i.exec(url.href)?.[1]||'png';const file=path.join(root,'assets',hash(url.href).slice(0,24)+'.'+suffix);if(!fs.existsSync(file)){if(offline)throw new Error('缺少商品图缓存');const bytes=await load(url.href,'image-'+path.basename(file));if(bytes.subarray(0,100).toString().match(/<html|local_rate_limited/i))throw new Error('图片返回无效');fs.writeFileSync(file,bytes);}result.push({...variant,imagePath:file});}catch(error){warnings.push(variant.imageUrl+': '+error.message);}}return result;}
 function save(devices,source){
  const unique=[...new Map(devices.map(row=>[row.id,row])).values()],result={schema:1,brand,generatedAt:new Date().toISOString(),source,devices:unique,stats:{models:unique.length,variants:unique.reduce((n,row)=>n+row.variants.length,0),protocol:'official-via',warnings}};
  if(!unique.length)throw new Error('未获取到兼具原厂定义与商品图的 '+brand+' 型号');
  fs.writeFileSync(path.join(root,'catalog.json'),JSON.stringify(result,null,2));
  if(updateRegistry){const models=unique.map(({variants,...row})=>row);fs.writeFileSync(path.join(__dirname,'../catalog',brand+'-protocols.json'),JSON.stringify({schema:1,brand,source,models},null,2));}
  return result;
 }
 return {root,offline,warnings,load,images,save};
}
module.exports={hash,slug,entities,links,jsonDocuments,wooVariants,officialDefinition,rowFor,createContext};
