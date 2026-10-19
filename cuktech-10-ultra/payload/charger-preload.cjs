'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('charger', {
  status: () => ipcRenderer.invoke('dc-lab:charger-status'),
  art: color => ipcRenderer.invoke('dc-lab:charger-art',color),
  startQr: () => ipcRenderer.invoke('dc-lab:charger-qr-start'),
  checkQr: () => ipcRenderer.invoke('dc-lab:charger-qr-check'),
  pair: did => ipcRenderer.invoke('dc-lab:charger-pair', did),
  reconnect: () => ipcRenderer.invoke('dc-lab:charger-reconnect'),
  back: () => ipcRenderer.invoke('dc-lab:close-embedded'),
});
