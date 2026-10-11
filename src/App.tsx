import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Kingdom } from './types'
import { kingdomOrder, kingdoms } from './data'
import { computeLayout } from './lib/layout'
import { createViewport } from './lib/viewport'
import { Chart, type ChartApi } from './components/Chart'
import { Header } from './components/Header'
import { HouseRail } from './components/HouseRail'
import { DetailDrawer } from './components/DetailDrawer'
import { LocaleProvider } from './i18n/locale'
import { localizeKingdom } from './i18n/localize'
import { isLocale, type Locale } from './i18n/types'
import { ui } from './i18n/ui'

const DRAWER_W = 420

function browserLocale(): Locale {
  try {
    const stored = localStorage.getItem('kings-locale')
    if (isLocale(stored ?? '')) return stored as Locale
  } catch {
    /* ignore */
  }
  return typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en'
}

function readHash(): { locale: Locale; kingdom: Kingdom; id: string | null } {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  let locale = browserLocale()
  let rest = parts
  if (isLocale(parts[0])) {
    locale = parts[0]
    rest = parts.slice(1)
  }
  const kingdom = kingdomOrder.includes(rest[0] as Kingdom) ? (rest[0] as Kingdom) : 'england'
  const id = rest[1]
  const valid = id && kingdoms[kingdom].people.some((p) => p.id === id)
  return { locale, kingdom, id: valid ? id : null }
}

function useWide() {
  const query = '(min-width: 900px)'
  const [wide, setWide] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}

export default function App() {
  const initial = useMemo(() => readHash(), [])
  const [locale, setLocale] = useState<Locale>(initial.locale)
  const [kingdom, setKingdom] = useState<Kingdom>(initial.kingdom)
  const [selectedId, setSelectedId] = useState<string | null>(initial.id)
  const [houseFocus, setHouseFocus] = useState<string | null>(null)
  const [showSuccession, setShowSuccession] = useState(false)
  const viewport = useMemo(() => createViewport(), [])
  const api = useRef<ChartApi>(null)
  const wide = useWide()

  const base = kingdoms[kingdom]
  const structure = useMemo(() => computeLayout(base.people, base.houses, base.gaps), [base])
  const data = useMemo(() => localizeKingdom(base, locale), [base, locale])
  const layout = useMemo(() => {
    const byId = new Map(data.people.map((p) => [p.id, p]))
    const houseById = new Map(data.houses.map((h) => [h.id, h]))
    const gapLabel = new Map(data.gaps.map((g) => [`${g.start}-${g.end}`, g.label]))
    return {
      ...structure,
      nodes: structure.nodes.map((n) => ({ ...n, person: byId.get(n.id)! })),
      byId: new Map(structure.nodes.map((n) => [n.id, { ...n, person: byId.get(n.id)! }])),
      chain: structure.chain.map((p) => byId.get(p.id)!),
      bands: structure.bands.map((b) => ({
        ...b,
        label: b.kind === 'gap' ? (gapLabel.get(`${b.start}-${b.end}`) ?? b.label) : (houseById.get(b.houseId!)?.label ?? b.label),
      })),
    }
  }, [structure, data])

  const houses = useMemo(() => new Map(data.houses.map((h) => [h.id, h])), [data])
  const index = useMemo(() => new Map(data.people.map((p) => [p.id, p])), [data])
  const selected = selectedId ? index.get(selectedId) ?? null : null
  const kingdomLabels = useMemo(
    () => ({ england: ui[locale].england, france: ui[locale].france }) satisfies Record<Kingdom, string>,
    [locale],
  )

  const writeHash = useCallback((nextLocale: Locale, nextKingdom: Kingdom, nextId: string | null) => {
    const hash = nextId ? `#/${nextLocale}/${nextKingdom}/${nextId}` : `#/${nextLocale}/${nextKingdom}`
    if (window.location.hash !== hash) history.replaceState(null, '', hash)
  }, [])

  useEffect(() => {
    writeHash(locale, kingdom, selectedId)
    document.documentElement.lang = locale
    try {
      localStorage.setItem('kings-locale', locale)
    } catch {
      /* ignore */
    }
    const brand = ui[locale].brand
    document.title = selected ? `${selected.name} · ${brand}` : `${data.title} · ${brand}`
  }, [locale, kingdom, selectedId, selected, data.title, writeHash])

  useEffect(() => {
    const onHash = () => {
      const h = readHash()
      setLocale(h.locale)
      setKingdom(h.kingdom)
      setSelectedId(h.id)
      if (h.id) requestAnimationFrame(() => api.current?.focus(h.id!))
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    if (initial.id) requestAnimationFrame(() => api.current?.focus(initial.id!))
  }, [initial])

  const switchKingdom = (k: Kingdom) => {
    if (k === kingdom) return
    setKingdom(k)
    setSelectedId(null)
    setHouseFocus(null)
  }

  const switchLocale = (l: Locale) => {
    if (l === locale) return
    setLocale(l)
  }

  const go = useCallback((id: string) => {
    setSelectedId(id)
    requestAnimationFrame(() => api.current?.focus(id))
  }, [])

  const selectFromChart = useCallback((id: string | null) => {
    setSelectedId(id)
    if (id) requestAnimationFrame(() => api.current?.reveal(id))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (/INPUT|TEXTAREA|SELECT/.test(el.tagName)) return
      if (e.key === 'Escape') {
        if (selectedId) setSelectedId(null)
        else setHouseFocus(null)
        return
      }
      if (e.key === '+' || e.key === '=') api.current?.zoomBy(1.3)
      if (e.key === '-') api.current?.zoomBy(1 / 1.3)
      if (e.key === '0') api.current?.fit()
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && selected?.reign) {
        const i = layout.chain.findIndex((p) => p.id === selected.id)
        const next = layout.chain[i + (e.key === 'ArrowRight' ? 1 : -1)]
        if (next) {
          e.preventDefault()
          go(next.id)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, selected, layout, go])

  const inset = selected && wide ? DRAWER_W : 0
  const t = ui[locale]

  return (
    <LocaleProvider locale={locale}>
      <div className="app">
        <Header
          kingdom={kingdom}
          people={data.people}
          houses={houses}
          showSuccession={showSuccession}
          kingdomLabels={kingdomLabels}
          onKingdom={switchKingdom}
          onLocale={switchLocale}
          onPick={go}
          onToggleSuccession={() => setShowSuccession((s) => !s)}
        />
        <div className="workspace">
          <HouseRail
            layout={layout}
            houses={data.houses}
            viewport={viewport}
            houseFocus={houseFocus}
            onHouseFocus={setHouseFocus}
            onScrollToYear={(y, animate) => api.current?.scrollToYear(y, animate)}
          />
          <main className="stage">
            <Chart
              key={kingdom}
              kingdom={kingdom}
              layout={layout}
              houses={houses}
              title={data.title}
              subtitle={data.subtitle}
              selectedId={selectedId}
              houseFocus={houseFocus}
              showSuccession={showSuccession}
              rightInset={inset}
              bottomInset={selected && !wide ? Math.round(window.innerHeight * 0.64) - 60 : 0}
              viewport={viewport}
              onSelect={selectFromChart}
              onHouseFocus={setHouseFocus}
              apiRef={api}
            />
            <div className="zoom" style={{ right: inset + 20 }} aria-label="Zoom">
              <button type="button" onClick={() => api.current?.zoomBy(1.35)} aria-label={t.zoomIn} title={`${t.zoomIn} (+)`}>
                <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                  <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
              <button type="button" onClick={() => api.current?.zoomBy(1 / 1.35)} aria-label={t.zoomOut} title={`${t.zoomOut} (−)`}>
                <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                  <path d="M4 10h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
              <button type="button" onClick={() => api.current?.fit()} aria-label={t.resetView} title={`${t.resetView} (0)`}>
                <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                  <path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            {selected && (
              <DetailDrawer
                kingdom={kingdom}
                person={selected}
                people={data.people}
                index={index}
                houses={houses}
                chain={layout.chain}
                gaps={data.gaps}
                houseFocus={houseFocus}
                onSelect={go}
                onHouseFocus={setHouseFocus}
                onClose={() => setSelectedId(null)}
              />
            )}
          </main>
        </div>
      </div>
    </LocaleProvider>
  )
}
