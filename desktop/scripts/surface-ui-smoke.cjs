'use strict';
const fs=require('node:fs');
const {connect}=require('./cdp.cjs');
async function smoke(){
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),assert=(value,message)=>{if(!value)throw Error(message);};
 const wait=async condition=>{for(let i=0;i<100;i++){if(condition())return;await pause(50);}throw Error('页面等待超时');};
 const find=(root,selector,label)=>[...root.querySelectorAll(selector)].find(n=>n.textContent.trim()===label);
 const result={at:new Date().toISOString(),hardwareWrites:0,externalReports:0};
 const nav=(name)=>find(document,'.topbar nav button',name).click();
 nav('我的设备');await wait(()=>document.querySelectorAll('.device-card').length===3);
 result.originalCards=document.querySelectorAll('.device-card').length;
 const card=document.querySelector('.device-card'),trigger=card.querySelector('.o4-color-picker__trigger'),palette=card.querySelector('.o4-color-picker__palette'),image=card.querySelector('img');
 assert(trigger&&palette.hidden,'配色应默认折叠');assert(getComputedStyle(trigger.firstElementChild).backgroundImage.includes('color-orb.svg'),'配色入口未使用黑白弧面底纹');assert(trigger.closest('.o4-color-picker').style.getPropertyValue('--o4-picker-tint'),'未设置当前配色滤层');
 const oldImage=image.src,oldChoice=[...palette.children].find(b=>b.getAttribute('aria-checked')==='true'),newChoice=[...palette.children].find(b=>b!==oldChoice);
 trigger.click();assert(!palette.hidden,'圆点没有展开');newChoice.click();await wait(()=>image.src!==oldImage);oldChoice.click();await wait(()=>image.src===oldImage);await pause(280);trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await wait(()=>palette.hidden);result.palette={collapsed:true,pearl:true,currentTint:true,switchRestored:true};
 nav('支持库');await wait(()=>document.querySelector('.catalog-count')?.textContent.includes('款设备')&&document.querySelector('.catalog-grid .device-card'));
 const data=await one4allDesktop.getDeviceCatalog(),visible=data.presentation.filter(d=>d.hasImage&&!['component','noninteractive'].includes(d.catalogRole));result.displayCards=visible.length;
 assert(visible.length<data.devices.filter(d=>d.hasImage&&!['component','noninteractive'].includes(d.catalogRole)).length,'重复入口没有合并');
 const group=visible.find(d=>d.brand==='razer'&&d.members.length>1),brand=document.querySelector('.catalog-filters select'),search=document.querySelector('.catalog-filters input');brand.value='razer';brand.dispatchEvent(new Event('input'));search.value=group.displayName;search.dispatchEvent(new Event('input'));await pause(50);
 const merged=[...document.querySelectorAll('.catalog-grid .device-card')].find(c=>c.querySelector('h2').textContent===group.displayName);assert(merged,'找不到合并产品卡');const versions=merged.querySelector('.catalog-member-select');assert(versions.options.length===group.members.length,'合并丢失版本入口');const initial=versions.value;versions.value=versions.options[1].value;versions.dispatchEvent(new Event('change'));await pause(30);versions.value=initial;versions.dispatchEvent(new Event('change'));result.mergedMembers=versions.options.length;
 find(document,'button','服务器设置').click();await wait(()=>document.querySelector('.o4-server-settings input'));const serverConfig=await one4allDesktop.verificationServerConfig();assert(document.querySelector('.o4-server-settings input').value===(serverConfig.baseURL||''),'服务器地址显示错误');find(document.querySelector('.o4-server-settings'),'button','取消').click();
 if(!serverConfig.configured){find(document,'button','刷新验证状态').click();await wait(()=>document.getElementById('notice').textContent.includes('尚未设置'));result.unconfiguredServerDoesNotSend=true;}
 // Local confirmation is exercised only against an in-memory service, never an actual model record.
 const fixture=document.createElement('section');document.body.append(fixture);let record={modelId:'ui-fixture',providerVersion:'ui-fixture-1',confirmed:false,scope:'local'},writes=0;
 const api={...one4allDesktop,localVerificationStatus:async()=>record,setLocalVerification:async next=>{writes++;record={...next,scope:'local'};return record;}};
 const model={id:record.modelId,name:'界面检查设备',brand:'aula',variants:[],support:{provider:'aula-webhid',version:record.providerVersion}};
 const view=One4AllMouse.render(fixture,{model,api,provider:{scan:async()=>({devices:[]}),close:async()=>{}}});await view.ready;await wait(()=>!fixture.querySelector('.o4-local-verification').disabled);
 fixture.querySelector('.o4-local-verification').click();const modal=document.querySelector('.o4-local-dialog');assert(modal,'本地确认窗口未打开');const confirm=find(modal,'button','保存到本机');assert(confirm.disabled,'未勾选就能确认');const check=modal.querySelector('[type=checkbox]');check.checked=true;check.dispatchEvent(new Event('change'));confirm.click();await wait(()=>fixture.querySelector('.o4-local-verification').textContent==='本机已确认');assert(writes===1,'本机确认重复保存');assert(find(fixture,'button','提交验证反馈'),'上报入口丢失');
 fixture.querySelector('.o4-local-verification').click();find(document.querySelector('.o4-local-dialog'),'button','撤销确认').click();await wait(()=>fixture.querySelector('.o4-local-verification').textContent==='待验证');await view.dispose();fixture.remove();result.localConfirmation={saved:true,revoked:true,scope:'mock-memory'};
 nav('我的设备');await wait(()=>document.querySelectorAll('.device-card').length===3);assert(document.documentElement.scrollWidth<=innerWidth,'出现横向溢出');return result;
}
(async()=>{const c=await connect();try{const result=await c.evaluate('('+smoke.toString()+')()');fs.writeFileSync('research/surface-ui-smoke.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));}finally{c.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
