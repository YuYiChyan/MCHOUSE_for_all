/* SPDX-License-Identifier: MIT */
(() => {
  const params=new URLSearchParams(location.search);
  One4AllUI.setTheme(params.get('dcTheme')==='dark'?'dark':'light');
  window.keyboardWidget=One4AllHidKeyboard.mount(document.body,{api:window.one4allKeyboard||null,onBack:()=>window.one4allKeyboard?.back?.()});
  if(window.one4allKeyboard)window.keyboardWidget.refresh();
})();
