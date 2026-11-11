'use strict';
// Actual keyboard UI and provider, with an in-memory HID fixture in an isolated
// hidden Electron window. This entry point never starts the desktop application.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {app,BrowserWindow}=require('electron');
const project=path.resolve(__dirname,'..'),output=path.join(project,'research');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'one4all-fgg-ui-')));
app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,width:1180,height:850,webPreferences:{contextIsolation:true,nodeIntegration:false,offscreen:true,backgroundThrottling:false,partition:'fgg-ui-smoke'}});
 const runtimeErrors=[];win.webContents.on('console-message',(_event,level,message)=>{if(level>=3&&!message.includes('Electron Security Warning'))runtimeErrors.push(message);});
 win.webContents.session.setPermissionRequestHandler((_web,_permission,respond)=>respond(false));
 win.webContents.session.setDevicePermissionHandler(()=>false);
 win.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_details,callback)=>callback({cancel:true}));
 try{
  await win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<!doctype html><html data-dc-theme="light"><meta charset="utf-8"><body><main id="fixture"></main></body></html>'));
  for(const name of ['desktop','mouse-controls','keyboard-controls','keyboard-model','local-verification','color-picker']){const file=path.join(project,'app',name+'.css');if(fs.existsSync(file))await win.webContents.insertCSS(fs.readFileSync(file,'utf8'));}
  await win.webContents.insertCSS('body{margin:0;padding:24px;background:#edf0f5}.o4-keyboard-model{min-height:740px}');
  for(const name of ['test/fixtures/fgg-hid.cjs','app/fgg-provider.js','app/keyboard-controls.js','app/color-picker.js','app/local-verification.js','app/keyboard-model.js'])await win.webContents.executeJavaScript(fs.readFileSync(path.join(project,name),'utf8'));
  const models=require('../core/fgg-models.cjs').getFggModels();
  await win.webContents.executeJavaScript('window.fixtureModels='+JSON.stringify(models.map(model=>({...model,variants:[]})))+';');
  const result=await win.webContents.executeJavaScript('('+async function(){
   const assert=(condition,label)=>{if(!condition)throw Error(label);};
   const wait=async(check,label)=>{const end=performance.now()+4000;while(!check()){if(performance.now()>end)throw Error(label);await new Promise(resolve=>setTimeout(resolve,8));}};
   const container=document.getElementById('fixture'),device=new FggFakeDevice(),calls=[],notices=[];
   new DataView(device.travel.buffer).setUint16(10,0xc000|139,true);
   const model=fixtureModels.find(m=>m.id==='fgg-373b-1064');let current,view,backCount=0;
   const api={prepareVendorHid:async id=>{calls.push(['prepare',id]);},getVendorRuntime:async()=>{throw Error('Unexpected runtime download');},localVerificationStatus:async target=>({...target,confirmed:false}),openOfficial:async brand=>{calls.push(['official',brand]);},getAppInfo:async()=>({version:'fixture'})};
   const provider={connect:async options=>{current=await One4AllFgg.connect({...options,hid:fggFakeHid(device)});return current;}};
   view=One4AllKeyboardModel.render(container,{model,api,provider,notify:n=>notices.push(n),onBack:()=>{backCount++;void view.dispose();}});
   const button=text=>[...container.querySelectorAll('button')].find(n=>n.textContent===text);
   const tab=name=>{const item=container.querySelector('[data-group="'+name+'"]');assert(item,'Missing tab '+name);item.click();};
   const section=id=>{const el=container.querySelector('[data-capability="'+id+'"]');assert(el,'Missing setting '+id);return el;};
   const controls=id=>[...section(id).querySelectorAll('input,select')];
   const apply=async id=>{const box=section(id);box.querySelector('.o4-keyboard-primary').click();await wait(()=>!box.querySelector('.o4-keyboard-secondary').disabled,'Save hung '+id);assert(!box.querySelector('.is-error'),'Save failed '+id+': '+box.textContent);};
   assert(container.textContent.includes('未连接'),'Offline information not rendered');assert(button('打开官方设置'),'Missing offline official entry');
   button('打开官方设置').click();await wait(()=>calls.some(c=>c[0]==='official'),'Official entry failed');tab('按键测试');assert(container.querySelector('.o4-keyboard-test'),'Offline test page unavailable');
   button('连接设备').click();await wait(()=>current&&container.textContent.includes('已连接'),'Connection did not finish');assert(device.requests.every(b=>[3,4,5,7,0xa0].includes(b[1])),'Connecting wrote settings');
   const groups=[...container.querySelectorAll('[data-group]')].map(n=>n.dataset.group);assert(groups.join('|')==='灯效|性能|磁轴|按键测试|设备信息','Unexpected tab list');
   tab('灯效');assert(controls('lightingEffect')[0].selectedOptions[0].textContent==='常亮','Native lighting state not shown');controls('lightingColor')[0].value='#b24f91';await apply('lightingColor');assert(device.func[14]===178&&device.func[15]===79&&device.func[16]===145,'RGB did not reach native payload');
   controls('lightingBrightness')[0].value='42';await apply('lightingBrightness');assert(device.func[9]===42,'Brightness payload wrong');
   controls('lightingEffect')[0].value='4';await apply('lightingEffect');controls('lightingSpeed')[0].value='4';await apply('lightingSpeed');assert(device.func[10]===0,'Native inverse speed wrong');
   tab('性能');controls('pollingRate')[0].value='1';await apply('pollingRate');assert(device.func[4]===0x93,'Polling update changed scanner nibble');controls('winLock')[0].checked=true;await apply('winLock');assert(device.func[6]===0xab,'Win lock clobbered other locks');
   tab('磁轴');let c=controls('actuation');assert(c[1].min==='0.1'&&c[1].step==='0.02','Basic model range incorrect');c[0].value='1';c[0].dispatchEvent(new Event('change',{bubbles:true}));await wait(()=>!c[0].disabled,'Key selection read hung');assert(c[1].value==='1.4','Changing key did not read that key');c[1].value='1.2';await apply('actuation');assert(new DataView(device.travel.buffer).getUint16(10,true)===(0xc000|119),'Actuation write wrong key or lost flags');
   c=controls('rapidTrigger');c[0].value='1';c[0].dispatchEvent(new Event('change',{bubbles:true}));await wait(()=>!c[0].disabled,'RT selection read hung');c[1].checked=true;c[2].checked=true;c[3].value='0.12';c[4].value='0.24';await apply('rapidTrigger');assert(device.travel[9]===0xb2,'Continuous RT not preserved');
   c=controls('deadzone');c[0].value='1';c[0].dispatchEvent(new Event('change',{bubbles:true}));await wait(()=>!c[0].disabled,'Deadzone selection read hung');c[1].value='0.22';c[2].value='0.44';await apply('deadzone');const word=n=>new DataView(device.travel.buffer).getUint16(n,true);assert(word(12)===(44<<9|11)&&word(14)===(22<<9|23),'Deadzone units or RT preservation wrong');assert(!device.fast,'Fast communication left enabled');
   for(const group of groups){tab(group);assert(container.querySelector('.o4-keyboard-body').children.length,'Empty group '+group);}
   tab('磁轴');const allSettings=current.capabilities.map(c=>c.id);window.fixturePreviewReady=true;
   await new Promise(resolve=>setTimeout(resolve,40));
   // Leave a preview screenshot before checking disposal and a late connection.
   window.fixtureFinish=async()=>{button('← 返回支持库').click();await wait(()=>container.children.length===0&&device.closes===1,'Returning leaked connection');assert(backCount===1,'Back callback missing');
    let release;const delayed=new FggFakeDevice();delayed.openGate=new Promise(resolve=>release=resolve);const pending=One4AllKeyboardModel.render(container,{model,api,provider:{connect:options=>One4AllFgg.connect({...options,hid:fggFakeHid(delayed)})}});button('连接设备').click();await wait(()=>delayed.openGate&&container.textContent.includes('正在连接'),'Delayed connection did not start');await new Promise(resolve=>setTimeout(resolve,15));const dispose=pending.dispose();release();await dispose;assert(container.children.length===0&&!delayed.opened&&delayed.closes===1,'Leaving pending connection leaked handle');return {offlineNavigation:true,officialAction:true,groups,settings:allSettings,keySelectionRead:true,lightingRoundtrip:true,pollingHighBitsPreserved:true,winLockBitsPreserved:true,actuationRoundtrip:true,continuousRtRoundtrip:true,deadzoneRoundtrip:true,backClosesHandle:true,pendingConnectionCancelled:true,writes:device.requests.filter(b=>[6,0xa1].includes(b[1])).length,hardwareTouched:false,notices};};
   return {ready:true};
  }.toString()+')()');
  if(!result.ready)throw Error('Fixture did not render');
  await new Promise(resolve=>setTimeout(resolve,100));
  const shot=await win.webContents.capturePage();fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'fgg-ui-smoke.png'),shot.toPNG());
  const final=await win.webContents.executeJavaScript('window.fixtureFinish()');if(runtimeErrors.length)throw Error(runtimeErrors.join('\n'));
  fs.writeFileSync(path.join(output,'fgg-ui-smoke.json'),JSON.stringify({...final,runtimeErrors},null,2)+'\n');console.log(JSON.stringify(final));
 }finally{win.destroy();app.quit();}
}).catch(error=>{console.error(error);app.exit(1);});
