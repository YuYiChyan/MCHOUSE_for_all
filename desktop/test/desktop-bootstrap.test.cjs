'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {prepareDesktopData}=require('../core/desktop-bootstrap.cjs');
function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,typeof value==='string'?value:JSON.stringify(value));}
function fixture(t){
 const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'one4all-bootstrap-test-'));
 t.after(()=>{const resolved=path.resolve(tempRoot);assert.equal(path.dirname(resolved),path.resolve(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('one4all-bootstrap-test-'));fs.rmSync(resolved,{recursive:true,force:true});});
 const options={stateRoot:path.join(tempRoot,'state'),legacyRoot:path.join(tempRoot,'legacy'),packageRoot:path.join(tempRoot,'cache'),bundledRoot:path.join(tempRoot,'resources')};
 for(const name of ['python','openrazer-win','g309-deps'])write(path.join(options.bundledRoot,'base-payload',name,'public.txt'),'public '+name);
 return {...options,payloadRoot:path.join(options.stateRoot,'modules','imported')};
}
const seed=(options,brand,catalog)=>write(path.join(options.bundledRoot,'vendor-resources',brand,'catalog.json'),catalog);

test('fresh installation copies public dependencies and starts with an empty registry without a legacy host',t=>{
 const options=fixture(t);write(path.join(options.bundledRoot,'base-payload','data','api-keys.json'),'must not import');write(path.join(options.bundledRoot,'base-payload','registry.json'),{plugins:[{id:'developer-card'}]});
 const result=prepareDesktopData(options),registry=JSON.parse(fs.readFileSync(result.registryPath,'utf8'));
 assert.equal(result.freshInstall,true);assert.equal(result.migrated,false);assert.equal(result.existingInstallation,false);assert.deepEqual(registry.plugins,[]);
 for(const name of ['python','openrazer-win','g309-deps'])assert.equal(fs.readFileSync(path.join(result.payloadRoot,name,'public.txt'),'utf8'),'public '+name);
 assert.equal(fs.existsSync(path.join(result.payloadRoot,'data')),false);assert.equal(fs.existsSync(path.join(result.payloadRoot,'registry.json')),false);
 assert.equal(JSON.parse(fs.readFileSync(path.join(result.payloadRoot,'lab-config.json'),'utf8')).python,path.join(result.payloadRoot,'python','python.exe'));
});

test('legacy migration preserves enabled cards and data and updates only the copied Python location',t=>{
 const options=fixture(t),plugins=[{id:'keyboard',enabled:true},{id:'razer',color:'black'}];write(path.join(options.legacyRoot,'payload','device-service.cjs'),'legacy module');write(path.join(options.legacyRoot,'payload','lab-config.json'),{python:'old-python'});write(path.join(options.legacyRoot,'registry.json'),{plugins});write(path.join(options.legacyRoot,'data','keyboard','appearance.json'),{color:'purple'});
 const result=prepareDesktopData(options),registry=JSON.parse(fs.readFileSync(result.registryPath,'utf8'));
 assert.equal(result.migrated,true);assert.equal(result.freshInstall,false);assert.deepEqual(registry.plugins,plugins);assert.equal(registry.importedFrom,options.legacyRoot);
 assert.equal(fs.readFileSync(path.join(result.payloadRoot,'device-service.cjs'),'utf8'),'legacy module');assert.equal(fs.existsSync(path.join(options.stateRoot,'data','keyboard','appearance.json')),true);
 assert.equal(JSON.parse(fs.readFileSync(path.join(options.legacyRoot,'payload','lab-config.json'),'utf8')).python,'old-python');
});

test('migrate:false ignores the explicitly supplied legacy installation and its settings',t=>{
 const options=fixture(t);write(path.join(options.legacyRoot,'payload','private-module.js'),'old');write(path.join(options.legacyRoot,'registry.json'),{plugins:[{id:'private'}]});write(path.join(options.legacyRoot,'data','credentials.json'),'private');
 const result=prepareDesktopData({...options,migrate:false});assert.equal(result.freshInstall,true);assert.equal(result.migrated,false);assert.equal(fs.existsSync(path.join(result.payloadRoot,'private-module.js')),false);assert.equal(fs.existsSync(path.join(options.stateRoot,'data')),false);assert.deepEqual(JSON.parse(fs.readFileSync(result.registryPath,'utf8')).plugins,[]);
});

test('existing standalone registry, payload and updated brand catalog remain byte-for-byte unchanged',t=>{
 const options=fixture(t),registryText='{ "plugins": [{"id":"existing"}], "custom": true }';write(path.join(options.stateRoot,'registry.json'),registryText);write(path.join(options.payloadRoot,'lab-config.json'),'keep configuration');write(path.join(options.payloadRoot,'python','public.txt'),'user python');
 write(path.join(options.packageRoot,'vendor-resources','razer','catalog.json'),'user updated catalog');seed(options,'razer',{devices:[]});write(path.join(options.bundledRoot,'vendor-resources','razer','new.bin'),'must not copy');
 const result=prepareDesktopData(options);assert.equal(result.existingInstallation,true);assert.equal(result.freshInstall,false);assert.deepEqual(result.seededBrands,[]);
 assert.equal(fs.readFileSync(result.registryPath,'utf8'),registryText);assert.equal(fs.readFileSync(path.join(options.payloadRoot,'lab-config.json'),'utf8'),'keep configuration');assert.equal(fs.readFileSync(path.join(options.payloadRoot,'python','public.txt'),'utf8'),'user python');assert.equal(fs.readFileSync(path.join(options.packageRoot,'vendor-resources','razer','catalog.json'),'utf8'),'user updated catalog');assert.equal(fs.existsSync(path.join(options.packageRoot,'vendor-resources','razer','new.bin')),false);
});

test('an existing payload without registry is preserved and receives only an empty registry',t=>{
 const options=fixture(t);write(path.join(options.payloadRoot,'lab-config.json'),'keep');const result=prepareDesktopData(options);assert.equal(result.existingInstallation,true);assert.equal(result.freshInstall,false);assert.equal(fs.readFileSync(path.join(result.payloadRoot,'lab-config.json'),'utf8'),'keep');assert.equal(fs.existsSync(path.join(result.payloadRoot,'python')),false);assert.deepEqual(JSON.parse(fs.readFileSync(result.registryPath,'utf8')).plugins,[]);
});

test('relative seeded artwork and runtime become local resources readable by the product catalogue',t=>{
 const options=fixture(t),models=require('../catalog/razer-mice.json').models.filter(m=>['razer-1532-00aa','razer-1532-00ab'].includes(m.id));
 seed(options,'razer',{devices:models.map(m=>({...m,variants:[{id:'black',imagePath:'assets/mouse.png'}],imagePaths:['assets/mouse.png'],reusableResources:[{key:'metadata',path:'assets/metadata.json'}]}))});
 write(path.join(options.bundledRoot,'vendor-resources','razer','assets','mouse.png'),'picture');write(path.join(options.bundledRoot,'vendor-resources','razer','assets','metadata.json'),{public:true});seed(options,'melgeek',{devices:[]});write(path.join(options.bundledRoot,'vendor-resources','melgeek','runtime','mghive_core_bg.wasm'),'public runtime');
 const result=prepareDesktopData(options),catalogFile=path.join(result.resourceRoot,'razer','catalog.json'),cache=JSON.parse(fs.readFileSync(catalogFile,'utf8')),brandRoot=path.join(result.resourceRoot,'razer');
 assert.deepEqual(result.seededBrands,['melgeek','razer']);assert.equal(cache.devices[0].variants[0].imagePath,path.join(brandRoot,'assets','mouse.png'));assert.equal(cache.devices[0].imagePaths[0],path.join(brandRoot,'assets','mouse.png'));assert.equal(cache.devices[0].reusableResources[0].path,path.join(brandRoot,'assets','metadata.json'));assert.equal(fs.existsSync(path.join(result.resourceRoot,'melgeek','runtime','mghive_core_bg.wasm')),true);
 const rows=require('../core/device-catalog.cjs').createDeviceCatalog({resourceRoot:result.resourceRoot}).list().devices.filter(m=>m.brand==='razer');assert.equal(rows.length,2);assert.ok(rows.every(m=>m.hasImage));const cards=require('../core/catalog-presentation.cjs').buildCatalogPresentation(rows);assert.equal(cards.length,1);assert.equal(cards[0].members.length,2);
 const previous=fs.readFileSync(catalogFile,'utf8');assert.deepEqual(prepareDesktopData(options).seededBrands,[]);assert.equal(fs.readFileSync(catalogFile,'utf8'),previous);
});

test('invalid bundled artwork paths never preserve developer-machine paths or escape the cache',t=>{
 const options=fixture(t);seed(options,'atk',{devices:[{id:'bad',variants:[{imagePath:'C:\\Users\\developer\\private.png'},{imagePath:'../outside.png'},{imagePath:'file:///C:/developer/picture.png'}],imagePaths:{valid:'assets/good.png',invalid:'/developer/image.png'}}]});
 const result=prepareDesktopData(options),catalog=JSON.parse(fs.readFileSync(path.join(result.resourceRoot,'atk','catalog.json'),'utf8'));assert.deepEqual(catalog.devices[0].variants.map(v=>v.imagePath),[null,null,null]);assert.equal(catalog.devices[0].imagePaths.invalid,null);assert.equal(catalog.devices[0].imagePaths.valid,path.join(result.resourceRoot,'atk','assets','good.png'));assert.equal(result.seedWarnings.length,4);assert.equal(JSON.stringify(catalog).includes('developer'),false);
});
