param([string]$Version='',[string]$OutputDirectory='')
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
if(-not $Version){$Version=(Get-Content -LiteralPath (Join-Path $root 'library/package.json') -Raw -Encoding UTF8 | ConvertFrom-Json).version}
if(-not $OutputDirectory){$OutputDirectory=Join-Path $root ('dist/v'+$Version)}
$OutputDirectory=[IO.Path]::GetFullPath($OutputDirectory)
[IO.Directory]::CreateDirectory($OutputDirectory)|Out-Null
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
function Hash-File($Path){
  $stream=[IO.File]::OpenRead($Path);$algorithm=[Security.Cryptography.SHA256]::Create()
  try{return ([BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace('-','').ToLowerInvariant()}
  finally{$stream.Dispose();$algorithm.Dispose()}
}
function Check-Child($Base,$Relative){
  $prefix=[IO.Path]::GetFullPath($Base).TrimEnd('\')+'\'
  $full=[IO.Path]::GetFullPath((Join-Path $Base $Relative))
  if(-not $full.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)){throw 'Package path escapes source directory'}
  $normalized=$Relative.Replace('\','/')
  if($normalized -match '(^|/)(config\.yaml|lab-config\.json|razer-state\.json|auth\.json|hosts\.yml|profile(?:-[^/]+)?|__pycache__|node_modules|\.env(?:\.[^/]+)?)(/|$)' -or $normalized -match '\.(log(?:\.[^/]+)?|db(?:-(?:shm|wal))?|sqlite3?(?:-(?:shm|wal))?|pem|key|token|pyc)$' -or $normalized -match 'credentials[^/]*\.json$'){throw 'Private runtime state or cache cannot be published'}
  return $full
}
function Write-Package($Destination,$Files){
  if(Test-Path -LiteralPath $Destination){Remove-Item -LiteralPath $Destination -Force}
  $zip=[IO.Compression.ZipFile]::Open($Destination,[IO.Compression.ZipArchiveMode]::Create)
  try{
    # Windows PowerShell 5.1 does not sort hashtable keys as object properties.
    # Deduplicate by the actual archive path before sorting string keys.
    $byArchive=@{}
    foreach($file in $Files){$byArchive[[string]$file.archive]=$file}
    foreach($archivePath in @($byArchive.Keys | Sort-Object)){
      $file=$byArchive[$archivePath]
      [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$file.source,$file.archive,[IO.Compression.CompressionLevel]::Optimal)|Out-Null
    }
  }finally{$zip.Dispose()}
}
$docs=@('.gitignore','THIRD_PARTY.md','VALIDATION.md','CONTRIBUTING.md','docs/DEVELOPMENT.md','docs/PACKAGING.md','docs/ACCEPTANCE-0.2.0.md','handoff/README.md','handoff/acceptance.example.json')
$common=@($docs | ForEach-Object {@{source=(Join-Path $root $_);archive=$_}})
$artifacts=@()
$devices=Get-Content -LiteralPath (Join-Path $root 'devices.json') -Raw -Encoding UTF8 | ConvertFrom-Json
foreach($device in $devices){
  $dir=Check-Child $root $device.folder
  $manifest=Get-Content -LiteralPath (Join-Path $dir 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  if($manifest.version -ne $Version){throw ('Run Sync-Library.ps1 -Version '+$Version+' before building '+$device.id)}
  $files=@($common)
  foreach($entry in $manifest.files){
    $source=Check-Child $dir $entry.path
    if((Hash-File $source) -ne $entry.sha256){throw ('Package checksum mismatch: '+$entry.path)}
    $files+=@(@{source=$source;archive=($device.folder+'/'+$entry.path)})
  }
  foreach($name in @('Install.cmd','Install.ps1','Repair.cmd','Repair.ps1','Uninstall.cmd','Uninstall.ps1','LICENSE','LICENSE-COMMON','README.md','manifest.json','DEPENDENCIES.json','PYTHON-SOURCE.json','requirements-lock.txt','scripts/Manage.ps1')){
    $source=Check-Child $dir $name
    if(Test-Path -LiteralPath $source -PathType Leaf){$files+=@(@{source=$source;archive=($device.folder+'/'+$name)})}
  }
  $dest=Join-Path $OutputDirectory ($device.asset+'-v'+$Version+'-win64.zip')
  Write-Package $dest $files
  $artifacts+=@($dest)
  Write-Output ('Built '+[IO.Path]::GetFileName($dest))
}
$library=Join-Path $root 'library'
$metadata=Get-Content -LiteralPath (Join-Path $library 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if($metadata.version -ne $Version){throw 'Library version does not match release version'}
$files=@($common)
foreach($item in @('package.json')+@($metadata.files)){
  $source=Check-Child $library $item
  if(Test-Path -LiteralPath $source -PathType Container){
    foreach($entry in Get-ChildItem -LiteralPath $source -Recurse -File){
      $rel=$entry.FullName.Substring($library.Length+1).Replace('\','/')
      Check-Child $library $rel | Out-Null
      $files+=@(@{source=$entry.FullName;archive=('library/'+$rel)})
    }
  }elseif(Test-Path -LiteralPath $source -PathType Leaf){$files+=@(@{source=$source;archive=('library/'+$item)})}
}
$dest=Join-Path $OutputDirectory ('one4all-kit-v'+$Version+'.zip')
Write-Package $dest $files
$artifacts+=@($dest)
Write-Output ('Built '+[IO.Path]::GetFileName($dest))
$sums=(@($artifacts | Sort-Object | ForEach-Object {(Hash-File $_)+'  '+[IO.Path]::GetFileName($_)}) -join "`n")+"`n"
[IO.File]::WriteAllText((Join-Path $OutputDirectory 'SHA256SUMS.txt'),$sums,(New-Object Text.UTF8Encoding($false)))
Write-Output ('Release output: '+$OutputDirectory)
