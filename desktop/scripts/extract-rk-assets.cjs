'use strict';
const {hash,entities,links,jsonDocuments,rowFor,createContext}=require('./official-via-assets.cjs');
const DOWNLOADS='https://rkgamingstore.com/pages/software';
async function extract(options={}){
 const ctx=createContext('rk',options),html=(await ctx.load(DOWNLOADS,'downloads.html',{refresh:true,validate:b=>b.includes(Buffer.from('data-software-card'))})).toString('utf8');
 const cards=[...html.matchAll(/<li\b([^>]*data-software-card[^>]*)>([\s\S]*?)<\/li>/gi)].filter(match=>/data-has-via="1"/.test(match[1])).map(match=>{
  const title=entities(match[2].match(/class="[^"]*software-card__title"[^>]*>\s*([^<]+)/)?.[1]?.trim()||''),image=match[2].match(/<img\b[^>]*\bdata-src="([^"]+)"/)?.[1];
  const family=title.match(/\b(R65|R75|R87)\b/i)?.[1]?.toUpperCase(),wireless=/\bWireless\b/i.test(title);return {title,family,wireless,imageUrl:image?new URL(entities(image),DOWNLOADS).href:null};
 });
 const archives=[...new Set(links(html,DOWNLOADS).filter(a=>a.text==='VIA Support'&&/\.zip(?:\?|$)/i.test(a.url)).map(a=>a.url))],devices=[],imageCache=new Map();
 for(const url of archives){try{
  const sourceFile='definition-'+hash(url).slice(0,16)+'.zip',bytes=await ctx.load(url,sourceFile);
  for(const entry of jsonDocuments(bytes)){
   const family=entry.file.match(/\b(R65|R75|R87)(?:Pro|\b)/i)?.[1]?.toUpperCase();if(!family||!/Windows.*\.json$/i.test(entry.file))continue;
   const wireless=/Wireless/i.test(entry.file),card=cards.find(card=>card.family===family&&card.wireless===wireless);if(!card?.imageUrl){ctx.warnings.push(entry.file+': 缺少对应原厂商品图');continue;}
   const key=family+'-'+wireless;if(!imageCache.has(key)){const imageUrl=new URL(card.imageUrl);imageUrl.searchParams.set('width','800');imageCache.set(key,await ctx.images([{id:'official',name:'原厂展示图',color:null,imageUrl:imageUrl.href}]));}
   const variants=imageCache.get(key);if(!variants.length)continue;
   const row=rowFor('rk',entry.definition,{label:'RK '+family+(family==='R87'?' Pro':'')+' '+(wireless?'无线版':'有线版')+' QMK/VIA',sourceUrl:url,sourceFile:sourceFile+'#'+entry.file,productUrl:DOWNLOADS,variants});row.support.definitionOS='Windows';devices.push(row);
  }
 }catch(error){ctx.warnings.push(url+': '+error.message);}}
 return ctx.save(devices,{name:'RK 官方软件中心 Windows QMK/VIA 定义与对应型号图',url:DOWNLOADS,scope:'R65/R75/R87 Pro exact wired and wireless VIA editions; configure through USB wired'});
}
module.exports={extract};
if(require.main===module)extract({offline:process.argv.includes('--offline'),updateRegistry:process.argv.includes('--update-registry')}).then(result=>console.log(JSON.stringify({brand:result.brand,models:result.devices.length,stats:result.stats},null,2))).catch(error=>{console.error(error);process.exitCode=1;});
