'use strict';
const path=require('node:path');
const {hash,links,jsonDocuments,rowFor,createContext}=require('./official-via-assets.cjs');
const DOWNLOADS='https://www.keychron.com/pages/firmware-and-json-files-of-the-keychron-qmk-keyboards';
async function extract(options={}){
 const ctx=createContext('keychron',options),html=(await ctx.load(DOWNLOADS,'downloads.html',{refresh:true,validate:bytes=>bytes.includes(Buffer.from('Keymap JSON'))})).toString('utf8');
 const anchors=links(html,DOWNLOADS),products=new Map();
 for(const anchor of anchors){
  if(!/\/products\/keychron-q\d+-max(?:-|$)/.test(anchor.url))continue;
  const model=anchor.url.match(/\/products\/keychron-(q\d+)-max(?:-|$)/)?.[1]?.toUpperCase()+' Max';
  const image=anchor.html.match(/<(?:img|source)\b[^>]*(?:data-src|src)=["']([^"']+)["']/i)?.[1];
  if(!image||products.has(model))continue;
  const imageUrl=new URL(image,DOWNLOADS);imageUrl.searchParams.set('width','800');
  products.set(model,{productUrl:anchor.url,variants:[{id:'official',name:'原厂展示图',color:null,imageUrl:imageUrl.href,imageScope:'model-family'}]});
 }
 const definitions=[...new Map(anchors.filter(a=>/\.(?:json|zip)(?:\?|$)/i.test(a.url)&&/q\d+_max_/i.test(a.url)&&/JSON|keymap/i.test(a.text)).map(a=>[a.url,a])).values()];
 const imageCache=new Map(),devices=[];
 for(const anchor of definitions){
  try{
   const family=anchor.url.match(/(q\d+)_max_/i)?.[1].toUpperCase()+' Max',product=products.get(family);if(!product){ctx.warnings.push(family+': 下载页未提供该型号商品图，暂不生成条目');continue;}
   if(!imageCache.has(family))imageCache.set(family,await ctx.images(product.variants));const variants=imageCache.get(family);if(!variants.length)continue;
   const sourceFile='definition-'+hash(anchor.url).slice(0,16)+path.extname(new URL(anchor.url).pathname),raw=await ctx.load(anchor.url,sourceFile);
   for(const entry of jsonDocuments(raw)){
    const declared=String(entry.definition.name||'');if(!new RegExp(family.replace(' ','[ _-]?'),'i').test(declared)){ctx.warnings.push(anchor.url+': 原厂定义名称与页面型号不匹配 '+declared);continue;}
    const layout=(entry.file+' '+anchor.url).match(/(?:^|[_/ -])(ansi|iso|jis)(?:[_ .-]|$)/i)?.[1]?.toUpperCase();
    devices.push(rowFor('keychron',entry.definition,{label:'Keychron '+family+(layout?' · '+layout:''),sourceUrl:anchor.url,sourceFile:sourceFile+'#'+entry.file,productUrl:product.productUrl,variants}));
   }
  }catch(error){ctx.warnings.push(anchor.url+': '+error.message);}
 }
 return ctx.save(devices,{name:'Keychron 官方 Q Max VIA 定义与官网型号图',url:DOWNLOADS,scope:'Q Max; exact official USB identities and layout definitions; USB wired only'});
}
module.exports={extract};
if(require.main===module)extract({offline:process.argv.includes('--offline'),updateRegistry:process.argv.includes('--update-registry')}).then(result=>console.log(JSON.stringify({brand:result.brand,models:result.devices.length,stats:result.stats},null,2))).catch(error=>{console.error(error);process.exitCode=1;});
