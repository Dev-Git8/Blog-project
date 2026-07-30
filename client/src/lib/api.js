const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

export class ApiError extends Error {
  constructor({ status, code, message, fields }) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields ?? {}
  }
}

async function request(path, { method = 'GET', body, isForm = false } = {}) {
  let response
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      // Sessions live in an httpOnly cookie, so every request must opt in.
      credentials: 'include',
      ...(isForm
        ? { body }
        : body !== undefined
          ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
          : {}),
    })
  } catch {
    throw new ApiError({
      status: 0,
      code: 'NETWORK',
      message: 'Cannot reach the server. Check your connection and try again.',
    })
  }

  if (response.status === 204) return null

  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      code: payload?.error?.code ?? 'UNEXPECTED',
      message: payload?.error?.message ?? 'Something went wrong. Please try again.',
      fields: payload?.error?.fields,
    })
  }

  return payload
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: (path) => request(path, { method: 'DELETE' }),
}

export function uploadImage(file) {
  const form = new FormData()
  form.append('file', file)
  // No Content-Type header — the browser must set the multipart boundary itself.
  return request('/api/uploads/image', { method: 'POST', body: form, isForm: true })
}
