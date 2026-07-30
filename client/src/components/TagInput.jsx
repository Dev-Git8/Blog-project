import { useState } from 'react'
import { Badge } from './ui/Badge.jsx'

const clean = (raw) =>
  raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)

export function TagInput({ value = [], onChange, max = 5 }) {
  const [draft, setDraft] = useState('')

  function commit(event) {
    if (event.key !== 'Enter' && event.key !== ',') return
    event.preventDefault()

    const tag = clean(draft)
    setDraft('')
    if (!tag || value.includes(tag) || value.length >= max) return
    onChange([...value, tag])
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="tags" className="text-sm font-semibold">
        Tags{' '}
        <span className="font-normal">
          ({value.length} of {max})
        </span>
      </label>

      {value.length ? (
        <ul className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <li key={tag}>
              <Badge>
                {tag}
                <button
                  type="button"
                  aria-label={`Remove ${tag}`}
                  onClick={() => onChange(value.filter((item) => item !== tag))}
                  className="ml-1.5 font-bold"
                >
                  ×
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}

      <input
        id="tags"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={commit}
        placeholder={value.length >= max ? 'Tag limit reached' : 'Type a tag and press Enter'}
        disabled={value.length >= max}
        className="rounded-xl border-2 border-ink bg-card px-3.5 py-2 disabled:opacity-60"
      />
    </div>
  )
}
