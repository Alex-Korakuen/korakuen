'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface HeaderProps {
  partnerName: string
}

export function Header({ partnerName }: HeaderProps) {
  const router = useRouter()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false)
      }
    }

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-4">
      {/* Left: Branding */}
      <div className="flex items-center">
        {/* Spacer for mobile hamburger button */}
        <div className="w-10 md:hidden" />
        <span className="text-lg font-bold tracking-widest text-zinc-800">
          KORAKUEN
        </span>
      </div>

      {/* Right: Partner dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
        >
          <span>{partnerName}</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
          >
            <polyline points="3 5 6 8 9 5" />
          </svg>
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 mt-1 w-48 rounded-md border border-zinc-200 bg-white py-1 shadow-lg">
            <Link
              href="/settings/password"
              className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              onClick={() => setDropdownOpen(false)}
            >
              Change Password
            </Link>
            <button
              onClick={handleSignOut}
              className="block w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
