# Sceptre · An atlas of royal succession

Zoomable, time-scaled genealogical charts of the monarchs of **England** (Alfred the Great to Charles III) and **France** (Pepin the Short to Napoleon III).

**Live:** https://knalpas.github.io/kings/

## Features

- **True time scale.** Time runs downwards, and each monarch sits at the year of accession. A year ruler and a "current house" chip follow you as you scroll.
- **Royal houses.** Each house has its own colour, used for portrait rings, background bands, the ruler and the side rail. Click a house in the rail to highlight it and read about it.
- **Overview navigator.** Drag the coloured timeline in the rail to move through the centuries.
- **Detail drawer.** Click any portrait to see the reign, its length, birth and death, age at accession, predecessor and successor with their relationship (for example "her first cousin twice removed"), key events, family and a Wikipedia link.
- **Lineage highlighting.** Selecting a person highlights their ancestors and descendants.
- **Succession overlay.** Shows the order of the crown, including passes between branches.
- **Search** (press `/`), deep links (`#/england/henry-viii`), `←`/`→` to step through the succession, `Esc` to close.
- Portraits come from Wikimedia Commons. Layouts are tuned for both desktop and mobile.

## Controls

| Action | Input |
| --- | --- |
| Move through time | Scroll, or drag |
| Zoom | Ctrl/⌘ + scroll, pinch, or the `+`/`−` buttons |
| Pan sideways | Shift + scroll, or drag |
| Reset view | `0` or the frame button |

## Develop

```bash
npm install
npm run dev
```

Data lives in `src/data/england.ts` and `src/data/france.ts`. After adding people, run `npm run portraits` to fetch and optimise any missing portraits.

## Deploy (GitHub Pages)

```bash
npm run deploy
```

Uses the `gh-pages` branch. Vite `base` is `/kings/` for `https://knalpas.github.io/kings/`.
