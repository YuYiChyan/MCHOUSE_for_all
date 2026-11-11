'use strict';
// Run current UI source in a hidden, isolated frame. All APIs/providers are
// in-memory fixtures; the installed main page and user storage stay untouched.
const fs=require('node:fs'),path=require('node:path');
const {connect}=require('./cdp.cjs');
const ROOT=path.resolve(__dirname,'..'),FRAME='one4all-offline-regression';
const bounded=(promise,label,ms=10000)=>{let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Timeout: '+label)),ms);})]).finally(()=>clearTimeout(timer));};

function fixture(){
 document.body.innerHTML='<nav><button data-page="devices">我的设备</button><button data-page="keyboard">键盘</button><button data-page="packages">支持库</button><button data-page="workbench">适配工作台</button></nav><button id="theme"></button><div id="embedded-toolbar" hidden><button id="back"></button><span id="embedded-title"></span></div><h1 id="page-title"></h1><p id="page-caption"></p><button id="refresh"></button><div id="content"></div><div id="notice" hidden></div>';
 const data=new Map();Object.defineProperty(window,'localStorage',{value:{getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,String(value))}});
 const state=window.fixtureState={overlay:false,opens:0,closes:0,melgeekConnects:0,providerCloses:0,catalogDisposeThrows:0,providerCloseThrows:0,controlDisposeThrows:0,errors:[],cases:[]};
 window.addEventListener('error',event=>state.errors.push(event.error?.stack||event.message));window.addEventListener('unhandledrejection',event=>state.errors.push(event.reason?.stack||String(event.reason)));
 const art=[{id:'black',name:'黑色',color:'#222',imageUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1sAAAAASUVORK5CYII='}];
 window.fixtureModels=[
  {id:'ace-60-pro',name:'Ace 60 Pro',kind:'keyboard',brand:'mchose',variants:art,support:{provider:'mchose-web'}},
  {id:'mchose-mouse',name:'迈从目录鼠标',kind:'mouse',brand:'mchose',variants:art,support:{provider:'mchose-web'}},
  {id:'atk-mouse',name:'ATK 离线鼠标',kind:'mouse',brand:'atk',variants:art,support:{provider:'atk-webhid'}},
  {id:'melgeek-keyboard',name:'MelGeek 离线键盘',kind:'keyboard',brand:'melgeek',variants:art,support:{provider:'melgeek-hive'}},
 ];
 window.one4allDesktop={getTheme:async()=>'light',getAppInfo:async()=>({freshInstall:false,version:'fixture'}),listCards:async()=>[],getPackages:async()=>[],getKeyboardDevices:async()=>[],getKeyboardCapabilities:async()=>[],
  closeDevice:async()=>{state.closes++;state.overlay=false;return true;},openBrand:async()=>{state.opens++;state.overlay=true;return true;},openOfficial:async()=>{state.opens++;return true;},
  localVerificationStatus:async request=>({...request,confirmed:false,scope:'local'}),setLocalVerification:()=>{throw Error('Unexpected persistent write');},getVendorRuntime:()=>{throw Error('Unexpected runtime request');}};
 window.One4AllAtk={createApi:()=>({scan:async()=>({devices:[]}),close(){state.providerCloses++;if(state.providerCloseThrows-->0)throw Error('fixture synchronous provider close');}})};
 window.One4AllMelgeek={connect:async()=>{state.melgeekConnects++;throw Error('Unexpected connection');}};
 window.One4AllCatalog={render(container,{onOpen}){const root=document.createElement('section');root.className='fixture-catalog';for(const model of fixtureModels){const button=document.createElement('button');button.dataset.model=model.id;button.textContent=model.name;button.onclick=()=>onOpen(model);root.append(button);}container.append(root);return{ready:Promise.resolve(),dispose(){root.remove();if(state.catalogDisposeThrows-->0)throw Error('fixture catalogue disposal');}};}};
 window.One4AllWorkbench={render(container){const root=document.createElement('section');root.className='fixture-workbench';container.append(root);return{ready:Promise.resolve(),dispose(){root.remove();}};}};
 window.One4AllValidation={open(){throw Error('Unexpected verification dialog');}};
}

async function regression(){
 const state=fixtureState,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const assert=(value,message)=>{if(!value)throw Error(message);};
 const wait=async(fn,label)=>{for(let i=0;i<100;i++){if(fn())return;await pause(20);}throw Error('等待失败：'+label);};
 const nav=async(page,selector)=>{document.querySelector('[data-page="'+page+'"]').click();await wait(()=>document.querySelector('#content '+selector),page);};
 const open=async(id,selector)=>{await nav('packages','.fixture-catalog');document.querySelector('[data-model="'+id+'"]').click();await wait(()=>document.querySelector('#content '+selector),id);};
 const named=(root,name)=>[...root.querySelectorAll('button')].find(button=>button.textContent===name);
 await wait(()=>document.querySelector('#content .empty'),'initial home');
 await open('ace-60-pro','.o4-keyboard-model');
 assert(document.querySelector('.o4-keyboard-info-row')?.textContent.includes('Ace 60 Pro'),'Ace 离线设备信息缺失');
 assert(named(document.querySelector('.o4-keyboard-model'),'连接设备').hidden,'未绑定 provider 的键盘显示了连接按钮');
 assert(state.opens===0&&state.melgeekConnects===0,'离线键盘自动打开官方页或连接其他品牌');
 for(const [page,selector]of [['devices','.empty'],['keyboard','.keyboard-layout'],['workbench','.fixture-workbench'],['packages','.fixture-catalog']]){await nav(page,selector);assert(!state.overlay,'切页后官方覆盖层仍在');}
 state.cases.push('Ace offline details and every primary navigation');
 await open('mchose-mouse','.o4-mouse-info-row');assert(state.opens===0,'目录产品自动打开官方页');assert(!named(document.querySelector('.o4-mouse'),'连接设备'),'目录产品错误显示连接接口');await nav('devices','.empty');state.cases.push('catalogue-only mouse details and return home');
 await open('ace-60-pro','.o4-keyboard-model');named(document.querySelector('.o4-keyboard-model'),'打开官方设置').click();await wait(()=>state.overlay,'manual official page');await nav('devices','.empty');assert(!state.overlay,'离开手动官方页面没有调用 closeDevice');state.cases.push('manual embedded official page closes when navigating away');
 await nav('packages','.fixture-catalog');state.catalogDisposeThrows=1;await nav('devices','.empty');
 await open('atk-mouse','.o4-mouse-info-row');state.providerCloseThrows=1;await nav('devices','.empty');
 const originalRender=One4AllKeyboard.render;window.One4AllKeyboard={render(...args){const view=originalRender(...args);return{...view,dispose(){view.dispose();if(state.controlDisposeThrows-->0)throw Error('fixture keyboard control disposal');}};}};
 await open('melgeek-keyboard','.o4-keyboard-model');state.controlDisposeThrows=1;await nav('devices','.empty');await open('atk-mouse','.o4-mouse-info-row');await nav('devices','.empty');
 assert(state.providerCloses>=2,'离线鼠标 provider 未释放');assert(state.melgeekConnects===0,'离线测试调用了设备连接');state.cases.push('synchronous disposers and close failures do not poison future routes');
 await pause(50);assert(state.errors.length===0,'出现未处理异常：'+state.errors.join('\n'));
 return {cases:state.cases,errors:state.errors,automaticOfficialOpens:state.opens-1,embeddedCloseCalls:state.closes,providerCloseCalls:state.providerCloses,hardwareConnections:state.melgeekConnects,storageWrites:0};
}

(async()=>{
 const c=await bounded(connect(),'CDP connection');let report={at:new Date().toISOString(),success:false,isolation:'hidden frame with memory-only API/providers'},contextId;
 const call=(method,params)=>bounded(c.call(method,params),method);
 try{
  report.stage='frame';await call('Page.enable');await bounded(c.evaluate(`(()=>{const prior=document.getElementById(${JSON.stringify(FRAME)});if(prior)prior.remove();const frame=document.createElement('iframe');frame.id=frame.name=${JSON.stringify(FRAME)};frame.hidden=true;document.body.append(frame);})()`),'create frame');
  const tree=await call('Page.getFrameTree'),frame=tree.frameTree.childFrames?.find(item=>item.frame.name===FRAME)?.frame;if(!frame||frame.id===tree.frameTree.frame.id)throw Error('Isolated fixture frame missing');
  ({executionContextId:contextId}=await call('Page.createIsolatedWorld',{frameId:frame.id,worldName:FRAME}));
  const evaluate=async expression=>{const result=await bounded(c.call('Runtime.evaluate',{expression,contextId,awaitPromise:true,returnByValue:true}),'evaluate '+report.stage,15000);if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result?.value;};
  report.stage='fixture';
  await evaluate('('+fixture.toString()+')()');
  for(const file of ['color-picker.js','local-verification.js','keyboard-controls.js','mouse-controls.js','keyboard-model.js','catalog-details.js','desktop.js']){report.stage=file;await evaluate(fs.readFileSync(path.join(ROOT,'app',file),'utf8'));}
  report.stage='regression';
  Object.assign(report,await evaluate('('+regression.toString()+')()'),{success:true});
 }catch(error){report.error=error.stack||String(error);process.exitCode=1;}
 finally{await bounded(c.evaluate(`document.getElementById(${JSON.stringify(FRAME)})?.remove()`),'remove fixture frame',2000).catch(()=>{});c.close();fs.writeFileSync(path.join(ROOT,'research','offline-navigation-smoke.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
})().catch(error=>{console.error(error);process.exitCode=1;});
