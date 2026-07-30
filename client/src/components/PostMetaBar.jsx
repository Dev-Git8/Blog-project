import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from './ui/Button.jsx'
import { Card } from './ui/Card.jsx'
import { TagInput } from './TagInput.jsx'

function SaveState({ status, onRetry }) {
  if (status === 'saving') return <span className="text-sm">Saving…</span>
  if (status === 'saved') return <span className="text-sm">Saved</span>
  if (status === 'error') {
    return (
      <span role="alert" className="flex items-center gap-2 text-sm font-semibold text-brick">
        Not saved
        <Button variant="danger" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </span>
    )
  }
  return null
}

export function PostMetaBar({
  post,
  onTitleChange,
  onTagsChange,
  onCoverChange,
  onPublish,
  onUnpublish,
  onDelete,
  onRetry,
  saveStatus,
  busy = false,
}) {
  const [confirming, setConfirming] = useState(false)

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="title" className="text-sm font-semibold">
            Title
          </label>
          <input
            id="title"
            value={post.title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="Untitled"
            className="display rounded-xl border-2 border-ink bg-parchment px-4 py-3 text-3xl"
          />
        </div>

        <TagInput value={post.tags} onChange={onTagsChange} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cover" className="text-sm font-semibold">
            Cover image
          </label>
          <input
            id="cover"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onCoverChange(file)
            }}
            className="text-sm"
          />
          {post.coverImageUrl ? (
            <img
              src={post.coverImageUrl}
              alt="Cover"
              className="mt-2 h-32 w-full rounded-xl border-2 border-ink object-cover"
            />
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t-2 border-ink pt-4">
          <SaveState status={saveStatus} onRetry={onRetry} />

          <div className="ml-auto flex flex-wrap items-center gap-3">
            {post.status === 'published' ? (
              <>
                <Button as={Link} to={`/blog/${post.slug}`} variant="ghost" size="sm">
                  View live
                </Button>
                <Button variant="ghost" size="sm" onClick={onUnpublish} disabled={busy}>
                  Unpublish
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={onPublish} disabled={busy}>
                Publish
              </Button>
            )}

            {confirming ? (
              <>
                <Button variant="danger" size="sm" onClick={onDelete} disabled={busy}>
                  Delete permanently
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                  Keep it
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
