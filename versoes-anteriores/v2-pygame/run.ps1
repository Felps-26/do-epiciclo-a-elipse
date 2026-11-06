Set-Location $PSScriptRoot
if (-not (Test-Path '.venv/Scripts/python.exe')) {
    if (Get-Command py -ErrorAction SilentlyContinue) {
        py -3 -m venv .venv
    } else {
        python -m venv .venv
    }
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
$python = '.venv/Scripts/python.exe'
& $python -c 'import numpy, pygame, scipy' 2>$null
if ($LASTEXITCODE -ne 0) {
    & $python -m pip install -r requirements.txt
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
& $python main.py
exit $LASTEXITCODE
