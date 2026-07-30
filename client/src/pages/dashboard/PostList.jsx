import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api.js'
import { useToast } from '../../components/ui/Toast.jsx'
import { Button } from '../../components/ui/Button.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { Badge } from '../../components/ui/Badge.jsx'
import { Spinner } from '../../components/ui/Spinner.jsx'
import { formatDate } from '../../lib/formatDate.js'

function Row({ post, onDelete }) {
  const [confirming, setConfirming] = useState(false)

  return (
    <Card as="li" className="flex flex-wrap items-center gap-4 p-4">
      <div className="min-w-48 flex-1">
        <p className="display text-xl leading-tight">{post.title || 'Untitled'}</p>
        <p className="mt-1 text-xs">
          {post.status === 'published'
            ? `Published ${formatDate(post.publishedAt)}`
            : `Edited ${formatDate(post.updatedAt)}`}
        </p>
      </div>

      <Badge tone={post.status === 'published' ? 'mustard' : 'ink'}>
        {post.status === 'published' ? 'Live' : 'Draft'}
      </Badge>

      <div className="flex flex-wrap gap-2">
        <Button as={Link} to={`/dashboard/posts/${post.id}`} size="sm" variant="ghost">
          Edit
        </Button>
        {post.status === 'published' ? (
          <Button as={Link} to={`/blog/${post.slug}`} size="sm" variant="ghost">
            View
          </Button>
        ) : null}

        {confirming ? (
          <>
            <Button variant="danger" size="sm" onClick={() => onDelete(post.id)}>
              Delete permanently
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Delete ${post.title || 'Untitled'}`}
            onClick={() => setConfirming(true)}
          >
            Delete
          </Button>
        )}
      </div>
    </Card>
  )
}

export function PostList() {
  const { show } = useToast()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    api
      .get('/api/me/posts')
      .then(({ posts: mine }) => {
        if (!cancelled) setPosts(mine)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function onDelete(id) {
    try {
      await api.del(`/api/posts/${id}`)
      setPosts((current) => current.filter((post) => post.id !== id))
      show('Post deleted.')
    } catch (err) {
      show(err.message, 'error')
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="display text-5xl">Your posts</h1>
        <div className="ml-auto flex gap-3">
          <Button as={Link} to="/dashboard/settings" variant="ghost" size="sm">
            Profile
          </Button>
          <Button as={Link} to="/dashboard/new" size="sm">
            New post
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="mt-10 flex justify-center">
          <Spinner label="Loading your posts" />
        </div>
      ) : error ? (
        <p role="alert" className="mt-8 rounded-xl border-2 border-brick p-4 font-medium text-brick">
          {error}
        </p>
      ) : posts.length === 0 ? (
        <Card className="mt-8 p-8 text-center">
          <p className="display text-2xl">Nothing here yet</p>
          <p className="mt-2 text-sm">Your drafts and published posts will show up here.</p>
          <Button as={Link} to="/dashboard/new" className="mt-5">
            Write your first post
          </Button>
        </Card>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {posts.map((post) => (
            <Row key={post.id} post={post} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </div>
  )
}
