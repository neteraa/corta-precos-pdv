#!/bin/bash
echo ""
echo "======================================="
echo "  CORTA PRECOS PDV - Iniciando..."
echo "======================================="
echo ""

if ! command -v node &>/dev/null; then
  echo "ERRO: Node.js nao encontrado!"
  echo "Instale em: https://nodejs.org  (versao LTS)"
  exit 1
fi

# Abre o navegador no Mac ou Linux apos 2 segundos
(sleep 2 && (open http://localhost:8011 2>/dev/null || xdg-open http://localhost:8011 2>/dev/null)) &

node server.js
