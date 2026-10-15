import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import pb from '@/lib/pocketbase/client'

export interface AuthUser {
  id: string
  email: string
  name: string
  avatar?: string
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string, passwordConfirm: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const mapUser = (record: Record<string, unknown>): AuthUser => ({
  id: String(record.id ?? ''),
  email: String(record.email ?? ''),
  name: String(record.name ?? record.email ?? 'Manager'),
  avatar: String(record.avatar ?? ''),
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() =>
    pb.authStore.record ? mapUser(pb.authStore.record as unknown as Record<string, unknown>) : null,
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const remove = pb.authStore.onChange(
      (_token, record) =>
        setUser(record ? mapUser(record as unknown as Record<string, unknown>) : null),
      true,
    )
    setLoading(false)
    return remove
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login: async (email, password) => {
        const auth = await pb.collection('users').authWithPassword(email, password)
        setUser(mapUser(auth.record as unknown as Record<string, unknown>))
      },
      signup: async (name, email, password, passwordConfirm) => {
        await pb.collection('users').create({ name, email, password, passwordConfirm })
        await pb.collection('users').requestVerification(email)
      },
      logout: () => {
        pb.authStore.clear()
        setUser(null)
      },
      refresh: async () => {
        if (pb.authStore.isValid) {
          const auth = await pb.collection('users').authRefresh()
          setUser(mapUser(auth.record as unknown as Record<string, unknown>))
        }
      },
    }),
    [loading, user],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return value
}
