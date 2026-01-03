import { createBrowserRouter, Navigate } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AdminQuestions from './pages/AdminQuestions'
import AdminPapers from './pages/AdminPapers'
import AdminStats from './pages/AdminStats'
import AdminUsers from './pages/AdminUsers'
import AdminGrading from './pages/AdminGrading'
import AdminConfig from './pages/AdminConfig'
import AdminInviteCodes from './pages/AdminInviteCodes'
import AdminImportStudents from './pages/AdminImportStudents'
import Exam from './pages/Exam'
import Result from './pages/Result'
import Parent from './pages/Parent'
import WrongQuestions from './pages/WrongQuestions'
import Ranking from './pages/Ranking'
import Report from './pages/Report'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'
import NotFound from './pages/NotFound'
import Unauthorized from './pages/Unauthorized'
import Register from './pages/Register'
import ResetPassword from './pages/ResetPassword'
import Settings from './pages/Settings'
import GameDazui from './pages/GameDazui'
import { ProtectedRoute } from './components/ProtectedRoute'
// 移动端组件
import LoginMobile from './pages/mobile/LoginMobile'
import DashboardMobile from './pages/mobile/DashboardMobile'
import ExamMobile from './pages/mobile/ExamMobile'
import ResultMobile from './pages/mobile/ResultMobile'
import WrongQuestionsMobile from './pages/mobile/WrongQuestionsMobile'
import RankingMobile from './pages/mobile/RankingMobile'
import ReportMobile from './pages/mobile/ReportMobile'
import SettingsMobile from './pages/mobile/SettingsMobile'
import { DeviceAwareRoute } from './components/DeviceAwareRoute'

export const router = createBrowserRouter(
  [
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/landing',
    element: <Landing />,
    errorElement: <NotFound />,
  },
  {
    path: '/terms',
    element: <Terms />,
  },
  {
    path: '/privacy',
    element: <Privacy />,
  },
  {
    element: <AppLayout />,
    children: [
      { 
        path: '/login', 
        element: (
          <DeviceAwareRoute
            mobileComponent={<LoginMobile />}
            desktopComponent={<Login />}
            requireAuth={false}
          />
        )
      },
       { path: '/register', element: <Register /> },
       { path: '/reset', element: <ResetPassword /> },
      {
        path: '/dashboard',
        element: (
          <ProtectedRoute>
            <DeviceAwareRoute
              mobileComponent={<DashboardMobile />}
              desktopComponent={<Dashboard />}
              roles={['student']}
            />
          </ProtectedRoute>
        ),
      },
      {
        path: '/settings',
        element: (
          <ProtectedRoute>
            <DeviceAwareRoute
              mobileComponent={<SettingsMobile />}
              desktopComponent={<Settings />}
              roles={['student']}
            />
          </ProtectedRoute>
        ),
      },
      {
        path: '/admin/questions',
        element: (
          <ProtectedRoute roles={['admin', 'teacher']}>
            <AdminQuestions />
          </ProtectedRoute>
        ),
      },
      {
        path: '/admin/papers',
        element: (
          <ProtectedRoute roles={['admin', 'teacher']}>
            <AdminPapers />
          </ProtectedRoute>
        ),
      },
      {
        path: '/admin/stats',
        element: (
          <ProtectedRoute roles={['admin', 'teacher']}>
            <AdminStats />
          </ProtectedRoute>
        ),
      },
      {
        path: '/admin/users',
        element: (
          <ProtectedRoute roles={['admin']}>
            <AdminUsers />
          </ProtectedRoute>
        ),
      },
      {
        path: '/admin/grading',
        element: (
          <ProtectedRoute roles={['admin', 'teacher']}>
            <AdminGrading />
          </ProtectedRoute>
        ),
      },
      {
        path: '/admin/config',
        element: (
          <ProtectedRoute roles={['admin', 'teacher']}>
            <AdminConfig />
          </ProtectedRoute>
        ),
      },
      {
        path: '/admin/invite-codes',
        element: (
          <ProtectedRoute roles={['admin']}>
            <AdminInviteCodes />
          </ProtectedRoute>
        ),
      },
      {
        path: '/admin/import-students',
        element: (
          <ProtectedRoute roles={['admin', 'teacher']}>
            <AdminImportStudents />
          </ProtectedRoute>
        ),
      },
      {
        path: '/exam/:paperId',
        element: (
          <ProtectedRoute roles={['student']}>
            <DeviceAwareRoute
              mobileComponent={<ExamMobile />}
              desktopComponent={<Exam />}
              roles={['student']}
            />
          </ProtectedRoute>
        ),
      },
      {
        path: '/result/:paperId',
        element: (
          <ProtectedRoute roles={['student', 'parent', 'teacher', 'admin']}>
            <DeviceAwareRoute
              mobileComponent={<ResultMobile />}
              desktopComponent={<Result />}
              roles={['student']}
            />
          </ProtectedRoute>
        ),
      },
      {
        path: '/parent',
        element: (
          <ProtectedRoute roles={['parent']}>
            <Parent />
          </ProtectedRoute>
        ),
      },
      {
        path: '/wrong-questions',
        element: (
          <ProtectedRoute roles={['student']}>
            <DeviceAwareRoute
              mobileComponent={<WrongQuestionsMobile />}
              desktopComponent={<WrongQuestions />}
              roles={['student']}
            />
          </ProtectedRoute>
        ),
      },
      {
        path: '/ranking',
        element: (
          <ProtectedRoute>
            <DeviceAwareRoute
              mobileComponent={<RankingMobile />}
              desktopComponent={<Ranking />}
              roles={['student']}
            />
          </ProtectedRoute>
        ),
      },
      {
        path: '/report',
        element: (
          <ProtectedRoute>
            <DeviceAwareRoute
              mobileComponent={<ReportMobile />}
              desktopComponent={<Report />}
              roles={['student']}
            />
          </ProtectedRoute>
        ),
      },
      {
        path: '/game/dazui',
        element: (
          <ProtectedRoute roles={['student']}>
            <GameDazui />
          </ProtectedRoute>
        ),
      },
      { path: '/unauthorized', element: <Unauthorized /> },
    ],
  },
  {
    path: '*',
    element: <NotFound />,
  },
  ],
  {
    // 根据环境变量和路径决定 basename
    // Netlify: 使用根路径 ''
    // GitHub Pages: 使用子路径 '/exam'
    basename: (() => {
      if (typeof window === 'undefined') return '/exam'
      
      const currentPath = window.location.pathname
      
      // 如果访问的是 /exam/index.html，重定向到 /exam/
      if (currentPath === '/exam/index.html') {
        const search = window.location.search
        const hash = window.location.hash
        window.history.replaceState(null, '', '/exam/' + search + hash)
        return '/exam'
      }
      
      // 检查是否在 Netlify 域名下
      const isNetlify = window.location.hostname.includes('netlify.app') || 
                       window.location.hostname.includes('netlify.com')
      
      // 如果访问根路径 "/"，使用空 basename
      if (currentPath === '/' || currentPath === '') {
        return ''
      }
      
      // 如果路径以 /exam 开头，使用 /exam 作为 basename
      if (currentPath.startsWith('/exam')) {
        return '/exam'
      }
      
      // 如果在 Netlify 且路径不是 /exam 开头，使用根路径
      if (isNetlify) {
        return ''
      }
      
      // 默认使用 /exam（兼容 GitHub Pages）
      return '/exam'
    })(),
  }
)

