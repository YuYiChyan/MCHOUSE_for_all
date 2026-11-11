(function (root) {
  'use strict';
  // VIA's public command layout is documented by QMK quantum/via.h and via.c:
  // https://github.com/qmk/qmk_firmware/blob/master/quantum/via.h
  // This adapter implements basic keycodes only; vendor-specific commands are not probed.
  const COMMAND={version:0x01,getKey:0x04,setKey:0x05,layers:0x11,unhandled:0xff};
  const supportedVersions=new Set([9,10,11,12,13]);
  const integerId=value=>typeof value==='string'&&/^0x[0-9a-f]{1,4}$/i.test(value)?parseInt(value.slice(2),16):value;
  function parseDefinition(input,target) {
    const definition=typeof input==='string'?JSON.parse(input):input;
    if(!definition||typeof definition!=='object')throw new Error('请导入此键盘的 VIA JSON 定义');
    const vendorId=integerId(definition.vendorId),productId=integerId(definition.productId);
    if(!Number.isInteger(vendorId)||vendorId<1||vendorId>65535||!Number.isInteger(productId)||productId<0||productId>65535)throw new Error('VIA 定义缺少有效的 USB 标识');
    if(target&&(vendorId!==target.vendorId||productId!==target.productId))throw new Error('此 VIA 定义与选中的键盘不匹配');
    const rows=definition.matrix?.rows,cols=definition.matrix?.cols;
    if(!Number.isInteger(rows)||!Number.isInteger(cols)||rows<1||cols<1||rows>32||cols>32||rows*cols>1024)throw new Error('VIA 定义的按键矩阵无效');
    const keymap=definition.layouts?.keymap;
    if(!Array.isArray(keymap))throw new Error('VIA 定义缺少按键布局');
    const keys=new Map();
    for(const line of keymap){if(!Array.isArray(line))continue;for(const item of line){if(typeof item!=='string')continue;const coordinate=item.split('\n').map(value=>value.trim()).find(value=>/^\d+,\d+$/.test(value));if(!coordinate)continue;const [row,col]=coordinate.split(',').map(Number);if(row>=rows||col>=cols)throw new Error('按键布局坐标超出定义的矩阵');keys.set(coordinate,{value:coordinate,label:'行 '+(row+1)+' · 列 '+(col+1)});}}
    if(!keys.size)throw new Error('VIA 定义中没有可用的按键坐标');
    return {name:typeof definition.name==='string'?definition.name:'VIA 键盘',vendorId,productId,rows,cols,keys:[...keys.values()]};
  }
  function basicActions() {
    const result=[{value:0,label:'禁用此键'},{value:1,label:'透明（沿用下一层）'}];
    for(let index=0;index<26;index++)result.push({value:4+index,label:String.fromCharCode(65+index)});
    for(let index=0;index<10;index++)result.push({value:30+index,label:String((index+1)%10)});
    const named={40:'Enter',41:'Esc',42:'Backspace',43:'Tab',44:'空格',45:'−',46:'=',47:'[',48:']',49:'\\',51:';',52:"'",53:'`',54:',',55:'.',56:'/',57:'Caps Lock',70:'Print Screen',71:'Scroll Lock',72:'Pause',73:'Insert',74:'Home',75:'Page Up',76:'Delete',77:'End',78:'Page Down',79:'→',80:'←',81:'↓',82:'↑',83:'Num Lock',84:'数字键盘 /',85:'数字键盘 *',86:'数字键盘 −',87:'数字键盘 +',88:'数字键盘 Enter',98:'数字键盘 0',99:'数字键盘 .',101:'菜单',224:'左 Ctrl',225:'左 Shift',226:'左 Alt',227:'左 Win',228:'右 Ctrl',229:'右 Shift',230:'右 Alt',231:'右 Win'};
    for(let index=0;index<12;index++)named[58+index]='F'+(index+1);
    for(let index=0;index<9;index++)named[89+index]='数字键盘 '+(index+1);
    for(const [value,label] of Object.entries(named))result.push({value:Number(value),label});
    return result;
  }
  function viaCollection(device) {
    const visit=collections=>{for(const collection of collections||[]){if(collection.usagePage===0xff60&&collection.usage===0x61)return collection;const nested=visit(collection.children);if(nested)return nested;}return null;};
    return visit(device.collections);
  }
  function createTransport(device,{timeout=1800}={}) {
    const collection=viaCollection(device);
    if(!collection)throw new Error('选中的 HID 接口不是 VIA 接口');
    const reportBytes=report=>(report.items||[]).reduce((bits,item)=>bits+(item.reportSize||0)*(item.reportCount||0),0)/8;
    const report=collection.outputReports?.find(item=>reportBytes(item)===32);
    if(!report)throw new Error('VIA 接口没有标准的 32 字节输出报告');
    const inputIds=new Set((collection.inputReports||[]).filter(item=>reportBytes(item)===32).map(item=>item.reportId));
    if(!inputIds.size)throw new Error('VIA 接口没有标准的 32 字节输入报告');
    let queue=Promise.resolve(),pending=null,closed=false;
    const failPending=error=>{if(pending){clearTimeout(pending.timer);pending.reject(error);pending=null;}};
    const onInput=event=>{
      if(!pending||!inputIds.has(event.reportId))return;
      const bytes=new Uint8Array(event.data.buffer,event.data.byteOffset,event.data.byteLength);
      if(bytes[0]===COMMAND.unhandled){failPending(new Error('键盘固件不支持此 VIA 命令'));return;}
      if(bytes.length<6||bytes[0]!==pending.command)return;
      if(pending.echo.some((value,index)=>bytes[index+1]!==value))return;
      const complete=pending;pending=null;clearTimeout(complete.timer);complete.resolve(Uint8Array.from(bytes));
    };
    device.addEventListener('inputreport',onInput);
    async function close() {if(closed)return;closed=true;device.removeEventListener('inputreport',onInput);failPending(new Error('VIA 连接已关闭'));if(device.opened)await device.close();}
    const request=(command,data=[],echo=[])=>{
      const operation=queue.catch(()=>{}).then(async()=>{
        if(closed||!device.opened)throw new Error('键盘已断开，请重新连接');
        const packet=new Uint8Array(32);packet[0]=command;packet.set(data,1);
        return new Promise((resolve,reject)=>{
          const timer=setTimeout(()=>{failPending(new Error('键盘没有响应，请重新连接后再试'));void close().catch(()=>{});},timeout);
          pending={command,echo,resolve,reject,timer};
          Promise.resolve(device.sendReport(report.reportId,packet)).catch(error=>{failPending(error);void close().catch(()=>{});});
        });
      });queue=operation;return operation;
    };
    return {request,close,isClosed:()=>closed};
  }
  async function connect({definition,target,hid=root.navigator?.hid}={}) {
    if(!hid)throw new Error('当前环境没有可用的 WebHID');
    const parsed=parseDefinition(definition,target);
    const devices=await hid.requestDevice({filters:[{vendorId:parsed.vendorId,productId:parsed.productId,usagePage:0xff60,usage:0x61}]});
    if(devices.length!==1)throw new Error(devices.length?'请选择一台键盘':'未选择 VIA 键盘');
    const device=devices[0];
    if(device.vendorId!==parsed.vendorId||device.productId!==parsed.productId||!viaCollection(device))throw new Error('选择的接口与 VIA 定义不匹配');
    if(!device.opened)await device.open();
    let transport;
    try {transport=createTransport(device);}catch(error){await device.close();throw error;}
    try {
      const versionResponse=await transport.request(COMMAND.version);
      const protocolVersion=(versionResponse[1]<<8)|versionResponse[2];
      if(!supportedVersions.has(protocolVersion))throw new Error('此 VIA 协议版本尚未接入：'+protocolVersion);
      const layersResponse=await transport.request(COMMAND.layers);
      const layerCount=layersResponse[1];
      if(layerCount<1||layerCount>32)throw new Error('键盘返回的层数无效');
      let selection={layer:0,key:parsed.keys[0].value};
      const validateSelection=value=>{
        if(!value||!Number.isInteger(value.layer)||value.layer<0||value.layer>=layerCount||!parsed.keys.some(key=>key.value===value.key))throw new Error('无效的键盘层或按键');
        return {layer:value.layer,key:value.key};
      };
      const readKey=async selected=>{
        const {layer,key}=validateSelection(selected),[row,col]=key.split(',').map(Number);
        const bytes=await transport.request(COMMAND.getKey,[layer,row,col],[layer,row,col]);
        return {layer,key,action:(bytes[4]<<8)|bytes[5]};
      };
      const first=await readKey(selection);
      const actions=basicActions();
      // Preserve a custom keycode in the current display; writes remain restricted
      // to the documented basic set until a provider implements extended keycodes.
      if(!actions.some(action=>action.value===first.action))actions.push({value:first.action,label:'当前自定义键码 0x'+first.action.toString(16).padStart(4,'0')});
      const evidence=['VIA protocol '+protocolVersion+' acknowledged','Layer count '+layerCount+' acknowledged','Dynamic keymap read acknowledged','Definition USB identity and matrix matched'];
      const capabilities=[{id:'keymap',label:'按键映射',group:'按键',type:'keymap',supported:true,readable:true,writable:true,readCommand:'via.keymap.read',writeCommand:'via.keymap.write',provider:'qmk-via',version:String(protocolVersion),evidence,keys:parsed.keys,layers:Array.from({length:layerCount},(_,value)=>({value,label:'第 '+(value+1)+' 层'})),actions,description:'选择厂商定义中的按键位置并改键，写入后读取键盘确认。'}];
      let operations=Promise.resolve();
      const execute=(command,payload={})=>{
        const operation=operations.catch(()=>{}).then(async()=>{
          if(command==='via.keymap.read'){
            if(payload.selection)selection=validateSelection(payload.selection);
            const value=await readKey(selection);
            if(!actions.some(action=>action.value===value.action))actions.push({value:value.action,label:'当前自定义键码 0x'+value.action.toString(16).padStart(4,'0')});
            return {ok:true,value};
          }
          if(command==='via.keymap.write'){
            const value=payload.value;selection=validateSelection(value);
            if(!basicActions().some(action=>action.value===value.action))throw new Error('此处仅支持基础键码映射，请在原厂工具中编辑自定义键码');
            const [row,col]=selection.key.split(',').map(Number),prefix=[selection.layer,row,col];
            await transport.request(COMMAND.setKey,[...prefix,value.action>>8,value.action&0xff],prefix);
            const confirmed=await readKey(selection);
            if(confirmed.action!==value.action)throw new Error('键盘回读与所选键码不同，设置未确认');
            return {ok:true,value:confirmed};
          }
          throw new Error('VIA 未开放此命令');
        });operations=operation;return operation;
      };
      const disconnect=event=>{if(event.device===device)void transport.close().catch(()=>{});};
      hid.addEventListener('disconnect',disconnect);
      return {device:{name:parsed.name,connected:true,interface:'VIA · USB',vendorId:parsed.vendorId,productId:parsed.productId},capabilities,values:{keymap:first},execute,protocolVersion,layerCount,close:async()=>{hid.removeEventListener('disconnect',disconnect);await transport.close();}};
    } catch(error){await transport.close().catch(()=>{});throw error;}
  }
  root.One4AllVia=Object.freeze({connect,parseDefinition,basicActions,createTransport});
})(typeof window==='object'?window:globalThis);
