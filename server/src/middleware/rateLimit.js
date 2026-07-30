import rateLimit from 'express-rate-limit'
import { tooMany } from '../lib/httpError.js'

// Limits are disabled under test so suites do not trip over each other.
const disabled = process.env.NODE_ENV === 'test'

const make = ({ windowMs, limit, message, byUser = false }) =>
  disabled
    ? (_req, _res, next) => next()
    : rateLimit({
        windowMs,
        limit,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        keyGenerator: byUser
          ? (req) => String(req.user?._id ?? req.ip)
          : undefined,
        handler: (_req, _res, next) => next(tooMany(message)),
      })

export const signupLimiter = make({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: 'Too many accounts created from this network. Try again in an hour.',
})

export const loginLimiter = make({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: 'Too many sign-in attempts. Try again in 15 minutes.',
})

export const createPostLimiter = make({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  byUser: true,
  message: 'You have created a lot of posts recently. Try again in an hour.',
})

export const uploadLimiter = make({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  byUser: true,
  message: 'Upload limit reached. Try again in an hour.',
})
