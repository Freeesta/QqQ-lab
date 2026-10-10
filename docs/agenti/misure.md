# Misure dei motori (`python3 tools/bench.py`)
Chromium Linux, sito costruito, 6 file Full Scan (31,9 MB), stessa macchina, un giro. «open» = caricamento + primo TIC disegnato; «TIC+XIC» = 6 TIC e 30 XIC. Con `?motore=rust` il motore Python resta caricato e legge comunque i file (Rust risponde solo a TIC, XIC e scansioni): la memoria è la somma dei due.

| motore | avvio (s) | open (s) | TIC+XIC (s) | richieste | RSS browser (MB) |
|---|---|---|---|---|---|
| Python (Pyodide) | 3,87 | 3,15 | 0,19 | 36 | 1066,5 |
| Rust (`?motore=rust`) | 3,86 | 3,71 | 0,10 | 36 | 1081,3 |

Il cancello di `ARCHITETTURA.md` §5 (tempo ≤ 50 % oppure memoria ≤ 60 %) non è raggiunto sull'insieme: Rust dimezza solo il tempo di TIC e XIC (già inferiore al secondo), il resto dipende ancora da Python.
