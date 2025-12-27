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
import GameRanking from './pages/GameRanking'
import { ProtectedRoute } from './components/ProtectedRoute'

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
      { path: '/login', element: <Login /> },
       { path: '/register', element: <Register /> },
       { path: '/reset', element: <ResetPassword /> },
      {
        path: '/dashboard',
        element: (
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: '/settings',
        element: (
          <ProtectedRoute>
            <Settings />
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
            <Exam />
          </ProtectedRoute>
        ),
      },
      {
        path: '/result/:paperId',
        element: (
          <ProtectedRoute roles={['student', 'parent', 'teacher', 'admin']}>
            <Result />
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
            <WrongQuestions />
          </ProtectedRoute>
        ),
      },
      {
        path: '/ranking',
        element: (
          <ProtectedRoute>
            <Ranking />
          </ProtectedRoute>
        ),
      },
      {
        path: '/report',
        element: (
          <ProtectedRoute>
            <Report />
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
      {
        path: '/game/ranking',
        element: (
          <ProtectedRoute>
            <GameRanking />
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
      
      // 如果访问的是 /exam/index.html，重定向到 /exam/
      if (window.location.pathname === '/exam/index.html') {
        const search = window.location.search
        const hash = window.location.hash
        window.history.replaceState(null, '', '/exam/' + search + hash)
      }
      
      // 检查是否在 Netlify 域名下，或者路径不是以 /exam 开头
      const isNetlify = window.location.hostname.includes('netlify.app') || 
                       window.location.hostname.includes('netlify.com')
      const pathStartsWithExam = window.location.pathname.startsWith('/exam')
      // 如果在 Netlify 且路径不是 /exam 开头，使用根路径
      if (isNetlify && !pathStartsWithExam) return ''
      // 否则使用 /exam（兼容 GitHub Pages）
      return '/exam'
    })(),
  }
)

