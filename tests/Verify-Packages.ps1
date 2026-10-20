$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$checked=0
function Hash-File($Path){
  $stream=[IO.File]::OpenRead($Path);$algorithm=[Security.Cryptography.SHA256]::Create()
  try{return ([BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace('-','').ToLowerInvariant()}
  finally{$stream.Dispose();$algorithm.Dispose()}
}
$catalog=Get-Content -LiteralPath (Join-Path $root 'devices.json') -Raw -Encoding UTF8 | ConvertFrom-Json
foreach($project in @($catalog | ForEach-Object {$_.folder})){
  $dir=Join-Path $root $project
  $manifest=Get-Content -LiteralPath (Join-Path $dir 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  foreach($entry in $manifest.files){
    $file=Join-Path $dir $entry.path
    if(-not(Test-Path -LiteralPath $file -PathType Leaf)){throw ('Missing package file: '+$entry.path)}
    if((Hash-File $file) -ne $entry.sha256){throw ('Hash mismatch: '+$entry.path)}
    $checked++
  }
}
Get-ChildItem -LiteralPath $root -Recurse -Filter '*.ps1' | Where-Object {$_.FullName -notmatch '[\\/]\.(research|handoff-work)[\\/]'} | ForEach-Object {
  $tokens=$null;$errors=$null
  [Management.Automation.Language.Parser]::ParseFile($_.FullName,[ref]$tokens,[ref]$errors)|Out-Null
  if($errors){throw ($errors|ForEach-Object{$_.ToString()}|Out-String)}
}
Write-Output ('PASS '+$checked+' manifest file hashes and all PowerShell syntax checks')
