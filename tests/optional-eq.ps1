$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$fixture=Join-Path $root ('.handoff-work\eq-'+[guid]::NewGuid().ToString('N'))
$config=Join-Path $fixture 'config';$state=Join-Path $fixture 'state'
[IO.Directory]::CreateDirectory($config)|Out-Null
$main=Join-Path $config 'config.txt';$original="# existing setting`r`nPreamp: -1 dB`r`n"
[IO.File]::WriteAllText($main,$original,(New-Object Text.UTF8Encoding($false)))
$helper=Join-Path $root 'blackshark-v2\Optional-EQ.ps1'
& $helper -Action Enable -ConfigDirectory $config -StateRoot $state
& $helper -Action Enable -ConfigDirectory $config -StateRoot $state
$text=[IO.File]::ReadAllText($main)
if([regex]::Matches($text,'# BEGIN One4All').Count -ne 1 -or -not $text.Contains('Preamp: -1 dB')){throw 'EQ enable must preserve existing config and remain idempotent'}
& $helper -Action Disable -ConfigDirectory $config -StateRoot $state
if([IO.File]::ReadAllText($main) -ne $original){throw 'EQ disable must restore the original config text'}
if(Test-Path -LiteralPath (Join-Path $state 'data\blackshark\eq-provider.json')){throw 'EQ provider metadata should be disabled'}
Write-Output 'PASS optional EQ enable/re-enable/disable in an isolated configuration fixture'
