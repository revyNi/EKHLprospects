'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'

export default function SignUpPage() {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [acceptedPolicy, setAcceptedPolicy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')

    if (!acceptedPolicy) {
      setMessage('Please accept the Privacy Policy to continue.')
      return
    }

    setIsSubmitting(true)

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        },
      },
    })

    if (error) {
      setMessage(error.message)
      setIsSubmitting(false)
      return
    }

    if (data.session) {
      router.push('/')
      router.refresh()
      return
    }

    setMessage('Account created. Check your email to confirm your account if confirmation is enabled.')
    setIsSubmitting(false)
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
      <div className="auth-card">
        <h1 className="auth-title">Create your account</h1>

        <div className="auth-social-row auth-social-row-single">
          <button type="button" className="auth-social-button" onClick={continueWithGoogle}>
            Continue with Google
          </button>
        </div>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-two-col">
            <label className="auth-field">
              <span className="auth-label">First Name *</span>
              <input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="auth-input"
                required
              />
            </label>

            <label className="auth-field">
              <span className="auth-label">Last Name *</span>
              <input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className="auth-input"
                required
              />
            </label>
          </div>

          <label className="auth-field">
            <span className="auth-label">Email *</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="auth-input"
              required
            />
          </label>

          <label className="auth-field">
            <span className="auth-label">Set a password *</span>
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

          <label className="auth-check-row">
            <input
              type="checkbox"
              checked={acceptedPolicy}
              onChange={(event) => setAcceptedPolicy(event.target.checked)}
            />
            <span>
              I accept the <span className="auth-inline-link">Privacy Policy</span>
            </span>
          </label>

          {message ? <div className="auth-message">{message}</div> : null}

          <button type="submit" className="auth-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create account'}
          </button>
        </form>

        <div className="auth-footer-copy">
          Already have an account? <Link href="/sign-in">Log in</Link>
        </div>
      </div>
    </main>
  )
}
