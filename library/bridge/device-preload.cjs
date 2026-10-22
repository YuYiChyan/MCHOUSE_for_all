'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const file=decodeURIComponent(new URL(location.href).pathname).split('/').pop();
// Generated pages and host independently validate this fixed catalogue allowlist.
const xiberiaIds=["xiberia-t10", "xiberia-t10g", "xiberia-t10-wireless", "k03s", "xiberia-k03-wired", "xiberia-k06s", "xiberia-t7", "xiberia-t7-gt", "xiberia-s21", "xiberia-w30"];
const candidate=file.replace(/\.html$/,'');
const id=file==='g309.html'?'g309':file==='blackshark.html'?'blackshark':xiberiaIds.includes(candidate)?candidate:null;
if(id){
  const methods=id==='g309'?['setDpi','setReportRate','setHostMode']:xiberiaIds.includes(id)?['setOutputVolume','setInputVolume','setOutputMute','setInputMute','setEq','setPreset','setSurround','setBassBoost','setVoiceClarity','setSmartVolume','openOfficialApp']:['setOutputVolume','setInputVolume','setOutputMute','setInputMute','setEq'];
  contextBridge.exposeInMainWorld('one4allDevice',Object.freeze({
    status:()=>ipcRenderer.invoke('dc-device:status',id),
    setColor:color=>ipcRenderer.invoke('dc-device:set-color',id,color),
    ...Object.fromEntries(methods.map(command=>[command,value=>ipcRenderer.invoke('dc-device:'+command,id,value)])),
    back:()=>ipcRenderer.invoke('dc-lab:close-embedded'),
  }));
}
