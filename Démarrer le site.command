#!/bin/zsh
cd -- "$(dirname -- "$0")"
echo 'Ouvrez http://localhost:8787 dans votre navigateur.'
echo 'Gardez cette fenêtre ouverte pour utiliser le site. Ctrl+C pour arrêter.'
if [ -x /opt/homebrew/bin/node ]; then
  /opt/homebrew/bin/node server.mjs
else
  node server.mjs
fi
read '?Appuyez sur Entrée pour fermer cette fenêtre.'
