(() => {
  if (window.__driveCenterNativeCards?.version === 2) {
    window.__driveCenterNativeCards.ensure();
    return { installed: true, version: 2 };
  }

  const enabled = new Set(window.__one4allEnabled || []);
  const art = {
    g309:"data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22520%22%20height%3D%22300%22%20viewBox%3D%220%200%20520%20300%22%3E%3Cg%20fill%3D%22%23282d35%22%20stroke%3D%22%238793a5%22%20stroke-width%3D%223%22%3E%3Cpath%20d%3D%22M260%2027c-61%200-91%2037-91%20104v46c0%2060%2031%2098%2091%2098s91-38%2091-98v-46c0-67-30-104-91-104Z%22%2F%3E%3Cpath%20d%3D%22M260%2027v96M174%20134h172%22%20fill%3D%22none%22%2F%3E%3Crect%20x%3D%22251%22%20y%3D%2263%22%20width%3D%2218%22%20height%3D%2238%22%20rx%3D%227%22%20fill%3D%22%238d98a9%22%2F%3E%3Cpath%20d%3D%22M178%20146v34m0-42v-18%22%2F%3E%3Cpath%20d%3D%22M245%20209h30%22%20fill%3D%22none%22%2F%3E%3C%2Fg%3E%3Ctext%20x%3D%22260%22%20y%3D%22246%22%20text-anchor%3D%22middle%22%20fill%3D%22%23b0b9c7%22%20font-family%3D%22sans-serif%22%20font-size%3D%2214%22%3EG309%3C%2Ftext%3E%3Cg%3E%3C%2Fg%3E%3C%2Fsvg%3E%0A",blackshark:"data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22520%22%20height%3D%22300%22%20viewBox%3D%220%200%20520%20300%22%3E%3Cg%20fill%3D%22%23282d35%22%20stroke%3D%22%238793a5%22%20stroke-width%3D%223%22%3E%3Cpath%20d%3D%22M157%20161v-28a103%20103%200%200%201%20206%200v28%22%20fill%3D%22none%22%20stroke-width%3D%2219%22%2F%3E%3Cpath%20d%3D%22M168%20153v-20a92%2092%200%200%201%20184%200v20%22%20fill%3D%22none%22%20stroke%3D%22%234e5866%22%20stroke-width%3D%227%22%2F%3E%3Crect%20x%3D%22140%22%20y%3D%22139%22%20width%3D%2262%22%20height%3D%22116%22%20rx%3D%2224%22%2F%3E%3Crect%20x%3D%22318%22%20y%3D%22139%22%20width%3D%2262%22%20height%3D%22116%22%20rx%3D%2224%22%2F%3E%3Cpath%20d%3D%22M158%20214c-9%2048%2050%2056%2081%2051%22%20fill%3D%22none%22%20stroke-width%3D%226%22%2F%3E%3Crect%20x%3D%22229%22%20y%3D%22256%22%20width%3D%2233%22%20height%3D%2216%22%20rx%3D%228%22%20fill%3D%22%236c7788%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E%0A",
    keyboard: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="520" height="300" viewBox="0 0 520 300">
        <defs>
          <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
            <stop stop-color="#2b3440"/><stop offset="1" stop-color="#161c24"/>
          </linearGradient>
          <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
            <stop stop-color="#5ee7f4"/><stop offset="1" stop-color="#e6b95c"/>
          </linearGradient>
        </defs>
        <g transform="translate(38 62) rotate(-5 222 88)">
          <rect x="0" y="0" width="444" height="176" rx="18" fill="url(#body)" stroke="#536171" stroke-width="2"/>
          <rect x="14" y="14" width="416" height="148" rx="10" fill="#202832"/>
          <g fill="#394553">
            ${Array.from({ length: 6 }, (_, row) =>
              Array.from({ length: 14 }, (_, col) =>
                `<rect x="${24 + col * 28}" y="${24 + row * 21}" width="22" height="16" rx="3"/>`
              ).join('')
            ).join('')}
          </g>
          <rect x="132" y="150" width="180" height="18" rx="4" fill="#4a5868"/>
          <rect x="22" y="166" width="400" height="3" rx="1.5" fill="url(#accent)" opacity="0.9"/>
        </g>
      </svg>
    `)}`,
    razer: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="520" height="300" viewBox="0 0 520 300">
        <defs>
          <linearGradient id="shell" x1="0" y1="0" x2="0" y2="1">
            <stop stop-color="#333d4b"/><stop offset="1" stop-color="#121820"/>
          </linearGradient>
          <linearGradient id="rgb" x1="0" y1="0" x2="1" y2="0">
            <stop stop-color="#5ee7f4"/><stop offset="0.5" stop-color="#b985ff"/><stop offset="1" stop-color="#f0b45d"/>
          </linearGradient>
        </defs>
        <path d="M260 32c-53 0-90 37-90 91v57c0 56 37 88 90 88s90-32 90-88v-57c0-54-37-91-90-91Z" fill="url(#shell)" stroke="#59677a" stroke-width="2"/>
        <path d="M260 34v88" stroke="#66758a" stroke-width="2"/>
        <rect x="250" y="66" width="20" height="42" rx="10" fill="#0d1218" stroke="#647286" stroke-width="2"/>
        <rect x="176" y="202" width="168" height="5" rx="2.5" fill="url(#rgb)"/>
        <path d="M203 151h114" stroke="#4b596c" stroke-width="2"/>
      </svg>
    `)}`,
  };

  const cards = {
    g309:{label:'Logitech G309',status:'等待检测',icon:'icon-wifi_linear'},blackshark:{label:'BlackShark V2',status:'等待检测',icon:'icon-usb_linear'},
    keyboard: { label: 'TANK68HE', status: 'USB', icon: 'a-keybordcharging_linear' },
    razer: { label: 'Razer Viper Mini SE', status: '2.4G', icon: 'icon-wifi_linear' },
    charger:{label:'CUKTECH 10 Ultra',status:'等待绑定',icon:'icon-a-bluetooth2_char'},
  };
  const colorOptions = {
    g309:[{id:'g309',label:'黑色示意图',swatch:'#202124'}],blackshark:[{id:'blackshark',label:'黑色示意图',swatch:'#202124'}],
    keyboard: [
      { id: 'tank68-purple', label: '紫色', swatch: '#7C4DFF' },
      { id: 'tank68-black', label: '黑色', swatch: '#202124' },
    ],
    razer: [
      { id: 'razer-black', label: '黑色', swatch: '#16181D' },
      { id: 'razer-white', label: '白色', swatch: '#F2F2F2' },
    ],
    charger:[{id:'cuktech-10-ultra',label:'银色',swatch:'#c6c9cc'},{id:'cuktech-10-ultra-black',label:'黑色纪念版',swatch:'#202124'}],
  };
  const selectedColors = {
    g309:'g309',blackshark:'blackshark',
    keyboard: readSavedColor('keyboard', 'tank68-purple'),
    razer: readSavedColor('razer', 'razer-black'),
    charger:readSavedColor('charger','cuktech-10-ultra'),
  };
  let lastRazerStatus = null;
  let lastChargerStatus = null;
  const productUrls = new Map();

  function readSavedColor(kind, fallback) {
    try {
      const saved = localStorage.getItem(`dc-color-${kind}`);
      return colorOptions[kind].some(option => option.id === saved) ? saved : fallback;
    } catch {
      return fallback;
    }
  }

  function setColor(kind, color) {
    if (!colorOptions[kind].some(option => option.id === color)) return;
    selectedColors[kind] = color;
    try { localStorage.setItem(`dc-color-${kind}`, color); } catch {}
    applyProductArt(kind);
    updateColorButton(kind);
  }

  function updateColorButton(kind, cardNode) {
    const card = cardNode || document.querySelector(`[data-dc-local="${kind}"]`);
    const button = card?.querySelector('.dc-card-color');
    if (!button) return;
    const options = colorOptions[kind];
    const current = options.find(option => option.id === selectedColors[kind]) || options[0];
    if(options.length===1){button.disabled=true;button.title=current.label;button.setAttribute('aria-label',current.label);button.style.setProperty('--dc-color-gradient',current.swatch);return;}
    const next = options[(options.indexOf(current) + 1) % options.length];
    button.title = `切换颜色：${current.label} / ${next.label}`;
    button.setAttribute('aria-label', button.title);
    button.style.setProperty('--dc-color-gradient', `linear-gradient(135deg, ${current.swatch}, ${next.swatch})`);
  }

  function cycleColor(kind) {
    const options = colorOptions[kind];
    const index = options.findIndex(option => option.id === selectedColors[kind]);
    const next = options[(index + 1) % options.length];
    setColor(kind, next.id);
    if (!productUrls.has(next.id)) requestProductArt([next.id]);
  }

  function closeColorPopovers(except) {
    document.querySelectorAll('.dc-color-popover').forEach(popover => {
      if (popover !== except) popover.hidden = true;
    });
  }

  function buildColorPopover(kind) {
    const popover = document.createElement('div');
    popover.className = 'dc-color-popover';
    popover.hidden = true;
    colorOptions[kind].forEach(option => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'dc-color-option';
      button.dataset.dcColorOption = option.id;
      const dot = document.createElement('span');
      dot.className = 'dc-color-option-dot';
      dot.style.background = option.swatch;
      button.title = option.label;
      button.setAttribute('aria-label', option.label);
      button.append(dot);
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        setColor(kind, option.id);
        popover.hidden = true;
        if (!productUrls.has(option.id)) requestProductArt([option.id]);
      });
      popover.append(button);
    });
    return popover;
  }

  function toggleColorPopover(card, kind) {
    let popover = card.querySelector('.dc-color-popover');
    if (!popover) {
      popover = buildColorPopover(kind);
      card.append(popover);
    }
    updateColorButton(kind);
    const open = popover.hidden;
    closeColorPopovers(popover);
    popover.hidden = !open;
  }

  function installProductStyles() {
    if (document.getElementById('dc-product-art-style')) return;
    const style = document.createElement('style');
    style.id = 'dc-product-art-style';
    style.textContent = `
      .device-card-img-track:has(.device-card-img-slide[data-dc-product]) {
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        transform: none !important;
      }
      .device-card[data-dc-local] {
        overflow: visible !important;
      }
      .device-card:not(.is-list) .device-card-img:has(.device-card-img-slide[data-dc-product]) {
        height: 237px !important;
        min-height: 237px !important;
        flex: 0 0 237px !important;
      }
      .device-card:not(.is-list) .device-card-img-viewport:has(.device-card-img-slide[data-dc-product]) {
        height: 237px !important;
      }
      .device-card-img-slide[data-dc-product] {
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 4px 0 !important;
        box-sizing: border-box !important;
        background: transparent !important;
        overflow: hidden !important;
      }
      .device-card-img-slide[data-dc-product] img {
        width: auto !important;
        height: auto !important;
        max-width: 100% !important;
        max-height: 100% !important;
        object-fit: contain !important;
        object-position: center !important;
        margin: auto !important;
        filter: none !important;
      }
      .device-card[data-dc-local]:not(.is-list) .device-card-switch-wrapper {
        height: 56px !important;
        min-height: 56px !important;
        display: flex !important;
        align-items: flex-end !important;
        justify-content: flex-start !important;
        padding: 0 0 4px 24px !important;
        box-sizing: border-box !important;
      }
      .dc-card-color {
        width: 12px !important;
        height: 12px !important;
        padding: 0 !important;
        border: 0 !important;
        border-radius: 9999px !important;
        background: var(--dc-color-gradient) !important;
        opacity: .35 !important;
        cursor: pointer !important;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.25) !important;
        transition: opacity .2s ease, transform .15s ease !important;
      }
      .device-card[data-dc-local]:hover .dc-card-color {
        opacity: 1 !important;
        box-shadow: 0 0 0 2px rgba(34, 107, 238, .25) !important;
      }
      .dc-card-color:hover {
        transform: scale(1.15) !important;
      }
      .device-card[data-dc-local] .device-card-switch {
        display: flex !important;
        align-items: center !important;
        opacity: 0 !important;
        transition: opacity .2s ease !important;
      }
      .device-card[data-dc-local]:hover .device-card-switch,
      .device-card[data-dc-local] .device-card-switch:focus-within {
        opacity: 1 !important;
      }
      .device-card[data-dc-local] .device-card-switch .el-tooltip__trigger {
        display: flex !important;
      }
      .device-card[data-dc-local] .device-card-switch button {
        width: 12px !important;
        height: 12px !important;
        padding: 0 !important;
        border: 0 !important;
        border-radius: 9999px !important;
        background: var(--dc-color-gradient) !important;
        cursor: pointer !important;
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .25) !important;
      }
      .dc-color-popover {
        position: absolute !important;
        left: 40px !important;
        bottom: 4px !important;
        z-index: 30 !important;
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        gap: 6px !important;
        padding: 0 !important;
        border: 0 !important;
        border-radius: 999px !important;
        background: transparent !important;
      }
      .dc-color-popover[hidden] {
        display: none !important;
      }
      .dc-color-option {
        width: 18px !important;
        height: 18px !important;
        padding: 0 !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        border: 0 !important;
        border-radius: 50% !important;
        background: transparent !important;
        cursor: pointer !important;
      }
      .dc-color-option-dot {
        width: 16px !important;
        height: 16px !important;
        flex: 0 0 16px !important;
        border: 1px solid rgba(255,255,255,.2) !important;
        border-radius: 50% !important;
      }
      .dc-color-option.active .dc-color-option-dot {
        box-shadow: 0 0 0 2px #226bee !important;
      }
    `;
    document.head.append(style);
  }

  function open(kind, color) {
    window.parent.postMessage({ source: 'drivecenter', type: 'open', kind, color }, '*');
  }

  function makeCard(template, kind) {
    const data = cards[kind];
    const card = template.cloneNode(true);
    card.dataset.dcLocal = kind;
    card.removeAttribute('style');
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `打开 ${data.label}`);
    card.style.cursor = 'pointer';
    const switchWrapper = card.querySelector('.device-card-switch-wrapper');
    if (switchWrapper) {
      switchWrapper.replaceChildren();
      const colorButton = document.createElement('button');
      colorButton.type = 'button';
      colorButton.className = 'dc-card-color';
      colorButton.dataset.dcColor = kind;
      colorButton.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        cycleColor(kind);
      });
      switchWrapper.append(colorButton);
      updateColorButton(kind, card);
    }

    const name = card.querySelector('.device-card-name');
    if (name) {
      const text = document.createElement('div');
      text.textContent = data.label;
      name.replaceChildren(text);
    }

    const track = card.querySelector('.device-card-img-track');
    const viewport = card.querySelector('.device-card-img-viewport');
    if (track && viewport) {
      const slide = document.createElement('div');
      slide.className = 'device-card-img-slide is-active';
      slide.dataset.dcProduct = kind;
      const image = document.createElement('img');
      if(kind==='charger')image.style.setProperty('display','none');
      const source=productUrls.get(selectedColors[kind]) || art[kind];
      if(source)image.src=source;
      else image.hidden=true;
      if(source)image.style.removeProperty('display');
      image.alt = data.label;
      slide.append(image);
      if(kind==='charger'&&!source){const placeholder=document.createElement('i');placeholder.className='iconfont icon-usb_linear';placeholder.dataset.dcChargerPlaceholder='true';placeholder.style.cssText='font-size:96px;color:var(--color-text,#888)';slide.append(placeholder);}
      track.replaceChildren(slide);
      track.style.width = '100%';
      track.style.transform = 'none';
      track.style.setProperty('--slide-count', '1');
    }

    const status = card.querySelector('.device-card-status');
    if(status&&['g309','blackshark'].includes(kind)){const item=document.createElement('li');item.className='device-card-status-item connection';item.dataset.dcHandoff=kind;item.textContent='等待检测';status.replaceChildren(item);}
    if(status&&kind==='charger')status.innerHTML='<li class="device-card-status-item connection"><i class="iconfont icon-a-bluetooth2_char"></i><span data-dc-charger="connection">等待绑定</span></li><li class="device-card-status-item"><span data-dc-charger="power">— W</span></li>';
    if (status && kind === 'keyboard') {
      const item = document.createElement('li');
      item.className = 'device-card-status-item connection';
      item.innerHTML = `<i class="iconfont ${data.icon}"></i><span>${data.status}</span>`;
      status.replaceChildren(item);
    }
    if (status && kind === 'razer') {
      const battery = document.createElement('li');
      battery.className = 'device-card-status-item battery';
      battery.dataset.dcRazer = 'battery';
      battery.innerHTML = '<i class="iconfont icon-a-elec100_linear"></i><span>--%</span>';
      const connection = document.createElement('li');
      connection.className = 'device-card-status-item connection';
      connection.dataset.dcRazer = 'connection';
      connection.innerHTML = '<i class="iconfont icon-wifi_linear"></i><span>2.4G</span>';
      const charging = document.createElement('li');
      charging.className = 'device-card-status-item connection';
      charging.dataset.dcRazer = 'charging';
      charging.hidden = true;
      charging.innerHTML = '<i class="iconfont icon-a-batterylight_char"></i><span>充电中</span>';
      status.replaceChildren(battery, connection, charging);
    }

    card.addEventListener('click', event => {
      if (event.target?.closest?.('[data-dc-color], .dc-color-popover')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      open(kind, selectedColors[kind]);
    }, true);
    card.addEventListener('keydown', event => {
      if (event.target?.closest?.('[data-dc-color], .dc-color-popover')) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      open(kind, selectedColors[kind]);
    });
    return card;
  }

  function applyProductArt(kind) {
    const url = productUrls.get(selectedColors[kind]);
    if (!url) return;
    const card = document.querySelector(`[data-dc-local="${kind}"]`);
    const image = card?.querySelector(`.device-card-img-slide[data-dc-product="${kind}"] img`);
    if (image) {
      image.src = url;
      image.hidden=false;
      image.style.removeProperty('display');
      card.querySelector('[data-dc-charger-placeholder]')?.remove();
      image.dataset.dcProductArt = 'true';
    }
  }

  function acceptProductArt(payload) {
    const artKey = payload?.kind;
    const allowed = new Set(['tank68-purple', 'tank68-black', 'razer-black', 'razer-white','cuktech-10-ultra','cuktech-10-ultra-black','g309','blackshark']);
    if (!productUrls.has(artKey) && allowed.has(artKey) && payload?.base64) {
      try {
        const binary = atob(payload.base64);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
        const blob = new Blob([bytes], { type: payload.mimeType || 'image/webp' });
        productUrls.set(artKey, URL.createObjectURL(blob));
      } catch {}
    }
    applyProductArt('keyboard');
    applyProductArt('razer');
    applyProductArt('charger');applyProductArt('g309');applyProductArt('blackshark');
  }

  function requestProductArt() {
    window.parent.postMessage({
      source: 'drivecenter',
      type: 'product-art-request',
      kinds: [...enabled].flatMap(kind=>colorOptions[kind].map(option=>option.id)),
    }, '*');
  }

  function updateRazerStatus(status) {
    if (status?.ok === false && lastRazerStatus?.ok !== false) {
      setTimeout(requestRazerStatus, 1500);
      return;
    }
    lastRazerStatus = status || null;
    const card = document.querySelector('[data-dc-local="razer"]');
    if (!card) return;
    const battery = card.querySelector('[data-dc-razer="battery"]');
    const connection = card.querySelector('[data-dc-razer="connection"]');
    const charging = card.querySelector('[data-dc-razer="charging"]');
    const dpiButton = card.querySelector('[data-dc-razer="dpi"]');
    const rateButton = card.querySelector('[data-dc-razer="rate"]');
    if (!battery || !connection || !charging) return;
    const value = Number(status?.battery_percent);
    if (Number.isFinite(value)) {
      const bucket = Math.max(10, Math.min(100, Math.round(value / 10) * 10));
      const icon = battery.querySelector('i');
      const text = battery.querySelector('span');
      if (icon) icon.className = `iconfont icon-a-elec${bucket}_linear`;
      if (text) text.textContent = `${Math.round(value)}%`;
    } else {
      const text = battery.querySelector('span');
      if (text) text.textContent = '--%';
    }
    const online = status?.ok !== false && status?.poll_rate != null;
    const connectionText = connection.querySelector('span');
    if (connectionText) connectionText.textContent = online ? '2.4G' : '未连接';
    charging.hidden = !status?.charging;
    if (dpiButton && Array.isArray(status?.dpi) && status.dpi.length) {
      const dpiValue = dpiButton.querySelector('strong');
      if (dpiValue) dpiValue.textContent = String(status.dpi[0]);
      const stage = status.active_stage ? ` · 第 ${status.active_stage} 档` : '';
      dpiButton.title = `切换雷蛇灵敏度 · 当前 ${status.dpi[0]} DPI${stage}`;
    }
    if (rateButton && status?.poll_rate != null) {
      const rateValue = rateButton.querySelector('strong');
      if (rateValue) rateValue.textContent = String(status.poll_rate);
      rateButton.title = `切换雷蛇回报率 · 当前 ${status.poll_rate} Hz`;
    }
  }

  function requestRazerStatus() {
    if(!enabled.has('razer'))return;
    window.parent.postMessage({ source: 'drivecenter', type: 'razer-status-request' }, '*');
  }

  function requestChargerStatus(){if(!enabled.has('charger'))return;window.parent.postMessage({source:'drivecenter',type:'charger-status-request'},'*');}
  function updateChargerStatus(status){
    lastChargerStatus=status;
    const card=document.querySelector('[data-dc-local="charger"]');if(!card)return;
    const connected=status?.connected&&status?.authenticated;
    card.querySelector('[data-dc-charger="connection"]').textContent=connected?'蓝牙':status?.configured?'连接中':'等待绑定';
    card.querySelector('[data-dc-charger="power"]').textContent=connected&&Number.isFinite(status.power)?`${status.power.toFixed(1)} W`:'— W';
  }

  const deviceStates=new Map();
  function updateDeviceStatus(kind,status){
    if(!['g309','blackshark'].includes(kind))return;deviceStates.set(kind,status);
    const node=document.querySelector('[data-dc-handoff="'+kind+'"]');if(!node)return;
    node.textContent=status?.connected?(kind==='g309'?(status.transport==='lightspeed'?'LIGHTSPEED':'蓝牙')+' · '+(typeof status.values?.battery==='number'?status.values.battery+'%':'电量未知'):'USB 声卡 · 已连接'):'未连接';
  }
  function requestDevices(){if(document.hidden)return;for(const kind of ['g309','blackshark'])if(enabled.has(kind))window.parent.postMessage({source:'drivecenter',type:'device-status-request',kind},'*');}
  setInterval(requestDevices,15000);
  function ensure() {
    const list = document.querySelector('.device-list');
    if (!list) return false;
    const template = list.querySelector('.device-card:not([data-dc-local])') ||
      document.querySelector('.device-card:not([data-dc-local])');
    if (!template) return false;
    let changed = false;
    for (const kind of enabled) {
      let local=list.querySelector(`[data-dc-local="${kind}"]`);
      if(!local){local=makeCard(template,kind);list.append(local);changed=true;}
      for(const flag of ['is-list','is-dark','is-frosted-glass'])local.classList.toggle(flag,template.classList.contains(flag));
    }
    if (changed) {
      applyProductArt('keyboard');
      applyProductArt('razer');
      if (lastRazerStatus) updateRazerStatus(lastRazerStatus);
      if(lastChargerStatus)updateChargerStatus(lastChargerStatus);
      requestChargerStatus();
      requestRazerStatus();requestDevices();for(const [kind,status] of deviceStates)updateDeviceStatus(kind,status);
      if (!productUrls.has(selectedColors.keyboard) || !productUrls.has(selectedColors.razer)) requestProductArt();
    }
    return true;
  }

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      ensure();
    });
  }

  const state = { version: 2, ensure, schedule };
  window.__driveCenterNativeCards = state;
  installProductStyles();
  window.addEventListener('message', event => {
    if (event.source !== window.parent) return;
    const data = event.data;
    if (!data || data.source !== 'drivecenter') return;
    if (data.type === 'razer-status') updateRazerStatus(data.status);
    if(data.type==='charger-status')updateChargerStatus(data.status);
    if(data.type==='device-status')updateDeviceStatus(data.kind,data.status);
    if (data.type === 'product-art') acceptProductArt(data);
  });
  if (!window.__dcColorPopoverOutside) {
    window.__dcColorPopoverOutside = true;
    document.addEventListener('click', event => {
      if (!event.target?.closest?.('.dc-color-popover, .device-card-switch button')) closeColorPopovers();
    }, true);
  }
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  new MutationObserver(records=>{if(records.some(record=>record.target.matches('.device-list,.device-card:not([data-dc-local])')))schedule();}).observe(document.documentElement,{attributes:true,attributeFilter:['class'],subtree:true});
  ensure();
  setTimeout(requestProductArt, 1200);
  setTimeout(requestRazerStatus, 1800);
  setTimeout(requestProductArt, 4500);
  setTimeout(requestRazerStatus, 5000);
  setInterval(requestRazerStatus, 30000);
  setInterval(requestChargerStatus,5000);
  setInterval(()=>{if(!productUrls.has('cuktech-10-ultra'))requestProductArt();},15000);
  return { installed: true, version: 2, ensured: ensure() };
})();
