/* Standalone developer host; does not inject into MCHOSE. SPDX-License-Identifier: MIT. */
'use strict';
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {app,BrowserWindow,ipcMain}=require('electron');
const {createKeyboardService}=require('../hid/keyboard-service.cjs');
const {createTestSession}=require('../hid/test-session.cjs');
if(!app.requestSingleInstanceLock()){app.quit();}else{
  let win,service,testSession;
  app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});
  app.whenReady().then(()=>{
    if(!process.env.ONE4ALL_HID_PYTHON)throw Error('Set ONE4ALL_HID_PYTHON to the bundled Python executable');
    const page=pathToFileURL(path.join(__dirname,'hid-keyboard.html')).href;
    service=createKeyboardService({python:path.resolve(process.env.ONE4ALL_HID_PYTHON),profileDirectory:path.join(app.getPath('userData'),'one4all-hid-keyboard')});
    testSession=createTestSession({python:path.resolve(process.env.ONE4ALL_HID_PYTHON)});
    win=new BrowserWindow({width:1280,height:800,webPreferences:{preload:path.join(__dirname,'hid-keyboard-preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false}});
    function assertOwner(event){if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||event.senderFrame.url.split('?')[0]!==page)throw Error('Untrusted keyboard view');}
    ipcMain.handle('one4all-keyboard:status',event=>{assertOwner(event);return service.status();});
    ipcMain.handle('one4all-keyboard:appearance',(event,value)=>{assertOwner(event);return service.saveAppearance(value);});
    ipcMain.handle('one4all-keyboard:via-open',event=>{assertOwner(event);throw Error('此独立开发窗口未安装 VIA 运行包，请在 M HUB 的通用 HID 卡片中连接。');});
    ipcMain.handle('one4all-keyboard:test-start',event=>{assertOwner(event);return testSession.start({onKey:value=>win.webContents.send('one4all-keyboard:test-key',value),onStopped:value=>win.webContents.send('one4all-keyboard:test-stopped',value)});});
    ipcMain.handle('one4all-keyboard:test-stop',event=>{assertOwner(event);testSession.stop();return true;});
    win.on('blur',()=>{testSession.stop();if(!win.webContents.isDestroyed())win.webContents.send('one4all-keyboard:test-stopped',{reason:'focus-lost'});});
    win.webContents.on('before-input-event',(event,input)=>{if(testSession.active&&input.code&&['keyDown','keyUp'].includes(input.type)){event.preventDefault();win.webContents.send('one4all-keyboard:test-key',{code:input.code,down:input.type==='keyDown',ctrlKey:!!input.control,metaKey:!!input.meta,shiftKey:!!input.shift,altKey:!!input.alt});}});
    ipcMain.handle('one4all-keyboard:close',event=>{assertOwner(event);win.close();});
    win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    win.webContents.on('will-navigate',(event,url)=>{if(url.split('?')[0]!==page)event.preventDefault();});
    return win.loadURL(page);
  }).catch(error=>{console.error(error.message);app.quit();});
  app.on('window-all-closed',()=>app.quit());
  app.on('before-quit',()=>{testSession?.stop();service?.close();});
}
