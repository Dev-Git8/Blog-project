import { Router } from 'express'
import { Post } from '../models/Post.js'
import { AUTHOR_FIELDS } from '../lib/serializePost.js'

// Every value interpolated below came from a user, so escaping is mandatory.
const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

export const metaRouter = Router()

metaRouter.get('/post/:slug', async (req, res, next) => {
  try {
    const clientOrigin = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173')
      .split(',')[0]
      .trim()

    const post = await Post.findOne({
      slug: req.params.slug,
      status: 'published',
    }).populate('author', AUTHOR_FIELDS)

    if (!post) {
      return res
        .status(404)
        .type('html')
        .send('<!doctype html><meta charset="utf-8"><title>Not found</title><p>No such post.</p>')
    }

    const canonical = escapeHtml(`${clientOrigin}/blog/${post.slug}`)
    const title = escapeHtml(post.title || 'Untitled')
    const description = escapeHtml(
      post.excerpt || `A post by ${post.author?.displayName ?? 'a writer'}`,
    )
    const author = escapeHtml(post.author?.displayName ?? post.author?.username ?? '')
    const image = post.coverImageUrl ? escapeHtml(post.coverImageUrl) : ''

    res.type('html').send(
      [
        '<!doctype html>',
        '<meta charset="utf-8">',
        `<title>${title}</title>`,
        `<link rel="canonical" href="${canonical}">`,
        `<meta name="description" content="${description}">`,
        `<meta name="author" content="${author}">`,
        '<meta property="og:type" content="article">',
        `<meta property="og:title" content="${title}">`,
        `<meta property="og:description" content="${description}">`,
        `<meta property="og:url" content="${canonical}">`,
        image ? `<meta property="og:image" content="${image}">` : '',
        `<meta property="article:published_time" content="${post.publishedAt?.toISOString() ?? ''}">`,
        `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`,
        `<meta name="twitter:title" content="${title}">`,
        `<meta name="twitter:description" content="${description}">`,
        image ? `<meta name="twitter:image" content="${image}">` : '',
        `<p>${title} — by ${author}. <a href="${canonical}">Read it</a>.</p>`,
      ]
        .filter(Boolean)
        .join('\n'),
    )
  } catch (err) {
    next(err)
  }
})
