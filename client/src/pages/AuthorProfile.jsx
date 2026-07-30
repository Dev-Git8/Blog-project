import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api.js'
import { PostCard } from '../components/PostCard.jsx'
import { Card } from '../components/ui/Card.jsx'
import { Spinner } from '../components/ui/Spinner.jsx'

export function AuthorProfile() {
  const { username } = useParams()
  const [data, setData] = useState(null)
  const [state, setState] = useState('loading')

  useEffect(() => {
    let cancelled = false

    api
      .get(`/api/users/${username}`)
      .then((payload) => {
        if (cancelled) return
        setData(payload)
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('missing')
      })

    return () => {
      cancelled = true
    }
  }, [username])

  if (state === 'loading') {
    return (
      <div className="flex justify-center p-16">
        <Spinner label="Loading profile" />
      </div>
    )
  }

  if (state === 'missing') {
    return (
      <div className="mx-auto max-w-xl px-5 py-20 text-center">
        <h1 className="display text-5xl">No writer here</h1>
        <p className="mt-3">Nobody is using that username.</p>
      </div>
    )
  }

  const { user, posts } = data

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <Card className="flex flex-wrap items-center gap-5 p-6">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt=""
            className="size-20 rounded-full border-2 border-ink object-cover"
          />
        ) : null}
        <div>
          <h1 className="display text-4xl">{user.displayName || user.username}</h1>
          <p className="text-sm font-semibold">@{user.username}</p>
          {user.bio ? <p className="mt-2 max-w-prose text-sm">{user.bio}</p> : null}
        </div>
      </Card>

      <h2 className="display mt-12 text-3xl">
        {posts.length} {posts.length === 1 ? 'post' : 'posts'}
      </h2>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  )
}
