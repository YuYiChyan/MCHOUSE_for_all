'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('driveCenterLab', {
  open: (kind, color) => ipcRenderer.invoke('dc-lab:open', kind, color),
  closeEmbedded: () => ipcRenderer.invoke('dc-lab:close-embedded'),
  razerCardStatus: () => ipcRenderer.invoke('dc-lab:razer-card-status'),
  productArt: kind => ipcRenderer.invoke('dc-lab:product-art', kind),
  razerSetDpiStage: stage => ipcRenderer.invoke('dc-lab:razer-set-dpi-stage', stage),
  onEmbeddedState: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('dc-lab:embedded-state', listener);
    return () => ipcRenderer.removeListener('dc-lab:embedded-state', listener);
  },
  razerStatus: () => ipcRenderer.invoke('dc-lab:razer-status'),
  razerSetPollRate: rate => ipcRenderer.invoke('dc-lab:razer-set-poll-rate', rate)
});
