'use strict';
const path=require('node:path');
const {hash,links,jsonDocuments,wooVariants,rowFor,createContext}=require('./official-via-assets.cjs');
const DOWNLOADS='https://www.monsgeek.com/download/';
const products=[
 {match:/M2_V5/i,name:'MonsGeek M2 V5 VIA',url:'https://www.monsgeek.com/product/monsgeek-m2-v5-via-mechanical-keyboard/'},
 {match:/M1[W_]*V5/i,name:'MonsGeek M1 V5 VIA',url:'https://www.monsgeek.com/product/m1-v5-via-rapid-disassembly/'},
 {match:/M1W_V3/i,name:'MonsGeek M1W V3 VIA',url:'https://www.monsgeek.com/product/m1w-v3-via/'},
 {match:/m7_via/i,name:'MonsGeek M7 QMK',url:'https://www.monsgeek.com/product/m7/'},
 {match:/M6_VIA/i,name:'MonsGeek M6 QMK',url:'https://www.monsgeek.com/product/m6/'},
 {match:/M5.*Json/i,name:'MonsGeek M5 QMK',url:'https://www.monsgeek.com/product/m5/'},
 {match:/M3.*Json/i,name:'MonsGeek M3 QMK',url:'https://www.monsgeek.com/product/m3/'},
 {match:/M2_via_V3/i,name:'MonsGeek M2 QMK',url:'https://www.monsgeek.com/product/m2/'},
 {match:/M1.*QMK/i,name:'MonsGeek M1 QMK（国际版）',url:'https://www.monsgeek.com/product/monsgeek-m1/'},
];
async function extract(options={}){
 const ctx=createContext('monsgeek',options),html=(await ctx.load(DOWNLOADS,'downloads.html',{refresh:true,validate:bytes=>bytes.includes(Buffer.from('VIA'))})).toString('utf8');
 const anchors=[...new Map(links(html,DOWNLOADS).filter(a=>/\.json(?:\?|$)/i.test(a.url)).map(a=>[a.url,a])).values()],devices=[],imageCache=new Map();
 for(const anchor of anchors){
  try{
   const product=products.find(row=>row.match.test(decodeURI(anchor.url)));if(!product)continue;
   const iso=/_ISO\./i.test(anchor.url),imageKey=product.url+'#'+(iso?'ISO':'ANSI');
   if(!imageCache.has(imageKey)){const page=(await ctx.load(product.url,'product-'+hash(product.url).slice(0,16)+'.html',{refresh:true,validate:bytes=>bytes.includes(Buffer.from('data-product_variations'))})).toString('utf8');imageCache.set(imageKey,await ctx.images(wooVariants(page,{layout:iso?'ISO':'ANSI'})));}
   const variants=imageCache.get(imageKey);if(!variants.length){ctx.warnings.push(product.name+': 缺少明确的原厂商品图');continue;}
   const sourceFile='definition-'+hash(anchor.url).slice(0,16)+path.extname(new URL(anchor.url).pathname),raw=await ctx.load(anchor.url,sourceFile);
   for(const entry of jsonDocuments(raw))devices.push(rowFor('monsgeek',entry.definition,{label:product.name+(iso?' · ISO':''),sourceUrl:anchor.url,sourceFile,productUrl:product.url,variants}));
  }catch(error){ctx.warnings.push(anchor.url+': '+error.message);}
 }
 return ctx.save(devices,{name:'MonsGeek 官方 QMK/VIA 下载定义与产品配色',url:DOWNLOADS,scope:'Only exact VIA/QMK editions; USB wired; domestic non-QMK M1 excluded'});
}
module.exports={extract};
if(require.main===module)extract({offline:process.argv.includes('--offline'),updateRegistry:process.argv.includes('--update-registry')}).then(result=>console.log(JSON.stringify({brand:result.brand,models:result.devices.length,stats:result.stats},null,2))).catch(error=>{console.error(error);process.exitCode=1;});
