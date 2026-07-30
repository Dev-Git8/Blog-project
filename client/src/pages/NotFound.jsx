import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-5 py-24 text-center">
      <h1 className="display text-6xl">Nothing here</h1>
      <p className="mt-4">That page does not exist.</p>
      <Link
        to="/"
        className="mt-6 inline-block font-semibold underline decoration-mustard decoration-2"
      >
        Back to the start
      </Link>
    </div>
  )
}
