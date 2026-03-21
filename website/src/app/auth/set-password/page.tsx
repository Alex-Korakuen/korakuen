'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DEFAULT_ROUTE } from '@/lib/constants'
import { AuthLayout } from '@/components/auth-layout'
import { FormInput } from '@/components/ui/form-input'
import { validatePassword } from '@/lib/validate-password'
import { btnAuthPrimary } from '@/lib/styles'

export default function SetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const validationError = validatePassword(password, confirmPassword)
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      password,
      data: { password_set: true },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push(DEFAULT_ROUTE)
    router.refresh()
  }

  return (
    <AuthLayout>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-ink">
          Set Your Password
        </h2>
        <p className="mt-1 text-sm text-muted">
          Choose a password for your account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormInput
          id="password"
          label="New password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />

        <FormInput
          id="confirm-password"
          label="Confirm password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
          placeholder="Re-enter your password"
        />

        {error && (
          <p className="text-sm text-negative">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`w-full ${btnAuthPrimary}`}
        >
          {loading ? 'Setting password...' : 'Set Password'}
        </button>
      </form>
    </AuthLayout>
  )
}
