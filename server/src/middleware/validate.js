import { validationError } from '../lib/httpError.js'

export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source])
  if (!result.success) {
    const fields = {}
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_'
      if (!fields[key]) fields[key] = issue.message
    }
    return next(validationError('Please check the highlighted fields', fields))
  }
  req[source] = result.data
  next()
}
