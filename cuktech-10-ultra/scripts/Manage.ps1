param(
  [ValidateSet('Install','Repair','Uninstall','Watch')][string]$Action='Install',
  [string]$Target='',
  [string]$StateRoot=(Join-Path $env:LOCALAPPDATA 'One4All'),
  [switch]$NoWatch,
  [switch]$SkipAssets
)
$ErrorActionPreference='Stop'
$script:Utf8=New-Object System.Text.UTF8Encoding($false)
function Write-Utf8($Path,$Value) {
  $parent=Split-Path -Parent $Path
  [IO.Directory]::CreateDirectory($parent) | Out-Null
  $tmp=$Path+'.one4all-tmp'
  [IO.File]::WriteAllText($tmp,$Value,$script:Utf8)
  Move-Item -LiteralPath $tmp -Destination $Path -Force
}
function Read-Json($Path) { Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json }
function Save-Json($Path,$Value) { Write-Utf8 $Path ($Value | ConvertTo-Json -Depth 24) }
function Get-Sha256($Path) {
  $stream=[IO.File]::OpenRead($Path)
  $algorithm=[Security.Cryptography.SHA256]::Create()
  try{return ([BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace('-','').ToLowerInvariant()}
  finally{$stream.Dispose();$algorithm.Dispose()}
}
function Resolve-Child($Root,$Relative) {
  $r=[IO.Path]::GetFullPath($Root).TrimEnd('\')+'\'
  $p=[IO.Path]::GetFullPath((Join-Path $r $Relative))
  if(-not $p.StartsWith($r,[StringComparison]::OrdinalIgnoreCase)){throw 'Path escapes expected directory'}
  return $p
}
$StateRoot=[IO.Path]::GetFullPath($StateRoot)
$registryPath=Join-Path $StateRoot 'registry.json'
if(-not $Target -and (Test-Path -LiteralPath $registryPath)){$Target=(Read-Json $registryPath).target}
if(-not $Target){$Target=Join-Path $env:ProgramFiles 'MCHOSE HUB'}
$Target=[IO.Path]::GetFullPath($Target)
$appRoot=Join-Path $Target 'resources\app'
$packagePath=Join-Path $appRoot 'package.json'
$payload=Join-Path $StateRoot 'payload'
$engine=Join-Path $StateRoot 'engine'
$hookName='one4all-loader.cjs'
function Read-Registry {
  if(Test-Path -LiteralPath $registryPath){return Read-Json $registryPath}
  return [pscustomobject]@{schema=1;target=$Target;plugins=@();autoRepair=$false}
}
function Get-TargetProcesses {
  @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
    try {$_.Path -and ([IO.Path]::GetFullPath($_.Path)).StartsWith($Target.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)} catch {$false}
  } | Where-Object {$_.ProcessName -notmatch 'Uninstall'})
}
function Assert-App {
  if(-not(Test-Path -LiteralPath $packagePath)){throw 'MCHOSE unpacked resources/app/package.json not found. Pass -Target explicitly. ASAR-only installations are unsupported.'}
  $p=Read-Json $packagePath
  if($p.name -ne 'MCHOSEHUB'){throw 'Target is not a supported MCHOSE HUB installation'}
  return $p
}
function Repair-Hook {
  $p=Assert-App
  $metaPath=Join-Path $appRoot 'one4all-original.json'
  $current=([string]$p.main).Replace('\','/').TrimStart('./')
  if($current -eq $hookName){
    if(-not(Test-Path -LiteralPath $metaPath)){throw 'Original entry metadata missing; refusing to guess'}
    $original=(Read-Json $metaPath).main
  }else{
    $original=[string]$p.main
    $originalPath=Resolve-Child $appRoot $original
    if(-not(Test-Path -LiteralPath $originalPath -PathType Leaf)){throw 'Original MCHOSE main entry is missing'}
    $backupId=Get-Sha256 $packagePath
    $backupDir=Join-Path $StateRoot ('backups\'+$backupId)
    [IO.Directory]::CreateDirectory($backupDir)|Out-Null
    if(-not(Test-Path -LiteralPath (Join-Path $backupDir 'package.json'))){Copy-Item -LiteralPath $packagePath -Destination (Join-Path $backupDir 'package.json')}
    Save-Json $metaPath @{main=$original;packageSha256=$backupId;installedAt=[DateTime]::UtcNow.ToString('o')}
  }
  $hostLiteral=(Join-Path $payload 'host.cjs') | ConvertTo-Json -Compress
  $stateLiteral=$StateRoot | ConvertTo-Json -Compress
  $loader=@"
'use strict';
const fs = require('fs'), path = require('path');
const meta = JSON.parse(fs.readFileSync(path.join(__dirname, 'one4all-original.json'), 'utf8'));
try { require($hostLiteral).start({ stateRoot: $stateLiteral }); }
catch (error) { console.error('[One4All] extension failed:', error.message); }
const entry = path.resolve(__dirname, meta.main);
if (!entry.startsWith(__dirname + path.sep) || entry === __filename) throw new Error('Invalid original MCHOSE entry');
require(entry);
"@
  $loaderPath=Join-Path $appRoot $hookName
  if(-not(Test-Path -LiteralPath $loaderPath) -or [IO.File]::ReadAllText($loaderPath) -ne $loader){Write-Utf8 $loaderPath $loader}
  if($current -ne $hookName){$p.main='./'+$hookName;Save-Json $packagePath $p}
}
function Restore-Hook {
  $p=Assert-App
  $metaPath=Join-Path $appRoot 'one4all-original.json'
  if(([string]$p.main).Replace('\','/').TrimStart('./') -eq $hookName){
    if(-not(Test-Path -LiteralPath $metaPath)){throw 'Original entry metadata missing'}
    $p.main=(Read-Json $metaPath).main
    Save-Json $packagePath $p
  }
  foreach($name in @($hookName,'one4all-original.json')){
    $file=Resolve-Child $appRoot $name
    if(Test-Path -LiteralPath $file){Remove-Item -LiteralPath $file -Force}
  }
}
function Get-Asset($Asset) {
  $dest=Resolve-Child $payload $Asset.path
  if(Test-Path -LiteralPath $dest){
    if(-not $Asset.sha256 -or (Get-Sha256 $dest) -eq $Asset.sha256){return}
  }
  [IO.Directory]::CreateDirectory((Split-Path -Parent $dest))|Out-Null
  $tmp=$dest+'.download'
  try {
    for($attempt=1;$attempt -le 3;$attempt++){
      try{Invoke-WebRequest -Uri $Asset.url -OutFile $tmp -UseBasicParsing -TimeoutSec 60;break}
      catch{if($attempt -eq 3){throw};Start-Sleep -Seconds (2*$attempt)}
    }
    if($Asset.sha256 -and (Get-Sha256 $tmp) -ne $Asset.sha256){throw ('Asset checksum mismatch: '+$Asset.path)}
    Move-Item -LiteralPath $tmp -Destination $dest -Force
  }finally{if(Test-Path -LiteralPath $tmp){Remove-Item -LiteralPath $tmp -Force}}
}
function Prepare-Icons {
  $assets=Join-Path $appRoot 'bundled\renderer\refresh-assets'
  $cssFile=Get-ChildItem -LiteralPath $assets -Filter '*.css' -ErrorAction SilentlyContinue | Select-Object -First 1
  if(-not $cssFile){throw 'Installed MCHOSE icon resources were not found'}
  $css=[IO.File]::ReadAllText($cssFile.FullName)
  $rules=[regex]::Matches($css,'(?:@font-face|\.iconfont|\.icon-[\w-]+(?:::?before)?)[^{]*\{[^}]*\}') | ForEach-Object {$_.Value}
  $rules=@($rules | Where-Object {$_ -notmatch '^@font-face' -or $_ -match 'iconfont'})
  if($rules.Count -lt 10){throw 'Installed icon CSS format is unsupported'}
  foreach($rel in @('mchose-ui','tank68-local\theme')){
    $dest=Join-Path $payload $rel
    [IO.Directory]::CreateDirectory($dest)|Out-Null
    Write-Utf8 (Join-Path $dest 'mchose-icons.css') ($rules -join "`n")
    Get-ChildItem -LiteralPath $assets -Filter 'iconfont-*' | Where-Object {$_.Extension -in @('.woff','.woff2','.ttf','.svg')} | ForEach-Object {Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $dest $_.Name) -Force}
  }
}
function Install-Watcher {
  if(-not(Get-Command Register-ScheduledTask -ErrorAction SilentlyContinue)){
    Import-Module (Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\Modules\ScheduledTasks\ScheduledTasks.psd1') -ErrorAction Stop
  }
  $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $name='One4All-MCHOSE-'+$sid
  $args='-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "'+(Join-Path $engine 'Manage.ps1')+'" -Action Watch -StateRoot "'+$StateRoot+'"'
  $taskAction=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $args
  $trigger=New-ScheduledTaskTrigger -AtLogOn -User ([Security.Principal.WindowsIdentity]::GetCurrent().Name)
  $principal=New-ScheduledTaskPrincipal -UserId $sid -LogonType Interactive -RunLevel Highest
  $settings=New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
  Register-ScheduledTask -TaskName $name -Action $taskAction -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
  Start-ScheduledTask -TaskName $name
}
if($Action -eq 'Watch'){
  $watchName='Local\One4All-'+[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($StateRoot)).Replace('/','_')
  $watchMutex=New-Object Threading.Mutex($false,$watchName)
  if(-not $watchMutex.WaitOne(0)){exit 0}
  try {
    $stableHash=''
    while(Test-Path -LiteralPath $registryPath){
      $reg=Read-Registry
      if(-not $reg.autoRepair -or @($reg.plugins).Count -eq 0){break}
      try {
        if((Test-Path -LiteralPath $packagePath) -and @(Get-TargetProcesses).Count -eq 0){
          $hash=Get-Sha256 $packagePath
          if($hash -eq $stableHash){
            & (Join-Path $engine 'Manage.ps1') -Action Repair -StateRoot $StateRoot -NoWatch -SkipAssets | Out-Null
          }
          $stableHash=$hash
        }else{$stableHash=''}
      }catch{Write-Utf8 (Join-Path $StateRoot 'repair-error.log') ($_.Exception.Message)}
      Start-Sleep -Seconds 15
    }
  }finally{$watchMutex.ReleaseMutex();$watchMutex.Dispose()}
  exit 0
}
[IO.Directory]::CreateDirectory($StateRoot)|Out-Null
$lockPath=Join-Path $StateRoot 'install.lock'
$lock=[IO.File]::Open($lockPath,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
$restartExe=$null
try {
  $reg=Read-Registry
  if([IO.Path]::GetFullPath($reg.target) -ne $Target){throw 'StateRoot already belongs to a different installation'}
  Assert-App | Out-Null
  $running=@(Get-TargetProcesses)
  if($running.Count -gt 0){
    if($Action -eq 'Repair'){Write-Output 'App is running; repair deferred until it closes.';exit 0}
    $main=$running | Where-Object {$_.MainWindowHandle -ne 0} | Select-Object -First 1
    if($main){$restartExe=$main.Path;$main.CloseMainWindow() | Out-Null;Start-Sleep -Seconds 3}
    foreach($proc in @(Get-TargetProcesses)){Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue}
  }
  if($Action -eq 'Install'){
    $manifest=Read-Json (Join-Path $PSScriptRoot '..\manifest.json')
    foreach($f in $manifest.files){
      $source=Resolve-Child (Join-Path $PSScriptRoot '..') $f.path
      if((Get-Sha256 $source) -ne $f.sha256){throw ('Package checksum mismatch: '+$f.path)}
    }
    [IO.Directory]::CreateDirectory($payload)|Out-Null
    foreach($f in $manifest.files | Where-Object {$_.path.StartsWith('payload/')}){
      $relative=$f.path.Substring(8)
      $dest=Resolve-Child $payload $relative
      [IO.Directory]::CreateDirectory((Split-Path -Parent $dest))|Out-Null
      Copy-Item -LiteralPath (Resolve-Child (Join-Path $PSScriptRoot '..') $f.path) -Destination $dest -Force
    }
    foreach($bundle in $manifest.bundles){
      $zip=Resolve-Child (Join-Path $PSScriptRoot '..') $bundle.path
      $dest=Resolve-Child $payload $bundle.destination
      [IO.Directory]::CreateDirectory($dest)|Out-Null
      Add-Type -AssemblyName System.IO.Compression.FileSystem
      $archive=[IO.Compression.ZipFile]::OpenRead($zip)
      try{
        foreach($entry in $archive.Entries){
          $out=Resolve-Child $dest $entry.FullName
          if($entry.FullName.EndsWith('/')){[IO.Directory]::CreateDirectory($out)|Out-Null;continue}
          [IO.Directory]::CreateDirectory((Split-Path -Parent $out))|Out-Null
          [IO.Compression.ZipFileExtensions]::ExtractToFile($entry,$out,$true)
        }
      }finally{$archive.Dispose()}
    }
    if(-not $SkipAssets){
      foreach($asset in $manifest.assets){Get-Asset $asset}
      Prepare-Icons
    }
    $reg.plugins=@(@($reg.plugins) | Where-Object {$_.id -ne $manifest.id})+@([pscustomobject]@{id=$manifest.id;version=$manifest.version;files=@($manifest.pluginFiles)})
    [IO.Directory]::CreateDirectory($engine)|Out-Null
    Copy-Item -LiteralPath $PSCommandPath -Destination (Join-Path $engine 'Manage.ps1') -Force
    $config=@{python=(Join-Path $payload 'python\python.exe')}
    Save-Json (Join-Path $payload 'lab-config.json') $config
    $reg.autoRepair=(-not $NoWatch)
    Save-Json $registryPath $reg
    Repair-Hook
    if(-not $NoWatch){Install-Watcher}
    Write-Output ('Installed '+$manifest.id+' into '+$Target)
  }elseif($Action -eq 'Repair'){
    if(@($reg.plugins).Count -eq 0){throw 'No installed One4All cards'}
    Repair-Hook
    Write-Output 'MCHOSE entry checked and repaired.'
  }elseif($Action -eq 'Uninstall'){
    $manifest=Read-Json (Join-Path $PSScriptRoot '..\manifest.json')
    $removed=@($reg.plugins | Where-Object {$_.id -eq $manifest.id})
    $reg.plugins=@($reg.plugins | Where-Object {$_.id -ne $manifest.id})
    Save-Json $registryPath $reg
    if(@($reg.plugins).Count -eq 0){
      Restore-Hook
      $reg.autoRepair=$false;Save-Json $registryPath $reg
      if(-not $NoWatch){
        $name='One4All-MCHOSE-'+[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
        Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue
      }
    }
    # Keep payload and user data for safe reinstalls; disabled cards are not loaded.
    Write-Output ('Uninstalled '+$manifest.id+'. Device pairing and backups are preserved.')
  }
}finally{$lock.Dispose()}
if($restartExe){Start-Process -FilePath $restartExe -WorkingDirectory $Target -WindowStyle Hidden}
