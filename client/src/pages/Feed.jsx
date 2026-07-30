import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { PostCard } from '../components/PostCard.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Spinner } from '../components/ui/Spinner.jsx'

// Shared by /blog, /tag/:tag and the author profile — one list, three filters.
export function Feed({ tag, author, heading = 'Everything', intro }) {
  const [posts, setPosts] = useState([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(
    async (which) => {
      const params = new URLSearchParams({ page: String(which), limit: '9' })
      if (tag) params.set('tag', tag)
      if (author) params.set('author', author)

      try {
        const data = await api.get(`/api/posts?${params}`)
        setPosts((current) => (which === 1 ? data.posts : [...current, ...data.posts]))
        setPages(data.pages)
        setPage(data.page)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    },
    [tag, author],
  )

  useEffect(() => {
    setLoading(true)
    setError('')
    load(1)
  }, [load])

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="display text-5xl sm:text-6xl">{heading}</h1>
      {intro ? <p className="mt-3 max-w-prose">{intro}</p> : null}

      {loading ? (
        <div className="mt-12 flex justify-center">
          <Spinner label="Loading posts" />
        </div>
      ) : error ? (
        <p role="alert" className="mt-8 rounded-xl border-2 border-brick p-4 font-medium text-brick">
          {error}
        </p>
      ) : posts.length === 0 ? (
        <p className="mt-10 text-lg">No posts yet. Someone has to go first.</p>
      ) : (
        <>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>

          {page < pages ? (
            <div className="mt-10 flex justify-center">
              <Button variant="ink" onClick={() => load(page + 1)}>
                Load more
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
