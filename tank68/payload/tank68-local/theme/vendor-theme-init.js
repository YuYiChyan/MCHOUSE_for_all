(() => {
  'use strict';
  const theme = new URLSearchParams(location.search).get('dcTheme');
  if (theme !== 'light' && theme !== 'dark') return;
  // Seed the vendor's own persisted appearance before it creates its Vuex store.
  try { localStorage.setItem('theme', theme === 'dark' ? '0' : '1'); } catch {}
  document.documentElement.style.colorScheme = theme;
})();
