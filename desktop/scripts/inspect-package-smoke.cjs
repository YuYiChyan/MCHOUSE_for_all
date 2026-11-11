'use strict';
const path=require('node:path');
const {inspectPackage,OUTPUT_LIMIT}=require('../core/package-inspector.cjs');
const {createPackageManager}=require('../core/vendor-packages.cjs');
(async()=>{
  const manager=createPackageManager({dataRoot:path.join(process.env.LOCALAPPDATA,'One4All-Desktop')});
  for(const entry of manager.catalog()){
    const result=await inspectPackage({entry,status:manager.status(entry.id)});
    const bytes=Buffer.byteLength(JSON.stringify(result));
    if(bytes>OUTPUT_LIMIT)throw Error('Evidence exceeds model input limit');
    if(result.elapsedMs>16000)throw Error('Inspection exceeded scan budget');
    console.log(JSON.stringify({id:entry.id,bytes,elapsedMs:result.elapsedMs,sources:result.sources.map(x=>({type:x.type,filename:x.filename,executable:x.executable})),interfaces:result.interfaces.map(x=>({path:x.path,bridges:x.bridges,channels:x.channels.length})),knownBackend:result.knownBackend,limitations:result.limitations}));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
