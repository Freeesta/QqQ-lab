@echo off
rem Double-click to open QqQ lab (Windows). The logic lives in scripts\avvia.py: it builds or updates the
rem private environment (.venv-tpfinder) with the newest Python installed (>= 3.11), then opens the app.
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
  py -3 scripts\avvia.py %*
  if errorlevel 1 pause
  goto :eof
)
where python >nul 2>nul
if not errorlevel 1 (
  python scripts\avvia.py %*
  if errorlevel 1 pause
  goto :eof
)
echo Serve Python 3.11 o piu recente: https://www.python.org/downloads/ ^(spunta "Add python.exe to PATH"^) e rifai doppio clic.
pause
