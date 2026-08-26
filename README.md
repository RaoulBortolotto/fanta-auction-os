# Fanta Auction OS 2026/27

Cockpit d'asta Fantacalcio Serie A Classic — surplus, Live Max dinamico, MOD, rigoristi, tracker lega.

## Avvio

```bash
cd web
npm install
npm run dev
```

Apri l'URL di Vite (di solito http://localhost:5173).

## Dati

- Listone ufficiale: `Quotazioni_Fantacalcio_Stagione_2026_27.xlsx` (Fantacalcio.it Classic)
- Audit: **P 62 · D 184 · C 184 · A 86** (516 giocatori)
- Enrichment: `scripts/enrich_dataset.py` → `web/src/data/*.json`
- Snapshot seed: 2026-08-26 (+ Sky Sport rigoristi 2026-08-10 in divergenza)
- Statistiche non disponibili → **N/D** (mai inventate)

## Persistenza

Tutto locale: `localStorage` (`fanta-auction-os-v1`). Export/import JSON, CSV asta, CSV rosa in Settings.

## Filosofia

`SURPLUS = FAIR VALUE − PREZZO PAGATO`  
Massimizza produzione attesa + valore modificatore + surplus per credito, non i nomi.
