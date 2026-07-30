import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api.js'
import { useToast } from '../../components/ui/Toast.jsx'
import { Button } from '../../components/ui/Button.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { Badge } from '../../components/ui/Badge.jsx'
import { Spinner } from '../../components/ui/Spinner.jsx'
import { formatDate } from '../../lib/formatDate.js'

function Row({ post, onUnpublish, onBan }) {
  const [confirming, setConfirming] = useState(false)

  return (
    <Card as="li" className="flex flex-wrap items-center gap-4 p-4">
      <div className="min-w-56 flex-1">
        <p className="display text-lg leading-tight">{post.title || 'Untitled'}</p>
        <p className="mt-1 text-xs">
          {post.author ? (
            <Link to={`/@${post.author.username}`} className="font-semibold hover:underline">
              {post.author.displayName || post.author.username}
            </Link>
          ) : (
            'unknown author'
          )}
          {' · '}
          {formatDate(post.updatedAt)}
        </p>
      </div>

      <Badge tone={post.status === 'published' ? 'mustard' : 'ink'}>
        {post.status === 'published' ? 'Live' : 'Draft'}
      </Badge>

      <div className="flex flex-wrap gap-2">
        <Button as={Link} to={`/blog/${post.slug}`} size="sm" variant="ghost">
          Open
        </Button>

        {post.status === 'published' ? (
          <Button size="sm" variant="ghost" onClick={() => onUnpublish(post.id)}>
            Unpublish
          </Button>
        ) : null}

        {confirming ? (
          <>
            <Button size="sm" variant="danger" onClick={() => onBan(post.author?.id)}>
              Confirm ban
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
            Ban author
          </Button>
        )}
      </div>
    </Card>
  )
}

export function AdminPanel() {
  const { show } = useToast()
  const [posts, setPosts] = useState([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const query = status ? `?status=${status}` : ''
      const data = await api.get(`/api/admin/posts${query}`)
      setPosts(data.posts)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  async function onUnpublish(id) {
    try {
      const { post: updated } = await api.post(`/api/posts/${id}/unpublish`)
      setPosts((current) => current.map((post) => (post.id === id ? { ...post, ...updated } : post)))
      show('Taken down. The post is a draft again, not deleted.')
    } catch (err) {
      show(err.message, 'error')
    }
  }

  async function onBan(userId) {
    if (!userId) return
    try {
      await api.post(`/api/admin/users/${userId}/ban`)
      show('That account can no longer publish.')
    } catch (err) {
      show(err.message, 'error')
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <h1 className="display text-5xl">Moderation</h1>
      <p className="mt-2 text-sm">
        Unpublishing hides a post without destroying it. Banning stops an account publishing but
        leaves their existing posts alone.
      </p>

      <div className="mt-6 flex items-center gap-3">
        <label htmlFor="status" className="text-sm font-semibold">
          Status
        </label>
        <select
          id="status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-xl border-2 border-ink bg-card px-3 py-2 text-sm"
        >
          <option value="">All</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      {loading ? (
        <div className="mt-10 flex justify-center">
          <Spinner label="Loading posts" />
        </div>
      ) : error ? (
        <p role="alert" className="mt-8 rounded-xl border-2 border-brick p-4 font-medium text-brick">
          {error}
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {posts.map((post) => (
            <Row key={post.id} post={post} onUnpublish={onUnpublish} onBan={onBan} />
          ))}
        </ul>
      )}
    </div>
  )
}
