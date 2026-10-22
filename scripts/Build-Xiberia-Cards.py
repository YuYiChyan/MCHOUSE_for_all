"""Build independent, offline XIBERIA product card packages."""
from pathlib import Path
import argparse, hashlib, json, os, shutil, subprocess, zipfile

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'library/audio/xiberia'
VERSION='0.4.0-preview.2'

def digest(file):
    with file.open('rb') as stream:
        return hashlib.file_digest(stream,'sha256').hexdigest()

def text(file,value):
    file.parent.mkdir(parents=True,exist_ok=True)
    file.write_text(value,encoding='utf-8',newline='\n')

def copy(source,destination):
    destination.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(source,destination)

def dependency(source,destination):
    destination.parent.mkdir(parents=True,exist_ok=True)
    if destination.exists():
        if os.path.samefile(source,destination):return
        destination.unlink()
    try:os.link(source,destination)
    except OSError:shutil.copyfile(source,destination)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--official-installer',type=Path,required=True)
    parser.add_argument('--models',nargs='*')
    parser.add_argument('--archives',action='store_true')
    args=parser.parse_args()
    models=json.loads((SOURCE/'catalog.json').read_text(encoding='utf-8'))
    selected=[m for m in models if not args.models or m['id'] in args.models]
    if args.models and set(args.models)-{m['id'] for m in models}:raise ValueError('Unknown product')
    official=json.loads((SOURCE/'official-source.json').read_text(encoding='utf-8'))
    if digest(args.official_installer)!=official['sha256']:raise ValueError('Original installer differs from the pinned source')
    build=ROOT/'dist/xiberia-fixed-cards'
    build.mkdir(parents=True,exist_ok=True)
    executable=build/'XiberiaBridge.exe'
    compiler=Path(os.environ['WINDIR'])/'Microsoft.NET/Framework/v4.0.30319/csc.exe'
    subprocess.run([str(compiler),'/nologo','/target:winexe','/platform:x86','/optimize+','/r:System.Web.Extensions.dll','/out:'+str(executable),str(SOURCE/'NativeBridge.cs')],check=True)
    mappings=json.loads((ROOT/'library/runtime-map.json').read_text(encoding='utf-8'))
    projects=[]
    for model in selected:
        project=ROOT/'xiberia-devices'/model['folder']
        project.mkdir(parents=True,exist_ok=True)
        for entry in mappings:
            if entry.get('projects') and 'xiberia-audio' not in entry['projects']:continue
            copy(ROOT/'library'/entry['source'],project/entry['target'])
        for name in ['Install.cmd','Repair.cmd','Repair.ps1','Uninstall.cmd','Uninstall.ps1']:
            copy(ROOT/'library/install'/name,project/name)
        copy(SOURCE/'Install-Xiberia.ps1',project/'Install.ps1')
        copy(SOURCE/'official-source.json',project/'official-source.json')
        copy(SOURCE/'DEPENDENCIES.json',project/'DEPENDENCIES.json')
        for name in ['LICENSE','LICENSE-COMMON','PYTHON-SOURCE.json','requirements-lock.txt']:
            copy(ROOT/'blackshark-v2'/name,project/name)
        for name in ['python-3.13.16-win64.zip','blackshark-deps.zip','pycaw-source.zip']:
            dependency(ROOT/'blackshark-v2/vendor'/name,project/'vendor'/name)
        dependency(args.official_installer.resolve(),project/'vendor'/('XIBERIA-HUB-Setup-v'+official['version']+'.exe'))
        copy(executable,project/'payload/xiberia-runtime/XiberiaBridge.exe')
        template=(SOURCE/'xiberia.html').read_text(encoding='utf-8')
        template=template.replace('data-device="k03s"','data-device="'+model['id']+'"').replace('<title>XIBERIA K03S</title>','<title>'+model['title']+'</title>')
        text(project/'payload'/(model['id']+'.html'),template)
        text(project/'payload/mchose-ui/xiberia-catalog.js','window.One4AllXiberiaCatalog='+json.dumps(models,ensure_ascii=False)+';\n')
        for color in model['colors']:
            copy(SOURCE/'product-assets'/color['file'],project/'payload/product-assets'/color['file'])
        visual='homepage-and-tabs-observed' if model['id']=='xiberia-t10' else 'not-reviewed'
        visual_note=('本机已看到首页卡片、可切换五个分页，并可点击“打开官方 APP”；未连接对应耳机，硬件操作尚未验证。'
                     if model['id']=='xiberia-t10' else '尚未逐款进行视觉验收；硬件操作尚未验证。')
        text(project/'VALIDATION.md',f'''# {model['title']} · 待验证

{visual_note}

本包只注册 {model['title']} 一张固定卡片。安装、修复、卸载沿用已有 One4All 流程；没有耳机自动发现、自动添加卡片或启动扫描进程。

请在对应型号 Issue 反馈 Windows / M HUB / 固件版本、连接方式，以及卡片进入、音量、静音、麦克风、EQ、各项音效、返回和卸载的实际结果。每项填写通过、失败或未测试。

只有收到明确实机结果并完成确认后，才移除“待验证”标记；视觉通过不代表音频功能已经通过。
''')
        text(project/'README.md',f'''# {model['title']}

版本：{VERSION} · **待验证**

![{model['title']}](payload/product-assets/{model['colors'][0]['file']})

完整解压后运行 `Install.cmd`。本包包含此产品的卡片、原厂商品图及配色、设备页面、注入 / 修复 / 卸载程序、Python 与音频依赖，以及未修改的官方 X HUB {official['version']} 原版安装器。首次安装官方音频组件后可能需要重启；安装器不会主动重启 Windows。

运行 `Uninstall.cmd` 只取消本型号的卡片，保留其他已安装卡片。

界面包含声音输出、均衡器、空间音效、麦克风、设备信息五个分页；“打开官方 APP”位于设备信息。设备未连接时读数显示为空，控制项按实际能力开放。

## 商品图与配色

'''+''.join(f"![{c['label']}](payload/product-assets/{c['file']})\n\n" for c in model['colors'])+'''## 反馈

[提交型号验证反馈](https://github.com/YuYiChyan/MCHOUSE_for_all/issues/new?template=device-validation.yml)。具体验证状态见 [VALIDATION.md](VALIDATION.md)。
''')
        files=[{'path':file.relative_to(project).as_posix(),'sha256':digest(file)} for file in sorted(project.rglob('*')) if file.is_file() and file.name!='manifest.json']
        manifest={'id':model['id'],'title':model['title'],'version':VERSION,'stage':'unverified','validation':{'visual':visual,'hardware':'unverified'},'files':files,'bundles':[{'path':'vendor/python-3.13.16-win64.zip','destination':'python'},{'path':'vendor/blackshark-deps.zip','destination':'xiberia-audio-deps'}],'assets':[],'pluginFiles':[f['path'][8:] for f in files if f['path'].startswith('payload/')]}
        text(project/'manifest.json',json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
        projects.append({'id':model['id'],'folder':project.relative_to(ROOT).as_posix(),'title':model['title'],'route':'usb-audio-native','asset':model['folder'],'stage':'unverified','validation':{'visual':visual,'hardware':'unverified'}})
        if args.archives:
            target=build/(model['folder']+'-v'+VERSION+'-win64.zip')
            with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
                for file in sorted(project.rglob('*')):
                    if file.is_file():archive.write(file,model['folder']+'/'+file.relative_to(project).as_posix())
            print('Built '+target.name,flush=True)
        else:print('Prepared '+model['title']+' -> '+str(project.relative_to(ROOT)),flush=True)
    catalog=json.loads((ROOT/'devices.json').read_text(encoding='utf-8'))
    retained=[d for d in catalog if d['id']!='xiberia' and d['id'] not in {m['id'] for m in models}]
    previous={d['id']:d for d in catalog if d['id'] in {m['id'] for m in models}}
    previous.update({d['id']:d for d in projects})
    text(ROOT/'devices.json',json.dumps(retained+[previous[m['id']] for m in models if m['id'] in previous],ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__':main()
