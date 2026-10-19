(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const categories = [
    ['monitor','实时监控','icon-lighting_linear'],
    ['trend','功率曲线','icon-refresh_linear'],
    ['connection','设备连接','icon-a-bluetooth2_char'],
  ];
  const portNames = {'1':'USB-C1','2':'USB-C2','3':'USB-C3','4':'USB-A'};
  let category = 'monitor';
  let state = null;
  let busy = false;
  let lastRead = 0;
  let qrTimer = null;
  let qrRevision = 0;
  let qrChecking = false;
  const samples = [];
  const errorMessage = error => String(error?.message || '操作未完成，请重试').replace(/^Error invoking remote method '[^']+': Error:\s*/, '');

  function online() { return !!(state?.connected && state?.authenticated && Date.now() - lastRead < 8000); }
  function number(value, digits=1) { return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—'; }
  function totalPower() { return Object.values(state?.ports || {}).reduce((sum, port) => sum + (Number(port.power) || 0), 0); }
  function node(tag, className, text) { const element=document.createElement(tag); if(className)element.className=className; if(text!=null)element.textContent=text; return element; }
  function row(label, value) { const element=node('div','dc-row'); element.append(node('span','dc-muted',label),node('span','',value)); return element; }
  function button(label, onClick, primary=false) { const element=node('button',`charger-action${primary?' primary':''}`,label);element.type='button';element.addEventListener('click',onClick);return element; }

  for (const [id,label,icon] of categories) {
    const item = node('button','dc-nav-item');
    item.type='button'; item.dataset.category=id;
    item.innerHTML=`<i class="dc-nav-icon iconfont ${icon}" aria-hidden="true"></i><span class="dc-nav-label">${label}</span>`;
    item.addEventListener('click',()=>{category=id;render();});
    $('categoryNav').append(item);
  }

  function render() {
    const connected = online();
    $('connectionText').textContent = connected ? '蓝牙已连接' : state?.configured ? '连接中' : '等待绑定';
    $('totalPower').replaceChildren(document.createTextNode(connected?number(totalPower()):'—'),node('small','',' W'));
    $('pageTitle').textContent = categories.find(item=>item[0]===category)[1];
    document.querySelectorAll('.dc-nav-item').forEach(item=>{const active=item.dataset.category===category;item.classList.toggle('active',active);if(active)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current');});
    const host=$('configArea');host.replaceChildren();
    if(category==='monitor') {
      if(!connected) host.append(node('p','charger-message',state?.configured?'正在等待充电器连接，当前没有实时读数。':'首次使用请连接米家账户，获取这只充电器的蓝牙认证。'));
      const grid=node('div','charger-port-grid');
      for(const [id,label] of Object.entries(portNames)) {
        const port=state?.ports?.[id];
        const box=node('section','charger-port');const title=node('h2','',label);
        title.append(node('span','port-protocol',connected ? (!port?.active?'空闲':String(port?.protocol||'—').toUpperCase()) : '未连接'));
        const power=node('strong','port-power',connected?number(port?.power):'—');power.append(node('small','',' W'));
        box.append(title,power,row('电压',connected?`${number(port?.voltage,2)} V`:'—'),row('电流',connected?`${number(port?.current,3)} A`:'—'));
        grid.append(box);
      }
      host.append(grid);
    } else if(category==='trend') {
      host.append(node('h2','dc-card-title','总输出功率'));
      if(samples.length<2) host.append(node('p','charger-message','连接充电器后开始记录本次功率变化。'));
      else {
        const chart=node('div','charger-chart');const max=Math.max(10,...samples.map(point=>point.power));
        const points=samples.map((point,index)=>`${index/(samples.length-1)*1000},${170-point.power/max*160}`).join(' ');
        chart.innerHTML=`<svg viewBox="0 0 1000 180" preserveAspectRatio="none" role="img" aria-label="最近十分钟总功率曲线"><path class="chart-baseline" d="M0 170H1000"/><polyline class="chart-line" points="${points}"/></svg>`;
        host.append(chart,node('div','chart-caption',`本次窗口记录 · 最高 ${number(Math.max(...samples.map(point=>point.power)))} W · 最近 10 分钟`));
      }
    } else {
      const info=node('div','charger-info');
      info.append(row('设备名称','CUKTECH 10 Ultra'),row('连接方式','蓝牙'),row('连接状态',connected?'已连接':state?.configured?'等待连接':'尚未绑定'),row('设备型号',state?.device_model||'—'),row('固件版本',state?.firmware_version||'—'));
      const actions=node('div','charger-actions');
      actions.append(button(state?.configured?'重新扫码绑定':'米家扫码连接',openPair,true),button('重新连接',async()=>{try{await window.charger.reconnect();$('feedback').textContent='正在重新连接…';}catch(error){$('feedback').textContent=errorMessage(error);}}));
      info.append(actions);host.append(info);
    }
  }

  async function refresh() {
    if(busy)return;
    busy=true;
    try {
      state=await window.charger.status();lastRead=Date.now();$('feedback').textContent='';
      if(online()) { samples.push({at:Date.now(),power:totalPower()});while(samples.length&&samples[0].at<Date.now()-600000)samples.shift(); }
    } catch(error) { $('feedback').textContent='设备数据暂不可用'; }
    finally { busy=false;render(); }
  }

  async function openPair() {
    if(!$('pairDialog').open)$('pairDialog').showModal();
    await startQr();
  }
  async function startQr() {
    const revision=++qrRevision;clearTimeout(qrTimer);
    $('qrStatus').textContent='正在获取米家二维码…';$('qrImage').hidden=true;$('deviceChoices').replaceChildren();$('newQr').disabled=true;
    try {
      const result=await window.charger.startQr();if(revision!==qrRevision)return;
      $('qrImage').src=result.image;$('qrImage').hidden=false;
      $('qrStatus').textContent='请使用米家 App 扫码，并在手机上确认登录。';
      qrTimer=setTimeout(()=>checkQr(revision),2000);
    } catch(error) { if(revision===qrRevision)$('qrStatus').textContent=errorMessage(error); }
    finally { $('newQr').disabled=false; }
  }
  async function checkQr(revision) {
    if(revision!==qrRevision||!$('pairDialog').open)return;
    if(qrChecking){qrTimer=setTimeout(()=>checkQr(revision),300);return;}
    qrChecking=true;
    try {
      const result=await window.charger.checkQr();if(revision!==qrRevision)return;
      if(result.waiting) { qrTimer=setTimeout(()=>checkQr(revision),2000);return; }
      $('qrImage').hidden=true;
      if(!result.devices.length) { $('qrStatus').textContent='这个米家账户里没有找到 CUKTECH 10 Ultra，请确认充电器已绑定到中国大陆地区。';return; }
      $('qrStatus').textContent='选择要连接的充电器';
      for(const device of result.devices) $('deviceChoices').append(button(device.name||'CUKTECH 10 Ultra',async(event)=>{
        const selected=event.currentTarget;selected.disabled=true;$('qrStatus').textContent='正在保存设备认证并连接蓝牙…';
        try { await window.charger.pair(device.did);$('pairDialog').close();$('feedback').textContent='正在连接充电器…';setTimeout(refresh,2500); }
        catch(error) { $('qrStatus').textContent=errorMessage(error);selected.disabled=false; }
      },true));
    } catch(error) { if(revision===qrRevision)$('qrStatus').textContent=errorMessage(error); }
    finally { qrChecking=false; }
  }

  $('newQr').addEventListener('click',startQr);
  $('closePair').addEventListener('click',()=>$('pairDialog').close());
  $('pairDialog').addEventListener('close',()=>{qrRevision++;clearTimeout(qrTimer);});
  $('backHome').addEventListener('click',()=>window.charger.back());
  window.addEventListener('pagehide',()=>clearTimeout(qrTimer),{once:true});
  const initialTheme=new URLSearchParams(location.search).get('dcTheme');
  if(initialTheme==='light'||initialTheme==='dark')document.documentElement.dataset.dcTheme=initialTheme;
  const selectedColor=new URLSearchParams(location.search).get('color')||'cuktech-10-ultra';
  async function loadArt(){try{const art=await window.charger.art(selectedColor);if(art){$('chargerArt').src=`data:${art.mimeType};base64,${art.base64}`;$('chargerArt').hidden=false;$('artPlaceholder').hidden=true;}}catch{}}
  loadArt();setInterval(loadArt,15000);
  render();refresh();
  setInterval(()=>{if(!document.hidden)refresh();},2000);
})();
