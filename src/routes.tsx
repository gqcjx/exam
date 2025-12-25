import { createBrowserRouter } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AdminQuestions from './pages/AdminQuestions'
import AdminPapers from './pages/AdminPapers'
import AdminStats from './pages/AdminStats'
import AdminUsers from './pages/AdminUsers'
import AdminGrading from './pages/AdminGrading'
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
import { ProtectedRoute } from './components/ProtectedRoute'

export const router = createBrowserRouter([
  {
    path: '/',
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
      { path: '/unauthorized', element: <Unauthorized /> },
    ],
  },
  {
    path: '*',
    element: <NotFound />,
  },
])

