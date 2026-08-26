# README_REVIEW — Fanta Auction OS (per revisione esterna)

## Nome progetto

**Fanta Auction OS 2026/27** (`fanta-auction-os`)

Cockpit d’asta Fantacalcio Serie A Classic: Fair Value, Live Max dinamico, tracker lega a 10, MOD Lab, rigoristi, Team Intel, G1 anti-hype.

## Framework

- **Vite 8** + **React 19** + **TypeScript**
- UI: CSS custom (`web/src/styles.css`), font via Google Fonts CDN (IBM Plex Sans/Mono)
- Ricerca fuzzy: `fuse.js`
- **Nessun backend**, nessun database server; dati embeddati in JSON

Root applicazione web: `web/`  
Root monorepo/progetto: repository root (questo file).

## Comandi

```bash
cd web
npm install
npm run dev      # Vite → tipicamente http://localhost:5173
npm run build    # tsc -b && vite build
npm run lint     # oxlint
npm run preview  # preview della build
```

Non ci sono script `test` / `typecheck` separati: il typecheck avviene in `npm run build` tramite `tsc -b`.

## Struttura cartelle

```
.
├── README.md
├── README_REVIEW.md          ← questa guida
├── listone_raw.json          ← export grezzo listone Classic
├── data/
│   └── Quotazioni_Fantacalcio_Stagione_2026_27.xlsx
├── scripts/
│   ├── enrich_dataset.py     ← genera web/src/data/*.json
│   └── smoke_accept.mjs
└── web/
    ├── package.json
    ├── package-lock.json
    ├── vite.config.ts
    ├── tsconfig*.json
    ├── index.html
    ├── public/               ← favicon/icons SVG
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── styles.css
        ├── types.ts
        ├── defaults.ts       ← budget template, slot, settings default, STORAGE_KEY
        ├── data/
        │   ├── players.json  ← dataset giocatori arricchito (runtime)
        │   ├── teams.json    ← 20 team intelligence
        │   └── meta.json     ← audit / policy dati
        ├── engine/
        │   ├── fairPrice.ts
        │   ├── liveMax.ts    ← Live Max, inflation, scarcity, financial max
        │   ├── portfolio.ts
        │   └── verdict.ts
        ├── store/
        │   └── useAuctionStore.ts  ← stato asta + localStorage
        ├── lib/search.ts
        ├── components/Shell.tsx
        └── pages/            ← Live, Piano, Board, Lega, MOD, Rigoristi, …
```

## Dove si trova il dataset giocatori

- **Runtime (embeddato):** `web/src/data/players.json` (array, 516 giocatori)
- **Meta audit:** `web/src/data/meta.json`
- **Team intel:** `web/src/data/teams.json`
- Importati da `web/src/store/useAuctionStore.ts`

## Dove sono i dati del listone

- Excel ufficiale: `data/Quotazioni_Fantacalcio_Stagione_2026_27.xlsx`
- JSON grezzo post-import: `listone_raw.json`
- Pipeline: `scripts/enrich_dataset.py` → `web/src/data/*.json`
- Ruoli Classic (`R`: P/D/C/A) non vengono alterati dall’enrichment

## Dove viene calcolato Fair Value

- `web/src/engine/fairPrice.ts` → `computeFairMap`, `effectiveScore`, VORP helpers
- Usato dallo store: `useAuctionStore` chiama `computeFairMap(allPlayers, settings, soldIds)`
- Parametri correlati in `web/src/defaults.ts`: `alpha`, `budgetPlan`, `replacementPurchased` / `replacementStarters`

## Dove viene calcolato Live Max

- `web/src/engine/liveMax.ts` → `computeLiveMax`
- Formula effettiva (codice): `fair × absorbedInflation × scarcity × need × budgetFactor`, poi clamp vs Fair e cap `financialMax`
- Cap finanziario: `credits − (slotsLeft − 1)` (`financialMax` / `teamEconomy`)

## Dove viene calcolata inflazione

- `web/src/engine/liveMax.ts` → `inflationFor(sales, role, tier?)`
- Mediana di `price / fairAtSale`; minimo **3** vendite comparabili; altrimenti fallback a ruolo senza tier
- Clamp: `settings.inflationClamp` (default `[0.75, 1.35]`)
- Assorbimento: `1 + inflationAbsorption × (inflation − 1)` (default absorption `0.55`)

## Dove viene calcolata scarcity

- Dentro `computeLiveMax` in `web/src/engine/liveMax.ts`
- Basata su `freeAlternatives` (stesso ruolo+tier ancora liberi):
  - ≥5 → 1.00
  - 3–4 → 1.03
  - 2 → 1.06
  - 0–1 → 1.10

## Dove vengono gestiti budget e slot dei 10 partecipanti

- Defaults lega: `web/src/defaults.ts` → `defaultLeague()` (IO + Rivale 1–9), `ROLE_SLOTS`, `TOTAL_SLOTS = 25`, `budget: 500`, template `TEMPLATES`
- Economia per team: `web/src/engine/liveMax.ts` → `teamEconomy`
- Stato vendite / rename / undo: `web/src/store/useAuctionStore.ts`
- UI tracker: `web/src/pages/LeaguePage.tsx`
- Settings budget/slot/switch: `web/src/pages/SettingsPage.tsx`

## Dove viene gestito il modificatore difesa

- Lab interattivo: `web/src/pages/ModLabPage.tsx` (voto P + D, top 3 D, soglie, CS bonus, euristica fasce gol)
- Soglie default: `defaults.ts` → `modThresholds` (`+1` 6.00–6.49, `+3` 6.50–6.99, `+5` ≥7.00)
- Score/proxy difensori e portfolio MOD: `web/src/engine/portfolio.ts` (+ campi `modProfile` nei player JSON)

## Dove vengono gestiti rigoristi / piazzati

- Dati seed per club: `web/src/data/teams.json` (+ campi `penalty` / `setPieces` su `players.json`)
- UI: `web/src/pages/PenaltiesPage.tsx`
- Team Intel accordion: `web/src/pages/IntelPage.tsx`
- Conversione EV rigore configurabile: `settings.penaltyConversion` in Settings / defaults

## Dove viene gestita la persistenza

- **Solo `localStorage`**, chiave `fanta-auction-os-v1` (`STORAGE_KEY` in `defaults.ts`)
- Load/save in `web/src/store/useAuctionStore.ts`
- Export/import JSON, CSV asta, CSV rosa: Settings (`SettingsPage.tsx`) + metodi store
- **IndexedDB: non usato**

## Dove sono definiti Switch Basic / Plus

- Tipo/settings: `web/src/types.ts` → `settings.switchMode: 'basic' | 'plus'`
- Default: `defaults.ts` → `switchMode: 'plus'`
- UI impostazioni: `SettingsPage.tsx`
- Uso in Live (suggerimenti cross-role solo con Plus): `LivePage.tsx` (legge `state.settings.switchMode`)

## Altri punti utili per la review

| Tema | Dove |
|------|------|
| Verdict STEAL/VALUE/FAIR/LIMIT/STOP | `web/src/engine/verdict.ts` |
| Portfolio health / capital at risk / pivot | `web/src/engine/portfolio.ts` |
| Piano 25 slot | `web/src/pages/PlanPage.tsx` |
| G1 / Young | `web/src/pages/G1Page.tsx` |
| Injury / market watch | `web/src/pages/WatchPage.tsx` |
| Player board | `web/src/pages/BoardPage.tsx` |
| Shell / nav | `web/src/components/Shell.tsx` |

## Limiti noti (dal codice / data policy, non inventati)

- Molte stats secondarie sono **N/D**; `baseScore` / floor / ceil sono **proxy da FVM/qtA**, non proiezioni empiriche inventate (`meta.json` / note player).
- `% voti ≥ 6.5` spesso `null` → mostrato N/D; MOD usa proxy.
- Inflazione Live Max richiede ≥3 vendite comparabili; sotto soglia resta N/D / non applicata.
- Import XLSX **non** è runtime in-app: si aggiorna via `scripts/enrich_dataset.py`.
- Nessun backend: offline/local only.
- Non risultano TODO/`Coming soon` marcati nel sorgente UI al momento della preparazione audit; Settings dichiara esplicitamente i limiti di persistenza/import.

### Verifica riproducibilità (2026-08-26)

| Check | Comando | Esito |
|-------|---------|-------|
| Install | `cd web && npm install` | OK (0 vulnerabilities) |
| Lint | `npm run lint` (oxlint) | OK exit 0 — warning non bloccanti: unused imports in `useAuctionStore.ts`; `set-state-in-effect` in `LivePage.tsx` |
| Typecheck + build | `npm run build` (`tsc -b && vite build`) | OK |
| Test automatici | n/a | Nessuno script `test` in `package.json` |

Nessuna modifica funzionale applicata per far passare la build.