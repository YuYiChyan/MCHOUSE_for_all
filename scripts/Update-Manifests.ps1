$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$utf8=New-Object Text.UTF8Encoding($false)
function Hash-File($Path){
  $stream=[IO.File]::OpenRead($Path);$algorithm=[Security.Cryptography.SHA256]::Create()
  try{return ([BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace('-','').ToLowerInvariant()}
  finally{$stream.Dispose();$algorithm.Dispose()}
}
foreach($project in @('tank68','razer-mini-se','cuktech-10-ultra')){
  $dir=Join-Path $root $project
  $file=Join-Path $dir 'manifest.json'
  $manifest=Get-Content -LiteralPath $file -Raw -Encoding UTF8 | ConvertFrom-Json
  foreach($entry in $manifest.files){$entry.sha256=Hash-File (Join-Path $dir $entry.path)}
  [IO.File]::WriteAllText($file,($manifest|ConvertTo-Json -Depth 24),$utf8)
}
Write-Output 'Package hashes updated. Run tests/Installers.ps1 against a fixture before distributing.'
