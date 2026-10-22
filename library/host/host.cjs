'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { startServer } = require('./local-server.cjs');
const electron = require('electron');
const { app, BrowserWindow, ipcMain, dialog, session, WebContentsView } = electron;
exports.start = function start({ stateRoot }) {
if (global.__one4allHostStarted) return;
global.__one4allHostStarted = true;
const base = __dirname;
const registry = JSON.parse(fs.readFileSync(path.join(stateRoot,'registry.json'),'utf8'));
const enabled = new Set(registry.plugins.map(plugin=>plugin.id));
const xiberiaCatalog=fs.existsSync(path.join(base,'xiberia-runtime','catalog.json'))
  ? require('./xiberia-runtime/catalog.json').filter(model=>enabled.has(model.id)) : [];
const xiberiaIds=xiberiaCatalog.map(model=>model.id);
const deviceIds=['g309','blackshark',...xiberiaIds];
const deviceServices=Object.fromEntries(deviceIds.filter(id=>enabled.has(id)).map(id=>[id,require('./device-service.cjs').createService(id,base)]));
const dataRoot=path.join(stateRoot,'data');
fs.mkdirSync(dataRoot,{recursive:true});
let hidService=null;
function getHidService(){
  if(!enabled.has('hid'))throw Error('HID card is not installed');
  if(!hidService){const viaCatalog=JSON.parse(fs.readFileSync(path.join(base,'generic-hid','vendor','via','catalog.json'),'utf8'));hidService=require('./generic-hid/hid/keyboard-service.cjs').createKeyboardService({python:path.join(base,'python','python.exe'),profileDirectory:path.join(dataRoot,'one4all-hid-keyboard'),viaCatalog});}
  return hidService;
}
const hidPageUrl=pathToFileURL(path.join(base,'generic-hid','examples','hid-keyboard.html')).href;
const hidTest=enabled.has('hid')?require('./generic-hid/hid/test-session.cjs').createTestSession({python:path.join(base,'python','python.exe')}):null;
const chargerService = enabled.has('charger') ? require('./charger-service.cjs')(base, app, path.join(dataRoot,'charger')) : null;
const logFile = path.join(stateRoot, 'host.log');
try { if(fs.statSync(logFile).size>2*1024*1024)fs.renameSync(logFile,logFile+'.previous'); } catch {}
function log(type, value) { fs.appendFileSync(logFile, JSON.stringify({ time: new Date().toISOString(), type, value }) + '\n'); }
log('runtime', process.versions);

const trusted = url => {
  try {
    const u = new URL(url);
    if (u.protocol === 'mchose-renderer:') {
      return u.hostname === 'app' && u.pathname.startsWith('/cdn.mchose.com.cn/customPage/prod/');
    }
    const h = u.hostname;
    return u.protocol === 'https:' && (h === 'www.mchose.com.cn' || h === 'mchose.com.cn' || h === 'cdn.mchose.com.cn');
  } catch { return false; }
};
const keyboardHosts = new Set(['hub.eweadn.cn', 'eweadn.driveall.cn']);
let tankServerPromise = null;
let tankLocalOrigin = null;
function getTankServer() {
  if (!tankServerPromise) {
    tankServerPromise = startServer(path.join(base, 'tank68-local')).then(server => {
      tankLocalOrigin = server.origin;
      log('tank-server', server.origin);
      return server;
    });
  }
  return tankServerPromise;
}
function keyboardOrigin(url) {
  try {
    const parsed = new URL(url);
    if (tankLocalOrigin && parsed.origin === tankLocalOrigin) return true;
    return keyboardHosts.has(parsed.hostname);
  } catch { return false; }
}
const mainPageUrl = pathToFileURL(path.join(base, 'razer.html')).href;
const topPageTitles = { g309:'Logitech G309',blackshark:'Razer BlackShark V2', keyboard: 'TANK68HE', razer: 'Razer Viper Mini SE · 本地控制器', charger:'CUKTECH 10 Ultra' };
topPageTitles.hid='通用 HID 外设';
const productColors = {
  hid:{default:'hid',allowed:new Set(['hid'])},
  g309:{default:'g309',allowed:new Set(['g309','g309-white'])},blackshark:{default:'blackshark',allowed:new Set(['blackshark','blackshark-green','blackshark-white'])},
  keyboard: { default: 'tank68-purple', allowed: new Set(['tank68-purple', 'tank68-black']) },
  razer: { default: 'razer-black', allowed: new Set(['razer-black', 'razer-white']) },
  charger: {default:'cuktech-10-ultra', allowed:new Set(['cuktech-10-ultra','cuktech-10-ultra-black'])},
};
const productAssets = {
  g309:path.join(base,'product-assets','g309-black.png'),'g309-white':path.join(base,'product-assets','g309-white.png'),
  blackshark:path.join(base,'product-assets','blackshark-black.png'),'blackshark-green':path.join(base,'product-assets','blackshark-green.png'),'blackshark-white':path.join(base,'product-assets','blackshark-white.png'),
  'tank68-purple': path.join(base, 'product-assets', 'tank68-purple.webp'),
  'tank68-black': path.join(base, 'product-assets', 'tank68-black.webp'),
  'razer-black': path.join(base, 'product-assets', 'razer-black.webp'),
  'razer-white': path.join(base, 'product-assets', 'razer-white.webp'),
  'cuktech-10-ultra':path.join(base,'product-assets','cuktech-10-ultra.png'),
  'cuktech-10-ultra-black':path.join(base,'product-assets','cuktech-10-ultra-black.png'),
};
for(const model of xiberiaCatalog){
  topPageTitles[model.id]=model.title;
  productColors[model.id]={default:model.colors[0].id,allowed:new Set(model.colors.map(color=>color.id))};
  for(const color of model.colors)productAssets[color.id]=path.join(base,'product-assets',color.file);
}
const productArtCache = new Map();
let embedded = null;
let viaServer=null,viaOrigin=null,viaTarget=null;
function genericHidSession(){
  const ses=session.fromPartition('persist:one4all-generic-hid');
  if(ses.__one4allVia)return ses;ses.__one4allVia=true;
  const allowed=origin=>{try{return viaOrigin&&new URL(origin).origin===viaOrigin&&viaTarget&&embedded?.kind==='hid';}catch{return false;}};
  ses.setPermissionCheckHandler((_wc,permission,origin)=>permission==='hid'&&!!allowed(origin));
  ses.setPermissionRequestHandler((_wc,permission,callback,details)=>callback(permission==='hid'&&!!allowed(details.requestingUrl)));
  ses.setDevicePermissionHandler(details=>details.deviceType==='hid'&&!!allowed(details.origin)&&!viaTarget.multiple&&details.device.vendorId===viaTarget.vendorId&&details.device.productId===viaTarget.productId);
  ses.on('select-hid-device',async(event,details,callback)=>{
    event.preventDefault();const target=viaTarget,wc=embedded?.view.webContents;
    const notify=value=>{if(wc&&!wc.isDestroyed()&&viaTarget===target)wc.send('one4all-keyboard:via-result',value);};
    if(!target){callback();return;}
    const matches=details.deviceList.filter(d=>d.vendorId===target.vendorId&&d.productId===target.productId);
    if(!matches.length){notify({status:'no-interface'});callback();return;}
    let selected=matches[0];
    if(matches.length>1){
      const result=await dialog.showMessageBox({type:'question',title:'选择 VIA 设备',message:'发现多个同型号接口，请选择要连接的设备',buttons:[...matches.map((d,i)=>(d.name||d.productName||'HID 设备')+' '+(i+1)),'取消'],cancelId:matches.length,noLink:true});
      if(viaTarget!==target||result.response>=matches.length){notify({status:'cancelled'});callback();return;}
      selected=matches[result.response];
    }
    notify({status:'selected'});callback(selected.deviceId);
  });
  ses.webRequest.onBeforeRequest((details,callback)=>{let ok=false;try{const u=new URL(details.url);ok=['file:','data:','blob:'].includes(u.protocol)||(u.protocol==='http:'&&u.origin===viaOrigin);}catch{}callback({cancel:!ok});});
  return ses;
}

function getProductArt(kind) {
  let file = productAssets[kind];
  if (kind === 'cuktech-10-ultra' || kind === 'cuktech-10-ultra-black') {
    file = ['png','webp'].map(ext=>path.join(base,'product-assets',`${kind}.${ext}`)).find(candidate=>fs.existsSync(candidate));
    if (!file) throw new Error('Charger artwork pending');
    const bytes = fs.readFileSync(file);
    return {kind,mimeType:file.endsWith('.png')?'image/png':'image/webp',base64:bytes.toString('base64')};
  }
  if (!file || !fs.existsSync(file)) throw new Error('Product art is not installed');
  if (!productArtCache.has(kind)) {
    productArtCache.set(kind, {
      kind,
      mimeType: file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':'image/webp',
      base64: fs.readFileSync(file).toString('base64'),
    });
  }
  return productArtCache.get(kind);
}

function listFrames(wc) {
  try {
    const root = wc.mainFrame;
    if (!root) return [];
    const subtree = typeof root.framesInSubtree === 'function' ? root.framesInSubtree() : root.framesInSubtree;
    return Array.isArray(subtree) ? subtree : (root.frames || []);
  } catch { return []; }
}

async function readMchoseTheme(wc) {
  const frame = listFrames(wc).find(item => (item.url || '').startsWith('https://www.mchose.com.cn/'));
  if (!frame) return 'light';
  try {
    const value = await frame.executeJavaScript(
      `localStorage.getItem('theme') || (document.documentElement.classList.contains('theme-dark') ? 'dark' : 'light')`,
      true,
    );
    return value === 'dark' ? 'dark' : 'light';
  } catch (error) {
    log('theme-read-error', error.message);
    return 'light';
  }
}

function setEmbeddedTheme(view, theme) {
  if (!view || view.webContents.isDestroyed()) return;
  const safe = theme === 'dark' ? 'dark' : 'light';
  view.webContents.executeJavaScript(`(() => {
    document.documentElement.dataset.dcTheme = ${JSON.stringify(safe)};
    document.documentElement.setAttribute('theme-mode', ${JSON.stringify(safe)});
    window.driveCenterTankTheme && window.driveCenterTankTheme(${JSON.stringify(safe)});
  })()`).catch(error => log('embedded-theme-error', error.message));
}

function sendEmbeddedState(win, state) {
  try { if (win && !win.isDestroyed()) win.webContents.send('dc-lab:embedded-state', state); } catch (error) { log('embedded-state-error', error.message); }
}

function protectWebContents(wc, allowed) {
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
  wc.on('will-navigate', (event, url) => {
    const ok = allowed(url);
    log('will-navigate', { id: wc.id, url, allowed: ok });
    if (!ok) event.preventDefault();
  });
  wc.on('will-redirect', (event, url) => {
    const ok = allowed(url);
    log('will-redirect', { id: wc.id, url, allowed: ok });
    if (!ok) event.preventDefault();
  });
}

function closeEmbedded() {
  if (!embedded) return;
  hidTest?.stop();
  viaTarget=null;
  const { win, view, layout, themeTimer } = embedded;
  embedded = null;
  if (themeTimer) clearInterval(themeTimer);
  try { for(const event of ['resize','show','restore','focus'])win.off(event,layout); } catch {}
  try { win.off('blur',stopHidTest); } catch {}
  try { win.contentView.removeChildView(view); } catch (error) { log('embedded-remove-error', error.message); }
  try { if (!view.webContents.isDestroyed()) view.webContents.close(); } catch (error) { log('embedded-close-error', error.message); }
  sendEmbeddedState(win, { open: false });
  log('embedded-closed', { windowCount: BrowserWindow.getAllWindows().length });
}

function ensureKeyboardSession() {
  const ses = session.fromPartition('persist:drivecenter-tank68-lab');
  ses.setPermissionCheckHandler((_wc, permission, origin) => permission === 'hid' && keyboardOrigin(origin));
  ses.setDevicePermissionHandler(d => d.deviceType === 'hid' && keyboardOrigin(d.origin) && d.device.vendorId === 0x0c45 && d.device.productId === 0x8045);
  ses.setPermissionRequestHandler((wc, permission, callback) => callback(permission === 'hid' && keyboardOrigin(wc.getURL())));
  if (!ses.__dcInstalled) {
    ses.__dcInstalled = true;
    ses.on('select-hid-device', async (event, details, callback) => {
      event.preventDefault();
      const matches = details.deviceList.filter(d => d.vendorId === 0x0c45 && d.productId === 0x8045);
      log('keyboard-hid-chooser', {
        offered: details.deviceList.map(d => ({ name: d.name, productName: d.productName, vendorId: d.vendorId, productId: d.productId })),
        matches: matches.length,
      });
      if (!matches.length) { callback(); return; }
      try {
        const options = {
          type: 'question',
          title: '连接 Tank68 HE',
          message: '允许官方网页驱动连接 Tank68 HE？',
          detail: '只允许 0C45:8045，不授权其他外设。',
          buttons: ['连接键盘', '取消'],
          defaultId: 0,
          cancelId: 1,
        };
        const parent = embedded?.win;
        const result = parent ? await dialog.showMessageBox(parent, options) : await dialog.showMessageBox(options);
        callback(result.response === 0 ? matches[0].deviceId : undefined);
      } catch { callback(); }
    });
  }
  return ses;
}

function ensureRazerSession() {
  const ses = session.fromPartition('persist:drivecenter-razer-lab');
  ses.setPermissionCheckHandler(() => false);
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  ses.setDevicePermissionHandler(() => false);
  return ses;
}

async function openEmbedded(sender, kind, requestedColor) {
  const win = BrowserWindow.fromWebContents(sender);
  if (!win) throw new Error('找不到主窗口');
  if(win.isMinimized())win.restore();
  if(!win.isVisible())win.show();
  win.focus();
  if (embedded) {
    if (embedded.win === win && embedded.kind === kind) return true;
    closeEmbedded();
  }
  const tankServer = kind === 'keyboard' ? await getTankServer() : null;
  const initialTheme = await readMchoseTheme(sender);
  const color = productColors[kind].allowed.has(requestedColor) ? requestedColor : productColors[kind].default;
  const webPreferences = kind==='hid'
    ? {session:genericHidSession(),preload:path.join(base,'generic-hid','examples','hid-keyboard-preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false}
    : deviceIds.includes(kind)
    ? {session:session.fromPartition('persist:one4all-'+kind),preload:path.join(base,'device-preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false}
    : kind === 'keyboard'
    ? { session: ensureKeyboardSession(), preload: path.join(base, 'keyboard-preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false }
    : kind === 'charger'
    ? {session:session.fromPartition('persist:drivecenter-charger-lab'),preload:path.join(base,'charger-preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false}
    : { session: ensureRazerSession(), preload: path.join(base, 'lab-preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false };
  const view = new WebContentsView({ webPreferences });
  protectWebContents(view.webContents, kind==='hid'
    ? url=>url.split('?')[0]===hidPageUrl
    : kind === 'keyboard'
    ? keyboardOrigin
    : url => url.startsWith('file:') || url.startsWith('about:'));
  win.contentView.addChildView(view);
  const layout = () => {
    try {
      const [width, height] = win.getContentSize();
      if(width<=0||height<=0)return;
      view.setBounds({ x: 0, y: 0, width, height });
    } catch (error) { log('embedded-layout-error', error.message); }
  };
  layout();
  for(const event of ['resize','show','restore','focus'])win.on(event,layout);
  if(kind==='hid')win.on('blur',stopHidTest);
  setTimeout(layout,150);
  view.webContents.on('dom-ready',layout);
  view.webContents.on('before-input-event', (event, input) => {
    if(kind==='hid'&&hidTest?.active&&input.code&&['keyDown','keyUp'].includes(input.type)){
      event.preventDefault();
      view.webContents.send('one4all-keyboard:test-key',{code:input.code,down:input.type==='keyDown',ctrlKey:!!input.control,metaKey:!!input.meta,altKey:!!input.alt,shiftKey:!!input.shift});
      return;
    }
    if (kind!=='hid' && input.type === 'keyDown' && input.key === 'Escape') {
      event.preventDefault();
      closeEmbedded();
    }
  });
  view.webContents.on('destroyed', () => {
    log('embedded-view-destroyed', { kind });
    if (embedded?.view !== view) return;
    closeEmbedded();
  });
  view.webContents.on('render-process-gone', (_event, details) => {
    log('embedded-render-gone', { kind, details });
  });
  view.webContents.on('did-start-navigation', (_event, url, isInPlace, isMainFrame) => {
    log('embedded-navigation', { kind, url, isInPlace, isMainFrame });
  });
  embedded = { win, view, kind, layout, theme: initialTheme, themeTimer: null };
  log('embedded-open', {
    kind,
    windowCount: BrowserWindow.getAllWindows().length,
    contentSize: win.getContentSize(),
    viewChildren: win.contentView.children?.length,
    bounds: view.getBounds(),
    theme: initialTheme,
  });
  sendEmbeddedState(win, { open: true, kind, title: topPageTitles[kind], theme: initialTheme, nativeHeader: true });
  if(kind==='hid'){
    view.webContents.loadURL(`${hidPageUrl}?dcTheme=${initialTheme}`).catch(error=>log('hid-view-error',error.message));
  } else if (kind === 'keyboard') {
    const keyboardUrl = `${tankServer.origin}/index.html?dcTheme=${initialTheme}&dcColor=${encodeURIComponent(color)}#/?productId=32837&vendorId=3141&productName=Tank68%20HE`;
    view.webContents.loadURL(keyboardUrl)
      .then(() => log('keyboard-view-resolved', view.webContents.getURL()))
      .catch(error => log('keyboard-view-error', error.message));
  } else if (deviceIds.includes(kind)) {
    view.webContents.loadURL(`${pathToFileURL(path.join(base,kind+'.html')).href}?dcTheme=${initialTheme}&color=${encodeURIComponent(color)}&displayName=${encodeURIComponent(topPageTitles[kind])}`).catch(error=>log('device-view-error',error.message));
  } else if (kind === 'charger') {
    view.webContents.loadURL(`${pathToFileURL(path.join(base,'charger.html')).href}?dcTheme=${initialTheme}&color=${encodeURIComponent(color)}`)
      .catch(error=>log('charger-view-error',error.message));
  } else {
    view.webContents.loadURL(`${pathToFileURL(path.join(base, 'razer.html')).href}?color=${encodeURIComponent(color)}`)
      .catch(error => log('razer-view-error', error.message));
  }
  view.webContents.once('dom-ready', () => setEmbeddedTheme(view, initialTheme));
  const themeTimer = setInterval(async () => {
    if (!embedded || embedded.view !== view || view.webContents.isDestroyed()) return;
    const next = await readMchoseTheme(win.webContents);
    if (next === embedded.theme) return;
    embedded.theme = next;
    setEmbeddedTheme(view, next);
    sendEmbeddedState(win, { open: true, kind, title: topPageTitles[kind], theme: next });
    log('embedded-theme-sync', { kind, theme: next });
  }, 1200);
  embedded.themeTimer = themeTimer;
  const logViewState = async () => {
    if (embedded?.view !== view || view.webContents.isDestroyed()) return;
    try {
      const state = await view.webContents.executeJavaScript(`(async()=>({
        url: location.href,
        title: document.title,
        theme: document.documentElement.dataset.dcTheme,
        textLength: document.body.innerText.length,
        hidDevices: typeof navigator.hid === 'object'
          ? (await navigator.hid.getDevices()).map(d => ({ vendorId: d.vendorId.toString(16), productId: d.productId.toString(16), productName: d.productName, opened: d.opened }))
          : [],
        rateOptions: [...document.querySelectorAll('#rate option')].map(option => option.value),
        rateValue: document.getElementById('rate')?.value,
        dpiOptions: [...document.querySelectorAll('#dpiStage option')].map(option => option.value),
        dpiValue: document.getElementById('dpiStage')?.value,
        navCount: document.querySelectorAll('.device-nav button').length,
        previewImages: document.querySelectorAll('img[data-product-image]').length,
        header: !!document.querySelector('.dc-tank-header'),
        loader: !!document.getElementById('dc-loading'),
        tankPreview: document.querySelector('[data-dc-tank-preview]')?.src.split('/').pop() || null,
        sidebar: !!document.querySelector('.dc-sidebar'),
        navItems: document.querySelectorAll('.dc-nav-item').length,
        tabs: [...document.querySelectorAll('.dc-tab')].map(tab => tab.textContent),
        activeTab: document.querySelector('.dc-tab.active')?.textContent || null,
        configCards: document.querySelectorAll('.dc-card').length,
        colorSwatches: document.querySelectorAll('[data-razer-color]').length,
        productImage: document.querySelector('[data-product-image]')?.src.split('/').pop() || null,
        tankLayout: ['.home', '.device', '.dc-tank-header', '.dc-sidebar', '.device-left', '.device-right', '.dc-menu', '.device-right-key', '.device-right-set']
          .map(selector => {
            const node = document.querySelector(selector);
            if (!node) return { selector, found: false };
            const rect = node.getBoundingClientRect();
            return { selector, rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height }, overflow: getComputedStyle(node).overflow };
          })
      }))()`, true);
      log('embedded-view-ready', {
        kind,
        state,
        bounds: view.getBounds(),
        viewChildren: win.contentView.children?.length,
      });
    } catch (error) {
      log('embedded-view-ready-error', { kind, error: error.message });
    }
  };
  setTimeout(logViewState, 2500);
  setTimeout(logViewState, 11000);
  return true;
}

function assertHidPage(event){
  if(!enabled.has('hid')||embedded?.kind!=='hid'||embedded.view.webContents!==event.sender||event.senderFrame!==event.sender.mainFrame||event.senderFrame.url.split('?')[0]!==hidPageUrl)throw Error('Active local HID view only');
}
function stopHidTest(){
  hidTest?.stop();
  if(embedded?.kind==='hid'&&!embedded.view.webContents.isDestroyed())embedded.view.webContents.send('one4all-keyboard:test-stopped',{reason:'focus-lost'});
}
ipcMain.handle('one4all-keyboard:test-start',event=>{
  assertHidPage(event);const wc=event.sender;
  return hidTest.start({onKey:value=>{if(!wc.isDestroyed())wc.send('one4all-keyboard:test-key',value);},onStopped:value=>{if(!wc.isDestroyed())wc.send('one4all-keyboard:test-stopped',value);}});
});
ipcMain.handle('one4all-keyboard:test-stop',event=>{assertHidPage(event);hidTest.stop();return true;});
ipcMain.handle('one4all-keyboard:status',event=>{assertHidPage(event);return getHidService().status();});
ipcMain.handle('one4all-keyboard:appearance',(event,value)=>{assertHidPage(event);return getHidService().saveAppearance(value);});
ipcMain.handle('one4all-keyboard:via-open',async(event,id,mode='connect')=>{
  assertHidPage(event);hidTest.stop();
  if(!['connect','design'].includes(mode))throw Error('未知 VIA 页面');
  const state=await getHidService().status(),device=state.devices.find(d=>d.id===id);
  if(!device)throw Error('设备已断开，请刷新后重试');
  if(!viaServer){
    const portFile=path.join(dataRoot,'one4all-hid-keyboard','via-port.json');let port=0;
    try{const saved=JSON.parse(fs.readFileSync(portFile,'utf8')).port;if(Number.isInteger(saved)&&saved>=1024&&saved<=65535)port=saved;}catch{}
    viaServer=startServer(path.join(base,'generic-hid','vendor','via','app'),{port,spaFallback:true}).catch(error=>{if(port&&error.code==='EADDRINUSE')return startServer(path.join(base,'generic-hid','vendor','via','app'),{spaFallback:true});throw error;}).then(value=>{
      viaOrigin=value.origin;fs.mkdirSync(path.dirname(portFile),{recursive:true});fs.writeFileSync(portFile,JSON.stringify({port:Number(new URL(value.origin).port)}));return value;
    }).catch(error=>{viaServer=null;throw error;});
  }
  const server=await viaServer;assertHidPage(event);viaTarget={vendorId:device.vendorId,productId:device.productId,multiple:state.devices.filter(d=>d.vendorId===device.vendorId&&d.productId===device.productId).length>1};
  return {url:server.origin+'/?'+new URLSearchParams({dcTheme:embedded.theme,one4allEmbedded:'1',one4allMode:mode})};
});
ipcMain.handle('one4all-keyboard:close',event=>{assertHidPage(event);closeEmbedded();return true;});
app.on('before-quit',()=>{hidTest?.stop();hidService?.close().catch(()=>{});});

ipcMain.handle('dc-lab:open', (event, kind, color) => {
  if (!trusted(event.senderFrame?.url || '')) throw new Error('Untrusted origin');
  if (!enabled.has(kind)) throw new Error('Card is not installed');
  return openEmbedded(event.sender, kind, color);
});
ipcMain.handle('dc-lab:close-embedded', event => {
  const url = event.senderFrame?.url || '';
  let isEmbeddedPage = false;
  try {
    const parsed = new URL(url);
    isEmbeddedPage = Boolean(
      (tankLocalOrigin && parsed.origin === tankLocalOrigin) ||
      (parsed.protocol === 'file:' && parsed.pathname === new URL(pathToFileURL(path.join(base,'charger.html')).href).pathname) ||
      (parsed.protocol === 'file:' && parsed.pathname === new URL(mainPageUrl).pathname) ||
      (parsed.protocol === 'file:' && deviceIds.some(id=>parsed.pathname===pathToFileURL(path.join(base,id+'.html')).pathname))
    );
  } catch {}
  if (!trusted(url) && !isEmbeddedPage) throw new Error('Untrusted origin');
  const owner = BrowserWindow.fromWebContents(event.sender);
  if (embedded && (embedded.win === owner || embedded.view.webContents === event.sender)) closeEmbedded();
  return true;
});
ipcMain.handle('dc-lab:product-art', (event, kind) => {
  if (!trusted(event.senderFrame?.url || '')) throw new Error('Untrusted origin');
  if (!Object.prototype.hasOwnProperty.call(productAssets, kind)) throw new Error('Unknown product art');
  return getProductArt(kind);
});

function assertDevicePage(event,id){
  if(!Object.prototype.hasOwnProperty.call(deviceServices,id))throw Error('Device is not installed');
  const actual=new URL(event.senderFrame?.url||'');
  if(event.senderFrame!==event.sender.mainFrame||actual.protocol!=='file:'||actual.pathname!==pathToFileURL(path.join(base,id+'.html')).pathname)throw Error('Device page only');
}
ipcMain.handle('dc-device:status',(event,id)=>{assertDevicePage(event,id);return deviceServices[id].status();});
ipcMain.handle('dc-device:set-color',(event,id,color)=>{
  assertDevicePage(event,id);
  if(!productColors[id].allowed.has(color))throw Error('Unknown artwork color');
  if(embedded?.kind!==id||embedded.view.webContents!==event.sender)throw Error('Active device view only');
  embedded.win.webContents.send('dc-lab:device-color',{kind:id,color});
  return {kind:id,color};
});
ipcMain.handle('dc-device:card-status',async(event,id)=>{
  if(!trusted(event.senderFrame?.url||'')||!Object.prototype.hasOwnProperty.call(deviceServices,id))throw Error('Untrusted device request');
  if(xiberiaIds.includes(id))return {connected:null,installed:true,transport:'usb-audio',sampledAt:null,values:{},capabilities:{}};
  try{return await deviceServices[id].status();}catch{return {connected:false,sampledAt:null,values:{},capabilities:{}};}
});
const deviceCommands={g309:['setDpi','setReportRate','setHostMode'],blackshark:['setOutputVolume','setInputVolume','setOutputMute','setInputMute','setEq']};
for(const id of xiberiaIds)deviceCommands[id]=require('./xiberia-runtime/service.cjs').commands;
for(const command of new Set(Object.values(deviceCommands).flat()))ipcMain.handle('dc-device:'+command,(event,id,value)=>{
  if(!Object.prototype.hasOwnProperty.call(deviceCommands,id)||!deviceCommands[id].includes(command))throw Error('Wrong device command');
  assertDevicePage(event,id);
  if(command==='openOfficialApp'&&(embedded?.kind!==id||embedded.view.webContents!==event.sender))throw Error('Active device view only');
  return deviceServices[id].invoke(command,value);
});
app.on('before-quit',()=>{for(const service of Object.values(deviceServices))service.close().catch(()=>{});});
function assertChargerPage(event) {
  const actual = new URL(event.senderFrame?.url || '');
  const expected = pathToFileURL(path.join(base,'charger.html'));
  if(actual.protocol!=='file:' || actual.pathname!==expected.pathname) throw new Error('Local charger page only');
}
ipcMain.handle('dc-lab:charger-card-status',event=>{
  if(!trusted(event.senderFrame?.url||''))throw new Error('Untrusted origin');
  if(!chargerService) return {configured:false};
  return chargerService.status().then(state=>({connected:state.connected,authenticated:state.authenticated,configured:state.configured,power:Object.values(state.ports||{}).reduce((sum,port)=>sum+(Number(port.power)||0),0)}));
});
for(const [channel,method] of [['status','status'],['qr-start','startQr'],['qr-check','checkQr'],['pair','pair'],['reconnect','reconnect']]) {
  ipcMain.handle(`dc-lab:charger-${channel}`,(event,...args)=>{assertChargerPage(event);if(!chargerService)throw new Error('Charger is not installed');return chargerService[method](...args);});
}
ipcMain.handle('dc-lab:charger-art',(event,color)=>{assertChargerPage(event);if(!productColors.charger.allowed.has(color))return null;try{return getProductArt(color);}catch{return null;}});
ipcMain.handle('dc-lab:tank-click-vendor', async (event, label) => {
  const url = event.senderFrame?.url || '';
  let isLocal = false;
  try {
    const parsed = new URL(url);
    isLocal = Boolean(tankLocalOrigin && parsed.origin === tankLocalOrigin);
  } catch {}
  if (!isLocal || !embedded || embedded.view.webContents !== event.sender) {
    throw new Error('Local Tank68 page only');
  }
  const target = String(label || '').slice(0, 60);
  const rect = await event.sender.executeJavaScript(`(() => {
    const text = ${JSON.stringify(target)};
    const node = [...document.querySelectorAll('.device-left-my-list-item, .device-left-my-fifle-item')]
      .find(item => item.innerText.trim() === text);
    if (!node) return null;
    const r = node.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  if (!rect) return false;
  event.sender.sendInputEvent({ type: 'mouseDown', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  await new Promise(resolve => setTimeout(resolve, 40));
  event.sender.sendInputEvent({ type: 'mouseUp', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  return true;
});

let razerBusy = false;
let lastRazerCardStatus = null;
const allowedPollRates = new Set([125, 500, 1000, 2000, 4000, 8000]);
function assertRazerPage(event) {
  try {
    const actual = new URL(event.senderFrame?.url || '');
    const expected = new URL(mainPageUrl);
    if (actual.protocol !== expected.protocol || actual.pathname !== expected.pathname) {
      throw new Error('Local controller page only');
    }
  } catch {
    throw new Error('Local controller page only');
  }
}
async function runRazerControl(args) {
  const config = JSON.parse(fs.readFileSync(path.join(base, 'lab-config.json'), 'utf8'));
  const output = await new Promise((resolve, reject) => require('child_process').execFile(
    config.python,
    [path.join(base, 'razer-control.py'), ...args],
    { cwd: base, env:{...process.env, PYTHONUTF8:'1', ONE4ALL_DATA_DIR:path.join(dataRoot,'razer')}, windowsHide: true, timeout: 20000, maxBuffer: 1024 * 1024, encoding: 'utf8' },
    (error, stdout, stderr) => {
      if (error) { reject(new Error(stderr || error.message)); return; }
      resolve(stdout);
    },
  ));
  const parsed = JSON.parse(output);
  if (!parsed.ok) throw new Error(parsed.error || '雷蛇操作失败');
  return parsed;
}
ipcMain.handle('dc-lab:razer-status', async event => {
  assertRazerPage(event);
  if (razerBusy) throw new Error('检测正在进行');
  razerBusy = true;
  try {
    const result = await runRazerControl(['status']);
    log('razer-status-result', {
      ok: result.ok,
      dpi: result.dpi,
      active_stage: result.active_stage,
      rates: result.supported_poll_rates,
      dpi_error: result.dpi_error,
    });
    return result;
  } catch (error) {
    log('razer-status-error', error.message);
    throw error;
  } finally { razerBusy = false; }
});
ipcMain.handle('dc-lab:razer-card-status', async event => {
  if (!trusted(event.senderFrame?.url || '')) throw new Error('Untrusted origin');
  if (razerBusy) return lastRazerCardStatus || { ok: false, error: '检测中' };
  razerBusy = true;
  try {
    lastRazerCardStatus = await runRazerControl(['status']);
    return lastRazerCardStatus;
  } catch (error) {
    return { ok: false, error: error.message };
  } finally {
    razerBusy = false;
  }
});
ipcMain.handle('dc-lab:razer-set-dpi-stage', async (event, stage) => {
  assertRazerPage(event);
  const index = Number(stage);
  if (!Number.isInteger(index) || index < 1 || index > 10) throw new Error('无效的 DPI 档位');
  if (razerBusy) throw new Error('检测正在进行');
  razerBusy = true;
  log('razer-set-dpi-stage', { stage: index });
  try {
    const result = await runRazerControl(['set-dpi-stage', String(index)]);
    lastRazerCardStatus = result;
    log('razer-set-dpi-stage-result', result);
    return result;
  } finally {
    razerBusy = false;
  }
});
ipcMain.handle('dc-lab:razer-set-poll-rate', async (event, rate) => {
  assertRazerPage(event);
  const hz = Number(rate);
  if (!Number.isInteger(hz) || !allowedPollRates.has(hz)) throw new Error('无效的回报率');
  if (razerBusy) throw new Error('检测正在进行');
  razerBusy = true;
  log('razer-set-poll-rate', { requested: hz });
  try {
    const result = await runRazerControl(['set-poll-rate', String(hz)]);
    log('razer-set-poll-rate-result', result);
    return result;
  } finally { razerBusy = false; }
});

const catalogInjected='window.__one4allXiberiaCatalog='+JSON.stringify(xiberiaCatalog)+';';
const injected=catalogInjected+fs.readFileSync(path.join(base,'cards.js'),'utf8');
const nativeInjected=catalogInjected+'window.__one4allEnabled='+JSON.stringify([...enabled])+';'+fs.readFileSync(path.join(base,'native-cards.js'),'utf8');
function injectNativeCards(wc) {
  if (wc.isDestroyed()) return;
  let frames = [];
  try {
    const root = wc.mainFrame;
    if (root) {
      const subtree = typeof root.framesInSubtree === 'function' ? root.framesInSubtree() : root.framesInSubtree;
      frames = Array.isArray(subtree) ? subtree : (root.frames || []);
    }
  } catch (error) { log('frame-enumeration-error', error.message); return; }
  for (const frame of frames) {
    const url = frame.url || '';
    if (!url.startsWith('https://www.mchose.com.cn/') && !url.startsWith('https://mchose.com.cn/')) continue;
    frame.executeJavaScript(nativeInjected, true)
      .then(result=>log('native-cards-check',{id:wc.id,url,result}))
      .catch(error => log('native-injection-error', { id: wc.id, url, error: error.message }));
  }
}

app.on('web-contents-created', (_event, wc) => {
  wc.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) log('console-message', { id: wc.id, level, message: String(message).slice(0, 500), line, sourceId });
  });
  wc.on('did-finish-load', async () => {
    const url = wc.getURL();
    log('page-loaded', { id: wc.id, url });
    if (url.includes('refresh.html') && !wc.__dcFallbackRetried) {
      wc.__dcFallbackRetried = true;
      setTimeout(() => {
        wc.executeJavaScript(`(() => {
          const button = document.querySelector('button');
          if (button) { button.click(); return true; }
          return false;
        })()`).then(clicked => log('fallback-auto-retry', { clicked })).catch(() => {});
      }, 800);
    }
    if (trusted(url)) {
      try {
        await wc.executeJavaScript(injected);
        log('cards-injected', { id: wc.id, url });
      } catch (error) { log('injection-error', error.message); }
    }
    setTimeout(() => injectNativeCards(wc), 800);
    setTimeout(() => injectNativeCards(wc), 2400);
  });
  wc.on('did-frame-finish-load', () => {
    setTimeout(() => injectNativeCards(wc), 400);
  });
  wc.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (isMainFrame) log('page-failed', { code, description, url });
  });
});

app.on('will-quit', () => {
  viaServer?.then(server=>server.close()).catch(()=>{});
  if (!tankServerPromise) return;
  tankServerPromise.then(server => server.close()).catch(() => {});
});

// Additional session preload leaves the manufacturer's own bridge untouched.
const addBridge=ses=>{
  const bridge=path.join(base,'main-preload.cjs');
  if(typeof ses.setPreloads!=='function')throw new Error('This Electron version does not support session preloads');
  const preloads=ses.getPreloads();
  if(!preloads.includes(bridge))ses.setPreloads([...preloads,bridge]);
};
app.on('session-created',addBridge);
app.whenReady().then(()=>addBridge(session.defaultSession)).catch(error=>log('preload-error',error.message));
};
