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
