import { Router } from 'express'
import multer from 'multer'
import { fileTypeFromBuffer } from 'file-type'
import { requireAuth, requireNotBanned } from '../middleware/requireAuth.js'
import { uploadLimiter } from '../middleware/rateLimit.js'
import { uploadBuffer } from '../lib/cloudinary.js'
import { validationError } from '../lib/httpError.js'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'])

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
})

export const uploadsRouter = Router()

uploadsRouter.post(
  '/image',
  requireAuth,
  requireNotBanned,
  uploadLimiter,
  // multer errors are translated here so they come out in the standard shape
  // rather than as Express's default HTML error page.
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err?.code === 'LIMIT_FILE_SIZE') {
        return next(validationError('Images must be 5 MB or smaller', { file: 'Too large' }))
      }
      if (err) return next(validationError('That upload could not be read', { file: 'Unreadable' }))
      next()
    })
  },
  async (req, res, next) => {
    try {
      if (!req.file?.buffer?.length) {
        throw validationError('Choose an image to upload', { file: 'Required' })
      }
      if (!ALLOWED.has(req.file.mimetype)) {
        throw validationError('Only PNG, JPEG, WebP, GIF and AVIF images are allowed', {
          file: 'Unsupported type',
        })
      }

      // The declared Content-Type is caller-controlled, so trust the bytes
      // instead: a PHP payload renamed to .png is caught here, not above.
      const sniffed = await fileTypeFromBuffer(req.file.buffer)
      if (!sniffed || !ALLOWED.has(sniffed.mime)) {
        throw validationError('That file is not a valid image', { file: 'Not an image' })
      }

      const result = await uploadBuffer(req.file.buffer, `blog/${req.user.username}`)
      res.status(201).json(result)
    } catch (err) {
      next(err)
    }
  },
)
