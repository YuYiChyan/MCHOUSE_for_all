/* One4All standalone UI. Device pages keep their existing protocol adapters. */
(() => {
  'use strict';
  const api=window.one4allDesktop, $=id=>document.getElementById(id);
  let page='devices',cards=[],keyboards=[],packages=[],selectedKeyboard=null,keyboardControls=null,viaSession=null,workbench=null,catalogView=null,mouseView=null,activeMouseModel=null,keyboardVersion=0,requestVersion=0,noticeTimer;
  let mouseClosing=Promise.resolve(),keyboardModel=null,keyboardClosing=Promise.resolve(),embeddedClosing=Promise.resolve(),embeddedOpening=Promise.resolve(),cardViews=[];
  const colors=new Map(),progress=new Map();try{for(const [id,color] of Object.entries(JSON.parse(localStorage.getItem('one4all-colors')||'{}')))if(typeof color==='string')colors.set(id,color);}catch{}
  function rememberColor(id,color){colors.set(id,color);localStorage.setItem('one4all-colors',JSON.stringify(Object.fromEntries(colors)));}
  const colorMeta=id=>id.includes('purple')?{label:'紫色',swatch:'#7C4DFF'}:id.includes('white')?{label:'白色',swatch:'#f2f2f2'}:id.includes('black')?{label:'黑色',swatch:'#202124'}:id.includes('cuktech')?{label:'银色',swatch:'#aeb3bd'}:{label:'默认配色',swatch:'#777'};
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  function notify(message){$('notice').textContent=message;$('notice').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').hidden=true,6500);}
  async function action(button,fn){button.disabled=true;try{return await fn();}catch(e){notify(e.message||String(e));}finally{button.disabled=false;}}
  function button(text,fn,cls='secondary'){const b=el('button',cls,text);b.type='button';b.onclick=()=>action(b,fn);return b;}
  function cleanup(run){try{return Promise.resolve(run()).catch(error=>console.warn('页面资源清理失败',error));}catch(error){console.warn('页面资源清理失败',error);return Promise.resolve();}}
  function clear(){
    const previous={cards:cardViews,catalog:catalogView,mouse:mouseView,keyboard:keyboardModel,via:viaSession,controls:keyboardControls,workbench};
    cardViews=[];catalogView=null;mouseView=null;keyboardModel=null;viaSession=null;keyboardControls=null;workbench=null;keyboardVersion++;
    for(const view of previous.cards)cleanup(()=>view.dispose());cleanup(()=>previous.catalog?.dispose());
    if(previous.mouse)mouseClosing=Promise.allSettled([mouseClosing,cleanup(()=>previous.mouse.dispose())]);
    if(previous.keyboard)keyboardClosing=Promise.allSettled([keyboardClosing,cleanup(()=>previous.keyboard.dispose())]);
    cleanup(()=>previous.via?.close());cleanup(()=>previous.controls?.dispose());cleanup(()=>previous.workbench?.dispose());$('content').replaceChildren();
  }
  function closeEmbedded(){const closing=Promise.resolve().then(()=>api.closeDevice?.());embeddedClosing=closing.catch(error=>console.warn('内嵌页面关闭失败',error));return closing;}
  function openEmbeddedBrand(id,ticket=++requestVersion){
    const previous=embeddedOpening;
    const opening=(async()=>{await Promise.all([previous,embeddedClosing]);if(ticket!==requestVersion)return;return api.openBrand(id);})();
    embeddedOpening=opening.catch(()=>{});return opening.catch(error=>{if(ticket===requestVersion)throw error;});
  }
  function empty(title,description){const box=el('section','empty');box.append(el('h2','',title),el('p','',description));return box;}
  function renderDevices(){clear();const grid=el('div','device-grid');
    for(const card of cards){const root=el('article','device-card'),open=button('',()=>api.openDevice(card.id,colors.get(card.id)||card.defaultColor),'product-open');open.setAttribute('aria-label','打开 '+card.title);const img=el('img');img.alt=card.title;img.src=card.colors?.find(c=>c.id===colors.get(card.id))?.artUrl||card.artUrl||'';if(img.getAttribute('src'))open.append(img);else open.append(el('span','fallback-art',card.title));
      const colorRow=el('div','product-tools');cardViews.push(One4AllColorPicker.mount(colorRow,{variants:(card.colors||[]).map(c=>({id:c.id,name:colorMeta(c.id).label,color:colorMeta(c.id).swatch,imageUrl:c.artUrl})),selectedId:colors.get(card.id)||card.defaultColor,image:img,onSelect:c=>rememberColor(card.id,c.id)}));
      const copy=el('div','card-copy'),title=button('',()=>api.openDevice(card.id,colors.get(card.id)||card.defaultColor),'card-title');title.append(el('h2','',card.title.replace(' · 本地控制器','')));copy.append(title,el('div','card-meta',[card.brand,card.type==='keyboard'?'键盘':card.type==='mouse'?'鼠标':card.type==='charger'?'充电器':card.type||'设备'].filter(Boolean).join(' · ')));root.append(colorRow,open,copy);grid.append(root);
    }if(cards.length)$('content').append(grid);else{const welcome=empty('添加你的设备','从支持库选择设备，连接后即可进入设置。');welcome.append(button('打开支持库',()=>navigate('packages'),'primary'));$('content').append(welcome);}
    const brand=el('section','brand-entry'),copy=el('div');copy.append(el('h2','','MCHOSE HUB'),el('p','','在独立页面中打开迈从设备设置'));brand.append(copy,button('打开迈从',()=>openEmbeddedBrand('mchose')));$('content').append(brand);
  }
  const packageName=p=>p.name||p.title||({mchose:'MCHOSE HUB',razer:'Razer Synapse',logitech:'Logitech G HUB'}[p.id])||p.id;
  function packageState(p){const s=p.status||p;return s;}
  function renderPackages(){clear();const downloads=el('details','vendor-downloads'),summary=el('summary','','原厂应用与依赖下载');downloads.append(summary,el('p','package-description','需要原厂程序时，在这里按需下载。'));const list=el('section','package-list');for(const p of packages){const s=packageState(p),row=el('article','package-row'),heading=el('div');heading.append(el('h2','',packageName(p)),el('p','vendor-note',p.source?.type==='github'?'GitHub 适配模块':'官方来源'));
      const body=el('div'),state=el('p','package-message',s.installed?'本机已安装':s.downloaded?'安装包已下载':'按需下载'),meter=el('progress','package-progress');state.dataset.progressText=p.id;meter.dataset.progress=p.id;meter.hidden=true;meter.max=100;body.append(state,meter);const actions=el('div','package-actions');
      actions.append(button(s.downloaded?'重新下载':'下载驱动',async()=>{await api.downloadPackage(p.id);notify(packageName(p)+' 下载完成');await loadPackages();}));if(s.downloaded)actions.append(button('运行安装器',async()=>{await api.installPackage(p.id);notify('已打开安装器');},'primary'));if(p.webDriver)actions.append(button('打开网页设置',()=>api.openBrand(p.id)));if(s.installed)actions.append(button('打开官方 APP',()=>api.openOfficial(p.id)));row.append(heading,body,actions);list.append(row);
    }catalogView=One4AllCatalog.render($('content'),{api,notify,onOpen:openCatalogModel});downloads.append(list);$('content').append(downloads);for(const [id,p]of progress)showProgress({id,...p});catalogView.ready.catch(e=>notify(e.message));}
  function showProgress(event){event={...event,...event.progress};const id=event.id||event.packageId;if(!id)return;progress.set(id,event);const meter=document.querySelector(`[data-progress="${CSS.escape(id)}"]`),text=document.querySelector(`[data-progress-text="${CSS.escape(id)}"]`);if(!meter||!text)return;const received=event.received??event.downloadedBytes??event.bytes??0,total=event.total??event.totalBytes??0;const percent=event.percent??(total?received/total*100:null);meter.hidden=false;if(percent!=null)meter.value=percent;else meter.removeAttribute('value');text.textContent=event.error||event.message||(percent!=null?`下载中 ${Math.round(percent)}%`:`正在下载 ${(received/1048576).toFixed(1)} MB`);if(['downloaded','complete','completed','error'].includes(event.state||event.status))meter.hidden=true;}
  async function openCatalogModel(model){const ticket=++requestVersion;try{
    if(model.support.provider==='xiberia-xhub'){
      page='headset';activeMouseModel=model;clear();await Promise.all([closeEmbedded(),mouseClosing,keyboardClosing]);if(ticket!==requestVersion)return;
      $('page-title').textContent=model.name;$('page-caption').textContent='耳机设置';mouseView=One4AllXiberia.render($('content'),{model,api,notify,onBack:()=>navigate('packages')});await mouseView.ready;return;
    }
    if(model.kind==='keyboard'||model.support.provider==='melgeek-hive'){
      const provider={'melgeek-hive':window.One4AllMelgeek,'official-via':window.One4AllOfficialVia,'fgg-webhid':window.One4AllFgg}[model.support.provider]||null;
      page='keyboard-model';activeMouseModel=model;clear();await Promise.all([closeEmbedded(),mouseClosing,keyboardClosing]);if(ticket!==requestVersion)return;
      $('page-title').textContent=model.name;$('page-caption').textContent='键盘设置';keyboardModel=One4AllKeyboardModel.render($('content'),{model,api,provider,notify,onBack:()=>navigate('packages')});await keyboardModel.ready;return;
    }
    let provider;
    if(model.support.provider==='openrazer-win')provider={scan:()=>api.scanRazer(),status:id=>api.razerStatus(id),execute:request=>api.razerExecute(request)};
    else if(model.support.provider==='logitech-hidpp2')provider={scan:()=>api.scanLogitech(),status:id=>api.logitechStatus(id),execute:request=>api.logitechExecute(request)};
    else if(model.support.provider==='mchose-webhid')provider=One4AllMchose.createApi({model,protocol:model.support,prepare:()=>api.prepareMchoseHid(model.id)});
    else {const module={'atk-webhid':window.One4AllAtk,'vgn-webhid':window.One4AllAtk,'dareu-webhid':window.One4AllDareu,'rapoo-webhid':window.One4AllRapoo,'aula-webhid':window.One4AllAula,'inphic-webhid':window.One4AllInphic,'darmoshark-webhid':window.One4AllDarmoshark,'attackshark-webhid':window.One4AllAttackshark}[model.support.provider];if(module)provider=module.createApi({model,protocol:model.support,prepare:()=>api.prepareVendorHid(model.id)});}
    page=provider?'mouse':'product';activeMouseModel=model;clear();await Promise.all([closeEmbedded(),mouseClosing,keyboardClosing]);
    if(ticket!==requestVersion){await cleanup(()=>provider?.close?.());return;}
    $('page-title').textContent=model.name;$('page-caption').textContent=provider?'鼠标设置':'设备信息';
    mouseView=provider?One4AllMouse.render($('content'),{model,api,provider,notify,onBack:()=>navigate('packages')}):One4AllCatalogDetails.render($('content'),{model,api,notify,onBack:()=>navigate('packages')});await mouseView.ready;
  }catch(e){if(ticket===requestVersion)notify(e.message||String(e));}}
  async function loadPackages(rev=requestVersion){const result=await api.getPackages();if(rev!==requestVersion||page!=='packages')return;packages=Array.isArray(result)?result:result.packages||result.catalog||[];renderPackages();}
  async function selectKeyboard(device){const version=++keyboardVersion;viaSession?.close().catch(()=>{});viaSession=null;selectedKeyboard=device.id;keyboardControls?.dispose();keyboardControls=null;const panel=$('keyboard-panel');if(!panel)return;panel.replaceChildren();for(const b of document.querySelectorAll('.keyboard-item'))b.classList.toggle('active',b.dataset.id===device.id);const intro=el('div','keyboard-intro');intro.append(el('h2','',device.name||device.productName||device.product||device.label||'键盘'),el('p','','连接可用接口后，显示该设备支持的设置。'));
    const old=cards.find(c=>c.id==='keyboard');if(old&&/tank|eweadn|伊维/i.test([device.name,device.productName,device.product,device.label,device.manufacturer].join(' ')))intro.append(button('打开设备完整设置',()=>api.openDevice(old.id,colors.get(old.id)||old.defaultColor)));panel.append(intro);const controls=el('div');panel.append(controls);
    const current=()=>page==='keyboard'&&version===keyboardVersion&&selectedKeyboard===device.id&&controls.isConnected;
    let viaConnecting=false,viaEstablished=false;
    if(device.collections?.some(c=>c.usagePage===0xFF60&&c.usage===0x61)){
      let definition=null;const file=el('input');file.type='file';file.accept='.json,application/json';file.setAttribute('aria-label','导入厂商 VIA 键盘定义');file.onchange=async()=>{const selected=file.files[0];if(!selected)return;try{const parsed=JSON.parse(await selected.text());if(!current())return;definition=parsed;notify('键盘定义已导入');}catch(e){definition=null;if(current())notify('键盘定义读取失败：'+e.message);}};
      intro.append(file,button('连接键盘设置',async()=>{if(!definition)throw Error('请先导入该型号的 VIA JSON 定义');if(!current()||viaConnecting)return;viaConnecting=true;try{const previous=viaSession;viaSession=null;viaEstablished=false;if(previous)await previous.close();if(!current())return;const target=await api.prepareKeyboardHid(device.id);if(!current())return;const session=await One4AllVia.connect({definition,target});if(!current()){await session.close();return;}viaSession=session;viaEstablished=true;keyboardControls?.dispose();keyboardControls=One4AllKeyboard.render(controls,{...session,onError:e=>notify(e.message||String(e))});notify('已连接 VIA '+session.protocolVersion+'，支持 '+session.layerCount+' 层');}finally{viaConnecting=false;}}));
    }
    try{const report=await api.getKeyboardCapabilities(device.id);if(!current()||viaConnecting||viaEstablished)return;keyboardControls=window.One4AllKeyboard.render(controls,{device:{...device,name:device.name||device.productName||device.product||device.label},capabilities:report.capabilities||report||[],values:report.values||{},execute:(command,payload)=>api.keyboardExecute({deviceId:device.id,command,...payload}),onError:e=>notify(e.message||String(e))});}catch(e){if(current()&&!viaEstablished)controls.append(el('p','',e.message));}}
  function renderKeyboard(){clear();const layout=el('div','keyboard-layout'),list=el('aside','keyboard-list'),panel=el('section','keyboard-panel');panel.id='keyboard-panel';for(const d of keyboards){const b=button('',()=>selectKeyboard(d),'keyboard-item');b.dataset.id=d.id;b.append(el('strong','',d.name||d.productName||d.product||d.label||'键盘'),el('span','',d.manufacturer||'USB / HID'));list.append(b);}layout.append(list,panel);$('content').append(layout);if(keyboards.length)selectKeyboard(keyboards.find(k=>k.id===selectedKeyboard)||keyboards[0]);else{panel.append(empty('未发现键盘','接入键盘后点击“重新检测”。'));const test=el('div');panel.append(test);keyboardControls=window.One4AllKeyboard.render(test,{device:{name:'键盘测试'},capabilities:[],values:{},execute:()=>Promise.reject(Error('设备尚未连接')),onError:e=>notify(e.message)});}}
  async function navigate(next){page=next;const rev=++requestVersion;try{
    for(const b of document.querySelectorAll('[data-page]'))b.classList.toggle('active',b.dataset.page===page);
    const title={devices:['我的设备','已接入的设备与常用设置'],keyboard:['键盘','按设备支持的功能提供统一控件'],packages:['支持库','品牌驱动与设备模块，按需获取'],workbench:['适配工作台','使用自己的模型接口，生成设备适配模块']}[page];
    $('page-title').textContent=title[0];$('page-caption').textContent=title[1];clear();await closeEmbedded();if(rev!==requestVersion)return;
    if(page==='devices'){cards=await api.listCards();if(rev===requestVersion)renderDevices();}
    else if(page==='packages')await loadPackages(rev);
    else if(page==='workbench'){workbench=One4AllWorkbench.render($('content'),{api,notify,isCurrent:()=>rev===requestVersion&&page==='workbench'});await workbench.ready;}
    else{const result=await api.getKeyboardDevices();if(rev!==requestVersion)return;keyboards=(Array.isArray(result)?result:result.devices||[]).filter(d=>d.detection?.kind!=='mouse'&&(d.standardKeyboard||d.detection?.kind==='keyboard'||d.protocolHints?.includes('qmk-raw-hid-interface')));renderKeyboard();}
  }catch(e){if(rev===requestVersion)$('content').append(empty('暂时无法读取',e.message));}}
  for(const b of document.querySelectorAll('[data-page]'))b.onclick=()=>navigate(b.dataset.page);$('refresh').onclick=()=>['mouse','keyboard-model','product','headset'].includes(page)?openCatalogModel(activeMouseModel):navigate(page);$('back').onclick=()=>api.closeDevice();$('theme').onclick=async()=>{const theme=document.documentElement.dataset.dcTheme==='dark'?'light':'dark';await api.setTheme(theme);applyTheme(theme);};function applyTheme(theme){document.documentElement.dataset.dcTheme=theme;$('theme').textContent=theme==='dark'?'浅色模式':'深色模式';}
  if(!api){$('content').append(empty('请从桌面入口启动','双击“启动 One4All.cmd”打开设备中心。'));return;}
  api.onEmbeddedState?.(s=>{$('embedded-toolbar').hidden=!(s.open??s.visible??s.active);$('embedded-title').textContent=s.title||'';});api.onPackageProgress?.(showProgress);api.onDeviceColor?.(s=>{if(s.kind&&s.color)rememberColor(s.kind,s.color);});Promise.all([api.getTheme(),api.getAppInfo()]).then(([theme,info])=>{applyTheme(theme);navigate(info.freshInstall?'packages':'devices');}).catch(()=>navigate('devices'));
  let scanning=false;setInterval(async()=>{if(page!=='keyboard'||document.hidden||scanning)return;scanning=true;try{const result=await api.getKeyboardDevices();if(page!=='keyboard')return;const next=(Array.isArray(result)?result:result.devices||[]).filter(d=>d.detection?.kind!=='mouse'&&(d.standardKeyboard||d.detection?.kind==='keyboard'||d.protocolHints?.includes('qmk-raw-hid-interface')));if(next.map(d=>d.id).sort().join()!==keyboards.map(d=>d.id).sort().join()){keyboards=next;renderKeyboard();}}catch{}finally{scanning=false;}},5000);
})();
