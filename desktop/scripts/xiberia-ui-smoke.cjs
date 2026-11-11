'use strict';
// Hidden Chromium with fake audio APIs. Never loads the app or writes hardware.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{app,BrowserWindow}=require('electron');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'one4all-xiberia-ui-'));app.setPath('userData',path.join(temp,'browser'));app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
 const window=new BrowserWindow({show:false,width:1280,height:850,webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 try{
  const html=path.join(temp,'fixture.html');fs.writeFileSync(html,'<!doctype html><html data-dc-theme="light"><body><main id="fixture"></main></body></html>');await window.loadFile(html);
  for(const name of ['desktop.css','mouse-controls.css','color-picker.css','local-verification.css','xiberia-controls.css'])await window.webContents.insertCSS(fs.readFileSync(path.join(__dirname,'../app',name),'utf8'));
  for(const name of ['color-picker.js','local-verification.js','xiberia-controls.js'])await window.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname,'../app',name),'utf8'));
  const first=require('../catalog/xiberia-headsets.json').models[0];first.variants=first.variants.map(variant=>({...variant,imageUrl:'data:image/png;base64,'+fs.readFileSync(path.join(__dirname,'../core/xiberia/product-assets',variant.file)).toString('base64')}));
  await window.webContents.executeJavaScript('window.fixtureModel='+JSON.stringify(first));
  const result=await window.webContents.executeJavaScript('('+async function(){
   const assert=(ok,message)=>{if(!ok)throw Error(message);},wait=()=>new Promise(resolve=>setTimeout(resolve,30)),host=document.getElementById('fixture'),writes=[];let closes=0;
   const state={connected:true,capabilities:{output:true,input:true,effects:true},values:{outputVolume:62,inputVolume:35,outputMuted:false,inputMuted:false},effects:{ready:true,preset:'Balanced',surround:false,bassBoost:false,voiceClarity:true,smartVolume:false,eq:{enabled:true,gains:[0,0,0,0],frequencies:[100,500,2000,8000]}}};
   const api={xiberiaStatus:async()=>structuredClone(state),xiberiaExecute:async request=>{writes.push(request);if(request.command==='openOfficialApp')return {launched:true};return structuredClone(state);},closeXiberia:async()=>{closes++;},localVerificationStatus:async target=>({...target,confirmed:false,scope:'local'})};
   const model=window.fixtureModel;let view=One4AllXiberia.render(host,{model,api});await view.ready;
   const page=id=>host.querySelector('[data-tab='+id+']').click();assert(host.querySelectorAll('[data-tab]').length===5,'Five audio pages are missing');
   let slider=host.querySelector('[aria-label="耳机音量"]');assert(!slider.disabled&&Number(slider.value)===62,'Output controls not bound to actual readback');slider.value='77';slider.dispatchEvent(new Event('change'));await wait();assert(writes.at(-1).command==='setOutputVolume'&&writes.at(-1).value===77,'Output write route');
   page('eq');slider=host.querySelector('[aria-label="100 Hz 增益"]');slider.value='4.5';slider.dispatchEvent(new Event('input'));host.querySelector('.o4-xiberia-actions .primary').click();await wait();assert(writes.at(-1).command==='setEq'&&writes.at(-1).value.gains[0]===4.5,'EQ draft/apply route');
   page('spatial');host.querySelector('[aria-label="空间环绕"]').click();await wait();assert(writes.at(-1).command==='setSurround'&&writes.at(-1).value===true,'Surround native command');
   page('input');slider=host.querySelector('[aria-label="麦克风音量"]');slider.value='44';slider.dispatchEvent(new Event('change'));await wait();assert(writes.at(-1).command==='setInputVolume','Microphone command route');
   assert(!writes.some(item=>item.command==='openOfficialApp'),'Official app launched during ordinary control');
   page('about');[...host.querySelectorAll('button')].find(button=>button.textContent==='打开官方 APP').click();await wait();assert(writes.at(-1).command==='openOfficialApp','Explicit official button route');assert(writes.every(item=>item.modelId===model.id),'Model identity changed');
   const closed=view.dispose();assert(closed instanceof Promise&&view.dispose()===closed,'Dispose must return one idempotent promise');await closed;assert(closes===1,'Dispose closed twice');
   let finishRead,finishClose;const staleApi={...api,xiberiaStatus:()=>new Promise(resolve=>{finishRead=resolve;}),closeXiberia:()=>new Promise(resolve=>{finishClose=resolve;})};
   view=One4AllXiberia.render(host,{model,api:staleApi});let settled=false;const closing=view.dispose().then(()=>{settled=true;});await wait();assert(!settled,'Dispose returned before service closed');
   finishRead({...state,values:{...state.values,outputVolume:10}});await view.ready;assert(host.children.length===0,'Late state read rebuilt disposed page');finishClose();await closing;
   view=One4AllXiberia.render(host,{model,api});await view.ready;assert(Number(host.querySelector('[aria-label="耳机音量"]').value)===62,'Reopened page inherited stale state');await view.dispose();
   view=One4AllXiberia.render(host,{model,api:{...api,xiberiaStatus:async()=>({connected:false,values:{},capabilities:{output:false,input:false}})}});await view.ready;assert(host.querySelector('[aria-label="耳机音量"]').disabled,'Disconnected hardware write enabled');page('about');assert([...host.querySelectorAll('button')].some(button=>button.textContent==='打开官方 APP'&&!button.disabled),'Disconnected page navigation/button frozen');await view.dispose();
   return {pages:5,outputReadback:true,eqDraftApply:true,spatial:true,input:true,officialOnlyOnClick:true,modelIdentity:true,disposePromise:true,lateReadIgnored:true,reopen:true,disconnectedNavigation:true};
  }.toString()+')()');
  fs.writeFileSync(path.join(__dirname,'../research/xiberia-ui-smoke.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{window.destroy();app.quit();}
}).catch(error=>{console.error(error.stack||error);app.exit(1);});
