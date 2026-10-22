/* SPDX-License-Identifier: MIT */
'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('one4allKeyboard',Object.freeze({
  status:()=>ipcRenderer.invoke('one4all-keyboard:status'),
  saveAppearance:value=>ipcRenderer.invoke('one4all-keyboard:appearance',value),
  startTest:()=>ipcRenderer.invoke('one4all-keyboard:test-start'),
  stopTest:()=>ipcRenderer.invoke('one4all-keyboard:test-stop'),
  openVia:(id,mode='connect')=>ipcRenderer.invoke('one4all-keyboard:via-open',id,mode),
  onViaResult:callback=>{const listener=(_event,value)=>callback(value);ipcRenderer.on('one4all-keyboard:via-result',listener);return ()=>ipcRenderer.removeListener('one4all-keyboard:via-result',listener);},
  onTestKey:callback=>{const listener=(_event,value)=>callback(value);ipcRenderer.on('one4all-keyboard:test-key',listener);return ()=>ipcRenderer.removeListener('one4all-keyboard:test-key',listener);},
  onTestStopped:callback=>{const listener=(_event,value)=>callback(value);ipcRenderer.on('one4all-keyboard:test-stopped',listener);return ()=>ipcRenderer.removeListener('one4all-keyboard:test-stopped',listener);},
  back:()=>ipcRenderer.invoke('one4all-keyboard:close'),
}));
