param(
  [ValidateSet('Enable','Disable')][string]$Action,
  [Parameter(Mandatory=$true)][string]$ConfigDirectory,
  [string]$StateRoot=(Join-Path $env:USERPROFILE 'One4All')
)
$ErrorActionPreference='Stop'
# Explicit recipient opt-in. This script never downloads or installs an audio driver.
if(-not $Action){throw 'Choose -Action Enable or Disable explicitly'}
$configRoot=[IO.Path]::GetFullPath($ConfigDirectory).TrimEnd('\')
$main=Join-Path $configRoot 'config.txt'
if(-not(Test-Path -LiteralPath $main -PathType Leaf)){throw 'Select the existing Equalizer APO configuration directory'}
$managed=Join-Path $configRoot 'One4All-BlackShark-V2'
$resolved=[IO.Path]::GetFullPath($managed)
if(-not $resolved.StartsWith($configRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Invalid managed directory'}
$data=Join-Path $StateRoot 'data\blackshark'
$metadata=Join-Path $data 'eq-provider.json'
if($Action -eq 'Disable' -and (Test-Path -LiteralPath $metadata)){
  $registered=Get-Content -LiteralPath $metadata -Raw -Encoding UTF8 | ConvertFrom-Json
  if([IO.Path]::GetFullPath($registered.configRoot).TrimEnd('\') -ne $configRoot){throw 'This StateRoot is registered to a different EQ configuration directory'}
}
$begin='# BEGIN One4All BlackShark V2 optional EQ'
$end='# END One4All BlackShark V2 optional EQ'
$bytes=[IO.File]::ReadAllBytes($main)
$encoding=New-Object Text.UTF8Encoding($false)
if($bytes.Length -ge 2 -and $bytes[0] -eq 255 -and $bytes[1] -eq 254){$encoding=[Text.Encoding]::Unicode}
elseif($bytes.Length -ge 3 -and $bytes[0] -eq 239 -and $bytes[1] -eq 187 -and $bytes[2] -eq 191){$encoding=New-Object Text.UTF8Encoding($true)}
$original=[IO.File]::ReadAllText($main,$encoding)
$block=[regex]::Escape($begin)+'\r?\n.*?'+[regex]::Escape($end)+'(?:\r?\n)?'
if(($original.Contains($begin)) -ne ($original.Contains($end))){throw 'Incomplete optional EQ marker; review configuration manually'}
$updated=[regex]::Replace($original,$block,'',[Text.RegularExpressions.RegexOptions]::Singleline)
if($Action -eq 'Enable'){
  [IO.Directory]::CreateDirectory($managed)|Out-Null
  $fragment=Join-Path $managed 'blackshark-eq.txt'
  if(-not(Test-Path -LiteralPath $fragment)){[IO.File]::WriteAllText($fragment,"# Bypassed until a curve is saved in One4All.`n",(New-Object Text.UTF8Encoding($false)))}
  # Grant the current recipient modify rights only to this project-owned subdirectory.
  $acl=Get-Acl -LiteralPath $managed
  $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User
  $rule=New-Object Security.AccessControl.FileSystemAccessRule($sid,'Modify','ContainerInherit,ObjectInherit','None','Allow')
  $acl.SetAccessRule($rule);Set-Acl -LiteralPath $managed -AclObject $acl
  $updated=$updated.TrimEnd()+"`r`n"+$begin+"`r`nInclude: One4All-BlackShark-V2\blackshark-eq.txt`r`n"+$end+"`r`n"
}
$backup=$main+'.one4all-'+(Get-Date -Format 'yyyyMMddHHmmssfff')+'.bak'
Copy-Item -LiteralPath $main -Destination $backup
[IO.File]::WriteAllText($main,$updated,$encoding)
[IO.Directory]::CreateDirectory($data)|Out-Null
if($Action -eq 'Enable'){
  $value=@{provider='equalizer-apo';configRoot=$configRoot;enabledByRecipient=$true}
  [IO.File]::WriteAllText($metadata,($value|ConvertTo-Json),(New-Object Text.UTF8Encoding($false)))
}elseif(Test-Path -LiteralPath $metadata){Remove-Item -LiteralPath $metadata -Force}
Write-Output ('Optional EQ '+$Action+' configuration complete. Audible behavior remains unverified. Existing configuration backed up.')
