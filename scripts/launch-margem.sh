#!/usr/bin/env bash
# Launcher robusto para o Margem no Linux / Fedora
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Se o binário Linux desempacotado existir, roda diretamente (rápido e sem dependência do libfuse.so.2)
if [ -x "$DIR/dist-package/linux-unpacked/caderno-reader" ]; then
  exec "$DIR/dist-package/linux-unpacked/caderno-reader" "$@"
fi

# Fallback: executa o AppImage com extração automática caso FUSE não esteja instalado
if [ -f "$DIR/dist-package/Margem-1.0.0.AppImage" ]; then
  exec "$DIR/dist-package/Margem-1.0.0.AppImage" --appimage-extract-and-run "$@"
fi

echo "Erro: Nenhum executável do Margem encontrado em $DIR/dist-package." >&2
exit 1
