'use strict';
const {hash,entities,links,jsonDocuments,rowFor,createContext}=require('./official-via-assets.cjs');
const products=[
 {model:'K715 PRO',name:'Redragon FINKE K715 PRO QMK/VIA',slug:'finke-k715-pro',definition:'FINKE K715 PRO.json'},
 {model:'K717 PRO',name:'Redragon ALCOR K717 PRO QMK/VIA',slug:'alcor-k717-pro-qmk-via',definition:'ALCOR K717 PRO.json'},
];
async function extract(options={}){
 const ctx=createContext('redragon',options),devices=[],archives=new Map();
 for(const product of products){try{
  const pageUrl='https://redragonshop.com/blogs/product-download/'+product.slug;
  const html=(await ctx.load(pageUrl,product.slug+'-downloads.html',{refresh:true,validate:b=>b.includes(Buffer.from(product.model))})).toString('utf8');
  const anchors=links(html,pageUrl),download=anchors.find(a=>a.text.includes(product.model)&&/Software/i.test(a.text)&&/\.zip(?:\?|$)/i.test(a.url));
  const imageTag=[...html.matchAll(/<img\b[^>]*>/gi)].map(m=>m[0]).find(tag=>/class="[^"]*\bproduct-image\b/.test(tag)&&tag.includes(product.model.split(' ')[0]));
  const image=imageTag?.match(/\bsrc="([^"]+)"/)?.[1],productUrl=anchors.find(a=>a.text==='View products')?.url;
  if(!download||!image||!productUrl)throw new Error('缺少此型号的官方定义下载或商品图');
  const sourceFile='definition-'+hash(download.url).slice(0,16)+'.zip';
  if(!archives.has(download.url))archives.set(download.url,jsonDocuments(await ctx.load(download.url,sourceFile)));
  const definitions=archives.get(download.url).filter(entry=>entry.file.split('/').at(-1)===product.definition);
  if(definitions.length!==1)throw new Error('原厂档案中没有唯一匹配的型号定义');
  const variants=await ctx.images([{id:'official',name:'原厂展示图',color:null,imageUrl:new URL(entities(image),pageUrl).href}]);
  if(!variants.length)throw new Error('原厂商品图未取得');
  const entry=definitions[0],row=rowFor('redragon',entry.definition,{label:product.name,sourceUrl:download.url,sourceFile:sourceFile+'#'+entry.file,productUrl,variants});
  row.source.downloadPage=pageUrl;row.imageScope='model-family';devices.push(row);
 }catch(error){ctx.warnings.push(product.model+': '+error.message);}}
 return ctx.save(devices,{name:'Redragon 原厂 QMK/VIA 型号定义与对应商品图',url:'https://redragonshop.com/pages/software',scope:'FINKE K715 PRO and ALCOR K717 PRO exact QMK/VIA editions; USB wired configuration'});
}
module.exports={extract};
if(require.main===module)extract({offline:process.argv.includes('--offline'),updateRegistry:process.argv.includes('--update-registry')}).then(result=>console.log(JSON.stringify({brand:result.brand,models:result.devices.length,stats:result.stats},null,2))).catch(error=>{console.error(error);process.exitCode=1;});
