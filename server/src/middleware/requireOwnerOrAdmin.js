import mongoose from 'mongoose'
import { Post } from '../models/Post.js'
import { notFound, forbidden } from '../lib/httpError.js'

// A malformed id 404s rather than 400s: whether a string is a valid ObjectId is
// not information worth distinguishing to a caller.
export async function loadPostForWrite(req, _res, next) {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) return next(notFound('Post not found'))

    const post = await Post.findById(id)
    if (!post) return next(notFound('Post not found'))

    const isOwner = String(post.author) === String(req.user._id)
    if (!isOwner && req.user.role !== 'admin') {
      return next(forbidden('That post belongs to someone else'))
    }

    req.post = post
    next()
  } catch (err) {
    next(err)
  }
}
