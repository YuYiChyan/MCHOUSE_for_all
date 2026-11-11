'use strict';
let adapter;
process.parentPort.on('message',async({data})=>{
 const {requestId,method,args}=data;
 try{
  let result;
  if(method==='init'){const mod=require(args.entry);if(typeof mod.createAdapter!=='function')throw Error('模块缺少 createAdapter');adapter=await mod.createAdapter({packageRoot:args.packageRoot,device:args.device});if(typeof adapter?.probe!=='function'||typeof adapter?.execute!=='function')throw Error('模块缺少 probe 或 execute');result=await adapter.probe();}
  else if(method==='execute'){if(!adapter)throw Error('模块未启动');result=await adapter.execute(args.command,args.payload);}
  else if(method==='close'){await adapter?.close?.();result={ok:true};}
  else throw Error('未知模块操作');
  process.parentPort.postMessage({requestId,result});
  if(method==='close')process.exit(0);
 }catch(error){process.parentPort.postMessage({requestId,error:error.message});}
});
