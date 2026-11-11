(() => {
 'use strict';
 const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 const kindNames={mouse:'鼠标',keyboard:'键盘',headset:'耳机',charger:'充电器'},selectionKey='one4all-catalog-selection';
 const imageOf=variant=>variant?.imageUrl||variant?.artUrl||variant?.image||null;
 window.One4AllCatalog={render(container,{api,notify=()=>{},onOpen=()=>{}}){
  let alive=true,catalog={devices:[]},serverRecords=[],limit=24,cardMounts=[],settingsDialog=null,selections={};
  try{const saved=JSON.parse(localStorage.getItem(selectionKey)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))selections=saved;}catch{}
  const mount=el('section','model-catalog'),filters=el('div','catalog-filters'),brand=el('select'),kind=el('select'),search=el('input');
  brand.setAttribute('aria-label','筛选品牌');kind.setAttribute('aria-label','筛选设备类型');
  for(const [value,label]of [['','全部设备'],['mouse','鼠标'],['keyboard','键盘'],['headset','耳机']]){const option=el('option','',label);option.value=value;kind.append(option);}
  search.type='search';search.placeholder='搜索型号';search.setAttribute('aria-label','搜索型号');
  const refresh=el('button','secondary','更新型号');refresh.type='button';filters.append(brand,kind,search,refresh);
  const summary=el('div','catalog-summary'),count=el('span','catalog-count','正在读取设备…'),summaryActions=el('div','catalog-summary-actions');
  const refreshStatus=el('button','secondary','刷新验证状态'),serverSettings=el('button','catalog-text-button','服务器设置');refreshStatus.type=serverSettings.type='button';summaryActions.append(refreshStatus,serverSettings);summary.append(count,summaryActions);
  const grid=el('div','device-grid catalog-grid'),more=el('button','secondary','显示更多');more.type='button';more.hidden=true;
  mount.append(filters,summary,grid,more);container.append(mount);
  function disposeCards(){for(const instance of cardMounts)instance?.dispose?.();cardMounts=[];}
  function updateBrands(){const selected=brand.value;brand.replaceChildren();for(const [value,label]of [['','全部品牌'],...Object.entries(catalog.brands||{mchose:'迈从',razer:'雷蛇',logitech:'罗技'})]){const option=el('option','',label);option.value=value;brand.append(option);}brand.value=[...brand.options].some(option=>option.value===selected)?selected:'';}
  function remember(groupId,member,variant){selections[groupId]={memberId:member.id,variantId:variant?.id??null};try{localStorage.setItem(selectionKey,JSON.stringify(selections));}catch{}}
  function versionOf(model){return window.One4AllLocalVerification?.versionOf(model)||String(model.support?.version||model.support?.protocol||model.support?.provider||model.protocol||model.provider||model.source?.version||'当前适配器');}
  function remoteStatus(member){
   const record=serverRecords.find(row=>row.modelId===member.id&&row.providerVersion===versionOf(member));if(!record)return null;
   const verified=record.features?.filter(feature=>feature.status==='verified')||[],reported=record.features?.filter(feature=>feature.status==='reported')||[],disputed=record.features?.filter(feature=>feature.status==='disputed')||[];
   const label=disputed.length?'存在不同反馈':verified.length?'服务端已确认 '+verified.length+' 项':reported.length?'有用户报告 '+reported.length+' 项':null;if(!label)return null;
   const status=el('span','catalog-server-status',label);status.dataset.status=disputed.length?'disputed':verified.length?'verified':'reported';
   const labels=window.One4AllValidation?.checks||{};status.title=(record.features||[]).map(feature=>(labels[feature.id]||feature.id)+'：'+({unverified:'待验证',reported:'已有报告',verified:'服务端已确认',disputed:'存在不同反馈'}[feature.status]||feature.status)).join('；');return status;
  }
  function draw(){
   if(!alive)return Promise.resolve();
   const query=search.value.trim().toLowerCase();
   const rows=(catalog.presentation||catalog.devices||[]).filter(group=>{
    const members=group.members?.length?group.members:[group];
    return (group.hasImage||members.some(member=>member.hasImage))&&!['component','noninteractive'].includes(group.catalogRole)&&(!brand.value||group.brand===brand.value)&&(!kind.value||group.kind===kind.value)&&(!query||[group.displayName,group.name,...members.flatMap(member=>[member.name,member.id])].some(value=>String(value||'').toLowerCase().includes(query)));
   });
   count.textContent=rows.length+' 款设备';disposeCards();grid.replaceChildren();const ready=[];
   for(const group of rows.slice(0,limit)){
    const members=group.members?.length?group.members:[group],groupId=group.presentationId||group.id,name=group.displayName||group.name;
    const variants=(group.variants||[]).filter(variant=>imageOf(variant)).map(variant=>({...variant,id:String(variant.id),imageUrl:imageOf(variant)}));
    const saved=selections[groupId]||{};
    const sourceFor=(variant,member)=>{if(!variant)return null;if(Array.isArray(variant.sourceVariants))return variant.sourceVariants.find(source=>source.modelId===member.id)||null;const original=(member.variants||[]).find(source=>String(source.id)===variant.id);return original?{modelId:member.id,variantId:String(original.id)}:null;};
    let member=members.find(item=>item.id===saved.memberId)||members[0];
    let selected=variants.find(variant=>variant.id===saved.variantId&&sourceFor(variant,member))||variants.find(variant=>sourceFor(variant,member))||variants[0];
    const card=el('article','device-card'),tools=el('div','product-tools'),art=el('button','product-open'),image=el('img'),copy=el('div','card-copy'),title=el('button','card-title');
    art.type=title.type='button';image.loading='lazy';image.alt=name;
    if(selected){image.src=selected.imageUrl;art.append(image);}else art.append(el('span','fallback-art','商品图待补充'));
    const open=()=>onOpen({...member,selectedVariant:sourceFor(selected,member)?.variantId});art.setAttribute('aria-label','打开 '+name);art.onclick=open;title.append(el('h2','',name));title.onclick=open;
    const brandLine=el('div','product-brand',catalog.brands?.[group.brand]||group.brand),meta=el('div','card-meta'),memberSelect=el('select','catalog-member-select');
    memberSelect.setAttribute('aria-label',name+'的连接方式或版本');memberSelect.hidden=members.length<2;
    const names=members.map(item=>item.name||name);
    for(const [index,item]of members.entries()){
     const raw=item.name||name;let label=raw;
     const suffix=raw.startsWith(name)?raw.slice(name.length):'',transport=/^\s*[（(](wired|wireless|receiver|bluetooth|usb|2\.4\s*g(?:hz)?|有线|无线|接收器|蓝牙)[)）]\s*$/i.exec(suffix);
     if(transport){const value=transport[1].toLowerCase().replace(/\s/g,'');label=({wired:'有线',wireless:'无线',receiver:'接收器',bluetooth:'蓝牙',usb:'USB','2.4g':'2.4G','2.4ghz':'2.4G'})[value]||transport[1];}
     else if(names.filter(value=>value===raw).length>1){const description=typeof item.description==='string'?item.description.trim():'',version=item.support?.version;label=description&&description!==raw?description:version?'版本 '+version:'入口 '+(index+1);}
     else if(raw===name)label='默认入口';
     const option=el('option','',label);option.value=item.id;memberSelect.append(option);
    }
    memberSelect.value=member.id;
    let verification=null,picker=null;
    function updateMeta(){
     verification?.dispose();verification=null;meta.replaceChildren(el('span','',kindNames[member.kind]||'设备'));
     const badgeHost=el('span','catalog-local-status');meta.append(badgeHost);
     if(window.One4AllLocalVerification){verification=window.One4AllLocalVerification.mount(badgeHost,{model:member,api,notify});ready.push(verification.ready);}
     const remote=remoteStatus(member);if(remote)meta.append(remote);
    }
    function mountPicker(){picker?.dispose();picker=window.One4AllColorPicker?.mount(tools,{variants,selectedId:selected?.id,image,onSelect:variant=>{
     if(!alive)return;
     if(!sourceFor(variant,member)){const sourceMember=members.find(item=>sourceFor(variant,item));if(sourceMember){member=sourceMember;memberSelect.value=member.id;updateMeta();}}
     selected=variant;remember(groupId,member,selected);
    }});}
    memberSelect.onchange=()=>{
     const next=members.find(item=>item.id===memberSelect.value);if(!next)return;member=next;
     selected=sourceFor(selected,member)?selected:variants.find(variant=>sourceFor(variant,member))||variants[0];
     if(selected)image.src=selected.imageUrl;remember(groupId,member,selected);updateMeta();mountPicker();
    };
    copy.append(brandLine,title,memberSelect,meta);card.append(tools,art,copy);grid.append(card);updateMeta();mountPicker();
    cardMounts.push({dispose(){verification?.dispose();picker?.dispose();}});
   }
   more.hidden=rows.length<=limit;return Promise.allSettled(ready);
  }
  refresh.onclick=async()=>{refresh.disabled=true;refresh.textContent='正在更新…';try{await Promise.all((brand.value?[brand.value]:Object.keys(catalog.brands||{mchose:1,razer:1,logitech:1})).map(id=>api.refreshResources(id)));const next=await api.getDeviceCatalog();if(alive){catalog=next;updateBrands();await draw();notify('型号与商品图已更新');}}catch(error){if(alive)notify(error.message||String(error));}finally{if(alive){refresh.disabled=false;refresh.textContent='更新型号';}}};
  refreshStatus.onclick=async()=>{refreshStatus.disabled=true;refreshStatus.textContent='正在刷新…';try{const result=await api.refreshVerificationServer();if(!alive)return;if(!result.configured){notify('尚未设置验证服务器，可先使用本机确认。');return;}serverRecords=result.records||[];await draw();notify('验证状态已刷新');}catch(error){if(alive)notify(error.message||String(error));}finally{if(alive){refreshStatus.disabled=false;refreshStatus.textContent='刷新验证状态';}}};
  serverSettings.onclick=()=>{if(!window.One4AllServerSettings){notify('服务器设置暂不可用');return;}settingsDialog?.dispose();settingsDialog=window.One4AllServerSettings.open({api,notify,onChange:async()=>{serverRecords=await api.listServerVerifications();if(alive)await draw();}});};
  more.onclick=()=>{limit+=24;draw();};for(const input of [brand,kind,search])input.oninput=()=>{limit=24;draw();};
  const ready=(async()=>{
   const results=await Promise.allSettled([api.getDeviceCatalog(),api.listServerVerifications?.()||Promise.resolve([])]);if(!alive)return;
   if(results[0].status==='rejected')throw results[0].reason;catalog=results[0].value;serverRecords=results[1].status==='fulfilled'&&Array.isArray(results[1].value)?results[1].value:[];updateBrands();await draw();
  })();
  return {ready,dispose(){if(!alive)return;alive=false;disposeCards();settingsDialog?.dispose();mount.remove();}};
 }};
})();
