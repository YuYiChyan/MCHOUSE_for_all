param([string]$StateRoot=(Join-Path $env:USERPROFILE 'One4All'))
$ErrorActionPreference='Stop'
$payload=Join-Path $StateRoot 'payload'
$python=Join-Path $payload 'python\python.exe'
if(-not(Test-Path -LiteralPath $python)){throw 'Install this card before running diagnostics'}
$bootstrap='import sys,os;sys.path[:0]=[sys.argv[1],os.path.dirname(sys.argv[2])];import runpy;runpy.run_path(sys.argv[2],run_name="__main__")'
$env:ONE4ALL_blackshark_DATA=Join-Path $StateRoot 'data\blackshark'
'{"command":"status"}' | & $python -I -B -c $bootstrap (Join-Path $payload 'blackshark-deps') (Join-Path $payload 'blackshark_backend.py')
