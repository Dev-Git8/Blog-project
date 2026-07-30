import { Router } from 'express'
import { User } from '../models/User.js'
import { sanitizeUser } from '../lib/sanitizeUser.js'
import { validate } from '../middleware/validate.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { signupLimiter, loginLimiter } from '../middleware/rateLimit.js'
import { signupSchema, loginSchema } from '../schemas/auth.js'
import { signToken, setAuthCookie, clearAuthCookie } from '../lib/token.js'
import { conflict, unauthorized } from '../lib/httpError.js'

export const authRouter = Router()

authRouter.post(
  '/signup',
  signupLimiter,
  validate(signupSchema),
  async (req, res, next) => {
    try {
      const { username, email, password, displayName } = req.body

      const [emailTaken, usernameTaken] = await Promise.all([
        User.exists({ email }),
        User.exists({ username }),
      ])
      if (emailTaken) {
        throw conflict('That email is already registered', {
          email: 'Already registered',
        })
      }
      if (usernameTaken) {
        throw conflict('That username is taken', { username: 'Already taken' })
      }

      const user = await User.create({
        username,
        email,
        passwordHash: await User.hashPassword(password),
        displayName: displayName || username,
      })

      setAuthCookie(res, signToken(user))
      res.status(201).json({ user: sanitizeUser(user) })
    } catch (err) {
      // A racing duplicate slips past the checks above and surfaces here.
      if (err?.code === 11000) {
        const field = Object.keys(err.keyPattern ?? {})[0] ?? 'email'
        return next(conflict('That is already taken', { [field]: 'Already taken' }))
      }
      next(err)
    }
  },
)

authRouter.post('/login', loginLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email })
    const ok = user ? await user.comparePassword(password) : false
    // Identical response for "no such user" and "wrong password" so the
    // endpoint cannot be used to discover which emails have accounts.
    if (!ok) throw unauthorized('Email or password is incorrect')

    setAuthCookie(res, signToken(user))
    res.json({ user: sanitizeUser(user) })
  } catch (err) {
    next(err)
  }
})

authRouter.post('/logout', (_req, res) => {
  clearAuthCookie(res)
  res.json({ ok: true })
})

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: sanitizeUser(req.user) })
})
