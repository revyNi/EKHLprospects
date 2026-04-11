'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setIsSubmitting(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setMessage(error.message)
      setIsSubmitting(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  async function continueWithGoogle() {
    setMessage('')

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined,
      },
    })

    if (error) {
      setMessage(error.message)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card auth-card-narrow">
        <h1 className="auth-title">Sign in to your account</h1>

        <div className="auth-social-row auth-social-row-single">
          <button type="button" className="auth-social-button" onClick={continueWithGoogle}>
            Continue with Google
          </button>
        </div>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span className="auth-label">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="auth-input"
              required
            />
          </label>

          <label className="auth-field">
            <span className="auth-label">Password</span>
            <div className="auth-password-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="auth-input auth-input-password"
                required
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>

          <div className="auth-helper-row">
            <button
              type="button"
              className="auth-text-button"
              onClick={() =>
                setMessage(
                  email.trim()
                    ? 'Reset password can be added next through Supabase reset emails.'
                    : 'Enter your email first, then I can wire a reset flow next.'
                )
              }
            >
              Forgot password? Reset password
            </button>
          </div>

          {message ? <div className="auth-message">{message}</div> : null}

          <button type="submit" className="auth-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        <div className="auth-footer-copy">
          New to EKHL prospects? <Link href="/sign-up">Register here</Link>
        </div>
      </div>
    </main>
  )
}
