param([string]$Target='', [string]$StateRoot=(Join-Path $env:USERPROFILE 'One4All'), [switch]$NoWatch, [switch]$SkipAssets)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$admin=([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if(-not $admin){
  $arguments='-NoProfile -ExecutionPolicy Bypass -File "'+$PSCommandPath+'" -StateRoot "'+$StateRoot+'"'
  if($Target){$arguments+=' -Target "'+$Target+'"'}
  if($NoWatch){$arguments+=' -NoWatch'}
  if($SkipAssets){$arguments+=' -SkipAssets'}
  $process=Start-Process powershell.exe -Verb RunAs -WindowStyle Hidden -ArgumentList $arguments -PassThru
  $process.WaitForExit();exit $process.ExitCode
}
$manifest=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
foreach($entry in $manifest.files){
  $root=[IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\')+'\'
  $file=[IO.Path]::GetFullPath((Join-Path $root $entry.path))
  if(-not $file.StartsWith($root,[StringComparison]::OrdinalIgnoreCase)){throw 'Invalid package path'}
  if((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256){throw ('Package checksum mismatch: '+$entry.path)}
}
$source=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'official-source.json') -Raw -Encoding UTF8 | ConvertFrom-Json
function Find-OfficialRoot {
  $candidates=@((Join-Path ${env:ProgramFiles(x86)} 'XIBERIA HUB'),(Join-Path $env:ProgramFiles 'XIBERIA HUB'))
  foreach($view in @([Microsoft.Win32.RegistryView]::Registry32,[Microsoft.Win32.RegistryView]::Registry64)){
    $hive=[Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::LocalMachine,$view)
    try{
      $key=$hive.OpenSubKey('SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall')
      if($key){try{
        foreach($name in $key.GetSubKeyNames()){
          $entry=$key.OpenSubKey($name)
          if($entry){try{if($entry.GetValue('DisplayName') -eq 'XIBERIA HUB'){$candidates+=([string]$entry.GetValue('InstallLocation'))}}finally{$entry.Dispose()}}
        }
      }finally{$key.Dispose()}}
    }finally{$hive.Dispose()}
  }
  foreach($candidate in $candidates){
    if(-not $candidate){continue}
    $sdk=Join-Path $candidate 'LHDCX_XIBERIA_DLL.dll'
    $app=Join-Path $candidate 'XIBERIA HUB.exe'
    if((Test-Path -LiteralPath $sdk) -and (Test-Path -LiteralPath $app) -and (Get-FileHash -LiteralPath $sdk -Algorithm SHA256).Hash.ToLowerInvariant() -eq $source.sdkSha256){return $candidate}
  }
  return $null
}
$cache=Join-Path $StateRoot 'cache\xiberia'
[IO.Directory]::CreateDirectory($cache)|Out-Null
$officialRoot=Find-OfficialRoot
$restartRequired=$false
if(-not $officialRoot){
  $official=Join-Path $PSScriptRoot ('vendor\XIBERIA-HUB-Setup-v'+$source.version+'.exe')
  if(-not(Test-Path -LiteralPath $official) -or (Get-FileHash -LiteralPath $official -Algorithm SHA256).Hash.ToLowerInvariant() -ne $source.sha256){throw 'Bundled official installer checksum mismatch'}
  $signature=Get-AuthenticodeSignature -LiteralPath $official
  if($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Dongguan Desheng Industrial'){throw 'Official installer signature verification failed'}
  $process=Start-Process -FilePath $official -ArgumentList @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/SP-') -WindowStyle Hidden -PassThru -Wait
  if($process.ExitCode -notin @(0,3010)){throw ('Official component installation failed: '+$process.ExitCode)}
  $restartRequired=$process.ExitCode -eq 3010
  $officialRoot=Find-OfficialRoot
  if(-not $officialRoot){throw 'Official audio runtime was not installed correctly'}
}
$marker=Join-Path $cache ('drivers-'+$source.version+'.ready')
$driverFiles=@('Downlink\APO\LhdcXXiberiaGpUsbApo.inf','Downlink\APO\LhdcXXiberiaGpUsbApoExtension.inf','Uplink\FMUSBAPO\FMUSBAPO.inf','Uplink\FMUSBService\FMUSBService.inf','Uplink\USBEXT_Xiberia\UsbExt_Xiberia.inf')
if(-not(Test-Path -LiteralPath $marker) -or [IO.File]::ReadAllText($marker) -ne $source.sdkSha256){
  foreach($relative in $driverFiles){
    $inf=Join-Path $officialRoot ('Drivers\'+$relative)
    if(-not(Test-Path -LiteralPath $inf -PathType Leaf)){throw ('Official driver is missing: '+$relative)}
    $result=Start-Process -FilePath (Join-Path $env:windir 'System32\pnputil.exe') -ArgumentList @('/add-driver',('"'+$inf+'"'),'/install') -WindowStyle Hidden -Wait -PassThru
    if($result.ExitCode -notin @(0,3010)){throw ('Official audio driver registration failed: '+$result.ExitCode)}
    if($result.ExitCode -eq 3010){$restartRequired=$true}
  }
  [IO.File]::WriteAllText($marker,$source.sdkSha256)
}
& (Join-Path $PSScriptRoot 'scripts\Manage.ps1') -Action Install -Target $Target -StateRoot $StateRoot -NoWatch:$NoWatch -SkipAssets:$SkipAssets
if($restartRequired){Write-Output 'Audio components installed. Restart Windows when convenient.'}
