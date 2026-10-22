param([string]$Version='0.3.0-preview.4')
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$stage=Join-Path $root ('.handoff-work\generic-hid-'+$Version)
if(Test-Path -LiteralPath $stage){throw 'Build directory already exists; choose a new preview version.'}
[IO.Directory]::CreateDirectory($stage)|Out-Null
function Copy-BuildFile($From,$Relative){
  $dest=Join-Path $stage $Relative
  [IO.Directory]::CreateDirectory((Split-Path -Parent $dest))|Out-Null
  Copy-Item -LiteralPath (Join-Path $root $From) -Destination $dest
}
foreach($name in @('host.cjs','cards.js','native-cards.js','main-preload.cjs','local-server.cjs')){Copy-BuildFile ('library\host\'+$name) ('payload\'+$name)}
foreach($name in @('Install.cmd','Install.ps1','Repair.cmd','Repair.ps1','Uninstall.cmd','Uninstall.ps1')){Copy-BuildFile ('library\install\'+$name) $name}
Copy-BuildFile 'library\install\Manage.ps1' 'scripts\Manage.ps1'
foreach($name in @('appearance-store.cjs','keyboard-service.cjs','keyboard_model.py','windows_keyboard.py','test-session.cjs','windows_test_keys.py','via-eligibility.cjs')){Copy-BuildFile ('library\hid\'+$name) ('payload\generic-hid\hid\'+$name)}
foreach($name in @('mchose-ui.css','theme.css','components.js','hid-keyboard.css','hid-keyboard.js','input-visualizer.css','input-visualizer.js')){Copy-BuildFile ('library\ui\'+$name) ('payload\generic-hid\ui\'+$name)}
foreach($name in @('keymaps.js','LICENSE','UPSTREAM.json')){Copy-BuildFile ('library\vendor\input-tester\'+$name) ('payload\generic-hid\vendor\input-tester\'+$name)}
foreach($name in @('catalog.json','LICENSE','UPSTREAM.json')){Copy-BuildFile ('library\vendor\via\'+$name) ('payload\generic-hid\vendor\via\'+$name)}
foreach($name in @('via-offline.zip','via-corresponding-source.zip')){Copy-BuildFile ('library\vendor\via\'+$name) ('vendor\'+$name)}
foreach($name in @('hid-keyboard.html','hid-keyboard-page.js','hid-keyboard-preload.cjs')){Copy-BuildFile ('library\examples\'+$name) ('payload\generic-hid\examples\'+$name)}
Copy-BuildFile 'docs\GENERIC-HID-KEYBOARD.md' 'README.md'
Copy-BuildFile 'docs\KEY-REMAPPING-OPTIONS.md' 'KEY-REMAPPING-OPTIONS.md'
Copy-BuildFile 'library\LICENSE' 'LICENSE'
Copy-BuildFile 'razer-mini-se\PYTHON-SOURCE.json' 'PYTHON-SOURCE.json'
Copy-BuildFile 'razer-mini-se\vendor\python-3.13.16-win64.zip' 'vendor\python-3.13.16-win64.zip'
$files=@(Get-ChildItem -LiteralPath $stage -File -Recurse | Sort-Object FullName | ForEach-Object {
  @{path=$_.FullName.Substring($stage.Length+1).Replace('\','/');sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}
})
$manifest=@{id='hid';title='通用 HID 外设';version=$Version;stage='preview-release';files=$files;pluginFiles=@($files | Where-Object {$_.path.StartsWith('payload/')} | ForEach-Object {$_.path.Substring(8)});bundles=@(@{path='vendor/python-3.13.16-win64.zip';destination='python'},@{path='vendor/via-offline.zip';destination='generic-hid/vendor/via/app'});assets=@()}
[IO.File]::WriteAllText((Join-Path $stage 'manifest.json'),($manifest|ConvertTo-Json -Depth 12),(New-Object Text.UTF8Encoding($false)))
$dist=Join-Path $root 'dist'
[IO.Directory]::CreateDirectory($dist)|Out-Null
$zip=Join-Path $dist ('One4All-Generic-HID-'+$Version+'.zip')
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::CreateFromDirectory($stage,$zip)
Write-Output $stage
Write-Output $zip
