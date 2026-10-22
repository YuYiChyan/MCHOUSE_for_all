/* SPDX-License-Identifier: MIT */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory;
  else if(!root.One4AllHidKeyboard)root.One4AllHidKeyboard=factory(root.document,root.One4AllUI);
})(typeof window==='object'?window:globalThis,function(document,UI){
  'use strict';
  const mounted=new WeakMap();
  const hex=n=>'0x'+Number(n).toString(16).toUpperCase().padStart(4,'0');
  const typeName=kind=>({keyboard:'键盘',mouse:'鼠标',composite:'键鼠复合设备',unknown:'待确认'}[kind]||'待确认');
  const detectedKind=device=>device?.detection?.kind||(device?.standardMouse?(device.standardKeyboard?'composite':'mouse'):device?.standardKeyboard?'keyboard':'unknown');
  const effectiveKind=device=>device?.appearance?.deviceType&&device.appearance.deviceType!=='auto'?device.appearance.deviceType:detectedKind(device);
  function mount(container,{api=null,title='通用 HID 外设',onBack=()=>{}}={}){
    if(mounted.has(container))return mounted.get(container);
    if(!UI)throw Error('Load One4AllUI before the keyboard component');
    const shell=UI.shell({title,status:'等待扫描',onBack});
    const root=shell.root,notice=UI.node('p','dc-hid-notice');
    const preview=UI.node('div','dc-hid-preview'),personalize=UI.node('div','dc-hid-personalize');
    shell.nav.before(preview,personalize);shell.content.before(notice);
    container.append(root);
    let state=null,selected=null,tab='overview',pending=null,disposed=false,viewAbort=null,saving=false,boardLayout='full',testMode='keyboard';
    const options=[['overview','设备概览'],['test','按键测试'],['remap','改键'],['interfaces','接口与能力'],['appearance','外观与命名']];
    function button(label,action){const b=UI.node('button','dc-segment',label);b.type='button';b.onclick=action;return b;}
    function note(text){return UI.node('p','dc-hid-note dc-muted',text);}
    function legend(){const row=UI.node('div','dc-input-legend');for(const [kind,text]of [['','未触发'],['pressed','正在按下'],['tested','已触发']]){const item=UI.node('span');item.append(UI.node('i',kind),document.createTextNode(text));row.append(item);}return row;}
    function render(){
      if(disposed)return;
      viewAbort?.abort();viewAbort=new AbortController();
      shell.nav.replaceChildren();shell.tabs.replaceChildren();shell.content.replaceChildren();
      const devices=state?.devices||[],device=devices.find(d=>d.id===selected);
      const kind=effectiveKind(device);
      if(['keyboard','mouse'].includes(kind))testMode=kind;
      const viewMode=tab==='test'?(testMode==='mouse'?'mouse':'test'):tab;
      const appearance={name:'',imageDataUrl:'',deviceType:'auto',...device?.appearance};
      root.querySelector('.dc-sidebar-name').textContent=appearance.name||title;
      preview.replaceChildren();preview.classList.toggle('has-image',!!appearance.imageDataUrl);
      if(appearance.imageDataUrl){const img=UI.node('img');img.src=appearance.imageDataUrl;img.alt=appearance.name||device.product;preview.append(img);}
      else for(let i=0;i<42;i++)preview.append(UI.node('span'));
      personalize.replaceChildren();
      const rename=button('命名',()=>{tab='appearance';render();shell.content.querySelector('.dc-hid-name').focus();});
      const upload=button('上传商品图',()=>{tab='appearance';render();shell.content.querySelector('input[type=file]').click();});
      rename.disabled=upload.disabled=!device||!api?.saveAppearance||saving;
      personalize.append(rename,upload);
      shell.status.textContent=pending?'正在扫描…':device?'已连接':devices.length?'请选择设备':state?'未发现键盘或鼠标集合':'等待扫描';
      for(const [id,label] of options)shell.nav.append(UI.navButton({id,label,active:tab===id,onSelect:()=>{tab=id;render();}}));
      if(tab==='test'){
        for(const id of (['keyboard','mouse'].includes(kind)?[kind]:['keyboard','mouse'])){const b=button(id==='keyboard'?'键盘测试':'鼠标测试',()=>{testMode=id;render();});b.className='dc-tab'+(testMode===id?' active':'');b.setAttribute('aria-pressed',String(testMode===id));b.dataset.testMode=id;shell.tabs.append(b);}
      }else shell.tabs.append(UI.node('div','dc-tab active',options.find(([id])=>id===tab)[1]));
      const selector=UI.card('设备选择');selector.classList.add('dc-hid-picker');
      const select=UI.node('select','dc-hid-select');select.setAttribute('aria-label','选择 HID 设备');select.disabled=!!pending||!devices.length;
      const placeholder=UI.node('option','','请选择已连接设备');placeholder.value='';select.append(placeholder);
      for(const d of devices){const o=UI.node('option','',`${d.appearance?.name||d.product} · ${typeName(effectiveKind(d))} · ${hex(d.vendorId)}:${hex(d.productId)}`);o.value=d.id;select.append(o);}
      select.value=selected||'';select.onchange=()=>{selected=select.value||null;render();};
      const scan=button('重新扫描',()=>refresh());scan.disabled=!!pending||!api;selector.append(select,scan);shell.content.append(selector);
      if(tab==='overview'){
        const card=UI.card('连接与识别');shell.content.append(card);
        if(device){
          card.append(UI.row('产品',device.product),UI.row('厂商',device.manufacturer||'设备未提供'),
            UI.row('标准输入集合',[device.standardKeyboard?'键盘':null,device.standardMouse?'鼠标':null].filter(Boolean).join(' / ')||'待核验型号接口'),
            UI.row('自动识别',typeName(detectedKind(device))),UI.row('识别依据',device.detection?.basis||'当前 HID 描述'),
            UI.row('USB / HID 标识',`${hex(device.vendorId)}:${hex(device.productId)}`),
            UI.row('HID 设备版本',hex(device.version)),UI.row('可见接口集合',device.collections.length));
          if(device.grouping==='collection-only')card.append(note('系统未提供物理设备分组信息，当前按接口集合分别展示。'));
          if(device.candidateProfiles?.includes('tk870-wired'))card.append(note('发现与 TK870 提案相符的 8 字节厂商接口；型号和控制协议仍需实机确认。'));
          if(detectedKind(device)==='composite')card.append(note('复合接口不能单独证明外形类型；可在“外观与命名”中指定键盘或鼠标。'));
          const actions=UI.node('div','dc-hid-actions');
          actions.append(button('进入按键测试',()=>{tab='test';render();}));card.append(actions);
        }else card.append(note(api?'点击重新扫描，再选择设备。':'尚未接入本机读取接口；此页面可查看控件布局和进行当前窗口按键测试。'));
        const scope=UI.card('可用功能');scope.append(UI.row('设备与接口诊断','只读'),UI.row('按键检测','当前检测区域'),UI.row('硬件改键','尚未验证'),note('灯效、改键等设置需型号协议支持。VIA / Vial 需要兼容固件，标准 HID 键盘不等于支持硬件改键。'));if(device?.protocolHints?.includes('qmk-raw-hid-interface'))scope.append(note('发现 QMK Raw HID 接口特征；这只作为候选线索，仍需核对型号定义和协议版本。'));shell.content.append(scope);
      }else if(tab==='remap'){
        const card=UI.card('按键配置');card.classList.add('dc-hid-wide');shell.content.append(card);
        if(!device){card.append(note('先选择设备，再查看可用的改键功能。'));return;}
        card.append(UI.row('设备',appearance.name||device.product),UI.row('VIA 接口',device.via?.available?'发现常用接口':'等待实际连接检测'),UI.row('预置型号表',device.via?.catalogListed?'已收录':'未收录也可尝试'),note(device.via?.reason||'可主动尝试 VIA 连接，或导入厂商提供的定义 JSON。是否支持以设备响应为准。'));
        if(api?.openVia){
          let frame=null,opening=false,frameAbort=null;const renderSignal=viewAbort.signal;
          async function open(mode){
            if(opening)return;opening=true;connect.disabled=loadDefinition.disabled=true;notice.textContent='正在打开内置 VIA…';
            try{
              const value=await api.openVia(device.id,mode);if(renderSignal.aborted)return;const url=new URL(value.url);if(url.protocol!=='http:'||url.hostname!=='127.0.0.1')throw Error('内置页面地址无效');
              frameAbort?.abort();frameAbort=new AbortController();renderSignal.addEventListener('abort',()=>frameAbort.abort(),{once:true});frame?.remove();frame=UI.node('iframe','dc-hid-via-frame');frame.title='内置 VIA 按键配置';frame.allow='hid';frame.src=url.href;card.append(frame);notice.textContent=mode==='design'?'在下方 VIA 中导入厂商 JSON。':'在下方 VIA 中点击“授权设备”尝试连接。';
            }catch(error){notice.textContent='VIA 连接失败：'+error.message;}
            finally{opening=false;connect.disabled=loadDefinition.disabled=false;}
          }
          const connect=button(device.via?.available?'连接 VIA':'尝试 VIA 连接',()=>open('connect')),loadDefinition=button('导入 VIA 定义',()=>open('design'));
          const actions=UI.node('div','dc-hid-actions');actions.append(connect,loadDefinition);card.append(actions,note('不要求型号已被官方收录。导入布局不能代替固件协议，实际连接结果会显示在 VIA 中。'));
          const unsubscribe=api.onViaResult?.(value=>{if(!renderSignal.aborted)notice.textContent=value.status==='no-interface'?'本次连接未发现该设备可用的 VIA 接口。可以导入厂商 JSON 后重试。':value.status==='selected'?'已选择设备，VIA 正在读取协议与布局…':value.status==='cancelled'?'本次选择已取消。':value.message||'正在尝试连接…';});renderSignal.addEventListener('abort',()=>unsubscribe?.(),{once:true});
        }
      }else if(tab==='interfaces'){
        const card=UI.card('报告能力');card.classList.add('dc-hid-wide');shell.content.append(card);
        if(!device){card.append(note('先选择设备，再查看系统描述的接口能力。'));return;}
        const table=UI.node('table','dc-hid-table'),head=UI.node('tr');
        for(const label of ['集合用途','Usage Page / Usage','输入字节','输出字节','Feature 字节'])head.append(UI.node('th','',label));
        const thead=UI.node('thead');thead.append(head);table.append(thead);
        const body=UI.node('tbody');
        for(const collection of device.collections){const row=UI.node('tr');for(const value of [collection.usageName,hex(collection.usagePage)+' / '+hex(collection.usage),collection.inputBytes,collection.outputBytes,collection.featureBytes])row.append(UI.node('td','',value));body.append(row);}
        table.append(body);const wrap=UI.node('div','dc-hid-table-wrap');wrap.append(table);card.append(wrap,
          note('这些长度来自 Windows HID 描述信息，包含报告 ID 字节。Feature 或输出报告的存在不代表灯效协议已经已知。'),
          note('当前组件不发送设备控制命令，不猜测报文，也不自动遍历 Feature report ID。'));
      }else if(tab==='appearance'){
        const card=UI.card('设备外观');card.classList.add('dc-hid-wide');shell.content.append(card);
        if(!device){card.append(note('先选择设备，再设置名称和商品图。'));return;}
        const label=UI.node('label','dc-hid-label','设备名称');
        const name=UI.node('input','dc-hid-name');name.type='text';name.maxLength=60;name.value=appearance.name;name.placeholder=device.product;label.append(name);
        const save=button('保存名称',()=>saveAppearance(device,{...appearance,name:name.value}));
        const file=UI.node('input');file.type='file';file.accept='image/png,image/jpeg,image/webp';file.hidden=true;file.setAttribute('aria-label','选择商品图片');
        file.onchange=async()=>{
          const image=file.files?.[0];if(!image)return;
          try{const imageDataUrl=await prepareImage(image);if(!disposed)await saveAppearance(device,{...appearance,imageDataUrl});}
          catch(error){if(!disposed)notice.textContent=error.message;}
        };
        const imageButton=button('选择商品图',()=>file.click()),remove=button('移除商品图',()=>saveAppearance(device,{...appearance,imageDataUrl:''}));
        save.disabled=name.disabled=imageButton.disabled=!api?.saveAppearance||saving;remove.disabled=imageButton.disabled||!appearance.imageDataUrl;
        const nameActions=UI.node('div','dc-hid-actions'),imageActions=UI.node('div','dc-hid-actions');nameActions.append(save);imageActions.append(imageButton,remove);
        const typeLabel=UI.node('label','dc-hid-label','设备类型'),type=UI.node('select','dc-hid-select');type.setAttribute('aria-label','设备类型');
        for(const [id,text]of [['auto',`自动识别：${typeName(detectedKind(device))}`],['keyboard','作为键盘'],['mouse','作为鼠标']]){const option=UI.node('option','',text);option.value=id;type.append(option);}type.value=appearance.deviceType;type.disabled=!api?.saveAppearance||saving;type.onchange=()=>saveAppearance(device,{...appearance,deviceType:type.value});typeLabel.append(type);
        card.append(label,nameActions,typeLabel,UI.node('h4','dc-hid-subtitle','商品图'),imageActions,file,note('支持透明 PNG、JPG 和 WebP，最大 10 MB。图片会缩放后保存在本机，不上传网络。名称、类型与图片仅改变此处的显示。'));
      }else if(viewMode==='mouse'){
        const card=UI.card('鼠标按键与滚轮检测');card.classList.add('dc-hid-wide');shell.content.append(card);
        const pad=UI.node('div','dc-hid-mouse-pad dc-hid-testpad');pad.tabIndex=0;pad.setAttribute('role','group');pad.setAttribute('aria-label','鼠标检测区域');
        const visual=window.One4AllInputVisualizer.mouse(),output=UI.node('div','dc-hid-mouse-output','点击开始检测');let enabled=false,wheelTimer=null;
        function stop(){enabled=false;clearTimeout(wheelTimer);visual.clearPressed();output.textContent='检测已停止';pad.classList.remove('testing');}
        const start=button('开始检测',()=>{enabled=true;pad.focus();pad.classList.add('testing');output.textContent='在此区域内点击鼠标或滚动';});
        const clear=button('清空',()=>{visual.clear();output.textContent=enabled?'等待按键或滚轮':'点击开始检测';});
        const actions=UI.node('div','dc-hid-actions');actions.append(start,button('停止检测',stop),clear);
        pad.append(output,visual.element,legend());card.append(note('开始后在此区域内测试鼠标五键和滚轮，点击停止结束；失去焦点也会停止。显示的是当前窗口收到的输入，不能区分多只鼠标。'),pad,actions);
        pad.addEventListener('mousedown',event=>{if(!enabled||event.button<0||event.button>4)return;event.preventDefault();visual.press(event.button);output.textContent=['左键','中键','右键','后退侧键','前进侧键'][event.button];},{signal:viewAbort.signal});
        document.addEventListener('mouseup',event=>{if(enabled)visual.release(event.button);},{signal:viewAbort.signal});
        for(const name of ['contextmenu','auxclick'])pad.addEventListener(name,event=>{if(enabled)event.preventDefault();},{signal:viewAbort.signal});
        pad.addEventListener('wheel',event=>{if(!enabled)return;event.preventDefault();if(!event.deltaY)return;visual.release('up');visual.release('down');const direction=event.deltaY<0?'up':'down';visual.press(direction);output.textContent=direction==='up'?'滚轮向上':'滚轮向下';clearTimeout(wheelTimer);wheelTimer=setTimeout(()=>{visual.release('up');visual.release('down');},160);},{passive:false,signal:viewAbort.signal});
        pad.addEventListener('blur',stop,{signal:viewAbort.signal});
        document.defaultView.addEventListener('blur',stop,{signal:viewAbort.signal});
        viewAbort.signal.addEventListener('abort',()=>clearTimeout(wheelTimer),{once:true});
      }else{
        const card=UI.card('当前窗口按键测试');card.classList.add('dc-hid-wide');shell.content.append(card);
        const pad=UI.node('div','dc-hid-testpad');pad.tabIndex=0;pad.setAttribute('role','group');pad.setAttribute('aria-label','键盘测试框');
        const output=UI.node('div','dc-hid-key-output','点击开始测试');output.setAttribute('aria-live','polite');
        const history=UI.node('div','dc-hid-history');
        let enabled=false,starting=false,generation=0;const pressed=new Set(),seen=new Set();
        const visual=window.One4AllInputVisualizer.keyboard({signal:viewAbort.signal,layout:boardLayout});
        const layoutLabel=UI.node('label','dc-hid-layout-picker','参考配列'),layout=UI.node('select','dc-hid-select');layout.setAttribute('aria-label','键盘参考配列');
        for(const [id,label]of [['full','全尺寸 104 键'],['tkl','TKL 87 键'],['compact','紧凑主键区']]){const item=UI.node('option','',label);item.value=id;layout.append(item);}layout.value=boardLayout;layout.onchange=()=>{boardLayout=layout.value;render();};layoutLabel.append(layout);
        function stop(){generation++;enabled=false;pressed.clear();visual.clearPressed();pad.classList.remove('testing');output.textContent='测试已停止';if(api?.stopTest)Promise.resolve(api.stopTest()).catch(()=>{});}
        function draw(){output.textContent=pressed.size?[...pressed].join(' + '):'等待按键';history.replaceChildren(...[...seen].slice(-24).map(code=>UI.node('span','dc-hid-key',code)));}
        const start=button('开始测试',async()=>{
          if(starting)return;starting=true;const token=++generation;pad.focus();output.textContent='正在开启测试模式…';
          try{if(api?.startTest)await api.startTest();if(viewAbort.signal.aborted||token!==generation){if(api?.stopTest)await api.stopTest();return;}enabled=true;pad.classList.add('testing');output.textContent='测试中 · 点击停止测试结束';}
          catch(error){notice.textContent='测试模式未开启：'+error.message;output.textContent='点击开始测试';}
          finally{starting=false;}
        });
        const end=button('停止测试',stop),clear=button('清空',()=>{pressed.clear();seen.clear();visual.clear();history.replaceChildren();output.textContent=enabled?'等待按键':'点击开始测试';});
        const actions=UI.node('div','dc-hid-actions');actions.append(start,end,clear);
        const toolbar=UI.node('div','dc-hid-actions');toolbar.append(layoutLabel,actions);
        pad.append(output,visual.element,history,legend());card.append(note('开始后进入按键测试模式，Esc 也参与检测。点击停止或切换应用结束；本机模式会临时接管 Windows 键。Fn 与系统安全组合键可能无法检测，未亮不等于损坏。'),toolbar,pad);
        pad.addEventListener('keydown',event=>{
          if(!enabled)return;
          if(!event.code)return;
          event.preventDefault();
          pressed.add(event.code);seen.add(event.code);visual.press(event.code);draw();
        },{signal:viewAbort.signal});
        pad.addEventListener('keyup',event=>{if(enabled){pressed.delete(event.code);visual.release(event.code);draw();}},{signal:viewAbort.signal});
        pad.addEventListener('blur',stop,{signal:viewAbort.signal});
        document.defaultView.addEventListener('blur',stop,{signal:viewAbort.signal});
        viewAbort.signal.addEventListener('abort',stop,{once:true});
        const unsubscribeKeys=api?.onTestKey?.(value=>{if(enabled&&!viewAbort.signal.aborted)pad.dispatchEvent(new document.defaultView.KeyboardEvent(value.down?'keydown':'keyup',{bubbles:true,cancelable:true,code:value.code,ctrlKey:!!value.ctrlKey,metaKey:!!value.metaKey,shiftKey:!!value.shiftKey,altKey:!!value.altKey}));});
        const unsubscribeStopped=api?.onTestStopped?.(()=>stop());
        viewAbort.signal.addEventListener('abort',()=>{unsubscribeKeys?.();unsubscribeStopped?.();},{once:true});
      }
    }
    async function prepareImage(file){
      if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('请选择 PNG、JPG 或 WebP 图片');
      if(file.size>10*1024*1024)throw Error('商品图不能超过 10 MB');
      const view=document.defaultView;
      const data=await new Promise((resolve,reject)=>{const reader=new view.FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('图片读取失败'));reader.readAsDataURL(file);});
      const img=await new Promise((resolve,reject)=>{const image=new view.Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('图片无法打开，请换一张图片'));image.src=data;});
      if(img.naturalWidth*img.naturalHeight>40000000)throw Error('图片尺寸过大，请缩小后上传');
      const scale=Math.min(1,1200/img.naturalWidth,1200/img.naturalHeight),canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
      canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
      const result=canvas.toDataURL('image/png');if(result.length>2800000)throw Error('图片内容过大，请缩小后上传');return result;
    }
    async function saveAppearance(device,value){
      if(saving||disposed)return;
      saving=true;notice.textContent='';render();
      try{
        const result=await api.saveAppearance({deviceId:device.id,...value});
        if(disposed)return;
        const current=state?.devices.find(d=>d.id===device.id);if(current)current.appearance=result;
        notice.textContent='已保存到本机';
      }catch(error){if(!disposed)notice.textContent='保存失败：'+error.message;}
      finally{saving=false;render();}
    }
    function refresh(){
      if(disposed)return Promise.reject(Error('Keyboard component was destroyed'));
      if(!api){notice.textContent='未接入本机读取接口';return Promise.resolve(null);}
      if(pending)return pending;
      notice.textContent='';
      pending=Promise.resolve().then(()=>api.status()).then(value=>{
        if(!value||!Array.isArray(value.devices))throw Error('设备信息格式不正确');
        if(disposed)return null;
        state=value;if(!state.devices.some(d=>d.id===selected))selected=null;
        return value;
      }).catch(error=>{if(!disposed){state=null;selected=null;notice.textContent='扫描失败：'+error.message;}return null;})
        .finally(()=>{pending=null;render();});
      render();return pending;
    }
    const instance=Object.freeze({root,refresh,destroy(){disposed=true;viewAbort?.abort();root.remove();mounted.delete(container);},setTheme:UI.setTheme});
    mounted.set(container,instance);render();return instance;
  }
  return Object.freeze({version:1,mount});
});
