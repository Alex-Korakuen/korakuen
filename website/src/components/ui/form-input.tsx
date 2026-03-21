import type { InputHTMLAttributes } from 'react'

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
}

export function FormInput({ label, id, className, ...props }: FormInputProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-ink"
      >
        {label}
      </label>
      <input
        id={id}
        className={`mt-1 block w-full rounded-md border border-edge px-3 py-2 text-sm text-ink placeholder-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent${className ? ` ${className}` : ''}`}
        {...props}
      />
    </div>
  )
}
