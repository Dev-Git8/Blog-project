import { Router } from 'express'
import { Post } from '../models/Post.js'
import { User } from '../models/User.js'
import { validate } from '../middleware/validate.js'
import { requireAuth, requireNotBanned, attachUser } from '../middleware/requireAuth.js'
import { loadPostForWrite } from '../middleware/requireOwnerOrAdmin.js'
import { createPostLimiter } from '../middleware/rateLimit.js'
import { createPostSchema, updatePostSchema, listQuerySchema } from '../schemas/posts.js'
import { serializePost, AUTHOR_FIELDS } from '../lib/serializePost.js'
import { uniqueSlug } from '../lib/slug.js'
import { deriveExcerpt, countTextLength } from '../lib/excerpt.js'
import { assertValidContent } from '../lib/contentGuard.js'
import { notFound, validationError } from '../lib/httpError.js'

export const postsRouter = Router()

postsRouter.get('/', validate(listQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { page, limit, tag, author } = req.query
    const filter = { status: 'published' }
    if (tag) filter.tags = tag

    if (author) {
      const found = await User.findOne({ username: author }).select('_id')
      if (!found) return res.json({ posts: [], page, pages: 0, total: 0 })
      filter.author = found._id
    }

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .sort({ publishedAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('author', AUTHOR_FIELDS),
      Post.countDocuments(filter),
    ])

    res.json({
      posts: posts.map((post) => serializePost(post)),
      page,
      pages: Math.ceil(total / limit),
      total,
    })
  } catch (err) {
    next(err)
  }
})

// Declared before /:slug so it is reachable — the editor loads drafts by id.
postsRouter.get('/by-id/:id', requireAuth, loadPostForWrite, async (req, res, next) => {
  try {
    await req.post.populate('author', AUTHOR_FIELDS)
    res.json({ post: serializePost(req.post, { full: true }) })
  } catch (err) {
    next(err)
  }
})

postsRouter.get('/:slug', attachUser, async (req, res, next) => {
  try {
    const post = await Post.findOne({ slug: req.params.slug }).populate('author', AUTHOR_FIELDS)
    if (!post) throw notFound('Post not found')

    if (post.status !== 'published') {
      const isOwner = req.user && String(post.author?._id) === String(req.user._id)
      const isAdmin = req.user?.role === 'admin'
      // A hidden draft is indistinguishable from a post that never existed.
      if (!isOwner && !isAdmin) throw notFound('Post not found')
    }

    res.json({ post: serializePost(post, { full: true }) })
  } catch (err) {
    next(err)
  }
})

postsRouter.post(
  '/',
  requireAuth,
  requireNotBanned,
  createPostLimiter,
  validate(createPostSchema),
  async (req, res, next) => {
    try {
      const title = req.body.title ?? ''
      const post = await Post.create({
        author: req.user._id,
        title,
        slug: await uniqueSlug(title, Post),
        content: { blocks: [] },
      })
      await post.populate('author', AUTHOR_FIELDS)
      res.status(201).json({ post: serializePost(post, { full: true }) })
    } catch (err) {
      next(err)
    }
  },
)

postsRouter.patch(
  '/:id',
  requireAuth,
  requireNotBanned,
  loadPostForWrite,
  validate(updatePostSchema),
  async (req, res, next) => {
    try {
      const { post } = req
      const { title, excerpt, coverImageUrl, content, tags } = req.body

      // The slug is deliberately never recomputed — published links are permanent.
      if (title !== undefined) post.title = title
      if (coverImageUrl !== undefined) post.coverImageUrl = coverImageUrl
      if (tags !== undefined) post.tags = tags

      if (excerpt !== undefined) {
        post.excerpt = excerpt
        post.excerptManual = excerpt.trim().length > 0
      }

      if (content !== undefined) {
        assertValidContent(content)
        post.content = content
        // Mixed paths need an explicit dirty flag or mongoose skips the write.
        post.markModified('content')
        if (!post.excerptManual) post.excerpt = deriveExcerpt(content)
      }

      await post.save()
      await post.populate('author', AUTHOR_FIELDS)
      res.json({ post: serializePost(post, { full: true }) })
    } catch (err) {
      next(err)
    }
  },
)

postsRouter.post(
  '/:id/publish',
  requireAuth,
  requireNotBanned,
  loadPostForWrite,
  async (req, res, next) => {
    try {
      const { post } = req
      const fields = {}
      if (!post.title?.trim()) fields.title = 'Give your post a title before publishing'
      if (countTextLength(post.content) === 0) fields.content = 'Write something before publishing'
      if (Object.keys(fields).length) {
        throw validationError('This post is not ready to publish', fields)
      }

      post.status = 'published'
      post.publishedAt = post.publishedAt ?? new Date()
      await post.save()
      await post.populate('author', AUTHOR_FIELDS)
      res.json({ post: serializePost(post, { full: true }) })
    } catch (err) {
      next(err)
    }
  },
)

// unpublish and delete deliberately omit requireNotBanned: a banned user must
// still be able to take their own content down.
postsRouter.post('/:id/unpublish', requireAuth, loadPostForWrite, async (req, res, next) => {
  try {
    req.post.status = 'draft'
    await req.post.save()
    await req.post.populate('author', AUTHOR_FIELDS)
    res.json({ post: serializePost(req.post, { full: true }) })
  } catch (err) {
    next(err)
  }
})

postsRouter.delete('/:id', requireAuth, loadPostForWrite, async (req, res, next) => {
  try {
    await req.post.deleteOne()
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})
