'use strict';
const UI=window.One4AllUI;
const page=UI.shell({title:'控件开发预览',status:'未连接设备 · 示例页面',onBack:()=>{}});
document.body.append(page.root);
let selected=500;
function render(){
  page.content.replaceChildren();
  const panel=UI.card('分段选项');
  panel.append(UI.row('当前示例值',selected+' Hz'),UI.segmented([125,500,1000],selected,value=>value+' Hz',value=>{selected=value;render();}));
  const info=UI.card('设备状态');
  info.append(UI.row('连接状态','未连接'),UI.row('实时读数','—'),UI.row('用途','验证布局、控件和亮暗主题'));
  page.content.append(panel,info);
}
page.nav.append(UI.navButton({id:'preview',label:'控件预览',active:true,onSelect:render}),UI.navButton({id:'theme',label:'切换亮暗主题',onSelect:()=>UI.setTheme(document.documentElement.dataset.dcTheme==='light'?'dark':'light')}));
const tab=UI.node('button','dc-tab active','控件预览');tab.type='button';tab.setAttribute('role','tab');page.tabs.append(tab);
render();
