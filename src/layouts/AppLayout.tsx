import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { NotificationBell } from '../components/NotificationBell'
import { UserMenu } from '../components/UserMenu'
import { isMobileDevice } from '../utils/deviceDetection'

const adminNavItems = [
  { to: '/admin/questions', label: '题库' },
  { to: '/admin/papers', label: '试卷' },
  { to: '/admin/grading', label: '批阅' },
  { to: '/admin/stats', label: '统计' },
  { to: '/admin/users', label: '用户' },
  { to: '/admin/invite-codes', label: '邀请码' },
  { to: '/admin/config', label: '配置' },
]

const teacherNavItems = [
  { to: '/admin/questions', label: '题库' },
  { to: '/admin/papers', label: '试卷' },
  { to: '/admin/grading', label: '批阅' },
  { to: '/admin/stats', label: '统计' },
  { to: '/admin/config', label: '配置' },
]

const studentNavItems = [
  { to: '/wrong-questions', label: '错题本' },
  { to: '/ranking', label: '排行榜' },
  { to: '/report', label: '成绩报表' },
]

const parentNavItems = [
  { to: '/parent', label: '家长端' },
]

export default function AppLayout() {
  const { session, profile, loading, signOut } = useAuth()
  const location = useLocation()
  const isMobile = isMobileDevice()
  const isStudent = profile?.role === 'student'
  
  // 移动端学生用户不显示顶部导航栏（使用移动端底部导航）
  const hideHeader = isMobile && isStudent && (
    location.pathname === '/dashboard' ||
    location.pathname.startsWith('/exam/') ||
    location.pathname.startsWith('/result/') ||
    location.pathname === '/wrong-questions' ||
    location.pathname === '/ranking' ||
    location.pathname === '/report' ||
    location.pathname === '/settings'
  )
  
  const getNavItems = () => {
    if (!profile) return []
    if (profile.role === 'admin') return adminNavItems
    if (profile.role === 'teacher') return teacherNavItems
    if (profile.role === 'parent') return parentNavItems
    return studentNavItems
  }
  
  const navItems = getNavItems()
  
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {!hideHeader && (
        <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">QF</span>
            <span>青锋测</span>
          </Link>
          {navItems.length > 0 && (
            <nav className="flex items-center gap-3 text-sm font-medium text-slate-600">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 transition-colors ${
                      isActive ? 'bg-brand-50 text-brand-700' : 'hover:bg-slate-100'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}
          <div className="flex items-center gap-2">
            {loading ? (
              <span className="text-xs text-slate-500">加载中...</span>
            ) : session && profile ? (
              <>
                <NotificationBell />
                <UserMenu />
              </>
            ) : session ? (
              <>
                <NotificationBell />
                <span className="text-sm text-slate-500">
                  {session.user.email} (等待档案...)
                </span>
                <button className="btn btn-secondary" onClick={() => signOut()}>
                  退出
                </button>
              </>
            ) : (
              <Link to="/login" className="btn btn-secondary">
                登录
              </Link>
            )}
          </div>
        </div>
      </header>
      )}
      <main className={`mx-auto w-full ${hideHeader ? 'px-0 py-0' : 'max-w-6xl px-6 py-6'}`}>
        <Outlet />
      </main>
    </div>
  )
}

