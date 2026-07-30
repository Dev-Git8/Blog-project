export class HttpError extends Error {
  constructor(status, code, message, fields) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
    if (fields) this.fields = fields
  }
}

export const badRequest = (message = 'Malformed request') =>
  new HttpError(400, 'BAD_REQUEST', message)

export const unauthorized = (message = 'You need to sign in to do that') =>
  new HttpError(401, 'UNAUTHORIZED', message)

export const forbidden = (message = 'That is not yours to change') =>
  new HttpError(403, 'FORBIDDEN', message)

export const notFound = (message = 'Not found') =>
  new HttpError(404, 'NOT_FOUND', message)

export const conflict = (message, fields) =>
  new HttpError(409, 'CONFLICT', message, fields)

export const validationError = (message, fields) =>
  new HttpError(422, 'VALIDATION', message, fields)

export const tooMany = (message = 'Too many attempts. Please wait and try again.') =>
  new HttpError(429, 'RATE_LIMITED', message)
