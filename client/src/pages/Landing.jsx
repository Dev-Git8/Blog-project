import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { useAuth } from '../lib/useAuth.jsx'
import { PostCard } from '../components/PostCard.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Card } from '../components/ui/Card.jsx'
import { RotatingBadge } from '../components/ui/RotatingBadge.jsx'

export function Landing() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [posts, setPosts] = useState([])

  useEffect(() => {
    api
      .get('/api/posts?limit=3')
      .then(({ posts: latest }) => setPosts(latest))
      .catch(() => setPosts([]))
  }, [])

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      {/* Collage hero: overlapping cards rather than a tidy grid, per the reference. */}
      <section className="grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <h1 className="display text-6xl sm:text-7xl lg:text-8xl">
            Write Something
            <br />
            Worth Reading.
          </h1>
          <p className="mt-6 max-w-md text-lg">
            A blog anyone can publish to. Bring words, images, video and the links that back them
            up.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button as={Link} to={user ? '/dashboard/new' : '/signup'} size="lg">
              {user ? 'Start a new post' : 'Start writing'}
            </Button>
            <Button as={Link} to="/blog" variant="ghost" size="lg">
              Read the blog
            </Button>
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <RotatingBadge
            text="Write · Publish · Edit"
            label={user ? 'New post' : 'Join in'}
            onClick={() => navigate(user ? '/dashboard/new' : '/signup')}
          />
        </div>
      </section>

      <section className="mt-20">
        <div className="flex flex-wrap items-end gap-4">
          <h2 className="display text-4xl">Fresh off the press</h2>
          <Link
            to="/blog"
            className="ml-auto font-semibold underline decoration-mustard decoration-2"
          >
            See everything
          </Link>
        </div>

        {posts.length ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <Card className="mt-8 p-8 text-center">
            <p className="display text-2xl">Nothing published yet</p>
            <p className="mt-2 text-sm">Be the first person to write here.</p>
            <Button as={Link} to="/signup" className="mt-5">
              Create an account
            </Button>
          </Card>
        )}
      </section>
    </div>
  )
}
