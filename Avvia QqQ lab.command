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
    if [ $status -ne 0 ]; then read -n 1 -s -r -p "Premi un tasto per chiudere..."
    else   # program closed normally (browser page closed): close this Terminal window too
      # osascript runs in its OWN session (start_new_session): if it stayed on this window's tty, Terminal would see a
      # running process and ask for confirmation instead of closing. 'delay 1' lets this shell exit first.
      T=$(tty)
      # the osascript answer goes to .chiusura.log (if the window ever stays open, the reason is written there)
      "$c" -c 'import subprocess, sys; subprocess.Popen(["/usr/bin/osascript", "-e", sys.argv[1]], stdin=subprocess.DEVNULL, stdout=open(sys.argv[2], "w"), stderr=subprocess.STDOUT, start_new_session=True)' \
        "delay 1
tell application \"Terminal\" to close (every window whose tty of selected tab is \"$T\") saving no" "$PWD/.chiusura.log" >/dev/null 2>&1
    fi
    exit $status
  fi
done
echo "Serve Python 3.11 o piu' recente (consigliato l'ultimo): https://www.python.org/downloads/ e poi rifai doppio clic."
read -n 1 -s -r -p "Premi un tasto per chiudere..."
exit 1
