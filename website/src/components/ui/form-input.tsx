import type { InputHTMLAttributes } from 'react'
import { formFieldLabel } from '@/lib/styles'

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
}

export function FormInput({ label, id, className, ...props }: FormInputProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className={formFieldLabel}
      >
        {label}
      </label>
      <input
        id={id}
        className={`block w-full rounded-md border border-edge px-3 py-2 text-sm text-ink placeholder-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent${className ? ` ${className}` : ''}`}
        {...props}
      />
    </div>
  )
}
