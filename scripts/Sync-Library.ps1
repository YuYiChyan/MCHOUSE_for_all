param([string]$Version='')
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$library=Join-Path $root 'library'
$mapping=Get-Content -LiteralPath (Join-Path $library 'runtime-map.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if(-not $Version){$Version=(Get-Content -LiteralPath (Join-Path $library 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json).version}
$utf8=New-Object Text.UTF8Encoding($false)
function Hash-File($Path){
  $stream=[IO.File]::OpenRead($Path);$algorithm=[Security.Cryptography.SHA256]::Create()
  try{return ([BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace('-','').ToLowerInvariant()}
  finally{$stream.Dispose();$algorithm.Dispose()}
}
function Normalize-Text($Path){
  $extension=[IO.Path]::GetExtension($Path).ToLowerInvariant()
  if($extension -in @('.zip','.png','.webp','.whl','.exe','.dll','.pyd')){return}
  $text=[IO.File]::ReadAllText($Path).Replace("`r`n","`n")
  if($extension -eq '.cmd'){$text=$text.Replace("`n","`r`n")}
  [IO.File]::WriteAllText($Path,$text,$utf8)
}
$catalog=Get-Content -LiteralPath (Join-Path $root 'devices.json') -Raw -Encoding UTF8 | ConvertFrom-Json
foreach($project in @($catalog | ForEach-Object {$_.folder})){
  $dir=Join-Path $root $project
  $manifestPath=Join-Path $dir 'manifest.json'
  $manifest=Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
  foreach($entry in $mapping){
    if($entry.projects -and $project -notin $entry.projects){continue}
    $source=Join-Path $library $entry.source
    Normalize-Text $source
    $dest=Join-Path $dir $entry.target
    [IO.Directory]::CreateDirectory((Split-Path -Parent $dest))|Out-Null
    Copy-Item -LiteralPath $source -Destination $dest -Force
    if($entry.target.StartsWith('payload/') -and -not @($manifest.files | Where-Object {$_.path -eq $entry.target}).Count){
      $manifest.files+=@([pscustomobject]@{path=$entry.target;sha256=(Hash-File $dest)})
    }
  }
  foreach($file in $manifest.files){$filePath=Join-Path $dir $file.path;Normalize-Text $filePath;$file.sha256=Hash-File $filePath}
  $manifest.version=$Version
  $manifest.pluginFiles=@($manifest.files | Where-Object {$_.path.StartsWith('payload/')} | ForEach-Object {$_.path.Substring(8)})
  [IO.File]::WriteAllText($manifestPath,($manifest|ConvertTo-Json -Depth 24).Replace("`r`n","`n")+"`n",$utf8)
}
Write-Output ('Library '+$Version+' copied into all independent packages; hashes updated.')
