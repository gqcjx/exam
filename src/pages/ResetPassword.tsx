import { useState } from 'react'
import { supabase, supabaseReady } from '../lib/supabaseClient'

export default function ResetPassword() {
  const [email, setEmail] = useState('')
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
    
    setLoading(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    })
    setLoading(false)
    if (resetError) {
      setError(resetError.message)
      return
    }
    setSuccess('重置邮件已发送，请查收邮箱并按提示完成密码更新。')
  }

  return (
    <div className="mx-auto max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">重置密码</h1>
        <p className="text-sm text-slate-600">输入注册邮箱，我们会发送重置邮件。</p>
      </div>
      <form className="space-y-3" onSubmit={handleSubmit}>
        <div className="space-y-1 text-sm">
          <label className="text-slate-700">邮箱</label>
          <input
            type="email"
            placeholder="you@example.com"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        {success ? <p className="text-xs text-emerald-600">{success}</p> : null}
        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
          {loading ? '发送中...' : '发送重置邮件'}
        </button>
      </form>
      <p className="text-xs text-slate-500">Supabase 会发送一封重置链接，请在有效期内完成操作。</p>
    </div>
  )
}


