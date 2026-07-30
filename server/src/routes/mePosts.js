import { Router } from 'express'
import { Post } from '../models/Post.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { validate } from '../middleware/validate.js'
import { sanitizeUser } from '../lib/sanitizeUser.js'
import { updateMeSchema } from '../schemas/users.js'
import { serializePost, AUTHOR_FIELDS } from '../lib/serializePost.js'

export const mePostsRouter = Router()

mePostsRouter.get('/posts', requireAuth, async (req, res, next) => {
  try {
    const posts = await Post.find({ author: req.user._id })
      .sort({ updatedAt: -1 })
      .populate('author', AUTHOR_FIELDS)
    res.json({ posts: posts.map((post) => serializePost(post)) })
  } catch (err) {
    next(err)
  }
})

mePostsRouter.patch('/', requireAuth, validate(updateMeSchema), async (req, res, next) => {
  try {
    Object.assign(req.user, req.body)
    await req.user.save()
    res.json({ user: sanitizeUser(req.user) })
  } catch (err) {
    next(err)
  }
})
