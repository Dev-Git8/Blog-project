export const AUTHOR_FIELDS = 'username displayName avatarUrl'

export function serializePost(post, { full = false } = {}) {
  const populated = post.author && typeof post.author === 'object' && post.author.username

  return {
    id: String(post._id),
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    coverImageUrl: post.coverImageUrl ?? null,
    tags: post.tags ?? [],
    status: post.status,
    publishedAt: post.publishedAt,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    author: populated
      ? {
          id: String(post.author._id),
          username: post.author.username,
          displayName: post.author.displayName,
          avatarUrl: post.author.avatarUrl ?? null,
        }
      : null,
    // Bodies can be large; lists never carry them.
    ...(full ? { content: post.content ?? { blocks: [] } } : {}),
  }
}
