'use client'

import ReactMarkdown from 'react-markdown'

interface NotesDisplayProps {
  notes: string | null | undefined
  className?: string
}

// Renders notes with basic markdown support (bold for now).
// Strips everything except bold (**text**) and line breaks.
export function NotesDisplay({ notes, className = '' }: NotesDisplayProps) {
  if (!notes) return null

  return (
    <div className={`whitespace-pre-wrap text-sm text-muted ${className}`}>
      <ReactMarkdown
        allowedElements={['p', 'strong']}
        unwrapDisallowed
      >
        {notes}
      </ReactMarkdown>
    </div>
  )
}
