(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory;
  else root.One4AllUI=factory(root.document);
})(typeof window==='object'?window:globalThis,function createUI(document){
  'use strict';
  function node(tag,className,text){
    const element=document.createElement(tag);
    if(className)element.className=className;
    if(text!=null)element.textContent=String(text);
    return element;
  }
  function row(label,value){
    const element=node('div','dc-row');
    element.append(node('span','dc-muted',label),node('span','',value));
    return element;
  }
  function card(title){
    const element=node('section','dc-card');
    element.append(node('h3','dc-card-title',title));
    return element;
  }
  function segmented(values,active,formatter,onSelect){
    const element=node('div','dc-segmented');
    element.setAttribute('role','group');
    for(const value of values){
      const button=node('button','dc-segment',formatter(value));
      button.type='button';
      button.classList.toggle('active',value===active);
      button.setAttribute('aria-pressed',String(value===active));
      button.addEventListener('click',()=>onSelect(value));
      element.append(button);
    }
    // The caller renders the confirmed value after the backend acknowledges a change.
    return element;
  }
  function navButton({id,label,icon,active=false,onSelect}){
    const button=node('button','dc-nav-item');
    button.type='button';button.dataset.category=id;
    if(icon){const glyph=node('i','dc-nav-icon iconfont '+icon);glyph.setAttribute('aria-hidden','true');button.append(glyph);}
    button.append(node('span','dc-nav-label',label));
    button.classList.toggle('active',active);
    if(active)button.setAttribute('aria-current','page');
    button.addEventListener('click',()=>onSelect(id));
    return button;
  }
  function shell({title,status='未连接',onBack=()=>{}}){
    const root=node('div','dc-page');
    const header=node('header','dc-official-header');
    const back=node('button','dc-back-home','← 返回主页');back.type='button';back.addEventListener('click',onBack);header.append(back);
    const main=node('div','dc-main'),sidebar=node('aside','dc-sidebar'),sidebarHeader=node('header','dc-sidebar-header');
    const statusNode=node('div','dc-sidebar-meta',status);
    sidebarHeader.append(node('div','dc-sidebar-name',title),statusNode);
    const nav=node('nav','dc-nav');nav.setAttribute('aria-label','设备设置');sidebar.append(sidebarHeader,nav);
    const right=node('main','dc-right'),tabs=node('div','dc-menu'),panel=node('section','dc-panel'),content=node('div','dc-config');
    tabs.setAttribute('role','tablist');panel.append(content);right.append(tabs,panel);main.append(sidebar,right);root.append(header,main);
    return {root,nav,tabs,content,status:statusNode,back};
  }
  function setTheme(theme){
    if(!['dark','light'].includes(theme))throw new TypeError('Theme must be dark or light');
    document.documentElement.dataset.dcTheme=theme;
    document.documentElement.setAttribute('theme-mode',theme);
  }
  return Object.freeze({node,row,card,segmented,navButton,shell,setTheme});
});
