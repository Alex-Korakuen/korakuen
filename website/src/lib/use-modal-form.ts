'use client'

import { useState, useTransition, useCallback } from 'react'

/**
 * Manages the isPending / error / close lifecycle common to all form modals.
 * Field state stays with the consumer — this hook only owns the transition wrapper.
 *
 * @param onClose - parent callback to close the modal
 * @param resetFields - resets all field-specific state to initial values
 */
export function useModalForm<E = string>(
  onClose: () => void,
  resetFields: () => void
) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<E | null>(null)

  const resetForm = useCallback(() => {
    resetFields()
    setError(null)
  }, [resetFields])

  const handleClose = useCallback(() => {
    resetForm()
    onClose()
  }, [resetForm, onClose])

  /** Wraps validation + async server action + error handling */
  const submit = useCallback((action: () => Promise<{ error?: E }>) => {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (result.error) {
        setError(result.error)
      } else {
        handleClose()
      }
    })
  }, [handleClose])

  return { isPending, error, setError, handleClose, submit }
}
