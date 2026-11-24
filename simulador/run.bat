@echo off
REM Abre o Sistema Solar no Windows. Duplo clique funciona.
REM O `pause` no fim de cada erro existe para a janela nao sumir antes de a pessoa ler.
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel%==0 goto :temnode

REM Sem Node, o dist\ pronto ainda abre com o servidor de reserva em Python.
REM O teste do Python fica fora de um bloco entre parenteses de proposito: dentro dele o
REM %errorlevel% seria lido uma vez so, antes de o `where` rodar.
if not exist "dist\" goto :semnada
where python >nul 2>nul
if errorlevel 1 goto :semnada
echo Node nao encontrado. Usando o servidor de reserva em Python.
python ferramentas\servidor.py %*
goto :fim

:semnada
echo.
echo Nao foi possivel abrir o programa.
echo Falta o Node: https://nodejs.org
echo Instale a versao LTS e abra este arquivo de novo.
echo.
pause
exit /b 1

:temnode
if not exist "node_modules\" if not exist "dist\" (
  echo Primeira execucao: instalando as bibliotecas. Isto leva um ou dois minutos.
  call npm install || goto :erro
)
if not exist "dist\" (
  echo Construindo o programa.
  call npm run build || goto :erro
  goto :abrir
)
REM Um dist\ mais velho que o codigo abriria a versao antiga sem aviso. Com as
REM bibliotecas instaladas, reconstroi; sem elas (a pasta de entrega), so avisa:
REM instalar sozinho exigiria internet e minutos que quem so quer abrir nao espera.
node ferramentas\dist_desatualizado.mjs
if not errorlevel 1 goto :abrir
if exist "node_modules\" (
  echo O codigo mudou desde a ultima construcao. Reconstruindo o programa.
  call npm run build || goto :erro
) else (
  echo Aviso: o codigo mudou desde a ultima construcao, e esta copia nao tem as
  echo bibliotecas para reconstruir. Abrindo a versao que ja estava construida.
)

:abrir
node servidor.mjs %*
goto :fim

:erro
echo.
echo Alguma coisa deu errado acima.
echo.
pause
exit /b 1

:fim
endlocal
