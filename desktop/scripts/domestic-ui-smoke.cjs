'use strict';
// Local Chromium integration checks; no physical setting writes or issue submission.
const fs=require('node:fs');
const {connect}=require('./cdp.cjs');
async function smoke(){
 const delay=ms=>new Promise(r=>setTimeout(r,ms));
 const assert=(v,message)=>{if(!v)throw Error(message);};
 const wait=async predicate=>{for(let i=0;i<100;i++){if(predicate())return;await delay(50);}throw Error('界面未完成加载');};
 const byText=(root,selector,label)=>[...root.querySelectorAll(selector)].find(el=>el.textContent.trim()===label);
 const output={time:new Date().toISOString(),brands:[],hardwareWrites:0,issuesCreated:0};
 const homeCards=await one4allDesktop.listCards();output.originalCards=homeCards.map(c=>c.id);assert(output.originalCards.includes('keyboard')&&output.originalCards.includes('razer')&&output.originalCards.includes('charger'),'原有三张卡不完整');
 const catalog=await one4allDesktop.getDeviceCatalog();
 output.catalogCount=catalog.devices.filter(d=>d.hasImage&&!['component','noninteractive'].includes(d.catalogRole)).length;
 for(const brand of ['atk','vxe','vgn','dareu','rapoo','aula','melgeek']){
  document.querySelector('[data-page="packages"]').click();await wait(()=>document.querySelector('.catalog-filters'));
  const filter=document.querySelector('.catalog-filters select');filter.value=brand;filter.dispatchEvent(new Event('input'));
  const rows=[...document.querySelectorAll('.catalog-grid .device-card')];assert(rows.length,'缺少品牌图卡 '+brand);
  const card=rows.find(row=>row.querySelectorAll('.card-colors button').length>1)||rows[0];
  const title=card.querySelector('h2').textContent,dots=card.querySelectorAll('.card-colors button');
  assert(card.textContent.includes(brand==='melgeek'?'统一键盘设置':'统一鼠标设置'),'未标记直接接口 '+brand);
  if(dots.length>1)dots[1].click();const imageUrl=card.querySelector('img').src;
  card.querySelector('.card-title').click();
  await wait(()=>document.querySelector(brand==='melgeek'?'.o4-keyboard-info-row':'.o4-mouse-info-row'));
  const view=document.querySelector(brand==='melgeek'?'.o4-keyboard-model':'.o4-mouse');
  assert(view,'内页没有使用统一控件 '+brand);
  assert(byText(view,'button','连接设备'),'缺少连接入口 '+brand);
  assert(view.querySelector('.o4-mouse-art img').src===imageUrl,'商品图配色没有传入内页 '+brand);
  assert(!view.querySelector('.o4-mouse-body input,.o4-keyboard-body input'),'离线展示了硬件设置 '+brand);
  assert(byText(view,'button','打开官方设置'),'设备信息缺少官网入口 '+brand);
  output.brands.push({brand,title,colorDots:dots.length,ownControls:true});
  if(brand==='melgeek'){
   byText(view,'button','提交验证反馈').click();await wait(()=>document.querySelector('.o4-validation'));
   assert(document.querySelector('.o4-validation [type="submit"]').disabled,'未确认的验证可提交');document.querySelector('.o4-validation-close').click();
  }
  assert(document.documentElement.scrollWidth<=innerWidth,'页面横向溢出 '+brand);
 }
 const mel=catalog.devices.find(d=>d.brand==='melgeek');
 const bundle=await one4allDesktop.getVendorRuntime(mel.id);
 const wasmBytes=Uint8Array.from(atob(bundle.wasmBase64),c=>c.charCodeAt(0));
 const runtime=await One4AllMelgeekRuntime.createRuntime({wasmBytes,resources:bundle.resources,devices:[]});
 output.melgeekRuntime={release:runtime.release,wasmBytes:wasmBytes.length,resourceCount:Object.keys(bundle.resources).length};await runtime.close();
 // Test selected-key reads and write readback in the actual renderer using a mock provider.
 const fixture=document.createElement('div');document.body.append(fixture);const calls=[];
 const keyCap={id:'rapidTrigger',label:'RT',group:'磁轴',type:'fields',supported:true,readable:true,writable:true,provider:'fixture',version:'1',evidence:['mock device'],readCommand:'rapid.get',writeCommand:'rapid.set',keys:[{value:1,label:'A'},{value:2,label:'B'}],fields:[{id:'key',type:'key',label:'按键'},{id:'enabled',type:'boolean',label:'开启'},{id:'press',type:'number',label:'按下',range:{min:0.1,max:4,step:0.1}}]};
 const kb=One4AllKeyboard.render(fixture,{capabilities:[keyCap],values:{rapidTrigger:{key:1,enabled:true,press:1}},execute:async(command,payload)=>{calls.push({command,payload});return {ok:true,value:{key:payload.selection?.key??payload.value?.key??1,enabled:true,press:1}};}});
 const select=fixture.querySelector('select');select.value='1';select.dispatchEvent(new Event('change'));await delay(30);assert(calls[0]?.payload.selection?.key===2,'逐键设置切换未重读对应键');
 byText(fixture,'button','应用').click();await delay(30);assert(calls.at(-1).payload.selection?.key===2,'写后读回丢失当前按键');
 kb.dispose();fixture.remove();output.keyboardSelectionReadback=true;
 const cancelMount=document.createElement('div');document.body.append(cancelMount);let aborted=false;
 const cancelled=One4AllKeyboardModel.render(cancelMount,{model:mel,api:one4allDesktop,provider:{connect:({signal})=>new Promise((_resolve,reject)=>{signal.addEventListener('abort',()=>{aborted=true;reject(Error('cancelled'));},{once:true});})}});
 byText(cancelMount,'button','连接设备').click();await cancelled.dispose();assert(aborted,'离页未取消正在进行的键盘连接');cancelMount.remove();output.keyboardConnectCancellation=true;
 document.querySelector('[data-page="packages"]').click();await wait(()=>document.querySelector('.catalog-filters'));const filter=document.querySelector('.catalog-filters select');filter.value='melgeek';filter.dispatchEvent(new Event('input'));
 return output;
}
(async()=>{const c=await connect();try{const result=await c.evaluate('('+smoke.toString()+')()');fs.writeFileSync('research/domestic-ui-smoke.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));}finally{c.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
