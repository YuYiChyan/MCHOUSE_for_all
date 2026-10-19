(() => {
  'use strict';
  const labels = {
    lighting:'灯光设置', trigger:'触发设置', remap:'改键设置', advanced:'高级按键',
    macro:'宏设置', performance:'性能设置', other:'其它设置',
  };
  const entries = () => [...document.querySelectorAll('.device-left-my-list-item')];
  const active = () => {
    const label = entries().find(node => node.classList.contains('active'))?.textContent.trim();
    return Object.keys(labels).find(id => labels[id] === label) || null;
  };
  const send = (type, extra = {}) => parent.postMessage({source:'drivecenter-vendor', type, ...extra}, location.origin);
  const nextUpdate = () => new Promise(resolve => {
    const component = document.querySelector('.device')?.__vue__;
    if (component?.$nextTick) component.$nextTick(resolve);
    else queueMicrotask(resolve);
  });
  let lastActive;
  let ready = false;
  let revision = 0;

  async function applyNativeTheme(theme) {
    const value = theme === 'dark' ? 0 : 1;
    const store = document.querySelector('.home')?.__vue__?.$store;
    if (!store?._actions?.addTheme) return;
    // This is the same storage value and Vuex action as Settings > Interface > Appearance.
    localStorage.setItem('theme', String(value));
    document.documentElement.style.colorScheme = theme;
    await store.dispatch('addTheme', value);
    await nextUpdate();
    send('theme-applied', {theme:value === 0 ? 'dark' : 'light'});
  }

  window.addEventListener('message', async event => {
    if (event.source !== parent || event.origin !== location.origin || event.data?.source !== 'drivecenter-shell') return;
    const { type, id, requestId } = event.data;
    if (type === 'theme' && ['light','dark'].includes(event.data.theme)) {
      await applyNativeTheme(event.data.theme);
      return;
    }
    if (type !== 'select' || !Object.hasOwn(labels, id)) return;
    const currentRevision = ++revision;
    const node = entries().find(item => item.textContent.trim() === labels[id]);
    if (!node) { send('selection-error', {id, requestId}); return; }
    // Call the original Vue-bound navigation element; no copied panels, hardware protocol, or synthetic settings.
    node.click();
    await nextUpdate();
    if (currentRevision !== revision) return;
    if (active() === id && document.querySelector('.device-right-set')) send('selected', {id, requestId});
    else send('selection-error', {id, requestId});
  });

  const watch = setInterval(() => {
    if (!ready && entries().length === Object.keys(labels).length) { ready = true; send('ready'); }
    if (ready) {
      const id = active();
      if (id && id !== lastActive) { lastActive = id; send('state', {id}); }
    }
  }, 250);
  window.addEventListener('pagehide', () => clearInterval(watch), {once:true});
})();
