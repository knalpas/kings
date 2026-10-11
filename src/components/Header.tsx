import { useEffect, useMemo, useRef, useState } from 'react'
import type { House, Kingdom, Person } from '../types'
import { kingdomOrder } from '../data'
import { initials, portraitSrc } from '../data/portraits'
import { lifeText, reignText, roleLabel } from '../lib/genealogy'
import { useLocale } from '../i18n/locale'
import type { Locale } from '../i18n/types'
import { houseShortLabel } from '../i18n/localize'

type Props = {
  kingdom: Kingdom
  people: Person[]
  houses: Map<string, House>
  showSuccession: boolean
  kingdomLabels: Record<Kingdom, string>
  onKingdom: (k: Kingdom) => void
  onLocale: (l: Locale) => void
  onPick: (id: string) => void
  onToggleSuccession: () => void
}

export function Header({
  kingdom,
  people,
  houses,
  showSuccession,
  kingdomLabels,
  onKingdom,
  onLocale,
  onPick,
  onToggleSuccession,
}: Props) {
  const { locale, t } = useLocale()

  return (
    <header className="topbar">
      <div className="brand">
        <svg className="brand__mark" viewBox="0 0 32 32" aria-hidden="true">
          <path d="M5 23h22l1.6-12-6.3 5L16 7l-6.3 9-6.3-5z" fill="currentColor" />
          <rect x="5" y="25" width="22" height="3" rx="1" fill="currentColor" />
        </svg>
        <div>
          <div className="brand__name">{t.brand}</div>
          <div className="brand__tag">{t.tagline}</div>
        </div>
      </div>

      <div className="seg" role="tablist" aria-label={t.kingdomAria}>
        {kingdomOrder.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={k === kingdom} className={k === kingdom ? 'is-on' : ''} onClick={() => onKingdom(k)}>
            {kingdomLabels[k]}
          </button>
        ))}
      </div>

      <div className="topbar__tools">
        <Search kingdom={kingdom} people={people} houses={houses} onPick={onPick} />
        <button type="button" className={`toggle${showSuccession ? ' is-on' : ''}`} aria-pressed={showSuccession} onClick={onToggleSuccession} title={t.successionTitle}>
          <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
            <path d="M4 3c0 6 12 4 12 10" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            <path d="M12.5 12.5L16 18l3.5-5.5z" fill="currentColor" />
            <circle cx="4" cy="3" r="2" fill="currentColor" />
          </svg>
          <span>{t.succession}</span>
        </button>
        <Key />
        <div className="lang" role="group" aria-label={t.language}>
          <button type="button" className={locale === 'en' ? 'is-on' : ''} aria-pressed={locale === 'en'} onClick={() => onLocale('en')}>
            {t.langEn}
          </button>
          <button type="button" className={locale === 'fr' ? 'is-on' : ''} aria-pressed={locale === 'fr'} onClick={() => onLocale('fr')}>
            {t.langFr}
          </button>
        </div>
      </div>
    </header>
  )
}

function normalise(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/æ/gi, 'ae')
    .toLowerCase()
}

function Search({ kingdom, people, houses, onPick }: { kingdom: Kingdom; people: Person[]; houses: Map<string, House>; onPick: (id: string) => void }) {
  const { locale, t } = useLocale()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (e.key === '/' && !/INPUT|TEXTAREA/.test(target.tagName)) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const results = useMemo(() => {
    const n = normalise(q.trim())
    if (!n) return []
    const scored = people
      .map((p) => {
        const hay = normalise([p.name, p.short, p.epithet, p.title, houses.get(p.house)?.label].filter(Boolean).join(' '))
        const name = normalise(p.name)
        const score = name.startsWith(n) ? 0 : name.includes(n) ? 1 : hay.includes(n) ? 2 : -1
        return { p, score }
      })
      .filter((x) => x.score >= 0)
    scored.sort((a, b) => a.score - b.score || Number(!a.p.reign) - Number(!b.p.reign))
    return scored.slice(0, 8).map((x) => x.p)
  }, [q, people, houses])

  const pick = (id: string) => {
    onPick(id)
    setQ('')
    setOpen(false)
    inputRef.current?.blur()
  }

  return (
    <div className="search">
      <svg className="search__icon" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
        <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.6" fill="none" />
        <path d="M13 13l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <input
        ref={inputRef}
        type="search"
        value={q}
        placeholder={t.searchPlaceholder}
        aria-label={t.searchAria}
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls="search-results"
        onChange={(e) => {
          setQ(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => Math.min(a + 1, results.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter' && results[active]) {
            pick(results[active].id)
          } else if (e.key === 'Escape') {
            setQ('')
            inputRef.current?.blur()
          }
          e.stopPropagation()
        }}
      />
      {!q && <kbd className="search__kbd">/</kbd>}
      {open && results.length > 0 && (
        <ul className="search__results" id="search-results" role="listbox">
          {results.map((p, i) => {
            const house = houses.get(p.house)
            const src = portraitSrc(kingdom, p.id)
            return (
              <li key={p.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  className={i === active ? 'is-active' : ''}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(p.id)}
                >
                  <span className="avatar" style={{ width: 34, height: 34, borderColor: house?.color }}>
                    {src ? <img src={src} alt="" /> : <span style={{ color: house?.color }}>{initials(p.name)}</span>}
                  </span>
                  <span className="search__text">
                    <span className="search__name">{p.name}</span>
                    <span className="search__meta">
                      {p.reign ? reignText(p, locale) : `${lifeText(p, locale)} · ${p.role ? roleLabel(p, locale) : t.didNotReign}`} · {house ? houseShortLabel(house.label, locale) : ''}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function Key() {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])

  return (
    <div className="key" ref={ref}>
      <button type="button" className={`toggle${open ? ' is-on' : ''}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>{t.howToRead}</span>
      </button>
      {open && (
        <div className="key__panel" role="dialog" aria-label={t.howToReadAria}>
          <p className="key__lede">{t.keyLede}</p>
          <ul>
            <li>
              <svg viewBox="0 0 40 40" width="36" height="36" aria-hidden="true">
                <path d="M14.5 9L13 1.5l4 3.5L20 0l3 5 4-3.5L25.5 9z" fill="#a7843c" />
                <circle cx="20" cy="21" r="11" fill="#fffdf8" stroke="#2d4f8f" strokeWidth="3" />
                <rect x="14" y="29" width="12" height="9" rx="4.5" fill="#2d4f8f" />
              </svg>
              <span>
                <b>{t.keyMonarch}</b> {t.keyMonarchBody}
              </span>
            </li>
            <li>
              <svg viewBox="0 0 40 40" width="36" height="36" aria-hidden="true">
                <circle cx="20" cy="20" r="9" fill="#fffdf8" stroke="#8a847a" strokeWidth="2" />
              </svg>
              <span>
                <b>{t.keyAncestor}</b> {t.keyAncestorBody}
              </span>
            </li>
            <li>
              <svg viewBox="0 0 40 40" width="36" height="36" aria-hidden="true">
                <circle cx="20" cy="20" r="9" fill="#fffdf8" stroke="#8a847a" strokeWidth="2" strokeDasharray="3 2.5" />
              </svg>
              <span>
                <b>{t.keyConsort}</b> {t.keyConsortBody}
              </span>
            </li>
            <li>
              <svg viewBox="0 0 40 20" width="36" height="18" aria-hidden="true">
                <text x="20" y="13" textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#a7843c" letterSpacing="0.08em">
                  HEIR
                </text>
              </svg>
              <span>
                <b>{t.keyHeir}</b> {t.keyHeirBody}
              </span>
            </li>
            <li>
              <svg viewBox="0 0 40 20" width="36" height="18" aria-hidden="true">
                <path d="M2 10h36" stroke="#6b6155" strokeWidth="1.6" />
              </svg>
              <span>
                <b>{t.keyParentChild}</b>
              </span>
            </li>
            <li>
              <svg viewBox="0 0 40 20" width="36" height="18" aria-hidden="true">
                <path d="M2 10h36" stroke="#6b6155" strokeWidth="1.6" strokeDasharray="4 4" />
              </svg>
              <span>
                <b>{t.keyDistant}</b> {t.keyDistantBody}
              </span>
            </li>
            <li>
              <svg viewBox="0 0 40 20" width="36" height="18" aria-hidden="true">
                <path d="M2 10h28" stroke="#a7843c" strokeWidth="2.6" strokeLinecap="round" />
                <path d="M29 5l9 5-9 5z" fill="#a7843c" />
              </svg>
              <span>
                <b>{t.keySuccession}</b>
                {t.keySuccessionBody}
              </span>
            </li>
            <li>
              <svg viewBox="0 0 40 20" width="36" height="18" aria-hidden="true">
                <defs>
                  <pattern id="key-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="6" height="6" fill="#efebe3" />
                    <line x1="0" y1="0" x2="0" y2="6" stroke="#cfc6b5" strokeWidth="2.5" />
                  </pattern>
                </defs>
                <rect x="2" y="2" width="36" height="16" fill="url(#key-hatch)" />
              </svg>
              <span>
                <b>{t.keyGap}</b>
                {t.keyGapBody}
              </span>
            </li>
          </ul>
          <p className="key__hint">{t.keyHint}</p>
        </div>
      )}
    </div>
  )
}
