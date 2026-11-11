'use strict';
const path=require('node:path');
const BRANDS=new Set(Object.keys(require('./domestic-models.cjs').BRANDS));
const ATK_BRANDS=new Set(['atk','vxe','vgn']);
function createResourceRefresh({utilityProcess,timeoutMs=15*60000}){
 const jobs=new Map();
 function start(key,brand){
  let child,cancel;
  const promise=new Promise((resolve,reject)=>{
   let timer,settled=false;
   const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);if(error)reject(error);else resolve(result);};
   cancel=()=>{finish(Error('资源更新已停止'));child?.kill();};
   try{
    child=utilityProcess.fork(path.join(__dirname,'resource-refresh-worker.cjs'),[],{stdio:'pipe',serviceName:'One4All resource import'});
    timer=setTimeout(()=>{finish(Error('资源获取超时，请重新更新'));child.kill();},timeoutMs);
    child.stdout?.on('data',()=>{});child.stderr?.on('data',()=>{});
    child.once('message',result=>{result?.ok?finish(null,result):finish(Error(result?.error||'资源进程返回无效结果'));});
    child.once('error',error=>finish(error));
    child.once('exit',code=>finish(Error('资源进程已退出：'+code)));
    child.postMessage({brand});
   }catch(error){finish(error);child?.kill();}
  }).finally(()=>jobs.delete(key));
  const job={promise,cancel};jobs.set(key,job);return job;
 }
 return {
  run(brand){
   if(!BRANDS.has(brand))return Promise.reject(Error('未知品牌'));
   const key=ATK_BRANDS.has(brand)?'atk-family':brand,job=jobs.get(key)||start(key,brand);
   return job.promise.then(result=>({...result,brand,count:result.counts?.[brand]??result.count??0}));
  },
  close(){for(const job of jobs.values())job.cancel();}
 };
}
module.exports={createResourceRefresh};
