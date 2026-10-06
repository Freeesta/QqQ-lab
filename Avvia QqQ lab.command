#!/bin/bash
# Double-click to open QqQ lab (Mac). The logic lives in scripts/avvia.py: it builds or updates the private
# environment (.venv-tpfinder) with the newest Python installed (>= 3.11), then opens the app.
cd "$(dirname "$0")" || exit 1
printf '\033]0;QqQ lab\007\033[H\033[2J\033[3J'   # window title "QqQ lab", clean screen
for c in python3 /Library/Frameworks/Python.framework/Versions/Current/bin/python3 /opt/homebrew/bin/python3 \
         /usr/local/bin/python3 /usr/bin/python3; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)' 2>/dev/null; then
    "$c" scripts/avvia.py "$@"
    status=$?
    if [ $status -ne 0 ]; then read -n 1 -s -r -p "Premi un tasto per chiudere..."; fi
    exit $status
  fi
done
echo "Serve Python 3.11 o piu' recente (consigliato l'ultimo): https://www.python.org/downloads/ e poi rifai doppio clic."
read -n 1 -s -r -p "Premi un tasto per chiudere..."
exit 1
