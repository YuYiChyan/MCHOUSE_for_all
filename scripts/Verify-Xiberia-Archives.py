"""Check the ten offline release archives and write their SHA-256 sums."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
catalog = json.loads((ROOT / 'library/audio/xiberia/catalog.json').read_text(encoding='utf-8'))
source = json.loads((ROOT / 'library/audio/xiberia/official-source.json').read_text(encoding='utf-8'))
folder = ROOT / 'dist/xiberia-fixed-cards'
archives = sorted(folder.glob('*-v0.4.0-preview.2-win64.zip'))
assert len(archives) == len(catalog) == 10, 'Expected exactly ten product archives'
sums = []

for model in catalog:
    archive = folder / f"{model['folder']}-v0.4.0-preview.2-win64.zip"
    assert archive in archives, f"Missing package: {model['id']}"
    with zipfile.ZipFile(archive) as package:
        prefix = model['folder'] + '/'
        entries = {item.filename for item in package.infolist() if not item.is_dir()}
        manifest = json.loads(package.read(prefix + 'manifest.json'))
        assert manifest['id'] == model['id'] and manifest['stage'] == 'unverified'
        assert manifest['validation']['hardware'] == 'unverified'
        expected = {prefix + item['path'] for item in manifest['files']}
        assert entries == expected | {prefix + 'manifest.json'}, model['id']
        required = {
            f"vendor/XIBERIA-HUB-Setup-v{source['version']}.exe",
            'vendor/python-3.13.16-win64.zip',
            'vendor/blackshark-deps.zip',
            'vendor/pycaw-source.zip',
            f"payload/{model['id']}.html",
            'Install.cmd', 'Repair.cmd', 'Uninstall.cmd',
        }
        required |= {'payload/product-assets/' + color['file'] for color in model['colors']}
        assert {prefix + item for item in required} <= entries, model['id']
        assert not any('supported-usb.json' in item for item in entries), model['id']
        for item in manifest['files']:
            h = hashlib.sha256()
            with package.open(prefix + item['path']) as stream:
                for block in iter(lambda: stream.read(1024 * 1024), b''):
                    h.update(block)
            assert h.hexdigest() == item['sha256'], f"{model['id']}: {item['path']}"
        official = next(item for item in manifest['files'] if item['path'].startswith('vendor/XIBERIA-HUB-Setup-'))
        assert official['sha256'] == source['sha256']
    h = hashlib.sha256()
    with archive.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    sums.append(f"{h.hexdigest()}  {archive.name}")
    print(f"Verified {model['id']}: {len(manifest['files'])} files, {archive.stat().st_size} bytes", flush=True)

(folder / 'SHA256SUMS.txt').write_text('\n'.join(sums) + '\n', encoding='ascii')
