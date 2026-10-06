# Proposta (blocco 8, non implementata): memoria e sicurezza dei dati dello studente

Stato oggi. Versione web: file e taccuino in IndexedDB del browser, per browser e profilo; in finestra privata o dopo "cancella dati del sito" si perdono. Versione locale: cartella `~/QqQ_lab_lavoro/sessione_...`.

1. **Esporta/Importa sessione (.zip)**: un pulsante nell'ingranaggio. Lo zip contiene i file caricati (come sono), `taccuino.json` (pannelli, integrazioni, etichette, colori, bianco interno) e un `LEGGIMI.txt`. Importa ricrea la sessione sullo stesso o su un altro computer. E' il salvataggio di sicurezza e il modo di consegnare il lavoro. Costo: media (la scrittura zip esiste gia' in `xlsx.js`; serve solo un lettore zip, o `DecompressionStream`). Rischio basso: non cambia il formato interno.
2. **`navigator.storage.persist()`**: chiederlo al primo caricamento. Chrome/Edge lo concedono in base all'uso, Safari/Firefox chiedono il permesso. Riduce la perdita di dati per pulizia automatica del browser. Costo: poche righe. Mostrare in "Impostazioni" se e' concesso e quanto spazio usa la sessione (`navigator.storage.estimate()`).
3. **"Cancella dati" visibile**: pulsante nell'ingranaggio, con conferma, che svuota IndexedDB, localStorage e cache del service worker. Utile nei computer condivisi del laboratorio. Costo: basso.
4. **Versione locale**: niente `.exe` con PyInstaller (falsi positivi degli antivirus, nessuna firma). Se la cartella di lavoro confonde: nome chiaro (`QqQ_lab_lavoro/sessione_AAAA-MM-GG_hhmm`) e percorso mostrato in un punto fisso dell'interfaccia (barra in basso o ingranaggio) con pulsante "Apri cartella".

Ordine consigliato: 3, 2, 1, 4. Non decido io: dipende da quanto vuoi che gli studenti lavorino su computer condivisi.
