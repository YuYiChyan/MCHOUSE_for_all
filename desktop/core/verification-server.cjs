'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

function serverAddress(value) {
  const text=String(value??'').trim();if(!text)return '';
  let url;try{url=new URL(text);}catch{throw new Error('请填写有效的验证服务器地址');}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw new Error('服务器地址应为不含凭据和查询参数的 HTTP(S) 地址');
  return url.href.replace(/\/+$/,'');
}
function textField(value,name,limit=240) {
  if(typeof value!=='string'||!value.trim()||value.length>limit||/[\u0000-\u001f\u007f]/.test(value))throw new Error(name+'格式不正确');
  return value;
}
function timestamp(value){if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))throw new Error('服务器时间格式不正确');return value;}
function featureId(value){if(typeof value!=='string'||!/^[a-zA-Z][a-zA-Z0-9._-]{0,79}$/.test(value))throw new Error('功能 ID 格式不正确');return value;}
function normalizeRecord(record,baseURL) {
  const modelId=textField(record?.modelId,'型号 ID'),providerVersion=textField(record.providerVersion,'适配器版本');
  if(!Array.isArray(record.features)||record.features.length>100)throw new Error('服务器功能状态格式不正确');
  const seen=new Set();
  const features=record.features.map(feature=>{
    const id=featureId(feature?.id);if(seen.has(id))throw new Error('服务器返回了重复功能');seen.add(id);
    if(!['unverified','reported','verified','disputed'].includes(feature.status))throw new Error('服务器返回了未知验证状态');
    const reports=feature.reports??0;if(!Number.isSafeInteger(reports)||reports<0)throw new Error('报告数量格式不正确');
    return {id,status:feature.status,reports};
  });
  return {modelId,providerVersion,features,updatedAt:timestamp(record.updatedAt),scope:'server',serverURL:baseURL};
}
function createVerificationServer({dataRoot,fetchImpl=globalThis.fetch}={}) {
  if(!dataRoot||!path.isAbsolute(dataRoot))throw new TypeError('dataRoot must be an absolute path');
  fs.mkdirSync(dataRoot,{recursive:true});
  const configFile=path.join(dataRoot,'verification-server-config.json'),stateFile=path.join(dataRoot,'verification-server-state.json');
  let baseURL='',state={serverURL:'',cursor:null,lastRefresh:null,records:[]};
  try{baseURL=serverAddress(JSON.parse(fs.readFileSync(configFile,'utf8')).baseURL);}catch{}
  try{const saved=JSON.parse(fs.readFileSync(stateFile,'utf8'));if(baseURL&&saved.serverURL===baseURL&&Array.isArray(saved.records))state={serverURL:baseURL,cursor:typeof saved.cursor==='string'?saved.cursor:null,lastRefresh:saved.lastRefresh||null,records:saved.records.map(record=>normalizeRecord(record,baseURL))};}catch{}
  const inFlight=new Map();
  function write(file,data){const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(data,null,2),{mode:0o600});fs.renameSync(temp,file);}
  function config(){return {baseURL,configured:!!baseURL,lastRefresh:state.lastRefresh,cursor:state.cursor,recordCount:state.records.length};}
  function saveConfig(input={}) {
    const next=serverAddress(input.baseURL??baseURL);
    if(next!==baseURL){const cleared={serverURL:next,cursor:null,lastRefresh:null,records:[]};write(stateFile,cleared);write(configFile,{baseURL:next});state=cleared;baseURL=next;}
    else write(configFile,{baseURL:next});
    return config();
  }
  async function request(url,options) {
    let response;try{response=await fetchImpl(url,{...options,redirect:'error',signal:AbortSignal.timeout(15000)});}catch{throw new Error('验证服务器暂时无法连接，请稍后重试');}
    if(!response.ok)throw new Error('验证服务器请求失败（HTTP '+response.status+'）');
    try{return await response.json();}catch{throw new Error('验证服务器返回的内容不是有效 JSON');}
  }
  async function refresh(input={}) {
    if(!baseURL)return {configured:false,updated:0,records:[],cursor:null,lastRefresh:null};
    const requestBase=baseURL;
    const cursor=input.cursor===undefined?state.cursor:input.cursor;
    if(cursor!==null&&(typeof cursor!=='string'||cursor.length>2048))throw new Error('验证状态游标格式不正确');
    const url=new URL(requestBase+'/v1/verifications');if(cursor)url.searchParams.set('cursor',cursor);
    const body=await request(url.href,{method:'GET',headers:{Accept:'application/json'}});
    if(!body||!Array.isArray(body.records)||body.records.length>10000||!(body.nextCursor===null||typeof body.nextCursor==='string')||typeof body.nextCursor==='string'&&body.nextCursor.length>2048)throw new Error('验证服务器返回的状态格式不正确');
    const incoming=body.records.map(record=>normalizeRecord(record,requestBase));
    const merged=new Map((cursor?state.records:[]).map(record=>[JSON.stringify([record.modelId,record.providerVersion]),record]));
    for(const record of incoming)merged.set(JSON.stringify([record.modelId,record.providerVersion]),record);
    if(baseURL!==requestBase)throw new Error('服务器地址已更改，请重新刷新');
    const next={serverURL:baseURL,cursor:body.nextCursor,lastRefresh:new Date().toISOString(),records:[...merged.values()]};
    write(stateFile,next);state=next;
    return {configured:true,updated:incoming.length,records:structuredClone(state.records),cursor:state.cursor,lastRefresh:state.lastRefresh};
  }
  function submit(input={}) {
    if(!baseURL)return Promise.reject(new Error('尚未配置验证服务器地址'));
    if(input.hardwareConfirmed!==true)return Promise.reject(new Error('请先确认已完成实机测试'));
    let report;
    try {
      if(!Array.isArray(input.features)||!input.features.length||input.features.length>100)throw new Error('请选择已测试通过的功能');
      const features=[...new Set(input.features.map(featureId))].sort();
      const notes=String(input.notes??'').slice(0,800).replace(/(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]+|\bsk-[A-Za-z0-9_-]{8,}/g,'[已隐藏凭据]').replace(/(?:api[_ -]?key|token|password|secret|序列号|serial(?:number)?|s\/n)\s*[:=：]\s*[^\s,，;；]+/gi,'[已隐藏私密字段]').replace(/(?:\\\\\?\\|[a-zA-Z]:\\)[^\s,，;；]+/g,'[已隐藏本机路径]');
      report={modelId:textField(input.modelId,'型号 ID'),providerVersion:textField(input.providerVersion,'适配器版本'),features,notes,hardwareConfirmed:true};
    }catch(error){return Promise.reject(error);}
    const id=crypto.createHash('sha256').update(JSON.stringify(report)).digest('hex'),requestBase=baseURL,key=requestBase+'|'+id;
    if(inFlight.has(key))return inFlight.get(key);
    const job=request(requestBase+'/v1/reports',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json','Idempotency-Key':id},body:JSON.stringify(report)}).then(body=>{
      const reportId=textField(body?.reportId,'报告 ID');if(body.status!=='received')throw new Error('验证服务器返回的收件状态不正确');
      return {reportId,status:'received',receivedAt:body.receivedAt?timestamp(body.receivedAt):null,scope:'server',serverURL:requestBase,modelId:report.modelId,providerVersion:report.providerVersion,features:report.features};
    }).finally(()=>inFlight.delete(key));
    inFlight.set(key,job);return job;
  }
  return {config,saveConfig,refresh,submit,list:()=>structuredClone(state.records)};
}
module.exports={createVerificationServer,serverAddress};
