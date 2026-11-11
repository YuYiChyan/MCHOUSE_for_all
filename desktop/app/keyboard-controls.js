(function (root) {
  'use strict';
  const known = new Set(['keymap','layers','macros','winLock','nkro','lightingEffect','lightingColor','lightingBrightness','lightingSpeed','perKeyLighting','pollingRate','debounce','sleepTimeout','actuation','rapidTrigger','deadzone','dks','socd','calibration','activeProfile','saveProfile']);
  const own = (value,key) => value != null && Object.prototype.hasOwnProperty.call(value,key);
  const valueOf = response => {
    if (response?.ok === false) throw new Error(response.error || '设备没有完成操作');
    return own(response,'value') ? response.value : response;
  };
  function render(container, options) {
    const document = container.ownerDocument;
    const {device = {}, execute, onError = ()=>{}} = options;
    const capabilities = (options.capabilities || []).filter(cap => known.has(cap.id) && cap.supported === true && cap.provider && cap.version && Array.isArray(cap.evidence) && cap.evidence.length && ((cap.readable && cap.readCommand) || (cap.type === 'action' && cap.writable && cap.writeCommand)));
    const values = {...options.values};
    const cleanups = [];
    let disposed = false, pageDisposers = [], active = options.initialGroup || capabilities[0]?.group || '按键测试';
    const node=(tag,className,text)=>{const element=document.createElement(tag);if(className)element.className=className;if(text!=null)element.textContent=String(text);return element;};
    const listen=(element,event,handler)=>{element.addEventListener(event,handler);return ()=>element.removeEventListener(event,handler);};
    const wrapper=node('section','o4-keyboard');
    const heading=node('header','o4-keyboard-heading');
    heading.append(node('h2','',device.name || device.label || '键盘设置'),node('p','o4-keyboard-muted','设置项随当前设备开放的功能显示'));
    const tabs=node('nav','o4-keyboard-tabs');tabs.setAttribute('aria-label','键盘功能');
    const body=node('div','o4-keyboard-body');
    wrapper.append(heading,tabs,body);container.replaceChildren(wrapper);

    function input(field,value,choices=[]) {
      const outer=node('label','o4-keyboard-field');
      if(field.label)outer.append(node('span','',field.label+(field.unit ? ' · '+field.unit : '')));
      let control;
      if(field.type==='select'||field.type==='key') {
        control=node('select');
        for(const [index,choice] of choices.entries()){const option=node('option','',choice.label);option.value=String(index);control.append(option);}
      } else {
        control=node('input');control.type=field.type==='boolean'?'checkbox':field.type==='color'?'color':field.type==='number'?'number':'text';
        if(field.range){control.min=String(field.range.min);control.max=String(field.range.max);control.step=String(field.range.step);}
      }
      outer.append(control);
      const set=next=>{
        if(field.type==='boolean')control.checked=next===true;
        else if(field.type==='select'||field.type==='key'){
          if(control.options.length!==choices.length){control.replaceChildren();for(const [index,choice] of choices.entries()){const option=node('option','',choice.label);option.value=String(index);control.append(option);}}
          control.value=String(choices.findIndex(choice=>choice.value===next));
        }
        else if(next!=null)control.value=String(next);
      };
      const get=()=>{
        if(!control.reportValidity())throw new Error('请填写设备允许的设置值');
        if(field.type==='boolean')return control.checked;
        if(field.type==='number'){if(control.value==='')throw new Error('请填写数值');return Number(control.value);}
        if(field.type==='select'||field.type==='key'){const selected=choices[Number(control.value)];if(!selected)throw new Error('请选择设备支持的选项');return selected.value;}
        return control.value;
      };
      set(value);return {outer,control,set,get};
    }

    function settingsEditor(cap) {
      const box=node('div','o4-keyboard-editor');
      const fields=[];
      if(cap.type==='keymap') {
        fields.push(['layer',input({type:'select',label:'层'},null,cap.layers)],['key',input({type:'key',label:'原按键'},null,cap.keys)],['action',input({type:'select',label:'映射为'},null,cap.actions)]);
      } else if(cap.type==='fields') {
        for(const field of cap.fields)fields.push([field.id,input(field,null,cap.keys)]);
      } else if(cap.type==='macro') {
        const name=input({type:'text',label:'宏名称'},'');name.control.maxLength=80;
        const events=[];let recording=false,lastTime=0;
        const record=node('button','o4-keyboard-secondary','录制按键');record.type='button';
        const eventCount=node('span','o4-keyboard-muted','0 条事件');
        const timeline=node('ol','o4-keyboard-macro-events');
        const recordArea=node('div','o4-keyboard-record-area','点击录制后，在此区域按下按键；再次点击停止。');recordArea.tabIndex=0;
        const refresh=()=>{eventCount.textContent=events.length+' / '+cap.maxEvents+' 条事件';timeline.replaceChildren(...events.slice(-12).map(event=>node('li','',(event.type==='down'?'按下 ':'松开 ')+event.code+' · '+event.delayMs+' ms')));};
        const stop=()=>{recording=false;record.textContent='重新录制';};
        record.addEventListener('click',()=>{if(recording){stop();return;}events.length=0;lastTime=performance.now();recording=true;record.textContent='停止录制';recordArea.focus();refresh();});
        const capture=event=>{
          if(!recording||event.repeat)return;
          event.preventDefault();event.stopPropagation();
          if(!cap.keys.some(key=>key.value===event.code))return;
          if(events.length>=cap.maxEvents){stop();return;}
          const now=performance.now();events.push({type:event.type==='keydown'?'down':'up',code:event.code,delayMs:Math.min(60000,Math.round(now-lastTime))});lastTime=now;refresh();
        };
        recordArea.addEventListener('keydown',capture);recordArea.addEventListener('keyup',capture);
        recordArea.addEventListener('blur',stop);
        box.append(name.outer,recordArea,record,eventCount,timeline);
        return {box,set:value=>{stop();name.set(value?.name||'');events.splice(0,events.length,...(Array.isArray(value?.events)?value.events:[]));refresh();},get:()=>{stop();const nameValue=name.get().trim();if(!nameValue||!events.length)throw new Error('请填写宏名称并录制按键');return {name:nameValue,events:events.map(event=>({...event}))};}};
      } else if(cap.type!=='action') fields.push(['value',input(cap,null,cap.options)]);
      for(const [,field] of fields)box.append(field.outer);
      return {box,set:value=>{for(const [key,field] of fields)field.set(fields.length===1&&key==='value'?value:value?.[key]);},get:()=>fields.length===1&&fields[0][0]==='value'?fields[0][1].get():Object.fromEntries(fields.map(([key,field])=>[key,field.get()])),onSelection:callback=>{
        const selectionIds=cap.type==='keymap'?['layer','key']:cap.type==='fields'?cap.fields.filter(field=>field.type==='key'&&field.id==='key').map(field=>field.id):[];
        for(const [key,field] of fields)if(selectionIds.includes(key))field.control.addEventListener('change',()=>{const selection=Object.fromEntries(fields.filter(([id])=>selectionIds.includes(id)).map(([id,item])=>[id,item.get()]));callback(selection);});
      }};
    }

    function setting(cap) {
      let alive=true,busy=false,knownValue=own(values,cap.id);
      const section=node('section','o4-keyboard-setting');section.dataset.capability=cap.id;
      section.append(node('h3','',cap.label));
      if(cap.description)section.append(node('p','o4-keyboard-muted',cap.description));
      const editor=settingsEditor(cap);section.append(editor.box);
      const footer=node('div','o4-keyboard-setting-footer'),state=node('span','o4-keyboard-setting-state');state.setAttribute('role','status');
      const save=node('button','o4-keyboard-primary',cap.type==='action'?(cap.actionLabel||'执行'):'应用');save.type='button';
      const refresh=node('button','o4-keyboard-secondary','重新读取');refresh.type='button';
      if(cap.writable&&typeof execute==='function')footer.append(save);
      if(cap.readable&&typeof execute==='function')footer.append(refresh);
      footer.append(state);section.append(footer);
      const enable=()=>{for(const control of editor.box.querySelectorAll('input,select,button,textarea'))control.disabled=busy||!cap.writable||typeof execute!=='function'||(!knownValue&&cap.type!=='macro');save.disabled=busy||(!knownValue&&cap.type!=='action'&&cap.type!=='macro');refresh.disabled=busy;};
      const fail=error=>{if(!alive||disposed)return;state.textContent=error.message||String(error);state.classList.add('is-error');try{onError(error,cap);}catch{};};
      const read=async selection=>{
        if(busy||typeof execute!=='function')return;busy=true;enable();state.textContent='正在读取…';state.classList.remove('is-error');
        try { const value=valueOf(await execute(cap.readCommand,{capability:cap.id,...(selection?{selection}:{})}));if(value===undefined)throw new Error('设备未返回当前设置');if(!alive||disposed)return;values[cap.id]=value;knownValue=true;editor.set(value);state.textContent=''; }
        catch(error){knownValue=false;fail(error);}finally{busy=false;if(alive&&!disposed)enable();}
      };
      save.addEventListener('click',async()=>{
        if(busy||typeof execute!=='function')return;
        let value;try{value=editor.get();}catch(error){fail(error);return;}
        busy=true;enable();state.textContent=cap.type==='action'?'正在执行…':'正在应用…';state.classList.remove('is-error');
        try {
          const acknowledgement=await execute(cap.writeCommand,{capability:cap.id,value});
          valueOf(acknowledgement);
          if(cap.readable){
            const selection=value&&typeof value==='object'&&own(value,'key')?{key:value.key,...(own(value,'layer')?{layer:value.layer}:{})}:undefined;
            const confirmed=valueOf(await execute(cap.readCommand,{capability:cap.id,...(selection?{selection}:{})}));
            if(confirmed===undefined)throw new Error('设置已发送，但未读回当前值');
            if(!alive||disposed)return;values[cap.id]=confirmed;knownValue=true;editor.set(confirmed);state.textContent='已读取设备当前设置';
          } else {if(acknowledgement?.ok!==true)throw new Error('设备尚未确认操作完成');if(alive&&!disposed)state.textContent='操作已完成';}
        } catch(error){knownValue=false;fail(error);}finally{busy=false;if(alive&&!disposed)enable();}
      });
      refresh.addEventListener('click',()=>read());
      editor.onSelection?.(selection=>read(selection));
      if(knownValue)editor.set(values[cap.id]);
      if(!cap.writable)state.textContent='只读';
      if(cap.readable&&!knownValue&&typeof execute==='function')void read();
      else enable();
      pageDisposers.push(()=>{alive=false;});return section;
    }

    function testKeyboard() {
      const panel=node('section','o4-keyboard-setting');panel.append(node('h3','','按键测试'),node('p','o4-keyboard-muted','点击测试区后按键。这里显示系统交给本窗口的按键事件，系统快捷键可能由 Windows 优先处理。'));
      const area=node('div','o4-keyboard-test');area.tabIndex=0;area.setAttribute('aria-label','键盘测试区');
      const rows=[['Escape','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12'],['Backquote','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0','Minus','Equal','Backspace'],['Tab','KeyQ','KeyW','KeyE','KeyR','KeyT','KeyY','KeyU','KeyI','KeyO','KeyP','BracketLeft','BracketRight','Backslash'],['CapsLock','KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK','KeyL','Semicolon','Quote','Enter'],['ShiftLeft','KeyZ','KeyX','KeyC','KeyV','KeyB','KeyN','KeyM','Comma','Period','Slash','ShiftRight'],['ControlLeft','MetaLeft','AltLeft','Space','AltRight','MetaRight','ContextMenu','ControlRight','ArrowLeft','ArrowUp','ArrowDown','ArrowRight']];
      const labels={Escape:'Esc',Backquote:'`',Minus:'−',Equal:'=',Backspace:'⌫',BracketLeft:'[',BracketRight:']',Backslash:'\\',CapsLock:'Caps',Semicolon:';',Quote:"'",ShiftLeft:'Shift',ShiftRight:'Shift',ControlLeft:'Ctrl',ControlRight:'Ctrl',AltLeft:'Alt',AltRight:'Alt',MetaLeft:'Win',MetaRight:'Win',ContextMenu:'菜单',Space:'空格',Comma:',',Period:'.',Slash:'/',ArrowLeft:'←',ArrowRight:'→',ArrowUp:'↑',ArrowDown:'↓'};
      const keys=new Map();
      for(const row of rows){const line=node('div','o4-keyboard-test-row');for(const code of row){const key=node('span','o4-keyboard-test-key',labels[code]||code.replace(/^(Key|Digit)/,''));key.dataset.code=code;line.append(key);keys.set(code,key);}area.append(line);}
      const status=node('p','o4-keyboard-test-status','点击上方测试区开始');status.setAttribute('aria-live','polite');
      const down=new Set(),seen=new Set();
      const handler=event=>{event.preventDefault();event.stopPropagation();if(event.type==='keydown'){down.add(event.code);seen.add(event.code);}else down.delete(event.code);const key=keys.get(event.code);if(key){key.classList.toggle('is-pressed',down.has(event.code));key.classList.add('is-tested');}status.textContent='已测试 '+seen.size+' 个按键'+(down.size?' · 当前按下 '+[...down].join(' + '):'');};
      const clearDown=()=>{down.clear();for(const key of keys.values())key.classList.remove('is-pressed');};
      const reset=node('button','o4-keyboard-secondary','清空记录');reset.type='button';reset.addEventListener('click',()=>{clearDown();seen.clear();for(const key of keys.values())key.classList.remove('is-tested');status.textContent='点击上方测试区开始';area.focus();});
      pageDisposers.push(listen(area,'keydown',handler),listen(area,'keyup',handler),listen(area,'blur',clearDown));
      panel.append(area,status,reset);return panel;
    }

    const groups=[...new Set(capabilities.map(cap=>cap.group)),'按键测试','设备信息'];
    function show(group) {
      for(const cleanup of pageDisposers)cleanup();pageDisposers=[];active=group;
      for(const button of tabs.children){const selected=button.dataset.group===group;button.classList.toggle('active',selected);button.setAttribute('aria-current',selected?'page':'false');}
      body.replaceChildren();
      if(group==='按键测试')body.append(testKeyboard());
      else if(group==='设备信息'){
        const panel=node('section','o4-keyboard-setting');panel.append(node('h3','','设备信息'));
        for(const [label,value] of [['名称',device.name||device.label||'键盘'],['连接',device.connected===true?'已连接':device.connected===false?'未连接':'未确认'],['接口',device.interface||device.transport||'系统键盘输入']]){const line=node('div','o4-keyboard-info-row');line.append(node('span','o4-keyboard-muted',label),node('span','',value));panel.append(line);}
        if(options.infoActions?.length){const actions=node('div','o4-keyboard-setting-footer');for(const action of options.infoActions){const button=node('button','o4-keyboard-secondary',action.label);button.type='button';button.onclick=async()=>{button.disabled=true;try{await action.run();}catch(error){onError(error);}finally{button.disabled=false;}};actions.append(button);}panel.append(actions);}
        if(Object.keys(options.readErrors||{}).length){const details=node('details','o4-keyboard-setting-footer');details.append(node('summary','','本次读取记录'));for(const [key,error]of Object.entries(options.readErrors))details.append(node('p','o4-keyboard-muted',key+'：'+error));panel.append(details);}body.append(panel);
      } else for(const cap of capabilities.filter(cap=>cap.group===group))body.append(setting(cap));
    }
    for(const group of groups){const button=node('button','o4-keyboard-tab',group);button.type='button';button.dataset.group=group;button.addEventListener('click',()=>show(group));tabs.append(button);}
    show(active);
    return {dispose(){disposed=true;for(const cleanup of [...cleanups,...pageDisposers])cleanup();wrapper.remove();},update(next){this.dispose();return render(container,{...options,...next});}};
  }
  root.One4AllKeyboard=Object.freeze({render});
})(typeof window==='object'?window:globalThis);
