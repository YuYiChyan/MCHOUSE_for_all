param([string]$StateRoot=(Join-Path $env:USERPROFILE 'One4All'))
$ErrorActionPreference='Stop'
$payload=Join-Path $StateRoot 'payload'
$python=Join-Path $payload 'python\python.exe'
if(-not(Test-Path -LiteralPath $python)){throw 'Install this card before running diagnostics'}
$bootstrap='import sys,os;sys.path[:0]=[sys.argv[1],os.path.dirname(sys.argv[2])];import runpy;runpy.run_path(sys.argv[2],run_name="__main__")'
$env:ONE4ALL_g309_DATA=Join-Path $StateRoot 'data\g309'
'{"command":"status"}' | & $python -I -B -c $bootstrap (Join-Path $payload 'g309-deps') (Join-Path $payload 'g309_backend.py')
