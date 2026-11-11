'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');

const OUTPUT_LIMIT=64*1024;
const READ_LIMIT=2*1024*1024;
const skipDirectory=/^(?:node_modules|locales|translations|lang|cache|code cache|gpuCache|profiles?|user.?data|logs?|crashpads?|crashdumps?|session storage|local storage|indexeddb|network|cookies|downloads?|temp|tmp|\.git)$/i;
const hiddenFile=/(?:^|[\\/])(?:one4all[^/\\]*|preferences|local state|cookies|login data|credentials?[^/\\]*|tokens?[^/\\]*|secrets?[^/\\]*|\.env(?:\..*)?)$/i;
const interesting=/\.(?:js|cjs|mjs|jsc|proto|idl|dll|node|asar|exe)$|(?:^|[\\/])package\.json$/i;
const slash=value=>value.split(path.sep).join('/');
const expand=value=>String(value).replace(/%([^%]+)%/g,(_,key)=>process.env[key]||process.env[Object.keys(process.env).find(item=>item.toLowerCase()===key.toLowerCase())]||'%'+key+'%');
function summarizeJS(text){
  const channels=[],bridges=[],mappings=[];
  const seen=new Set();
  const aliases=new Map([['ipcRenderer','ipcRenderer'],['ipcMain','ipcMain']]);
  // Bundled preloads commonly destructure Electron into short variable names.
  // These entries are syntactic observations, not evaluation of bundled code.
  for(const match of text.slice(0,4096).matchAll(/\b(ipcRenderer|ipcMain)\s*:\s*([a-zA-Z_$][\w$]*)/g))aliases.set(match[2],match[1]);
  const receivers=[...aliases.keys()].map(value=>value.replace(/[$]/g,'\\$')).join('|');
  const regex=new RegExp('\\b('+receivers+')\\s*\\.\\s*(invoke|sendSync|send|handle|handleOnce|on|once)\\s*\\(\\s*[\x22\x27]([a-zA-Z0-9_.:\\/-]{1,160})[\x22\x27]','g');
  for(const match of text.matchAll(regex)){const side=aliases.get(match[1]);const key=side+':'+match[2]+':'+match[3];if(seen.has(key))continue;seen.add(key);channels.push({side,operation:match[2],name:match[3]});if(channels.length>=300)break;}
  for(const match of text.matchAll(/\bexposeInMainWorld\s*\(\s*['"]([a-zA-Z0-9_$.-]{1,100})['"]/g)){if(!bridges.includes(match[1]))bridges.push(match[1]);}
  const mappingRegex=new RegExp('\\b([a-zA-Z_$][\\w$]{0,100})\\s*:\\s*(?:async\\s+)?(?:\\(([^)]{0,180})\\)|([a-zA-Z_$][\\w$]*))\\s*=>\\s*(?:\\w+\\.)?(?:'+receivers+')\\.(invoke|send|sendSync)\\(\\s*[\x22\x27]([a-zA-Z0-9_.:\\/-]{1,160})[\x22\x27]','g');
  for(const match of text.matchAll(mappingRegex)){
    const parameters=(match[2]||match[3]||'').split(',').map(p=>p.trim().match(/^[a-zA-Z_$][\w$]*/)?.[0]).filter(Boolean);
    mappings.push({method:match[1],parameters,operation:match[4],channel:match[5]});if(mappings.length>=100)break;
  }
  return {bridges,channels,mappings,bytecodeLoader:/bytecode|\.jsc["']/.test(text)};
}
function summarizeSchema(text){
  // Only schema declarations reach the model, never comments, defaults, or data.
  return text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g,'').split(/\r?\n/).map(line=>line.trim()).filter(line=>/^(?:syntax\s*=|package\s+|import\s+|service\s+|message\s+|enum\s+|rpc\s+|interface\s+|typedef\s+|(?:repeated\s+|optional\s+)?[\w.<> ,]+\s+\w+\s*=\s*\d+\s*[;{])/.test(line)).join('\n').slice(0,5000);
}
function packageMetadata(json){
  const value=JSON.parse(json);const dependencies={};
  for(const [name,version] of Object.entries(value.dependencies||{}).slice(0,80))if(typeof version==='string')dependencies[name]=version.slice(0,120);
  const main=String(value.main||'').slice(0,200);
  return {name:String(value.name||'').slice(0,150),version:String(value.version||'').slice(0,80),main:/one4all/i.test(main)?null:main,localEntryOverride:/one4all/i.test(main),dependencies};
}

async function inspectPackage({entry,status={}}={}){
  if(!entry || typeof entry.id!=='string')throw new TypeError('entry.id is required');
  const start=Date.now(),deadline=start+14500;
  const evidence={schema:1,brandId:entry.id,name:entry.name||entry.brand||entry.id,collectedAt:new Date().toISOString(),sources:[],files:[],packages:[],interfaces:[],schemas:[],knownBackend:[],limitations:[],truncated:false,hardwareVerified:false};
  let visited=0,inputBytes=0;
  const check=()=>{if(Date.now()>deadline){evidence.truncated=true;throw Error('SCAN_DEADLINE');}};
  const exists=async file=>{try{const s=await fs.lstat(file);return s;}catch{return null;}};
  async function readChunk(file,length=READ_LIMIT,offset=0){check();if(inputBytes>24*1024*1024)throw Error('SCAN_READ_LIMIT');const handle=await fs.open(file,'r');try{const buffer=Buffer.alloc(Math.min(length,8*1024*1024));const result=await handle.read(buffer,0,buffer.length,offset);inputBytes+=result.bytesRead;return buffer.subarray(0,result.bytesRead);}finally{await handle.close();}}
  function identify(kind,file,note){if(!evidence.knownBackend.some(item=>item.kind===kind))evidence.knownBackend.push({kind,evidence:file,note});}
  function addSourceText(relative,buffer,declaredSize){
    const text=buffer.toString('utf8');
    if(relative.endsWith('package.json')){
      try{const metadata=packageMetadata(text);evidence.packages.push({path:relative,...metadata});if(metadata.dependencies.electron || /electron|mchose|razer/i.test(metadata.name))identify('electron-app',relative,'应用包元数据；不代表硬件接口可独立调用');}catch{}
    }else if(/\.(proto|idl)$/i.test(relative)){
      const declarations=summarizeSchema(text);if(declarations){evidence.schemas.push({path:relative,declarations,truncated:declaredSize>buffer.length});identify('schema',relative,'发现静态接口定义，尚未验证服务端和硬件调用');}
    }else{
      const result=summarizeJS(text);
      if(result.channels.length || result.bridges.length)evidence.interfaces.push({path:relative,...result,truncated:declaredSize>buffer.length});
      if(result.channels.length)identify('electron-ipc',relative,'这是原厂进程内的 IPC 名称及 preload 映射，不是公开远程 API，也未验证参数和回读');
      if(result.bytecodeLoader)identify('v8-bytecode',relative,'主实现可能使用 V8 字节码；本次未反编译或执行');
    }
  }
  async function inspectAsar(file,relative){
    try{
      const first=await readChunk(file,16);if(first.length<16)return;
      const headerSize=first.readUInt32LE(4),jsonSize=first.readUInt32LE(12);
      if(jsonSize>8*1024*1024||jsonSize<2||headerSize<jsonSize+8){evidence.limitations.push(relative+' 的 ASAR 索引超过本次读取上限');return;}
      const header=JSON.parse((await readChunk(file,jsonSize,16)).toString('utf8'));
      const nodes=[];
      function collect(files,prefix=''){for(const [name,node] of Object.entries(files||{})){if(nodes.length>=800)return;const item=prefix+name;if(skipDirectory.test(name)||hiddenFile.test(item)||node.link)continue;if(node.files)collect(node.files,item+'/');else if(interesting.test(item))nodes.push({path:item,...node});}}
      collect(header.files);identify('electron-asar',relative,'已只读解析 ASAR 文件索引及有限的脚本文本');
      nodes.sort((a,b)=>priority(a.path)-priority(b.path));
      for(const node of nodes.slice(0,220)){
        check();const virtual=relative+'!/'+node.path;
        if(evidence.files.length<500)evidence.files.push({path:virtual,bytes:node.size||0,container:'asar'});
        if(!shouldRead(node.path))continue;
        if(node.unpacked){const unpacked=path.resolve(file+'.unpacked',node.path);if(!unpacked.startsWith(path.resolve(file+'.unpacked')+path.sep))continue;const info=await exists(unpacked);if(info?.isFile())addSourceText(virtual,await readChunk(unpacked),info.size);}
        else if(/^\d+$/.test(String(node.offset))&&Number.isFinite(node.size))addSourceText(virtual,await readChunk(file,Math.min(READ_LIMIT,node.size),8+headerSize+Number(node.offset)),node.size);
      }
    }catch(error){if(error.message==='SCAN_DEADLINE')throw error;evidence.limitations.push(relative+' 的只读 ASAR 摘要未完成：'+error.message.slice(0,100));}
  }
  function priority(file){return /preload/i.test(file)?0:/package\.json$/.test(file)?1:/\.(proto|idl)$/.test(file)?2:/main.*\.(js|cjs)$|(?:^|\/)index\.(js|cjs)$/.test(file)?3:/\.asar$/.test(file)?4:5;}
  function shouldRead(file){return /package\.json$|\.(proto|idl)$/.test(file)||(/\.(?:js|cjs|mjs)$/.test(file)&&/(?:preload|bridge|ipc|main|service|protocol|(?:^|\/)index\.)/i.test(file));}
  async function inspectRoot(root,sourceId){
    const queue=[{dir:root,depth:0}],files=[];
    while(queue.length && visited<2500){check();const current=queue.shift();let entries;try{entries=await fs.readdir(current.dir,{withFileTypes:true});}catch{continue;}
      for(const item of entries){visited++;if(visited>2500){evidence.truncated=true;break;}if(item.isSymbolicLink()||hiddenFile.test(item.name))continue;const full=path.join(current.dir,item.name);if(item.isDirectory()){if(current.depth<7&&!skipDirectory.test(item.name))queue.push({dir:full,depth:current.depth+1});}else if(item.isFile()&&interesting.test(item.name))files.push(full);}
    }
    files.sort((a,b)=>priority(a)-priority(b));
    for(const file of files){check();const info=await exists(file);if(!info?.isFile())continue;const relative=sourceId+'/'+slash(path.relative(root,file));if(evidence.files.length<500)evidence.files.push({path:relative,bytes:info.size});else evidence.truncated=true;
      if(/\.(?:dll|node)$/i.test(file))identify('native-libraries',relative,'存在本机库文件；未加载 DLL，未确认导出函数或调用约定');
      if(/\.jsc$/i.test(file))identify('v8-bytecode',relative,'发现编译字节码，仅记录路径与大小');
      if(/\.asar$/i.test(file))await inspectAsar(file,relative);
      else if(shouldRead(file))addSourceText(relative,await readChunk(file),info.size);
    }
  }
  async function listZip(file){
    const info=await exists(file);if(!info?.isFile())return [];
    const tail=await readChunk(file,Math.min(info.size,65557),Math.max(0,info.size-65557));let at=-1;
    for(let i=tail.length-22;i>=0;i--)if(tail.readUInt32LE(i)===0x06054b50){at=i;break;}
    if(at<0)return [];
    const centralSize=tail.readUInt32LE(at+12),offset=tail.readUInt32LE(at+16);
    if(centralSize>READ_LIMIT||offset+centralSize>info.size)return [];
    const central=await readChunk(file,centralSize,offset),items=[];let cursor=0;
    while(cursor+46<=central.length&&central.readUInt32LE(cursor)===0x02014b50&&items.length<50){
      const nameSize=central.readUInt16LE(cursor+28),extraSize=central.readUInt16LE(cursor+30),commentSize=central.readUInt16LE(cursor+32);const name=central.subarray(cursor+46,cursor+46+nameSize).toString('utf8');
      if(!hiddenFile.test(name))items.push({path:name.slice(0,400),bytes:central.readUInt32LE(cursor+24)});cursor+=46+nameSize+extraSize+commentSize;
    }return items;
  }
  try{
    const candidatePaths=[status.installedPath,...(entry.installedExecutables||[])].filter(Boolean).map(expand).map(value=>path.resolve(value));
    const roots=new Set();
    for(const candidate of candidatePaths){check();const info=await exists(candidate);if(!info?.isFile())continue;const root=path.dirname(candidate);if(roots.has(root))continue;
      // Catalogue executables point at application installation directories. Never
      // recursively inspect a profile, user home, arbitrary drive root, or junction.
      const stat=await exists(root);if(!stat?.isDirectory()||stat.isSymbolicLink()||root===path.parse(root).root||/^(?:users|windows)$/i.test(path.basename(root))||skipDirectory.test(path.basename(root)))continue;
      roots.add(root);const id='installed-'+roots.size;evidence.sources.push({id,type:'installed-application',executable:path.basename(candidate)});await inspectRoot(root,id);
    }
    if(status.downloadPath){const file=path.resolve(status.downloadPath),info=await exists(file);if(info?.isFile()){
      const download={id:'download',type:'installer',filename:path.basename(file),bytes:info.size,sha256:status.sha256||null};
      if(/\.zip$/i.test(file))download.archiveEntries=await listZip(file);
      else {const header=await readChunk(file,64);download.format=header[0]===0x4d&&header[1]===0x5a?'windows-executable':'unknown';}
      evidence.sources.push(download);evidence.limitations.push('安装包仅提取结构或文件元数据；没有执行安装器，也没有从下载完成推定已支持硬件。');
    }}
  }catch(error){evidence.truncated=true;evidence.limitations.push(error.message==='SCAN_DEADLINE'?'达到 15 秒扫描预算，返回已取得证据。':error.message==='SCAN_READ_LIMIT'?'达到文本读取预算，返回已取得证据。':'部分文件读取失败：'+error.message.slice(0,160));}
  if(!evidence.sources.some(source=>source.type==='installed-application'))evidence.limitations.push('没有找到已安装的应用目录，无法确认真实 preload、服务端实现或设备协议。');
  if(!evidence.interfaces.length&&!evidence.schemas.length)evidence.limitations.push('本次没有提取到可用接口声明；需要进一步拆包或由开发者补充协议资料，不能据此生成可运行硬件适配。');
  if(evidence.knownBackend.some(item=>item.kind==='v8-bytecode'))evidence.limitations.push('存在 JSC 字节码，IPC 名称可作为索引，但处理逻辑与参数结构尚未完整取得。');
  if(entry.id==='razer'){
    try{
      const reference=JSON.parse((await fs.readFile(path.join(__dirname,'../research/razer-interface-evidence.json'),'utf8')).replace(/^\uFEFF/,''));
      const matched=evidence.packages.some(item=>item.version===reference.installedVersion&&item.path.includes('.asar!/'));
      if(matched){
        const {sourceArchive,localExtractDirectory,...details}=reference;
        evidence.vendorDetails={...details,source:'research/razer-interface-evidence.json',versionMatched:true,liveSourceHashesRechecked:false};
        identify('native-ffi-declarations','research/razer-interface-evidence.json','同安装版本的静态拆包资料含函数签名与参数；本次未重校验全部源文件哈希，也未调用硬件');
      }else evidence.limitations.push('已有雷蛇拆包资料与当前读取的应用版本不匹配，本次未附入旧接口签名。');
    }catch{}
  }
  evidence.limitations.push('所有接口条目均为静态证据，未执行设备命令、安装程序或账号操作。');
  evidence.elapsedMs=Date.now()-start;
  const size=()=>Buffer.byteLength(JSON.stringify(evidence));
  while(size()>OUTPUT_LIMIT && evidence.files.length){evidence.files.pop();evidence.truncated=true;}
  while(size()>OUTPUT_LIMIT && evidence.interfaces.some(item=>item.mappings?.length)){evidence.interfaces.findLast(item=>item.mappings?.length).mappings.pop();evidence.truncated=true;}
  while(size()>OUTPUT_LIMIT && evidence.interfaces.some(item=>item.channels?.length)){evidence.interfaces.findLast(item=>item.channels?.length).channels.pop();evidence.truncated=true;}
  while(size()>OUTPUT_LIMIT && evidence.schemas.length){evidence.schemas.pop();evidence.truncated=true;}
  while(size()>OUTPUT_LIMIT && evidence.packages.length){evidence.packages.pop();evidence.truncated=true;}
  while(size()>OUTPUT_LIMIT && evidence.interfaces.length){evidence.interfaces.pop();evidence.truncated=true;}
  if(size()>OUTPUT_LIMIT && evidence.vendorDetails){delete evidence.vendorDetails;evidence.truncated=true;}
  return evidence;
}

module.exports={inspectPackage,summarizeJS,summarizeSchema,OUTPUT_LIMIT};
