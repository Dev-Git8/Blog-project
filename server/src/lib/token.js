import jwt from 'jsonwebtoken'

const COOKIE_NAME = 'token'
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const isProd = () => process.env.NODE_ENV === 'production'

export function signToken(user) {
  return jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  })
}

export function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    // The client and API sit on different domains in production, so the cookie
    // must be SameSite=None — which browsers only accept alongside Secure.
    secure: isProd(),
    sameSite: isProd() ? 'none' : 'lax',
    maxAge: THIRTY_DAYS_MS,
    path: '/',
  })
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProd(),
    sameSite: isProd() ? 'none' : 'lax',
    path: '/',
  })
}

export function readToken(req) {
  const raw = req.cookies?.[COOKIE_NAME]
  if (!raw) return null
  try {
    return jwt.verify(raw, process.env.JWT_SECRET)
  } catch {
    return null
  }
}
