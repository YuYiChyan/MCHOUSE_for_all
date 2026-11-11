/* SPDX-License-Identifier: MIT */
'use strict';
const path=require('node:path');
const {execFile}=require('node:child_process');
const {randomBytes}=require('node:crypto');
const {createAppearanceStore}=require('./appearance-store.cjs');
const {viaEligibility}=require('./via-eligibility.cjs');

function createKeyboardService({python,run,profileDirectory,viaCatalog}={}){
  const store=profileDirectory?createAppearanceStore(profileDirectory):null;
  const sessionSalt=store?.salt||randomBytes(32).toString('hex');
  let knownIds=new Set();
  let active=null,pending=null,closed=false;
  const execute=run||(()=>new Promise((resolve,reject)=>{
    if(!python){reject(Error('缺少随包 Python 运行时'));return;}
    const child=execFile(python,['-I','-B',path.join(__dirname,'windows_keyboard.py'),'--status'],
      {windowsHide:true,timeout:10000,maxBuffer:512*1024,encoding:'utf8',env:{...process.env,ONE4ALL_HID_SESSION_SALT:sessionSalt}},
      (error,stdout)=>{
        if(active===child)active=null;
        if(error){reject(Error('HID 设备信息读取失败，请重新扫描'));return;}
        try{const reply=JSON.parse(stdout);if(!reply.ok)throw Error(reply.error);resolve(reply.state);}catch(error){reject(error);}
      });
    active=child;
  }));
  return Object.freeze({
    status(){
      if(closed)return Promise.reject(Error('Keyboard service is closed'));
      if(!pending)pending=Promise.resolve().then(()=>{if(closed)throw Error('Keyboard service is closed');return execute();}).then(state=>{
        if(closed)throw Error('Keyboard service is closed');
        knownIds=new Set(state.devices.map(d=>d.id));
        return store||viaCatalog?{...state,devices:state.devices.map(d=>({...d,...(store?{appearance:store.get(d.id)}:{}),...(viaCatalog?{via:viaEligibility(d,state.devices,viaCatalog)}:{})}))}:state;
      }).finally(()=>{pending=null;});
      return pending;
    },
    saveAppearance({deviceId,...appearance}={}){
      if(closed)return Promise.reject(Error('Keyboard service is closed'));
      if(!store)return Promise.reject(Error('尚未配置本机外观存储'));
      if(!knownIds.has(deviceId))return Promise.reject(Error('请先扫描并选择设备'));
      try{return Promise.resolve(store.set(deviceId,appearance));}catch(error){return Promise.reject(error);}
    },
    async close(){closed=true;active?.kill();if(pending)await pending.catch(()=>{});},
  });
}
module.exports={createKeyboardService};
