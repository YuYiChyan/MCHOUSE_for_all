'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFile}=require('node:child_process');
const legacy=require('./xiberia/service.cjs');
const PROVIDER='xiberia-xhub',VERSION='xhub-native-0.3.0.6-coreaudio-1';
const sourceRoot=path.join(__dirname,'xiberia');
function loadCatalog(){return require('../catalog/xiberia-headsets.json');}
function getXiberiaSupport(model){const entry=loadCatalog().models.find(item=>item.id===model.id);return entry?{...entry.support,capabilities:[...entry.support.capabilities]}:null;}
function createXiberiaService({payloadRoot,stateRoot,runCore,nativeFactory,prepareBridge}={}){
 if(!path.isAbsolute(payloadRoot||'')||!path.isAbsolute(stateRoot||''))throw TypeError('payloadRoot and stateRoot are required');
 const bridgeRoot=path.join(stateRoot,'native','xiberia'),python=path.join(payloadRoot,'python','python.exe'),deps=path.join(payloadRoot,'xiberia-audio-deps');
 const services=new Map(),lifetimes=new Map(),children=new Map();let closed=false,bridgeJob=null;
 function ensureBridge(){
  if(prepareBridge)return prepareBridge();if(bridgeJob)return bridgeJob;
  const source=path.join(sourceRoot,'NativeBridge.cs'),digest=crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),executable=path.join(bridgeRoot,'XiberiaBridge.exe'),marker=path.join(bridgeRoot,'source.sha256');
  if(fs.existsSync(executable)&&fs.existsSync(marker)&&fs.readFileSync(marker,'utf8')===digest)return Promise.resolve(executable);
  fs.mkdirSync(bridgeRoot,{recursive:true});
  const compiler=path.join(process.env.WINDIR||'C:\\Windows','Microsoft.NET','Framework','v4.0.30319','csc.exe');
  bridgeJob=new Promise((resolve,reject)=>execFile(compiler,['/nologo','/target:exe','/platform:x86','/optimize+','/r:System.Web.Extensions.dll','/out:'+executable,source],{windowsHide:true,timeout:30000,maxBuffer:512*1024},error=>{
   if(error){reject(Error('无法准备音效组件，请确认 Windows 已启用 .NET Framework 4.8'));return;}fs.writeFileSync(marker,digest);resolve(executable);
  })).finally(()=>{bridgeJob=null;});return bridgeJob;
 }
 function executeCore(modelId,command,value){
  if(runCore)return runCore(modelId,command,value);
  if(!fs.existsSync(python)||!fs.existsSync(path.join(deps,'pycaw')))return Promise.reject(Error('音频基础组件缺失，请更新 One4All 设备模块'));
  const bootstrap='import sys,runpy;sys.path.insert(0,sys.argv[1]);runpy.run_path(sys.argv[2],run_name="__main__")';
  return new Promise((resolve,reject)=>{
   const child=execFile(python,['-I','-B','-c',bootstrap,deps,path.join(sourceRoot,'audio_backend.py')],{cwd:sourceRoot,env:{...process.env,ONE4ALL_XIBERIA_ID:modelId},windowsHide:true,timeout:12000,maxBuffer:256*1024,encoding:'utf8'},(error,stdout)=>{
    children.delete(child);if(error){reject(Error('耳机读取失败，请重新连接后重试'));return;}
    try{const reply=JSON.parse(stdout);if(!reply.ok)throw Error(reply.error||'耳机读取失败');resolve(reply.state);}catch(error){reject(error);}
   });
   children.set(child,modelId);child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({command,value}));
  });
 }
 function get(modelId){
  if(closed)throw Error('西伯利亚控制模块已关闭');
  const model=loadCatalog().models.find(item=>item.id===modelId);if(!model)throw Error('此型号不在 X HUB 已确认支持列表中');
  if(!services.has(modelId)){
   const client=nativeFactory?nativeFactory(modelId):legacy.createNative(payloadRoot,{runtimeRoot:bridgeRoot});let nativeActive=true;
   const native={request:async(...args)=>{if(!nativeFactory)await ensureBridge();if(closed||!nativeActive)throw Error('耳机页面已关闭');return client.request(...args);},close:()=>client.close()};
   lifetimes.set(modelId,()=>{nativeActive=false;client.close();});
   services.set(modelId,legacy.createService(payloadRoot,{id:modelId,runCore:(command,value)=>executeCore(modelId,command,value),native}));
  }
  return {model,service:services.get(modelId)};
 }
 function decorate(model,state){return {...state,modelId:model.id,name:model.name,brand:'xiberia',provider:PROVIDER,providerVersion:VERSION,verification:'unverified'};}
 async function closeModel(modelId){const service=services.get(modelId);lifetimes.get(modelId)?.();lifetimes.delete(modelId);services.delete(modelId);for(const [child,id]of children)if(id===modelId)child.kill();if(service)await service.close().catch(()=>{});}
 return {
  listModels:()=>loadCatalog().models,
  scan:()=>{if(closed)return Promise.reject(Error('西伯利亚控制模块已关闭'));return executeCore('k03s','inventory');},
  status:async modelId=>{const {model,service}=get(modelId);return decorate(model,await service.status());},
  execute:async({modelId,command,value}={})=>{const {model,service}=get(modelId);const state=await service.invoke(command,value);return command==='openOfficialApp'?state:decorate(model,state);},
  closeModel,
  async close(){closed=true;await Promise.all([...services.keys()].map(closeModel));for(const child of children.keys())child.kill();}
 };
}
module.exports={PROVIDER,VERSION,loadCatalog,getXiberiaSupport,createXiberiaService};
