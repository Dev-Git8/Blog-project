# Blog Platform — Design Spec

**Date:** 2026-07-30
**Status:** Approved for planning

## Purpose

A public, multi-user blog platform. Anyone can read every post without an account. Anyone who signs up can write, edit, and delete their own posts from a personal dashboard, including images, embedded videos, and reference links. The site owner has admin powers to take down abusive content.

Visual direction: neo-brutalist retro-collage — parchment background, heavy black display type, thick outlines, hard offset shadows, mustard accent.

## Success Criteria

1. A visitor with no account can browse the landing page, the post feed, any published post, any author profile, and any tag page.
2. A new user can sign up, publish a post containing formatted text, an uploaded image, an embedded video, and a reference link list, and see it live at a shareable URL.
3. That user can later edit and delete that post from their dashboard.
4. User B cannot edit or delete user A's post — enforced server-side, proven by a test.
5. The admin can unpublish or delete any post and ban a user.
6. Shared post links render correct title/description/image previews on social platforms.
7. A failed autosave never silently loses a writer's work.

## Non-Goals (v1)

Explicitly out of scope, deferred:

- Comments
- Full-text search
- Dark mode
- Direct video file uploads (embeds only)
- Follows, likes, notifications, email sending
- OAuth / social sign-in
- Post revision history
- Soft-delete / trash for user-initiated deletes

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + Vite + React Router + Tailwind CSS |
| Editor | BlockNote (Notion-style block editor) |
| Backend | Node.js + Express + Mongoose |
| Database | MongoDB (Atlas free tier) |
| Auth | bcrypt password hashing, JWT in httpOnly cookie |
| Image storage | Cloudinary |
| Validation | Zod (server), shared schemas where practical |
| Testing | Vitest, Supertest, mongodb-memory-server, Testing Library |
| Hosting | client → Vercel (static), server → Render, DB → Atlas |

### Accepted trade-offs

- **SPA has no server rendering.** Post pages are client-rendered, which weakens SEO and breaks social link previews. Mitigation: a dedicated Express route serves crawler-facing HTML with correct OG/Twitter meta tags for `/blog/:slug`. Full SSR is out of scope.
- **Two deployments** (client and API) rather than one, requiring CORS and cross-site cookie configuration.

## Repository Structure

```
blog/
├─ package.json          npm workspaces; `npm run dev` runs both
├─ client/
│  ├─ src/
│  │  ├─ pages/
│  │  │  ├─ Landing.jsx
│  │  │  ├─ Feed.jsx
│  │  │  ├─ Post.jsx
│  │  │  ├─ AuthorProfile.jsx
│  │  │  ├─ Tag.jsx
│  │  │  ├─ SignUp.jsx  SignIn.jsx
│  │  │  ├─ dashboard/  PostList.jsx  Editor.jsx  ProfileSettings.jsx
│  │  │  └─ admin/      AdminPanel.jsx
│  │  ├─ components/
│  │  │  ├─ layout/     SiteHeader.jsx  SiteFooter.jsx  Shell.jsx
│  │  │  ├─ ui/         Button.jsx  Card.jsx  Badge.jsx  Input.jsx
│  │  │  │              RotatingBadge.jsx  Toast.jsx  ErrorBoundary.jsx
│  │  │  ├─ PostCard.jsx
│  │  │  ├─ BlockRenderer.jsx
│  │  │  └─ RequireAuth.jsx
│  │  ├─ lib/           api.js  useAuth.jsx  slugify.js  video.js
│  │  └─ styles/        tokens.css  index.css
└─ server/
   ├─ src/
   │  ├─ index.js            app bootstrap
   │  ├─ models/             User.js  Post.js
   │  ├─ routes/             auth.js  posts.js  users.js  uploads.js
   │  │                      admin.js  meta.js
   │  ├─ middleware/         requireAuth.js  requireOwnerOrAdmin.js
   │  │                      rateLimit.js  errorHandler.js
   │  ├─ lib/                slug.js  cloudinary.js  video.js  token.js
   │  └─ schemas/            Zod request schemas
   └─ tests/
```

Files stay focused: one page or one concern per file. `BlockRenderer` is the single place block JSON becomes markup, shared by the editor preview and the published post page so the two cannot drift.

## Data Model

### User

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `username` | String | unique, lowercase, `[a-z0-9_-]{3,20}`, used in `/@username` |
| `email` | String | unique, lowercase |
| `passwordHash` | String | bcrypt, cost 12 |
| `displayName` | String | defaults to username |
| `bio` | String | max 280 chars |
| `avatarUrl` | String | Cloudinary URL, nullable |
| `role` | String | `'user' \| 'admin'` — default `'user'` |
| `isBanned` | Boolean | default `false` |
| `createdAt` | Date | |

### Post

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `author` | ObjectId → User | |
| `title` | String | required to publish, max 160 |
| `slug` | String | unique; generated once, never changes on title edit |
| `excerpt` | String | auto-derived from first text block, editable, max 280 |
| `coverImageUrl` | String | nullable |
| `content` | Object | BlockNote block JSON |
| `tags` | [String] | lowercase, max 5, each max 24 chars |
| `status` | String | `'draft' \| 'published'` — default `'draft'` |
| `publishedAt` | Date | set on first publish, nullable |
| `createdAt` / `updatedAt` | Date | |

**Indexes:** `slug` unique · `{ status: 1, publishedAt: -1 }` for the feed · `tags` · `{ author: 1, status: 1 }` for dashboard and profile queries · `username` and `email` unique on User.

### Slug rules

Generated from the title (lowercase, hyphenated, stripped of punctuation). On collision, append a 4-character random suffix: `my-post-a3f9`. Slugs are immutable after creation so published links never break.

### Block types supported

Standard BlockNote blocks (paragraph, headings, lists, quote, code, divider) plus:

- **Image block** — uploaded file, stored as a Cloudinary URL with alt text.
- **Video embed block** — stores the original URL plus the parsed provider (`youtube` | `vimeo`) and video ID. Rendered as a provider iframe. Only those two providers are accepted, which also prevents arbitrary-iframe injection.
- **References block** — a titled list of `{ label, url }` pairs, rendered as a numbered reference list at the point it appears.

## Access Control

| Action | Anonymous | Signed-in user | Admin |
|---|---|---|---|
| Read landing, feed, published posts, profiles, tag pages | ✅ | ✅ | ✅ |
| See Write / dashboard nav | ❌ | ✅ | ✅ |
| Create post | ❌ | ✅ | ✅ |
| Edit / delete post | ❌ | own only | any |
| Read someone else's draft | ❌ | ❌ | ✅ |
| Upload image | ❌ | ✅ | ✅ |
| Unpublish any post, ban user | ❌ | ❌ | ✅ |

- Enforced **server-side** on every write route. Hidden UI is cosmetic, not security.
- Clicking **Write** while signed out redirects to sign-in and then returns to the originally requested destination.
- Banned users can still read, but all write routes return 403.
- The admin role is set directly in the database — there is no UI to grant it, and no route can escalate a user's own role. The first admin is created by signing up normally and then running the documented `npm run make-admin -- <email>` script (a small server script that flips `role` to `'admin'`).

## API

All responses JSON. Errors use one shape: `{ error: { code, message, fields? } }`.

### Auth
- `POST /api/auth/signup` → creates user, sets cookie. 409 on duplicate email/username.
- `POST /api/auth/login` → sets cookie. 401 on bad credentials (generic message, no account-existence leak).
- `POST /api/auth/logout` → clears cookie.
- `GET  /api/auth/me` → current user, or 401.

### Posts
- `GET    /api/posts` → published feed, paginated (`?page`, `?tag`, `?author`), newest first.
- `GET    /api/posts/:slug` → single published post with author summary. Drafts: author or admin only.
- `GET    /api/me/posts` → caller's own posts, drafts included. (Deliberately not `/api/posts/mine`, which would collide with the `:slug` route.)
- `POST   /api/posts` → create draft.
- `PATCH  /api/posts/:id` → update fields / autosave. Owner or admin.
- `POST   /api/posts/:id/publish` → set `published`, stamp `publishedAt`. Requires non-empty title and content.
- `POST   /api/posts/:id/unpublish` → back to draft. Owner or admin.
- `DELETE /api/posts/:id` → hard delete. Owner or admin.

### Users
- `GET   /api/users/:username` → public profile + published posts.
- `PATCH /api/users/me` → update displayName, bio, avatarUrl.

### Uploads
- `POST /api/uploads/image` → multipart, authenticated. Validates MIME **and** magic bytes, 5 MB cap, images only. Returns Cloudinary URL. Cloudinary caps dimensions on transform.

### Admin
- `GET    /api/admin/posts` → all posts, any status.
- `POST   /api/admin/users/:id/ban` and `/unban`.
- Admin takedown uses **unpublish**, not delete — moderation destroys nothing. Hard delete stays available but is a separate deliberate action.

### Meta (crawlers)
- `GET /api/meta/post/:slug` returns minimal HTML containing OG/Twitter tags derived from the post's title, excerpt, and cover image.
- Shared links point at the **client** domain, so that is where previews must resolve. A Vercel Edge Middleware on the client project inspects the User-Agent for `/blog/:slug` requests: known crawlers (facebookexternalhit, Twitterbot, Slackbot, Discordbot, LinkedInBot, WhatsApp, Googlebot, Bingbot) are proxied to the meta route above; everyone else falls through to the SPA unchanged.
- Unknown or spoofed agents simply get the normal SPA — the failure mode is a missing preview, never a broken page.

## Error Handling

- Zod validates every request body and query. Statuses: 400 malformed, 401 unauthenticated, 403 forbidden/banned, 404 missing, 409 duplicate, 422 validation, 429 rate-limited, 500 unexpected.
- Central `errorHandler` middleware; no route builds its own error response.
- **Rate limits:** sign-up 5/hour/IP · sign-in 10/15min/IP · post create 20/hour/user · uploads 30/hour/user.
- **Client:** field-level inline form errors; toasts for transient failures; a route-level error boundary so one bad response never blanks the app.
- **Autosave safety:** the editor debounces saves (~1.5 s idle) and displays an explicit `Saving… / Saved / Retry` indicator. On failure it retries with backoff, keeps the unsaved state in memory, and warns before navigation. Silent data loss is treated as a defect.

## Visual Design

### Tokens

| Token | Value | Use |
|---|---|---|
| `--parchment` | `#EFE9D5` | page background |
| `--ink` | `#14110D` | type, 2px outlines |
| `--mustard` | `#E8B833` | accent, active nav, badges |
| `--card` | `#FAF6E9` | card surfaces |
| `--brick` | `#B4472F` | destructive actions only |

- **Type:** heavy geometric display face (Archivo Black / Anton) for headings at large sizes with tight tracking; calm grotesque for body. The reference's impact comes from scale — headlines are sized accordingly.
- **Signature elements:** 2px ink outlines, hard 4px offset shadows with zero blur, `rounded-2xl` cards, pill buttons, a rotating circular text badge on the landing page, collage hero with overlapping cards rather than a plain grid.
- **Deliberate departure:** brutalism lives in the chrome (nav, cards, buttons, dashboard). The **post reading page goes calm** — single ~68ch column, generous leading, outlines dropped, still on parchment with mustard accents. Heavy outlines around long body text would fight readability, which is a blog's core job.
- The dashboard reuses the same UI primitives so it reads as part of the site, not a bolted-on admin tool.
- No dark mode in v1.

## Testing Strategy

Built test-first.

**Server (Vitest + Supertest + mongodb-memory-server):**
- Sign-up validation, duplicate email/username, password hashing, login/logout, cookie issuance.
- Ownership guard: user B receives 403 editing or deleting user A's post.
- Draft visibility: anonymous and non-owner get 404 for an unpublished post; owner and admin get 200.
- Slug generation and collision suffixing; slug immutability across title edits.
- Publish validation rejects empty title or empty content.
- Upload rejects wrong MIME, mismatched magic bytes, and oversized files.
- Rate limiters return 429 past threshold.
- Banned user receives 403 on all write routes but 200 on reads.
- Admin unpublish and ban.

**Client (Vitest + Testing Library):**
- Signed-out visit to `/dashboard` redirects to sign-in and returns to `/dashboard` after login.
- Editor autosave shows `Saved` on success and `Retry` on failure without losing content.
- Publish flow moves a post from draft to published in the dashboard list.
- `BlockRenderer` renders each block type, including video embeds and the references list.

## Build Order

1. Workspace scaffold, Tailwind + design tokens, UI primitives.
2. Mongoose models, DB connection, error handler, Zod schemas.
3. Auth: sign-up, login, logout, `me`, cookie sessions, rate limits.
4. Post CRUD with ownership guard and slug logic.
5. Cloudinary upload route.
6. BlockNote editor with autosave, image upload, video embed, references block.
7. `BlockRenderer` and the public post page.
8. Landing page, feed, tag pages, author profiles.
9. Dashboard: post list, profile settings.
10. Admin panel.
11. Crawler meta route.
12. Deployment config and environment documentation.

## Environment Variables

**server:** `MONGODB_URI`, `JWT_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLIENT_ORIGIN`, `PORT`
**client:** `VITE_API_URL`

The user supplies the Atlas and Cloudinary credentials; a `.env.example` documents all of them.
