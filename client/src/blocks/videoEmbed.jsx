import { useState } from 'react'
import { createReactBlockSpec } from '@blocknote/react'
import { parseVideoUrl, embedUrl } from '../lib/video.js'

export const VideoEmbedBlock = createReactBlockSpec(
  {
    type: 'videoEmbed',
    propSchema: {
      url: { default: '' },
      caption: { default: '' },
    },
    content: 'none',
  },
  {
    render: ({ block, editor }) => {
      const parsed = parseVideoUrl(block.props.url)
      const [draft, setDraft] = useState(block.props.url)
      const [error, setError] = useState('')

      if (parsed) {
        return (
          <figure className="my-3 w-full">
            <div className="aspect-video overflow-hidden rounded-2xl border-2 border-ink">
              <iframe
                src={embedUrl(parsed)}
                title={block.props.caption || 'Embedded video'}
                className="size-full"
                allowFullScreen
              />
            </div>
            <input
              value={block.props.caption}
              onChange={(event) =>
                editor.updateBlock(block, { props: { caption: event.target.value } })
              }
              placeholder="Caption (optional)"
              className="mt-2 w-full bg-transparent text-center text-sm italic focus:outline-none"
            />
          </figure>
        )
      }

      return (
        <div className="my-3 rounded-2xl border-2 border-dashed border-ink p-4">
          <p className="text-sm font-semibold">Paste a YouTube or Vimeo link</p>
          <div className="mt-2 flex gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="https://youtu.be/…"
              className="flex-1 rounded-xl border-2 border-ink bg-card px-3 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                if (!parseVideoUrl(draft)) {
                  setError('Only YouTube and Vimeo links can be embedded')
                  return
                }
                setError('')
                editor.updateBlock(block, { props: { url: draft } })
              }}
              className="rounded-full border-2 border-ink bg-mustard px-4 py-1.5 text-sm font-semibold"
            >
              Embed
            </button>
          </div>
          {error ? <p className="mt-2 text-sm font-medium text-brick">{error}</p> : null}
        </div>
      )
    },
  },
)
