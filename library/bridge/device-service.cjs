'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {execFile}=require('node:child_process');
const {createAdapter}=require('./adapter.cjs');
const specifications=Object.freeze({
  g309:{backend:'g309_backend.py',deps:'g309-deps',commands:['setDpi','setReportRate','setHostMode']},
  blackshark:{backend:'blackshark_backend.py',deps:'blackshark-deps',commands:['setOutputVolume','setInputVolume','setOutputMute','setInputMute','setEq']},
});
function validate(id,command,value){
  if(id==='g309'){
    if(command==='setHostMode'){if(typeof value!=='boolean')throw Error('模式状态须为布尔值');return;}
    if(!Number.isInteger(value)||value<1||value>65535)throw Error('请输入有效整数');
    if(command==='setReportRate'&&![125,250,500,1000].includes(value))throw Error('不支持的回报率');
  }else if(command==='setEq'){
    if(typeof value?.enabled!=='boolean'||!Array.isArray(value.gains)||value.gains.length!==10||value.gains.some(v=>!Number.isFinite(v)||v< -12||v>12))throw Error('EQ 需要十段 -12 至 +12 dB 的有效增益');
  }else if(command.endsWith('Mute')){
    if(typeof value!=='boolean')throw Error('静音状态须为布尔值');
  }else if(!Number.isFinite(value)||value<0||value>100)throw Error('音量范围为 0–100');
}
function createService(id,base,{run,dataRoot=path.join(base,'..','data',id)}={}){
  if(fs.existsSync(path.join(base,'xiberia-runtime','catalog.json'))&&require('./xiberia-runtime/catalog.json').some(model=>model.id===id))return require('./xiberia-runtime/service.cjs').createService(base,{id});
  const spec=specifications[id];if(!spec)throw Error('Unknown device');
  const execute=run||((command,value)=>new Promise((resolve,reject)=>{
    const config=JSON.parse(fs.readFileSync(path.join(base,'lab-config.json'),'utf8'));
    const bootstrap='import sys,os;sys.path[:0]=[sys.argv[1],os.path.dirname(sys.argv[2])];import runpy;runpy.run_path(sys.argv[2],run_name="__main__")';
    const child=execFile(config.python,['-I','-B','-c',bootstrap,path.join(base,spec.deps),path.join(base,spec.backend)],
      {cwd:base,env:{...process.env,ONE4ALL_DEVICE_DATA:dataRoot},windowsHide:true,timeout:25000,maxBuffer:1024*1024,encoding:'utf8'},(error,stdout)=>{
        if(error){reject(Error('设备进程未响应；请检查连接和运行环境'));return;}
        try{const reply=JSON.parse(stdout);if(!reply.ok)throw Error(reply.error||'设备操作失败');resolve(reply.state);}catch(error){reject(error);}
      });
    child.stdin.on('error',()=>{});
    child.stdin.end(JSON.stringify({command,value}));
  }));
  let cached=null;let pendingRead=null;
  const adapter=createAdapter({id:'one4all-'+id,status:async()=>{cached=await execute('status');return cached;},
    commands:Object.fromEntries(spec.commands.map(command=>[command,async value=>{
      validate(id,command,value);cached=null;cached=await execute(command,value);return cached;
    }]))});
  return Object.freeze({
    status:()=>{
      if(cached&&Date.now()-(cached.sampledAt||0)<1500)return Promise.resolve(cached);
      if(!pendingRead)pendingRead=adapter.status().catch(error=>{cached=null;throw error;}).finally(()=>{pendingRead=null;});
      return pendingRead;
    },
    invoke:(command,value)=>adapter.invoke(command,value),close:()=>adapter.close(),
  });
}
module.exports={createService,validate,specifications};
