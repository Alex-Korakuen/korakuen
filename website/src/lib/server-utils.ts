/** Log the real DB error server-side; return a safe generic message for the client. */
export function handleDbError(error: unknown, context: string): string {
  console.error(`[${context}]`, error)
  return context
}
