import type { Person } from '../types'
import type { DynastyStyle } from '../types'
import { lifeLabel, reignLabel } from '../lib/tree'

type Props = {
  person: Person
  dynasty?: DynastyStyle
  onClose: () => void
}

export function DetailPanel({ person, dynasty, onClose }: Props) {
  const reign = reignLabel(person)
  const life = lifeLabel(person)
  const isLink = person.reigning === false

  return (
    <aside className="panel" aria-label={`Details for ${person.name}`}>
      <div className="panel__gilt" />
      <button type="button" className="panel__close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <div className="panel__body">
        {dynasty && <div className="panel__dynasty">{dynasty.label}</div>}
        <h2 className="panel__name">{person.name}</h2>
        {person.epithet && <div className="panel__epithet">{person.epithet}</div>}
        <div className="panel__title">
          {person.title}
          {isLink ? ' · linking ancestor' : ''}
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
