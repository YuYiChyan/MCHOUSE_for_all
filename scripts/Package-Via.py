"""Package the fixed VIA build and complete local dependency sources. MIT wrapper."""
from pathlib import Path
import json
import os
import zipfile

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / '.handoff-work/via-source'
dest = ROOT / 'library/vendor/via'
if len(json.loads((dest / 'catalog.json').read_text())) < 500:
    raise ValueError('VIA catalog missing')
with zipfile.ZipFile(dest / 'via-offline.zip', 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for file in sorted((source / 'dist').rglob('*')):
        if file.is_file():
            archive.write(file, file.relative_to(source / 'dist').as_posix())
    archive.write(dest / 'LICENSE', 'LICENSE')
    archive.write(dest / 'UPSTREAM.json', 'UPSTREAM.json')
links = []
count = 0
with zipfile.ZipFile(dest / 'via-corresponding-source.zip', 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for current, dirs, files in os.walk(source, followlinks=False):
        keep = []
        for name in dirs:
            item = Path(current) / name
            if name in ('.git', '.cache', '.bin') or item == source / 'dist':
                continue
            if item.is_symlink() or os.path.isjunction(item):
                real = item.resolve()
                if real.is_relative_to(source):
                    links.append([item.relative_to(source).as_posix(), real.relative_to(source).as_posix()])
                else:
                    raise ValueError('Dependency junction escapes source directory: ' + name)
            else:
                keep.append(name)
        dirs[:] = keep
        for name in files:
            item = Path(current) / name
            if name.endswith('.log') or name in ('.modules.yaml', '.npmrc') or item.is_symlink():
                continue
            archive.write(item, item.relative_to(source).as_posix())
            count += 1
    archive.writestr('one4all/dependency-links.json', json.dumps(links))
    archive.write(ROOT / 'scripts/Build-Via.cjs', 'one4all/Build-Via.cjs')
    archive.writestr('restore-links.cjs', """'use strict';
const fs=require('node:fs'),path=require('node:path'),root=__dirname;
function child(relative){const p=path.resolve(root,relative);if(!p.startsWith(root+path.sep))throw Error('Path escapes source root');return p;}
for(const [link,target]of require('./one4all/dependency-links.json')){const dest=child(link);if(!fs.existsSync(dest)){fs.mkdirSync(path.dirname(dest),{recursive:true});fs.symlinkSync(child(target),dest,process.platform==='win32'?'junction':'dir');}}
""")
    archive.writestr('BUILDING-One4All.txt',
        'VIA GPL-3.0 offline source snapshot with dependency sources and licenses.\n'
        'Windows x64 build: Node >=18; node restore-links.cjs; node one4all/Build-Via.cjs .\n'
        'Other platforms can use pnpm install --frozen-lockfile --ignore-scripts first.\n'
        'One4All changes: Windows glob normalization, local fonts, host theme initialization.\n'
        'See LICENSE and library/vendor/via/UPSTREAM.json in the host package.\n')
print(json.dumps({'sourceFiles': count, 'dependencyLinks': len(links),
                  'runtimeBytes': (dest / 'via-offline.zip').stat().st_size,
                  'sourceBytes': (dest / 'via-corresponding-source.zip').stat().st_size}))
