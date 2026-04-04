/** Log the real DB error server-side and surface its message to the client. */
export function handleDbError(error: unknown, context: string): string {
  console.error(`[${context}]`, error)
  const detail =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message: unknown }).message)
      : null
  return detail ? `${context}: ${detail}` : context
}
