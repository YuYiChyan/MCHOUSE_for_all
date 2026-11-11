/* Official, bundled VIA definitions connected to the shared keyboard controls. */
(function(root){
 'use strict';
 const brands=new Set(['keychron','monsgeek','akko','rk','redragon']);
 const aborted=()=>new DOMException('连接已取消','AbortError');
 async function connect({model,signal,prepare,hid=root.navigator?.hid}={}){
  if(!brands.has(model?.brand)||model.support?.provider!=='official-via'||!model.support.definition)throw new Error('此型号没有可用的原厂 VIA 定义');
  if(!root.One4AllVia?.connect)throw new Error('VIA 控制器未加载');
  if(!hid)throw new Error('当前环境没有可用的 WebHID');
  const definition=model.support.definition;
  const parsed=root.One4AllVia.parseDefinition(definition);
  const check=()=>{if(signal?.aborted)throw aborted();};
  const abortable=(promise,onLate=()=>{})=>new Promise((resolve,reject)=>{
   let settled=false;
   const stop=()=>{if(settled)return;settled=true;signal?.removeEventListener('abort',stop);reject(aborted());};
   signal?.addEventListener('abort',stop,{once:true});
   Promise.resolve(promise).then(value=>{if(settled){void Promise.resolve(onLate(value)).catch(()=>{});return;}settled=true;signal?.removeEventListener('abort',stop);resolve(value);},error=>{if(settled)return;settled=true;signal?.removeEventListener('abort',stop);reject(error);});
   if(signal?.aborted)stop();
  });
  check();await abortable(prepare?.());check();
  // The existing VIA transport owns wire framing and readback. This bridge owns
  // product identity, definitions, and the lifetime of a cancelled product page.
  let pendingDevice=null,session=null,closed=false;
  const cancel=()=>{if(session)void session.close().catch(()=>{});else if(pendingDevice?.opened)void pendingDevice.close().catch(()=>{});};
  signal?.addEventListener('abort',cancel,{once:true});
  const scopedHid={
   async requestDevice(options){check();const devices=await abortable(hid.requestDevice(options));check();pendingDevice=devices.length===1?devices[0]:null;return devices;},
   addEventListener:(...args)=>hid.addEventListener(...args),
   removeEventListener:(...args)=>hid.removeEventListener(...args),
  };
  try{
   session=await abortable(root.One4AllVia.connect({definition,target:{vendorId:parsed.vendorId,productId:parsed.productId},hid:scopedHid}),late=>late.close());
   check();
   const originalClose=session.close;
   const close=async()=>{if(closed)return;closed=true;signal?.removeEventListener('abort',cancel);await originalClose();};
   const execute=async(command,payload)=>{check();if(closed)throw new Error('键盘已断开，请重新连接');return session.execute(command,payload);};
   return {...session,device:{...session.device,name:model.name,interface:'VIA · USB'},execute,readKey:selection=>execute('via.keymap.read',{selection}).then(result=>result.value),close};
  }catch(error){signal?.removeEventListener('abort',cancel);if(session)await session.close().catch(()=>{});else if(pendingDevice?.opened)await pendingDevice.close().catch(()=>{});throw error;}
 }
 root.One4AllOfficialVia=Object.freeze({connect});
})(typeof window==='object'?window:globalThis);
