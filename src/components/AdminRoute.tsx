import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'ecmalayalam@gmail.com'

interface AdminRouteProps {
  children: React.ReactNode
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { user, isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (user?.email !== ADMIN_EMAIL) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
