# Abre o Sistema Solar no PowerShell. Mesma logica do run.bat.
$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

function Tem($nome) { $null -ne (Get-Command $nome -ErrorAction SilentlyContinue) }

if (Tem 'node') {
  if (-not (Test-Path 'node_modules') -and -not (Test-Path 'dist')) {
    Write-Host 'Primeira execucao: instalando as bibliotecas. Isto leva um ou dois minutos.'
    npm install
  }
  if (-not (Test-Path 'dist')) {
    Write-Host 'Construindo o programa.'
    npm run build
  } else {
    node ferramentas/dist_desatualizado.mjs
    if ($LASTEXITCODE -ne 0) {
      if (Test-Path 'node_modules') {
        Write-Host 'O codigo mudou desde a ultima construcao. Reconstruindo o programa.'
        npm run build
      } else {
        Write-Host 'Aviso: o codigo mudou desde a ultima construcao, e esta copia nao tem as'
        Write-Host 'bibliotecas para reconstruir. Abrindo a versao que ja estava construida.'
      }
    }
  }
  node servidor.mjs @args
  exit $LASTEXITCODE
}

if ((Test-Path 'dist') -and (Tem 'python')) {
  Write-Host 'Node nao encontrado. Usando o servidor de reserva em Python.'
  python ferramentas/servidor.py @args
  exit $LASTEXITCODE
}

Write-Error 'Nao foi possivel abrir o programa. Falta o Node: https://nodejs.org'
exit 1
