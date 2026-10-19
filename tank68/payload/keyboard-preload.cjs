'use strict';
try {
  const { contextBridge, ipcRenderer, webFrame } = require('electron');
  contextBridge.exposeInMainWorld('driveCenterPage', {
    back: () => ipcRenderer.invoke('dc-lab:close-embedded'),
    clickVendor: label => ipcRenderer.invoke('dc-lab:tank-click-vendor', label),
  });
  webFrame.executeJavaScript(`
    try {
      window.close = () => { console.log('drivecenter:blocked-window-close'); };
    } catch (error) {}
  `);
} catch (error) {
  console.error('drivecenter keyboard preload', error);
}
