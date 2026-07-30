import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import { errorHandler } from './middleware/errorHandler.js'
import { notFound } from './lib/httpError.js'
import { authRouter } from './routes/auth.js'
import { postsRouter } from './routes/posts.js'
import { mePostsRouter } from './routes/mePosts.js'
import { usersRouter } from './routes/users.js'
import { uploadsRouter } from './routes/uploads.js'
import { adminRouter } from './routes/admin.js'
import { metaRouter } from './routes/meta.js'

export function createApp() {
  const app = express()
  app.set('trust proxy', 1)

  const origins = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)

  app.use(cors({ origin: origins, credentials: true }))
  app.use(express.json({ limit: '2mb' }))
  app.use(cookieParser())

  app.get('/api/health', (_req, res) => res.json({ ok: true }))

  // ROUTE MOUNT POINT — later tasks add `app.use('/api/...', router)` here,
  // above the catch-all. Anything mounted below it is unreachable.
  app.use('/api/auth', authRouter)
  app.use('/api/posts', postsRouter)
  app.use('/api/me', mePostsRouter)
  app.use('/api/users', usersRouter)
  app.use('/api/uploads', uploadsRouter)
  app.use('/api/admin', adminRouter)
  app.use('/api/meta', metaRouter)

  app.use('/api', (_req, _res, next) => next(notFound('Route not found')))
  app.use(errorHandler)

  return app
}
