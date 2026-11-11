'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {buildCatalogPresentation}=require('../core/catalog-presentation.cjs');
const razer=require('../catalog/razer-mice.json').models;
const logitech=require('../catalog/logitech-hidpp.json').models;
const picturedRazer=razer.map(model=>({...model,variants:[{id:'original',name:'原厂图',imageUrl:model.imageUrl}]}));

test('real Razer transport records become one product while every control ID survives',()=>{
 const snapshot=JSON.stringify(picturedRazer),cards=buildCatalogPresentation(picturedRazer);
 assert.equal(cards.length,86);assert.equal(cards.reduce((n,c)=>n+c.members.length,0),113);
 const v3=cards.find(c=>c.displayName==='Razer DeathAdder V3 Pro');
 assert.deepEqual(v3.members.map(m=>m.id),['razer-1532-00b6','razer-1532-00c2','razer-1532-00b7','razer-1532-00c3']);
 assert.equal(v3.variants.length,1);assert.equal(v3.variants[0].sourceVariants.length,4);
 assert.equal(v3.support,v3.members[0].support);assert.equal(v3.members[0],picturedRazer.find(m=>m.id===v3.id));
 assert.equal(JSON.stringify(picturedRazer),snapshot);
});

test('same picture never collapses distinct generations, tiers or sizes',()=>{
 const ids=['razer-1532-00aa','razer-1532-00cc','razer-1532-00d6','razer-1532-0099','razer-1532-0084','razer-1532-008c','razer-1532-00a1','razer-1532-006e','razer-1532-0098'];
 const cards=buildCatalogPresentation(picturedRazer.filter(m=>ids.includes(m.id)));
 assert.equal(cards.length,ids.length);assert.ok(cards.every(c=>c.members.length===1));
 const lancehead=buildCatalogPresentation(picturedRazer.filter(m=>/^Razer Lancehead/.test(m.name)));
 assert.ok(lancehead.some(c=>c.displayName==='Razer Lancehead'));
 assert.ok(lancehead.some(c=>c.displayName==='Razer Lancehead Wireless'));
 assert.ok(lancehead.some(c=>c.displayName==='Razer Lancehead Tournament Edition'));
});

test('real Logitech G403 versions group but G502 Core and Spectrum remain distinct',()=>{
 const ids=['logitech-g403-wired','logitech-g403-wireless','logitech-g502-core','logitech-g502-spectrum'];
 const cards=buildCatalogPresentation(logitech.filter(m=>ids.includes(m.id)));
 assert.equal(cards.length,3);assert.equal(cards.find(c=>c.displayName==='G403').members.length,2);
 assert.deepEqual(cards.filter(c=>c.displayName.startsWith('G502')).map(c=>c.displayName),['G502 Proteus Core','G502 Proteus Spectrum']);
});

test('official same-name platform versions group without merging original hardware generations',()=>{
 const rows=[
  {id:'logitech-g923',brand:'logitech',kind:'wheel',name:'G923',description:'G923 Racing Wheel for XBox One and PC'},
  {id:'logitech-g923-ps4',brand:'logitech',kind:'wheel',name:'G923',description:'G923 Racing Wheel for PlayStation 4 and PC'},
  {id:'logitech-yeti-nano',brand:'logitech',kind:'microphone',name:'Yeti Nano'},
  {id:'logitech-yeti-original-nano',brand:'logitech',kind:'microphone',name:'Yeti Nano'},
 ];
 const cards=buildCatalogPresentation(rows);assert.equal(cards.length,3);assert.equal(cards[0].members.length,2);assert.equal(cards[2].displayName,'Yeti Nano（原版）');
});

test('G HUB regional color entries deduplicate exact artwork and retain all source variant IDs',()=>{
 const model=logitech.find(m=>m.id==='logitech-g305'),variants=[['g305','g305_black.png'],['g305_ext1','g305_black.png'],['g305_ext2','g305_white.png'],['g305_ext3','g305_white.png'],['g305_ext4','g305_blue.png'],['g305_ext5','g305_blue.png']].map(([id,file])=>({id,name:'G305',source:{thumbnail:'pipeline://core_assets/thumbnails/'+file}}));
 const [card]=buildCatalogPresentation([{...model,variants}]);assert.equal(card.variants.length,3);
 assert.deepEqual(card.variants[0].sourceVariants,[{modelId:model.id,variantId:'g305'},{modelId:model.id,variantId:'g305_ext1'}]);
 assert.equal(card.variants.reduce((n,v)=>n+v.sourceVariants.length,0),variants.length);
});

test('same-name categories stay separate and display variant IDs stay unique',()=>{
 const common={brand:'logitech',name:'PRO',kind:'mouse',variants:[{id:'original',imageUrl:'file:///product/black.png'}]};
 const rows=[{...common,id:'first'},{...common,id:'second',variants:[{id:'original',imageUrl:'file:///product/white.png'}]},{...common,id:'keyboard',kind:'keyboard'},{...common,id:'other-brand',brand:'other'}];
 const cards=buildCatalogPresentation(rows);assert.equal(cards.length,3);assert.equal(cards[0].variants.length,2);assert.equal(new Set(cards[0].variants.map(v=>v.id)).size,2);assert.equal(cards[0].variants[1].sourceVariants[0].modelId,'second');
});

test('official VXE name casing groups without merging differently named hardware',()=>{
 const rows=require('../core/atk-models.cjs').getAtkModels().filter(m=>m.brand==='vxe'&&/^VXE R1 Ultra$/i.test(m.name));assert.equal(rows.length,2);
 const [card]=buildCatalogPresentation(rows);assert.equal(card.members.length,2);assert.equal(card.members.flatMap(m=>m.support.hardwareProfiles).length,rows.reduce((n,m)=>n+m.support.hardwareProfiles.length,0));
});

test('confirmed Ace 60 Pro regional layouts share a card with original IDs and layout names intact',()=>{
 const rows=[['mchose-keyboard-ace-60-pro-8184f6','Ace 60 Pro'],['mchose-keyboard-ace-60-pro-iso-fr-27c67d','Ace 60 Pro ISO FR'],['mchose-keyboard-ace-60-pro-nordic-7b0ec4','Ace 60 Pro Nordic'],['mchose-keyboard-ace-60-fdac64','Ace 60'],['mchose-keyboard-ace-60x-i-dc4011','Ace 60X I'],['mchose-keyboard-ace-60x-ii-da8cf9','Ace 60X II']].map(([id,name])=>({id,name,brand:'mchose',kind:'keyboard',support:{provider:'mchose-web-driver'},variants:[{id:'black',imageUrl:'file:///'+id+'.png'}]}));
 const snapshot=JSON.stringify(rows),cards=buildCatalogPresentation(rows),pro=cards.find(card=>card.displayName==='Ace 60 Pro');assert.equal(cards.length,4);assert.deepEqual(pro.members,rows.slice(0,3));assert.deepEqual(pro.members.map(m=>m.name),['Ace 60 Pro','Ace 60 Pro ISO FR','Ace 60 Pro Nordic']);assert.equal(pro.variants.length,3);assert.equal(new Set(pro.variants.map(v=>v.id)).size,3);assert.deepEqual(pro.variants.map(v=>v.sourceVariants[0].modelId),rows.slice(0,3).map(m=>m.id));assert.equal(JSON.stringify(rows),snapshot);
 const distinct=['Ace 60 Pro II','Ace 60 Pro III','Ace 60 Pro 8K','Ace 60 Pro 16K'].map((name,i)=>({...rows[0],id:'tier-'+i,name}));assert.equal(buildCatalogPresentation([...rows.slice(0,3),...distinct]).length,5);
});

test('new VIA layouts and RK transports group without losing exact device definitions',()=>{
 const models=['keychron','monsgeek','akko','rk','redragon'].flatMap(brand=>require('../catalog/'+brand+'-protocols.json').models),groups=buildCatalogPresentation(models);
 assert.equal(models.length,55);assert.equal(groups.length,36);assert.equal(groups.flatMap(g=>g.members).length,55);
 const q1=groups.find(g=>g.displayName==='Keychron Q1 Max');assert.equal(q1.members.length,3);assert.equal(new Set(q1.members.map(m=>m.support.definition.productId)).size,3);
 const r65=groups.find(g=>g.displayName==='RK R65 QMK/VIA');assert.equal(r65.members.length,2);assert.equal(new Set(r65.members.map(m=>m.id)).size,2);
});
