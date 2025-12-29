/**
 * 移动端登录页面
 * 基于 prototype/login.html 设计
 */

import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase, supabaseReady } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { detectInputType, cleanPhone, isValidPhone } from '../../utils/phoneValidation'
import { signInWithPhone, signInWithName } from '../../api/auth'

const REMEMBER_ME_KEY = 'remembered_account'

export default function LoginMobile() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session } = useAuth()
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f5f5f5] to-[#e8f5e9] px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2E8B57] to-[#3da86a] text-white shadow-lg">
            <i className="fas fa-graduation-cap text-2xl"></i>
          </div>
          <p className="text-sm text-gray-600">已登录，正在跳转...</p>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    if (!supabaseReady) {
      setError('Supabase 环境变量未配置。请在项目根目录创建 .env.local 文件，并设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。')
      return
    }

    if (!account.trim()) {
      setError('请输入姓名 昵称 邮箱')
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
        const cleanedPhone = cleanPhone(account.trim())
        
        if (!isValidPhone(cleanedPhone)) {
          setError('请输入有效的手机号（11位数字）')
          setLoading(false)
          return
        }

        const phoneResult = await signInWithPhone(cleanedPhone, password)
        signInResult = phoneResult
      } else if (inputType === 'email') {
        const emailResult = await supabase.auth.signInWithPassword({
          email: account.trim(),
          password,
        })
        signInResult = {
          data: emailResult.data ? { user: emailResult.data.user, session: emailResult.data.session } : null,
          error: emailResult.error,
        }
      } else {
        const nameResult = await signInWithName(account.trim(), password)
        signInResult = nameResult
      }

      if (signInResult.error) {
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
      
      // AuthContext 会自动更新 session，登录成功后会跳转
      // 不需要手动设置 setLoading(false)，因为页面会跳转
    } catch (err: any) {
      setLoading(false)
      setError(err?.message || '登录失败，请重试')
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] w-full">
      <div className="w-full mx-auto min-h-screen flex flex-col">
        {/* 顶部渐变背景（与个人主页一致） */}
        <div className="bg-gradient-to-r from-[#2E8B57] to-[#3da86a] text-white px-6 pt-16 pb-12">
          {/* Logo 区域 */}
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-4 shadow-lg">
              <i className="fas fa-graduation-cap text-white text-3xl"></i>
            </div>
            <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              在线检测系统
            </h1>
            <p className="text-sm opacity-90">欢迎回来，请登录您的账户</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col px-6 py-8 -mt-6">

          {/* 登录表单卡片 */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <form className="space-y-5" onSubmit={handleSubmit}>
              {/* 姓名 昵称 邮箱输入 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <i className="fas fa-user text-[#2E8B57] mr-2"></i>姓名 昵称 邮箱
                </label>
                <input 
                  type="text" 
                  placeholder="请输入姓名 昵称 邮箱"
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:outline-none focus:border-[#2E8B57] transition-all"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  required
                />
              </div>

              {/* 密码输入 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <i className="fas fa-lock text-[#2E8B57] mr-2"></i>密码
                </label>
                <div className="relative">
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    placeholder="请输入密码"
                    className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:outline-none focus:border-[#2E8B57] transition-all"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>

              {/* 记住我和忘记密码 */}
              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 text-[#2E8B57] border-gray-300 rounded focus:ring-[#2E8B57]"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span className="ml-2 text-sm text-gray-600">记住我</span>
                </label>
                <Link to="/reset" className="text-sm text-[#2E8B57] hover:underline">
                  忘记密码？
                </Link>
              </div>

              {/* 错误提示 */}
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* 登录按钮 */}
              <button 
                type="submit"
                className="w-full py-3 rounded-lg text-white font-semibold text-base shadow-md bg-gradient-to-r from-[#2E8B57] to-[#3da86a] hover:from-[#3da86a] hover:to-[#2E8B57] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2"></span>
                    登录中...
                  </span>
                ) : (
                  <>
                    <i className="fas fa-sign-in-alt mr-2"></i>登录
                  </>
                )}
              </button>

              {/* 分割线 */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-gradient-to-br from-[#f5f5f5] to-[#e8f5e9] text-gray-500">或</span>
                </div>
              </div>

              {/* 注册链接 */}
              <div className="text-center">
                <p className="text-sm text-gray-600">
                  还没有账户？
                  <Link to="/register" className="text-[#2E8B57] font-semibold hover:underline ml-1">
                    立即注册
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
