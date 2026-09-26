#!/usr/bin/env bash
# Launcher robusto para o Margem no Linux / Fedora
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Se o binário Linux desempacotado existir, roda diretamente (rápido e sem dependência do libfuse.so.2)
if [ -x "$DIR/dist-package/linux-unpacked/caderno-reader" ]; then
  exec "$DIR/dist-package/linux-unpacked/caderno-reader" "$@"
fi

# Fallback 1: executa o AppImage do repositório
if [ -f "$DIR/dist-package/Margem-1.0.0.AppImage" ]; then
  exec "$DIR/dist-package/Margem-1.0.0.AppImage" "$@"
fi

# Fallback 2: executa o AppImage em ~/Applications
if [ -f "$HOME/Applications/Margem-1.0.0.AppImage" ]; then
  exec "$HOME/Applications/Margem-1.0.0.AppImage" "$@"
fi

echo "Erro: Nenhum executável do Margem encontrado." >&2
exit 1
