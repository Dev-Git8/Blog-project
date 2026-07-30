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
