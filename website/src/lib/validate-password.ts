/** Validate password + confirmation — returns error message or null if valid */
export function validatePassword(password: string, confirmPassword: string): string | null {
  if (password !== confirmPassword) {
    return 'Passwords do not match.'
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters.'
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must include an uppercase letter.'
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must include a lowercase letter.'
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must include a number.'
  }
  return null
}

/** Human-readable summary of password requirements (for placeholder text) */
export const PASSWORD_HINT = '8+ chars, upper, lower, number'
