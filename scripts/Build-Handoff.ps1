param([string]$Version='0.2.0-handoff.2')
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
& (Join-Path $PSScriptRoot 'Sync-Library.ps1') -Version $Version
& (Join-Path $PSScriptRoot 'Build-Releases.ps1') -Version $Version
$out=Join-Path $root ('dist\v'+$Version)
$source=Join-Path $root 'blackshark-v2\optional-eq'
$destination=Join-Path $out ('blackshark-v2-optional-eq-v'+$Version+'.zip')
Add-Type -AssemblyName System.IO.Compression.FileSystem
if(Test-Path -LiteralPath $destination){Remove-Item -LiteralPath $destination -Force}
$zip=[IO.Compression.ZipFile]::Open($destination,[IO.Compression.ZipArchiveMode]::Create)
try{
  foreach($file in Get-ChildItem -LiteralPath $source -Recurse -File){
    $name='blackshark-v2/optional-eq/'+$file.FullName.Substring($source.Length+1).Replace('\','/')
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$file.FullName,$name,[IO.Compression.CompressionLevel]::Optimal)|Out-Null
  }
}finally{$zip.Dispose()}
$files=@("logitech-g309-v${Version}-win64.zip","blackshark-v2-v${Version}-win64.zip","blackshark-v2-optional-eq-v${Version}.zip","one4all-kit-v${Version}.zip")
$lines=@($files | ForEach-Object {((Get-FileHash -LiteralPath (Join-Path $out $_) -Algorithm SHA256).Hash.ToLowerInvariant())+'  '+$_})
[IO.File]::WriteAllText((Join-Path $out 'HANDOFF-SHA256SUMS.txt'),($lines -join "`n")+"`n",(New-Object Text.UTF8Encoding($false)))
Write-Output 'Handoff assets and dedicated checksums are ready. Publish only the new device packages, optional source, and kit as a prerelease.'
