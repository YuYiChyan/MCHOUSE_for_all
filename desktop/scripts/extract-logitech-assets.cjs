'use strict';
// Reads public G HUB delivery depots. Does not run any vendor binary or installer.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const origin='https://updates.ghub.logitechg.com';
const root=path.join(process.env.LOCALAPPDATA,'One4All-Desktop','vendor-resources','logitech');
const pythonCandidates=[path.join(process.env.APPDATA,'One4All-Desktop','modules','imported','python','python.exe'),path.join(process.env.USERPROFILE,'One4All','payload','python','python.exe')];
function hash(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function download(url,file){
 if(fs.existsSync(file)&&fs.statSync(file).size)return;
 const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='updates.ghub.logitechg.com')throw Error('Unexpected vendor source');
 fs.mkdirSync(path.dirname(file),{recursive:true});
 execFileSync('curl.exe',['--fail','--location','--connect-timeout','15','--max-time','90','--silent','--show-error',url,'--output',file+'.partial'],{windowsHide:true,stdio:'pipe',timeout:100000});
 fs.renameSync(file+'.partial',file);
}
function depotData(file){
 const b=fs.readFileSync(file);if(b.readUInt32LE(0)!==0x20170110)throw Error('Unrecognized depot container: '+file);
 const count=b.readUInt32LE(4);if(count>10*1024*1024||count+8>b.length)throw Error('Invalid depot manifest');
 const manifest=JSON.parse(b.subarray(8,8+count));let offset=8+count;
 return manifest.files.map(entry=>{if(offset+4>b.length)throw Error('Incomplete depot');const size=b.readUInt32LE(offset);offset+=4;if(offset+size>b.length)throw Error('Incomplete depot file');const data=b.subarray(offset,offset+size);offset+=size;return {name:entry.name,data};});
}
function safeTarget(directory,name){const dest=path.resolve(directory,name);const relative=path.relative(directory,dest);if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Invalid depot path');return dest;}
function extract(depot,directory,predicate){
 const entries=depotData(depot),written=[];for(const file of entries){if(!predicate(file.name,file.data))continue;const target=safeTarget(directory,file.name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,file.data);written.push({name:file.name,path:target,bytes:file.data.length});}return written;
}
function ensureDepot(entry){
 const file=path.join(root,entry.name+'.depot');if(fs.existsSync(file)&&fs.statSync(file).size===entry.size&&hash(file)===entry.mac)return file;
 const compressed=file+'.xz';download(origin+entry.url+'.xz',compressed);
 const python=pythonCandidates.find(fs.existsSync);if(!python)throw Error('A Python runtime with lzma is needed to unpack G HUB depots');
 execFileSync(python,['-I','-c','import lzma,pathlib,sys; pathlib.Path(sys.argv[2]).write_bytes(lzma.decompress(pathlib.Path(sys.argv[1]).read_bytes()))',compressed,file],{windowsHide:true,timeout:120000});
 if(fs.statSync(file).size!==entry.size||hash(file)!==entry.mac)throw Error('G HUB depot differs from official manifest: '+entry.name);
 return file;
}
function imageType(data){if(data.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))return '.png';if(data.subarray(0,4).toString()==='RIFF'&&data.subarray(8,12).toString()==='WEBP')return '.webp';if(data[0]===255&&data[1]===216)return '.jpg';return null;}
function colorFor(name){const n=name.toLowerCase();for(const [word,color]of [['white','#f2f2f2'],['black','#202124'],['blue','#79b8ed'],['lilac','#ae8fcb'],['pink','#ec9cbd'],['red','#c83d4a']])if(n.includes(word))return color;return null;}
function main(){
 fs.mkdirSync(root,{recursive:true});const base=origin+'/pipeline/v2/update/ghub13/win/public/';download(base+'update.json',path.join(root,'update.json'));download(base+'details.json',path.join(root,'details.json'));
 const details=JSON.parse(fs.readFileSync(path.join(root,'details.json')));const core=details.depots.find(d=>d.name==='core'),assets=details.depots.find(d=>d.name==='core_assets');
 const coreFiles=extract(ensureDepot(core),path.join(root,'core'),name=>/^data\/devices(?:\/|\.json)/.test(name));
 const assetFiles=extract(ensureDepot(assets),path.join(root,'assets'),(name,data)=>!!imageType(data));
 const assetMap=new Map(assetFiles.map(f=>['pipeline://core_assets/'+f.name,f.path]));
 const records=[],unreadable=[];for(const file of coreFiles){try{const object=JSON.parse(fs.readFileSync(file.path,'utf8'));for(const device of object.devices||[])records.push({device,file:file.name});}catch{unreadable.push({path:file.name,bytes:file.bytes,format:'non-JSON/encrypted'});}}
 const devices=records.map(({device:d,file})=>{
   const variants=[],seen=new Set();function addVariant(v){const imagePath=assetMap.get(v.thumbnail||d.thumbnail);const key=(v.thumbnail||d.thumbnail||'')+'|'+(v.displayName||d.displayName);if(seen.has(key))return;seen.add(key);variants.push({id:v.modelId||d.modelId,name:v.displayName||d.displayName,color:colorFor(v.thumbnail||d.thumbnail||''),...(imagePath?{imagePath}:{}),source:{thumbnail:v.thumbnail||d.thumbnail,extendedModel:v.extendedModel}});}
   addVariant(d);const identifiers=[];for(const mode of d.modes||[])for(const iface of mode.interfaces||[]){const match=/^([0-9a-f]{4})_([0-9a-f]{4})(?:_|$)/i.exec(iface.id||'');if(match&&!identifiers.some(x=>x.interfaceId===iface.id))identifiers.push({vendorId:parseInt(match[1],16),productId:parseInt(match[2],16),interfaceId:iface.id,interfaceType:iface.type,source:'G HUB model interface; may denote HID++ logical product rather than USB receiver'});for(const derivative of iface.derivatives||[])addVariant(derivative);}
   return {id:'logitech-'+d.modelId.replaceAll('_','-'),brand:'logitech',name:d.displayName||d.modelId,description:d.extendedDisplayName||'',kind:({MOUSE:'mouse',KEYBOARD:'keyboard',HEADSET:'headset',CAMERA:'camera',STEERING_WHEEL:'wheel',MICROPHONE:'microphone'})[d.type]||(d.type||'device').toLowerCase(),modelId:d.modelId,catalogRole:d.capabilities?.subdevicesTypes?'component':d.capabilities?.nonInteractive?'noninteractive':'device',identifiers,variants,source:{file,record:d.modelId,version:details.version,depot:d.depot||null,depotPrefix:d.depotPrefix||null},support:{status:'catalog-only',provider:'logitech-ghub'},vendorCapabilities:d.capabilities||{}};
 });
 const shared={};
 // A complete device depot demonstrates reusable button coordinates, lighting zones,
 // defaults and full-size product artwork without loading native device code.
 for(const name of ['g502','g29','g920','g923_xbox','g923_pc','g923_ps4','rs_h_shifter','rs_pedals']){const depot=details.depots.find(d=>d.name===name);if(!depot)continue;const files=extract(ensureDepot(depot),path.join(root,'device-depots',name),file=>/\.(png|webp|jpe?g|json)$/i.test(file));shared[name]={files};const manifest=JSON.parse(fs.readFileSync(path.join(root,'device-depots',name,'manifest.json')));for(const model of manifest.devices||[]){for(const entry of devices){const matches=entry.variants.filter(v=>v.id===model.modelId||path.basename(v.source.thumbnail||'').replace(/\.(png|webp|jpg)$/i,'')===model.modelId);if(!matches.length)continue;entry.reusableResources=model.resources.map(r=>({key:r.key,path:path.join(root,'device-depots',name,r.src)}));const image=entry.reusableResources.find(r=>r.key==='device_image');if(image)for(const variant of matches){variant.imagePath=image.path;variant.source.deviceDepot=name;}}}}
 const catalog={schema:1,brand:'logitech',generatedAt:new Date().toISOString(),source:{url:base+'details.json',version:details.version,buildId:details.buildId,sha256:hash(path.join(root,'details.json'))},devices};
 fs.writeFileSync(path.join(root,'catalog.json'),JSON.stringify(catalog,null,2));
 const report={generatedAt:catalog.generatedAt,version:details.version,buildId:details.buildId,deliveryManifest:base+'details.json',depotCount:details.depots.length,deviceCount:devices.length,devicesWithImages:devices.filter(d=>d.variants.some(v=>v.imagePath)).length,missingImages:devices.filter(d=>!d.variants.some(v=>v.imagePath)).map(d=>({modelId:d.modelId,name:d.name,catalogRole:d.catalogRole,reason:d.catalogRole==='component'?'仅列为组合设备内部组件，官方未给独立商品图':d.catalogRole==='noninteractive'?'官方标记nonInteractive，未提供商品图或控制接口':'未找到可用对应资源'})),variantCount:devices.reduce((n,d)=>n+d.variants.length,0),imagesExtracted:assetFiles.length,nonJsonDeviceFiles:unreadable,sharedResources:shared,installerExecuted:false,hardwareControlVerified:false,catalogFile:path.join(root,'catalog.json')};
 fs.writeFileSync(path.join(root,'logitech-catalog-report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({deviceCount:report.deviceCount,devicesWithImages:report.devicesWithImages,variantCount:report.variantCount,imagesExtracted:report.imagesExtracted,catalogFile:report.catalogFile}));return catalog;
}
module.exports={main,depotData,extract};if(require.main===module)main();
