'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const payload=process.argv[2]||path.join(process.env.APPDATA,'One4All-Desktop/modules/imported');
const python=path.join(payload,'python/python.exe');
const reply=JSON.parse(execFileSync(python,['-I','-B',path.join(__dirname,'../core/razer-multi_backend.py'),'--payload',payload,'--state',path.join(process.env.LOCALAPPDATA,'One4All-Desktop/analysis/razer-models')],{input:JSON.stringify({action:'catalog'}),encoding:'utf8',maxBuffer:4*1024*1024,windowsHide:true}));
if(reply.ok===false)throw Error(reply.error);
const destination=path.join(__dirname,'../catalog/razer-mice.json');fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,JSON.stringify(reply,null,2));
console.log(JSON.stringify({file:destination,models:reply.models.length,withImages:reply.models.filter(m=>m.imageUrl).length,source:reply.source}));
