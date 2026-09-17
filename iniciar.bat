@echo off
title Corta Precos PDV
color 0A

echo.
echo  =======================================
echo   CORTA PRECOS PDV - Iniciando...
echo  =======================================
echo.

:: Verifica se Node.js esta instalado
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo  ERRO: Node.js nao encontrado!
  echo  Baixe em: https://nodejs.org  ^(versao LTS^)
  echo.
  pause
  exit /b 1
)

:: Abre o navegador apos 3 segundos
start "" /B cmd /C "timeout /t 3 /nobreak >nul && start http://localhost:8011"

:: Inicia o servidor
node server.js

pause
