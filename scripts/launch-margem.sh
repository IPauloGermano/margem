#!/usr/bin/env bash
# Launcher robusto para o Margem no Linux / Fedora
# Agnóstico à versão: encontra automaticamente o AppImage/unpacked mais recente.
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# 1. Binário Linux desempacotado (mais rápido, sem dependência de FUSE)
if [ -x "$DIR/dist-package/linux-unpacked/caderno-reader" ]; then
  exec "$DIR/dist-package/linux-unpacked/caderno-reader" "$@"
fi

# 2. AppImage no repositório (qualquer versão, o mais novo primeiro)
REPO_APPIMAGE=$(ls -t "$DIR"/dist-package/Margem-*.AppImage 2>/dev/null | grep -v '\.0\.0' | head -1)
if [ -f "$REPO_APPIMAGE" ]; then
  exec "$REPO_APPIMAGE" "$@"
fi
# Fallback: qualquer AppImage incluindo links simbólicos
REPO_APPIMAGE=$(ls -t "$DIR"/dist-package/Margem-*.AppImage 2>/dev/null | head -1)
if [ -f "$REPO_APPIMAGE" ]; then
  exec "$REPO_APPIMAGE" "$@"
fi

# 3. AppImage em ~/Applications (qualquer versão, o mais novo primeiro)
HOME_APPIMAGE=$(ls -t "$HOME"/Applications/Margem-*.AppImage 2>/dev/null | head -1)
if [ -f "$HOME_APPIMAGE" ]; then
  exec "$HOME_APPIMAGE" "$@"
fi

echo "Erro: Nenhum executável do Margem encontrado." >&2
exit 1
