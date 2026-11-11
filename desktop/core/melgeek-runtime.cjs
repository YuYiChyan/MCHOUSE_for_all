'use strict';
const fs=require('node:fs'),path=require('node:path');
const RESOURCE_FILES=['kb_keycode','kb_common','kb_shortcut','kb_led_mode','kb_screen'];
function getRuntime(modelId,{resourceRoot=path.join(process.env.LOCALAPPDATA||process.cwd(),'One4All-Desktop/vendor-resources')}={}){
 const {getMelgeekModels}=require('./melgeek-models.cjs');
 if(!getMelgeekModels().some(model=>model.id===modelId))throw Error('没有找到此 MelGeek 型号');
 const dir=path.join(resourceRoot,'melgeek','runtime');
 const file=path.join(dir,'mghive_core_bg.wasm');
 if(!fs.existsSync(file))throw Error('请先更新 MelGeek 设备资源');
 const bytes=fs.readFileSync(file);
 if(!bytes.subarray(0,4).equals(Buffer.from([0,97,115,109])))throw Error('MelGeek 控制模块格式不正确，请更新设备资源');
 const resources={};for(const name of RESOURCE_FILES){const value=fs.readFileSync(path.join(dir,name+'.json'),'utf8');JSON.parse(value);resources['default/devices/'+name+'.json']=value;}
 return {wasmBase64:bytes.toString('base64'),resources};
}
module.exports={getRuntime,RESOURCE_FILES};
