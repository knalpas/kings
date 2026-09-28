import type { Person, DynastyStyle } from '../types'
import { lifeLabel, reignLabel } from '../lib/tree'
import { portraitSrc } from '../data/portraits'

type Props = {
  person: Person
  dynasty?: DynastyStyle
  onClose: () => void
}

function initials(name: string): string {
  const parts = name.replace(/,/g, '').split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function DetailPanel({ person, dynasty, onClose }: Props) {
  const reign = reignLabel(person)
  const life = lifeLabel(person)
  const isLink = person.reigning === false
  const src = portraitSrc(person.id)

  return (
    <aside className="panel" aria-label={`Details for ${person.name}`}>
      <div className="panel__gilt" />
      <button type="button" className="panel__close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <div className="panel__body">
        <div className="panel__hero">
          <div
            className="panel__portrait-wrap"
            style={dynasty ? { background: dynasty.color } : undefined}
          >
            {src ? (
              <img className="panel__portrait" src={src} alt="" />
            ) : (
              <div className="panel__portrait-fallback">{initials(person.name)}</div>
            )}
          </div>
          <div>
            {dynasty && (
              <div className="panel__dynasty" style={{ color: dynasty.color }}>
                {dynasty.label}
              </div>
            )}
            <h2 className="panel__name">{person.name}</h2>
            {person.epithet && <div className="panel__epithet">{person.epithet}</div>}
            <div className="panel__title">
              {person.title}
              {isLink ? ' · linking ancestor' : ''}
            </div>
          </div>
        </div>
        <dl className="panel__meta">
          {reign && (
            <>
              <dt>Reign</dt>
              <dd>{reign}</dd>
            </>
          )}
          {life && (
            <>
              <dt>Life</dt>
              <dd>{life}</dd>
            </>
          )}
        </dl>
        <p className="panel__summary">{person.summary}</p>
        {person.notable && person.notable.length > 0 && (
          <ul className="panel__notable">
            {person.notable.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
        {person.wikipedia && (
          <a
            className="panel__wiki"
            href={`https://en.wikipedia.org/wiki/${person.wikipedia}`}
            target="_blank"
            rel="noreferrer"
          >
            Wikipedia ↗
          </a>
        )}
      </div>
    </aside>
  )
}
