# Kings · Rois

Zoomable, time-scaled genealogical charts of the monarchs of **England** (Alfred the Great to Charles III) and **France** (Childeric I to Napoleon III). Available in **English** and **French**.

**Live:** https://knalpas.github.io/kings/

## Features

- **Bilingual.** Switch EN / FR in the header. Names, titles, summaries, houses and the whole interface follow the language. Deep links look like `#/fr/england/henry-viii`.
- **Rich lineage.** Beyond the monarchs: the ancestors who carried each claim (Godwin, the Dukes of Normandy from Rollo), heirs who died before reigning (William Adelin, Arthur Tudor, the Princes in the Tower), claimants (Edgar Ætheling, the Jacobites, the Count of Chambord) and the consorts and regents who shaped the line (Henry VIII’s queens, Lionel of Antwerp and the Mortimers behind the Yorkist claim, Charles Martel, Isabeau of Bavaria, Letizia Bonaparte), with dotted marriage lines and a note on how each story ended. Relationships are computed through both parents and by marriage (e.g. Harold II was Edward the Confessor’s brother-in-law).
- **True time scale.** Time runs downwards; each monarch sits at the year of accession.
- **Royal houses.** Colour-coded rings, bands and a navigable house rail.
- **Detail drawer.** Reign, ages, predecessor and successor with kinship, events, family and Wikipedia (English or French article).
- **Crowned monarchs and a directional succession line** that stay legible at every zoom level; separate bloodlines are packed beside the reigns they continue.
- **Search**, succession overlay, lineage highlighting, keyboard shortcuts.

## Develop

```bash
npm install
npm run dev
```

French copy lives in `src/i18n/fr-content.json`. UI strings are in `src/i18n/ui.ts`.

## Deploy (GitHub Pages)

```bash
npm run deploy
```

Vite `base` is `/kings/` for `https://knalpas.github.io/kings/`.
