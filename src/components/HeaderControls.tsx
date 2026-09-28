import { useMemo, useState } from 'react'
import type { Kingdom, Person } from '../types'
import { kingdomMeta, peopleFor } from '../data'
import { portraitSrc } from '../data/portraits'

type Props = {
  kingdom: Kingdom
  onPick: (id: string) => void
}

export function SearchBox({ kingdom, onPick }: Props) {
  const [q, setQ] = useState('')
  const people = peopleFor(kingdom)

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (needle.length < 2) return [] as Person[]
    return people
      .filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          p.shortName.toLowerCase().includes(needle) ||
          p.epithet?.toLowerCase().includes(needle) ||
          p.dynasty.includes(needle),
      )
      .slice(0, 8)
  }, [people, q])

  return (
    <div className="search">
      <span className="search__icon" aria-hidden>
        ⌕
      </span>
      <input
        type="search"
        placeholder="Find a monarch…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search monarchs"
      />
      {results.length > 0 && (
        <div className="search__results" role="listbox">
          {results.map((p) => {
            const src = portraitSrc(p.id)
            return (
              <button
                key={p.id}
                type="button"
                role="option"
                onClick={() => {
                  onPick(p.id)
                  setQ('')
                }}
              >
                {src ? (
                  <img className="search__thumb" src={src} alt="" />
                ) : (
                  <span className="search__thumb" />
                )}
                <span>
                  <strong>{p.name}</strong>
                  <span>
                    {p.title}
                    {p.reignStart != null ? ` · ${p.reignStart}` : ''}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function KingdomToggle({
  kingdom,
  onChange,
}: {
  kingdom: Kingdom
  onChange: (k: Kingdom) => void
}) {
  return (
    <div className="kingdom-toggle" role="group" aria-label="Kingdom">
      <button
        type="button"
        className={kingdom === 'france' ? 'is-active' : undefined}
        aria-pressed={kingdom === 'france'}
        onClick={() => onChange('france')}
      >
        {kingdomMeta.france.label}
      </button>
      <button
        type="button"
        className={kingdom === 'england' ? 'is-active' : undefined}
        aria-pressed={kingdom === 'england'}
        onClick={() => onChange('england')}
      >
        {kingdomMeta.england.label}
      </button>
    </div>
  )
}
