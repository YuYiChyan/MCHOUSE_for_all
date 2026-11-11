/* Local user preferences only; never writes HID reports. SPDX-License-Identifier: MIT. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),{randomBytes}=require('node:crypto');
function validateAppearance(value){
  if(!value||typeof value!=='object'||typeof value.name!=='string'||value.name.length>60||/[\x00-\x1f\x7f]/.test(value.name))throw Error('名称需为 60 字以内的单行文字');
  const image=value.imageDataUrl;
  if(typeof image!=='string')throw Error('图片格式不正确');
  if(image){
    if(image.length>2800000||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(image))throw Error('请上传 PNG 图片');
    const bytes=Buffer.from(image.slice(22),'base64');
    if(bytes.length<33||bytes.length>2000000||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.toString('ascii',12,16)!=='IHDR')throw Error('图片格式不正确');
    const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
    if(!width||!height||width>1200||height>1200)throw Error('图片尺寸不得超过 1200 像素');
  }
  const deviceType=value.deviceType||'auto';
  if(!['auto','keyboard','mouse'].includes(deviceType))throw Error('设备类型不正确');
  return {name:value.name.trim(),imageDataUrl:image,deviceType};
}
function createAppearanceStore(directory){
  fs.mkdirSync(directory,{recursive:true});
  const file=path.join(directory,'keyboard-appearance.json');
  let data;
  try{data=JSON.parse(fs.readFileSync(file,'utf8'));}
  catch(error){if(error.code!=='ENOENT')throw Error('本机键盘外观设置无法读取，请检查设置文件');}
  if(data&&(!/^[a-f0-9]{64}$/.test(data.salt)||!data.devices||typeof data.devices!=='object'||Array.isArray(data.devices)))throw Error('本机键盘外观设置格式不正确');
  data??={salt:randomBytes(32).toString('hex'),devices:{}};
  function persist(next){
    const temp=file+'.'+randomBytes(6).toString('hex')+'.tmp';
    try{fs.writeFileSync(temp,JSON.stringify(next),{mode:0o600,flag:'wx'});fs.renameSync(temp,file);}
    finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
    data=next;
  }
  if(!fs.existsSync(file))persist(data);
  function checkId(id){if(typeof id!=='string'||!/^[a-f0-9]{20}$/.test(id))throw Error('设备标识不正确');}
  return Object.freeze({salt:data.salt,
    get(id){checkId(id);return data.devices[id]?validateAppearance(data.devices[id]):{name:'',imageDataUrl:'',deviceType:'auto'};},
    set(id,value){checkId(id);const appearance=validateAppearance(value);persist({...data,devices:{...data.devices,[id]:appearance}});return appearance;},
  });
}
module.exports={createAppearanceStore,validateAppearance};
