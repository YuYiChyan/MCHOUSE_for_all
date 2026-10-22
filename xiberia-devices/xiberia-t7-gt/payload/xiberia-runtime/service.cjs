'use strict';
// SPDX-License-Identifier: MIT
const fs=require('node:fs');
const path=require('node:path');
const {spawn,execFile}=require('node:child_process');
const {createInterface}=require('node:readline');
const models=require('./catalog.json');
const commands=Object.freeze(['setOutputVolume','setInputVolume','setOutputMute','setInputMute','setEq','setPreset','setSurround','setBassBoost','setVoiceClarity','setSmartVolume','openOfficialApp']);
const coreCommands=new Set(commands.slice(0,4));
const presets=new Set(['Movie','Gaming','Music','Voice','Balanced','Shooter','Racing','Roleplay','Customize']);
function validate(command,value){
  if(!commands.includes(command))throw Error('未知耳机操作');
  if(command==='openOfficialApp')return;
  if(command==='setPreset'){if(!presets.has(value))throw Error('音效预设无效');return;}
  if(command==='setEq'){
    if(typeof value?.enabled!=='boolean'||!Array.isArray(value.gains)||value.gains.length<1||value.gains.length>32||value.gains.some(v=>!Number.isFinite(v)||v< -12||v>12))throw Error('均衡器参数无效');return;
  }
  if(command.endsWith('Volume')){if(!Number.isFinite(value)||value<0||value>100)throw Error('音量范围为 0–100');return;}
  if(typeof value!=='boolean')throw Error('开关值无效');
}
function createNative(base,{spawnProcess=spawn}={}){
  let child=null,reader=null,pending=null,idle=null;
  function close(){
    clearTimeout(idle);idle=null;
    const current=child;child=null;reader?.close();reader=null;
    if(pending){clearTimeout(pending.timer);pending.reject(Error('耳机音效进程已退出'));pending=null;}
    current?.kill();
  }
  function start(){
    if(child)return;
    const root=path.join(base,'xiberia-runtime');
    child=spawnProcess(path.join(root,'XiberiaBridge.exe'),[path.join(root,'official')],{cwd:root,windowsHide:true,stdio:['pipe','pipe','ignore']});
    const current=child;
    reader=createInterface({input:child.stdout});
    reader.on('line',line=>{
      if(current!==child||!pending)return;
      let result;try{result=JSON.parse(line);}catch{return;}
      const request=pending;pending=null;clearTimeout(request.timer);
      if(result.ok)request.resolve(result.state);else request.reject(Error(result.error||'耳机音效读取失败'));
    });
    child.on('error',()=>{if(current===child)close();});
    child.on('exit',()=>{if(current===child)close();});
    child.stdin.on('error',()=>{if(current===child)close();});
  }
  function request(command,value,endpoint){
    if(pending)return Promise.reject(Error('耳机音效进程忙碌'));
    clearTimeout(idle);
    return new Promise((resolve,reject)=>{
      try{
        start();
        const timer=setTimeout(()=>close(),12000);
        pending={resolve,reject,timer};
        child.stdin.write(JSON.stringify({command,value,endpoint})+'\n');
      }catch(error){reject(error);close();}
    }).finally(()=>{idle=setTimeout(close,60000);idle.unref?.();});
  }
  return {request,close};
}
function createCore(base,id='k03s'){
  return (command,value)=>new Promise((resolve,reject)=>{
    const config=JSON.parse(fs.readFileSync(path.join(base,'lab-config.json'),'utf8'));
    const root=path.join(base,'xiberia-runtime');
    const bootstrap='import sys,runpy;sys.path.insert(0,sys.argv[1]);runpy.run_path(sys.argv[2],run_name="__main__")';
    const child=execFile(config.python,['-I','-B','-c',bootstrap,path.join(base,'xiberia-audio-deps'),path.join(root,'audio_backend.py')],{cwd:root,env:{...process.env,ONE4ALL_XIBERIA_ID:id},windowsHide:true,timeout:12000,maxBuffer:256*1024,encoding:'utf8'},(error,stdout)=>{
      if(error){reject(Error('耳机读取超时，请重新连接'));return;}
      try{const reply=JSON.parse(stdout);if(!reply.ok)throw Error(reply.error);resolve(reply.state);}catch(error){reject(error);}
    });
    child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({command,value}));
  });
}
function scanConnected(base){return createCore(base)('inventory');}
function createService(base,{id='k03s',runCore,native=createNative(base),now=Date.now}={}){
  if(!models.some(model=>model.id===id))throw Error('未知西伯利亚型号');
  const execute=runCore||createCore(base,id);
  let queue=Promise.resolve(),closed=false,lastNativeErrorAt=0;
  function enqueue(operation){
    if(closed)return Promise.reject(Error('耳机页面已关闭'));
    const result=queue.then(operation);queue=result.catch(()=>{});return result;
  }
  async function read(command='status',value){
    if(command==='openOfficialApp')return native.request(command);
    const state=await execute(coreCommands.has(command)?command:'status',value);
    const endpoint=state._renderEndpoint;delete state._renderEndpoint;
    if(!state.connected||state.ambiguous||!endpoint){
      native.close();
      if(command!=='status'&&!coreCommands.has(command))throw Error('请连接一台对应型号的耳机后重试');
      return state;
    }
    let effects=null;
    if(command!=='status'&&!coreCommands.has(command)){
      effects=await native.request(command,value,endpoint);lastNativeErrorAt=0;
    }else if(now()-lastNativeErrorAt>10000){
      try{effects=await native.request('status',undefined,endpoint);lastNativeErrorAt=0;}
      catch{lastNativeErrorAt=now();}
    }
    // An unavailable APO never removes normal Core Audio controls or invents values.
    state.effects=effects;state.capabilities.effects=!!effects?.ready;
    return state;
  }
  return Object.freeze({
    status:()=>enqueue(()=>read()),
    invoke:(command,value)=>{validate(command,value);return enqueue(()=>read(command,value));},
    close:()=>{closed=true;native.close();return queue;},
  });
}
module.exports={commands,validate,createNative,createService,scanConnected};
