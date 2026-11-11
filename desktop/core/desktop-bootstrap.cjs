'use strict';
const fs=require('node:fs'),path=require('node:path');
const PUBLIC_DEPENDENCIES=['python','openrazer-win','g309-deps','xiberia-audio-deps'];

function absoluteRoot(value,label){if(typeof value!=='string'||!path.isAbsolute(value))throw TypeError(label+' must be an explicit absolute path');return path.resolve(value);}
function directory(file){try{return fs.statSync(file).isDirectory();}catch{return false;}}
function readRegistry(file){try{const value=JSON.parse(fs.readFileSync(file,'utf8'));return Array.isArray(value.plugins)?value:{plugins:[]};}catch{return {plugins:[]};}}
function copyMissing(source,target,filter){fs.mkdirSync(path.dirname(target),{recursive:true});fs.cpSync(source,target,{recursive:true,force:false,errorOnExist:false,...(filter?{filter}:{})});}

function rebaseCatalog(value,brandRoot,warnings,location='catalog'){
 const resolveImage=(relative,where)=>{
  if(relative===null||relative===undefined||relative==='')return relative;
  if(typeof relative!=='string')return null;
  const parts=relative.replace(/\\/g,'/');
  if(path.win32.isAbsolute(relative)||path.posix.isAbsolute(parts)||/^[a-z][a-z0-9+.-]*:/i.test(parts)){
   warnings.push({field:where,reason:'Image resource must be relative to its bundled brand directory'});return null;
  }
  const absolute=path.resolve(brandRoot,parts),inside=path.relative(brandRoot,absolute);
  if(inside==='..'||inside.startsWith('..'+path.sep)||path.isAbsolute(inside)){
   warnings.push({field:where,reason:'Image resource leaves its bundled brand directory'});return null;
  }
  return absolute;
 };
 const imagePaths=(entry,where)=>Array.isArray(entry)?entry.map((item,i)=>imagePaths(item,where+'['+i+']')):entry&&typeof entry==='object'?Object.fromEntries(Object.entries(entry).map(([key,item])=>[key,imagePaths(item,where+'.'+key)])):resolveImage(entry,where);
 if(Array.isArray(value))return value.map((item,i)=>rebaseCatalog(item,brandRoot,warnings,location+'['+i+']'));
 if(!value||typeof value!=='object')return value;
 return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,key==='imagePath'?resolveImage(item,location+'.'+key):key==='imagePaths'?imagePaths(item,location+'.'+key):key==='reusableResources'&&Array.isArray(item)?item.map((resource,i)=>({...rebaseCatalog(resource,brandRoot,warnings,location+'.'+key+'['+i+']'),...(typeof resource.path==='string'?{path:resolveImage(resource.path,location+'.'+key+'['+i+'].path')}:{})})):rebaseCatalog(item,brandRoot,warnings,location+'.'+key)]));
}

function seedCatalogs({packageRoot,bundledRoot}){
 const seedRoot=path.join(bundledRoot,'vendor-resources'),resourceRoot=path.join(packageRoot,'vendor-resources'),seededBrands=[],seedWarnings=[];
 if(!directory(seedRoot))return {resourceRoot,seededBrands,seedWarnings};
 for(const brand of fs.readdirSync(seedRoot,{withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>entry.name).sort()){
  const source=path.join(seedRoot,brand),catalogFile=path.join(source,'catalog.json'),target=path.join(resourceRoot,brand),destination=path.join(target,'catalog.json');
  if(fs.existsSync(destination)||!fs.existsSync(catalogFile))continue;
  const warnings=[],catalog=rebaseCatalog(JSON.parse(fs.readFileSync(catalogFile,'utf8')),target,warnings);
  // Publish the rebased catalogue last; a copied developer catalogue is never
  // briefly exposed to readers, and an existing catalogue/update is untouched.
  copyMissing(source,target,current=>path.resolve(current)!==path.resolve(catalogFile));
  try{fs.writeFileSync(destination,JSON.stringify(catalog,null,2),{flag:'wx'});seededBrands.push(brand);seedWarnings.push(...warnings.map(warning=>({brand,...warning})));}
  catch(error){if(error.code!=='EEXIST')throw error;}
 }
 return {resourceRoot,seededBrands,seedWarnings};
}

function prepareDesktopData({stateRoot,legacyRoot,packageRoot,bundledRoot,migrate=true}={}){
 stateRoot=absoluteRoot(stateRoot,'stateRoot');packageRoot=absoluteRoot(packageRoot,'packageRoot');bundledRoot=absoluteRoot(bundledRoot,'bundledRoot');
 if(legacyRoot!==undefined&&legacyRoot!==null)legacyRoot=absoluteRoot(legacyRoot,'legacyRoot');
 const registryPath=path.join(stateRoot,'registry.json'),payloadRoot=path.join(stateRoot,'modules','imported');
 const hadRegistry=fs.existsSync(registryPath),hadPayload=fs.existsSync(payloadRoot),existingInstallation=hadRegistry||hadPayload;
 let freshInstall=false,migrated=false;
 fs.mkdirSync(stateRoot,{recursive:true});
 if(!existingInstallation){
  const previousPayload=legacyRoot&&path.join(legacyRoot,'payload'),canMigrate=migrate&&previousPayload&&directory(previousPayload);
  const source=canMigrate?previousPayload:path.join(bundledRoot,'base-payload');
  if(!directory(source))throw Error('安装包缺少公共设备依赖：base-payload');
  if(canMigrate)copyMissing(source,payloadRoot);
  else{
   fs.mkdirSync(payloadRoot,{recursive:true});
   // Only the public dependencies agreed with the installer are copied. No
   // bundled registry, data, browser state or machine-local credentials enter
   // a fresh user's state directory.
   for(const name of PUBLIC_DEPENDENCIES)if(directory(path.join(source,name)))copyMissing(path.join(source,name),path.join(payloadRoot,name));
  }
  fs.writeFileSync(path.join(payloadRoot,'lab-config.json'),JSON.stringify({python:path.join(payloadRoot,'python','python.exe')},null,2));
  const registry={schema:1,target:'standalone',plugins:[],autoRepair:false};
  if(canMigrate){
   registry.plugins=readRegistry(path.join(legacyRoot,'registry.json')).plugins;
   registry.importedFrom=legacyRoot;registry.importedAt=new Date().toISOString();
   const previousData=path.join(legacyRoot,'data');if(directory(previousData))copyMissing(previousData,path.join(stateRoot,'data'));
   migrated=true;
  }else freshInstall=true;
  fs.writeFileSync(registryPath,JSON.stringify(registry,null,2),{flag:'wx'});
 }else if(!hadRegistry){
  // A pre-existing standalone payload is user-owned. Register an empty home
  // without replacing any of its files or importing a different installation.
  fs.writeFileSync(registryPath,JSON.stringify({schema:1,target:'standalone',plugins:[],autoRepair:false},null,2),{flag:'wx'});
 }
 // New public dependencies also reach upgrades; existing files and device
 // configuration remain owned by the installation.
 for(const name of ['xiberia-audio-deps']){const source=path.join(bundledRoot,'base-payload',name);if(directory(source)&&!directory(path.join(payloadRoot,name)))copyMissing(source,path.join(payloadRoot,name));}
 return {payloadRoot,registryPath,freshInstall,migrated,existingInstallation,...seedCatalogs({packageRoot,bundledRoot})};
}

module.exports={prepareDesktopData};
