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
