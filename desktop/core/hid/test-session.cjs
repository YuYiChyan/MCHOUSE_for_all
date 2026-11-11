/* Explicit foreground test session; owns at most one Windows-key guard. MIT. */
'use strict';
const {spawn}=require('node:child_process'),path=require('node:path'),{createInterface}=require('node:readline');
function createTestSession({python,ownerPid=process.pid,spawnChild=spawn}={}){
  let child=null,pending=null,active=false,callbacks=null;
  function stop(){active=false;const current=child;child=null;current?.kill();}
  function start({onKey,onStopped}={}){
    if(active)return Promise.resolve({active:true});
    if(pending)return pending;
    callbacks={onKey,onStopped};
    pending=new Promise((resolve,reject)=>{
      const proc=spawnChild(python,['-I','-B',path.join(__dirname,'windows_test_keys.py'),'--owner-pid',String(ownerPid)],{windowsHide:true,stdio:['ignore','pipe','ignore']});
      child=proc;let settled=false,reason='stopped';
      const finish=(error)=>{if(!settled){settled=true;clearTimeout(timer);error?reject(error):resolve({active:true,scope:'foreground-test'});}};
      const timer=setTimeout(()=>{stop();finish(Error('测试模式启动超时'));},4000);
      const lines=createInterface({input:proc.stdout});
      lines.on('line',line=>{
        let value;try{value=JSON.parse(line);}catch{return;}
        if(value.type==='ready'){if(child!==proc){finish(Error('测试已取消'));return;}active=true;finish();}
        if(value.type==='error'){finish(Error(value.message||'测试模式无法启动'));stop();}
        if(value.type==='key'&&active&&child===proc&&['MetaLeft','MetaRight'].includes(value.code))callbacks?.onKey?.({code:value.code,down:value.down===true});
        if(value.type==='stopped')reason=value.reason;
      });
      proc.once('error',error=>{if(child===proc)child=null;active=false;finish(error);lines.close();});
      proc.once('exit',()=>{const own=child===proc;if(own){child=null;active=false;}finish(Error('测试模式已停止'));lines.close();if(own)callbacks?.onStopped?.({reason});});
    }).finally(()=>{pending=null;});
    return pending;
  }
  return Object.freeze({start,stop,get active(){return active;}});
}
module.exports={createTestSession};
