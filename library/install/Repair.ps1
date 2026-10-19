param([string]$Target='', [string]$StateRoot=(Join-Path $env:LOCALAPPDATA 'One4All'), [switch]$NoWatch, [switch]$SkipAssets)
$ErrorActionPreference='Stop'
if(-not $Target -and (Test-Path -LiteralPath (Join-Path $StateRoot 'registry.json'))){$Target=(Get-Content -LiteralPath (Join-Path $StateRoot 'registry.json') -Raw -Encoding UTF8 | ConvertFrom-Json).target}
if(-not $Target){$Target=Join-Path $env:ProgramFiles 'MCHOSE HUB'}
$isAdmin=([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if(-not $isAdmin -and ($Target.StartsWith($env:ProgramFiles,[StringComparison]::OrdinalIgnoreCase) -or -not $NoWatch)){
  $arguments='-NoProfile -ExecutionPolicy Bypass -File "'+$PSCommandPath+'" -Target "'+$Target+'" -StateRoot "'+$StateRoot+'"'
  if($NoWatch){$arguments+=' -NoWatch'}
  if($SkipAssets){$arguments+=' -SkipAssets'}
  $process=Start-Process powershell.exe -Verb RunAs -ArgumentList $arguments -PassThru -Wait -WindowStyle Hidden
  exit $process.ExitCode
}
& (Join-Path $PSScriptRoot 'scripts/Manage.ps1') -Action Repair -Target $Target -StateRoot $StateRoot -NoWatch:$NoWatch -SkipAssets:$SkipAssets
