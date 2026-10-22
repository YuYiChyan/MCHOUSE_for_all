param([string]$Version='0.2.0')
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$out=Join-Path $root ('dist\v'+$Version)
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$devices=Get-Content (Join-Path $root 'devices.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$checked=0
foreach($device in $devices){
  $manifest=Get-Content (Join-Path $root ($device.folder+'\manifest.json')) -Raw -Encoding UTF8 | ConvertFrom-Json
  $zip=[IO.Compression.ZipFile]::OpenRead((Join-Path $out ($device.asset+'-v'+$Version+'-win64.zip')))
  try{
    foreach($file in $manifest.files){
      $entry=$zip.GetEntry($device.folder+'/'+$file.path)
      if(-not $entry){throw ('ZIP missing required file: '+$device.folder+'/'+$file.path)}
      $stream=$entry.Open();$hash=[Security.Cryptography.SHA256]::Create()
      try{$actual=([BitConverter]::ToString($hash.ComputeHash($stream))).Replace('-','').ToLowerInvariant()}finally{$stream.Dispose();$hash.Dispose()}
      if($actual -ne $file.sha256){throw ('ZIP payload checksum mismatch: '+$entry.FullName)}
      $checked++
    }
    foreach($rel in @('Install.cmd','Repair.cmd','Uninstall.cmd','manifest.json')){if(-not $zip.GetEntry($device.folder+'/'+$rel)){throw ('ZIP missing entry point: '+$rel)}}
    if(-not $zip.GetEntry('docs/ACCEPTANCE-0.2.0.md')){throw 'ZIP missing acceptance scope'}
  }finally{$zip.Dispose()}
}
$kit=[IO.Compression.ZipFile]::OpenRead((Join-Path $out ('one4all-kit-v'+$Version+'.zip')))
try{foreach($rel in @('library/package.json','library/ui/components.js','library/host/host.cjs','library/install/Manage.ps1')){if(-not $kit.GetEntry($rel)){throw ('Kit missing: '+$rel)}}}finally{$kit.Dispose()}
$eq=[IO.Compression.ZipFile]::OpenRead((Join-Path $out ('blackshark-v2-optional-eq-v'+$Version+'.zip')))
try{foreach($rel in @('Install-EQ.cmd','Install-EQ.ps1','Optional-EQ.ps1','optional-eq/SOURCE.json','optional-eq/LICENSE-EqualizerAPO.txt','optional-eq/EqualizerAPO-x64-1.4.2.exe','optional-eq/EqualizerAPO-src-1.4.2.zip')){if(-not $eq.GetEntry('blackshark-v2/'+$rel)){throw ('EQ kit missing: '+$rel)}}}finally{$eq.Dispose()}
foreach($filename in @('SHA256SUMS.txt','HANDOFF-SHA256SUMS.txt')){
  foreach($line in Get-Content (Join-Path $out $filename)){
    $parts=$line -split '  ',2
    if((Get-FileHash -LiteralPath (Join-Path $out $parts[1]) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $parts[0]){throw ('Release checksum mismatch: '+$parts[1])}
  }
}
Write-Output ('PASS '+$checked+' manifest entries verified inside release ZIPs, independent entry points, kit, offline EQ and release checksums')
