import { User } from '../models/User.js'
import { readToken } from '../lib/token.js'
import { HttpError, unauthorized, forbidden } from '../lib/httpError.js'

export async function requireAuth(req, _res, next) {
  try {
    const payload = readToken(req)
    if (!payload?.sub) return next(unauthorized())
    const user = await User.findById(payload.sub)
    if (!user) return next(unauthorized())
    req.user = user
    next()
  } catch (err) {
    next(err)
  }
}

// Optional variant: attaches req.user when a valid cookie is present, but never
// rejects. Used by read routes that show extra data to owners and admins.
export async function attachUser(req, _res, next) {
  try {
    const payload = readToken(req)
    if (payload?.sub) req.user = (await User.findById(payload.sub)) ?? undefined
    next()
  } catch (err) {
    next(err)
  }
}

export function requireNotBanned(req, _res, next) {
  if (req.user?.isBanned) {
    return next(
      new HttpError(403, 'BANNED', 'Your account can no longer publish or edit posts'),
    )
  }
  next()
}

export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') return next(forbidden('Admins only'))
  next()
}
