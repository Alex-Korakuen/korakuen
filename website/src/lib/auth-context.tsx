'use client'

import { createContext, useContext } from 'react'

type AuthContextValue = {
  isAdmin: boolean
  partnerName: string
}

const AuthContext = createContext<AuthContextValue>({
  isAdmin: false,
  partnerName: '',
})

export function AuthProvider({
  isAdmin,
  partnerName,
  children,
}: {
  isAdmin: boolean
  partnerName: string
  children: React.ReactNode
}) {
  return (
    <AuthContext.Provider value={{ isAdmin, partnerName }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
