'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFile}=require('node:child_process');
function loadCatalog(file=path.join(__dirname,'../catalog/razer-mice.json')){return JSON.parse(fs.readFileSync(file,'utf8'));}
function createRazerService({payloadRoot,stateRoot,run,timeout=30000}={}){
 if(!path.isAbsolute(payloadRoot||'')||!path.isAbsolute(stateRoot||''))throw TypeError('payloadRoot and stateRoot are required');
 const python=path.join(payloadRoot,'python','python.exe'),script=path.join(__dirname,'razer-multi_backend.py');let queue=Promise.resolve(),closed=false,child=null;
 const transport=run||((request)=>new Promise((resolve,reject)=>{child=execFile(python,['-I','-B',script,'--payload',payloadRoot,'--state',stateRoot],{windowsHide:true,timeout,maxBuffer:4*1024*1024,encoding:'utf8'},(error,stdout)=>{child=null;if(error)return reject(Error('鼠标模块读取失败：'+error.message));try{const reply=JSON.parse(stdout);if(reply.ok===false)throw Error(reply.error);resolve(reply);}catch(error){reject(error);}});child.stdin.end(JSON.stringify(request));}));
 function enqueue(request){if(closed)return Promise.reject(Error('鼠标模块已关闭'));const job=queue.catch(()=>{}).then(()=>{if(closed)throw Error('鼠标模块已关闭');return transport(request);});queue=job;return job;}
 function identity(id){if(typeof id!=='string'||!/^razer-1532-[a-f0-9]{4}-[a-f0-9]{20}$/.test(id))throw Error('请选择实际连接的雷蛇鼠标');return id;}
 return Object.freeze({listModels:()=>loadCatalog().models,scan:()=>enqueue({action:'scan'}),status:id=>enqueue({action:'status',deviceId:identity(id)}),execute:({deviceId,command,value})=>{if(!['dpi.set','pollRate.set','dpiStage.set','idleTime.set','brightness.set'].includes(command))return Promise.reject(Error('未开放的鼠标操作'));return enqueue({action:'execute',deviceId:identity(deviceId),command,value});},close(){closed=true;child?.kill();return queue.catch(()=>{});}});
}
module.exports={loadCatalog,createRazerService};
