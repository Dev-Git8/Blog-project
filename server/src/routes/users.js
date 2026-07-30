import { Router } from 'express'
import { User } from '../models/User.js'
import { Post } from '../models/Post.js'
import { validate } from '../middleware/validate.js'
import { sanitizeUser } from '../lib/sanitizeUser.js'
import { serializePost, AUTHOR_FIELDS } from '../lib/serializePost.js'
import { usernameParamSchema } from '../schemas/users.js'
import { notFound } from '../lib/httpError.js'

export const usersRouter = Router()

usersRouter.get('/:username', validate(usernameParamSchema, 'params'), async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.params.username })
    if (!user) throw notFound('No such writer')

    const posts = await Post.find({ author: user._id, status: 'published' })
      .sort({ publishedAt: -1 })
      .populate('author', AUTHOR_FIELDS)

    res.json({
      user: sanitizeUser(user),
      posts: posts.map((post) => serializePost(post)),
    })
  } catch (err) {
    next(err)
  }
})
