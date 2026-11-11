'use strict';
// Starts only our staged executable with empty state/cache. No device settings,
// verification submissions, downloads, installation or uninstallation are used.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net');
const {spawn,execFile}=require('node:child_process');
const {promisify}=require('node:util');
const {fileURLToPath}=require('node:url');
const assert=require('node:assert/strict');
const execFileAsync=promisify(execFile),ROOT=path.resolve(__dirname,'..'),PORT=9457;
const EXE=path.join(ROOT,'dist','win-unpacked','One4All.exe'),RESOURCES=path.join(path.dirname(EXE),'resources');
const REPORT=path.join(ROOT,'research','packaged-runtime-smoke.json');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const inside=(root,file)=>{const rel=path.relative(path.resolve(root),path.resolve(file));return rel===''||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel));};
async function waitFor(fn,{timeout=30000,label='condition'}={}){const end=Date.now()+timeout;let last;while(Date.now()<end){try{const value=await fn();if(value)return value;}catch(error){last=error;}await pause(100);}throw Error(label+' did not become ready'+(last?': '+last.message:''));}
async function availablePort(){await new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(PORT,'127.0.0.1',()=>server.close(resolve));});}
async function processIdentity(pid){
 assert.ok(Number.isSafeInteger(pid)&&pid>0);
 const command="[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); Get-CimInstance Win32_Process -Filter 'ProcessId = "+pid+"' | Select-Object ProcessId,ExecutablePath,CommandLine | ConvertTo-Json -Compress";
 const {stdout}=await execFileAsync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,timeout:10000});
 return stdout.trim()?JSON.parse(stdout):null;
}
function assertOwnProcess(identity,pid){assert.equal(identity?.ProcessId,pid);assert.equal(path.resolve(identity.ExecutablePath).toLowerCase(),fs.realpathSync(EXE).toLowerCase());assert.ok(identity.CommandLine.includes('--remote-debugging-port='+PORT));}
async function connectCDP(url){
 const parsed=new URL(url);assert.equal(parsed.hostname,'127.0.0.1');assert.equal(parsed.port,String(PORT));
 const socket=new WebSocket(url);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
 let next=0;const pending=new Map(),events=[];
 socket.onmessage=event=>{const response=JSON.parse(event.data);if(!response.id){events.push(response);return;}const entry=pending.get(response.id);if(!entry)return;pending.delete(response.id);clearTimeout(entry.timer);response.error?entry.reject(Error(response.error.message)):entry.resolve(response.result);};
 socket.onclose=()=>{for(const entry of pending.values()){clearTimeout(entry.timer);entry.reject(Error('CDP connection closed'));}pending.clear();};
 function call(method,params={}){return new Promise((resolve,reject)=>{const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timed out'));},30000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});}
 async function evaluate(expression){const answer=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(answer.exceptionDetails)throw Error(answer.exceptionDetails.exception?.description||answer.exceptionDetails.text);return answer.result?.value;}
 return {call,evaluate,events,close:()=>socket.close()};
}

async function inspectRenderer(){
 const api=window.one4allDesktop,info=await api.getAppInfo(),catalog=await api.getDeviceCatalog();
 const local=await api.listLocalVerifications(),server=await api.verificationServerConfig(),serverRecords=await api.listServerVerifications(),installedCards=await api.listCards();
 const melgeek=catalog.devices.find(model=>model.brand==='melgeek'&&model.support.provider==='melgeek-hive');
 if(!melgeek)throw Error('MelGeek runtime model missing');
 const bundle=await api.getVendorRuntime(melgeek.id),wasm=atob(bundle.wasmBase64),paths=new Set(),renderedImages=new Set();
 const collectPaths=value=>{if(typeof value==='string'&&value)paths.add(value);else if(value&&typeof value==='object')Object.values(value).forEach(collectPaths);};
 const walk=value=>{if(!value||typeof value!=='object')return;for(const [key,item]of Object.entries(value)){if(key==='imagePath'||key==='imagePaths')collectPaths(item);else walk(item);}};
 for(const model of catalog.devices){walk(model);for(const variant of model.variants||[])if(variant.imageUrl)renderedImages.add(variant.imageUrl);}
 const visible=(catalog.presentation||[]).filter(model=>model.hasImage&&!['component','noninteractive'].includes(model.catalogRole));
 return {info,local,server,serverRecords,installedCards:installedCards.map(card=>card.id),catalog:{real:catalog.devices.length,products:catalog.presentation?.length,visible:visible.length,brands:catalog.brands,paths:[...paths],renderedImages:[...renderedImages]},melgeek:{modelId:melgeek.id,wasmBytes:wasm.length,magic:[...wasm.slice(0,4)].map(c=>c.charCodeAt(0)),resourceCount:Object.keys(bundle.resources).length},ui:{title:document.getElementById('page-title')?.textContent,activePage:document.querySelector('[data-page].active')?.dataset.page,catalogCount:document.querySelector('.catalog-count')?.textContent,shownCards:document.querySelectorAll('.catalog-grid .device-card').length,errorText:document.querySelector('.empty p')?.textContent||'',notice:document.getElementById('notice')?.hidden?'':document.getElementById('notice')?.textContent||''}};
}

async function inspectNewProductRoutes(){
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),result=[];
 async function until(fn,label){for(let i=0;i<160;i++){if(fn())return;await pause(50);}throw Error('新型号页面未就绪：'+label);}
 const brands=['keychron','monsgeek','akko','rk','redragon','darmoshark','inphic','attackshark','xiberia'];
 for(const brand of brands){
  document.querySelector('[data-page="packages"]').click();await until(()=>document.querySelector('.catalog-grid .device-card'),'支持库');
  const select=document.querySelector('[aria-label="筛选品牌"]');select.value=brand;select.dispatchEvent(new Event('input',{bubbles:true}));
  const cards=[...document.querySelectorAll('.catalog-grid .device-card')];if(!cards.length)throw Error('新品牌没有商品卡：'+brand);
  const count=document.querySelector('.catalog-count').textContent,first=cards[0],image=first.querySelector('img');if(first.querySelector('.product-brand').textContent!==select.selectedOptions[0].textContent)throw Error('品牌筛选没有生效：'+brand);await until(()=>image.complete&&image.naturalWidth>0,brand+'商品图');
  first.querySelector('.product-open').click();await until(()=>document.querySelector('.o4-mouse'),brand+'详情');
  await until(()=>document.querySelector('.o4-mouse-art img')?.naturalWidth>0,brand+'详情商品图');
  if(['darmoshark','inphic','attackshark'].includes(brand))await until(()=>document.querySelector('.o4-mouse-body .o4-mouse-info-row'),brand+'离线设备信息');
  if(brand==='xiberia')await until(()=>document.querySelector('.o4-mouse-heading .o4-mouse-muted')?.textContent!=='正在检测耳机…',brand+'状态');
  const pages=[];for(const button of document.querySelectorAll('.o4-mouse-tabs button,.o4-keyboard-tabs button')){button.click();await pause(20);pages.push(button.textContent);}
  if(brand==='xiberia'&&pages.length!==5)throw Error('西伯利亚分页缺失');
  if(document.body.innerText.includes('暂时无法读取'))throw Error(brand+'详情读取失败');
  const name=document.getElementById('page-title').textContent;document.querySelector('[data-page="devices"]').click();await until(()=>document.querySelector('.brand-entry'),'返回主页');
  result.push({brand,count,name,pages,artworkLoaded:true,navigationReturned:true});
 }
 document.querySelector('[data-page="packages"]').click();await until(()=>document.querySelector('.catalog-grid .device-card'),'返回支持库');return result;
}

async function main(){
 const startedAt=new Date().toISOString(),report={startedAt,success:false,executable:EXE,debugPort:PORT,hardwareWrites:0,verificationSubmissions:0,installOperations:0};
 let child,page,browser,exitPromise,identity;let stdout='',stderr='';
 try{
  assert.ok(fs.existsSync(EXE),'staged executable is missing');await availablePort();
  const smokeRoot=fs.mkdtempSync(path.join(os.tmpdir(),'one4all-packaged-runtime-')),stateRoot=path.join(smokeRoot,'state'),cacheRoot=path.join(smokeRoot,'cache');
  report.smokeRoot=smokeRoot;report.stateRoot=stateRoot;report.cacheRoot=cacheRoot;assert.equal(fs.existsSync(stateRoot),false);assert.equal(fs.existsSync(cacheRoot),false);
  const env={...process.env,ONE4ALL_DESKTOP_STATE:stateRoot,ONE4ALL_DESKTOP_CACHE:cacheRoot,ONE4ALL_DESKTOP_NO_MIGRATION:'1',ONE4ALL_DESKTOP_HIDDEN:'1'};
  for(const key of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','NODE_PATH','ONE4ALL_DESKTOP_RESOURCES'])delete env[key];
  child=spawn(EXE,['--remote-debugging-port='+PORT,'--remote-debugging-address=127.0.0.1'],{cwd:path.dirname(EXE),env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  report.pid=child.pid;exitPromise=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));
  child.stdout.on('data',chunk=>{stdout=(stdout+chunk).slice(-30000);});child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-30000);});
  let spawnError;child.on('error',error=>{spawnError=error;});
  const version=await waitFor(async()=>{if(spawnError)throw spawnError;if(child.exitCode!==null)throw Error('Staged app exited with '+child.exitCode);const response=await fetch('http://127.0.0.1:'+PORT+'/json/version',{signal:AbortSignal.timeout(1000)});return response.ok?response.json():null;},{label:'packaged DevTools endpoint'});
  identity=await processIdentity(child.pid);assertOwnProcess(identity,child.pid);report.processIdentity=identity;
  browser=await connectCDP(version.webSocketDebuggerUrl);const processInfo=await browser.call('SystemInfo.getProcessInfo');assert.ok(processInfo.processInfo.some(p=>p.type==='browser'&&p.id===child.pid),'DevTools browser is not our spawned process');
  const expectedPage=path.join(RESOURCES,'app','app','index.html');
  const target=await waitFor(async()=>{const rows=await(await fetch('http://127.0.0.1:'+PORT+'/json/list')).json();return rows.find(row=>row.type==='page'&&row.url.startsWith('file:')&&path.resolve(fileURLToPath(row.url)).toLowerCase()===expectedPage.toLowerCase());},{label:'packaged homepage'});
  report.pageURL=target.url;page=await connectCDP(target.webSocketDebuggerUrl);await page.call('Runtime.enable');await page.call('Log.enable');
  await waitFor(()=>page.evaluate("Boolean(window.one4allDesktop && document.querySelector('.catalog-count') && document.querySelectorAll('.catalog-grid .device-card').length)"),{label:'automatic first-launch support catalogue'});
  const result=await page.evaluate('('+inspectRenderer.toString()+')()');
  assert.equal(result.info.version,JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')).version);assert.equal(result.info.freshInstall,true);assert.equal(path.resolve(result.info.stateRoot),stateRoot);assert.equal(path.resolve(result.info.payloadRoot),path.join(stateRoot,'modules','imported'));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(stateRoot,'registry.json'),'utf8')).plugins,[]);assert.deepEqual(result.installedCards,[]);
  const expected=require('../core/device-catalog.cjs').createDeviceCatalog({resourceRoot:path.join(process.env.LOCALAPPDATA,'One4All-Desktop/vendor-resources')}).list();const groups=require('../core/catalog-presentation.cjs').buildCatalogPresentation(expected.devices);assert.equal(result.catalog.real,expected.devices.length);assert.equal(result.catalog.products,groups.length);assert.equal(result.catalog.visible,groups.filter(m=>m.hasImage&&!['component','noninteractive'].includes(m.catalogRole)).length);assert.deepEqual(result.local,[]);assert.deepEqual(result.serverRecords,[]);assert.equal(result.server.configured,false);assert.equal(result.server.baseURL,'');
  assert.equal(result.ui.title,'支持库');assert.equal(result.ui.activePage,'packages');assert.ok(result.ui.shownCards>0);assert.ok(result.ui.catalogCount===result.catalog.visible+' 款设备');assert.equal(result.ui.errorText,'');
  result.newBrandRoutes=await page.evaluate('('+inspectNewProductRoutes.toString()+')()');
  const allowedRoots=[cacheRoot,path.join(RESOURCES,'app')],violations=[];
  const paths=new Set(result.catalog.paths);for(const image of result.catalog.renderedImages){if(!image.startsWith('file:'))violations.push({image,reason:'nonlocal rendered artwork'});else paths.add(fileURLToPath(image));}
  for(const file of paths){if(!path.isAbsolute(file)||!allowedRoots.some(root=>inside(root,file)))violations.push({file,reason:'artwork outside isolated cache or bundled app'});else if(!fs.existsSync(file))violations.push({file,reason:'missing artwork'});}
  assert.deepEqual(violations,[]);const nativePython=path.join(result.info.payloadRoot,'python','python.exe');assert.ok(fs.existsSync(nativePython));assert.ok(inside(stateRoot,nativePython));
  assert.deepEqual(result.melgeek.magic,[0,97,115,109]);assert.ok(result.melgeek.wasmBytes>1000000);assert.equal(result.melgeek.resourceCount,5);
  const desktopLog=path.join(stateRoot,'desktop.log'),entries=fs.readFileSync(desktopLog,'utf8').trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));const errors=entries.filter(entry=>['startup-error','renderer-error','renderer-gone'].includes(entry.type));assert.deepEqual(errors,[]);assert.ok(entries.some(entry=>entry.type==='ready'));
  const cdpErrors=page.events.filter(event=>event.method==='Runtime.exceptionThrown'||event.method==='Log.entryAdded'&&event.params.entry.level==='error');assert.deepEqual(cdpErrors,[]);
  delete result.catalog.paths;delete result.catalog.renderedImages;
  Object.assign(report,{...result,imagePathsChecked:paths.size,imagePathViolations:violations,nativePython,desktopLog,startupErrors:errors,cdpErrors,checksCompletedAt:new Date().toISOString(),success:true});
 }catch(error){report.error={message:error.message,stack:error.stack};report.success=false;}
 finally{
  page?.close();
  if(child?.pid){
   try{
    if(child.exitCode===null){const running=await processIdentity(child.pid);if(running){assertOwnProcess(running,child.pid);if(browser)await browser.call('Browser.close').catch(()=>{});const exited=await Promise.race([exitPromise,pause(8000).then(()=>null)]);if(!exited&&child.exitCode===null){const still=await processIdentity(child.pid);if(still){assertOwnProcess(still,child.pid);await execFileAsync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,timeout:10000});report.forcedOwnedProcessCleanup=true;}}}}
    report.processExit=await Promise.race([exitPromise,pause(3000).then(()=>null)]);report.processClosed=!(await processIdentity(child.pid));assert.equal(report.processClosed,true,'Our packaged test process is still running');
   }catch(error){report.cleanupError=error.message;report.success=false;}
  }
  browser?.close();report.finishedAt=new Date().toISOString();report.stdout=stdout;report.stderr=stderr;fs.mkdirSync(path.dirname(REPORT),{recursive:true});fs.writeFileSync(REPORT,JSON.stringify(report,null,2));
 }
 console.log(JSON.stringify({success:report.success,report:REPORT,smokeRoot:report.smokeRoot,pid:report.pid,version:report.info?.version,freshInstall:report.info?.freshInstall,catalog:report.catalog,imagePathsChecked:report.imagePathsChecked,processClosed:report.processClosed,error:report.error?.message,cleanupError:report.cleanupError},null,2));
 if(!report.success)process.exitCode=1;return report;
}
module.exports={main};if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
