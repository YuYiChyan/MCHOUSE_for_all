param(
  [string]$StateRoot=(Join-Path $env:USERPROFILE 'One4All'),
  [string]$ConfigDirectory=(Join-Path $env:ProgramFiles 'EqualizerAPO\config'),
  [switch]$ValidateOnly
)
$ErrorActionPreference='Stop'
$metadata=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'optional-eq\SOURCE.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$installer=Join-Path $PSScriptRoot ('optional-eq\'+$metadata.installerFile)
if(-not $metadata.installerBundled -or -not(Test-Path -LiteralPath $installer -PathType Leaf)){throw 'Bundled Equalizer APO installer is missing'}
if((Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash.ToLowerInvariant() -ne $metadata.installerSha256){throw 'Equalizer APO installer checksum mismatch'}
$source=Join-Path $PSScriptRoot ('optional-eq\'+$metadata.releaseSourceFile)
if((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant() -ne $metadata.releaseSourceSha256){throw 'Equalizer APO corresponding source checksum mismatch'}
if($ValidateOnly){Write-Output 'PASS official EQ installer and corresponding source hashes; no system changes';return}
foreach($value in @($StateRoot,$ConfigDirectory)){if($value.Contains('"')){throw 'Invalid path'}}
$isAdmin=([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if(-not $isAdmin){
  $arguments='-NoProfile -ExecutionPolicy Bypass -File "'+$PSCommandPath+'" -StateRoot "'+$StateRoot+'" -ConfigDirectory "'+$ConfigDirectory+'"'
  $process=Start-Process powershell.exe -Verb RunAs -ArgumentList $arguments -PassThru -WindowStyle Hidden
  $process.WaitForExit();exit $process.ExitCode
}
$engine=Split-Path -Parent $ConfigDirectory
if(-not(Test-Path -LiteralPath (Join-Path $engine 'EqualizerAPO.dll'))){
  Write-Output 'In the official installer, select only the BlackShark V2 USB playback endpoint. Keep microphone and other devices unselected.'
  # This is an explicitly requested interactive installer, so show its window.
  $process=Start-Process -FilePath $installer -PassThru -WindowStyle Normal
  $process.WaitForExit()
  if($process.ExitCode -notin @(0,3010)){throw ('Equalizer APO installation did not complete: '+$process.ExitCode)}
}
if(-not(Test-Path -LiteralPath (Join-Path $engine 'EqualizerAPO.dll')) -or -not(Test-Path -LiteralPath (Join-Path $ConfigDirectory 'config.txt'))){throw 'EQ engine was not installed at the selected path. Cancelled without enabling the bridge.'}
& (Join-Path $PSScriptRoot 'Optional-EQ.ps1') -Action Enable -ConfigDirectory $ConfigDirectory -StateRoot $StateRoot
Write-Output 'EQ bridge is ready. Open BlackShark V2 > Equalizer in MCHOSE HUB to save the curve. Audio endpoint activation and audible effect still require device verification.'
