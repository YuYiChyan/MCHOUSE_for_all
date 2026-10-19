(() => {
  'use strict';
  const items = [
    ['lighting', '灯光设置', 'icon-lighting_linear'],
    ['trigger', '触发设置', 'icon-a-rapidtrigger_linear'],
    ['remap', '改键设置', 'icon-keyboard_linear'],
    ['advanced', '高级按键', 'icon-a-otherkeys_linear'],
    ['macro', '宏设置', 'icon-macro_linear'],
    ['performance', '性能设置', 'icon-setup_linear'],
    ['other', '其他设置', 'icon-setup2_linear'],
  ];
  const frame = document.getElementById('vendorFrame');
  const nav = document.getElementById('categoryNav');
  const status = document.getElementById('panelStatus');
  const error = document.getElementById('frameError');
  const allowed = new Set(items.map(item => item[0]));
  let selected = 'lighting';
  let requestId = 0;
  let loadTimer;
  let ready = false;
  let confirmed = 'lighting';
  let pendingSelection = false;

  function syncTheme() {
    if (!ready) return;
    frame.contentWindow.postMessage({source:'drivecenter-shell', type:'theme', theme:document.documentElement.dataset.dcTheme}, location.origin);
  }

  function showActive(id) {
    if (!allowed.has(id)) return;
    selected = id;
    document.getElementById('panelTitle').textContent = items.find(item => item[0] === id)[1];
    nav.querySelectorAll('button').forEach(button => {
      const active = button.dataset.section === id;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }

  function select(id) {
    if (!allowed.has(id)) return;
    showActive(id);
    if (!ready) { status.textContent = '正在连接设置页面…'; return; }
    pendingSelection = true;
    status.textContent = '';
    frame.contentWindow.postMessage({ source:'drivecenter-shell', type:'select', id, requestId:++requestId }, location.origin);
  }

  for (const [id, label, icon] of items) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dc-nav-item';
    button.dataset.section = id;
    button.innerHTML = `<i class="dc-nav-icon iconfont ${icon}" aria-hidden="true"></i><span class="dc-nav-label">${label}</span>`;
    button.addEventListener('click', () => select(id));
    nav.append(button);
  }

  function load() {
    ready = false;
    error.hidden = true;
    status.textContent = '正在连接设置页面…';
    clearTimeout(loadTimer);
    const url = new URL('vendor.html', location.href);
    // Reuse the original device route and query so WebHID and saved settings stay with the vendor app.
    url.search = location.search;
    url.hash = location.hash || '#/?productId=32837&vendorId=3141&productName=Tank68%20HE';
    frame.src = url.href;
    loadTimer = setTimeout(() => { if (!ready) { error.hidden = false; status.textContent = ''; } }, 20000);
  }

  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== frame.contentWindow || event.data?.source !== 'drivecenter-vendor') return;
    const message = event.data;
    if (message.type === 'ready') {
      ready = true;
      clearTimeout(loadTimer);
      error.hidden = true;
      syncTheme();
      select(selected);
    } else if (message.type === 'selected' && message.requestId === requestId) {
      pendingSelection = false;
      confirmed = message.id;
      showActive(message.id);
      status.textContent = '';
    } else if (message.type === 'selection-error' && message.requestId === requestId) {
      pendingSelection = false;
      showActive(confirmed);
      status.textContent = '页面切换未完成，请重试';
    } else if (message.type === 'state' && message.id && ready && !pendingSelection) {
      confirmed = message.id;
      showActive(message.id);
    } else if (message.type === 'theme-applied') {
      frame.dataset.theme = message.theme;
    }
  });
  window.addEventListener('drivecenter:theme', syncTheme);
  document.getElementById('backHome').addEventListener('click', () => window.driveCenterPage?.back());
  document.getElementById('retryFrame').addEventListener('click', load);
  showActive(selected);
  load();
})();
