import { createReactBlockSpec } from '@blocknote/react'

// Items live as a JSON string because BlockNote props must be primitives.
const parseItems = (raw) => {
  try {
    const parsed = JSON.parse(raw || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const ReferencesBlock = createReactBlockSpec(
  {
    type: 'references',
    propSchema: {
      title: { default: 'References' },
      items: { default: '[]' },
    },
    content: 'none',
  },
  {
    render: ({ block, editor }) => {
      const items = parseItems(block.props.items)

      const write = (next) => editor.updateBlock(block, { props: { items: JSON.stringify(next) } })

      const update = (index, key, value) =>
        write(items.map((item, i) => (i === index ? { ...item, [key]: value } : item)))

      return (
        <aside className="my-3 w-full rounded-2xl border-2 border-ink bg-card p-4">
          <input
            value={block.props.title}
            onChange={(event) => editor.updateBlock(block, { props: { title: event.target.value } })}
            className="w-full bg-transparent text-sm font-bold uppercase tracking-widest focus:outline-none"
          />

          <ol className="mt-3 list-decimal space-y-2 pl-5">
            {items.map((item, index) => (
              <li key={index} className="flex flex-wrap gap-2">
                <input
                  value={item.label ?? ''}
                  onChange={(event) => update(index, 'label', event.target.value)}
                  placeholder="What is it called?"
                  className="min-w-40 flex-1 rounded-lg border-2 border-ink bg-parchment px-2 py-1 text-sm"
                />
                <input
                  value={item.url ?? ''}
                  onChange={(event) => update(index, 'url', event.target.value)}
                  placeholder="https://…"
                  className="min-w-40 flex-1 rounded-lg border-2 border-ink bg-parchment px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  aria-label={`Remove reference ${index + 1}`}
                  onClick={() => write(items.filter((_, i) => i !== index))}
                  className="px-2 font-bold"
                >
                  ×
                </button>
              </li>
            ))}
          </ol>

          <button
            type="button"
            onClick={() => write([...items, { label: '', url: '' }])}
            className="mt-3 rounded-full border-2 border-ink bg-mustard px-3 py-1 text-sm font-semibold"
          >
            Add a reference
          </button>
        </aside>
      )
    },
  },
)
