(() => {
  const barId = 'drivecenter-embedded-bar';
  let bar = document.getElementById(barId);
  if (!bar) {
    bar = document.createElement('div');
    bar.id = barId;
    bar.style.cssText = [
      'position:fixed',
      'inset:0 0 auto 0',
      'height:48px',
      'z-index:2147483647',
      'display:none',
      'align-items:center',
      'gap:12px',
      'padding:0 16px',
      'background:#171a20',
      'color:#edf2f7',
      'border-bottom:1px solid #343d49',
      'font:14px system-ui,sans-serif',
      'box-sizing:border-box',
    ].join(';');
    const back = document.createElement('button');
    back.type = 'button';
    back.title = '返回设备首页';
    back.setAttribute('aria-label', '返回设备首页');
    back.textContent = '←';
    back.style.cssText = [
      'width:32px',
      'height:32px',
      'border:0',
      'border-radius:8px',
      'background:#262e39',
      'color:#edf2f7',
      'font-size:20px',
      'line-height:32px',
      'cursor:pointer',
    ].join(';');
    back.onclick = () => window.driveCenterLab?.closeEmbedded();
    const title = document.createElement('span');
    title.id = 'drivecenter-embedded-title';
    title.style.cssText = 'font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    bar.append(back, title);
    document.documentElement.appendChild(bar);
  }

  function applyBarTheme(theme) {
    const light = theme !== 'dark';
    bar.style.background = light ? '#ffffff' : '#171a20';
    bar.style.color = light ? '#151515' : '#edf2f7';
    bar.style.borderBottom = `1px solid ${light ? '#d7dee3' : '#343d49'}`;
    const back = bar.querySelector('button');
    if (back) {
      back.style.background = light ? '#f2f3f7' : '#262e39';
      back.style.color = light ? '#151515' : '#edf2f7';
    }
  }

  function postToVendor(payload) {
    const frame = [...document.querySelectorAll('iframe')].find(item => item.src.includes('www.mchose.com.cn'));
    frame?.contentWindow?.postMessage(payload, 'https://www.mchose.com.cn');
  }

  let razerRequest = null;
  function requestRazerCardStatus() {
    if (razerRequest) return razerRequest;
    razerRequest = (async () => {
      let status = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        status = await window.driveCenterLab.razerCardStatus();
        if (status?.ok !== false) break;
        await new Promise(resolve => setTimeout(resolve, 800));
      }
      postToVendor({ source: 'drivecenter', type: 'razer-status', status });
    })()
      .catch(() => {})
      .finally(() => { razerRequest = null; });
    return razerRequest;
  }

  const productArtCache = new Map();
  async function requestProductArt(kinds) {
    const allowed = new Set(['tank68-purple', 'tank68-black', 'razer-black', 'razer-white','cuktech-10-ultra','cuktech-10-ultra-black','g309','blackshark']);
    const list = (Array.isArray(kinds) ? kinds : [...allowed]).filter(kind => allowed.has(kind));
    await Promise.all(list.map(async kind => {
      try {
        let art = productArtCache.get(kind);
        if (!art) {
          art = await window.driveCenterLab.productArt(kind);
          productArtCache.set(kind, art);
        }
        postToVendor({ source: 'drivecenter', type: 'product-art', ...art });
      } catch {}
    }));
  }

  if (!window.__driveCenterTopBridge) {
    window.__driveCenterTopBridge = true;
    window.addEventListener('message', event => {
      if (event.origin !== 'https://www.mchose.com.cn') return;
      const frame = [...document.querySelectorAll('iframe')].find(item => item.src.includes('www.mchose.com.cn'));
      if (frame && event.source !== frame.contentWindow) return;
      const data = event.data;
      if (!data || data.source !== 'drivecenter') return;
      if (data.type === 'razer-status-request') {
        requestRazerCardStatus();
        return;
      }
      if(data.type==='device-status-request'&&['g309','blackshark'].includes(data.kind)){
        window.driveCenterLab?.deviceCardStatus(data.kind).then(status=>postToVendor({source:'drivecenter',type:'device-status',kind:data.kind,status})).catch(()=>postToVendor({source:'drivecenter',type:'device-status',kind:data.kind,status:{connected:false}}));return;
      }
      if(data.type==='charger-status-request') {
        window.driveCenterCharger?.status().then(status=>postToVendor({source:'drivecenter',type:'charger-status',status})).catch(()=>postToVendor({source:'drivecenter',type:'charger-status',status:{error:true}}));
        return;
      }
      if (data.type === 'product-art-request') {
        requestProductArt(data.kinds);
        return;
      }
      if (data.type !== 'open') return;
      if (!['keyboard','razer','charger','g309','blackshark'].includes(data.kind)) return;
      window.driveCenterLab?.open(data.kind, data.color).catch(error => {
        const title = document.getElementById('drivecenter-embedded-title');
        if (title) title.textContent = `打开失败：${error.message}`;
      });
    });
  }

  if (window.driveCenterLab?.onEmbeddedState && !window.__driveCenterStateBound) {
    window.__driveCenterStateBound = true;
    window.driveCenterLab.onEmbeddedState(state => {
      const title = document.getElementById('drivecenter-embedded-title');
      if (title) title.textContent = state.title || '';
      applyBarTheme(state.theme);
      bar.style.display = state.open && !state.nativeHeader ? 'flex' : 'none';
    });
  }

  return { bar: true, bridge: !!window.driveCenterLab };
})();
