import { Navigate, useLocation } from 'react-router-dom'
import type { Role } from '../context/AuthContext'
import { useAuth } from '../context/AuthContext'

type Props = {
  children: React.ReactNode
  roles?: Role[]
}

export function ProtectedRoute({ children, roles }: Props) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-600">
        正在加载...
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // 账号被禁用
  if (profile?.disabled) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center space-y-2 text-sm text-slate-600">
        <p className="text-base font-semibold text-red-600">账号已被管理员禁用</p>
        <p>如需恢复，请联系管理员或教师。</p>
      </div>
    )
  }

  if (roles && roles.length > 0) {
    const matched = roles.includes(profile?.role ?? null)
    if (!matched) {
      return <Navigate to="/unauthorized" replace />
    }
  }

  return <>{children}</>
}



