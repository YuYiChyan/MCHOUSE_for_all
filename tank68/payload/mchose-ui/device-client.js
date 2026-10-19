(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.One4AllDeviceClient=factory();
})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  function bind(api,mapping){
    const client={};
    for(const [name,source] of Object.entries(mapping))client[name]=(...args)=>{
      if(typeof api?.[source]!=='function')return Promise.reject(new Error('当前页面没有可用的设备接口：'+name));
      return Promise.resolve().then(()=>api[source](...args));
    };
    return Object.freeze(client);
  }
  return Object.freeze({
    razer:api=>bind(api,{status:'razerStatus',setDpiStage:'razerSetDpiStage',setPollRate:'razerSetPollRate',back:'closeEmbedded'}),
    charger:api=>bind(api,{status:'status',art:'art',startQr:'startQr',checkQr:'checkQr',pair:'pair',reconnect:'reconnect',back:'back'}),
    keyboard:api=>bind(api,{back:'back',clickVendor:'clickVendor'})
  });
});
