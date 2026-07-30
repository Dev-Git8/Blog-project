import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api.js'
import { BlockRenderer } from '../components/BlockRenderer.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Spinner } from '../components/ui/Spinner.jsx'
import { formatDate } from '../lib/formatDate.js'

export function Post() {
  const { slug } = useParams()
  const [post, setPost] = useState(null)
  const [state, setState] = useState('loading')

  useEffect(() => {
    let cancelled = false
    setState('loading')

    api
      .get(`/api/posts/${slug}`)
      .then(({ post: loaded }) => {
        if (cancelled) return
        setPost(loaded)
        setState('ready')
        document.title = `${loaded.title || 'Untitled'} — Parchment`
      })
      .catch(() => {
        if (!cancelled) setState('missing')
      })

    return () => {
      cancelled = true
    }
  }, [slug])

  if (state === 'loading') {
    return (
      <div className="flex justify-center p-16">
        <Spinner label="Loading the post" />
      </div>
    )
  }

  if (state === 'missing') {
    return (
      <div className="mx-auto max-w-xl px-5 py-20 text-center">
        <h1 className="display text-5xl">That post is not here</h1>
        <p className="mt-3">It may have been deleted, or the link might be wrong.</p>
        <Link
          to="/blog"
          className="mt-5 inline-block font-semibold underline decoration-mustard decoration-2"
        >
          Browse everything else
        </Link>
      </div>
    )
  }

  return (
    <article className="mx-auto max-w-3xl px-5 py-12">
      {post.status === 'draft' ? (
        <p className="mb-6 rounded-xl border-2 border-ink bg-mustard px-4 py-2 text-sm font-semibold">
          Draft — only you can see this
        </p>
      ) : null}

      <h1 className="display text-5xl sm:text-6xl">{post.title || 'Untitled'}</h1>

      <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
        {post.author?.avatarUrl ? (
          <img
            src={post.author.avatarUrl}
            alt=""
            className="size-9 rounded-full border-2 border-ink object-cover"
          />
        ) : null}
        {post.author ? (
          <Link to={`/@${post.author.username}`} className="font-semibold hover:underline">
            {post.author.displayName || post.author.username}
          </Link>
        ) : null}
        {post.publishedAt ? <span>· {formatDate(post.publishedAt)}</span> : null}
        {post.tags?.map((tag) => (
          <Link key={tag} to={`/tag/${tag}`}>
            <Badge>{tag}</Badge>
          </Link>
        ))}
      </div>

      {post.coverImageUrl ? (
        <img
          src={post.coverImageUrl}
          alt=""
          className="mt-8 w-full rounded-2xl border-2 border-ink object-cover"
        />
      ) : null}

      {/* The reading column drops the outlines on purpose — see styles/index.css. */}
      <div className="prose-reading mx-auto mt-10">
        <BlockRenderer content={post.content} />
      </div>
    </article>
  )
}
