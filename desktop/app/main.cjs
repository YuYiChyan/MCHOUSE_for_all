'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {app, BrowserWindow, WebContentsView, ipcMain, session, shell, dialog, safeStorage, utilityProcess} = require('electron');
const projectRoot = path.resolve(__dirname, '..');
const stateRoot = process.env.ONE4ALL_DESKTOP_STATE || path.join(app.getPath('appData'), 'One4All-Desktop');
app.setPath('userData', path.join(stateRoot, 'browser'));
app.setName('One4All Desktop');
fs.mkdirSync(stateRoot, {recursive:true});
const homeURL = pathToFileURL(path.join(__dirname,'index.html')).href;
const settingsPath = path.join(stateRoot,'settings.json');
const readJson = (file,fallback) => {try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}};
const settings = readJson(settingsPath,{theme:'light'});
let ai, adapterRunner, deviceCatalog, razerService, logitechService, xiberiaService, validation, localVerification, verificationServer, resourceRefresh;
let mainWindow, runtime, packages, keyboardService, brandView, keyboardTarget, bootstrapInfo;
const packageRoot=process.env.ONE4ALL_DESKTOP_CACHE || path.join(process.env.LOCALAPPDATA || app.getPath('appData'),'One4All-Desktop');
function saveSettings(){fs.writeFileSync(settingsPath,JSON.stringify(settings,null,2));}
function log(type,value){fs.appendFileSync(path.join(stateRoot,'desktop.log'),JSON.stringify({time:new Date().toISOString(),type,value})+'\n');}

function importExistingModules(){
  bootstrapInfo=require('../core/desktop-bootstrap.cjs').prepareDesktopData({stateRoot,legacyRoot:path.join(app.getPath('home'),'One4All'),packageRoot,bundledRoot:process.env.ONE4ALL_DESKTOP_RESOURCES||process.resourcesPath,migrate:process.env.ONE4ALL_DESKTOP_NO_MIGRATION!=='1'});
  return bootstrapInfo.payloadRoot;
}

function assertHome(event){
  if(event.sender!==mainWindow?.webContents || event.senderFrame!==mainWindow.webContents.mainFrame || event.senderFrame.url.split(/[?#]/)[0]!==homeURL)throw Error('此操作仅用于 One4All 首页');
}
function handle(name,fn){ipcMain.handle('one4all-desktop:'+name,(event,...args)=>{assertHome(event);return fn(...args);});}

function closeBrand(){
  if(!brandView)return;
  const current=brandView;brandView=null;
  if(mainWindow&&!mainWindow.isDestroyed()){
    mainWindow.off('resize',current.layout);
    mainWindow.contentView.removeChildView(current.view);
    mainWindow.webContents.send('dc-lab:embedded-state',{open:false});
  }
  if(!current.view.webContents.isDestroyed())current.view.webContents.close();
}
async function chooseDevice(devices,message){
  if(!devices.length)return undefined;
  if(devices.length===1)return devices[0];
  const choices=devices.map((d,i)=>(d.name||d.productName||'HID 设备')+(d.serialNumber?' · '+d.serialNumber:'')+' ('+(i+1)+')');
  const result=await dialog.showMessageBox(mainWindow,{title:'连接设备',message,buttons:[...choices,'取消'],cancelId:choices.length,noLink:true});
  return devices[result.response];
}
function installKeyboardHid(){
  const ses=session.defaultSession;
  const originOK=url=>url===homeURL || url==='file://';
  ses.setPermissionCheckHandler((_wc,permission,origin)=>permission==='hid'&&Boolean(keyboardTarget)&&originOK(origin));
  ses.setPermissionRequestHandler((wc,permission,callback)=>callback(wc===mainWindow?.webContents&&permission==='hid'&&Boolean(keyboardTarget)));
  const matches=require('../core/domestic-models.cjs').matchesHidTarget;
  ses.setDevicePermissionHandler(details=>details.deviceType==='hid'&&originOK(details.origin)&&matches(details.device,keyboardTarget));
  ses.on('select-hid-device',async(event,details,callback)=>{
    event.preventDefault();const target=keyboardTarget;
    if(!target){callback();return;}
    const devices=details.deviceList.filter(d=>matches(d,target));
    try{const selected=await chooseDevice(devices,'发现多个同型号接口，请选择要设置的设备');callback(keyboardTarget===target?selected?.deviceId:undefined);}catch{callback();}
  });
}
async function openBrand(id){
  const entry=packages.catalog().find(item=>item.id===id);
  if(!entry?.webDriver)throw Error('此品牌尚未提供可内嵌的网页驱动，请打开官方 APP。');
  const webURL=new URL(entry.webDriver);
  if(webURL.protocol!=='https:')throw Error('网页驱动地址无效');
  closeBrand();runtime.closeDevice();
  const ses=session.fromPartition('persist:one4all-brand-'+id);
  const hosts=new Set([webURL.hostname,...(id==='mchose'?['cdn.mchose.com.cn','mchose.com.cn']:[])]);
  const allowed=url=>{try{const u=new URL(url);return u.protocol==='https:'&&hosts.has(u.hostname);}catch{return false;}};
  if(!ses.__one4allBrandConfigured){
    ses.__one4allBrandConfigured=true;
    const grants=new Set();
    const identity=device=>[device.vendorId,device.productId,device.serialNumber||''].join(':');
    ses.setPermissionCheckHandler((_wc,permission,origin)=>permission==='hid'&&allowed(origin));
    ses.setPermissionRequestHandler((wc,permission,callback)=>callback(permission==='hid'&&allowed(wc.getURL())));
    ses.setDevicePermissionHandler(details=>details.deviceType==='hid'&&allowed(details.origin)&&grants.has(identity(details.device)));
    ses.on('select-hid-device',async(event,details,callback)=>{
      event.preventDefault();
      try{
        const choices=details.deviceList;
        if(!choices.length){callback();return;}
        const result=await dialog.showMessageBox(mainWindow,{title:'连接 '+entry.brand+' 设备',message:'选择允许此官方网页控制的设备',buttons:[...choices.map((d,i)=>(d.name||d.productName||'HID 设备')+' ('+(i+1)+')'),'取消'],cancelId:choices.length,noLink:true});
        const selected=choices[result.response];if(selected)grants.add(identity(selected));callback(selected?.deviceId);
      }catch{callback();}
    });
  }
  const view=new WebContentsView({webPreferences:{session:ses,contextIsolation:true,nodeIntegration:false,sandbox:true}});
  const layout=()=>{if(mainWindow&&!mainWindow.isDestroyed()){const [width,height]=mainWindow.getContentSize();view.setBounds({x:0,y:60,width,height:Math.max(0,height-60)});}};
  brandView={view,layout,id};mainWindow.contentView.addChildView(view);mainWindow.on('resize',layout);layout();
  view.webContents.setWindowOpenHandler(({url})=>{if(allowed(url))view.webContents.loadURL(url);return{action:'deny'};});
  view.webContents.on('will-navigate',(event,url)=>{if(!allowed(url))event.preventDefault();});
  view.webContents.on('before-input-event',(_event,input)=>{if(input.type==='keyDown'&&input.key==='Escape')closeBrand();});
  mainWindow.webContents.send('dc-lab:embedded-state',{open:true,kind:id,title:entry.name});
  try{await view.webContents.loadURL(entry.webDriver);return brandView?.view===view;}catch(error){if(brandView?.view!==view)return false;closeBrand();throw Error('官方网页暂时无法加载：'+error.message);}
}

if(!app.requestSingleInstanceLock())app.quit();
else {
  app.on('second-instance',()=>{if(mainWindow){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.show();mainWindow.focus();}});
  app.whenReady().then(async()=>{
    const payloadRoot=importExistingModules();
    const registered=readJson(path.join(stateRoot,'registry.json'),{plugins:[]});
    runtime=registered.plugins?.length?require('../runtime/host.cjs').start({stateRoot,payloadRoot,homeURL,getTheme:()=>settings.theme}):{listCards:()=>[],closeDevice:()=>{},setTheme:()=>{},openDevice(){throw Error('请从支持库选择设备');}};
    keyboardService=require('../core/hid/keyboard-service.cjs').createKeyboardService({python:path.join(payloadRoot,'python','python.exe'),profileDirectory:path.join(stateRoot,'data','keyboard-appearance')});
    packages=require('../core/vendor-packages.cjs').createPackageManager({dataRoot:packageRoot,openPath:file=>shell.openPath(file),openExternal:url=>shell.openExternal(url),onProgress:state=>{if(mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.send('one4all-desktop:package-progress',state);}});
    deviceCatalog=require('../core/device-catalog.cjs').createDeviceCatalog({resourceRoot:path.join(packageRoot,'vendor-resources')});
    razerService=require('../core/razer-models.cjs').createRazerService({payloadRoot,stateRoot});
    logitechService=require('../core/logitech-models.cjs').createLogitechService({payloadRoot,stateRoot,resourceRoot:path.join(packageRoot,'vendor-resources')});
    xiberiaService=require('../core/xiberia-models.cjs').createXiberiaService({payloadRoot,stateRoot});
    validation=require('../core/validation-feedback.cjs').createValidationFeedback({dataRoot:stateRoot,openExternal:url=>shell.openExternal(url),...(safeStorage.isEncryptionAvailable()?{encryptString:v=>safeStorage.encryptString(v),decryptString:v=>safeStorage.decryptString(v)}:{})});
    localVerification=require('../core/local-verification.cjs').createLocalVerification({dataRoot:stateRoot});
    verificationServer=require('../core/verification-server.cjs').createVerificationServer({dataRoot:stateRoot});
    resourceRefresh=require('../core/resource-refresh.cjs').createResourceRefresh({utilityProcess});
    handle('refresh-resources',brand=>resourceRefresh.run(brand));
    handle('device-catalog',()=>{const catalog=deviceCatalog.list();return {...catalog,presentation:require('../core/catalog-presentation.cjs').buildCatalogPresentation(catalog.devices),brands:require('../core/domestic-models.cjs').BRANDS};});
    handle('razer-scan',()=>razerService.scan());
    handle('razer-status',id=>razerService.status(id));
    handle('razer-execute',request=>razerService.execute(request));
    handle('logitech-scan',()=>logitechService.scan());
    handle('logitech-status',id=>logitechService.status(id));
    handle('logitech-execute',request=>logitechService.execute(request));
    handle('xiberia-scan',()=>xiberiaService.scan());
    handle('xiberia-status',id=>xiberiaService.status(id));
    handle('xiberia-execute',request=>xiberiaService.execute(request));
    handle('xiberia-close',id=>xiberiaService.closeModel(id));
    function prepareVendorHid(id){const model=deviceCatalog.get(id);if(!['mchose-webhid','atk-webhid','vgn-webhid','dareu-webhid','rapoo-webhid','aula-webhid','melgeek-hive','official-via','inphic-webhid','darmoshark-webhid','attackshark-webhid','fgg-webhid'].includes(model.support.provider))throw Error('此型号尚未接入直接控制接口');keyboardTarget=require('../core/domestic-models.cjs').hidTarget(model);return keyboardTarget;}
    handle('prepare-mchose-hid',prepareVendorHid);
    handle('prepare-vendor-hid',prepareVendorHid);
    handle('vendor-runtime',id=>{const model=deviceCatalog.get(id);if(model.support.provider!=='melgeek-hive')throw Error('此型号不需要额外设备模块');return require('../core/melgeek-runtime.cjs').getRuntime(id,{resourceRoot:path.join(packageRoot,'vendor-resources')});});
    handle('normalize-keyboard-capabilities',report=>require('../core/keyboard-capabilities.cjs').normalizeCapabilities(report));
    handle('validation-config',()=>validation.config());
    handle('validation-save-config',config=>validation.saveConfig(config));
    handle('validation-prepare',request=>validation.prepare(request));
    handle('validation-submit',id=>validation.submit(id));
    handle('validation-list',()=>validation.list());
    handle('local-verification-status',request=>localVerification.status(request));
    handle('local-verification-set',request=>localVerification.set(request));
    handle('local-verification-list',()=>localVerification.list());
    handle('verification-server-config',()=>verificationServer.config());
    handle('verification-server-save-config',config=>verificationServer.saveConfig(config));
    handle('verification-server-refresh',request=>verificationServer.refresh(request));
    handle('verification-server-submit',request=>verificationServer.submit(request));
    handle('verification-server-list',()=>verificationServer.list());
    ai=require('../core/ai-adapter.cjs').createAiAdapter({dataRoot:stateRoot,
      ...(safeStorage.isEncryptionAvailable()?{encryptString:v=>safeStorage.encryptString(v),decryptString:v=>safeStorage.decryptString(v)}:{}),
      getPackageContext:async id=>{const entry=packages.catalog().find(p=>p.id===id);if(!entry)throw Error('请选择支持库中的品牌');const evidence=await require('../core/package-inspector.cjs').inspectPackage({entry,status:packages.status(id)});const models=deviceCatalog.list().devices.filter(d=>d.brand===id);return {...evidence,deviceCatalog:{count:models.length,models:models.slice(0,80).map(d=>({id:d.id,name:d.name,identifiers:d.identifiers,provider:d.support.provider,hasImage:d.hasImage}))}};}
    });
    adapterRunner=require('../core/adapter-runner.cjs').createAdapterRunner({stateRoot,utilityProcess});
    function listDrafts(){const root=path.join(stateRoot,'adapter-drafts');if(!fs.existsSync(root))return [];return fs.readdirSync(root,{withFileTypes:true}).filter(e=>e.isDirectory()).flatMap(e=>{const d=readJson(path.join(root,e.name,'draft.json'),null);return d?[{...d,id:e.name,directory:path.join(root,e.name)}]:[];}).sort((a,b)=>b.id.localeCompare(a.id));}
    function getDraft(id){const d=listDrafts().find(d=>d.id===id);if(!d)throw Error('找不到这份适配草稿');return d;}
    handle('ai-config',()=>ai.config());
    handle('ai-save-config',config=>ai.saveConfig(config));
    handle('ai-test',()=>ai.testConnection());
    handle('ai-generate',request=>ai.generate(request));
    handle('ai-drafts',listDrafts);
    handle('ai-open-draft',id=>shell.openPath(getDraft(id).directory));
    handle('ai-start-draft',async id=>{const draft=getDraft(id),entry=packages.catalog().find(p=>p.id===draft.packageId);const status=packages.status(draft.packageId);const devices=(await keyboardService.status()).devices;const matches=draft.manifest.matches||[];const device=devices.find(d=>matches.some(m=>Number(m.vendorId)===d.vendorId&&Number(m.productId)===d.productId));return adapterRunner.start(draft,status.installedPath?path.dirname(status.installedPath):path.dirname(status.downloadPath||packageRoot),device||{});});
    handle('ai-stop-draft',id=>adapterRunner.stop(id));
    handle('ai-execute-draft',request=>adapterRunner.execute(request));
    handle('list-cards',()=>runtime.listCards());
    handle('open-device',(id,color)=>{closeBrand();return runtime.openDevice(mainWindow.webContents,id,color);});
    handle('close-device',()=>{closeBrand();return runtime.closeDevice();});
    handle('open-brand',openBrand);
    handle('get-theme',()=>settings.theme==='dark'?'dark':'light');
    handle('set-theme',theme=>{if(!['light','dark'].includes(theme))throw Error('未知主题');settings.theme=theme;saveSettings();runtime.setTheme(theme);return theme;});
    handle('get-packages',()=>({catalog:packages.catalog(),status:packages.status()}));
    handle('download-package',id=>packages.download(id));
    handle('install-package',id=>packages.install(id));
    handle('open-official',id=>{const url=require('../core/domestic-models.cjs').OFFICIAL_SETTINGS[id];return url?shell.openExternal(url):packages.openOfficial(id);});
    handle('keyboard-devices',async()=>{const state=await keyboardService.status();return state.devices;});
    handle('prepare-keyboard-hid',async id=>{const state=await keyboardService.status();const target=state.devices.find(device=>device.id===id);if(!target)throw Error('键盘已断开，请重新扫描');if(!target.collections?.some(c=>c.usagePage===0xff60&&c.usage===0x61))throw Error('此键盘没有提供 VIA 原始 HID 接口');keyboardTarget={id:target.id,vendorId:target.vendorId,productId:target.productId,usage:0x61,filters:[{vendorId:target.vendorId,productId:target.productId,usagePage:0xff60,usage:0x61}]};return keyboardTarget;});
    // Provider capability reports are added when an actual protocol adapter has
    // established an interface. Discovery alone cannot unlock hardware writes.
    handle('keyboard-capabilities',async id=>{const state=await keyboardService.status();if(!state.devices.some(device=>device.id===id))throw Error('设备已断开，请重新扫描');return [];});
    handle('keyboard-execute',()=>{throw Error('该设备尚未提供此设置接口，请使用已接入的原厂控制页。');});
    handle('app-info',()=>({version:app.getVersion(),stateRoot,payloadRoot,runtime:process.versions.electron,freshInstall:bootstrapInfo.freshInstall}));
    mainWindow=new BrowserWindow({title:'One4All',icon:path.join(__dirname,'assets/one4all.png'),width:1360,height:900,minWidth:960,minHeight:680,backgroundColor:settings.theme==='dark'?'#14171c':'#f5f6f8',autoHideMenuBar:true,show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
    mainWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    mainWindow.webContents.on('will-navigate',(event,url)=>{if(url!==homeURL)event.preventDefault();});
    mainWindow.webContents.on('console-message',(_event,details)=>{if(details.level==='error')log('renderer-error',details.message);});
    mainWindow.webContents.on('render-process-gone',(_event,details)=>log('renderer-gone',details));
    mainWindow.on('closed',()=>{closeBrand();runtime.closeDevice();mainWindow=null;});
    mainWindow.once('ready-to-show',()=>{if(process.env.ONE4ALL_DESKTOP_HIDDEN!=='1')mainWindow.show();});
    installKeyboardHid();
    await mainWindow.loadURL(homeURL);
    log('ready',{version:app.getVersion(),cards:runtime.listCards().map(card=>card.id),payloadRoot});
  }).catch(error=>{log('startup-error',error.stack||error.message);dialog.showErrorBox('One4All 启动失败',error.message);app.quit();});
  app.on('window-all-closed',()=>app.quit());
  app.on('before-quit',()=>{adapterRunner?.stop();resourceRefresh?.close();razerService?.close().catch(()=>{});logitechService?.close().catch(()=>{});xiberiaService?.close().catch(()=>{});keyboardService?.close().catch(()=>{});});
}
