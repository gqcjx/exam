import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase, supabaseReady } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { detectInputType, cleanPhone, isValidPhone } from '../utils/phoneValidation'
import { signInWithPhone, signInWithName } from '../api/auth'

const REMEMBER_ME_KEY = 'remembered_account'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session } = useAuth()
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const redirectTo = (location.state as any)?.from?.pathname || '/dashboard'

  // 加载记住的账号
  useEffect(() => {
    const rememberedAccount = localStorage.getItem(REMEMBER_ME_KEY)
    if (rememberedAccount) {
      setAccount(rememberedAccount)
      setRememberMe(true)
    }
  }, [])

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

    if (!account.trim()) {
      setError('请输入账号/邮箱或手机号')
      return
    }

    if (!password.trim()) {
      setError('请输入密码')
      return
    }
    
    setLoading(true)

    try {
      const inputType = detectInputType(account.trim())
      let signInResult: { data: { user: any; session: any } | null; error: any }

      if (inputType === 'phone') {
        // 手机号登录：通过手机号找到邮箱，然后使用邮箱登录
        const cleanedPhone = cleanPhone(account.trim())
        
        if (!isValidPhone(cleanedPhone)) {
          setError('请输入有效的手机号（11位数字）')
          setLoading(false)
          return
        }

        const phoneResult = await signInWithPhone(cleanedPhone, password)
        signInResult = phoneResult
      } else if (inputType === 'email') {
        // 邮箱登录
        const emailResult = await supabase.auth.signInWithPassword({
          email: account.trim(),
          password,
        })
        signInResult = {
          data: emailResult.data ? { user: emailResult.data.user, session: emailResult.data.session } : null,
          error: emailResult.error,
        }
      } else {
        // 姓名或昵称登录：通过姓名找到邮箱，然后使用邮箱登录
        const nameResult = await signInWithName(account.trim(), password)
        signInResult = nameResult
      }

      if (signInResult.error) {
        // 友好的错误提示
        if (signInResult.error.message?.includes('Invalid login credentials')) {
          setError('账号或密码错误，请检查后重试')
        } else if (signInResult.error.message?.includes('Email not confirmed')) {
          setError('邮箱未验证，请先验证邮箱后再登录')
        } else {
          setError(signInResult.error.message || '登录失败，请重试')
        }
        setLoading(false)
        return
      }
      
      // 处理"记住我"
      if (rememberMe && account.trim()) {
        localStorage.setItem(REMEMBER_ME_KEY, account.trim())
      } else {
        localStorage.removeItem(REMEMBER_ME_KEY)
      }
      
      // 登录成功：等待 profile 加载后显示欢迎信息
      if (signInResult.data?.user) {
        // 延迟一下，等待 profile 加载
        setTimeout(async () => {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('role, name')
            .eq('user_id', signInResult.data!.user.id)
            .single()
          
          if (profileData) {
            const roleNames: Record<string, string> = {
              student: '学生',
              parent: '家长',
              teacher: '教师',
              admin: '管理员',
            }
            const roleName = roleNames[profileData.role || ''] || '用户'
            // 欢迎信息会在 Dashboard 中显示，这里只做登录
          }
        }, 500)
      }
      
      // AuthContext 的 onAuthStateChange 会自动更新 session
      // useEffect 会监听 session 变化并自动跳转，无需手动 navigate
    } catch (err: any) {
      setLoading(false)
      setError(err?.message || '登录失败，请重试')
    }
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
            <p className="mt-1 text-sm text-slate-500">使用姓名、昵称、邮箱或手机号和密码登录您的账户</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">姓名/昵称/邮箱/手机号</label>
              <input
                type="text"
                placeholder="请输入您的姓名、昵称、邮箱或手机号"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                required
              />
              <p className="text-xs text-slate-500">学生账号不支持手机号登录</p>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">密码</label>
              <input
                type="password"
                placeholder="请输入您的密码"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm text-slate-700">记住我</span>
              </label>
              <Link
                to="/reset"
                className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                忘记密码？
              </Link>
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
                '登 录'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600">
              还没有账号？
              <Link
                to="/register"
                className="ml-1 font-medium text-brand-600 transition-colors hover:text-brand-700"
              >
                免费注册
              </Link>
            </p>
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
