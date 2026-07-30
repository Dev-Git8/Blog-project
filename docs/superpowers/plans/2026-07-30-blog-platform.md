# Blog Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public multi-user blog where anyone can read every post and signed-in users create, edit, and delete their own posts — with rich block-based content including uploaded images, embedded videos, and reference links — from a personal dashboard.

**Architecture:** Two npm workspaces in one repo. `server/` is an Express + Mongoose REST API over MongoDB Atlas, holding all authentication and authorization; it is the only thing that decides who may write. `client/` is a React + Vite SPA that talks to it through one fetch wrapper. Post bodies are stored as BlockNote block JSON and rendered to HTML by a single shared `BlockRenderer`, so the editor and the published page can never drift apart.

**Tech Stack:** React 19, Vite 6, React Router 7, Tailwind CSS 4, BlockNote, Node 20, Express 4, Mongoose 8, MongoDB Atlas, Cloudinary, Zod, JWT in an httpOnly cookie, Vitest + Supertest + mongodb-memory-server + Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-30-blog-platform-design.md`

## Global Constraints

Every task's requirements implicitly include this section.

- **Node 20.19+.** Both workspaces are ESM — every `package.json` sets `"type": "module"`, every import uses explicit file extensions.
- **Version floors:** express `^4.21`, mongoose `^8.9`, zod `^3.24`, react `^19`, react-dom `^19`, react-router-dom `^7`, vite `^6`, tailwindcss `^4`, vitest `^2.1`.
- **Secrets** live only in `server/.env` (already created, already gitignored). Never commit a real secret; never print one to stdout. `server/.env.example` documents every variable.
- **One error shape, everywhere:** `{ "error": { "code", "message", "fields?" } }`. No route hand-rolls its own error response — throw an `HttpError` and let `errorHandler` format it.
- **HTTP statuses:** 400 malformed · 401 unauthenticated · 403 forbidden or banned · 404 missing · 409 duplicate · 422 validation · 429 rate-limited · 500 unexpected.
- **Auth:** bcrypt cost 12. JWT valid 30 days, delivered in an httpOnly cookie named `token`. Never in localStorage, never in a response body. `passwordHash` never appears in any API response.
- **Authorization is server-side.** Hiding a button in React is cosmetic. Every write route passes through a guard.
- **Slugs are immutable** once created — editing a title never changes the URL.
- **Video embeds are YouTube and Vimeo only.** Any other URL is rejected. This is an iframe-injection control, not just a product decision.
- **Uploads:** images only, 5 MB cap, validated by declared MIME *and* magic bytes.
- **Palette tokens (exact):** parchment `#EFE9D5` · ink `#14110D` · mustard `#E8B833` · card `#FAF6E9` · brick `#B4472F` (destructive only).
- **Out of scope — do not build:** comments, full-text search, dark mode, video file uploads, follows, likes, notifications, email sending, OAuth, revision history, soft-delete for user-initiated deletes.
- **TDD is mandatory.** Write the test, watch it fail for the right reason, then implement. A test that passes before the implementation exists is a broken test — fix it, don't proceed.
- **Commit at the end of every task** using Conventional Commits (`feat:`, `test:`, `chore:`, `fix:`).

## File Structure

**Root**
- `package.json` — npm workspaces, `npm run dev` runs both sides, `npm test` runs both suites.
- `.gitignore` — exists already.

**`server/`** — one responsibility per file.
- `src/app.js` — builds and returns the Express app. Exported as a factory so tests get a fresh app with no listening socket.
- `src/index.js` — the only file that connects to Mongo and binds a port.
- `src/lib/db.js` `httpError.js` `token.js` `slug.js` `excerpt.js` `video.js` `cloudinary.js` `sanitizeUser.js`
- `src/models/User.js` `Post.js`
- `src/middleware/errorHandler.js` `validate.js` `requireAuth.js` `requireOwnerOrAdmin.js` `rateLimit.js`
- `src/routes/auth.js` `posts.js` `mePosts.js` `users.js` `uploads.js` `admin.js` `meta.js`
- `src/schemas/*.js` — Zod schemas, colocated by route.
- `scripts/make-admin.js`
- `tests/` — one file per route group, plus `setup.js` and `factories.js`.

**`client/`**
- `src/lib/api.js` `useAuth.jsx` `video.js` `useAutosave.js` `formatDate.js`
- `src/components/ui/` — `Button.jsx` `Card.jsx` `Badge.jsx` `Input.jsx` `Textarea.jsx` `RotatingBadge.jsx` `Toast.jsx` `ErrorBoundary.jsx` `Spinner.jsx`
- `src/components/layout/` — `SiteHeader.jsx` `SiteFooter.jsx` `Shell.jsx`
- `src/components/` — `PostCard.jsx` `BlockRenderer.jsx` `RequireAuth.jsx` `TagInput.jsx`
- `src/blocks/` — `videoEmbed.jsx` `references.jsx` `schema.js` (BlockNote custom block specs)
- `src/pages/` — `Landing.jsx` `Feed.jsx` `Post.jsx` `AuthorProfile.jsx` `Tag.jsx` `NotFound.jsx` `SignUp.jsx` `SignIn.jsx`, `dashboard/{PostList,Editor,ProfileSettings}.jsx`, `admin/AdminPanel.jsx`
- `src/styles/index.css` — Tailwind 4 `@theme` tokens.
- `src/App.jsx` `main.jsx`
- `middleware.js` — Vercel Edge Middleware for crawler meta proxying.
- `tests/` — colocated `*.test.jsx` under `src/`.

`client/src/lib/video.js` is a deliberate byte-for-byte duplicate of `server/src/lib/video.js`. Both sides must agree on what a valid embed is, and a two-file duplication is cheaper here than a third shared workspace. Task 11 includes a test asserting the two files stay identical.

---

## Task 1: Workspace scaffold and server skeleton

**Files:**
- Create: `package.json`, `server/package.json`, `server/src/app.js`, `server/src/index.js`, `server/src/lib/httpError.js`, `server/src/middleware/errorHandler.js`, `server/src/middleware/validate.js`, `server/vitest.config.js`
- Test: `server/tests/health.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `createApp(): express.Application` · `class HttpError(status, code, message, fields?)` and helpers `badRequest(msg)`, `unauthorized(msg?)`, `forbidden(msg?)`, `notFound(msg?)`, `conflict(msg, fields?)`, `validationError(msg, fields)`, `tooMany(msg?)` · `errorHandler(err, req, res, next)` · `validate(schema, source = 'body')` returning Express middleware that replaces `req[source]` with the parsed value.

- [ ] **Step 1: Create the root workspace manifest**

`package.json`:

```json
{
  "name": "blog",
  "private": true,
  "type": "module",
  "workspaces": ["client", "server"],
  "scripts": {
    "dev": "concurrently -n api,web -c yellow,cyan \"npm run dev -w server\" \"npm run dev -w client\"",
    "test": "npm test -w server && npm test -w client"
  },
  "devDependencies": {
    "concurrently": "^9.1.0"
  }
}
```

- [ ] **Step 2: Create the server manifest and install**

`server/package.json`:

```json
{
  "name": "server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --watch --env-file=.env src/index.js",
    "start": "node src/index.js",
    "test": "vitest run",
    "make-admin": "node --env-file=.env scripts/make-admin.js"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cloudinary": "^2.5.1",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "express": "^4.21.2",
    "express-rate-limit": "^7.4.1",
    "file-type": "^19.6.0",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^8.9.0",
    "multer": "^1.4.5-lts.1",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "mongodb-memory-server": "^10.1.2",
    "supertest": "^7.0.0",
    "vitest": "^2.1.8"
  }
}
```

Run: `npm install`
Expected: succeeds, creates a root `node_modules` and `package-lock.json`. `client` is declared as a workspace but does not exist yet — npm tolerates this; if it errors, temporarily set `"workspaces": ["server"]` and restore `client` in Task 9.

- [ ] **Step 3: Write the failing test**

`server/tests/health.test.js`:

```js
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'

describe('server skeleton', () => {
  it('answers the health check', async () => {
    const res = await request(createApp()).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })

  it('returns the standard error shape for an unknown api route', async () => {
    const res = await request(createApp()).get('/api/definitely-not-real')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    })
  })
})
```

`server/vitest.config.js`:

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 20000,
    hookTimeout: 60000,
  },
})
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test -w server`
Expected: FAIL — `Failed to load ../src/app.js` (the module does not exist yet).

- [ ] **Step 5: Implement the error primitives**

`server/src/lib/httpError.js`:

```js
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
```

`server/src/middleware/errorHandler.js`:

```js
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
```

`server/src/middleware/validate.js`:

```js
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
```

- [ ] **Step 6: Implement the app factory**

`server/src/app.js`:

```js
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
```

`server/src/index.js`:

```js
import { createApp } from './app.js'

const port = process.env.PORT || 4000
createApp().listen(port, () => {
  console.log(`api listening on http://localhost:${port}`)
})
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm test -w server`
Expected: PASS, 2 tests.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json server/package.json server/src server/tests server/vitest.config.js
git commit -m "feat: scaffold workspaces and express app skeleton"
```

---

## Task 2: Database connection, test harness, and User model

**Files:**
- Create: `server/src/lib/db.js`, `server/src/models/User.js`, `server/src/lib/sanitizeUser.js`, `server/tests/setup.js`, `server/tests/factories.js`
- Modify: `server/src/index.js`, `server/vitest.config.js`
- Test: `server/tests/user.model.test.js`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `connectDb(uri): Promise<void>` · `User` Mongoose model with instance method `comparePassword(plain): Promise<boolean>` and static `hashPassword(plain): Promise<string>` · `sanitizeUser(userDoc): { id, username, displayName, bio, avatarUrl, role, createdAt }` — the *only* shape a user is ever serialized in · test factory `makeUser(overrides?): Promise<UserDoc>`.

- [ ] **Step 1: Write the failing test**

`server/tests/user.model.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { User } from '../src/models/User.js'
import { sanitizeUser } from '../src/lib/sanitizeUser.js'
import { makeUser } from './factories.js'

describe('User model', () => {
  it('hashes the password and never stores it in plain text', async () => {
    const user = await makeUser({ password: 'correct horse battery' })
    expect(user.passwordHash).not.toContain('correct horse')
    expect(await user.comparePassword('correct horse battery')).toBe(true)
    expect(await user.comparePassword('wrong')).toBe(false)
  })

  it('lowercases username and email', async () => {
    const user = await makeUser({ username: 'MixedCase', email: 'Me@Example.COM' })
    expect(user.username).toBe('mixedcase')
    expect(user.email).toBe('me@example.com')
  })

  it('rejects a duplicate email', async () => {
    await makeUser({ email: 'dupe@example.com', username: 'one' })
    await expect(makeUser({ email: 'dupe@example.com', username: 'two' })).rejects.toThrow()
  })

  it('rejects a duplicate username', async () => {
    await makeUser({ username: 'taken', email: 'a@example.com' })
    await expect(makeUser({ username: 'taken', email: 'b@example.com' })).rejects.toThrow()
  })

  it('rejects an invalid username', async () => {
    await expect(makeUser({ username: 'no spaces!' })).rejects.toThrow()
  })

  it('defaults role to user and isBanned to false', async () => {
    const user = await makeUser()
    expect(user.role).toBe('user')
    expect(user.isBanned).toBe(false)
  })

  it('sanitizeUser exposes no secrets', async () => {
    const user = await makeUser({ email: 'secret@example.com' })
    const safe = sanitizeUser(user)
    expect(safe).toHaveProperty('username')
    expect(safe).toHaveProperty('role')
    expect(safe).not.toHaveProperty('passwordHash')
    expect(safe).not.toHaveProperty('email')
    expect(safe).not.toHaveProperty('_id')
  })
})
```

`server/tests/factories.js`:

```js
import { User } from '../src/models/User.js'

let counter = 0

export async function makeUser(overrides = {}) {
  counter += 1
  const { password = 'password123', ...rest } = overrides
  return User.create({
    username: `user${counter}`,
    email: `user${counter}@example.com`,
    passwordHash: await User.hashPassword(password),
    displayName: `User ${counter}`,
    ...rest,
  })
}
```

`server/tests/setup.js`:

```js
import { beforeAll, afterAll, afterEach } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongod

beforeAll(async () => {
  process.env.JWT_SECRET ??= 'test-secret-not-used-in-production'
  process.env.CLIENT_ORIGIN ??= 'http://localhost:5173'
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  // Build the unique indexes the models declare; without this, duplicate-key
  // tests pass silently against an unindexed collection.
  await mongoose.connection.asPromise()
  for (const model of Object.values(mongoose.models)) {
    await model.syncIndexes()
  }
})

afterEach(async () => {
  const { collections } = mongoose.connection
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})))
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod?.stop()
})
```

Note: `syncIndexes` runs over `mongoose.models`, so a model must be imported before it is indexed. Test files import their models at module load, which happens before `beforeAll` — that ordering is what makes this work.

Add to `server/vitest.config.js` inside `test`:

```js
    setupFiles: ['tests/setup.js'],
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/user.model.test.js -w server` (or `npm test -w server`)
Expected: FAIL — cannot resolve `../src/models/User.js`.

- [ ] **Step 3: Implement the model, connection, and serializer**

`server/src/models/User.js`:

```js
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const BCRYPT_COST = 12

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
      match: /^[a-z0-9_-]+$/,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
    },
    passwordHash: { type: String, required: true },
    displayName: { type: String, trim: true, maxlength: 60, default: '' },
    bio: { type: String, trim: true, maxlength: 280, default: '' },
    avatarUrl: { type: String, default: null },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isBanned: { type: Boolean, default: false },
  },
  { timestamps: true },
)

userSchema.pre('validate', function setDisplayName(next) {
  if (!this.displayName) this.displayName = this.username
  next()
})

userSchema.statics.hashPassword = function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_COST)
}

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.passwordHash)
}

export const User = mongoose.model('User', userSchema)
```

`server/src/lib/sanitizeUser.js`:

```js
// The single public shape of a user. Email is intentionally omitted — it is
// never exposed through the API, not even to the account's owner's profile
// payload, because no screen needs it.
export function sanitizeUser(user) {
  if (!user) return null
  return {
    id: String(user._id),
    username: user.username,
    displayName: user.displayName,
    bio: user.bio ?? '',
    avatarUrl: user.avatarUrl ?? null,
    role: user.role,
    createdAt: user.createdAt,
  }
}
```

`server/src/lib/db.js`:

```js
import mongoose from 'mongoose'

export async function connectDb(uri = process.env.MONGODB_URI) {
  if (!uri) throw new Error('MONGODB_URI is not set')
  mongoose.set('strictQuery', true)
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 })
  console.log('mongo connected')
}
```

Replace `server/src/index.js` with:

```js
import { createApp } from './app.js'
import { connectDb } from './lib/db.js'

const port = process.env.PORT || 4000

try {
  await connectDb()
  createApp().listen(port, () => {
    console.log(`api listening on http://localhost:${port}`)
  })
} catch (err) {
  console.error('failed to start', err)
  process.exit(1)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -w server`
Expected: PASS, 9 tests. The first run downloads a MongoDB binary — allow a minute.

- [ ] **Step 5: Commit**

```bash
git add server/src server/tests server/vitest.config.js
git commit -m "feat: add mongo connection, user model, and in-memory test harness"
```

---

## Task 3: Authentication

**Files:**
- Create: `server/src/lib/token.js`, `server/src/middleware/requireAuth.js`, `server/src/middleware/rateLimit.js`, `server/src/schemas/auth.js`, `server/src/routes/auth.js`, `server/scripts/make-admin.js`
- Modify: `server/src/app.js` (mount `/api/auth` at the route mount point)
- Test: `server/tests/auth.test.js`

**Interfaces:**
- Consumes: `createApp`, `HttpError` helpers, `validate`, `User`, `sanitizeUser`, `makeUser`.
- Produces:
  - `signToken(user): string`, `setAuthCookie(res, token): void`, `clearAuthCookie(res): void`, `readToken(req): { sub: string } | null`
  - `requireAuth` — sets `req.user` to a `User` document or throws 401.
  - `requireNotBanned` — 403 `BANNED` if `req.user.isBanned`. Runs *after* `requireAuth`.
  - `requireAdmin` — 403 unless `req.user.role === 'admin'`.
  - `signupLimiter`, `loginLimiter`, `createPostLimiter`, `uploadLimiter` — Express middleware.
  - Routes: `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`. All success responses are `{ user: sanitizeUser(...) }`.

- [ ] **Step 1: Write the failing test**

`server/tests/auth.test.js`:

```js
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { User } from '../src/models/User.js'
import { makeUser } from './factories.js'

const app = () => createApp()

const good = {
  username: 'nella',
  email: 'nella@example.com',
  password: 'password123',
}

describe('POST /api/auth/signup', () => {
  it('creates an account and sets an httpOnly cookie', async () => {
    const res = await request(app()).post('/api/auth/signup').send(good)
    expect(res.status).toBe(201)
    expect(res.body.user).toMatchObject({ username: 'nella', role: 'user' })
    expect(res.body.user).not.toHaveProperty('passwordHash')

    const cookie = res.headers['set-cookie'].join(';')
    expect(cookie).toContain('token=')
    expect(cookie).toContain('HttpOnly')
  })

  it('rejects a duplicate email with 409', async () => {
    await request(app()).post('/api/auth/signup').send(good)
    const res = await request(app())
      .post('/api/auth/signup')
      .send({ ...good, username: 'other' })
    expect(res.status).toBe(409)
    expect(res.body.error.fields).toHaveProperty('email')
  })

  it('rejects a duplicate username with 409', async () => {
    await request(app()).post('/api/auth/signup').send(good)
    const res = await request(app())
      .post('/api/auth/signup')
      .send({ ...good, email: 'different@example.com' })
    expect(res.status).toBe(409)
    expect(res.body.error.fields).toHaveProperty('username')
  })

  it('rejects a short password with 422 and names the field', async () => {
    const res = await request(app())
      .post('/api/auth/signup')
      .send({ ...good, password: 'short' })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('VALIDATION')
    expect(res.body.error.fields).toHaveProperty('password')
  })

  it('rejects an invalid username with 422', async () => {
    const res = await request(app())
      .post('/api/auth/signup')
      .send({ ...good, username: 'has spaces' })
    expect(res.status).toBe(422)
    expect(res.body.error.fields).toHaveProperty('username')
  })
})

describe('POST /api/auth/login', () => {
  it('signs in with correct credentials', async () => {
    await makeUser({ username: 'zia', email: 'zia@example.com', password: 'password123' })
    const res = await request(app())
      .post('/api/auth/login')
      .send({ email: 'zia@example.com', password: 'password123' })
    expect(res.status).toBe(200)
    expect(res.body.user.username).toBe('zia')
    expect(res.headers['set-cookie'].join(';')).toContain('token=')
  })

  it('is case-insensitive about the email', async () => {
    await makeUser({ email: 'zia@example.com', password: 'password123' })
    const res = await request(app())
      .post('/api/auth/login')
      .send({ email: 'ZIA@Example.com', password: 'password123' })
    expect(res.status).toBe(200)
  })

  it('gives the same generic 401 for a wrong password and an unknown email', async () => {
    await makeUser({ email: 'zia@example.com', password: 'password123' })
    const wrongPassword = await request(app())
      .post('/api/auth/login')
      .send({ email: 'zia@example.com', password: 'nope-nope-nope' })
    const unknownEmail = await request(app())
      .post('/api/auth/login')
      .send({ email: 'ghost@example.com', password: 'password123' })

    expect(wrongPassword.status).toBe(401)
    expect(unknownEmail.status).toBe(401)
    // No account-existence leak: the two responses must be indistinguishable.
    expect(wrongPassword.body).toEqual(unknownEmail.body)
  })
})

describe('GET /api/auth/me', () => {
  it('returns 401 without a cookie', async () => {
    const res = await request(app()).get('/api/auth/me')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
  })

  it('returns the current user with a cookie', async () => {
    const agent = request.agent(app())
    await agent.post('/api/auth/signup').send(good)
    const res = await agent.get('/api/auth/me')
    expect(res.status).toBe(200)
    expect(res.body.user.username).toBe('nella')
  })

  it('returns 401 after logout', async () => {
    const agent = request.agent(app())
    await agent.post('/api/auth/signup').send(good)
    await agent.post('/api/auth/logout')
    const res = await agent.get('/api/auth/me')
    expect(res.status).toBe(401)
  })

  it('returns 401 when the token names a user who no longer exists', async () => {
    const agent = request.agent(app())
    await agent.post('/api/auth/signup').send(good)
    await User.deleteMany({})
    const res = await agent.get('/api/auth/me')
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/auth.test.js` from `server/`
Expected: FAIL — every request 404s, because `/api/auth` is not mounted.

- [ ] **Step 3: Implement tokens, guards, and limiters**

`server/src/lib/token.js`:

```js
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
```

`server/src/middleware/requireAuth.js`:

```js
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
```

`server/src/middleware/rateLimit.js`:

```js
import rateLimit from 'express-rate-limit'
import { tooMany } from '../lib/httpError.js'

// Limits are disabled under test so suites do not trip over each other.
const disabled = process.env.NODE_ENV === 'test'

const make = ({ windowMs, limit, message, byUser = false }) =>
  disabled
    ? (_req, _res, next) => next()
    : rateLimit({
        windowMs,
        limit,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        keyGenerator: byUser
          ? (req) => String(req.user?._id ?? req.ip)
          : undefined,
        handler: (_req, _res, next) => next(tooMany(message)),
      })

export const signupLimiter = make({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: 'Too many accounts created from this network. Try again in an hour.',
})

export const loginLimiter = make({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: 'Too many sign-in attempts. Try again in 15 minutes.',
})

export const createPostLimiter = make({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  byUser: true,
  message: 'You have created a lot of posts recently. Try again in an hour.',
})

export const uploadLimiter = make({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  byUser: true,
  message: 'Upload limit reached. Try again in an hour.',
})
```

Set `NODE_ENV=test` for the suite by adding to `server/vitest.config.js` inside `test`:

```js
    env: { NODE_ENV: 'test' },
```

- [ ] **Step 4: Implement the auth schemas and routes**

`server/src/schemas/auth.js`:

```js
import { z } from 'zod'

export const signupSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'At least 3 characters')
    .max(20, 'At most 20 characters')
    .regex(/^[a-z0-9_-]+$/, 'Letters, numbers, hyphens and underscores only'),
  email: z.string().trim().toLowerCase().email('That does not look like an email'),
  password: z.string().min(8, 'At least 8 characters').max(200, 'Too long'),
  displayName: z.string().trim().max(60).optional(),
})

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('That does not look like an email'),
  password: z.string().min(1, 'Enter your password'),
})
```

`server/src/routes/auth.js`:

```js
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
```

Mount it in `server/src/app.js` at the route mount point:

```js
import { authRouter } from './routes/auth.js'
// ...
  app.use('/api/auth', authRouter)
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -w server`
Expected: PASS — 12 new auth tests plus the earlier 11.

- [ ] **Step 6: Add the make-admin script**

`server/scripts/make-admin.js`:

```js
import mongoose from 'mongoose'
import { connectDb } from '../src/lib/db.js'
import { User } from '../src/models/User.js'

const email = process.argv[2]?.trim().toLowerCase()
if (!email) {
  console.error('usage: npm run make-admin -- <email>')
  process.exit(1)
}

await connectDb()
const user = await User.findOneAndUpdate(
  { email },
  { role: 'admin' },
  { new: true },
)
if (!user) {
  console.error(`no account found for ${email}`)
  await mongoose.disconnect()
  process.exit(1)
}
console.log(`${user.username} is now an admin`)
await mongoose.disconnect()
```

There is deliberately no API route that grants the admin role — role escalation is only possible with database access.

- [ ] **Step 7: Commit**

```bash
git add server/src server/scripts server/tests server/vitest.config.js
git commit -m "feat: add password auth with httpOnly cookie sessions and rate limits"
```

---

## Task 4: Post model and content libraries

**Files:**
- Create: `server/src/models/Post.js`, `server/src/lib/slug.js`, `server/src/lib/excerpt.js`, `server/src/lib/video.js`, `server/src/lib/contentGuard.js`
- Modify: `server/tests/factories.js` (add `makePost`)
- Test: `server/tests/content.lib.test.js`, `server/tests/post.model.test.js`

**Interfaces:**
- Consumes: `User`, `makeUser`, `validationError`.
- Produces:
  - `Post` model. `content` is always stored as `{ blocks: [...] }` — an object with a `blocks` array, never a bare array.
  - `slugify(title): string`
  - `uniqueSlug(title, PostModel): Promise<string>` — appends a 4-hex-char suffix on collision.
  - `deriveExcerpt(content, max = 280): string`
  - `countTextLength(content): number` — used to reject publishing an empty body.
  - `parseVideoUrl(url): { provider: 'youtube' | 'vimeo', videoId: string } | null`
  - `embedUrl({ provider, videoId }): string`
  - `assertValidContent(content): void` — throws a 422 `HttpError` if a block is malformed or a video block points anywhere but YouTube/Vimeo.
  - `makePost(overrides?): Promise<PostDoc>` test factory; accepts an `author` user doc and creates one if absent.

- [ ] **Step 1: Write the failing library test**

`server/tests/content.lib.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { slugify } from '../src/lib/slug.js'
import { deriveExcerpt, countTextLength } from '../src/lib/excerpt.js'
import { parseVideoUrl, embedUrl } from '../src/lib/video.js'
import { assertValidContent } from '../src/lib/contentGuard.js'

const paragraph = (text) => ({
  id: 'b1',
  type: 'paragraph',
  props: {},
  content: [{ type: 'text', text, styles: {} }],
  children: [],
})

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Hello Brave New World')).toBe('hello-brave-new-world')
  })

  it('strips punctuation and collapses separators', () => {
    expect(slugify('  What?! Is   this...  ')).toBe('what-is-this')
  })

  it('strips accents', () => {
    expect(slugify('Café Déjà Vu')).toBe('cafe-deja-vu')
  })

  it('falls back to "post" when nothing survives', () => {
    expect(slugify('???')).toBe('post')
    expect(slugify('')).toBe('post')
  })

  it('caps length at 80 characters', () => {
    expect(slugify('a'.repeat(200)).length).toBe(80)
  })
})

describe('deriveExcerpt', () => {
  it('uses the first block that has text', () => {
    const content = { blocks: [paragraph(''), paragraph('The real opening line.')] }
    expect(deriveExcerpt(content)).toBe('The real opening line.')
  })

  it('truncates to the maximum', () => {
    const content = { blocks: [paragraph('x'.repeat(400))] }
    expect(deriveExcerpt(content).length).toBe(280)
  })

  it('returns an empty string for empty or missing content', () => {
    expect(deriveExcerpt({ blocks: [] })).toBe('')
    expect(deriveExcerpt(undefined)).toBe('')
  })
})

describe('countTextLength', () => {
  it('counts text across nested blocks', () => {
    const content = { blocks: [{ ...paragraph('abc'), children: [paragraph('de')] }] }
    expect(countTextLength(content)).toBe(5)
  })

  it('counts an image-only post as having content', () => {
    const content = {
      blocks: [
        { id: 'i', type: 'image', props: { url: 'https://example.com/y.png' }, content: [], children: [] },
      ],
    }
    expect(countTextLength(content)).toBeGreaterThan(0)
  })
})

describe('parseVideoUrl', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ'],
    ['https://youtube.com/watch?v=dQw4w9WgXcQ&t=42', 'youtube', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ'],
    ['https://vimeo.com/76979871', 'vimeo', '76979871'],
    ['https://vimeo.com/76979871/abcdef', 'vimeo', '76979871'],
  ])('parses %s', (url, provider, videoId) => {
    expect(parseVideoUrl(url)).toEqual({ provider, videoId })
  })

  it.each([
    'https://evil.example.com/embed/x',
    'javascript:alert(1)',
    'https://youtube.com/watch?v=tooshort',
    'https://vimeo.com/notanumber',
    'not a url at all',
    '',
    null,
  ])('rejects %s', (url) => {
    expect(parseVideoUrl(url)).toBeNull()
  })

  it('builds cookie-less embed urls', () => {
    expect(embedUrl({ provider: 'youtube', videoId: 'dQw4w9WgXcQ' })).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    )
    expect(embedUrl({ provider: 'vimeo', videoId: '76979871' })).toBe(
      'https://player.vimeo.com/video/76979871',
    )
  })
})

describe('assertValidContent', () => {
  it('accepts well-formed content', () => {
    expect(() => assertValidContent({ blocks: [paragraph('fine')] })).not.toThrow()
  })

  it('rejects content that is not an object with blocks', () => {
    expect(() => assertValidContent([])).toThrow(/blocks/i)
    expect(() => assertValidContent(null)).toThrow(/blocks/i)
  })

  it('rejects a video block from a disallowed host', () => {
    const content = {
      blocks: [
        { id: 'v', type: 'videoEmbed', props: { url: 'https://evil.example.com/x' }, content: [], children: [] },
      ],
    }
    expect(() => assertValidContent(content)).toThrow(/YouTube or Vimeo/i)
  })

  it('rejects a references block containing a non-http url', () => {
    const content = {
      blocks: [
        {
          id: 'r',
          type: 'references',
          props: { items: JSON.stringify([{ label: 'x', url: 'javascript:alert(1)' }]) },
          content: [],
          children: [],
        },
      ],
    }
    expect(() => assertValidContent(content)).toThrow(/http/i)
  })

  it('rejects content nested more than four levels deep', () => {
    let block = paragraph('deep')
    for (let i = 0; i < 6; i += 1) block = { ...paragraph('x'), children: [block] }
    expect(() => assertValidContent({ blocks: [block] })).toThrow(/nested/i)
  })

  it('rejects more than 500 blocks', () => {
    const blocks = Array.from({ length: 501 }, () => paragraph('x'))
    expect(() => assertValidContent({ blocks })).toThrow(/too many/i)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/content.lib.test.js` from `server/`
Expected: FAIL — none of the four library modules resolve.

- [ ] **Step 3: Implement slug and excerpt**

`server/src/lib/slug.js`:

```js
import crypto from 'node:crypto'

export function slugify(title) {
  const base = String(title ?? '')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '')
  return base || 'post'
}

// Slugs are permanent, so collisions get a random suffix rather than a counter —
// a counter would leak how many similarly titled posts exist.
export async function uniqueSlug(title, PostModel) {
  const base = slugify(title)
  if (!(await PostModel.exists({ slug: base }))) return base

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${base}-${crypto.randomBytes(2).toString('hex')}`
    if (!(await PostModel.exists({ slug: candidate }))) return candidate
  }
  return `${base}-${Date.now().toString(36)}`
}
```

`server/src/lib/excerpt.js`:

```js
const TEXT_BLOCKS = new Set([
  'paragraph',
  'heading',
  'quote',
  'bulletListItem',
  'numberedListItem',
  'checkListItem',
])

const NON_TEXT_CONTENT_BLOCKS = new Set(['image', 'videoEmbed', 'references', 'codeBlock', 'table'])

const blocksOf = (content) => (Array.isArray(content?.blocks) ? content.blocks : [])

const inlineText = (block) =>
  (Array.isArray(block?.content) ? block.content : [])
    .map((node) =>
      node?.type === 'link'
        ? (node.content ?? []).map((child) => child?.text ?? '').join('')
        : node?.text ?? '',
    )
    .join('')

export function deriveExcerpt(content, max = 280) {
  for (const block of blocksOf(content)) {
    if (!TEXT_BLOCKS.has(block?.type)) continue
    const text = inlineText(block).trim()
    if (text) return text.slice(0, max)
  }
  return ''
}

export function countTextLength(content) {
  let total = 0
  const walk = (blocks) => {
    for (const block of blocks ?? []) {
      total += inlineText(block).trim().length
      // A post that is only an image or a video is still a real post.
      if (NON_TEXT_CONTENT_BLOCKS.has(block?.type)) total += 1
      if (Array.isArray(block?.children)) walk(block.children)
    }
  }
  walk(blocksOf(content))
  return total
}
```

- [ ] **Step 4: Implement the video allowlist**

`server/src/lib/video.js` — **duplicated verbatim at `client/src/lib/video.js` in Task 11. Any edit must be applied to both; Task 11 adds a test that fails if they diverge.**

```js
// Allowlist of embeddable providers. Anything unmatched is rejected, which is
// what keeps arbitrary iframes out of posts.
export function parseVideoUrl(input) {
  if (typeof input !== 'string' || !input.trim()) return null

  let url
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null

  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  const YT_ID = /^[\w-]{11}$/

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    const v = url.searchParams.get('v')
    if (v && YT_ID.test(v)) return { provider: 'youtube', videoId: v }
    const path = url.pathname.match(/^\/(?:embed|shorts|v)\/([\w-]{11})\/?$/)
    if (path) return { provider: 'youtube', videoId: path[1] }
    return null
  }

  if (host === 'youtu.be') {
    const path = url.pathname.match(/^\/([\w-]{11})\/?$/)
    return path ? { provider: 'youtube', videoId: path[1] } : null
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const path = url.pathname.match(/^\/(?:video\/)?(\d{6,12})(?:\/|$)/)
    return path ? { provider: 'vimeo', videoId: path[1] } : null
  }

  return null
}

export function embedUrl({ provider, videoId }) {
  return provider === 'youtube'
    ? `https://www.youtube-nocookie.com/embed/${videoId}`
    : `https://player.vimeo.com/video/${videoId}`
}
```

- [ ] **Step 5: Implement the content guard**

`server/src/lib/contentGuard.js`:

```js
import { validationError } from './httpError.js'
import { parseVideoUrl } from './video.js'

const MAX_BLOCKS = 500
const MAX_DEPTH = 4

const fail = (message) => {
  throw validationError(message, { content: message })
}

const isHttpUrl = (value) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

// References are stored as a JSON string in block props because BlockNote props
// must be primitives. Parse defensively — this value came from a client.
const parseItems = (raw) => {
  if (Array.isArray(raw)) return raw
  if (typeof raw !== 'string') return null
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function assertValidContent(content) {
  const malformed =
    !content ||
    typeof content !== 'object' ||
    Array.isArray(content) ||
    !Array.isArray(content.blocks)
  if (malformed) fail('Post content must be an object with a blocks array')

  let count = 0

  const walk = (blocks, depth) => {
    if (depth > MAX_DEPTH) fail('Post content is nested too deeply')

    for (const block of blocks) {
      count += 1
      if (count > MAX_BLOCKS) fail('This post has too many blocks (maximum 500)')
      if (!block || typeof block !== 'object' || typeof block.type !== 'string') {
        fail('Post content contains a malformed block')
      }

      if (block.type === 'videoEmbed' && !parseVideoUrl(block.props?.url)) {
        fail('Video embeds must be a YouTube or Vimeo link')
      }

      if (block.type === 'image' && block.props?.url && !isHttpUrl(block.props.url)) {
        fail('Image blocks must use an http or https url')
      }

      if (block.type === 'references') {
        const items = parseItems(block.props?.items)
        if (!items) fail('The references block is malformed')
        for (const item of items) {
          if (!isHttpUrl(item?.url)) fail('Every reference must be an http or https url')
        }
      }

      if (Array.isArray(block.children) && block.children.length) {
        walk(block.children, depth + 1)
      }
    }
  }

  walk(content.blocks, 1)
}
```

- [ ] **Step 6: Run the library test to verify it passes**

Run: `npx vitest run tests/content.lib.test.js` from `server/`
Expected: PASS.

- [ ] **Step 7: Write the failing model test**

`server/tests/post.model.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { Post } from '../src/models/Post.js'
import { uniqueSlug } from '../src/lib/slug.js'
import { makeUser, makePost } from './factories.js'

describe('Post model', () => {
  it('defaults to a draft with no publish date', async () => {
    const post = await makePost()
    expect(post.status).toBe('draft')
    expect(post.publishedAt).toBeNull()
  })

  it('requires an author', async () => {
    await expect(Post.create({ title: 'orphan', slug: 'orphan' })).rejects.toThrow()
  })

  it('rejects a duplicate slug', async () => {
    await makePost({ slug: 'same-slug' })
    await expect(makePost({ slug: 'same-slug' })).rejects.toThrow()
  })

  it('lowercases and trims tags', async () => {
    const post = await makePost({ tags: [' Design ', 'CODE'] })
    expect(post.tags).toEqual(['design', 'code'])
  })

  it('rejects more than five tags', async () => {
    await expect(makePost({ tags: ['a', 'b', 'c', 'd', 'e', 'f'] })).rejects.toThrow()
  })
})

describe('uniqueSlug', () => {
  it('returns the plain slug when it is free', async () => {
    expect(await uniqueSlug('A Fresh Title', Post)).toBe('a-fresh-title')
  })

  it('suffixes on collision without changing the base', async () => {
    await makePost({ slug: 'a-fresh-title' })
    const slug = await uniqueSlug('A Fresh Title', Post)
    expect(slug).toMatch(/^a-fresh-title-[0-9a-f]{4}$/)
  })
})

describe('factories', () => {
  it('creates independent users', async () => {
    const a = await makeUser()
    const b = await makeUser()
    expect(String(a._id)).not.toBe(String(b._id))
  })
})
```

Append to `server/tests/factories.js` (the `counter` variable already exists from Task 2):

```js
import { Post } from '../src/models/Post.js'

export async function makePost(overrides = {}) {
  counter += 1
  const { author, ...rest } = overrides
  const owner = author ?? (await makeUser())
  return Post.create({
    author: owner._id,
    title: `Post ${counter}`,
    slug: `post-${counter}`,
    content: {
      blocks: [
        {
          id: `b${counter}`,
          type: 'paragraph',
          props: {},
          content: [{ type: 'text', text: `Body of post ${counter}`, styles: {} }],
          children: [],
        },
      ],
    },
    ...rest,
  })
}
```

- [ ] **Step 8: Run it to verify it fails**

Run: `npx vitest run tests/post.model.test.js` from `server/`
Expected: FAIL — cannot resolve `../src/models/Post.js`.

- [ ] **Step 9: Implement the Post model**

`server/src/models/Post.js`:

```js
import mongoose from 'mongoose'

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, trim: true, maxlength: 160, default: '' },
    slug: { type: String, required: true, unique: true },
    excerpt: { type: String, trim: true, maxlength: 280, default: '' },
    // True once the author writes their own excerpt, which stops later content
    // edits from overwriting it.
    excerptManual: { type: Boolean, default: false },
    coverImageUrl: { type: String, default: null },
    content: { type: mongoose.Schema.Types.Mixed, default: () => ({ blocks: [] }) },
    tags: {
      type: [String],
      default: [],
      set: (tags) =>
        Array.isArray(tags)
          ? [...new Set(tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))]
          : [],
      validate: [
        { validator: (tags) => tags.length <= 5, message: 'At most 5 tags' },
        {
          validator: (tags) => tags.every((tag) => tag.length <= 24 && /^[a-z0-9-]+$/.test(tag)),
          message: 'Tags may use letters, numbers and hyphens, up to 24 characters',
        },
      ],
    },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

postSchema.index({ status: 1, publishedAt: -1 })
postSchema.index({ tags: 1, status: 1, publishedAt: -1 })
postSchema.index({ author: 1, status: 1, updatedAt: -1 })

export const Post = mongoose.model('Post', postSchema)
```

- [ ] **Step 10: Run the whole suite to verify it passes**

Run: `npm test -w server`
Expected: PASS, all suites.

- [ ] **Step 11: Commit**

```bash
git add server/src server/tests
git commit -m "feat: add post model, slug, excerpt, video and content-guard libraries"
```

---

## Task 5: Post CRUD with the ownership guard

**Files:**
- Create: `server/src/lib/serializePost.js`, `server/src/middleware/requireOwnerOrAdmin.js`, `server/src/schemas/posts.js`, `server/src/routes/posts.js`, `server/src/routes/mePosts.js`
- Modify: `server/src/app.js` (mount `/api/posts` and `/api/me`)
- Test: `server/tests/posts.test.js`

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces:
  - `serializePost(post, { full = false }): object` → `{ id, title, slug, excerpt, coverImageUrl, tags, status, publishedAt, createdAt, updatedAt, author: { username, displayName, avatarUrl } | null, content? }`. `content` appears only when `full` is true.
  - `AUTHOR_FIELDS: string` — the populate projection, `'username displayName avatarUrl'`.
  - `loadPostForWrite` — resolves `:id`, 404 if missing or malformed, 403 unless owner or admin, sets `req.post`.
  - Routes: `GET /api/posts`, `GET /api/posts/:slug`, `POST /api/posts`, `PATCH /api/posts/:id`, `POST /api/posts/:id/publish`, `POST /api/posts/:id/unpublish`, `DELETE /api/posts/:id`, `GET /api/me/posts`. List responses are `{ posts, page, pages, total }`; single-post responses are `{ post }`.

- [ ] **Step 1: Write the failing test**

`server/tests/posts.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { Post } from '../src/models/Post.js'
import { User } from '../src/models/User.js'
import { makeUser, makePost } from './factories.js'

const app = () => createApp()

// Signs up a fresh account and returns a cookie-persisting agent for it.
async function signedInAgent() {
  const agent = request.agent(app())
  const suffix = Math.random().toString(36).slice(2, 8)
  const res = await agent.post('/api/auth/signup').send({
    username: `writer${suffix}`,
    email: `writer${suffix}@example.com`,
    password: 'password123',
  })
  expect(res.status).toBe(201)
  return { agent, user: await User.findOne({ username: res.body.user.username }) }
}

const body = (text) => ({
  blocks: [
    {
      id: 'b1',
      type: 'paragraph',
      props: {},
      content: [{ type: 'text', text, styles: {} }],
      children: [],
    },
  ],
})

describe('POST /api/posts', () => {
  it('requires authentication', async () => {
    const res = await request(app()).post('/api/posts').send({ title: 'Nope' })
    expect(res.status).toBe(401)
  })

  it('creates a draft with a slug derived from the title', async () => {
    const { agent } = await signedInAgent()
    const res = await agent.post('/api/posts').send({ title: 'My First Post' })
    expect(res.status).toBe(201)
    expect(res.body.post.slug).toBe('my-first-post')
    expect(res.body.post.status).toBe('draft')
    expect(res.body.post.author.username).toMatch(/^writer/)
  })

  it('suffixes a colliding slug', async () => {
    const { agent } = await signedInAgent()
    await agent.post('/api/posts').send({ title: 'Twice Told' })
    const res = await agent.post('/api/posts').send({ title: 'Twice Told' })
    expect(res.body.post.slug).toMatch(/^twice-told-[0-9a-f]{4}$/)
  })

  it('accepts an untitled draft', async () => {
    const { agent } = await signedInAgent()
    const res = await agent.post('/api/posts').send({})
    expect(res.status).toBe(201)
    expect(res.body.post.slug).toBe('post')
  })
})

describe('PATCH /api/posts/:id', () => {
  it('updates content and re-derives the excerpt', async () => {
    const { agent } = await signedInAgent()
    const created = await agent.post('/api/posts').send({ title: 'Draft' })
    const res = await agent
      .patch(`/api/posts/${created.body.post.id}`)
      .send({ content: body('This becomes the excerpt.') })
    expect(res.status).toBe(200)
    expect(res.body.post.excerpt).toBe('This becomes the excerpt.')
  })

  it('keeps a manually written excerpt when content changes later', async () => {
    const { agent } = await signedInAgent()
    const created = await agent.post('/api/posts').send({ title: 'Draft' })
    await agent
      .patch(`/api/posts/${created.body.post.id}`)
      .send({ excerpt: 'Hand written summary' })
    const res = await agent
      .patch(`/api/posts/${created.body.post.id}`)
      .send({ content: body('A different opening line.') })
    expect(res.body.post.excerpt).toBe('Hand written summary')
  })

  it('never changes the slug when the title changes', async () => {
    const { agent } = await signedInAgent()
    const created = await agent.post('/api/posts').send({ title: 'Original Title' })
    const res = await agent
      .patch(`/api/posts/${created.body.post.id}`)
      .send({ title: 'Completely Different Title' })
    expect(res.body.post.title).toBe('Completely Different Title')
    expect(res.body.post.slug).toBe('original-title')
  })

  it('rejects a video block that is not YouTube or Vimeo', async () => {
    const { agent } = await signedInAgent()
    const created = await agent.post('/api/posts').send({ title: 'Draft' })
    const res = await agent.patch(`/api/posts/${created.body.post.id}`).send({
      content: {
        blocks: [
          {
            id: 'v',
            type: 'videoEmbed',
            props: { url: 'https://evil.example.com/x' },
            content: [],
            children: [],
          },
        ],
      },
    })
    expect(res.status).toBe(422)
    expect(res.body.error.fields).toHaveProperty('content')
  })

  it('404s for an id that is not a valid ObjectId', async () => {
    const { agent } = await signedInAgent()
    const res = await agent.patch('/api/posts/not-an-id').send({ title: 'x' })
    expect(res.status).toBe(404)
  })
})

describe('the ownership guard', () => {
  let owner
  let post

  beforeEach(async () => {
    owner = await signedInAgent()
    const created = await owner.agent.post('/api/posts').send({ title: 'Mine Alone' })
    post = created.body.post
  })

  it('stops another user editing the post', async () => {
    const other = await signedInAgent()
    const res = await other.agent.patch(`/api/posts/${post.id}`).send({ title: 'Hijacked' })
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })

  it('stops another user deleting the post', async () => {
    const other = await signedInAgent()
    const res = await other.agent.delete(`/api/posts/${post.id}`)
    expect(res.status).toBe(403)
    expect(await Post.exists({ _id: post.id })).toBeTruthy()
  })

  it('stops another user publishing the post', async () => {
    const other = await signedInAgent()
    const res = await other.agent.post(`/api/posts/${post.id}/publish`)
    expect(res.status).toBe(403)
  })

  it('lets the owner delete their own post', async () => {
    const res = await owner.agent.delete(`/api/posts/${post.id}`)
    expect(res.status).toBe(200)
    expect(await Post.exists({ _id: post.id })).toBeNull()
  })

  it('lets an admin edit a post belonging to someone else', async () => {
    const admin = await signedInAgent()
    await User.findByIdAndUpdate(admin.user._id, { role: 'admin' })
    const res = await admin.agent.patch(`/api/posts/${post.id}`).send({ title: 'Moderated' })
    expect(res.status).toBe(200)
  })
})

describe('publishing', () => {
  it('refuses to publish without a title', async () => {
    const { agent } = await signedInAgent()
    const created = await agent.post('/api/posts').send({})
    await agent.patch(`/api/posts/${created.body.post.id}`).send({ content: body('has a body') })
    const res = await agent.post(`/api/posts/${created.body.post.id}/publish`)
    expect(res.status).toBe(422)
    expect(res.body.error.fields).toHaveProperty('title')
  })

  it('refuses to publish an empty body', async () => {
    const { agent } = await signedInAgent()
    const created = await agent.post('/api/posts').send({ title: 'Has A Title' })
    const res = await agent.post(`/api/posts/${created.body.post.id}/publish`)
    expect(res.status).toBe(422)
    expect(res.body.error.fields).toHaveProperty('content')
  })

  it('publishes and stamps publishedAt only once', async () => {
    const { agent } = await signedInAgent()
    const created = await agent.post('/api/posts').send({ title: 'Ready To Go' })
    await agent.patch(`/api/posts/${created.body.post.id}`).send({ content: body('a real body') })

    const first = await agent.post(`/api/posts/${created.body.post.id}/publish`)
    expect(first.status).toBe(200)
    expect(first.body.post.status).toBe('published')
    const stamp = first.body.post.publishedAt
    expect(stamp).toBeTruthy()

    await agent.post(`/api/posts/${created.body.post.id}/unpublish`)
    const second = await agent.post(`/api/posts/${created.body.post.id}/publish`)
    // Re-publishing keeps the original date so feed order stays stable.
    expect(second.body.post.publishedAt).toBe(stamp)
  })
})

describe('GET /api/posts', () => {
  it('lists only published posts, newest first', async () => {
    const author = await makeUser()
    await makePost({ author, slug: 'draft-one' })
    await makePost({ author, slug: 'older', status: 'published', publishedAt: new Date('2026-01-01') })
    await makePost({ author, slug: 'newer', status: 'published', publishedAt: new Date('2026-06-01') })

    const res = await request(app()).get('/api/posts')
    expect(res.status).toBe(200)
    expect(res.body.posts.map((p) => p.slug)).toEqual(['newer', 'older'])
    expect(res.body.total).toBe(2)
  })

  it('never includes full content in a list', async () => {
    const author = await makeUser()
    await makePost({ author, status: 'published', publishedAt: new Date() })
    const res = await request(app()).get('/api/posts')
    expect(res.body.posts[0]).not.toHaveProperty('content')
  })

  it('filters by tag and by author', async () => {
    const a = await makeUser({ username: 'ada' })
    const b = await makeUser({ username: 'bo' })
    await makePost({ author: a, slug: 'a1', status: 'published', publishedAt: new Date(), tags: ['design'] })
    await makePost({ author: b, slug: 'b1', status: 'published', publishedAt: new Date(), tags: ['code'] })

    const byTag = await request(app()).get('/api/posts?tag=design')
    expect(byTag.body.posts.map((p) => p.slug)).toEqual(['a1'])

    const byAuthor = await request(app()).get('/api/posts?author=bo')
    expect(byAuthor.body.posts.map((p) => p.slug)).toEqual(['b1'])
  })

  it('returns an empty page for an unknown author', async () => {
    const res = await request(app()).get('/api/posts?author=ghost')
    expect(res.status).toBe(200)
    expect(res.body.posts).toEqual([])
    expect(res.body.total).toBe(0)
  })

  it('paginates', async () => {
    const author = await makeUser()
    for (let i = 0; i < 12; i += 1) {
      await makePost({
        author,
        slug: `p${i}`,
        status: 'published',
        publishedAt: new Date(2026, 0, i + 1),
      })
    }
    const page2 = await request(app()).get('/api/posts?page=2&limit=10')
    expect(page2.body.posts).toHaveLength(2)
    expect(page2.body.pages).toBe(2)
  })
})

describe('GET /api/posts/:slug', () => {
  it('returns a published post with full content to anyone', async () => {
    const author = await makeUser()
    await makePost({ author, slug: 'readable', status: 'published', publishedAt: new Date() })
    const res = await request(app()).get('/api/posts/readable')
    expect(res.status).toBe(200)
    expect(res.body.post.content.blocks).toBeInstanceOf(Array)
  })

  it('hides a draft from anonymous readers as a 404', async () => {
    const author = await makeUser()
    await makePost({ author, slug: 'hidden' })
    const res = await request(app()).get('/api/posts/hidden')
    expect(res.status).toBe(404)
  })

  it('hides a draft from other signed-in users', async () => {
    const author = await makeUser()
    await makePost({ author, slug: 'hidden' })
    const other = await signedInAgent()
    const res = await other.agent.get('/api/posts/hidden')
    expect(res.status).toBe(404)
  })

  it('shows a draft to its owner', async () => {
    const { agent } = await signedInAgent()
    const created = await agent.post('/api/posts').send({ title: 'Secret Draft' })
    const res = await agent.get(`/api/posts/${created.body.post.slug}`)
    expect(res.status).toBe(200)
  })

  it('shows a draft to an admin', async () => {
    const author = await makeUser()
    await makePost({ author, slug: 'hidden' })
    const admin = await signedInAgent()
    await User.findByIdAndUpdate(admin.user._id, { role: 'admin' })
    const res = await admin.agent.get('/api/posts/hidden')
    expect(res.status).toBe(200)
  })
})

describe('GET /api/me/posts', () => {
  it('requires authentication', async () => {
    const res = await request(app()).get('/api/me/posts')
    expect(res.status).toBe(401)
  })

  it('returns the caller drafts and published posts only', async () => {
    const { agent, user } = await signedInAgent()
    await makePost({ author: user, slug: 'mine-draft' })
    await makePost({ author: user, slug: 'mine-live', status: 'published', publishedAt: new Date() })
    await makePost({ slug: 'someone-else' })

    const res = await agent.get('/api/me/posts')
    expect(res.status).toBe(200)
    expect(res.body.posts.map((p) => p.slug).sort()).toEqual(['mine-draft', 'mine-live'])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/posts.test.js` from `server/`
Expected: FAIL — post routes are not mounted, so every request 404s.

- [ ] **Step 3: Implement the serializer and the ownership guard**

`server/src/lib/serializePost.js`:

```js
export const AUTHOR_FIELDS = 'username displayName avatarUrl'

export function serializePost(post, { full = false } = {}) {
  const populated = post.author && typeof post.author === 'object' && post.author.username

  return {
    id: String(post._id),
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    coverImageUrl: post.coverImageUrl ?? null,
    tags: post.tags ?? [],
    status: post.status,
    publishedAt: post.publishedAt,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    author: populated
      ? {
          username: post.author.username,
          displayName: post.author.displayName,
          avatarUrl: post.author.avatarUrl ?? null,
        }
      : null,
    // Bodies can be large; lists never carry them.
    ...(full ? { content: post.content ?? { blocks: [] } } : {}),
  }
}
```

`server/src/middleware/requireOwnerOrAdmin.js`:

```js
import mongoose from 'mongoose'
import { Post } from '../models/Post.js'
import { notFound, forbidden } from '../lib/httpError.js'

// A malformed id 404s rather than 400s: whether a string is a valid ObjectId is
// not information worth distinguishing to a caller.
export async function loadPostForWrite(req, _res, next) {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) return next(notFound('Post not found'))

    const post = await Post.findById(id)
    if (!post) return next(notFound('Post not found'))

    const isOwner = String(post.author) === String(req.user._id)
    if (!isOwner && req.user.role !== 'admin') {
      return next(forbidden('That post belongs to someone else'))
    }

    req.post = post
    next()
  } catch (err) {
    next(err)
  }
}
```

- [ ] **Step 4: Implement the schemas**

`server/src/schemas/posts.js`:

```js
import { z } from 'zod'

export const createPostSchema = z.object({
  title: z.string().trim().max(160, 'At most 160 characters').optional(),
})

export const updatePostSchema = z
  .object({
    title: z.string().trim().max(160, 'At most 160 characters').optional(),
    excerpt: z.string().trim().max(280, 'At most 280 characters').optional(),
    coverImageUrl: z.string().url('Must be a url').nullable().optional(),
    content: z.object({ blocks: z.array(z.any()) }).passthrough().optional(),
    tags: z.array(z.string().trim().toLowerCase().max(24)).max(5, 'At most 5 tags').optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' })

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  tag: z.string().trim().toLowerCase().optional(),
  author: z.string().trim().toLowerCase().optional(),
})
```

- [ ] **Step 5: Implement the post routes**

`server/src/routes/posts.js`:

```js
import { Router } from 'express'
import { Post } from '../models/Post.js'
import { User } from '../models/User.js'
import { validate } from '../middleware/validate.js'
import { requireAuth, requireNotBanned, attachUser } from '../middleware/requireAuth.js'
import { loadPostForWrite } from '../middleware/requireOwnerOrAdmin.js'
import { createPostLimiter } from '../middleware/rateLimit.js'
import { createPostSchema, updatePostSchema, listQuerySchema } from '../schemas/posts.js'
import { serializePost, AUTHOR_FIELDS } from '../lib/serializePost.js'
import { uniqueSlug } from '../lib/slug.js'
import { deriveExcerpt, countTextLength } from '../lib/excerpt.js'
import { assertValidContent } from '../lib/contentGuard.js'
import { notFound, validationError } from '../lib/httpError.js'

export const postsRouter = Router()

postsRouter.get('/', validate(listQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { page, limit, tag, author } = req.query
    const filter = { status: 'published' }
    if (tag) filter.tags = tag

    if (author) {
      const found = await User.findOne({ username: author }).select('_id')
      if (!found) return res.json({ posts: [], page, pages: 0, total: 0 })
      filter.author = found._id
    }

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .sort({ publishedAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('author', AUTHOR_FIELDS),
      Post.countDocuments(filter),
    ])

    res.json({
      posts: posts.map((post) => serializePost(post)),
      page,
      pages: Math.ceil(total / limit),
      total,
    })
  } catch (err) {
    next(err)
  }
})

postsRouter.get('/:slug', attachUser, async (req, res, next) => {
  try {
    const post = await Post.findOne({ slug: req.params.slug }).populate('author', AUTHOR_FIELDS)
    if (!post) throw notFound('Post not found')

    if (post.status !== 'published') {
      const isOwner = req.user && String(post.author?._id) === String(req.user._id)
      const isAdmin = req.user?.role === 'admin'
      // A hidden draft is indistinguishable from a post that never existed.
      if (!isOwner && !isAdmin) throw notFound('Post not found')
    }

    res.json({ post: serializePost(post, { full: true }) })
  } catch (err) {
    next(err)
  }
})

postsRouter.post(
  '/',
  requireAuth,
  requireNotBanned,
  createPostLimiter,
  validate(createPostSchema),
  async (req, res, next) => {
    try {
      const title = req.body.title ?? ''
      const post = await Post.create({
        author: req.user._id,
        title,
        slug: await uniqueSlug(title, Post),
        content: { blocks: [] },
      })
      await post.populate('author', AUTHOR_FIELDS)
      res.status(201).json({ post: serializePost(post, { full: true }) })
    } catch (err) {
      next(err)
    }
  },
)

postsRouter.patch(
  '/:id',
  requireAuth,
  requireNotBanned,
  loadPostForWrite,
  validate(updatePostSchema),
  async (req, res, next) => {
    try {
      const { post } = req
      const { title, excerpt, coverImageUrl, content, tags } = req.body

      // The slug is deliberately never recomputed — published links are permanent.
      if (title !== undefined) post.title = title
      if (coverImageUrl !== undefined) post.coverImageUrl = coverImageUrl
      if (tags !== undefined) post.tags = tags

      if (excerpt !== undefined) {
        post.excerpt = excerpt
        post.excerptManual = excerpt.trim().length > 0
      }

      if (content !== undefined) {
        assertValidContent(content)
        post.content = content
        // Mixed paths need an explicit dirty flag or mongoose skips the write.
        post.markModified('content')
        if (!post.excerptManual) post.excerpt = deriveExcerpt(content)
      }

      await post.save()
      await post.populate('author', AUTHOR_FIELDS)
      res.json({ post: serializePost(post, { full: true }) })
    } catch (err) {
      next(err)
    }
  },
)

postsRouter.post(
  '/:id/publish',
  requireAuth,
  requireNotBanned,
  loadPostForWrite,
  async (req, res, next) => {
    try {
      const { post } = req
      const fields = {}
      if (!post.title?.trim()) fields.title = 'Give your post a title before publishing'
      if (countTextLength(post.content) === 0) fields.content = 'Write something before publishing'
      if (Object.keys(fields).length) {
        throw validationError('This post is not ready to publish', fields)
      }

      post.status = 'published'
      post.publishedAt = post.publishedAt ?? new Date()
      await post.save()
      await post.populate('author', AUTHOR_FIELDS)
      res.json({ post: serializePost(post, { full: true }) })
    } catch (err) {
      next(err)
    }
  },
)

postsRouter.post('/:id/unpublish', requireAuth, loadPostForWrite, async (req, res, next) => {
  try {
    req.post.status = 'draft'
    await req.post.save()
    await req.post.populate('author', AUTHOR_FIELDS)
    res.json({ post: serializePost(req.post, { full: true }) })
  } catch (err) {
    next(err)
  }
})

postsRouter.delete('/:id', requireAuth, loadPostForWrite, async (req, res, next) => {
  try {
    await req.post.deleteOne()
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})
```

Note: `unpublish` and `delete` deliberately omit `requireNotBanned`. A banned user must still be able to take their own content down.

`server/src/routes/mePosts.js`:

```js
import { Router } from 'express'
import { Post } from '../models/Post.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { serializePost, AUTHOR_FIELDS } from '../lib/serializePost.js'

export const mePostsRouter = Router()

mePostsRouter.get('/posts', requireAuth, async (req, res, next) => {
  try {
    const posts = await Post.find({ author: req.user._id })
      .sort({ updatedAt: -1 })
      .populate('author', AUTHOR_FIELDS)
    res.json({ posts: posts.map((post) => serializePost(post)) })
  } catch (err) {
    next(err)
  }
})
```

Mount both in `server/src/app.js` at the route mount point, above the catch-all:

```js
import { postsRouter } from './routes/posts.js'
import { mePostsRouter } from './routes/mePosts.js'
// ...
  app.use('/api/posts', postsRouter)
  app.use('/api/me', mePostsRouter)
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -w server`
Expected: PASS, all suites. If a request to `/api/me/posts` returns a post lookup error, confirm nothing was mounted at `/api/posts/mine` — that collision with `:slug` is exactly why the endpoint lives under `/api/me`.

- [ ] **Step 7: Commit**

```bash
git add server/src server/tests
git commit -m "feat: add post crud with ownership guard, publishing and feed filters"
```

---

## Task 6: Image uploads

**Files:**
- Create: `server/src/lib/cloudinary.js`, `server/src/routes/uploads.js`
- Modify: `server/src/app.js` (mount `/api/uploads`)
- Test: `server/tests/uploads.test.js`

**Interfaces:**
- Consumes: `requireAuth`, `requireNotBanned`, `uploadLimiter`, `validationError`.
- Produces: `uploadBuffer(buffer, folder?): Promise<{ url, width, height }>` and `POST /api/uploads/image` (multipart, field name `file`) → 201 `{ url, width, height }`.

- [ ] **Step 1: Write the failing test**

Cloudinary is mocked. What matters here is the *validation gate* — hitting a real cloud in unit tests would be slow, flaky, and would cost money.

`server/tests/uploads.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'

vi.mock('../src/lib/cloudinary.js', () => ({
  uploadBuffer: vi.fn(async () => ({
    url: 'https://res.cloudinary.com/demo/image/upload/v1/test.png',
    width: 800,
    height: 600,
  })),
}))

const { uploadBuffer } = await import('../src/lib/cloudinary.js')

// A real 1x1 PNG, so the magic-byte sniff accepts it.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
)

const app = () => createApp()

async function agentWithAccount() {
  const agent = request.agent(app())
  const suffix = Math.random().toString(36).slice(2, 8)
  await agent.post('/api/auth/signup').send({
    username: `up${suffix}`,
    email: `up${suffix}@example.com`,
    password: 'password123',
  })
  return agent
}

beforeEach(() => {
  uploadBuffer.mockClear()
})

describe('POST /api/uploads/image', () => {
  it('rejects an anonymous upload', async () => {
    const res = await request(app())
      .post('/api/uploads/image')
      .attach('file', PNG, { filename: 'a.png', contentType: 'image/png' })
    expect(res.status).toBe(401)
    expect(uploadBuffer).not.toHaveBeenCalled()
  })

  it('accepts a real png from a signed-in user', async () => {
    const agent = await agentWithAccount()
    const res = await agent
      .post('/api/uploads/image')
      .attach('file', PNG, { filename: 'a.png', contentType: 'image/png' })
    expect(res.status).toBe(201)
    expect(res.body.url).toContain('cloudinary')
    expect(uploadBuffer).toHaveBeenCalledOnce()
  })

  it('rejects a non-image mime type', async () => {
    const agent = await agentWithAccount()
    const res = await agent
      .post('/api/uploads/image')
      .attach('file', Buffer.from('#!/bin/sh\necho hi'), {
        filename: 'x.sh',
        contentType: 'application/x-sh',
      })
    expect(res.status).toBe(422)
    expect(uploadBuffer).not.toHaveBeenCalled()
  })

  it('rejects a file whose bytes contradict its declared image mime type', async () => {
    const agent = await agentWithAccount()
    const res = await agent
      .post('/api/uploads/image')
      .attach('file', Buffer.from('<?php system($_GET[0]); ?>'), {
        filename: 'shell.png',
        contentType: 'image/png',
      })
    expect(res.status).toBe(422)
    expect(res.body.error.message).toMatch(/image/i)
    expect(uploadBuffer).not.toHaveBeenCalled()
  })

  it('rejects a file over 5 MB', async () => {
    const agent = await agentWithAccount()
    const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 + 1024)])
    const res = await agent
      .post('/api/uploads/image')
      .attach('file', big, { filename: 'big.png', contentType: 'image/png' })
    expect(res.status).toBe(422)
    expect(res.body.error.message).toMatch(/5 ?MB/i)
    expect(uploadBuffer).not.toHaveBeenCalled()
  })

  it('rejects a request with no file attached', async () => {
    const agent = await agentWithAccount()
    const res = await agent.post('/api/uploads/image')
    expect(res.status).toBe(422)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/uploads.test.js` from `server/`
Expected: FAIL — the route does not exist, so every case 404s.

- [ ] **Step 3: Implement the Cloudinary wrapper**

`server/src/lib/cloudinary.js`:

```js
import { v2 as cloudinary } from 'cloudinary'

let configured = false

function configure() {
  if (configured) return
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  })
  configured = true
}

export function uploadBuffer(buffer, folder = 'blog') {
  configure()
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        // Cap stored dimensions so a 6000px phone photo does not become the
        // asset every reader has to download.
        transformation: [{ width: 2000, height: 2000, crop: 'limit', quality: 'auto:good' }],
      },
      (err, result) =>
        err
          ? reject(err)
          : resolve({ url: result.secure_url, width: result.width, height: result.height }),
    )
    stream.end(buffer)
  })
}
```

- [ ] **Step 4: Implement the upload route**

`server/src/routes/uploads.js`:

```js
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
```

Mount in `server/src/app.js`:

```js
import { uploadsRouter } from './routes/uploads.js'
// ...
  app.use('/api/uploads', uploadsRouter)
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -w server`
Expected: PASS. If the oversize case returns 400 instead of 422, the multer error is escaping to Express's own handler — check that the wrapper passes `LIMIT_FILE_SIZE` to `next()` as a `validationError`.

- [ ] **Step 6: Commit**

```bash
git add server/src server/tests
git commit -m "feat: add validated image upload to cloudinary"
```

---

## Task 7: Public profiles and admin moderation

**Files:**
- Create: `server/src/schemas/users.js`, `server/src/routes/users.js`, `server/src/routes/admin.js`
- Modify: `server/src/app.js` (mount `/api/users`, `/api/admin`), `server/src/routes/mePosts.js` (add `PATCH /api/me`)
- Test: `server/tests/users.test.js`, `server/tests/admin.test.js`

**Interfaces:**
- Consumes: everything prior.
- Produces:
  - `GET /api/users/:username` → `{ user, posts }`, published posts only.
  - `PATCH /api/me` → `{ user }`; accepts `displayName`, `bio`, `avatarUrl` and silently drops everything else.
  - `GET /api/admin/posts?status=&page=&limit=` → `{ posts, page, pages, total }`, any status.
  - `POST /api/admin/users/:id/ban` and `POST /api/admin/users/:id/unban` → `{ user }`.

- [ ] **Step 1: Write the failing profile test**

`server/tests/users.test.js`:

```js
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { makeUser, makePost } from './factories.js'

const app = () => createApp()

async function signedUpAgent(username = 'edith') {
  const agent = request.agent(app())
  await agent.post('/api/auth/signup').send({
    username,
    email: `${username}@example.com`,
    password: 'password123',
  })
  return agent
}

describe('GET /api/users/:username', () => {
  it('returns a public profile with published posts only', async () => {
    const author = await makeUser({ username: 'ada', bio: 'writes things' })
    await makePost({ author, slug: 'live', status: 'published', publishedAt: new Date() })
    await makePost({ author, slug: 'draft' })

    const res = await request(app()).get('/api/users/ada')
    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ username: 'ada', bio: 'writes things' })
    expect(res.body.user).not.toHaveProperty('email')
    expect(res.body.posts.map((p) => p.slug)).toEqual(['live'])
  })

  it('is case-insensitive', async () => {
    await makeUser({ username: 'ada' })
    const res = await request(app()).get('/api/users/ADA')
    expect(res.status).toBe(200)
  })

  it('404s for an unknown username', async () => {
    const res = await request(app()).get('/api/users/nobody')
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/me', () => {
  it('requires authentication', async () => {
    const res = await request(app()).patch('/api/me').send({ bio: 'hi' })
    expect(res.status).toBe(401)
  })

  it('updates display name and bio', async () => {
    const agent = await signedUpAgent()
    const res = await agent.patch('/api/me').send({ displayName: 'Edith W', bio: 'Essayist' })
    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ displayName: 'Edith W', bio: 'Essayist' })
  })

  it('rejects a bio over 280 characters', async () => {
    const agent = await signedUpAgent()
    const res = await agent.patch('/api/me').send({ bio: 'x'.repeat(281) })
    expect(res.status).toBe(422)
    expect(res.body.error.fields).toHaveProperty('bio')
  })

  it('cannot be used to grant itself the admin role', async () => {
    const agent = await signedUpAgent('sneaky')
    await agent.patch('/api/me').send({ role: 'admin', bio: 'hello' })
    const me = await agent.get('/api/auth/me')
    // Unknown keys are stripped by the schema, so `role` never reaches the model.
    expect(me.body.user.role).toBe('user')
  })
})
```

- [ ] **Step 2: Write the failing admin test**

`server/tests/admin.test.js`:

```js
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { User } from '../src/models/User.js'
import { Post } from '../src/models/Post.js'
import { makeUser, makePost } from './factories.js'

const app = () => createApp()

async function agentFor({ role = 'user' } = {}) {
  const agent = request.agent(app())
  const suffix = Math.random().toString(36).slice(2, 8)
  const res = await agent.post('/api/auth/signup').send({
    username: `a${suffix}`,
    email: `a${suffix}@example.com`,
    password: 'password123',
  })
  const user = await User.findOne({ username: res.body.user.username })
  if (role === 'admin') await User.findByIdAndUpdate(user._id, { role: 'admin' })
  return { agent, user }
}

describe('GET /api/admin/posts', () => {
  it('401s for an anonymous request', async () => {
    const res = await request(app()).get('/api/admin/posts')
    expect(res.status).toBe(401)
  })

  it('403s for a normal user', async () => {
    const { agent } = await agentFor()
    const res = await agent.get('/api/admin/posts')
    expect(res.status).toBe(403)
  })

  it('lists posts of every status for an admin', async () => {
    const author = await makeUser()
    await makePost({ author, slug: 'a-draft' })
    await makePost({ author, slug: 'a-live', status: 'published', publishedAt: new Date() })
    const { agent } = await agentFor({ role: 'admin' })
    const res = await agent.get('/api/admin/posts')
    expect(res.status).toBe(200)
    expect(res.body.posts.map((p) => p.slug).sort()).toEqual(['a-draft', 'a-live'])
  })

  it('filters by status', async () => {
    const author = await makeUser()
    await makePost({ author, slug: 'a-draft' })
    await makePost({ author, slug: 'a-live', status: 'published', publishedAt: new Date() })
    const { agent } = await agentFor({ role: 'admin' })
    const res = await agent.get('/api/admin/posts?status=published')
    expect(res.body.posts.map((p) => p.slug)).toEqual(['a-live'])
  })
})

describe('admin takedown', () => {
  it('unpublishes without destroying the post', async () => {
    const author = await makeUser()
    const post = await makePost({
      author,
      slug: 'spam',
      status: 'published',
      publishedAt: new Date(),
    })
    const { agent } = await agentFor({ role: 'admin' })

    const res = await agent.post(`/api/posts/${post._id}/unpublish`)
    expect(res.status).toBe(200)
    expect(res.body.post.status).toBe('draft')
    expect(await Post.exists({ _id: post._id })).toBeTruthy()
  })
})

describe('banning', () => {
  it('403s for a normal user', async () => {
    const { agent } = await agentFor()
    const victim = await makeUser()
    const res = await agent.post(`/api/admin/users/${victim._id}/ban`)
    expect(res.status).toBe(403)
  })

  it('bans and unbans', async () => {
    const { agent } = await agentFor({ role: 'admin' })
    const victim = await makeUser()

    const banned = await agent.post(`/api/admin/users/${victim._id}/ban`)
    expect(banned.status).toBe(200)
    expect((await User.findById(victim._id)).isBanned).toBe(true)

    const unbanned = await agent.post(`/api/admin/users/${victim._id}/unban`)
    expect(unbanned.status).toBe(200)
    expect((await User.findById(victim._id)).isBanned).toBe(false)
  })

  it('refuses to ban another admin', async () => {
    const { agent } = await agentFor({ role: 'admin' })
    const other = await makeUser({ role: 'admin' })
    const res = await agent.post(`/api/admin/users/${other._id}/ban`)
    expect(res.status).toBe(403)
  })
})

describe('a banned user', () => {
  it('can still read, cannot create or edit, but can unpublish their own post', async () => {
    const { agent, user } = await agentFor()
    const created = await agent.post('/api/posts').send({ title: 'Before The Ban' })
    expect(created.status).toBe(201)

    await User.findByIdAndUpdate(user._id, { isBanned: true })

    const read = await agent.get('/api/posts')
    expect(read.status).toBe(200)

    const write = await agent.post('/api/posts').send({ title: 'After The Ban' })
    expect(write.status).toBe(403)
    expect(write.body.error.code).toBe('BANNED')

    const edit = await agent
      .patch(`/api/posts/${created.body.post.id}`)
      .send({ title: 'Still Banned' })
    expect(edit.status).toBe(403)

    // Taking your own content down is always allowed.
    const takedown = await agent.post(`/api/posts/${created.body.post.id}/unpublish`)
    expect(takedown.status).toBe(200)
  })
})
```

- [ ] **Step 3: Run both to verify they fail**

Run: `npx vitest run tests/users.test.js tests/admin.test.js` from `server/`
Expected: FAIL — the new routes are unmounted, so requests 404.

- [ ] **Step 4: Implement profiles and profile editing**

`server/src/schemas/users.js`:

```js
import { z } from 'zod'

// Zod strips unknown keys by default, which is precisely what makes `role`
// unreachable through this endpoint.
export const updateMeSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, 'Cannot be empty')
      .max(60, 'At most 60 characters')
      .optional(),
    bio: z.string().trim().max(280, 'At most 280 characters').optional(),
    avatarUrl: z.string().url('Must be a url').nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' })

export const usernameParamSchema = z.object({
  username: z.string().trim().toLowerCase().min(3).max(20),
})
```

`server/src/routes/users.js`:

```js
import { Router } from 'express'
import { User } from '../models/User.js'
import { Post } from '../models/Post.js'
import { validate } from '../middleware/validate.js'
import { sanitizeUser } from '../lib/sanitizeUser.js'
import { serializePost, AUTHOR_FIELDS } from '../lib/serializePost.js'
import { usernameParamSchema } from '../schemas/users.js'
import { notFound } from '../lib/httpError.js'

export const usersRouter = Router()

usersRouter.get('/:username', validate(usernameParamSchema, 'params'), async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.params.username })
    if (!user) throw notFound('No such writer')

    const posts = await Post.find({ author: user._id, status: 'published' })
      .sort({ publishedAt: -1 })
      .populate('author', AUTHOR_FIELDS)

    res.json({
      user: sanitizeUser(user),
      posts: posts.map((post) => serializePost(post)),
    })
  } catch (err) {
    next(err)
  }
})
```

Add to `server/src/routes/mePosts.js` (extend the existing imports):

```js
import { validate } from '../middleware/validate.js'
import { sanitizeUser } from '../lib/sanitizeUser.js'
import { updateMeSchema } from '../schemas/users.js'

mePostsRouter.patch('/', requireAuth, validate(updateMeSchema), async (req, res, next) => {
  try {
    Object.assign(req.user, req.body)
    await req.user.save()
    res.json({ user: sanitizeUser(req.user) })
  } catch (err) {
    next(err)
  }
})
```

- [ ] **Step 5: Implement admin routes**

`server/src/routes/admin.js`:

```js
import { Router } from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'
import { Post } from '../models/Post.js'
import { User } from '../models/User.js'
import { validate } from '../middleware/validate.js'
import { requireAuth, requireAdmin } from '../middleware/requireAuth.js'
import { sanitizeUser } from '../lib/sanitizeUser.js'
import { serializePost, AUTHOR_FIELDS } from '../lib/serializePost.js'
import { notFound, forbidden } from '../lib/httpError.js'

const adminListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(['draft', 'published']).optional(),
})

export const adminRouter = Router()

// Applies to every route in this file — there is no unguarded admin endpoint.
adminRouter.use(requireAuth, requireAdmin)

adminRouter.get('/posts', validate(adminListSchema, 'query'), async (req, res, next) => {
  try {
    const { page, limit, status } = req.query
    const filter = status ? { status } : {}

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('author', AUTHOR_FIELDS),
      Post.countDocuments(filter),
    ])

    res.json({
      posts: posts.map((post) => serializePost(post)),
      page,
      pages: Math.ceil(total / limit),
      total,
    })
  } catch (err) {
    next(err)
  }
})

const setBanned = (isBanned) => async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) throw notFound('No such user')

    const user = await User.findById(id)
    if (!user) throw notFound('No such user')
    // Admins are not bannable, otherwise the owner can be locked out of the site.
    if (user.role === 'admin') throw forbidden('Admins cannot be banned')

    user.isBanned = isBanned
    await user.save()
    res.json({ user: sanitizeUser(user) })
  } catch (err) {
    next(err)
  }
}

adminRouter.post('/users/:id/ban', setBanned(true))
adminRouter.post('/users/:id/unban', setBanned(false))
```

Mount both in `server/src/app.js`:

```js
import { usersRouter } from './routes/users.js'
import { adminRouter } from './routes/admin.js'
// ...
  app.use('/api/users', usersRouter)
  app.use('/api/admin', adminRouter)
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -w server`
Expected: PASS, all suites.

- [ ] **Step 7: Commit**

```bash
git add server/src server/tests
git commit -m "feat: add public profiles, profile editing and admin moderation"
```

---

## Task 8: Crawler meta route

**Files:**
- Create: `server/src/routes/meta.js`
- Modify: `server/src/app.js` (mount `/api/meta`)
- Test: `server/tests/meta.test.js`

**Interfaces:**
- Consumes: `Post`, `AUTHOR_FIELDS`.
- Produces: `GET /api/meta/post/:slug` → `text/html` with OG and Twitter tags. 404 for drafts and unknown slugs.

- [ ] **Step 1: Write the failing test**

`server/tests/meta.test.js`:

```js
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { makeUser, makePost } from './factories.js'

const app = () => createApp()

describe('GET /api/meta/post/:slug', () => {
  it('renders open graph tags for a published post', async () => {
    const author = await makeUser({ username: 'ada', displayName: 'Ada L' })
    await makePost({
      author,
      slug: 'on-engines',
      title: 'On Engines',
      excerpt: 'A short note about engines.',
      coverImageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/cover.png',
      status: 'published',
      publishedAt: new Date(),
    })

    const res = await request(app()).get('/api/meta/post/on-engines')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/html/)
    expect(res.text).toContain('<meta property="og:title" content="On Engines">')
    expect(res.text).toContain('A short note about engines.')
    expect(res.text).toContain('og:image')
    expect(res.text).toContain('twitter:card')
    expect(res.text).toContain('Ada L')
  })

  it('escapes html so meta tags cannot be broken out of', async () => {
    const author = await makeUser()
    await makePost({
      author,
      slug: 'xss',
      title: '"><script>alert(1)</script>',
      status: 'published',
      publishedAt: new Date(),
    })

    const res = await request(app()).get('/api/meta/post/xss')
    expect(res.text).not.toContain('<script>alert(1)</script>')
    expect(res.text).toContain('&lt;script&gt;')
  })

  it('404s for a draft', async () => {
    const author = await makeUser()
    await makePost({ author, slug: 'unfinished' })
    const res = await request(app()).get('/api/meta/post/unfinished')
    expect(res.status).toBe(404)
  })

  it('404s for an unknown slug', async () => {
    const res = await request(app()).get('/api/meta/post/nothing-here')
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/meta.test.js` from `server/`
Expected: FAIL — 404 with a JSON body instead of HTML.

- [ ] **Step 3: Implement the route**

`server/src/routes/meta.js`:

```js
import { Router } from 'express'
import { Post } from '../models/Post.js'
import { AUTHOR_FIELDS } from '../lib/serializePost.js'

// Every value interpolated below came from a user, so escaping is mandatory.
const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

export const metaRouter = Router()

metaRouter.get('/post/:slug', async (req, res, next) => {
  try {
    const clientOrigin = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173')
      .split(',')[0]
      .trim()

    const post = await Post.findOne({
      slug: req.params.slug,
      status: 'published',
    }).populate('author', AUTHOR_FIELDS)

    if (!post) {
      return res
        .status(404)
        .type('html')
        .send('<!doctype html><meta charset="utf-8"><title>Not found</title><p>No such post.</p>')
    }

    const canonical = escapeHtml(`${clientOrigin}/blog/${post.slug}`)
    const title = escapeHtml(post.title || 'Untitled')
    const description = escapeHtml(
      post.excerpt || `A post by ${post.author?.displayName ?? 'a writer'}`,
    )
    const author = escapeHtml(post.author?.displayName ?? post.author?.username ?? '')
    const image = post.coverImageUrl ? escapeHtml(post.coverImageUrl) : ''

    res.type('html').send(
      [
        '<!doctype html>',
        '<meta charset="utf-8">',
        `<title>${title}</title>`,
        `<link rel="canonical" href="${canonical}">`,
        `<meta name="description" content="${description}">`,
        `<meta name="author" content="${author}">`,
        '<meta property="og:type" content="article">',
        `<meta property="og:title" content="${title}">`,
        `<meta property="og:description" content="${description}">`,
        `<meta property="og:url" content="${canonical}">`,
        image ? `<meta property="og:image" content="${image}">` : '',
        `<meta property="article:published_time" content="${post.publishedAt?.toISOString() ?? ''}">`,
        `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`,
        `<meta name="twitter:title" content="${title}">`,
        `<meta name="twitter:description" content="${description}">`,
        image ? `<meta name="twitter:image" content="${image}">` : '',
        `<p>${title} — by ${author}. <a href="${canonical}">Read it</a>.</p>`,
      ]
        .filter(Boolean)
        .join('\n'),
    )
  } catch (err) {
    next(err)
  }
})
```

Mount in `server/src/app.js`:

```js
import { metaRouter } from './routes/meta.js'
// ...
  app.use('/api/meta', metaRouter)
```

- [ ] **Step 4: Run the whole suite to verify it passes**

Run: `npm test -w server`
Expected: PASS. The backend is now complete — every server-side spec requirement has a test behind it.

- [ ] **Step 5: Commit**

```bash
git add server/src server/tests
git commit -m "feat: serve open graph meta html for crawlers"
```

---

## Task 9: Client scaffold and design system

**Files:**
- Create: `client/package.json`, `client/vite.config.js`, `client/index.html`, `client/tests/setup.js`, `client/src/main.jsx`, `client/src/App.jsx`, `client/src/styles/index.css`, `client/src/components/ui/{Button,Card,Badge,Input,Textarea,Spinner,RotatingBadge,Toast,ErrorBoundary}.jsx`, `client/src/components/layout/{SiteHeader,SiteFooter,Shell}.jsx`
- Test: `client/src/components/ui/ui.test.jsx`, `client/src/components/layout/SiteHeader.test.jsx`

**Interfaces:**
- Consumes: nothing from the server.
- Produces:
  - `<Button variant="primary|ink|ghost|danger" size="sm|md|lg" as={Component} {...props} />` — renders a `<button>` unless `as` is given (used for `Link`).
  - `<Card as="div" className>` · `<Badge tone="mustard|ink">` · `<Input label error id>` · `<Textarea label error id>` · `<Spinner label>` · `<RotatingBadge text label onClick>`
  - `<ToastProvider>` + `useToast(): { show(message, tone?) }`
  - `<ErrorBoundary fallback?>`
  - `<SiteHeader user={user|null} onSignOut={fn} />` — presentational only; it takes the user as a prop and is wired to real auth in Task 10.
  - `<Shell>` — header, `<main>`, footer wrapper.

- [ ] **Step 1: Create the client manifest and install**

`client/package.json`:

```json
{
  "name": "client",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@blocknote/core": "^0.23.0",
    "@blocknote/mantine": "^0.23.0",
    "@blocknote/react": "^0.23.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.1.1"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^25.0.1",
    "tailwindcss": "^4.0.0",
    "vite": "^6.0.7",
    "vitest": "^2.1.8"
  }
}
```

Run from the repo root: `npm install`
Expected: succeeds. Confirm `workspaces` in the root `package.json` lists both `client` and `server`.

`client/vite.config.js`:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/setup.js'],
    css: false,
  },
})
```

`client/tests/setup.js`:

```js
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})
```

`client/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Parchment — write something worth reading</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Write the design tokens**

`client/src/styles/index.css`:

```css
@import 'tailwindcss';

@theme {
  --color-parchment: #efe9d5;
  --color-ink: #14110d;
  --color-mustard: #e8b833;
  --color-card: #faf6e9;
  --color-brick: #b4472f;

  --font-display: 'Archivo Black', system-ui, sans-serif;
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-serif: 'Source Serif 4', Georgia, serif;

  /* Hard offset shadow with zero blur — the defining move of the whole look. */
  --shadow-hard: 4px 4px 0 0 var(--color-ink);
  --shadow-hard-sm: 2px 2px 0 0 var(--color-ink);
  --shadow-hard-lg: 6px 6px 0 0 var(--color-ink);
}

html {
  background-color: var(--color-parchment);
  color: var(--color-ink);
}

body {
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

/* Display type earns its impact from size and tightness, not decoration. */
.display {
  font-family: var(--font-display);
  letter-spacing: -0.03em;
  line-height: 0.92;
  text-transform: none;
}

/* The reading column deliberately drops the brutalist outlines: heavy borders
   around 1500 words of body text fight the one job this page has. */
.prose-reading {
  font-family: var(--font-serif);
  font-size: 1.1875rem;
  line-height: 1.75;
  max-width: 68ch;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 3: Write the failing UI test**

`client/src/components/ui/ui.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button.jsx'
import { Card } from './Card.jsx'
import { Badge } from './Badge.jsx'
import { Input } from './Input.jsx'

describe('Button', () => {
  it('renders its label and fires onClick', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Publish</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not fire when disabled', async () => {
    const onClick = vi.fn()
    render(
      <Button onClick={onClick} disabled>
        Publish
      </Button>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders as another element when asked', () => {
    render(
      <Button as="a" href="/blog">
        Read
      </Button>,
    )
    expect(screen.getByRole('link', { name: 'Read' })).toHaveAttribute('href', '/blog')
  })

  it('marks the danger variant for assistive tech via its accessible name only', () => {
    render(<Button variant="danger">Delete post</Button>)
    expect(screen.getByRole('button', { name: 'Delete post' })).toBeInTheDocument()
  })
})

describe('Card', () => {
  it('renders children', () => {
    render(<Card>inside</Card>)
    expect(screen.getByText('inside')).toBeInTheDocument()
  })
})

describe('Badge', () => {
  it('renders its text', () => {
    render(<Badge>design</Badge>)
    expect(screen.getByText('design')).toBeInTheDocument()
  })
})

describe('Input', () => {
  it('associates its label with the field', () => {
    render(<Input id="email" label="Email" />)
    expect(screen.getByLabelText('Email')).toBeInstanceOf(HTMLInputElement)
  })

  it('shows an error and marks the field invalid', () => {
    render(<Input id="email" label="Email" error="Already registered" />)
    expect(screen.getByText('Already registered')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })
})
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npm test -w client`
Expected: FAIL — none of the component modules exist.

- [ ] **Step 5: Implement the primitives**

`client/src/components/ui/Button.jsx`:

```jsx
const VARIANTS = {
  primary: 'bg-mustard text-ink hover:bg-[#f0c445]',
  ink: 'bg-ink text-parchment hover:bg-[#241f19]',
  ghost: 'bg-transparent text-ink hover:bg-card',
  danger: 'bg-brick text-white hover:bg-[#c9522f]',
}

const SIZES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-base',
  lg: 'px-7 py-3.5 text-lg',
}

export function Button({
  as: Component = 'button',
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}) {
  return (
    <Component
      className={[
        'inline-flex items-center justify-center gap-2 rounded-full border-2 border-ink font-semibold',
        'shadow-[var(--shadow-hard-sm)] transition-transform',
        // The press moves the element onto its own shadow — a physical-feeling
        // interaction that costs one line of CSS.
        'hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      ].join(' ')}
      {...props}
    />
  )
}
```

`client/src/components/ui/Card.jsx`:

```jsx
export function Card({ as: Component = 'div', className = '', ...props }) {
  return (
    <Component
      className={`rounded-2xl border-2 border-ink bg-card shadow-[var(--shadow-hard)] ${className}`}
      {...props}
    />
  )
}
```

`client/src/components/ui/Badge.jsx`:

```jsx
const TONES = {
  mustard: 'bg-mustard text-ink',
  ink: 'bg-ink text-parchment',
}

export function Badge({ tone = 'mustard', className = '', ...props }) {
  return (
    <span
      className={`inline-block rounded-full border-2 border-ink px-3 py-0.5 text-xs font-semibold tracking-wide ${TONES[tone]} ${className}`}
      {...props}
    />
  )
}
```

`client/src/components/ui/Input.jsx`:

```jsx
export function Input({ id, label, error, className = '', ...props }) {
  const errorId = error ? `${id}-error` : undefined
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
      ) : null}
      <input
        id={id}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={errorId}
        className={[
          'rounded-xl border-2 border-ink bg-card px-3.5 py-2.5',
          'focus:outline-2 focus:outline-offset-1 focus:outline-ink',
          error ? 'border-brick' : '',
          className,
        ].join(' ')}
        {...props}
      />
      {error ? (
        <p id={errorId} className="text-sm font-medium text-brick">
          {error}
        </p>
      ) : null}
    </div>
  )
}
```

`client/src/components/ui/Textarea.jsx`:

```jsx
export function Textarea({ id, label, error, className = '', ...props }) {
  const errorId = error ? `${id}-error` : undefined
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
      ) : null}
      <textarea
        id={id}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={errorId}
        className={[
          'min-h-24 rounded-xl border-2 border-ink bg-card px-3.5 py-2.5',
          'focus:outline-2 focus:outline-offset-1 focus:outline-ink',
          error ? 'border-brick' : '',
          className,
        ].join(' ')}
        {...props}
      />
      {error ? (
        <p id={errorId} className="text-sm font-medium text-brick">
          {error}
        </p>
      ) : null}
    </div>
  )
}
```

`client/src/components/ui/Spinner.jsx`:

```jsx
export function Spinner({ label = 'Loading' }) {
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center gap-2 text-sm">
      <span className="size-4 animate-spin rounded-full border-2 border-ink border-t-transparent" />
      {label}
    </span>
  )
}
```

`client/src/components/ui/RotatingBadge.jsx`:

```jsx
// The circular rotating-text seal from the reference. Decorative ring, real
// button in the middle — so it is still operable by keyboard and screen reader.
export function RotatingBadge({ text, label, onClick, className = '' }) {
  const repeated = `${text} · `.repeat(2)

  return (
    <div className={`relative size-36 ${className}`}>
      <svg viewBox="0 0 200 200" className="size-full animate-[spin_18s_linear_infinite]" aria-hidden="true">
        <defs>
          <path id="rotating-badge-path" d="M100,100 m-74,0 a74,74 0 1,1 148,0 a74,74 0 1,1 -148,0" />
        </defs>
        <text fontSize="15" letterSpacing="1.5" fill="currentColor" fontWeight="600">
          <textPath href="#rotating-badge-path">{repeated}</textPath>
        </text>
      </svg>
      <button
        type="button"
        onClick={onClick}
        className="absolute inset-8 rounded-full border-2 border-ink bg-ink text-xs font-bold uppercase leading-tight text-parchment focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {label}
      </button>
    </div>
  )
}
```

`client/src/components/ui/Toast.jsx`:

```jsx
import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const show = useCallback((message, tone = 'ink') => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts((current) => [...current, { id, message, tone }])
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 5000)
  }, [])

  const value = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((toast) => (
          <p
            key={toast.id}
            className={[
              'pointer-events-auto max-w-md rounded-xl border-2 border-ink px-4 py-2.5 text-sm font-medium shadow-[var(--shadow-hard-sm)]',
              toast.tone === 'error' ? 'bg-brick text-white' : 'bg-card text-ink',
            ].join(' ')}
          >
            {toast.message}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  // A missing provider would silently swallow every error message, so fail loudly.
  if (!context) throw new Error('useToast must be used inside a ToastProvider')
  return context
}
```

`client/src/components/ui/ErrorBoundary.jsx`:

```jsx
import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[boundary]', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      this.props.fallback ?? (
        <div className="mx-auto max-w-lg p-8 text-center">
          <h1 className="display text-4xl">Something broke</h1>
          <p className="mt-3">
            This page hit an error. Reloading usually fixes it — your saved work is safe.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-full border-2 border-ink bg-mustard px-5 py-2.5 font-semibold shadow-[var(--shadow-hard-sm)]"
          >
            Reload the page
          </button>
        </div>
      )
    )
  }
}
```

- [ ] **Step 6: Write the failing header test**

`client/src/components/layout/SiteHeader.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SiteHeader } from './SiteHeader.jsx'

const renderHeader = (props) =>
  render(
    <MemoryRouter>
      <SiteHeader {...props} />
    </MemoryRouter>,
  )

describe('SiteHeader', () => {
  it('offers sign in and hides the dashboard when signed out', () => {
    renderHeader({ user: null })
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /dashboard/i })).not.toBeInTheDocument()
  })

  it('shows write and dashboard links when signed in', () => {
    renderHeader({ user: { username: 'ada', displayName: 'Ada', role: 'user' } })
    expect(screen.getByRole('link', { name: /write/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /sign in/i })).not.toBeInTheDocument()
  })

  it('shows the admin link only to admins', () => {
    renderHeader({ user: { username: 'ada', displayName: 'Ada', role: 'user' } })
    expect(screen.queryByRole('link', { name: /admin/i })).not.toBeInTheDocument()

    renderHeader({ user: { username: 'boss', displayName: 'Boss', role: 'admin' } })
    expect(screen.getByRole('link', { name: /admin/i })).toBeInTheDocument()
  })

  it('calls onSignOut', async () => {
    const onSignOut = vi.fn()
    renderHeader({ user: { username: 'ada', displayName: 'Ada', role: 'user' }, onSignOut })
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }))
    expect(onSignOut).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npm test -w client`
Expected: FAIL — `SiteHeader.jsx` does not exist.

- [ ] **Step 8: Implement the layout**

`client/src/components/layout/SiteHeader.jsx`:

```jsx
import { Link, NavLink } from 'react-router-dom'
import { Button } from '../ui/Button.jsx'

const navLinkClass = ({ isActive }) =>
  [
    'text-sm font-semibold uppercase tracking-wide underline-offset-8',
    isActive ? 'underline decoration-mustard decoration-4' : 'hover:underline',
  ].join(' ')

export function SiteHeader({ user, onSignOut }) {
  return (
    <header className="border-b-2 border-ink">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-4 px-5 py-4">
        <Link to="/" className="display text-2xl">
          Parchment
        </Link>

        <nav className="flex items-center gap-6" aria-label="Main">
          <NavLink to="/" className={navLinkClass} end>
            Home
          </NavLink>
          <NavLink to="/blog" className={navLinkClass}>
            Blog
          </NavLink>
          {user ? (
            <NavLink to="/dashboard" className={navLinkClass}>
              Dashboard
            </NavLink>
          ) : null}
          {user?.role === 'admin' ? (
            <NavLink to="/admin" className={navLinkClass}>
              Admin
            </NavLink>
          ) : null}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              <Button as={Link} to="/dashboard/new" size="sm">
                Write
              </Button>
              <Button variant="ghost" size="sm" onClick={onSignOut}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button as={Link} to="/signin" variant="ghost" size="sm">
                Sign in
              </Button>
              <Button as={Link} to="/signup" size="sm">
                Start writing
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
```

`client/src/components/layout/SiteFooter.jsx`:

```jsx
import { Link } from 'react-router-dom'

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t-2 border-ink">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm">
        <p className="font-semibold">Parchment — anyone can write here.</p>
        <nav className="flex gap-5" aria-label="Footer">
          <Link to="/blog" className="hover:underline">
            All posts
          </Link>
          <Link to="/signup" className="hover:underline">
            Create an account
          </Link>
        </nav>
      </div>
    </footer>
  )
}
```

`client/src/components/layout/Shell.jsx`:

```jsx
export function Shell({ header, children }) {
  return (
    <div className="flex min-h-dvh flex-col">
      {header}
      <main className="flex-1">{children}</main>
    </div>
  )
}
```

- [ ] **Step 9: Create a temporary entry point so the dev server runs**

`client/src/main.jsx`:

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import { App } from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

`client/src/App.jsx` — a placeholder replaced by real routing in Task 14:

```jsx
import { BrowserRouter } from 'react-router-dom'
import { SiteHeader } from './components/layout/SiteHeader.jsx'
import { SiteFooter } from './components/layout/SiteFooter.jsx'
import { Shell } from './components/layout/Shell.jsx'
import { Card } from './components/ui/Card.jsx'

export function App() {
  return (
    <BrowserRouter>
      <Shell header={<SiteHeader user={null} />}>
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h1 className="display text-6xl">Design system online</h1>
          <Card className="mt-8 p-6">Routing arrives in Task 14.</Card>
        </div>
      </Shell>
      <SiteFooter />
    </BrowserRouter>
  )
}
```

- [ ] **Step 10: Run the tests and the dev server**

Run: `npm test -w client`
Expected: PASS, all UI and header tests.

Run: `npm run dev -w client` and open `http://localhost:5173`
Expected: parchment background, heavy display heading, an outlined card with a hard offset shadow. Stop the server afterwards.

- [ ] **Step 11: Commit**

```bash
git add client package.json package-lock.json
git commit -m "feat: scaffold react client with parchment design system"
```

---

## Task 10: Client auth — api wrapper, session context, sign-in and sign-up

**Files:**
- Create: `client/src/lib/api.js`, `client/src/lib/useAuth.jsx`, `client/src/components/RequireAuth.jsx`, `client/src/pages/SignIn.jsx`, `client/src/pages/SignUp.jsx`
- Test: `client/src/lib/api.test.js`, `client/src/lib/useAuth.test.jsx`, `client/src/components/RequireAuth.test.jsx`, `client/src/pages/SignIn.test.jsx`

**Interfaces:**
- Consumes: `Button`, `Input`, `Card`, `Spinner`, `useToast`.
- Produces:
  - `api.get/post/patch/del(path, body?): Promise<any>` — always `credentials: 'include'`; throws `ApiError` on non-2xx.
  - `class ApiError extends Error { status, code, fields }`
  - `uploadImage(file): Promise<{ url, width, height }>`
  - `<AuthProvider>` + `useAuth(): { user, loading, signIn, signUp, signOut, refresh, updateUser }`
  - `<RequireAuth adminOnly?>` — a route wrapper that redirects to `/signin` carrying the attempted location in router state.
  - `SignIn`, `SignUp` pages that return the visitor to wherever they were headed.

- [ ] **Step 1: Write the failing api test**

`client/src/lib/api.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { api, ApiError } from './api.js'

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('api', () => {
  it('sends credentials so the auth cookie travels cross-origin', async () => {
    fetch.mockResolvedValue(jsonResponse({ ok: true }))
    await api.get('/api/health')
    const [, options] = fetch.mock.calls[0]
    expect(options.credentials).toBe('include')
  })

  it('serialises a json body and sets the content type', async () => {
    fetch.mockResolvedValue(jsonResponse({ ok: true }))
    await api.post('/api/auth/login', { email: 'a@b.co', password: 'x' })
    const [, options] = fetch.mock.calls[0]
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(options.body)).toEqual({ email: 'a@b.co', password: 'x' })
  })

  it('returns the parsed body on success', async () => {
    fetch.mockResolvedValue(jsonResponse({ user: { username: 'ada' } }))
    await expect(api.get('/api/auth/me')).resolves.toEqual({ user: { username: 'ada' } })
  })

  it('throws an ApiError carrying status, code and fields', async () => {
    fetch.mockResolvedValue(
      jsonResponse(
        { error: { code: 'VALIDATION', message: 'Check the fields', fields: { email: 'Taken' } } },
        422,
      ),
    )

    await expect(api.post('/api/auth/signup', {})).rejects.toMatchObject({
      status: 422,
      code: 'VALIDATION',
      message: 'Check the fields',
      fields: { email: 'Taken' },
    })
  })

  it('throws a usable ApiError when the response is not json', async () => {
    fetch.mockResolvedValue(new Response('<html>502</html>', { status: 502 }))
    const error = await api.get('/api/posts').catch((err) => err)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(502)
    expect(error.message).toMatch(/unexpected|wrong/i)
  })

  it('throws a network ApiError when fetch itself rejects', async () => {
    fetch.mockRejectedValue(new TypeError('Failed to fetch'))
    const error = await api.get('/api/posts').catch((err) => err)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('NETWORK')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -w client`
Expected: FAIL — `./api.js` does not exist.

- [ ] **Step 3: Implement the api wrapper**

`client/src/lib/api.js`:

```js
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
```

- [ ] **Step 4: Write the failing auth-context and guard tests**

`client/src/lib/useAuth.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from './useAuth.jsx'

function Probe() {
  const { user, loading, signOut } = useAuth()
  if (loading) return <p>loading</p>
  return (
    <div>
      <p>{user ? `signed in as ${user.username}` : 'signed out'}</p>
      <button type="button" onClick={signOut}>
        sign out
      </button>
    </div>
  )
}

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AuthProvider', () => {
  it('resolves to signed out when /me returns 401', async () => {
    fetch.mockResolvedValue(jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'no' } }, 401))
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByText('signed out')).toBeInTheDocument())
  })

  it('exposes the current user when /me succeeds', async () => {
    fetch.mockResolvedValue(jsonResponse({ user: { username: 'ada', role: 'user' } }))
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByText('signed in as ada')).toBeInTheDocument())
  })

  it('clears the user on sign out', async () => {
    fetch.mockResolvedValue(jsonResponse({ user: { username: 'ada', role: 'user' } }))
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByText('signed in as ada')).toBeInTheDocument())

    fetch.mockResolvedValue(jsonResponse({ ok: true }))
    await userEvent.click(screen.getByRole('button', { name: 'sign out' }))
    await waitFor(() => expect(screen.getByText('signed out')).toBeInTheDocument())
  })
})
```

`client/src/components/RequireAuth.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { RequireAuth } from './RequireAuth.jsx'
import { AuthContext } from '../lib/useAuth.jsx'

function FakeSignIn() {
  const location = useLocation()
  return <p>sign in, came from {location.state?.from?.pathname ?? 'nowhere'}</p>
}

const renderAt = (path, auth) =>
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/signin" element={<FakeSignIn />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <p>dashboard</p>
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth adminOnly>
                <p>admin panel</p>
              </RequireAuth>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )

describe('RequireAuth', () => {
  it('waits while the session is still loading', () => {
    renderAt('/dashboard', { user: null, loading: true })
    expect(screen.queryByText('dashboard')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('redirects a signed-out visitor to sign in, remembering where they were going', () => {
    renderAt('/dashboard', { user: null, loading: false })
    expect(screen.getByText('sign in, came from /dashboard')).toBeInTheDocument()
  })

  it('renders the page for a signed-in user', () => {
    renderAt('/dashboard', { user: { username: 'ada', role: 'user' }, loading: false })
    expect(screen.getByText('dashboard')).toBeInTheDocument()
  })

  it('keeps a non-admin out of an admin route', () => {
    renderAt('/admin', { user: { username: 'ada', role: 'user' }, loading: false })
    expect(screen.queryByText('admin panel')).not.toBeInTheDocument()
  })

  it('lets an admin through', () => {
    renderAt('/admin', { user: { username: 'boss', role: 'admin' }, loading: false })
    expect(screen.getByText('admin panel')).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Run them to verify they fail**

Run: `npm test -w client`
Expected: FAIL — `useAuth.jsx` and `RequireAuth.jsx` do not exist.

- [ ] **Step 6: Implement the session context and the guard**

`client/src/lib/useAuth.jsx`:

```jsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './api.js'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const { user: current } = await api.get('/api/auth/me')
      setUser(current)
      return current
    } catch {
      // A 401 here is the normal signed-out case, not an error worth surfacing.
      setUser(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const signIn = useCallback(async (credentials) => {
    const { user: current } = await api.post('/api/auth/login', credentials)
    setUser(current)
    return current
  }, [])

  const signUp = useCallback(async (details) => {
    const { user: current } = await api.post('/api/auth/signup', details)
    setUser(current)
    return current
  }, [])

  const signOut = useCallback(async () => {
    try {
      await api.post('/api/auth/logout')
    } finally {
      // Clear locally even if the request failed — the user asked to leave.
      setUser(null)
    }
  }, [])

  const updateUser = useCallback((next) => setUser(next), [])

  const value = useMemo(
    () => ({ user, loading, signIn, signUp, signOut, refresh, updateUser }),
    [user, loading, signIn, signUp, signOut, refresh, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside an AuthProvider')
  return context
}
```

`client/src/components/RequireAuth.jsx`:

```jsx
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/useAuth.jsx'
import { Spinner } from './ui/Spinner.jsx'

export function RequireAuth({ children, adminOnly = false }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  // Redirecting before the session resolves would bounce signed-in users on reload.
  if (loading) {
    return (
      <div className="flex justify-center p-16">
        <Spinner label="Checking your session" />
      </div>
    )
  }

  if (!user) {
    // `from` is what lets sign-in return the visitor to the page they wanted.
    return <Navigate to="/signin" replace state={{ from: location }} />
  }

  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return children
}
```

- [ ] **Step 7: Write the failing sign-in page test**

`client/src/pages/SignIn.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SignIn } from './SignIn.jsx'
import { AuthContext } from '../lib/useAuth.jsx'
import { ToastProvider } from '../components/ui/Toast.jsx'
import { ApiError } from '../lib/api.js'

const renderSignIn = ({ signIn, from }) =>
  render(
    <AuthContext.Provider value={{ user: null, loading: false, signIn }}>
      <ToastProvider>
        <MemoryRouter initialEntries={[{ pathname: '/signin', state: from ? { from } : null }]}>
          <Routes>
            <Route path="/signin" element={<SignIn />} />
            <Route path="/dashboard" element={<p>dashboard</p>} />
            <Route path="/dashboard/new" element={<p>new post editor</p>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </AuthContext.Provider>,
  )

describe('SignIn', () => {
  it('signs in and lands on the dashboard by default', async () => {
    const signIn = vi.fn().mockResolvedValue({ username: 'ada' })
    renderSignIn({ signIn })

    await userEvent.type(screen.getByLabelText(/email/i), 'ada@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(signIn).toHaveBeenCalledWith({ email: 'ada@example.com', password: 'password123' })
    expect(await screen.findByText('dashboard')).toBeInTheDocument()
  })

  it('returns the visitor to the page they were trying to reach', async () => {
    const signIn = vi.fn().mockResolvedValue({ username: 'ada' })
    renderSignIn({ signIn, from: { pathname: '/dashboard/new' } })

    await userEvent.type(screen.getByLabelText(/email/i), 'ada@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText('new post editor')).toBeInTheDocument()
  })

  it('shows the server message for bad credentials', async () => {
    const signIn = vi.fn().mockRejectedValue(
      new ApiError({ status: 401, code: 'UNAUTHORIZED', message: 'Email or password is incorrect' }),
    )
    renderSignIn({ signIn })

    await userEvent.type(screen.getByLabelText(/email/i), 'ada@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText(/incorrect/i)).toBeInTheDocument()
  })

  it('shows per-field errors from a 422', async () => {
    const signIn = vi.fn().mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION',
        message: 'Please check the highlighted fields',
        fields: { email: 'That does not look like an email' },
      }),
    )
    renderSignIn({ signIn })

    await userEvent.type(screen.getByLabelText(/email/i), 'nope')
    await userEvent.type(screen.getByLabelText(/password/i), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText(/does not look like an email/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 8: Run it to verify it fails**

Run: `npm test -w client`
Expected: FAIL — `SignIn.jsx` does not exist.

- [ ] **Step 9: Implement the auth pages**

`client/src/pages/SignIn.jsx`:

```jsx
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/useAuth.jsx'
import { Card } from '../components/ui/Card.jsx'
import { Input } from '../components/ui/Input.jsx'
import { Button } from '../components/ui/Button.jsx'

export function SignIn() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const destination = location.state?.from?.pathname ?? '/dashboard'

  const [form, setForm] = useState({ email: '', password: '' })
  const [fields, setFields] = useState({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  async function onSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setFields({})
    setMessage('')
    try {
      await signIn(form)
      navigate(destination, { replace: true })
    } catch (error) {
      setFields(error.fields ?? {})
      // A 422 already annotates the fields, so only show the banner otherwise.
      if (!error.fields || Object.keys(error.fields).length === 0) {
        setMessage(error.message)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <h1 className="display text-5xl">Welcome back</h1>
      <Card className="mt-8 p-6">
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {message ? (
            <p role="alert" className="rounded-xl border-2 border-brick px-3 py-2 text-sm font-medium text-brick">
              {message}
            </p>
          ) : null}

          <Input
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={update('email')}
            error={fields.email}
          />
          <Input
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={update('password')}
            error={fields.password}
          />

          <Button type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Card>

      <p className="mt-5 text-sm">
        No account yet?{' '}
        <Link to="/signup" className="font-semibold underline decoration-mustard decoration-2">
          Create one
        </Link>
      </p>
    </div>
  )
}
```

`client/src/pages/SignUp.jsx`:

```jsx
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/useAuth.jsx'
import { Card } from '../components/ui/Card.jsx'
import { Input } from '../components/ui/Input.jsx'
import { Button } from '../components/ui/Button.jsx'

export function SignUp() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const destination = location.state?.from?.pathname ?? '/dashboard'

  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [fields, setFields] = useState({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  async function onSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setFields({})
    setMessage('')
    try {
      await signUp(form)
      navigate(destination, { replace: true })
    } catch (error) {
      setFields(error.fields ?? {})
      if (!error.fields || Object.keys(error.fields).length === 0) {
        setMessage(error.message)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <h1 className="display text-5xl">Start writing</h1>
      <p className="mt-3 text-sm">Anyone can publish here. Takes about a minute.</p>

      <Card className="mt-8 p-6">
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {message ? (
            <p role="alert" className="rounded-xl border-2 border-brick px-3 py-2 text-sm font-medium text-brick">
              {message}
            </p>
          ) : null}

          <Input
            id="username"
            label="Username"
            autoComplete="username"
            value={form.username}
            onChange={update('username')}
            error={fields.username}
          />
          <p className="-mt-2 text-xs">Your profile will live at /@{form.username || 'yourname'}</p>

          <Input
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={update('email')}
            error={fields.email}
          />
          <Input
            id="password"
            label="Password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={update('password')}
            error={fields.password}
          />

          <Button type="submit" disabled={busy}>
            {busy ? 'Creating your account…' : 'Create account'}
          </Button>
        </form>
      </Card>

      <p className="mt-5 text-sm">
        Already have an account?{' '}
        <Link to="/signin" className="font-semibold underline decoration-mustard decoration-2">
          Sign in
        </Link>
      </p>
    </div>
  )
}
```

- [ ] **Step 10: Run the tests to verify they pass**

Run: `npm test -w client`
Expected: PASS, all client suites.

- [ ] **Step 11: Commit**

```bash
git add client/src
git commit -m "feat: add api wrapper, session context and auth pages"
```

---

## Task 11: BlockRenderer

**Files:**
- Create: `client/src/lib/video.js`, `client/src/components/BlockRenderer.jsx`, `client/src/lib/formatDate.js`
- Test: `client/src/components/BlockRenderer.test.jsx`, `client/src/lib/video.parity.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `client/src/lib/video.js` — byte-identical copy of `server/src/lib/video.js`, exporting `parseVideoUrl` and `embedUrl`.
  - `<BlockRenderer content={{ blocks: [] }} />` — renders block JSON to markup. The single renderer used by both the published post page and the editor preview.
  - `formatDate(value): string` — e.g. `30 July 2026`.

- [ ] **Step 1: Write the failing renderer test**

`client/src/components/BlockRenderer.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BlockRenderer } from './BlockRenderer.jsx'

const block = (type, props = {}, content = [], children = []) => ({
  id: Math.random().toString(36).slice(2),
  type,
  props,
  content,
  children,
})

const text = (value, styles = {}) => ({ type: 'text', text: value, styles })

describe('BlockRenderer', () => {
  it('renders paragraphs', () => {
    render(<BlockRenderer content={{ blocks: [block('paragraph', {}, [text('Hello there')])] }} />)
    expect(screen.getByText('Hello there')).toBeInTheDocument()
  })

  it('renders headings at the right level', () => {
    render(
      <BlockRenderer
        content={{
          blocks: [
            block('heading', { level: 1 }, [text('Top')]),
            block('heading', { level: 3 }, [text('Deeper')]),
          ],
        }}
      />,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Top' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 4, name: 'Deeper' })).toBeInTheDocument()
  })

  it('renders inline styles and links', () => {
    render(
      <BlockRenderer
        content={{
          blocks: [
            block('paragraph', {}, [
              text('bold bit', { bold: true }),
              { type: 'link', href: 'https://example.com', content: [text('a source')] },
            ]),
          ],
        }}
      />,
    )
    expect(screen.getByText('bold bit').tagName).toBe('STRONG')
    const link = screen.getByRole('link', { name: 'a source' })
    expect(link).toHaveAttribute('href', 'https://example.com')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('drops a javascript: link href rather than rendering it', () => {
    render(
      <BlockRenderer
        content={{
          blocks: [
            block('paragraph', {}, [
              { type: 'link', href: 'javascript:alert(1)', content: [text('tap me')] },
            ]),
          ],
        }}
      />,
    )
    expect(screen.queryByRole('link', { name: 'tap me' })).not.toBeInTheDocument()
    expect(screen.getByText('tap me')).toBeInTheDocument()
  })

  it('renders lists', () => {
    render(
      <BlockRenderer
        content={{
          blocks: [
            block('bulletListItem', {}, [text('first')]),
            block('bulletListItem', {}, [text('second')]),
            block('numberedListItem', {}, [text('one')]),
          ],
        }}
      />,
    )
    expect(screen.getAllByRole('list')).toHaveLength(2)
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('renders an image with its alt text and caption', () => {
    render(
      <BlockRenderer
        content={{
          blocks: [
            block('image', {
              url: 'https://res.cloudinary.com/demo/x.png',
              caption: 'A quiet street',
              name: 'A quiet street at dusk',
            }),
          ],
        }}
      />,
    )
    expect(screen.getByRole('img', { name: 'A quiet street at dusk' })).toHaveAttribute(
      'src',
      'https://res.cloudinary.com/demo/x.png',
    )
    expect(screen.getByText('A quiet street')).toBeInTheDocument()
  })

  it('renders a youtube embed as a titled iframe', () => {
    render(
      <BlockRenderer
        content={{
          blocks: [block('videoEmbed', { url: 'https://youtu.be/dQw4w9WgXcQ', caption: 'The talk' })],
        }}
      />,
    )
    const frame = screen.getByTitle(/the talk/i)
    expect(frame.tagName).toBe('IFRAME')
    expect(frame).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
  })

  it('renders nothing for a video url outside the allowlist', () => {
    render(
      <BlockRenderer
        content={{ blocks: [block('videoEmbed', { url: 'https://evil.example.com/x' })] }}
      />,
    )
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('renders a references block as a numbered list of links', () => {
    render(
      <BlockRenderer
        content={{
          blocks: [
            block('references', {
              title: 'References',
              items: JSON.stringify([
                { label: 'The original paper', url: 'https://example.com/paper' },
                { label: 'Follow-up', url: 'https://example.org/follow' },
              ]),
            }),
          ],
        }}
      />,
    )
    expect(screen.getByText('References')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'The original paper' })).toHaveAttribute(
      'href',
      'https://example.com/paper',
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('skips a reference whose url is not http', () => {
    render(
      <BlockRenderer
        content={{
          blocks: [
            block('references', {
              items: JSON.stringify([
                { label: 'bad', url: 'javascript:alert(1)' },
                { label: 'good', url: 'https://example.com' },
              ]),
            }),
          ],
        }}
      />,
    )
    expect(screen.queryByText('bad')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'good' })).toBeInTheDocument()
  })

  it('renders quotes, code and dividers', () => {
    render(
      <BlockRenderer
        content={{
          blocks: [
            block('quote', {}, [text('Said something')]),
            block('codeBlock', { language: 'js' }, [text('const x = 1')]),
            block('divider'),
          ],
        }}
      />,
    )
    expect(screen.getByText('Said something')).toBeInTheDocument()
    expect(screen.getByText('const x = 1')).toBeInTheDocument()
    expect(document.querySelector('hr')).not.toBeNull()
  })

  it('renders an empty body without crashing', () => {
    render(<BlockRenderer content={{ blocks: [] }} />)
    render(<BlockRenderer content={undefined} />)
    expect(true).toBe(true)
  })

  it('ignores an unknown block type instead of crashing', () => {
    render(
      <BlockRenderer
        content={{
          blocks: [block('somethingFromTheFuture', {}, [text('x')]), block('paragraph', {}, [text('still here')])],
        }}
      />,
    )
    expect(screen.getByText('still here')).toBeInTheDocument()
  })
})
```

`client/src/lib/video.parity.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// The client and server must agree on what counts as an embeddable video.
// If this fails, one copy was edited without the other.
describe('video.js parity', () => {
  it('matches the server copy byte for byte', () => {
    const clientPath = fileURLToPath(new URL('./video.js', import.meta.url))
    const serverPath = fileURLToPath(new URL('../../../server/src/lib/video.js', import.meta.url))
    const normalise = (value) => readFileSync(value, 'utf8').replace(/\r\n/g, '\n').trim()
    expect(normalise(clientPath)).toBe(normalise(serverPath))
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -w client`
Expected: FAIL — `BlockRenderer.jsx` and `client/src/lib/video.js` do not exist.

- [ ] **Step 3: Copy the video library**

Run from the repo root:

```bash
cp server/src/lib/video.js client/src/lib/video.js
```

- [ ] **Step 4: Implement formatDate and the renderer**

`client/src/lib/formatDate.js`:

```js
export function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}
```

`client/src/components/BlockRenderer.jsx`:

```jsx
import { Fragment } from 'react'
import { parseVideoUrl, embedUrl } from '../lib/video.js'

// Only these schemes may appear in an href. Everything else is dropped, which
// is what stops a javascript: url stored in a post from ever being clickable.
const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:'])

const safeHref = (value) => {
  try {
    return SAFE_SCHEMES.has(new URL(value, 'https://example.com').protocol) ? value : null
  } catch {
    return null
  }
}

const parseItems = (raw) => {
  if (Array.isArray(raw)) return raw
  if (typeof raw !== 'string') return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function InlineText({ node }) {
  const { bold, italic, underline, strike, code } = node.styles ?? {}
  let element = <>{node.text}</>
  if (code) element = <code className="rounded bg-parchment px-1.5 py-0.5 text-[0.9em]">{element}</code>
  if (strike) element = <s>{element}</s>
  if (underline) element = <u>{element}</u>
  if (italic) element = <em>{element}</em>
  if (bold) element = <strong>{element}</strong>
  return element
}

function Inline({ nodes }) {
  return (
    <>
      {(nodes ?? []).map((node, index) => {
        if (node?.type === 'link') {
          const href = safeHref(node.href)
          const label = <Inline nodes={node.content} />
          return href ? (
            <a
              key={index}
              href={href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="font-medium underline decoration-mustard decoration-2 underline-offset-2"
            >
              {label}
            </a>
          ) : (
            <Fragment key={index}>{label}</Fragment>
          )
        }
        if (node?.type === 'text') return <InlineText key={index} node={node} />
        return null
      })}
    </>
  )
}

function Image({ props }) {
  const href = safeHref(props?.url)
  if (!href) return null
  return (
    <figure className="my-8">
      <img
        src={href}
        alt={props.name ?? props.caption ?? ''}
        className="w-full rounded-2xl border-2 border-ink"
        loading="lazy"
      />
      {props.caption ? (
        <figcaption className="mt-2 text-center text-sm italic">{props.caption}</figcaption>
      ) : null}
    </figure>
  )
}

function VideoEmbed({ props }) {
  const parsed = parseVideoUrl(props?.url)
  // An unrecognised provider renders nothing rather than an arbitrary iframe.
  if (!parsed) return null

  return (
    <figure className="my-8">
      <div className="aspect-video overflow-hidden rounded-2xl border-2 border-ink">
        <iframe
          src={embedUrl(parsed)}
          title={props.caption || 'Embedded video'}
          className="size-full"
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
      {props.caption ? (
        <figcaption className="mt-2 text-center text-sm italic">{props.caption}</figcaption>
      ) : null}
    </figure>
  )
}

function References({ props }) {
  const items = parseItems(props?.items).filter((item) => safeHref(item?.url))
  if (!items.length) return null

  return (
    <aside className="my-8 rounded-2xl border-2 border-ink bg-card p-5">
      <h2 className="text-sm font-bold uppercase tracking-widest">{props.title || 'References'}</h2>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm">
        {items.map((item, index) => (
          <li key={index}>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="underline decoration-mustard decoration-2 underline-offset-2"
            >
              {item.label || item.url}
            </a>
          </li>
        ))}
      </ol>
    </aside>
  )
}

function Block({ block }) {
  switch (block.type) {
    case 'paragraph':
      return (
        <p className="my-5">
          <Inline nodes={block.content} />
        </p>
      )

    // Post titles are the page's h1, so in-body headings start at h2.
    case 'heading': {
      const level = Math.min(Number(block.props?.level ?? 1) + 1, 6)
      const Tag = `h${level}`
      const size = level === 2 ? 'text-3xl' : level === 3 ? 'text-2xl' : 'text-xl'
      return (
        <Tag className={`display mt-10 mb-3 ${size}`}>
          <Inline nodes={block.content} />
        </Tag>
      )
    }

    case 'quote':
      return (
        <blockquote className="my-6 border-l-4 border-mustard pl-5 italic">
          <Inline nodes={block.content} />
        </blockquote>
      )

    case 'codeBlock':
      return (
        <pre className="my-6 overflow-x-auto rounded-2xl border-2 border-ink bg-ink p-4 text-sm text-parchment">
          <code>
            <Inline nodes={block.content} />
          </code>
        </pre>
      )

    case 'divider':
      return <hr className="my-10 border-t-2 border-ink" />

    case 'image':
      return <Image props={block.props ?? {}} />

    case 'videoEmbed':
      return <VideoEmbed props={block.props ?? {}} />

    case 'references':
      return <References props={block.props ?? {}} />

    default:
      // Forward compatibility: an unknown block is skipped, never fatal.
      return null
  }
}

const LIST_TYPES = { bulletListItem: 'ul', numberedListItem: 'ol', checkListItem: 'ul' }

// Consecutive list-item blocks are gathered into one real list element so the
// markup is valid and screen readers announce "list of 3 items".
function groupBlocks(blocks) {
  const groups = []
  for (const block of blocks) {
    const listTag = LIST_TYPES[block.type]
    const previous = groups.at(-1)
    if (listTag && previous?.tag === listTag) {
      previous.items.push(block)
    } else if (listTag) {
      groups.push({ tag: listTag, items: [block] })
    } else {
      groups.push({ block })
    }
  }
  return groups
}

export function BlockRenderer({ content }) {
  const blocks = Array.isArray(content?.blocks) ? content.blocks : []

  return (
    <>
      {groupBlocks(blocks).map((group, index) => {
        if (group.block) return <Block key={index} block={group.block} />

        const ListTag = group.tag
        return (
          <ListTag
            key={index}
            className={`my-5 space-y-1.5 pl-6 ${group.tag === 'ol' ? 'list-decimal' : 'list-disc'}`}
          >
            {group.items.map((item) => (
              <li key={item.id}>
                <Inline nodes={item.content} />
                {item.children?.length ? <BlockRenderer content={{ blocks: item.children }} /> : null}
              </li>
            ))}
          </ListTag>
        )
      })}
    </>
  )
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -w client`
Expected: PASS, including the parity test.

- [ ] **Step 6: Commit**

```bash
git add client/src
git commit -m "feat: add block renderer with url-safe links and video allowlist"
```

---

## Task 12: The editor — autosave, custom blocks, publish controls

**Files:**
- Create: `client/src/lib/useAutosave.js`, `client/src/components/TagInput.jsx`, `client/src/components/PostMetaBar.jsx`, `client/src/blocks/videoEmbed.jsx`, `client/src/blocks/references.jsx`, `client/src/blocks/schema.jsx`, `client/src/components/BlockEditor.jsx`, `client/src/pages/dashboard/Editor.jsx`
- Test: `client/src/lib/useAutosave.test.jsx`, `client/src/components/PostMetaBar.test.jsx`, `client/src/components/TagInput.test.jsx`

**Interfaces:**
- Consumes: `api`, `uploadImage`, `BlockRenderer`, `Button`, `Card`, `Input`, `useToast`, `parseVideoUrl`, `embedUrl`.
- Produces:
  - `useAutosave({ value, onSave, delay?, enabled? }): { status: 'idle'|'saving'|'saved'|'error', lastError, dirty, saveNow }`
  - `<TagInput value={string[]} onChange={fn} max={5} />`
  - `<PostMetaBar post onTitleChange onTagsChange onCoverChange onPublish onUnpublish onDelete saveStatus onRetry busy />`
  - `<BlockEditor initialContent onChange />` — the BlockNote instance, with image upload wired to Cloudinary.
  - `Editor` page at `/dashboard/new` and `/dashboard/posts/:id`.

**Testing note:** BlockNote mounts a full ProseMirror instance and is impractical to drive reliably in jsdom, so `BlockEditor` is deliberately a thin wrapper with no logic of its own and is verified by hand in Task 16. All the logic that could silently lose someone's writing — debouncing, retry, dirty tracking — lives in `useAutosave`, which is tested exhaustively here. That split is the point of the decomposition.

- [ ] **Step 1: Write the failing autosave test**

`client/src/lib/useAutosave.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { useAutosave } from './useAutosave.js'

function Harness({ onSave, initial = 'a' }) {
  const [value, setValue] = useState(initial)
  const { status, dirty, saveNow } = useAutosave({ value, onSave, delay: 1500 })
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="dirty">{String(dirty)}</p>
      <button type="button" onClick={() => setValue(`${value}!`)}>
        edit
      </button>
      <button type="button" onClick={saveNow}>
        save now
      </button>
    </div>
  )
}

const status = () => screen.getByTestId('status').textContent

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useAutosave', () => {
  it('does nothing until the value actually changes', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<Harness onSave={onSave} />)
    await act(async () => {
      vi.advanceTimersByTime(5000)
    })
    expect(onSave).not.toHaveBeenCalled()
    expect(status()).toBe('idle')
  })

  it('waits for the debounce delay before saving', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<Harness onSave={onSave} />)

    await act(async () => {
      screen.getByRole('button', { name: 'edit' }).click()
    })
    await act(async () => {
      vi.advanceTimersByTime(1400)
    })
    expect(onSave).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(200)
    })
    expect(onSave).toHaveBeenCalledOnce()
  })

  it('coalesces rapid edits into a single save of the latest value', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<Harness onSave={onSave} />)

    for (let i = 0; i < 4; i += 1) {
      await act(async () => {
        screen.getByRole('button', { name: 'edit' }).click()
        vi.advanceTimersByTime(300)
      })
    }
    await act(async () => {
      vi.advanceTimersByTime(1600)
    })

    expect(onSave).toHaveBeenCalledOnce()
    expect(onSave).toHaveBeenCalledWith('a!!!!')
  })

  it('moves through saving to saved', async () => {
    let resolveSave
    const onSave = vi.fn(() => new Promise((resolve) => {
      resolveSave = resolve
    }))
    render(<Harness onSave={onSave} />)

    await act(async () => {
      screen.getByRole('button', { name: 'edit' }).click()
      vi.advanceTimersByTime(1600)
    })
    expect(status()).toBe('saving')

    await act(async () => {
      resolveSave()
    })
    await waitFor(() => expect(status()).toBe('saved'))
    expect(screen.getByTestId('dirty').textContent).toBe('false')
  })

  it('reports an error and keeps the work dirty when saving fails', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('offline'))
    render(<Harness onSave={onSave} />)

    await act(async () => {
      screen.getByRole('button', { name: 'edit' }).click()
      vi.advanceTimersByTime(1600)
    })
    await waitFor(() => expect(status()).toBe('error'))
    // The unsaved edit must still be flagged, or the beforeunload guard is useless.
    expect(screen.getByTestId('dirty').textContent).toBe('true')
  })

  it('retries automatically after a failure', async () => {
    const onSave = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined)
    render(<Harness onSave={onSave} />)

    await act(async () => {
      screen.getByRole('button', { name: 'edit' }).click()
      vi.advanceTimersByTime(1600)
    })
    await waitFor(() => expect(status()).toBe('error'))

    await act(async () => {
      vi.advanceTimersByTime(5100)
    })
    await waitFor(() => expect(status()).toBe('saved'))
    expect(onSave).toHaveBeenCalledTimes(2)
  })

  it('saves immediately when asked', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<Harness onSave={onSave} />)

    await act(async () => {
      screen.getByRole('button', { name: 'edit' }).click()
    })
    await act(async () => {
      screen.getByRole('button', { name: 'save now' }).click()
    })
    expect(onSave).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -w client`
Expected: FAIL — `useAutosave.js` does not exist.

- [ ] **Step 3: Implement useAutosave**

`client/src/lib/useAutosave.js`:

```js
import { useCallback, useEffect, useRef, useState } from 'react'

const RETRY_AFTER_MS = 5000

// Silent data loss is treated as a defect, so this hook tracks three things
// separately: what the user has typed, what the server has acknowledged, and
// whether a save is currently in flight.
export function useAutosave({ value, onSave, delay = 1500, enabled = true }) {
  const [status, setStatus] = useState('idle')
  const [lastError, setLastError] = useState(null)
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(value))

  const latest = useRef(value)
  const acknowledged = useRef(JSON.stringify(value))
  const debounceTimer = useRef(null)
  const retryTimer = useRef(null)
  const inFlight = useRef(false)

  latest.current = value

  const flush = useCallback(async () => {
    const snapshot = JSON.stringify(latest.current)
    if (snapshot === acknowledged.current || inFlight.current) return

    inFlight.current = true
    setStatus('saving')
    try {
      await onSave(latest.current)
      acknowledged.current = snapshot
      setSavedSnapshot(snapshot)
      setStatus('saved')
      setLastError(null)
    } catch (error) {
      setStatus('error')
      setLastError(error)
      // One automatic retry; the visible Retry control covers everything after.
      clearTimeout(retryTimer.current)
      retryTimer.current = setTimeout(() => {
        flush()
      }, RETRY_AFTER_MS)
    } finally {
      inFlight.current = false
    }
  }, [onSave])

  useEffect(() => {
    if (!enabled) return undefined
    if (JSON.stringify(value) === acknowledged.current) return undefined

    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(flush, delay)
    return () => clearTimeout(debounceTimer.current)
  }, [value, delay, enabled, flush])

  useEffect(
    () => () => {
      clearTimeout(debounceTimer.current)
      clearTimeout(retryTimer.current)
    },
    [],
  )

  const dirty = JSON.stringify(value) !== savedSnapshot

  useEffect(() => {
    if (!dirty) return undefined
    const warn = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  return { status, lastError, dirty, saveNow: flush }
}
```

- [ ] **Step 4: Write the failing meta-bar and tag-input tests**

`client/src/components/TagInput.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TagInput } from './TagInput.jsx'

describe('TagInput', () => {
  it('adds a tag on Enter, lowercased', async () => {
    const onChange = vi.fn()
    render(<TagInput value={[]} onChange={onChange} />)
    await userEvent.type(screen.getByLabelText(/tags/i), 'Design{Enter}')
    expect(onChange).toHaveBeenCalledWith(['design'])
  })

  it('refuses a duplicate', async () => {
    const onChange = vi.fn()
    render(<TagInput value={['design']} onChange={onChange} />)
    await userEvent.type(screen.getByLabelText(/tags/i), 'design{Enter}')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('stops at five tags', async () => {
    const onChange = vi.fn()
    render(<TagInput value={['a', 'b', 'c', 'd', 'e']} onChange={onChange} />)
    await userEvent.type(screen.getByLabelText(/tags/i), 'f{Enter}')
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText(/5 of 5/i)).toBeInTheDocument()
  })

  it('removes a tag', async () => {
    const onChange = vi.fn()
    render(<TagInput value={['design', 'code']} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /remove design/i }))
    expect(onChange).toHaveBeenCalledWith(['code'])
  })
})
```

`client/src/components/PostMetaBar.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PostMetaBar } from './PostMetaBar.jsx'

const draft = { id: '1', title: 'A Draft', slug: 'a-draft', status: 'draft', tags: [], coverImageUrl: null }
const live = { ...draft, status: 'published', slug: 'a-draft' }

const noop = () => {}

const baseProps = {
  onTitleChange: noop,
  onTagsChange: noop,
  onCoverChange: noop,
  onPublish: noop,
  onUnpublish: noop,
  onDelete: noop,
  onRetry: noop,
  saveStatus: 'idle',
}

describe('PostMetaBar', () => {
  it('offers Publish for a draft', () => {
    render(<PostMetaBar {...baseProps} post={draft} />)
    expect(screen.getByRole('button', { name: /^publish$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /unpublish/i })).not.toBeInTheDocument()
  })

  it('offers Unpublish and a live link for a published post', () => {
    render(<PostMetaBar {...baseProps} post={live} />)
    expect(screen.getByRole('button', { name: /unpublish/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view live/i })).toHaveAttribute('href', '/blog/a-draft')
  })

  it('requires confirmation before deleting', async () => {
    const onDelete = vi.fn()
    render(<PostMetaBar {...baseProps} post={draft} onDelete={onDelete} />)

    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(onDelete).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: /delete permanently/i }))
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('shows the save state', () => {
    const { rerender } = render(<PostMetaBar {...baseProps} post={draft} saveStatus="saving" />)
    expect(screen.getByText(/saving/i)).toBeInTheDocument()

    rerender(<PostMetaBar {...baseProps} post={draft} saveStatus="saved" />)
    expect(screen.getByText(/saved/i)).toBeInTheDocument()
  })

  it('offers Retry when a save failed', async () => {
    const onRetry = vi.fn()
    render(<PostMetaBar {...baseProps} post={draft} saveStatus="error" onRetry={onRetry} />)

    expect(screen.getByRole('alert')).toHaveTextContent(/not saved/i)
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('reports the title up as it is typed', async () => {
    const onTitleChange = vi.fn()
    render(<PostMetaBar {...baseProps} post={{ ...draft, title: '' }} onTitleChange={onTitleChange} />)
    await userEvent.type(screen.getByLabelText(/title/i), 'H')
    expect(onTitleChange).toHaveBeenCalledWith('H')
  })
})
```

- [ ] **Step 5: Run them to verify they fail**

Run: `npm test -w client`
Expected: FAIL — neither component exists.

- [ ] **Step 6: Implement TagInput and PostMetaBar**

`client/src/components/TagInput.jsx`:

```jsx
import { useState } from 'react'
import { Badge } from './ui/Badge.jsx'

const clean = (raw) =>
  raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)

export function TagInput({ value = [], onChange, max = 5 }) {
  const [draft, setDraft] = useState('')

  function commit(event) {
    if (event.key !== 'Enter' && event.key !== ',') return
    event.preventDefault()

    const tag = clean(draft)
    setDraft('')
    if (!tag || value.includes(tag) || value.length >= max) return
    onChange([...value, tag])
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="tags" className="text-sm font-semibold">
        Tags <span className="font-normal">({value.length} of {max})</span>
      </label>

      {value.length ? (
        <ul className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <li key={tag}>
              <Badge>
                {tag}
                <button
                  type="button"
                  aria-label={`Remove ${tag}`}
                  onClick={() => onChange(value.filter((item) => item !== tag))}
                  className="ml-1.5 font-bold"
                >
                  ×
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}

      <input
        id="tags"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={commit}
        placeholder={value.length >= max ? 'Tag limit reached' : 'Type a tag and press Enter'}
        disabled={value.length >= max}
        className="rounded-xl border-2 border-ink bg-card px-3.5 py-2 disabled:opacity-60"
      />
    </div>
  )
}
```

`client/src/components/PostMetaBar.jsx`:

```jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from './ui/Button.jsx'
import { Card } from './ui/Card.jsx'
import { TagInput } from './TagInput.jsx'

function SaveState({ status, onRetry }) {
  if (status === 'saving') return <span className="text-sm">Saving…</span>
  if (status === 'saved') return <span className="text-sm">Saved</span>
  if (status === 'error') {
    return (
      <span role="alert" className="flex items-center gap-2 text-sm font-semibold text-brick">
        Not saved
        <Button variant="danger" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </span>
    )
  }
  return null
}

export function PostMetaBar({
  post,
  onTitleChange,
  onTagsChange,
  onCoverChange,
  onPublish,
  onUnpublish,
  onDelete,
  onRetry,
  saveStatus,
  busy = false,
}) {
  const [confirming, setConfirming] = useState(false)

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="title" className="text-sm font-semibold">
            Title
          </label>
          <input
            id="title"
            value={post.title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="Untitled"
            className="display rounded-xl border-2 border-ink bg-parchment px-4 py-3 text-3xl"
          />
        </div>

        <TagInput value={post.tags} onChange={onTagsChange} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cover" className="text-sm font-semibold">
            Cover image
          </label>
          <input
            id="cover"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onCoverChange(file)
            }}
            className="text-sm"
          />
          {post.coverImageUrl ? (
            <img
              src={post.coverImageUrl}
              alt="Cover"
              className="mt-2 h-32 w-full rounded-xl border-2 border-ink object-cover"
            />
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t-2 border-ink pt-4">
          <SaveState status={saveStatus} onRetry={onRetry} />

          <div className="ml-auto flex flex-wrap items-center gap-3">
            {post.status === 'published' ? (
              <>
                <Button as={Link} to={`/blog/${post.slug}`} variant="ghost" size="sm">
                  View live
                </Button>
                <Button variant="ghost" size="sm" onClick={onUnpublish} disabled={busy}>
                  Unpublish
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={onPublish} disabled={busy}>
                Publish
              </Button>
            )}

            {confirming ? (
              <>
                <Button variant="danger" size="sm" onClick={onDelete} disabled={busy}>
                  Delete permanently
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                  Keep it
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test -w client`
Expected: PASS.

- [ ] **Step 8: Implement the custom BlockNote blocks**

If the installed BlockNote version's `createReactBlockSpec` signature differs from below, check `node_modules/@blocknote/react/package.json` for the version and consult its docs — the surrounding structure stays the same either way.

`client/src/blocks/videoEmbed.jsx`:

```jsx
import { useState } from 'react'
import { createReactBlockSpec } from '@blocknote/react'
import { parseVideoUrl, embedUrl } from '../lib/video.js'

export const VideoEmbedBlock = createReactBlockSpec(
  {
    type: 'videoEmbed',
    propSchema: {
      url: { default: '' },
      caption: { default: '' },
    },
    content: 'none',
  },
  {
    render: ({ block, editor }) => {
      const parsed = parseVideoUrl(block.props.url)
      const [draft, setDraft] = useState(block.props.url)
      const [error, setError] = useState('')

      if (parsed) {
        return (
          <figure className="my-3 w-full">
            <div className="aspect-video overflow-hidden rounded-2xl border-2 border-ink">
              <iframe
                src={embedUrl(parsed)}
                title={block.props.caption || 'Embedded video'}
                className="size-full"
                allowFullScreen
              />
            </div>
            <input
              value={block.props.caption}
              onChange={(event) =>
                editor.updateBlock(block, { props: { caption: event.target.value } })
              }
              placeholder="Caption (optional)"
              className="mt-2 w-full bg-transparent text-center text-sm italic focus:outline-none"
            />
          </figure>
        )
      }

      return (
        <div className="my-3 rounded-2xl border-2 border-dashed border-ink p-4">
          <p className="text-sm font-semibold">Paste a YouTube or Vimeo link</p>
          <div className="mt-2 flex gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="https://youtu.be/…"
              className="flex-1 rounded-xl border-2 border-ink bg-card px-3 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                if (!parseVideoUrl(draft)) {
                  setError('Only YouTube and Vimeo links can be embedded')
                  return
                }
                setError('')
                editor.updateBlock(block, { props: { url: draft } })
              }}
              className="rounded-full border-2 border-ink bg-mustard px-4 py-1.5 text-sm font-semibold"
            >
              Embed
            </button>
          </div>
          {error ? <p className="mt-2 text-sm font-medium text-brick">{error}</p> : null}
        </div>
      )
    },
  },
)
```

`client/src/blocks/references.jsx`:

```jsx
import { createReactBlockSpec } from '@blocknote/react'

// Items live as a JSON string because BlockNote props must be primitives.
const parseItems = (raw) => {
  try {
    const parsed = JSON.parse(raw || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const ReferencesBlock = createReactBlockSpec(
  {
    type: 'references',
    propSchema: {
      title: { default: 'References' },
      items: { default: '[]' },
    },
    content: 'none',
  },
  {
    render: ({ block, editor }) => {
      const items = parseItems(block.props.items)

      const write = (next) =>
        editor.updateBlock(block, { props: { items: JSON.stringify(next) } })

      const update = (index, key, value) =>
        write(items.map((item, i) => (i === index ? { ...item, [key]: value } : item)))

      return (
        <aside className="my-3 w-full rounded-2xl border-2 border-ink bg-card p-4">
          <input
            value={block.props.title}
            onChange={(event) => editor.updateBlock(block, { props: { title: event.target.value } })}
            className="w-full bg-transparent text-sm font-bold uppercase tracking-widest focus:outline-none"
          />

          <ol className="mt-3 list-decimal space-y-2 pl-5">
            {items.map((item, index) => (
              <li key={index} className="flex flex-wrap gap-2">
                <input
                  value={item.label ?? ''}
                  onChange={(event) => update(index, 'label', event.target.value)}
                  placeholder="What is it called?"
                  className="min-w-40 flex-1 rounded-lg border-2 border-ink bg-parchment px-2 py-1 text-sm"
                />
                <input
                  value={item.url ?? ''}
                  onChange={(event) => update(index, 'url', event.target.value)}
                  placeholder="https://…"
                  className="min-w-40 flex-1 rounded-lg border-2 border-ink bg-parchment px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  aria-label={`Remove reference ${index + 1}`}
                  onClick={() => write(items.filter((_, i) => i !== index))}
                  className="px-2 font-bold"
                >
                  ×
                </button>
              </li>
            ))}
          </ol>

          <button
            type="button"
            onClick={() => write([...items, { label: '', url: '' }])}
            className="mt-3 rounded-full border-2 border-ink bg-mustard px-3 py-1 text-sm font-semibold"
          >
            Add a reference
          </button>
        </aside>
      )
    },
  },
)
```

`client/src/blocks/schema.jsx`:

```jsx
import { BlockNoteSchema, defaultBlockSpecs, insertOrUpdateBlock } from '@blocknote/core'
import { VideoEmbedBlock } from './videoEmbed.jsx'
import { ReferencesBlock } from './references.jsx'

export const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    videoEmbed: VideoEmbedBlock,
    references: ReferencesBlock,
  },
})

// Slash-menu entries, so both custom blocks are reachable the same way as the
// built-ins rather than needing a separate toolbar.
export const customSlashItems = (editor) => [
  {
    title: 'Video embed',
    subtext: 'Embed a YouTube or Vimeo video',
    aliases: ['video', 'youtube', 'vimeo', 'embed'],
    group: 'Media',
    onItemClick: () => insertOrUpdateBlock(editor, { type: 'videoEmbed' }),
  },
  {
    title: 'References',
    subtext: 'A numbered list of source links',
    aliases: ['reference', 'sources', 'links', 'citations'],
    group: 'Media',
    onItemClick: () => insertOrUpdateBlock(editor, { type: 'references' }),
  },
]
```

- [ ] **Step 9: Implement the BlockEditor wrapper**

`client/src/components/BlockEditor.jsx`:

```jsx
import { useCreateBlockNote, SuggestionMenuController, getDefaultReactSlashMenuItems } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import { filterSuggestionItems } from '@blocknote/core'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'
import { schema, customSlashItems } from '../blocks/schema.jsx'
import { uploadImage } from '../lib/api.js'

export function BlockEditor({ initialContent, onChange }) {
  const editor = useCreateBlockNote({
    schema,
    initialContent: initialContent?.length ? initialContent : undefined,
    // Dropping or pasting an image uploads it and stores the returned URL.
    uploadFile: async (file) => {
      const { url } = await uploadImage(file)
      return url
    },
  })

  return (
    <BlockNoteView
      editor={editor}
      theme="light"
      slashMenu={false}
      onChange={() => onChange({ blocks: editor.document })}
      className="rounded-2xl border-2 border-ink bg-card py-4"
    >
      <SuggestionMenuController
        triggerCharacter="/"
        getItems={async (query) =>
          filterSuggestionItems(
            [...getDefaultReactSlashMenuItems(editor), ...customSlashItems(editor)],
            query,
          )
        }
      />
    </BlockNoteView>
  )
}
```

- [ ] **Step 10: Implement the Editor page**

`client/src/pages/dashboard/Editor.jsx`:

```jsx
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, uploadImage } from '../../lib/api.js'
import { useAutosave } from '../../lib/useAutosave.js'
import { useToast } from '../../components/ui/Toast.jsx'
import { PostMetaBar } from '../../components/PostMetaBar.jsx'
import { BlockEditor } from '../../components/BlockEditor.jsx'
import { Spinner } from '../../components/ui/Spinner.jsx'

export function Editor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { show } = useToast()

  const [post, setPost] = useState(null)
  const [content, setContent] = useState({ blocks: [] })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  // A visit to /dashboard/new creates the draft immediately, so there is always
  // a real post id to autosave against — no "unsaved new post" state to lose.
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        if (id) {
          const { post: loaded } = await api.get(`/api/posts/by-id/${id}`)
          if (cancelled) return
          setPost(loaded)
          setContent(loaded.content ?? { blocks: [] })
        } else {
          const { post: created } = await api.post('/api/posts', {})
          if (cancelled) return
          navigate(`/dashboard/posts/${created.id}`, { replace: true })
          return
        }
      } catch (error) {
        show(error.message, 'error')
        navigate('/dashboard', { replace: true })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id, navigate, show])

  const saveDraft = useCallback(
    async (payload) => {
      const { post: saved } = await api.patch(`/api/posts/${id}`, payload)
      setPost((current) => ({ ...current, ...saved }))
    },
    [id],
  )

  const draftValue = post
    ? { title: post.title, tags: post.tags, coverImageUrl: post.coverImageUrl, content }
    : null

  const { status, dirty, saveNow } = useAutosave({
    value: draftValue,
    onSave: saveDraft,
    enabled: Boolean(post),
  })

  async function onPublish() {
    setBusy(true)
    try {
      await saveNow()
      const { post: published } = await api.post(`/api/posts/${id}/publish`)
      setPost(published)
      show('Published. Your post is live.')
    } catch (error) {
      const detail = Object.values(error.fields ?? {})[0]
      show(detail ?? error.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function onUnpublish() {
    setBusy(true)
    try {
      const { post: updated } = await api.post(`/api/posts/${id}/unpublish`)
      setPost(updated)
      show('Moved back to drafts.')
    } catch (error) {
      show(error.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function onDelete() {
    setBusy(true)
    try {
      await api.del(`/api/posts/${id}`)
      show('Post deleted.')
      navigate('/dashboard', { replace: true })
    } catch (error) {
      show(error.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function onCoverChange(file) {
    try {
      const { url } = await uploadImage(file)
      setPost((current) => ({ ...current, coverImageUrl: url }))
    } catch (error) {
      show(error.message, 'error')
    }
  }

  if (loading || !post) {
    return (
      <div className="flex justify-center p-16">
        <Spinner label="Opening your draft" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <PostMetaBar
        post={post}
        saveStatus={dirty && status === 'saved' ? 'idle' : status}
        onRetry={saveNow}
        busy={busy}
        onTitleChange={(title) => setPost((current) => ({ ...current, title }))}
        onTagsChange={(tags) => setPost((current) => ({ ...current, tags }))}
        onCoverChange={onCoverChange}
        onPublish={onPublish}
        onUnpublish={onUnpublish}
        onDelete={onDelete}
      />

      <div className="mt-8">
        <BlockEditor initialContent={post.content?.blocks} onChange={setContent} />
      </div>
    </div>
  )
}
```

- [ ] **Step 11: Add the by-id read route the editor needs**

The editor loads by id, but `GET /api/posts/:slug` reads by slug. Add to `server/src/routes/posts.js`, **above** the `/:slug` route so it is reachable:

```js
postsRouter.get('/by-id/:id', requireAuth, loadPostForWrite, async (req, res, next) => {
  try {
    await req.post.populate('author', AUTHOR_FIELDS)
    res.json({ post: serializePost(req.post, { full: true }) })
  } catch (err) {
    next(err)
  }
})
```

`loadPostForWrite` already enforces owner-or-admin, so this cannot be used to read someone else's draft.

Add to `server/tests/posts.test.js`:

```js
describe('GET /api/posts/by-id/:id', () => {
  it('returns the owner own draft with content', async () => {
    const { agent } = await signedInAgent()
    const created = await agent.post('/api/posts').send({ title: 'Editing This' })
    const res = await agent.get(`/api/posts/by-id/${created.body.post.id}`)
    expect(res.status).toBe(200)
    expect(res.body.post.content.blocks).toBeInstanceOf(Array)
  })

  it('403s for someone else post', async () => {
    const owner = await signedInAgent()
    const created = await owner.agent.post('/api/posts').send({ title: 'Not Yours' })
    const other = await signedInAgent()
    const res = await other.agent.get(`/api/posts/by-id/${created.body.post.id}`)
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 12: Run both suites to verify they pass**

Run: `npm test`
Expected: PASS on both server and client.

- [ ] **Step 13: Commit**

```bash
git add client/src server/src server/tests
git commit -m "feat: add block editor with autosave, video embeds and references"
```

---

## Task 13: Dashboard — post list and profile settings

**Files:**
- Create: `client/src/pages/dashboard/PostList.jsx`, `client/src/pages/dashboard/ProfileSettings.jsx`, `client/src/components/PostCard.jsx`
- Test: `client/src/pages/dashboard/PostList.test.jsx`

**Interfaces:**
- Consumes: `api`, `useAuth`, `useToast`, `Button`, `Card`, `Badge`, `Spinner`, `formatDate`, `uploadImage`.
- Produces: `PostList` at `/dashboard`, `ProfileSettings` at `/dashboard/settings`, and `<PostCard post />` shared with the public feed.

- [ ] **Step 1: Write the failing test**

`client/src/pages/dashboard/PostList.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { PostList } from './PostList.jsx'
import { AuthContext } from '../../lib/useAuth.jsx'
import { ToastProvider } from '../../components/ui/Toast.jsx'

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const posts = [
  {
    id: '1',
    title: 'A Live One',
    slug: 'a-live-one',
    status: 'published',
    excerpt: 'Out in the world',
    tags: ['design'],
    publishedAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    author: { username: 'ada', displayName: 'Ada' },
  },
  {
    id: '2',
    title: 'Still Cooking',
    slug: 'still-cooking',
    status: 'draft',
    excerpt: '',
    tags: [],
    publishedAt: null,
    updatedAt: '2026-06-02T00:00:00.000Z',
    author: { username: 'ada', displayName: 'Ada' },
  },
]

const renderList = () =>
  render(
    <AuthContext.Provider value={{ user: { username: 'ada', role: 'user' }, loading: false }}>
      <ToastProvider>
        <MemoryRouter>
          <PostList />
        </MemoryRouter>
      </ToastProvider>
    </AuthContext.Provider>,
  )

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('PostList', () => {
  it('shows both drafts and published posts, labelled', async () => {
    fetch.mockResolvedValue(jsonResponse({ posts }))
    renderList()

    expect(await screen.findByText('A Live One')).toBeInTheDocument()
    expect(screen.getByText('Still Cooking')).toBeInTheDocument()
    expect(screen.getByText(/draft/i)).toBeInTheDocument()
  })

  it('invites a first post when there are none', async () => {
    fetch.mockResolvedValue(jsonResponse({ posts: [] }))
    renderList()
    expect(await screen.findByText(/nothing here yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /write your first post/i })).toBeInTheDocument()
  })

  it('deletes a post after confirmation and removes it from the list', async () => {
    fetch.mockResolvedValue(jsonResponse({ posts }))
    renderList()
    await screen.findByText('Still Cooking')

    fetch.mockResolvedValue(jsonResponse({ ok: true }))
    await userEvent.click(screen.getByRole('button', { name: /delete still cooking/i }))
    await userEvent.click(screen.getByRole('button', { name: /delete permanently/i }))

    await waitFor(() => expect(screen.queryByText('Still Cooking')).not.toBeInTheDocument())
    expect(screen.getByText('A Live One')).toBeInTheDocument()
  })

  it('surfaces a load failure', async () => {
    fetch.mockResolvedValue(
      jsonResponse({ error: { code: 'INTERNAL', message: 'Something went wrong on our end' } }, 500),
    )
    renderList()
    expect(await screen.findByRole('alert')).toHaveTextContent(/went wrong/i)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -w client`
Expected: FAIL — `PostList.jsx` does not exist.

- [ ] **Step 3: Implement PostCard**

`client/src/components/PostCard.jsx`:

```jsx
import { Link } from 'react-router-dom'
import { Card } from './ui/Card.jsx'
import { Badge } from './ui/Badge.jsx'
import { formatDate } from '../lib/formatDate.js'

export function PostCard({ post }) {
  return (
    <Card as="article" className="flex flex-col overflow-hidden">
      {post.coverImageUrl ? (
        <img
          src={post.coverImageUrl}
          alt=""
          className="h-44 w-full border-b-2 border-ink object-cover"
          loading="lazy"
        />
      ) : null}

      <div className="flex flex-1 flex-col gap-3 p-5">
        <h2 className="display text-2xl leading-tight">
          <Link to={`/blog/${post.slug}`} className="hover:underline decoration-mustard decoration-4">
            {post.title || 'Untitled'}
          </Link>
        </h2>

        {post.excerpt ? <p className="text-sm leading-relaxed">{post.excerpt}</p> : null}

        <div className="mt-auto flex flex-wrap items-center gap-2 text-xs">
          {post.author ? (
            <Link to={`/@${post.author.username}`} className="font-semibold hover:underline">
              {post.author.displayName || post.author.username}
            </Link>
          ) : null}
          {post.publishedAt ? <span>· {formatDate(post.publishedAt)}</span> : null}
          {post.tags?.map((tag) => (
            <Link key={tag} to={`/tag/${tag}`}>
              <Badge>{tag}</Badge>
            </Link>
          ))}
        </div>
      </div>
    </Card>
  )
}
```

- [ ] **Step 4: Implement PostList**

`client/src/pages/dashboard/PostList.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api.js'
import { useToast } from '../../components/ui/Toast.jsx'
import { Button } from '../../components/ui/Button.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { Badge } from '../../components/ui/Badge.jsx'
import { Spinner } from '../../components/ui/Spinner.jsx'
import { formatDate } from '../../lib/formatDate.js'

function Row({ post, onDelete }) {
  const [confirming, setConfirming] = useState(false)

  return (
    <Card as="li" className="flex flex-wrap items-center gap-4 p-4">
      <div className="min-w-48 flex-1">
        <p className="display text-xl leading-tight">{post.title || 'Untitled'}</p>
        <p className="mt-1 text-xs">
          {post.status === 'published'
            ? `Published ${formatDate(post.publishedAt)}`
            : `Edited ${formatDate(post.updatedAt)}`}
        </p>
      </div>

      <Badge tone={post.status === 'published' ? 'mustard' : 'ink'}>
        {post.status === 'published' ? 'Live' : 'Draft'}
      </Badge>

      <div className="flex flex-wrap gap-2">
        <Button as={Link} to={`/dashboard/posts/${post.id}`} size="sm" variant="ghost">
          Edit
        </Button>
        {post.status === 'published' ? (
          <Button as={Link} to={`/blog/${post.slug}`} size="sm" variant="ghost">
            View
          </Button>
        ) : null}

        {confirming ? (
          <>
            <Button variant="danger" size="sm" onClick={() => onDelete(post.id)}>
              Delete permanently
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Delete ${post.title || 'Untitled'}`}
            onClick={() => setConfirming(true)}
          >
            Delete
          </Button>
        )}
      </div>
    </Card>
  )
}

export function PostList() {
  const { show } = useToast()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    api
      .get('/api/me/posts')
      .then(({ posts: mine }) => {
        if (!cancelled) setPosts(mine)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function onDelete(id) {
    try {
      await api.del(`/api/posts/${id}`)
      setPosts((current) => current.filter((post) => post.id !== id))
      show('Post deleted.')
    } catch (err) {
      show(err.message, 'error')
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="display text-5xl">Your posts</h1>
        <div className="ml-auto flex gap-3">
          <Button as={Link} to="/dashboard/settings" variant="ghost" size="sm">
            Profile
          </Button>
          <Button as={Link} to="/dashboard/new" size="sm">
            New post
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="mt-10 flex justify-center">
          <Spinner label="Loading your posts" />
        </div>
      ) : error ? (
        <p role="alert" className="mt-8 rounded-xl border-2 border-brick p-4 font-medium text-brick">
          {error}
        </p>
      ) : posts.length === 0 ? (
        <Card className="mt-8 p-8 text-center">
          <p className="display text-2xl">Nothing here yet</p>
          <p className="mt-2 text-sm">Your drafts and published posts will show up here.</p>
          <Button as={Link} to="/dashboard/new" className="mt-5">
            Write your first post
          </Button>
        </Card>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {posts.map((post) => (
            <Row key={post.id} post={post} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Implement ProfileSettings**

`client/src/pages/dashboard/ProfileSettings.jsx`:

```jsx
import { useState } from 'react'
import { api, uploadImage } from '../../lib/api.js'
import { useAuth } from '../../lib/useAuth.jsx'
import { useToast } from '../../components/ui/Toast.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { Input } from '../../components/ui/Input.jsx'
import { Textarea } from '../../components/ui/Textarea.jsx'
import { Button } from '../../components/ui/Button.jsx'

export function ProfileSettings() {
  const { user, updateUser } = useAuth()
  const { show } = useToast()

  const [form, setForm] = useState({
    displayName: user.displayName ?? '',
    bio: user.bio ?? '',
    avatarUrl: user.avatarUrl ?? null,
  })
  const [fields, setFields] = useState({})
  const [busy, setBusy] = useState(false)

  async function onAvatar(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const { url } = await uploadImage(file)
      setForm((current) => ({ ...current, avatarUrl: url }))
    } catch (error) {
      show(error.message, 'error')
    }
  }

  async function onSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setFields({})
    try {
      const { user: updated } = await api.patch('/api/me', form)
      updateUser(updated)
      show('Profile saved.')
    } catch (error) {
      setFields(error.fields ?? {})
      if (!Object.keys(error.fields ?? {}).length) show(error.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-10">
      <h1 className="display text-5xl">Your profile</h1>
      <p className="mt-2 text-sm">
        This is what readers see at <code>/@{user.username}</code>.
      </p>

      <Card className="mt-8 p-6">
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Input
            id="displayName"
            label="Display name"
            value={form.displayName}
            onChange={(event) => setForm({ ...form, displayName: event.target.value })}
            error={fields.displayName}
          />
          <Textarea
            id="bio"
            label="Bio"
            maxLength={280}
            value={form.bio}
            onChange={(event) => setForm({ ...form, bio: event.target.value })}
            error={fields.bio}
          />
          <p className="-mt-2 text-xs">{form.bio.length} of 280 characters</p>

          <div className="flex items-center gap-4">
            {form.avatarUrl ? (
              <img
                src={form.avatarUrl}
                alt="Your avatar"
                className="size-16 rounded-full border-2 border-ink object-cover"
              />
            ) : null}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="avatar" className="text-sm font-semibold">
                Avatar
              </label>
              <input id="avatar" type="file" accept="image/*" onChange={onAvatar} className="text-sm" />
            </div>
          </div>

          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save profile'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -w client`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add client/src
git commit -m "feat: add dashboard post list and profile settings"
```

---

## Task 14: Public pages and routing

**Files:**
- Create: `client/src/pages/Landing.jsx`, `client/src/pages/Feed.jsx`, `client/src/pages/Post.jsx`, `client/src/pages/AuthorProfile.jsx`, `client/src/pages/Tag.jsx`, `client/src/pages/NotFound.jsx`
- Modify: `client/src/App.jsx` (real routing)
- Test: `client/src/pages/Post.test.jsx`, `client/src/pages/Feed.test.jsx`

**Interfaces:**
- Consumes: `api`, `useAuth`, `BlockRenderer`, `PostCard`, `SiteHeader`, `SiteFooter`, `Shell`, `RequireAuth`, `ToastProvider`, `ErrorBoundary`, `formatDate`.
- Produces the full route table:

| Path | Element | Access |
|---|---|---|
| `/` | `Landing` | anyone |
| `/blog` | `Feed` | anyone |
| `/blog/:slug` | `Post` | anyone (drafts 404 unless owner/admin) |
| `/@:username` | `AuthorProfile` | anyone |
| `/tag/:tag` | `Tag` | anyone |
| `/signin`, `/signup` | `SignIn`, `SignUp` | anyone |
| `/dashboard` | `PostList` | signed in |
| `/dashboard/new`, `/dashboard/posts/:id` | `Editor` | signed in |
| `/dashboard/settings` | `ProfileSettings` | signed in |
| `/admin` | `AdminPanel` | admin only |
| `*` | `NotFound` | anyone |

- [ ] **Step 1: Write the failing tests**

`client/src/pages/Post.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Post } from './Post.jsx'

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const post = {
  id: '1',
  title: 'On Quiet Streets',
  slug: 'on-quiet-streets',
  excerpt: 'A walk at dusk',
  status: 'published',
  tags: ['essays'],
  publishedAt: '2026-06-01T00:00:00.000Z',
  coverImageUrl: null,
  author: { username: 'ada', displayName: 'Ada L', avatarUrl: null },
  content: {
    blocks: [
      {
        id: 'b1',
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: 'The lamps came on one by one.', styles: {} }],
        children: [],
      },
    ],
  },
}

const renderPost = () =>
  render(
    <MemoryRouter initialEntries={['/blog/on-quiet-streets']}>
      <Routes>
        <Route path="/blog/:slug" element={<Post />} />
      </Routes>
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Post', () => {
  it('renders the title as the page heading, plus author, date and body', async () => {
    fetch.mockResolvedValue(jsonResponse({ post }))
    renderPost()

    expect(await screen.findByRole('heading', { level: 1, name: 'On Quiet Streets' })).toBeInTheDocument()
    expect(screen.getByText('The lamps came on one by one.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ada L' })).toHaveAttribute('href', '/@ada')
    expect(screen.getByText(/1 June 2026/)).toBeInTheDocument()
  })

  it('shows a not-found message for a missing post', async () => {
    fetch.mockResolvedValue(
      jsonResponse({ error: { code: 'NOT_FOUND', message: 'Post not found' } }, 404),
    )
    renderPost()
    expect(await screen.findByText(/that post is not here/i)).toBeInTheDocument()
  })

  it('marks a draft as unpublished for its owner', async () => {
    fetch.mockResolvedValue(jsonResponse({ post: { ...post, status: 'draft', publishedAt: null } }))
    renderPost()
    expect(await screen.findByText(/draft — only you can see this/i)).toBeInTheDocument()
  })
})
```

`client/src/pages/Feed.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Feed } from './Feed.jsx'

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const page = {
  posts: [
    {
      id: '1',
      title: 'First',
      slug: 'first',
      excerpt: 'one',
      tags: [],
      publishedAt: '2026-06-01T00:00:00.000Z',
      author: { username: 'ada', displayName: 'Ada' },
    },
  ],
  page: 1,
  pages: 2,
  total: 12,
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Feed', () => {
  it('lists posts and offers the next page', async () => {
    fetch.mockResolvedValue(jsonResponse(page))
    render(
      <MemoryRouter>
        <Feed />
      </MemoryRouter>,
    )
    expect(await screen.findByText('First')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument()
  })

  it('says so when nobody has published yet', async () => {
    fetch.mockResolvedValue(jsonResponse({ posts: [], page: 1, pages: 0, total: 0 }))
    render(
      <MemoryRouter>
        <Feed />
      </MemoryRouter>,
    )
    expect(await screen.findByText(/no posts yet/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -w client`
Expected: FAIL — `Post.jsx` and `Feed.jsx` do not exist.

- [ ] **Step 3: Implement the post page**

`client/src/pages/Post.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api.js'
import { BlockRenderer } from '../components/BlockRenderer.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Spinner } from '../components/ui/Spinner.jsx'
import { formatDate } from '../lib/formatDate.js'

export function Post() {
  const { slug } = useParams()
  const [post, setPost] = useState(null)
  const [state, setState] = useState('loading')

  useEffect(() => {
    let cancelled = false
    setState('loading')

    api
      .get(`/api/posts/${slug}`)
      .then(({ post: loaded }) => {
        if (cancelled) return
        setPost(loaded)
        setState('ready')
        document.title = `${loaded.title || 'Untitled'} — Parchment`
      })
      .catch(() => {
        if (!cancelled) setState('missing')
      })

    return () => {
      cancelled = true
    }
  }, [slug])

  if (state === 'loading') {
    return (
      <div className="flex justify-center p-16">
        <Spinner label="Loading the post" />
      </div>
    )
  }

  if (state === 'missing') {
    return (
      <div className="mx-auto max-w-xl px-5 py-20 text-center">
        <h1 className="display text-5xl">That post is not here</h1>
        <p className="mt-3">It may have been deleted, or the link might be wrong.</p>
        <Link to="/blog" className="mt-5 inline-block font-semibold underline decoration-mustard decoration-2">
          Browse everything else
        </Link>
      </div>
    )
  }

  return (
    <article className="mx-auto max-w-3xl px-5 py-12">
      {post.status === 'draft' ? (
        <p className="mb-6 rounded-xl border-2 border-ink bg-mustard px-4 py-2 text-sm font-semibold">
          Draft — only you can see this
        </p>
      ) : null}

      <h1 className="display text-5xl sm:text-6xl">{post.title || 'Untitled'}</h1>

      <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
        {post.author?.avatarUrl ? (
          <img
            src={post.author.avatarUrl}
            alt=""
            className="size-9 rounded-full border-2 border-ink object-cover"
          />
        ) : null}
        {post.author ? (
          <Link to={`/@${post.author.username}`} className="font-semibold hover:underline">
            {post.author.displayName || post.author.username}
          </Link>
        ) : null}
        {post.publishedAt ? <span>· {formatDate(post.publishedAt)}</span> : null}
        {post.tags?.map((tag) => (
          <Link key={tag} to={`/tag/${tag}`}>
            <Badge>{tag}</Badge>
          </Link>
        ))}
      </div>

      {post.coverImageUrl ? (
        <img
          src={post.coverImageUrl}
          alt=""
          className="mt-8 w-full rounded-2xl border-2 border-ink object-cover"
        />
      ) : null}

      {/* The reading column drops the outlines on purpose — see styles/index.css. */}
      <div className="prose-reading mx-auto mt-10">
        <BlockRenderer content={post.content} />
      </div>
    </article>
  )
}
```

- [ ] **Step 4: Implement the feed, tag, profile, landing and not-found pages**

`client/src/pages/Feed.jsx`:

```jsx
import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { PostCard } from '../components/PostCard.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Spinner } from '../components/ui/Spinner.jsx'

// Shared by /blog, /tag/:tag and the author profile — one list, three filters.
export function Feed({ tag, author, heading = 'Everything', intro }) {
  const [posts, setPosts] = useState([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(
    async (which) => {
      const params = new URLSearchParams({ page: String(which), limit: '9' })
      if (tag) params.set('tag', tag)
      if (author) params.set('author', author)

      try {
        const data = await api.get(`/api/posts?${params}`)
        setPosts((current) => (which === 1 ? data.posts : [...current, ...data.posts]))
        setPages(data.pages)
        setPage(data.page)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    },
    [tag, author],
  )

  useEffect(() => {
    setLoading(true)
    setError('')
    load(1)
  }, [load])

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="display text-5xl sm:text-6xl">{heading}</h1>
      {intro ? <p className="mt-3 max-w-prose">{intro}</p> : null}

      {loading ? (
        <div className="mt-12 flex justify-center">
          <Spinner label="Loading posts" />
        </div>
      ) : error ? (
        <p role="alert" className="mt-8 rounded-xl border-2 border-brick p-4 font-medium text-brick">
          {error}
        </p>
      ) : posts.length === 0 ? (
        <p className="mt-10 text-lg">No posts yet. Someone has to go first.</p>
      ) : (
        <>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>

          {page < pages ? (
            <div className="mt-10 flex justify-center">
              <Button variant="ink" onClick={() => load(page + 1)}>
                Load more
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
```

`client/src/pages/Tag.jsx`:

```jsx
import { useParams } from 'react-router-dom'
import { Feed } from './Feed.jsx'

export function Tag() {
  const { tag } = useParams()
  return <Feed tag={tag} heading={`#${tag}`} intro={`Everything tagged ${tag}.`} />
}
```

`client/src/pages/AuthorProfile.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api.js'
import { PostCard } from '../components/PostCard.jsx'
import { Card } from '../components/ui/Card.jsx'
import { Spinner } from '../components/ui/Spinner.jsx'

export function AuthorProfile() {
  const { username } = useParams()
  const [data, setData] = useState(null)
  const [state, setState] = useState('loading')

  useEffect(() => {
    let cancelled = false

    api
      .get(`/api/users/${username}`)
      .then((payload) => {
        if (cancelled) return
        setData(payload)
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('missing')
      })

    return () => {
      cancelled = true
    }
  }, [username])

  if (state === 'loading') {
    return (
      <div className="flex justify-center p-16">
        <Spinner label="Loading profile" />
      </div>
    )
  }

  if (state === 'missing') {
    return (
      <div className="mx-auto max-w-xl px-5 py-20 text-center">
        <h1 className="display text-5xl">No writer here</h1>
        <p className="mt-3">Nobody is using that username.</p>
      </div>
    )
  }

  const { user, posts } = data

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <Card className="flex flex-wrap items-center gap-5 p-6">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt=""
            className="size-20 rounded-full border-2 border-ink object-cover"
          />
        ) : null}
        <div>
          <h1 className="display text-4xl">{user.displayName || user.username}</h1>
          <p className="text-sm font-semibold">@{user.username}</p>
          {user.bio ? <p className="mt-2 max-w-prose text-sm">{user.bio}</p> : null}
        </div>
      </Card>

      <h2 className="display mt-12 text-3xl">
        {posts.length} {posts.length === 1 ? 'post' : 'posts'}
      </h2>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  )
}
```

`client/src/pages/Landing.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { useAuth } from '../lib/useAuth.jsx'
import { PostCard } from '../components/PostCard.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Card } from '../components/ui/Card.jsx'
import { RotatingBadge } from '../components/ui/RotatingBadge.jsx'

export function Landing() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [posts, setPosts] = useState([])

  useEffect(() => {
    api
      .get('/api/posts?limit=3')
      .then(({ posts: latest }) => setPosts(latest))
      .catch(() => setPosts([]))
  }, [])

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      {/* Collage hero: overlapping cards rather than a tidy grid, per the reference. */}
      <section className="grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <h1 className="display text-6xl sm:text-7xl lg:text-8xl">
            Write Something
            <br />
            Worth Reading.
          </h1>
          <p className="mt-6 max-w-md text-lg">
            A blog anyone can publish to. Bring words, images, video and the links that back them up.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button as={Link} to={user ? '/dashboard/new' : '/signup'} size="lg">
              {user ? 'Start a new post' : 'Start writing'}
            </Button>
            <Button as={Link} to="/blog" variant="ghost" size="lg">
              Read the blog
            </Button>
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <RotatingBadge
            text="Write · Publish · Edit"
            label={user ? 'New post' : 'Join in'}
            onClick={() => navigate(user ? '/dashboard/new' : '/signup')}
          />
        </div>
      </section>

      <section className="mt-20">
        <div className="flex flex-wrap items-end gap-4">
          <h2 className="display text-4xl">Fresh off the press</h2>
          <Link to="/blog" className="ml-auto font-semibold underline decoration-mustard decoration-2">
            See everything
          </Link>
        </div>

        {posts.length ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <Card className="mt-8 p-8 text-center">
            <p className="display text-2xl">Nothing published yet</p>
            <p className="mt-2 text-sm">Be the first person to write here.</p>
            <Button as={Link} to="/signup" className="mt-5">
              Create an account
            </Button>
          </Card>
        )}
      </section>
    </div>
  )
}
```

`client/src/pages/NotFound.jsx`:

```jsx
import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-5 py-24 text-center">
      <h1 className="display text-6xl">Nothing here</h1>
      <p className="mt-4">That page does not exist.</p>
      <Link to="/" className="mt-6 inline-block font-semibold underline decoration-mustard decoration-2">
        Back to the start
      </Link>
    </div>
  )
}
```

- [ ] **Step 5: Wire up real routing**

Replace `client/src/App.jsx`:

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/useAuth.jsx'
import { ToastProvider } from './components/ui/Toast.jsx'
import { ErrorBoundary } from './components/ui/ErrorBoundary.jsx'
import { Shell } from './components/layout/Shell.jsx'
import { SiteHeader } from './components/layout/SiteHeader.jsx'
import { SiteFooter } from './components/layout/SiteFooter.jsx'
import { RequireAuth } from './components/RequireAuth.jsx'
import { Landing } from './pages/Landing.jsx'
import { Feed } from './pages/Feed.jsx'
import { Post } from './pages/Post.jsx'
import { Tag } from './pages/Tag.jsx'
import { AuthorProfile } from './pages/AuthorProfile.jsx'
import { SignIn } from './pages/SignIn.jsx'
import { SignUp } from './pages/SignUp.jsx'
import { PostList } from './pages/dashboard/PostList.jsx'
import { Editor } from './pages/dashboard/Editor.jsx'
import { ProfileSettings } from './pages/dashboard/ProfileSettings.jsx'
import { AdminPanel } from './pages/admin/AdminPanel.jsx'
import { NotFound } from './pages/NotFound.jsx'

function Header() {
  const { user, signOut } = useAuth()
  return <SiteHeader user={user} onSignOut={signOut} />
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ErrorBoundary>
            <Shell header={<Header />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/blog" element={<Feed />} />
                <Route path="/blog/:slug" element={<Post />} />
                <Route path="/tag/:tag" element={<Tag />} />
                {/* React Router treats the @ as a literal character. */}
                <Route path="/@:username" element={<AuthorProfile />} />
                <Route path="/signin" element={<SignIn />} />
                <Route path="/signup" element={<SignUp />} />

                <Route
                  path="/dashboard"
                  element={
                    <RequireAuth>
                      <PostList />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dashboard/new"
                  element={
                    <RequireAuth>
                      <Editor />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dashboard/posts/:id"
                  element={
                    <RequireAuth>
                      <Editor />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dashboard/settings"
                  element={
                    <RequireAuth>
                      <ProfileSettings />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <RequireAuth adminOnly>
                      <AdminPanel />
                    </RequireAuth>
                  }
                />

                <Route path="/index.html" element={<Navigate to="/" replace />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              <SiteFooter />
            </Shell>
          </ErrorBoundary>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
```

`AdminPanel` arrives in Task 15. Until then, create a one-line placeholder at `client/src/pages/admin/AdminPanel.jsx` so the import resolves:

```jsx
export function AdminPanel() {
  return <p className="p-16">Admin panel — built in Task 15.</p>
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -w client`
Expected: PASS, all suites.

- [ ] **Step 7: Commit**

```bash
git add client/src
git commit -m "feat: add landing, feed, post, tag and profile pages with routing"
```

---

## Task 15: Admin panel

**Files:**
- Create (replacing the placeholder): `client/src/pages/admin/AdminPanel.jsx`
- Test: `client/src/pages/admin/AdminPanel.test.jsx`

**Interfaces:**
- Consumes: `api`, `useToast`, `Button`, `Card`, `Badge`, `Spinner`, `formatDate`.
- Produces: `AdminPanel` at `/admin` — every post with status filter, unpublish, and ban/unban of a post's author.

- [ ] **Step 1: Write the failing test**

`client/src/pages/admin/AdminPanel.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AdminPanel } from './AdminPanel.jsx'
import { ToastProvider } from '../../components/ui/Toast.jsx'

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const posts = [
  {
    id: 'p1',
    title: 'Buy Cheap Things Now',
    slug: 'buy-cheap-things-now',
    status: 'published',
    excerpt: 'spam',
    tags: [],
    publishedAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    author: { id: 'u1', username: 'spammer', displayName: 'Spammer', avatarUrl: null },
  },
]

const renderPanel = () =>
  render(
    <ToastProvider>
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>
    </ToastProvider>,
  )

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AdminPanel', () => {
  it('lists every post with its author', async () => {
    fetch.mockResolvedValue(jsonResponse({ posts, page: 1, pages: 1, total: 1 }))
    renderPanel()
    expect(await screen.findByText('Buy Cheap Things Now')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /spammer/i })).toBeInTheDocument()
  })

  it('unpublishes a post and reflects the new status', async () => {
    fetch.mockResolvedValue(jsonResponse({ posts, page: 1, pages: 1, total: 1 }))
    renderPanel()
    await screen.findByText('Buy Cheap Things Now')

    fetch.mockResolvedValue(jsonResponse({ post: { ...posts[0], status: 'draft' } }))
    await userEvent.click(screen.getByRole('button', { name: /unpublish/i }))

    await waitFor(() => expect(screen.getByText(/^draft$/i)).toBeInTheDocument())
  })

  it('bans the author after confirmation', async () => {
    fetch.mockResolvedValue(jsonResponse({ posts, page: 1, pages: 1, total: 1 }))
    renderPanel()
    await screen.findByText('Buy Cheap Things Now')

    await userEvent.click(screen.getByRole('button', { name: /ban author/i }))
    expect(fetch).toHaveBeenCalledTimes(1)

    fetch.mockResolvedValue(jsonResponse({ user: { username: 'spammer', role: 'user' } }))
    await userEvent.click(screen.getByRole('button', { name: /confirm ban/i }))

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(fetch.mock.calls[1][0]).toMatch(/\/api\/admin\/users\/.+\/ban$/)
  })

  it('filters by status', async () => {
    fetch.mockResolvedValue(jsonResponse({ posts, page: 1, pages: 1, total: 1 }))
    renderPanel()
    await screen.findByText('Buy Cheap Things Now')

    await userEvent.selectOptions(screen.getByLabelText(/status/i), 'draft')
    await waitFor(() => expect(fetch.mock.calls.at(-1)[0]).toContain('status=draft'))
  })
})
```

Note: banning needs the author's user id, which `serializePost` does not yet expose — hence `author.id` in the fixture above. Step 3 adds it. Mongoose always returns `_id` on a populated document, so the `AUTHOR_FIELDS` projection needs no change.

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -w client`
Expected: FAIL — the placeholder AdminPanel renders no list.

- [ ] **Step 3: Add the author id to the serializer**

In `server/src/lib/serializePost.js`, inside the populated author object:

```js
        id: String(post.author._id),
```

Add to `server/tests/posts.test.js`:

```js
it('includes the author id so admin tools can act on them', async () => {
  const author = await makeUser()
  await makePost({ author, slug: 'has-author-id', status: 'published', publishedAt: new Date() })
  const res = await request(app()).get('/api/posts')
  expect(res.body.posts[0].author.id).toBe(String(author._id))
})
```

- [ ] **Step 4: Implement the admin panel**

`client/src/pages/admin/AdminPanel.jsx`:

```jsx
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api.js'
import { useToast } from '../../components/ui/Toast.jsx'
import { Button } from '../../components/ui/Button.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { Badge } from '../../components/ui/Badge.jsx'
import { Spinner } from '../../components/ui/Spinner.jsx'
import { formatDate } from '../../lib/formatDate.js'

function Row({ post, onUnpublish, onBan }) {
  const [confirming, setConfirming] = useState(false)

  return (
    <Card as="li" className="flex flex-wrap items-center gap-4 p-4">
      <div className="min-w-56 flex-1">
        <p className="display text-lg leading-tight">{post.title || 'Untitled'}</p>
        <p className="mt-1 text-xs">
          {post.author ? (
            <Link to={`/@${post.author.username}`} className="font-semibold hover:underline">
              {post.author.displayName || post.author.username}
            </Link>
          ) : (
            'unknown author'
          )}
          {' · '}
          {formatDate(post.updatedAt)}
        </p>
      </div>

      <Badge tone={post.status === 'published' ? 'mustard' : 'ink'}>
        {post.status === 'published' ? 'Live' : 'Draft'}
      </Badge>

      <div className="flex flex-wrap gap-2">
        <Button as={Link} to={`/blog/${post.slug}`} size="sm" variant="ghost">
          Open
        </Button>

        {post.status === 'published' ? (
          <Button size="sm" variant="ghost" onClick={() => onUnpublish(post.id)}>
            Unpublish
          </Button>
        ) : null}

        {confirming ? (
          <>
            <Button size="sm" variant="danger" onClick={() => onBan(post.author?.id)}>
              Confirm ban
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
            Ban author
          </Button>
        )}
      </div>
    </Card>
  )
}

export function AdminPanel() {
  const { show } = useToast()
  const [posts, setPosts] = useState([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const query = status ? `?status=${status}` : ''
      const data = await api.get(`/api/admin/posts${query}`)
      setPosts(data.posts)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  async function onUnpublish(id) {
    try {
      const { post: updated } = await api.post(`/api/posts/${id}/unpublish`)
      setPosts((current) => current.map((post) => (post.id === id ? { ...post, ...updated } : post)))
      show('Taken down. The post is a draft again, not deleted.')
    } catch (err) {
      show(err.message, 'error')
    }
  }

  async function onBan(userId) {
    if (!userId) return
    try {
      await api.post(`/api/admin/users/${userId}/ban`)
      show('That account can no longer publish.')
    } catch (err) {
      show(err.message, 'error')
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <h1 className="display text-5xl">Moderation</h1>
      <p className="mt-2 text-sm">
        Unpublishing hides a post without destroying it. Banning stops an account publishing but
        leaves their existing posts alone.
      </p>

      <div className="mt-6 flex items-center gap-3">
        <label htmlFor="status" className="text-sm font-semibold">
          Status
        </label>
        <select
          id="status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-xl border-2 border-ink bg-card px-3 py-2 text-sm"
        >
          <option value="">All</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      {loading ? (
        <div className="mt-10 flex justify-center">
          <Spinner label="Loading posts" />
        </div>
      ) : error ? (
        <p role="alert" className="mt-8 rounded-xl border-2 border-brick p-4 font-medium text-brick">
          {error}
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {posts.map((post) => (
            <Row key={post.id} post={post} onUnpublish={onUnpublish} onBan={onBan} />
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Run both suites to verify they pass**

Run: `npm test`
Expected: PASS on both sides.

- [ ] **Step 6: Commit**

```bash
git add client/src server/src server/tests
git commit -m "feat: add admin moderation panel"
```

---

## Task 16: Crawler middleware, deployment config, and end-to-end smoke test

**Files:**
- Create: `client/middleware.js`, `client/vercel.json`, `client/.env.example`, `render.yaml`, `README.md`
- Test: manual end-to-end run (documented below), plus the full automated suite

**Interfaces:**
- Consumes: the finished client and server.
- Produces: deployable configuration and a written setup path.

- [ ] **Step 1: Add the crawler middleware**

`client/middleware.js` — Vercel Edge Middleware. Shared post links point at the client domain, so crawler detection has to happen here, not on the API.

```js
export const config = {
  matcher: '/blog/:slug*',
}

const CRAWLERS =
  /(facebookexternalhit|twitterbot|slackbot|discordbot|linkedinbot|whatsapp|telegrambot|googlebot|bingbot|pinterest|redditbot|embedly|quora link preview|skypeuripreview|nuzzel|vkshare|w3c_validator)/i

export default async function middleware(request) {
  const userAgent = request.headers.get('user-agent') ?? ''
  // Humans and unknown agents fall through to the SPA. The worst case for a
  // spoofed or unrecognised crawler is a missing preview, never a broken page.
  if (!CRAWLERS.test(userAgent)) return

  const apiUrl = process.env.VITE_API_URL
  if (!apiUrl) return

  const slug = new URL(request.url).pathname.replace(/^\/blog\//, '').replace(/\/$/, '')
  if (!slug || slug.includes('/')) return

  try {
    const response = await fetch(`${apiUrl}/api/meta/post/${encodeURIComponent(slug)}`)
    if (!response.ok) return
    return new Response(await response.text(), {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  } catch {
    // Never let a meta failure take down the real page.
    return
  }
}
```

`client/vercel.json` — without the rewrite, a hard refresh on `/blog/anything` 404s, because the static host has no such file:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

`client/.env.example`:

```
# The deployed API origin. No trailing slash.
VITE_API_URL=http://localhost:4000
```

- [ ] **Step 2: Add the server deployment descriptor**

`render.yaml`:

```yaml
services:
  - type: web
    name: blog-api
    runtime: node
    plan: free
    rootDir: server
    buildCommand: npm install
    startCommand: npm start
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: MONGODB_URI
        sync: false
      - key: JWT_SECRET
        sync: false
      - key: CLOUDINARY_CLOUD_NAME
        sync: false
      - key: CLOUDINARY_API_KEY
        sync: false
      - key: CLOUDINARY_API_SECRET
        sync: false
      - key: CLIENT_ORIGIN
        sync: false
```

`sync: false` means each value is entered in the Render dashboard and never committed.

- [ ] **Step 3: Write the README**

`README.md`:

```markdown
# Parchment

A public multi-user blog. Anyone can read; anyone with an account can write, edit
and delete their own posts from a dashboard, with images, embedded video and
reference links.

## Stack

React 19 + Vite + Tailwind 4 + BlockNote · Node + Express + Mongoose · MongoDB
Atlas · Cloudinary for images · JWT sessions in an httpOnly cookie.

## Local setup

1. `npm install` (from the repo root — this is an npm workspace)
2. Copy `server/.env.example` to `server/.env` and fill it in:
   - `MONGODB_URI` — a MongoDB Atlas connection string including a database name
   - `JWT_SECRET` — `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
   - `CLOUDINARY_*` — from the Cloudinary dashboard
   - `CLIENT_ORIGIN` — `http://localhost:5173`
3. Copy `client/.env.example` to `client/.env` (`VITE_API_URL=http://localhost:4000`)
4. `npm run dev` — API on :4000, web on :5173

## Tests

`npm test` runs both suites. `npm test -w server` and `npm test -w client` run one
side. The server suite uses an in-memory MongoDB, so no database is needed.

## Making yourself an admin

Sign up normally, then:

```bash
npm run make-admin -w server -- you@example.com
```

There is no API route that grants the admin role — it is database-only by design.

## Deploying

**API (Render):** point Render at this repo; `render.yaml` describes the service.
Set every `sync: false` variable in the dashboard, with `CLIENT_ORIGIN` set to
your deployed web origin.

**Web (Vercel):** import the repo with root directory `client`. Set
`VITE_API_URL` to the Render URL. `vercel.json` handles SPA routing and
`middleware.js` serves Open Graph tags to crawlers so shared links preview.

Cookies are `SameSite=None; Secure` in production, so both halves must be HTTPS.

## Moderation

Admins can unpublish any post (which hides it without destroying it) and ban
accounts from publishing. Banned users can still read and can still take their
own posts down.
```

- [ ] **Step 4: Run the full automated suite**

Run: `npm test`
Expected: PASS on both workspaces, no skipped suites.

- [ ] **Step 5: End-to-end smoke test by hand**

Fill in `server/.env` and `client/.env`, run `npm run dev`, then walk the whole product. Every one of these must hold — this is the spec's success criteria, checked against the real app rather than a mock:

- [ ] Visit `/` signed out. The landing page renders: parchment background, heavy display headline, rotating badge, hard-shadowed cards.
- [ ] Visit `/blog` and a post page signed out. Both work with no account.
- [ ] Click **Write** signed out → redirected to `/signin`; after signing in you land on the editor, not the homepage.
- [ ] Sign up a new account. You arrive on `/dashboard`.
- [ ] Create a post. Type a title and body; the indicator shows `Saving…` then `Saved`.
- [ ] Drag an image into the editor. It uploads and displays; confirm the asset appears in your Cloudinary media library.
- [ ] Type `/video`, insert a video block, paste a YouTube URL. It embeds. Paste a non-YouTube URL — it is refused.
- [ ] Type `/references`, add two links with labels.
- [ ] Publish. Open the live URL. Body, image, video and references all render, and the reading column is a single calm measure with no heavy outlines.
- [ ] Reload the editor. Everything you wrote is still there.
- [ ] Edit the title and save. Confirm in the address bar that the slug did **not** change.
- [ ] Stop the API server, type in the editor, wait. The indicator shows **Not saved** with a **Retry** button, and your text is still on screen. Restart the API, hit Retry, and it saves.
- [ ] Sign up a second account in a private window. Try to open the first account's editor URL directly → refused.
- [ ] Delete a post from the dashboard. It requires confirmation, then disappears.
- [ ] Run `npm run make-admin -w server -- <your email>`, sign out and in, then visit `/admin`. Unpublish the other account's post and confirm it vanishes from `/blog` but still exists in the admin list.
- [ ] Visit `/@yourusername`. Bio, avatar and published posts appear; drafts do not.
- [ ] Visit `/tag/<a tag you used>`. The tagged post is listed.
- [ ] Resize to a narrow phone width on the landing page, feed, post and editor. Nothing overflows horizontally.
- [ ] Tab through the landing page and a form with the keyboard. Focus is always visible.

- [ ] **Step 6: Commit**

```bash
git add README.md render.yaml client/vercel.json client/middleware.js client/.env.example
git commit -m "chore: add deployment config and project readme"
```

---

## Definition of Done

The plan is complete when all of the following are true:

1. `npm test` passes both workspaces with no skips.
2. Every box in the Task 16 smoke test is ticked.
3. The spec's seven success criteria are each demonstrated by a passing test, a smoke-test step, or both:
   - anonymous reading — Task 5 tests + smoke steps 1–2
   - full publish flow with image, video and references — smoke steps 5–9
   - edit and delete own post — Task 5 tests + smoke steps 10–14
   - user B cannot touch user A's post — Task 5 ownership-guard tests + smoke step 13
   - admin takedown and ban — Task 7 tests + smoke step 15
   - shareable link previews — Task 8 tests + Task 16 middleware
   - no silent autosave data loss — Task 12 autosave tests + smoke step 12
