import { Link } from 'react-router-dom'
import { Card } from './ui/Card.jsx'
import { Badge } from './ui/Badge.jsx'
import { formatDate } from '../lib/formatDate.js'

export function PostCard({ post }) {
  return (
    <Card as="article" className="flex flex-col overflow-hidden">
      {post.coverImageUrl ? (
        <img
          src={post.coverImageUrl}
          alt=""
          className="h-44 w-full border-b-2 border-ink object-cover"
          loading="lazy"
        />
      ) : null}

      <div className="flex flex-1 flex-col gap-3 p-5">
        <h2 className="display text-2xl leading-tight">
          <Link
            to={`/blog/${post.slug}`}
            className="hover:underline decoration-mustard decoration-4"
          >
            {post.title || 'Untitled'}
          </Link>
        </h2>

        {post.excerpt ? <p className="text-sm leading-relaxed">{post.excerpt}</p> : null}

        <div className="mt-auto flex flex-wrap items-center gap-2 text-xs">
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
      </div>
    </Card>
  )
}
