import { HttpError } from '../lib/httpError.js'

export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.fields ? { fields: err.fields } : {}),
      },
    })
  }

  if (err?.type === 'entity.too.large') {
    return res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'That request was too large' },
    })
  }

  console.error('[unhandled]', err)
  return res.status(500).json({
    error: { code: 'INTERNAL', message: 'Something went wrong on our end' },
  })
}
