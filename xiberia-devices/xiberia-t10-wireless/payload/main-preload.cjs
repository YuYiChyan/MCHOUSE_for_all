'use strict';
const {contextBridge,ipcRenderer}=require('electron');
let allowed=false;
try {
  const u=new URL(location.href);
  allowed=(u.protocol==='mchose-renderer:' && u.hostname==='app' && u.pathname.startsWith('/cdn.mchose.com.cn/customPage/prod/')) ||
    (u.protocol==='https:' && ['www.mchose.com.cn','mchose.com.cn','cdn.mchose.com.cn'].includes(u.hostname));
} catch {}
if(allowed){
  contextBridge.exposeInMainWorld('driveCenterLab',{
    open:(kind,color)=>ipcRenderer.invoke('dc-lab:open',kind,color),
    closeEmbedded:()=>ipcRenderer.invoke('dc-lab:close-embedded'),
    deviceCardStatus:id=>ipcRenderer.invoke('dc-device:card-status',id),
    onDeviceColor:callback=>{
      const listener=(_event,state)=>callback(state);ipcRenderer.on('dc-lab:device-color',listener);
      return ()=>ipcRenderer.removeListener('dc-lab:device-color',listener);
    },
    razerCardStatus:()=>ipcRenderer.invoke('dc-lab:razer-card-status'),
    productArt:kind=>ipcRenderer.invoke('dc-lab:product-art',kind),
    razerSetDpiStage:stage=>ipcRenderer.invoke('dc-lab:razer-set-dpi-stage',stage),
    onEmbeddedState:callback=>{
      const listener=(_event,state)=>callback(state);
      ipcRenderer.on('dc-lab:embedded-state',listener);
      return ()=>ipcRenderer.removeListener('dc-lab:embedded-state',listener);
    }
  });
  contextBridge.exposeInMainWorld('driveCenterCharger',{status:()=>ipcRenderer.invoke('dc-lab:charger-card-status')});
}
