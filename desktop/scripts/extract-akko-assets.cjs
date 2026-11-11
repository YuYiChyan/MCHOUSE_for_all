'use strict';
const path=require('node:path');
const {hash,slug,entities,links,jsonDocuments,wooVariants,rowFor,createContext}=require('./official-via-assets.cjs');
const DOWNLOADS='https://en.akkogear.com/download/',STORE='https://en.akkogear.com/store/';
const products=[
 {match:/gem_01\.zip/i,name:'Akko Gem 01 VIA',product:/\/product\/gem-01-.*via/i},
 {match:/gem_02\.zip/i,name:'Akko Gem 02 VIA',product:/\/product\/gem-02-.*via/i},
 {match:/mineral_01\.zip/i,name:'Akko Mineral 01 VIA',product:/\/product\/mineral-01-.*via/i},
 {match:/mineral_02\.zip/i,name:'Akko Mineral 02 VIA',product:/\/product\/mineral-02-.*via/i},
 {match:/5075B_Plus_.*\.zip/i,name:'Akko 5075B VIA',product:/\/product\/5075b-via\//i},
 {match:/YU01\.json/i,name:'Akko YU01',product:/\/product\/yu01-mechanical-keyboard\//i},
 {match:/mod007v3_via\.json/i,name:'Akko MOD 007 V3 VIA',product:/\/product\/mod-007-v3-via\//i},
 {match:/5087_via.*\.json/i,name:'Akko 5087S VIA',product:/\/product\/.*5087s.*(?:qmk|via)/i},
 {match:/top40_via.*\.json/i,name:'Akko ACR TOP 40',product:/\/product\/acr-top-40\//i},
 {match:/5075_via.*\.json/i,name:'Akko 5075S VIA',product:/\/product\/5075s-via\//i},
];
async function extract(options={}){
 const ctx=createContext('akko',options),html=(await ctx.load(DOWNLOADS,'downloads.html',{refresh:true,validate:b=>b.includes(Buffer.from('VIA'))})).toString('utf8'),store=(await ctx.load(STORE,'store.html',{refresh:true,validate:b=>b.includes(Buffer.from('/product/'))})).toString('utf8');
 const anchors=[...new Map(links(html,DOWNLOADS).filter(a=>/\.(?:json|zip)(?:\?|$)/i.test(a.url)).map(a=>[a.url,a])).values()];
 const productLinks=[...new Map(links(store,STORE).filter(a=>a.url.includes('/product/')).map(a=>[a.url,a])).values()],devices=[];
 for(const anchor of anchors){try{
  const product=products.find(row=>row.match.test(anchor.url));if(!product)continue;const matches=productLinks.filter(a=>product.product.test(a.url)),variants=[];
  for(const link of matches){
   try{const page=(await ctx.load(link.url,'product-'+hash(link.url).slice(0,16)+'.html',{refresh:true,validate:b=>b.includes(Buffer.from('product'))})).toString('utf8');let rows=wooVariants(page);
    if(!rows.length){const at=store.indexOf(link.url),snippet=store.slice(at,at+3500),image=snippet.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1],title=snippet.match(/<h3\b[^>]*>(.*?)<\/h3>/i)?.[1];if(image)rows=[{id:slug(title||link.url),name:entities(title||product.name),color:null,imageUrl:entities(image)}];}
    for(const variant of rows)if(!variants.some(v=>v.imageUrl===variant.imageUrl))variants.push({...variant,productUrl:link.url});
   }catch(error){ctx.warnings.push(link.url+': '+error.message);}
  }
  const images=await ctx.images(variants);if(!images.length){ctx.warnings.push(product.name+': 缺少明确的原厂商品图');continue;}
  const sourceFile='definition-'+hash(anchor.url).slice(0,16)+path.extname(new URL(anchor.url).pathname),raw=await ctx.load(anchor.url,sourceFile);
  for(const entry of jsonDocuments(raw))devices.push(rowFor('akko',entry.definition,{label:product.name,sourceUrl:anchor.url,sourceFile:sourceFile+'#'+entry.file,productUrl:matches[0]?.url,variants:images}));
 }catch(error){ctx.warnings.push(anchor.url+': '+error.message);}}
 return ctx.save(devices,{name:'Akko 官方 QMK/VIA JSON 定义与产品图',url:DOWNLOADS,scope:'Only listed VIA/QMK editions; USB wired; private Cloud/HE firmware excluded'});
}
module.exports={extract};
if(require.main===module)extract({offline:process.argv.includes('--offline'),updateRegistry:process.argv.includes('--update-registry')}).then(result=>console.log(JSON.stringify({brand:result.brand,models:result.devices.length,stats:result.stats},null,2))).catch(error=>{console.error(error);process.exitCode=1;});
