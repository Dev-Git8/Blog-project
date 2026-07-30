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
