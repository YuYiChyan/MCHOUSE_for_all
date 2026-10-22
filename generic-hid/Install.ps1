param([string]$Target='', [string]$StateRoot=(Join-Path $env:USERPROFILE 'One4All'), [switch]$NoWatch, [switch]$SkipAssets)
$ErrorActionPreference='Stop'
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
$version='0.3.0-preview.4'
$expected='f1c3ee8dacc1dc6a17a8c23ae41de307656f7d39dee11e89c49868f287242110'
$name='One4All-Generic-HID-'+$version+'.zip'
$cache=Join-Path $env:LOCALAPPDATA ('MCHOUSE_for_all\packages\generic-hid\'+$version)
[IO.Directory]::CreateDirectory($cache)|Out-Null
$zip=Join-Path $cache $name
if(-not(Test-Path -LiteralPath $zip) -or (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected){
  Write-Host 'Downloading the standalone Generic HID package...'
  Invoke-WebRequest -UseBasicParsing -Uri ('https://github.com/YuYiChyan/MCHOUSE_for_all/releases/download/v'+$version+'/'+$name) -OutFile $zip
}
if((Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected){throw 'Package SHA256 mismatch. Download was not installed.'}
$expanded=Join-Path $cache 'package'
Expand-Archive -LiteralPath $zip -DestinationPath $expanded -Force
& (Join-Path $expanded 'Install.ps1') -Target $Target -StateRoot $StateRoot -NoWatch:$NoWatch -SkipAssets:$SkipAssets
