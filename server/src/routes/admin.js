import { Router } from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'
import { Post } from '../models/Post.js'
import { User } from '../models/User.js'
import { validate } from '../middleware/validate.js'
import { requireAuth, requireAdmin } from '../middleware/requireAuth.js'
import { sanitizeUser } from '../lib/sanitizeUser.js'
import { serializePost, AUTHOR_FIELDS } from '../lib/serializePost.js'
import { notFound, forbidden } from '../lib/httpError.js'

const adminListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(['draft', 'published']).optional(),
})

export const adminRouter = Router()

// Applies to every route in this file — there is no unguarded admin endpoint.
adminRouter.use(requireAuth, requireAdmin)

adminRouter.get('/posts', validate(adminListSchema, 'query'), async (req, res, next) => {
  try {
    const { page, limit, status } = req.query
    const filter = status ? { status } : {}

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .sort({ updatedAt: -1 })
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

const setBanned = (isBanned) => async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) throw notFound('No such user')

    const user = await User.findById(id)
    if (!user) throw notFound('No such user')
    // Admins are not bannable, otherwise the owner can be locked out of the site.
    if (user.role === 'admin') throw forbidden('Admins cannot be banned')

    user.isBanned = isBanned
    await user.save()
    res.json({ user: sanitizeUser(user) })
  } catch (err) {
    next(err)
  }
}

adminRouter.post('/users/:id/ban', setBanned(true))
adminRouter.post('/users/:id/unban', setBanned(false))
