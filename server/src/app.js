import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import { errorHandler } from './middleware/errorHandler.js'
import { notFound } from './lib/httpError.js'

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

  app.use('/api', (_req, _res, next) => next(notFound('Route not found')))
  app.use(errorHandler)

  return app
}
