/* Reproducible local adaptation of GPL VIA sources; no vendor install scripts. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),source=path.resolve(process.argv[2]||path.join(root,'.handoff-work','via-source'));
const original=path.join(source,'node_modules','via-keyboards'),copy=path.join(source,'one4all-keyboards-source');
fs.mkdirSync(copy,{recursive:true});
for(const name of ['scripts','src','v3','package.json','LICENSE','README.md'])fs.cpSync(path.join(original,name),path.join(copy,name),{recursive:true});
const modules=path.join(copy,'node_modules');fs.mkdirSync(modules,{recursive:true});
for(const item of fs.readdirSync(path.join(original,'node_modules'),{withFileTypes:true})){
  if(item.name.startsWith('.'))continue;
  if(item.name.startsWith('@')){
    fs.mkdirSync(path.join(modules,item.name),{recursive:true});
    for(const child of fs.readdirSync(path.join(original,'node_modules',item.name)))link(path.join(item.name,child));
  }else link(item.name);
}
function link(name){const dest=path.join(modules,name);if(!fs.existsSync(dest))fs.symlinkSync(fs.realpathSync(path.join(original,'node_modules',name)),dest,'junction');}
const getPath=path.join(copy,'scripts','get-path.ts');
fs.writeFileSync(getPath,fs.readFileSync(getPath,'utf8').replace("version === 'v2' ? 'src/**/*.json' : `${version}/**/*.json`\n  );","version === 'v2' ? 'src/**/*.json' : `${version}/**/*.json`\n  ).replaceAll('\\\\', '/');"));
// Drop external font loads; the embedded page uses local/system font fallbacks.
const index=path.join(source,'index.html');fs.writeFileSync(index,fs.readFileSync(index,'utf8').replace(/<link\b[^>]*href="https:\/\/fonts[^\"]*"[^>]*>/g,''));
const css=path.join(source,'src','app.global.css');fs.writeFileSync(css,fs.readFileSync(css,'utf8').replace(/@import url\('https:\/\/fonts[^']*'\);/g,''));
const canvas=path.join(source,'src','components','three-fiber','canvas-router.tsx');let canvasText=fs.readFileSync(canvas,'utf8');if(!canvasText.includes("useGLTF.setDecoderPath('/draco/')"))canvasText=canvasText.replace('useGLTF.preload(cubeySrc',"useGLTF.setDecoderPath('/draco/');\nuseGLTF.preload(cubeySrc");fs.writeFileSync(canvas,canvasText);
const draco=path.join(source,'public','draco');fs.mkdirSync(draco,{recursive:true});
for(const name of ['draco_decoder.js','draco_decoder.wasm','draco_wasm_wrapper.js'])fs.copyFileSync(path.join(source,'node_modules','three','examples','jsm','libs','draco','gltf',name),path.join(draco,name));
fs.copyFileSync(path.join(source,'node_modules','three','examples','jsm','libs','draco','README.md'),path.join(draco,'README.md'));
const licenseRoot=path.join(source,'public','third-party');fs.mkdirSync(licenseRoot,{recursive:true});
for(const folder of fs.readdirSync(path.join(source,'node_modules','.pnpm'),{withFileTypes:true})){
  if(!folder.isDirectory()||folder.name==='node_modules')continue;const base=path.join(source,'node_modules','.pnpm',folder.name,'node_modules');if(!fs.existsSync(base))continue;
  const packages=[];for(const item of fs.readdirSync(base,{withFileTypes:true})){if(item.name.startsWith('@')){for(const child of fs.readdirSync(path.join(base,item.name)))packages.push(path.join(base,item.name,child));}else if(!item.name.startsWith('.'))packages.push(path.join(base,item.name));}
  for(const dir of packages){if(!fs.existsSync(path.join(dir,'package.json')))continue;const pkg=JSON.parse(fs.readFileSync(path.join(dir,'package.json'),'utf8'));const dest=path.join(licenseRoot,pkg.name.replaceAll('/','__').replaceAll('@','')+'@'+pkg.version);fs.mkdirSync(dest,{recursive:true});for(const file of fs.readdirSync(dir))if(/^(licen[sc]e|notice)(\..*)?$/i.test(file)&&fs.statSync(path.join(dir,file)).isFile())fs.copyFileSync(path.join(dir,file),path.join(dest,file));}
}
const store=path.join(source,'src','utils','device-store.ts');
fs.writeFileSync(store,fs.readFileSync(store,'utf8').replace("themeMode: 'dark' as const,","themeMode: (new URLSearchParams(location.search).get('dcTheme')==='light'?'light':'dark') as 'light'|'dark',"));
fs.writeFileSync(store,fs.readFileSync(store,'utf8').replace('showDesignTab: false','showDesignTab: true'));
const context=path.join(source,'src','utils','running-context.tsx');
fs.writeFileSync(context,fs.readFileSync(context,'utf8').replace('export const isElectron = /Electron/.test(navigator.userAgent);',"export const isElectron = /Electron/.test(navigator.userAgent) && new URLSearchParams(location.search).get('one4allEmbedded') !== '1';"));
const devices=path.join(source,'src','utils','hid-keyboards.ts');
fs.writeFileSync(devices,fs.readFileSync(devices,'utf8').replace('(validVendorProduct || forceRequest) && canConnect(device)',"(validVendorProduct || forceRequest || new URLSearchParams(location.search).get('one4allEmbedded') === '1') && canConnect(device)"));
const entry=path.join(source,'src','index.tsx');let entryText=fs.readFileSync(entry,'utf8');
if(!entryText.includes("get('one4allMode')"))entryText=entryText.replace("const elem = document.getElementById('root');","if (new URLSearchParams(location.search).get('one4allMode') === 'design') history.replaceState(null, '', '/design' + location.search);\nconst elem = document.getElementById('root');");
fs.writeFileSync(entry,entryText);
function run(args,name){const result=spawnSync(process.execPath,args,{cwd:source,encoding:'utf8',env:{...process.env,NODE_PATH:path.join(source,'node_modules','.pnpm','node_modules')},maxBuffer:12*1024*1024});fs.writeFileSync(path.join(source,name+'.log'),(result.stdout||'')+(result.stderr||''));if(result.status!==0)throw Error(name+' failed; inspect '+name+'.log');}
run(['--import','tsx',path.join(copy,'scripts','build-all.ts'),path.join(source,'public','definitions')],'definitions');
const indexData=JSON.parse(fs.readFileSync(path.join(source,'public','definitions','supported_kbs.json'),'utf8'));
const ids=[...new Set([...indexData.vendorProductIds.v2,...indexData.vendorProductIds.v3])];
if(ids.length<500)throw Error('Refusing to ship an empty or unexpectedly small VIA catalog: '+ids.length);
run([path.join(source,'node_modules','typescript','bin','tsc')],'typecheck');
run([path.join(source,'node_modules','vite','bin','vite.js'),'build'],'vite');
const dest=path.join(root,'library','vendor','via');fs.mkdirSync(dest,{recursive:true});
fs.writeFileSync(path.join(dest,'catalog.json'),JSON.stringify(Object.fromEntries(ids.map(id=>[id,true]))));
fs.copyFileSync(path.join(source,'LICENSE'),path.join(dest,'LICENSE'));
const commit=spawnSync('git',['-c','safe.directory='+source.replaceAll('\\','/'),'rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).stdout.trim();
fs.writeFileSync(path.join(dest,'UPSTREAM.json'),JSON.stringify({repository:'https://github.com/the-via/app',commit,date:'2026-10-22',license:'GPL-3.0',definitions:ids.length,changes:['normalize Windows definition glob paths in a separate source copy','remove remote font links and imports','bundle local Draco decoder and dependency license notices','initialize theme from host dcTheme query','use WebHID in embedded Electron iframe','allow unlisted Raw HID devices while retaining protocol validation','enable manufacturer JSON design import and direct design route'],sourceArchive:'via-corresponding-source.zip',runtimeArchive:'via-offline.zip'},null,2));
console.log('VIA built with '+ids.length+' distinct VID/PID definitions; offline archives still need packaging.');
