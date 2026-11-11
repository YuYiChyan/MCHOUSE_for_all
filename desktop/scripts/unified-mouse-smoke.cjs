'use strict';
// Exercises real local renderer paths; hardware writes and GitHub submits use stubs.
const fs=require('node:fs');
const {connect}=require('./cdp.cjs');
async function uiSmoke(){
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const wait=async predicate=>{for(let i=0;i<100;i++){if(predicate())return;await pause(100);}throw Error('UI did not settle');};
 const assert=(value,message)=>{if(!value)throw Error(message);};
 const find=(selector,text)=>[...document.querySelectorAll(selector)].find(el=>el.textContent.trim()===text);
 const click=async(selector,text)=>{const element=find(selector,text);assert(element,'Missing '+text);element.click();await pause(20);return element;};
 const result={at:new Date().toISOString(),hardwareWrites:0,externalIssuesCreated:0};
 document.querySelector('[data-page="packages"]').click();await wait(()=>document.querySelector('.catalog-filters'));
 const selectBrand=async brand=>{const selects=document.querySelectorAll('.catalog-filters select');selects[0].value=brand;selects[1].value='mouse';selects[0].dispatchEvent(new Event('input'));await pause(20);};
 await selectBrand('mchose');
 const implemented=[...document.querySelectorAll('.catalog-grid .device-card')].find(el=>el.textContent.includes('统一鼠标设置'));
 assert(implemented,'No MCHOSE protocol card');const name=implemented.querySelector('h2').textContent;
 const dots=implemented.querySelectorAll('.card-colors button');if(dots.length>1)dots[1].click();
 const art=implemented.querySelector('img').src;implemented.querySelector('.card-title').click();
 await wait(()=>document.querySelector('.o4-mouse-body')?.textContent.includes('设备信息'));
 assert(find('.o4-mouse button','连接设备'),'MCHOSE connect not wired');
 assert(document.querySelector('.o4-mouse-art img').src===art,'Color selection lost on entry');
 assert(!document.querySelector('.o4-mouse-body input'),'Offline device exposed setting inputs');
 result.mchose={name,ownControls:true,connectButton:true,colorPreserved:true};
 await click('.o4-mouse button','提交验证反馈');await wait(()=>document.querySelector('.o4-validation'));
 await wait(()=>!document.querySelector('.o4-validation-auth').textContent.includes('正在读取'));
 assert(document.querySelector('.o4-validation [type="submit"]').disabled,'Unconfirmed report allowed');
 assert(document.querySelector('.o4-validation-auth').textContent.includes('需要登录'),'Browser auth fallback missing');
 result.feedback={entry:true,requiresConfirmation:true,browserFallback:true};
 document.querySelector('.o4-validation-close').click();
 await click('.o4-mouse button','← 返回支持库');await wait(()=>document.querySelector('.catalog-filters'));
 await selectBrand('logitech');
 const search=document.querySelector('.catalog-filters input');search.value='G502 HERO';search.dispatchEvent(new Event('input'));
 document.querySelector('.catalog-grid .card-title').click();await wait(()=>document.querySelector('.o4-mouse-body')?.textContent.includes('设备信息'));
 assert(!document.querySelector('.o4-mouse-body input'),'Offline Logitech has settings');
 result.logitech={name:document.querySelector('.o4-mouse-heading h2').textContent,ownControls:true};
 // Mount a mock connected provider to exercise all shared control writes in Chromium.
 const mount=document.createElement('section');mount.id='protocol-ui-fixture';document.body.append(mount);
 const calls=[],model={id:'fixture-mouse',name:'测试鼠标',brand:'mchose',support:{provider:'mchose-webhid'},variants:[]};
 const state={ok:true,connected:true,interfaceConfirmed:true,device:{id:'fixture',modelId:model.id,name:model.name},capabilities:{dpi:{readable:true,writable:true,min:50,max:30000,step:1,separateAxes:false},pollRate:{readable:true,writable:true,options:[125,500,1000]},dpiStages:{readable:true,writable:true},debounce:{readable:true,writable:true,min:1,max:20},profiles:{readable:true,writable:true,options:[1,2,3]},hostMode:{readable:true,writable:true},lighting:{zones:{backlight:{brightness:{readable:true,writable:true,min:0,max:100}}}}},values:{dpi:[800,800],pollRate:1000,dpiStages:{active:1,stages:[[800,800],[1600,1600]]},debounce:[2,2],profile:1,onboardMode:'host',brightness:{backlight:70}}};
 let closed=false;
 const provider={scan:async()=>({devices:[state.device]}),status:async()=>structuredClone(state),execute:async request=>{calls.push(request);return structuredClone(state);},close:async()=>{closed=true;}};
 const view=One4AllMouse.render(mount,{model,api:one4allDesktop,provider});await view.ready;
 assert(mount.querySelectorAll('.o4-mouse-fields input').length===3,'Single-axis DPI layout incorrect');
 for(const label of ['应用 DPI','应用回报率','切换档位','应用消抖','切换配置','应用模式']){
  const button=[...mount.querySelectorAll('button')].find(el=>el.textContent===label);assert(button,'Missing '+label);button.click();await pause(30);
 }
 const lighting=[...mount.querySelectorAll('.o4-mouse-tabs button')].find(el=>el.textContent==='灯效');lighting.click();
 [...mount.querySelectorAll('button')].find(el=>el.textContent==='应用亮度').click();await pause(30);
 assert(calls.length===7,'Shared write routes not all invoked');
 assert(calls.find(x=>x.command==='hostMode.set').value===true,'Mode value incorrect');
 assert(calls.find(x=>x.command==='dpi.set').value.join() === '800,800','DPI pair incorrect');
 result.mockControlCommands=calls.map(x=>x.command);await view.dispose();mount.remove();assert(closed,'Provider not closed');
 result.overflow=document.documentElement.scrollWidth>innerWidth;assert(!result.overflow,'Horizontal overflow');
 document.querySelector('[data-page="packages"]').click();await wait(()=>document.querySelector('.catalog-filters'));
 await selectBrand('mchose');
 return result;
}
(async()=>{const c=await connect();try{const result=await c.evaluate('('+uiSmoke.toString()+')()');fs.writeFileSync('research/unified-mouse-smoke.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));}finally{c.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
