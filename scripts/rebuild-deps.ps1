param([string]$Python='python')
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$out=Join-Path $env:TEMP ('One4All-deps-'+[guid]::NewGuid().ToString('N'))
& $Python -m pip install --target $out --platform win_amd64 --python-version 3.13 --implementation cp --abi cp313 --only-binary=:all: (Get-Content (Join-Path $root 'cuktech-10-ultra/requirements-lock.txt') | Where-Object {$_ -and -not $_.StartsWith('#')})
if($LASTEXITCODE -ne 0){throw 'pip failed'}
Compress-Archive -Path (Join-Path $out '*') -DestinationPath (Join-Path $root 'cuktech-10-ultra/vendor/charger-deps.zip') -Force
Write-Output 'Dependency archive rebuilt. Updating package hashes.'
& (Join-Path $PSScriptRoot 'Update-Manifests.ps1')
