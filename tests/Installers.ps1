param([string]$MchoseTarget=(Join-Path $env:ProgramFiles 'MCHOSE HUB'))
$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
$projects=@((Get-Content -LiteralPath (Join-Path $repo 'devices.json') -Raw -Encoding UTF8 | ConvertFrom-Json) | ForEach-Object {$_.folder})
$testRoot=Join-Path $env:TEMP ('One4All-validation-'+[guid]::NewGuid().ToString('N'))
$target=Join-Path $testRoot 'MCHOSE HUB'
$state=Join-Path $testRoot 'state'
$app=Join-Path $target 'resources\app'
[IO.Directory]::CreateDirectory((Join-Path $app 'out\main')) | Out-Null
$utf8=New-Object Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path $app 'out\main\index.js'),'module.exports = true;',$utf8)
[IO.File]::WriteAllText((Join-Path $app 'package.json'),'{"name":"MCHOSEHUB","version":"1.0.0","main":"./out/main/index.js","keep":{"value":42}}',$utf8)
$assetDest=Join-Path $app 'bundled\renderer\refresh-assets'
[IO.Directory]::CreateDirectory($assetDest) | Out-Null
Get-ChildItem -LiteralPath (Join-Path $MchoseTarget 'resources\app\bundled\renderer\refresh-assets') -File | Where-Object {$_.Extension -in @('.css','.woff','.woff2','.ttf','.svg')} | Copy-Item -Destination $assetDest
function Check($Condition,$Message){if(-not $Condition){throw $Message};Write-Output ('PASS '+$Message)}
foreach($project in $projects){
  & (Join-Path $repo ($project+'\Install.ps1')) -Target $target -StateRoot $state -NoWatch -SkipAssets
}
$reg=Get-Content -LiteralPath (Join-Path $state 'registry.json') -Raw | ConvertFrom-Json
Check (@($reg.plugins).Count -eq $projects.Count) 'all independent installations coexist'
$pkg=Get-Content -LiteralPath (Join-Path $app 'package.json') -Raw | ConvertFrom-Json
Check ($pkg.main -eq './one4all-loader.cjs' -and $pkg.keep.value -eq 42) 'entry injected without losing other package fields'
& (Join-Path $repo 'razer-mini-se\Install.ps1') -Target $target -StateRoot $state -NoWatch -SkipAssets
$reg=Get-Content -LiteralPath (Join-Path $state 'registry.json') -Raw | ConvertFrom-Json
Check (@($reg.plugins).Count -eq $projects.Count) 'reinstall is idempotent'
$data=Join-Path $state 'data\charger'
[IO.Directory]::CreateDirectory($data)|Out-Null
[IO.File]::WriteAllText((Join-Path $data 'preserve.txt'),'test-state',$utf8)
$pkg.main='./out/main/update.js';$pkg.version='2.0.0'
[IO.File]::WriteAllText((Join-Path $app 'out\main\update.js'),'module.exports = 2;',$utf8)
[IO.File]::WriteAllText((Join-Path $app 'package.json'),($pkg|ConvertTo-Json -Depth 9),$utf8)
Remove-Item -LiteralPath (Join-Path $app 'one4all-loader.cjs') -Force
Remove-Item -LiteralPath (Join-Path $app 'one4all-original.json') -Force
& (Join-Path $repo 'tank68\Repair.ps1') -Target $target -StateRoot $state -NoWatch -SkipAssets
$meta=Get-Content -LiteralPath (Join-Path $app 'one4all-original.json') -Raw | ConvertFrom-Json
Check ($meta.main -eq './out/main/update.js') 'official update repair remembers the new entry'
Check ((Get-Content -LiteralPath (Join-Path $data 'preserve.txt') -Raw) -eq 'test-state') 'update repair preserves user data'
foreach($project in $projects){
  & (Join-Path $repo ($project+'\Uninstall.ps1')) -Target $target -StateRoot $state -NoWatch -SkipAssets
}
$pkg=Get-Content -LiteralPath (Join-Path $app 'package.json') -Raw | ConvertFrom-Json
Check ($pkg.main -eq './out/main/update.js' -and $pkg.version -eq '2.0.0') 'last uninstall restores latest vendor entry'
Check (-not(Test-Path -LiteralPath (Join-Path $app 'one4all-loader.cjs'))) 'last uninstall removes only the injected loader'
Check (Test-Path -LiteralPath (Join-Path $data 'preserve.txt')) 'uninstall preserves pairing/data'
foreach($project in @($projects[($projects.Count-1)..0])){
  & (Join-Path $repo ($project+'\Install.ps1')) -Target $target -StateRoot $state -NoWatch -SkipAssets
}
$reg=Get-Content -LiteralPath (Join-Path $state 'registry.json') -Raw | ConvertFrom-Json
Check (@($reg.plugins).Count -eq $projects.Count) 'reverse installation order works'
# Fixture is retained in TEMP for inspection.
Write-Output ('Fixture ready: '+$testRoot)
