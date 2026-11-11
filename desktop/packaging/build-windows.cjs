'use strict';
// Dependency-free Windows packaging: portable NSIS compiler, no global install.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const project=path.resolve(__dirname,'..'),dist=path.join(project,'dist'),stage=path.join(dist,'win-unpacked');
const PUBLIC_DEPENDENCIES=['python','openrazer-win','g309-deps'];
const BRANDS=['mchose','razer','logitech','atk','vxe','vgn','dareu','rapoo','aula','melgeek'];
const NSIS={version:'3.13',url:'https://downloads.sourceforge.net/project/nsis/NSIS%203/3.13/nsis-3.13.zip',sha256:'ba63dffc4410ee89193e1cb5a41989991bd77c61068da17e3156d136b7b0b3d8'};
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const write=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value);};
const json=(file,value)=>write(file,JSON.stringify(value,null,2)+'\n');
const slash=value=>value.split(path.sep).join('/');
const quotePs=value=>"'"+value.replaceAll("'","''")+"'";
function inside(root,file){const relative=path.relative(root,file);return relative!==''&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);}
function walk(root){const files=[];for(const entry of fs.readdirSync(root,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const file=path.join(root,entry.name);if(entry.isSymbolicLink())throw Error('Bundle inputs cannot contain symbolic links: '+file);if(entry.isDirectory())files.push(...walk(file));else if(entry.isFile())files.push(file);}return files;}
function resetStage(){
 fs.mkdirSync(dist,{recursive:true});
 if(fs.lstatSync(dist).isSymbolicLink()||!inside(fs.realpathSync(project),fs.realpathSync(dist)))throw Error('Build output must stay in this project/dist');
 if(fs.existsSync(stage)){if(fs.lstatSync(stage).isSymbolicLink()||!inside(fs.realpathSync(dist),fs.realpathSync(stage))||path.basename(stage)!=='win-unpacked')throw Error('Refusing to replace an unexpected staging directory');fs.rmSync(stage,{recursive:true,force:true});}
 fs.mkdirSync(stage,{recursive:true});
}
function copyTree(source,target,filter=()=>true){
 if(!fs.existsSync(source))throw Error('Missing packaging input: '+source);
 for(const file of walk(source)){if(!filter(file))continue;const relative=path.relative(source,file);fs.mkdirSync(path.dirname(path.join(target,relative)),{recursive:true});fs.copyFileSync(file,path.join(target,relative));}
}
function copyApplication(){
 const target=path.join(stage,'resources/app');
 for(const directory of ['app','core','runtime','catalog','docs'])copyTree(path.join(project,directory),path.join(target,directory),file=>!/(?:^|[\\/])__pycache__(?:[\\/]|$)|\.pyc$/i.test(file));
 fs.mkdirSync(path.join(target,'scripts'),{recursive:true});
 for(const name of fs.readdirSync(path.join(project,'scripts')).filter(name=>/^extract-.*\.cjs$/.test(name)))fs.copyFileSync(path.join(project,'scripts',name),path.join(target,'scripts',name));
 const metadata=JSON.parse(fs.readFileSync(path.join(project,'package.json'),'utf8'));
 json(path.join(target,'package.json'),{name:metadata.name,productName:metadata.productName,version:metadata.version,description:metadata.description,main:metadata.main,private:true});
 fs.copyFileSync(path.join(project,'README.md'),path.join(target,'README.md'));write(path.join(target,'packaging/README.md'),fs.readFileSync(path.join(__dirname,'README.md')));return metadata;
}
function seedResources(resourceRoot,destination){
 const brands=[];
 for(const brand of BRANDS){
  const source=path.join(resourceRoot,brand,'catalog.json');if(!fs.existsSync(source))throw Error('Missing brand catalogue: '+brand);
  const catalog=JSON.parse(fs.readFileSync(source,'utf8')),output=path.join(destination,brand),files=new Map(),missing=[];
  function asset(value,type='assets'){
   if(!value)return value;
   const file=path.resolve(resourceRoot,brand,value);
   if(!fs.existsSync(file)||!fs.statSync(file).isFile()){missing.push({file:path.basename(file),type});return null;}
   const ext=path.extname(file).toLowerCase(),relative=type+'/'+hash(file)+(ext&&ext.length<12?ext:'.bin');
   if(!files.has(relative)){const target=path.join(output,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(file,target);files.set(relative,fs.statSync(file).size);}
   return relative;
  }
  function images(value){if(typeof value==='string')return asset(value);if(Array.isArray(value))return value.map(images);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,images(item)]));return value;}
  function rebase(value){
   if(Array.isArray(value))return value.map(rebase);if(!value||typeof value!=='object')return value;
   return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,key==='imagePath'?asset(item):key==='imagePaths'?images(item):key==='reusableResources'&&Array.isArray(item)?item.map(resource=>({...rebase(resource),...(typeof resource.path==='string'?{path:asset(resource.path,'reusable')}: {})})):rebase(item)]));
  }
  const portable=rebase(catalog);json(path.join(output,'catalog.json'),portable);
  if(brand==='melgeek'){
   for(const name of ['mghive_core_bg.wasm','kb_common.json','kb_keycode.json','kb_led_mode.json','kb_screen.json','kb_shortcut.json']){
    const file=path.join(resourceRoot,brand,'runtime',name);if(!fs.existsSync(file))throw Error('Missing MelGeek runtime: '+name);const relative='runtime/'+name;write(path.join(output,relative),fs.readFileSync(file));files.set(relative,fs.statSync(file).size);
   }
  }
  brands.push({brand,models:(portable.devices||portable.models||[]).length,files:files.size,bytes:[...files.values()].reduce((sum,n)=>sum+n,0),missing});
 }
 return brands;
}
function prepare(options={}){
 const payload=path.resolve(options.payload||path.join(process.env.APPDATA,'One4All-Desktop/modules/imported'));
 const resources=path.resolve(options.resources||path.join(process.env.LOCALAPPDATA,'One4All-Desktop/vendor-resources'));
 const electron=path.resolve(options.electron||path.join(project,'vendor/electron'));
 for(const name of PUBLIC_DEPENDENCIES)if(!fs.statSync(path.join(payload,name)).isDirectory())throw Error('Missing public dependency: '+name);
 if(!fs.existsSync(path.join(project,'app/assets/one4all.ico'))||!fs.existsSync(path.join(project,'app/assets/one4all.png')))execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'generate-icon.ps1')],{windowsHide:true,stdio:'inherit'});
 resetStage();
 copyTree(electron,stage,file=>!path.relative(electron,file).startsWith('resources'+path.sep));
 fs.renameSync(path.join(stage,'electron.exe'),path.join(stage,'One4All.exe'));
 const metadata=copyApplication(),base=path.join(stage,'resources/base-payload');
 for(const name of PUBLIC_DEPENDENCIES)copyTree(path.join(payload,name),path.join(base,name),file=>!/(?:^|[\\/])(?:__pycache__|\.git)(?:[\\/]|$)|\.pyc$/i.test(file));
 const dependencies=PUBLIC_DEPENDENCIES.map(name=>{const files=walk(path.join(base,name));return {name,files:files.length,bytes:files.reduce((sum,file)=>sum+fs.statSync(file).size,0)};});
 const brands=seedResources(resources,path.join(stage,'resources/vendor-resources'));
 const notices='# One4All Desktop — bundled components\n\nElectron/Chromium: see ../LICENSE and ../LICENSES.chromium.html.\n\nPython embedded runtime: base-payload/python/LICENSE.txt.\n\nopenrazer-win 1.3.0: base-payload/openrazer-win/LICENSE and LICENSES/; full Python source is included.\n\nHIDAPI Python binding: base-payload/g309-deps/hidapi-0.15.0.dist-info/licenses/.\n\nThe Logitech HID++ adapter is included as source at app/core/logitech-multi_backend.py, with its upstream Solaar commit and GPL-2.0-or-later attribution.\n\nDevice images and the MelGeek runtime remain their respective authors\' materials, with official source links preserved in each brand catalogue.\n\nInstaller generated with NSIS 3.13: https://nsis.sourceforge.io/ .\n';
 write(path.join(stage,'resources/THIRD-PARTY-NOTICES.md'),notices);write(path.join(stage,'.one4all-install'),'org.one4all.desktop');
 const manifest={schema:1,version:metadata.version,platform:'win32',arch:'x64',electron:fs.readFileSync(path.join(electron,'version'),'utf8').trim(),dependencies,brands,containsUserRegistry:false,containsUserData:false,containsVendorInstallers:false};
 json(path.join(stage,'resources/seed-manifest.json'),manifest);json(path.join(dist,'stage-manifest.json'),manifest);
 return {metadata,manifest,stage};
}
function ensureNsis(explicit){
 if(explicit)return path.resolve(explicit);
 const root=path.join(process.env.LOCALAPPDATA,'One4All-Desktop/build-tools'),archive=path.join(root,'nsis-'+NSIS.version+'.zip'),compiler=path.join(root,'nsis-'+NSIS.version,'makensis.exe');
 fs.mkdirSync(root,{recursive:true});
 if(!fs.existsSync(archive))execFileSync('curl.exe',['--fail','--location','--connect-timeout','20','--max-time','180','--silent','--show-error',NSIS.url,'--output',archive],{windowsHide:true,stdio:'inherit',timeout:190000});
 if(hash(archive)!==NSIS.sha256)throw Error('NSIS archive differs from the pinned official portable archive');
 if(!fs.existsSync(compiler)){const script='Expand-Archive -LiteralPath '+quotePs(archive)+' -DestinationPath '+quotePs(root)+' -Force';execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,stdio:'inherit'});}
 return compiler;
}
const nsisEscape=value=>value.replaceAll('$','$$').replaceAll('"','$\\"');
function compile(options={}){
 const metadata=JSON.parse(fs.readFileSync(path.join(stage,'resources/app/package.json'),'utf8')),compiler=ensureNsis(options.makensis),files=walk(stage),directories=new Set(),install=[],uninstall=[];
 let last='';
 for(const file of files){const relative=path.relative(stage,file),dir=path.dirname(relative);if(dir!==last){install.push('SetOutPath "$INSTDIR'+(dir==='.'?'':'\\'+nsisEscape(dir))+'"');last=dir;}install.push('File "'+nsisEscape(file)+'"');uninstall.push('Delete "$INSTDIR\\'+nsisEscape(relative)+'"');let current=dir;while(current!=='.'){directories.add(current);current=path.dirname(current);}}
 for(const directory of [...directories].sort((a,b)=>b.length-a.length))uninstall.push('RMDir "$INSTDIR\\'+nsisEscape(directory)+'"');
 write(path.join(dist,'install-files.nsh'),'\ufeff'+install.join('\r\n')+'\r\n');write(path.join(dist,'uninstall-files.nsh'),'\ufeff'+uninstall.join('\r\n')+'\r\n');
 const output=path.join(dist,'One4All-Setup-'+metadata.version+'.exe');
 execFileSync(compiler,['/INPUTCHARSET','UTF8','/V3','/DAPP_VERSION='+metadata.version,'/DPRODUCT_VERSION=0.6.0.0','/DOUTPUT_FILE='+output,'/DAPP_ICON='+path.join(stage,'resources/app/app/assets/one4all.ico'),'/DINSTALL_FILES='+path.join(dist,'install-files.nsh'),'/DUNINSTALL_FILES='+path.join(dist,'uninstall-files.nsh'),'/DESTIMATED_KB='+Math.ceil(files.reduce((sum,file)=>sum+fs.statSync(file).size,0)/1024),path.join(__dirname,'one4all.nsi')],{windowsHide:true,stdio:'inherit',timeout:15*60000});
 const digest=hash(output),artifact={file:path.basename(output),bytes:fs.statSync(output).size,sha256:digest};
 write(path.join(dist,path.basename(output)+'.sha256'),digest+'  '+path.basename(output)+'\n');
 const manifest={schema:1,version:metadata.version,productVersion:'0.6.0.0',platform:'win32',arch:'x64',createdAt:new Date().toISOString(),installer:{engine:'NSIS',version:NSIS.version,scope:'current-user',silentSwitch:'/S',uninstaller:'Uninstall.exe',preservesUserDataByDefault:true},artifacts:[artifact],seed:JSON.parse(fs.readFileSync(path.join(dist,'stage-manifest.json'),'utf8')),published:false,installedOnBuildMachine:false};
 json(path.join(dist,'artifact-manifest.json'),manifest);console.log(JSON.stringify({output,bytes:artifact.bytes,sha256:digest}));return manifest;
}
module.exports={prepare,compile,seedResources,ensureNsis};
if(require.main===module){try{const args=process.argv.slice(2),action=args.shift()||'build',options={};while(args.length){const key=args.shift();if(!key.startsWith('--')||!args.length)throw Error('Use --payload, --resources, --electron or --makensis followed by a path');options[key.slice(2)]=args.shift();}if(action==='tools')console.log(ensureNsis(options.makensis));else if(action==='prepare'){const result=prepare(options);console.log(JSON.stringify({stage:result.stage,...result.manifest}));}else if(action==='compile')compile(options);else if(action==='build'){prepare(options);compile(options);}else throw Error('Expected prepare, compile, build or tools');}catch(error){console.error(error.stack||error.message);process.exitCode=1;}}
