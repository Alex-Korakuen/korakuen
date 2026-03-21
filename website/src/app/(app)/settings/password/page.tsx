'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FormInput } from '@/components/ui/form-input'
import { validatePassword } from '@/lib/validate-password'
import { btnAuthPrimary } from '@/lib/styles'

export default function ChangePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const validationError = validatePassword(password, confirmPassword)
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setPassword('')
    setConfirmPassword('')
    setLoading(false)
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <div className="rounded-[10px] border border-edge bg-white px-8 py-8 ">
        <h1 className="text-lg font-semibold text-ink">
          Change Password
        </h1>
        <p className="mt-1 mb-6 text-sm text-muted">
          Enter a new password for your account.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormInput
            id="new-password"
            label="New password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />

          <FormInput
            id="confirm-new-password"
            label="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            placeholder="Re-enter your new password"
          />

          {error && (
            <p className="text-sm text-negative">{error}</p>
          )}

          {success && (
            <p className="text-sm text-positive">
              Password updated successfully.
            </p>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="text-sm font-medium text-muted hover:text-ink"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className={btnAuthPrimary}
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
