/* Browse a catalogue product before a direct control session is available. */
(() => {
 'use strict';
 const node=(tag,cls,text)=>{const element=document.createElement(tag);if(cls)element.className=cls;if(text!==undefined)element.textContent=text;return element;};
 const brands={mchose:'迈从',razer:'雷蛇',logitech:'罗技',atk:'ATK',vxe:'VXE',vgn:'VGN',dareu:'达尔优',rapoo:'雷柏',aula:'狼蛛',melgeek:'MelGeek',keychron:'Keychron 渴创',monsgeek:'MonsGeek',akko:'Akko',rk:'RK',redragon:'红龙',inphic:'英菲克',darmoshark:'达摩鲨',attackshark:'Attack Shark',xiberia:'西伯利亚'};
 const kinds={mouse:'鼠标',keyboard:'键盘',headset:'耳机',headset_dock:'耳机底座',speaker:'音箱',microphone:'麦克风',camera:'摄像头',wheel:'方向盘',pedals:'踏板',charge_pad:'充电垫',rs_shifter_handbrake:'换挡器与手刹',h_shifter:'换挡器'};
 window.One4AllCatalogDetails={render(container,{model,api,notify=()=>{},onBack=()=>{}}){
  let alive=true,feedback=null;
  const root=node('section','o4-mouse'),side=node('aside','o4-mouse-sidebar'),main=node('div','o4-mouse-main');
  const heading=node('div','o4-mouse-heading'),back=node('button','o4-mouse-back','← 返回支持库');back.type='button';back.onclick=onBack;
  heading.append(back,node('h2','',model.name),node('p','o4-mouse-muted',brands[model.brand]||model.brand));
  const verificationHost=node('div','device-local-confirmation'),art=node('div','o4-mouse-art'),image=node('img'),colorHost=node('div','device-palette');
  const variants=(model.variants||[]).map(v=>({...v,name:v.name||v.label,color:v.color||v.swatch,imageUrl:v.imageUrl||v.artUrl||v.image}));
  const selected=variants.find(v=>v.id===model.selectedVariant)||variants[0];image.alt=model.name;
  if(selected?.imageUrl){image.src=selected.imageUrl;art.append(image);}
  const picker=One4AllColorPicker.mount(colorHost,{variants,selectedId:selected?.id,image});
  const body=node('div','o4-mouse-body'),box=node('section','o4-mouse-setting'),message=node('p','o4-mouse-message');message.hidden=true;message.setAttribute('role','status');
  const row=(name,value)=>{const item=node('div','o4-mouse-info-row');item.append(node('span','o4-mouse-muted',name),node('span','',value));return item;};
  const verificationRow=row('适配状态','待验证');
  box.append(node('h3','','设备信息'),row('型号',model.name),row('品牌',brands[model.brand]||model.brand),row('类型',kinds[model.kind]||'设备'),verificationRow);
  const verification=One4AllLocalVerification.mount(verificationHost,{model,api,notify,onChange:record=>{if(alive)verificationRow.lastElementChild.textContent=record.confirmed?'本机已确认':'待验证';}});
  function action(label,run){const button=node('button','secondary',label);button.type='button';button.onclick=async()=>{if(!alive)return;button.disabled=true;message.hidden=true;try{await run();}catch(error){if(alive){message.textContent=error.message||String(error);message.hidden=false;notify(message.textContent);}}finally{if(alive)button.disabled=false;}};return button;}
  box.append(action('打开官方设置',()=>model.brand==='mchose'?api.openBrand('mchose'):api.openOfficial(model.brand)),action('提交验证反馈',()=>{feedback?.dispose?.();feedback=One4AllValidation.open({model,providerVersion:One4AllLocalVerification.versionOf(model),availableChecks:['connection'],api,notify});}));
  body.append(box);main.append(message,body);side.append(heading,verificationHost,art,colorHost);root.append(side,main);container.replaceChildren(root);
  return {ready:verification.ready,dispose(){if(!alive)return;alive=false;picker.dispose();verification.dispose();feedback?.dispose?.();root.remove();}};
 }};
})();
