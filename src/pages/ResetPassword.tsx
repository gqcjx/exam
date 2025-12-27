import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, supabaseReady } from '../lib/supabaseClient'
import { detectInputType, cleanPhone, isValidPhone } from '../utils/phoneValidation'
import { findUserByAccount } from '../api/auth'

export default function ResetPassword() {
  const [account, setAccount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    
    if (!supabaseReady) {
      setError('Supabase 环境变量未配置。请在项目根目录创建 .env.local 文件，并设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY（使用 anon/public key，不是 service role key）。')
      return
    }

    if (!account.trim()) {
      setError('请输入邮箱或手机号')
      return
    }
    
    setLoading(true)

    try {
      const inputType = detectInputType(account.trim())

      if (inputType === 'phone') {
        // 手机号找回密码：通过手机号找到邮箱，然后使用邮箱找回
        const cleanedPhone = cleanPhone(account.trim())
        
        if (!isValidPhone(cleanedPhone)) {
          setError('请输入有效的手机号（11位数字）')
          setLoading(false)
          return
        }

        // 通过手机号查找用户邮箱
        const userInfo = await findUserByAccount(cleanedPhone)
        
        if (!userInfo || !userInfo.email) {
          setError('未找到该手机号对应的账号')
          setLoading(false)
          return
        }

        // 使用邮箱发送重置链接
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(userInfo.email, {
          redirectTo: `${window.location.origin}/login`,
        })

        if (resetError) {
          setError(resetError.message)
          setLoading(false)
          return
        }

        setSuccess('重置邮件已发送到您的注册邮箱，请查收并按提示完成密码更新。')
      } else if (inputType === 'email') {
        // 邮箱找回密码
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(account.trim(), {
          redirectTo: `${window.location.origin}/login`,
        })

        if (resetError) {
          setError(resetError.message)
          setLoading(false)
          return
        }

        setSuccess('重置邮件已发送，请查收邮箱并按提示完成密码更新。')
      } else {
        setError('请输入有效的邮箱地址或手机号')
        setLoading(false)
        return
      }
    } catch (err: any) {
      setError(err?.message || '发送重置链接失败')
    } finally {
      setLoading(false)
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
          <h1 className="text-2xl font-bold text-slate-900">重置密码</h1>
          <p className="mt-2 text-sm text-slate-600">输入注册邮箱或手机号，我们会发送重置链接</p>
        </div>

        {/* 重置密码表单卡片 */}
        <div className="rounded-2xl bg-white p-8 shadow-xl ring-1 ring-slate-200/60">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">邮箱或手机号</label>
              <input
                type="text"
                placeholder="请输入您的邮箱或手机号"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                required
              />
              <p className="text-xs text-slate-500">
                {detectInputType(account.trim()) === 'phone' 
                  ? '我们将发送验证码到您的手机' 
                  : '我们将发送重置链接到您的邮箱'}
              </p>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {success && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                <p className="text-sm text-emerald-600">{success}</p>
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
                  发送中...
                </span>
              ) : (
                '发送重置链接'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600">
              想起密码了？
              <Link
                to="/login"
                className="ml-1 font-medium text-brand-600 transition-colors hover:text-brand-700"
              >
                返回登录
              </Link>
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">
            Supabase 会发送重置链接，请在有效期内完成操作。
          </p>
        </div>
      </div>
    </div>
  )
}
