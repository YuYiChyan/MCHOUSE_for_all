'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const file=decodeURIComponent(new URL(location.href).pathname).split('/').pop();
const id=file==='g309.html'?'g309':file==='blackshark.html'?'blackshark':null;
if(id){
  const methods=id==='g309'?['setDpi','setReportRate','setHostMode']:['setOutputVolume','setInputVolume','setOutputMute','setInputMute','setEq'];
  contextBridge.exposeInMainWorld('one4allDevice',Object.freeze({
    status:()=>ipcRenderer.invoke('dc-device:status',id),
    setColor:color=>ipcRenderer.invoke('dc-device:set-color',id,color),
    ...Object.fromEntries(methods.map(command=>[command,value=>ipcRenderer.invoke('dc-device:'+command,id,value)])),
    back:()=>ipcRenderer.invoke('dc-lab:close-embedded'),
  }));
}
