# Parchment

A public multi-user blog. Anyone can read; anyone with an account can write, edit
and delete their own posts from a dashboard, with images, embedded video and
reference links.

## Stack

React 19 + Vite + Tailwind 4 + BlockNote · Node + Express + Mongoose · MongoDB
Atlas · Cloudinary for images · JWT sessions in an httpOnly cookie.

## Local setup

1. `npm install` (from the repo root — this is an npm workspace)
2. `server/.env` holds the API config:
   - `MONGODB_URI` — MongoDB Atlas connection string including a database name
   - `JWT_SECRET` — `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
   - `CLIENT_ORIGIN` — `http://localhost:5173`
3. `client/.env` holds `VITE_API_URL=http://localhost:4000`
4. `npm run dev` — API on :4000, web on :5173

## Tests

`npm test` runs both suites. `npm test -w server` and `npm test -w client` run one
side. The server suite uses an in-memory MongoDB, so no database is needed.

## Making yourself an admin

Sign up normally, then:

```bash
npm run make-admin -w server -- you@example.com
```

No API route grants the admin role — it is database-only by design.

## Deploying

**API (Render):** point Render at this repo; `render.yaml` describes the service.
Set every `sync: false` variable in the dashboard, with `CLIENT_ORIGIN` set to
your deployed web origin.

**Web (Vercel):** import the repo with root directory `client`. Set
`VITE_API_URL` to the Render URL. `vercel.json` handles SPA routing and
`middleware.js` serves Open Graph tags to crawlers so shared links preview.

Cookies are `SameSite=None; Secure` in production, so both halves must be HTTPS.

## Moderation

Admins can unpublish any post (hiding it without destroying it) and ban accounts
from publishing. Banned users can still read and can still take their own posts
down.
