import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase, supabaseReady } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const redirectTo = (location.state as any)?.from?.pathname || '/dashboard'

  // 如果已登录，重定向到目标页面
  useEffect(() => {
    if (session) {
      navigate(redirectTo, { replace: true })
    }
  }, [session, navigate, redirectTo])

  // 如果正在加载，显示加载状态
  if (session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-brand-50/30 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl ring-1 ring-slate-200/60 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 text-white shadow-lg">
            <span className="text-2xl font-bold">QF</span>
          </div>
          <p className="text-sm text-slate-600">已登录，正在跳转...</p>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    if (!supabaseReady) {
      setError('Supabase 环境变量未配置。请在项目根目录创建 .env.local 文件，并设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY（使用 anon/public key，不是 service role key）。')
      return
    }
    
    setLoading(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    setLoading(false)
    if (signInError) {
      setError(signInError.message)
      return
    }
    
    // 登录成功：AuthContext 的 onAuthStateChange 会自动更新 session
    // useEffect 会监听 session 变化并自动跳转，无需手动 navigate
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-brand-50/30 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo 和标题区域 */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 text-white shadow-lg">
            <span className="text-2xl font-bold">QF</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">青锋测</h1>
          <p className="mt-2 text-sm text-slate-600">中小学在线考试平台</p>
        </div>

        {/* 登录表单卡片 */}
        <div className="rounded-2xl bg-white p-8 shadow-xl ring-1 ring-slate-200/60">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900">欢迎登录</h2>
            <p className="mt-1 text-sm text-slate-500">使用邮箱和密码登录您的账户</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">邮箱地址</label>
              <input
                type="email"
                placeholder="请输入您的邮箱"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">密码</label>
              <input
                type="password"
                placeholder="请输入您的密码"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              className="w-full rounded-lg bg-gradient-to-r from-brand-600 to-brand-700 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:from-brand-700 hover:to-brand-800 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                  登录中...
                </span>
              ) : (
                '登录'
              )}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-6">
            <Link
              to="/register"
              className="text-sm font-medium text-brand-600 transition-colors hover:text-brand-700"
            >
              注册账号
            </Link>
            <Link
              to="/reset"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              忘记密码？
            </Link>
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">
            登录即表示同意
            <Link to="/terms" className="mx-1 font-medium text-brand-600 underline hover:text-brand-700">
              使用条款
            </Link>
            和
            <Link to="/privacy" className="mx-1 font-medium text-brand-600 underline hover:text-brand-700">
              隐私说明
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

