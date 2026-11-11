/* NANO68 Fire protocol, transcribed from the official hub.fgg.com.cn controls.
 * Only the documented normal USB identities are accepted. No vendor app runs. */
(function(root,factory){const api=factory(root);root.One4AllFgg=api;if(typeof module==='object'&&module.exports)module.exports=api;})(globalThis,function(root){
 'use strict';
 const PROVIDER='fgg-webhid',VERSION='1.0.0',SOURCE='https://hub.fgg.com.cn/assets/index-D9yt26aK.js';
 const NORMAL_PIDS=new Set([0x1064,0x106b,0x106d,0x10ff,0x1100,0x113a,0x110c,0x1143,0x1101,0x11a1]);
 const claims=new WeakSet(),rates={1000:4,2000:3,4000:2,8000:1};
 const abortError=()=>new DOMException('连接已取消','AbortError');
 const view=b=>new DataView(b.buffer,b.byteOffset,b.byteLength);
 function packet(command,address=0,length=0,payload){
  if(!Number.isInteger(command)||command<0||command>255||!Number.isInteger(address)||address<0||address>65535||!Number.isInteger(length)||length<0||length>56)throw Error('无效的键盘请求');
  const data=new Uint8Array(64);data[0]=0x55;data[1]=command;data[4]=length;view(data).setUint16(5,address,true);
  if(payload){if(payload.length!==length)throw Error('键盘请求长度不一致');data.set(payload,8);}
  data[3]=data.slice(4).reduce((sum,n)=>sum+n,0)&255;return data;
 }
 const collections=device=>(device.collections||[]).flatMap(c=>[c,...collections({collections:c.children})]);
 function matches(device,support){return device.vendorId===0x373b&&NORMAL_PIDS.has(device.productId)&&(support?.filters||[]).some(f=>f.vendorId===device.vendorId&&f.productId===device.productId&&f.usagePage===1&&f.usage===0&&collections(device).some(c=>c.usagePage===f.usagePage&&c.usage===f.usage));}
 function bounded(promise,{signal,timeoutMs=3000,onLate=()=>{}}={}){
  return new Promise((resolve,reject)=>{let settled=false;const finish=(fn,value)=>{if(settled)return false;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);fn(value);return true;},abort=()=>finish(reject,abortError()),timer=setTimeout(()=>finish(reject,Error('键盘连接超时，请重新连接')),timeoutMs);
   signal?.addEventListener('abort',abort,{once:true});Promise.resolve(promise).then(value=>{if(!finish(resolve,value))void Promise.resolve().then(()=>onLate(value)).catch(()=>{});},error=>finish(reject,error));if(signal?.aborted)abort();
  });
 }
 class Transport{
  constructor(device,{timeoutMs=2500,owned=false}={}){this.device=device;this.timeoutMs=timeoutMs;this.owned=owned;this.closed=false;this.pending=null;this.error=null;this.receive=this.receive.bind(this);device.addEventListener('inputreport',this.receive);}
  receive(event){if(this.closed||!this.pending||event.reportId!==0||event.device&&event.device!==this.device)return;const b=event.data;if(!(b instanceof DataView)||b.byteLength<8||b.getUint8(0)!==0xaa||b.getUint8(1)!==this.pending.command)return;
   // The original handler correlates byte 1 only. Zero address means no echo;
   // a contradictory nonzero read address must not be appended to another chunk.
   // Write ACKs do not need to echo address or length; settings are read back.
   const p=this.pending,echo=b.getUint16(5,true);if(p.read&&echo!==0&&echo!==p.address)return;
   const len=b.getUint8(4),chunk=p.command===7||p.command===0xa0;
   this.pending=null;clearTimeout(p.timer);if(b.byteLength!==64||p.read&&(chunk?(len===0||len>p.length):(len!==0&&len!==p.length))){p.reject(Error('键盘返回的数据长度不完整'));return;}p.resolve(new Uint8Array(b.buffer,b.byteOffset,b.byteLength).slice());
  }
  request(command,address=0,length=0,payload){if(this.closed)return Promise.reject(this.error||Error('键盘已断开，请重新连接'));if(this.pending)return Promise.reject(Error('键盘请求仍在进行'));
   const data=packet(command,address,length,payload);return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{if(this.pending?.timer!==timer)return;this.error=Error('键盘响应超时，请重新连接');void this.close(this.error).catch(()=>{});},this.timeoutMs);this.pending={command,address,length,read:!payload&&length>0,resolve,reject,timer};Promise.resolve().then(()=>{if(this.closed||this.pending?.timer!==timer)return;return this.device.sendReport(0,data);}).catch(error=>{if(this.pending?.timer===timer)void this.close(error).catch(()=>{});});});
  }
  async close(reason=Error('键盘已断开，请重新连接')){if(this.closed)return this.closing;this.closed=true;this.error=reason;this.device.removeEventListener('inputreport',this.receive);if(this.pending){clearTimeout(this.pending.timer);this.pending.reject(reason);this.pending=null;}this.closing=(async()=>{try{if(this.owned&&this.device.opened)await this.device.close();}finally{if(this.owned)claims.delete(this.device);}})();return this.closing;}
 }
 const cap=(id,label,type,group,extra={})=>({id,label,type,group,supported:true,readable:true,writable:true,readCommand:id+'.get',writeCommand:id+'.set',provider:PROVIDER,version:VERSION,evidence:[SOURCE+' · Fire / FunctionVariableArea / KeyTriggerTravelActionV2'],...extra});
 // Additional UI constants are copied from the matching old HUB configuration.
 const LIGHTS=['自定义','光谱循环','阶梯','常亮','呼吸','百花齐放','波浪','上下波浪','喷泉','银河','旋转','潮汐','海浪','涟漪','持续涟漪','单点','细胞','钢琴','流光','雨滴','星光','烟花','波段'].map((label,value)=>({label,value})).concat({label:'关闭',value:255});
 const SHAFT_MAX={1:4,2:3.3,3:3.3,4:3.7,5:3.3,6:3.4,7:3.4,8:3.4,9:3.4,10:3.4,11:3.4,12:3.4,13:3.4,14:3.4};
 const speedModes=new Set([1,...Array.from({length:19},(_,i)=>i+4)]),colorModes=new Set([2,3,4,...Array.from({length:17},(_,i)=>i+6)]);
 function keyLabel(code,modifier){
  if(code>=4&&code<=29)return String.fromCharCode(65+code-4);if(code>=30&&code<=38)return String(code-29);if(code===39)return '0';
  const names={40:'Enter',41:'Esc',42:'Backspace',43:'Tab',44:'空格',45:'-',46:'=',47:'[',48:']',49:'\\',51:';',52:"'",53:'`',54:',',55:'.',56:'/',57:'Caps Lock',73:'Insert',74:'Home',75:'Page Up',76:'Delete',77:'End',78:'Page Down',79:'→',80:'←',81:'↓',82:'↑',101:'菜单',224:'左 Ctrl',225:'左 Shift',226:'左 Alt',227:'左 Win',228:'右 Ctrl',229:'右 Shift',230:'右 Alt',231:'右 Win'};
  if(code>=58&&code<=69)return 'F'+(code-57);if(code===0&&modifier&&!(modifier&(modifier-1)))return names[224+Math.log2(modifier)];return names[code];
 }
 function decodeKeys(bytes){const keys=[];for(let i=0;i<128;i++){const b=bytes.subarray(i*3,i*3+3);if(b[0]!==0x10)continue;const label=keyLabel(b[1],b[2]);if(label)keys.push({value:i,label});}return keys;}
 function parseTravel(b,key){const v=view(b),word=i=>v.getUint16(i,true);return {key,shaft:b[0]&31,type:b[1]&15,distance:((word(2)&511)+1)/100,enabled:(b[1]&15)>0,continuous:(b[1]&15)===2,press:((word(4)&511)+1)/100,release:((word(6)&511)+1)/100,pressDead:(word(4)>>>9),releaseDead:(word(6)>>>9)};}
 function numberIn(value,range){if(typeof value!=='number'||!Number.isFinite(value)||value<range.min||value>range.max||Math.abs((value-range.min)/range.step-Math.round((value-range.min)/range.step))>1e-6)throw Error('数值超出当前设备范围');return value;}
 class Session{
  constructor(transport,model){this.transport=transport;this.model=model;this.provider=PROVIDER;this.version=VERSION;this.verification='unverified';this.values={};this.capabilities=[];this.errors={};this.queue=Promise.resolve();this.selected={};this.configIndex=0;this.keys=[];this.device={modelId:model.id,name:model.name,brand:'fgg',kind:'keyboard',interface:'USB HID',connected:true};}
  enqueue(fn){const job=this.queue.catch(()=>{}).then(()=>{if(this.transport.closed)throw this.transport.error;return fn();});this.queue=job;return job;}
  async read(command,address,length){const response=await this.transport.request(command,address,length);return response.slice(8,8+([7,0xa0].includes(command)?response[4]:length));}
  async readRange(command,address,length,chunk=56){const out=new Uint8Array(length);for(let offset=0;offset<length;){const response=await this.read(command,address+offset,Math.min(chunk,length-offset));out.set(response,offset);offset+=response.length;}return out;}
  async functionArea(){return this.read(5,this.configIndex*64,56);}
  functionValue(id,b){if(id==='lightingEffect')return b[8];if(id==='lightingBrightness')return b[9];if(id==='lightingSpeed')return 4-b[10];if(id==='lightingColor')return '#'+[...b.slice(14,17)].map(n=>n.toString(16).padStart(2,'0')).join('');if(id==='winLock')return Boolean(b[6]&1);if(id==='pollingRate')return Number(Object.keys(rates).find(rate=>rates[rate]===(b[4]&15)));}
  async initialize(){const info=await this.transport.request(3),base=await this.transport.request(4);this.device.firmware=info[9].toString(16)+'.'+info[8].toString(16).padStart(2,'0');this.configIndex=base[8];if(!base[9]||base[8]>=base[9]||base[8]>15)throw Error('键盘配置索引无效');
   const b=await this.functionArea();this.capabilities=[cap('pollingRate','回报率','select','性能',{options:[1000,2000,4000,8000].map(value=>({value,label:value+' Hz'}))}),cap('winLock','锁定 Win 键','boolean','性能')];
   this.capabilities.unshift(cap('lightingEffect','灯光效果','select','灯效',{options:LIGHTS}),cap('lightingBrightness','灯光亮度','number','灯效',{range:{min:0,max:100,step:1},unit:'%'}),cap('lightingColor','灯光颜色','color','灯效',{description:'适用于常亮、呼吸等单色灯效'}),cap('lightingSpeed','灯光速度','number','灯效',{range:{min:0,max:4,step:1},description:'适用于光谱循环、呼吸等动态灯效'}));
   this.capabilities=this.capabilities.filter(descriptor=>{const value=this.functionValue(descriptor.id,b),valid=descriptor.type==='select'?descriptor.options.some(o=>o.value===value):descriptor.type==='number'?Number.isFinite(value)&&value>=descriptor.range.min&&value<=descriptor.range.max:true;if(!valid){this.errors[descriptor.id]='设备返回了未识别的当前值';return false;}this.values[descriptor.id]=value;return true;});
   // Key indices come from the device's default key matrix, not an assumed layout.
   try{this.keys=decodeKeys(await this.readRange(7,this.configIndex*0x800,384,55));if(this.keys.length){this.travel=await this.readRange(0xa0,this.configIndex*0x400,1024);this.addMagneticCapabilities();}}catch(error){if(this.transport.closed)throw error;this.errors.magnetic=error.message;}
   this.connected=true;this.interfaceConfirmed=true;
   return this;
  }
  magneticRanges(){const shafts=this.keys.map(k=>SHAFT_MAX[this.travel[k.value*8]&31]);if(!shafts.length||shafts.some(n=>!n))return null;const max=Math.min(...shafts),step=this.transport.device.productId===0x1064?.02:this.transport.device.productId===0x11a1?null:.01;return {actuation:step?{min:.1,max,step}:null,rapid:step?{min:step,max,step}:null,deadzone:{min:0,max:1,step:.02}};}
  addMagneticCapabilities(){const ranges=this.magneticRanges();if(!ranges)return;const key=this.keys[0].value,keys=this.keys;
   for(const [id,label,fields] of [['actuation','按键触发点',[{id:'distance',label:'触发点',range:ranges.actuation}]],['rapidTrigger','快速触发（RT）',[{id:'enabled',label:'启用',type:'boolean'},{id:'continuous',label:'连续 RT',type:'boolean'},{id:'press',label:'按下灵敏度',range:ranges.rapid},{id:'release',label:'松开灵敏度',range:ranges.rapid}]],['deadzone','按键死区',[{id:'top',label:'顶部死区',range:ranges.deadzone},{id:'bottom',label:'底部死区',range:ranges.deadzone}]]]){
    if(fields.some(f=>!f.type&&!f.range))continue;this.capabilities.push(cap(id,label,'fields','磁轴',{keys,fields:[{id:'key',label:'按键',type:'key'},...fields.map(f=>({type:'number',unit:f.type?undefined:'mm',...f}))]}));this.values[id]=this.travelValue(id,this.travel.slice(key*8,key*8+8),key);
   }
  }
  travelValue(id,b,key){const data=parseTravel(b,key);if(id==='actuation')return {key,distance:data.distance};if(id==='rapidTrigger')return {key,enabled:data.enabled,continuous:data.continuous,press:data.press,release:data.release};if(id==='deadzone')return {key,top:data.releaseDead/100,bottom:data.pressDead/100};}
  validate(id,value){const descriptor=this.capabilities.find(c=>c.id===id);if(!descriptor)throw Error('此键盘没有开放该功能');if(descriptor.type==='fields'){if(!value||typeof value!=='object'||!this.keys.some(k=>k.value===value.key))throw Error('请选择当前键盘的按键');for(const field of descriptor.fields){if(field.type==='key')continue;if(field.type==='boolean'){if(typeof value[field.id]!=='boolean')throw Error('请选择开关状态');}else numberIn(value[field.id],field.range);}return;}
   if(descriptor.type==='boolean'){if(typeof value!=='boolean')throw Error('请选择开关状态');}else if(descriptor.type==='select'){if(!descriptor.options.some(o=>o.value===value))throw Error('键盘不支持此选项');}else if(descriptor.type==='color'){if(!/^#[0-9a-f]{6}$/i.test(value))throw Error('请选择有效颜色');}else numberIn(value,descriptor.range);
  }
  execute(command,payload={}){return this.enqueue(async()=>{const m=/^(lightingEffect|lightingColor|lightingBrightness|lightingSpeed|pollingRate|winLock|actuation|rapidTrigger|deadzone)\.(get|set)$/.exec(command);if(!m)throw Error('未开放的键盘操作');const [,id,op]=m;if(!this.capabilities.some(c=>c.id===id))throw Error('此键盘没有开放该功能');
   if(['actuation','rapidTrigger','deadzone'].includes(id))return this.magneticCommand(id,op,payload);
   const current=await this.functionArea();if(op==='get'){const value=this.functionValue(id,current);this.values[id]=value;return {ok:true,value};}const value=payload.value;this.validate(id,value);const next=current.slice();
   if(id==='lightingSpeed'&&!speedModes.has(current[8]))throw Error('当前灯效没有速度设置，请先选择动态灯效');if(id==='lightingColor'&&!colorModes.has(current[8]))throw Error('当前灯效不使用单色，请先选择常亮、呼吸等灯效');
   if(id==='lightingEffect')next[8]=value;else if(id==='lightingBrightness')next[9]=value;else if(id==='lightingSpeed')next[10]=4-value;else if(id==='lightingColor'){next[12]=0;next.set(value.slice(1).match(/../g).map(s=>parseInt(s,16)),14);}else if(id==='winLock')next[6]=(next[6]&254)|(value?1:0);else next[4]=(next[4]&240)|rates[value];
   next[0]=0x50;next[2]=0xaa;next[3]=0xbb;await this.transport.request(6,this.configIndex*64,56,next);const confirmed=this.functionValue(id,await this.functionArea());if(confirmed!==(typeof value==='string'?value.toLowerCase():value))throw Error('键盘读回值与设置不一致');this.values[id]=confirmed;return {ok:true,value:confirmed};
  });}
  async magneticCommand(id,op,payload){const key=op==='set'?payload.value?.key:payload.selection?.key??this.selected[id]??this.keys[0]?.value;if(!this.keys.some(k=>k.value===key))throw Error('请选择当前键盘的按键');this.selected[id]=key;const address=this.configIndex*0x400+key*8,b=await this.readRange(0xa0,address,8);if(op==='get')return {ok:true,value:this.travelValue(id,b,key)};const value=payload.value;this.validate(id,value);const next=b.slice(),v=view(next),setLow=(offset,n)=>v.setUint16(offset,(v.getUint16(offset,true)&~511)|(Math.round(n*100)-1),true);
   const max=SHAFT_MAX[b[0]&31];if(!max)throw Error('当前轴体的行程范围尚未确认');for(const field of id==='actuation'?['distance']:id==='rapidTrigger'?['press','release']:[])if(value[field]>max)throw Error('数值超过当前按键轴体行程');
   if(id==='actuation')setLow(2,value.distance);else if(id==='rapidTrigger'){next[1]=(next[1]&240)|(value.enabled?(value.continuous?2:1):0);setLow(4,value.press);setLow(6,value.release);}else{v.setUint16(4,(v.getUint16(4,true)&511)|(Math.round(value.bottom*100)<<9),true);v.setUint16(6,(v.getUint16(6,true)&511)|(Math.round(value.top*100)<<9),true);}
   await this.transport.request(1);try{await this.transport.request(0xa1,address,8,next);}finally{if(!this.transport.closed)await this.transport.request(2);}
   const actual=await this.readRange(0xa0,address,8);if(actual.some((n,i)=>n!==next[i]))throw Error('键盘读回值与设置不一致');this.travel.set(actual,key*8);const confirmed=this.travelValue(id,actual,key);this.values[id]=confirmed;return {ok:true,value:confirmed};
  }
  async close(){this.connected=false;this.device.connected=false;try{await this.transport.close();}finally{this.onClose?.();}}
 }
 async function connect({model,signal,prepare,hid=root.navigator?.hid,timeoutMs=2500}={}){
  if(model?.brand!=='fgg'||model.support?.provider!==PROVIDER||!model.support.filters?.length)throw Error('此型号没有可用的 NANO68 控制配置');if(!hid)throw Error('当前环境没有可用的 WebHID');const check=()=>{if(signal?.aborted)throw abortError();},run=p=>bounded(p,{signal,timeoutMs});check();await run(Promise.resolve().then(()=>prepare?.()));check();
  let devices=(await run(hid.getDevices())).filter(device=>matches(device,model.support));if(devices.length!==1){devices=(await run(hid.requestDevice({filters:model.support.filters}))).filter(device=>matches(device,model.support));}check();if(devices.length!==1)throw Error(devices.length?'请选择一台对应键盘':'未选择对应键盘');const device=devices[0];if(device.opened||claims.has(device))throw Error('键盘正在被其他连接使用，请先断开');claims.add(device);
  let transport,session,openFinished=false;const cancel=()=>{if(transport)void transport.close(abortError()).catch(()=>{});};signal?.addEventListener('abort',cancel,{once:true});
  try{const opening=Promise.resolve().then(()=>device.open()).then(value=>{openFinished=true;return value;},error=>{openFinished=true;claims.delete(device);throw error;});await bounded(opening,{signal,timeoutMs,onLate:async()=>{try{if(device.opened)await device.close();}finally{claims.delete(device);}}});check();transport=new Transport(device,{timeoutMs,owned:true});session=new Session(transport,model);session.onClose=()=>{signal?.removeEventListener('abort',cancel);hid.removeEventListener?.('disconnect',disconnect);};const disconnect=e=>{if(e.device===device)void session.close().catch(()=>{});};hid.addEventListener?.('disconnect',disconnect);await session.initialize();check();return session;
  }catch(error){signal?.removeEventListener('abort',cancel);if(session)await session.close().catch(()=>{});else if(transport)await transport.close().catch(()=>{});else if(openFinished){try{if(device.opened)await device.close();}finally{claims.delete(device);}}throw error;}
 }
 return Object.freeze({connect,Transport,Session,packet,matches,parseTravel,decodeKeys,PROVIDER,VERSION});
});
