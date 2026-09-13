@echo off
setlocal
cd /d "%~dp0"
py -3 -c "import sys; assert sys.version_info >= (3, 7)" >nul 2>&1
if not errorlevel 1 (
    py -3 iniciar.py
    goto fim
)
python -c "import sys; assert sys.version_info >= (3, 7)" >nul 2>&1
if not errorlevel 1 (
    python iniciar.py
    goto fim
)
echo Python 3.7 ou superior nao foi encontrado.
echo Instale Python 3 e execute este arquivo novamente.
:fim
pause
