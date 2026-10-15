import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  useEffect(() => {
    if (!loading && !user) toast.error('Faça login para acessar o grid')
  }, [loading, user])
  if (loading)
    return (
      <div className="page-loader">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    )
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}
