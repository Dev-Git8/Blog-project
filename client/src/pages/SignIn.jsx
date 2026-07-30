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
            <p
              role="alert"
              className="rounded-xl border-2 border-brick px-3 py-2 text-sm font-medium text-brick"
            >
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
