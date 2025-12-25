import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, supabaseReady } from '../lib/supabaseClient'

export default function Register() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role] = useState<'student' | 'parent' | 'teacher' | 'admin'>('student')
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
    // 使用 metadata 传递姓名，触发器会自动创建 profile
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || '未命名用户',
          role: role,
        },
      },
    })
    if (signUpError) {
      setLoading(false)
      setError(signUpError.message)
      return
    }
    
    setLoading(false)
    setSuccess('注册成功！触发器已自动创建档案。如开启邮件验证，请查看邮箱激活。')
    setTimeout(() => navigate('/login'), 2000)
  }

  return (
    <div className="mx-auto max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">注册</h1>
        <p className="text-sm text-slate-600">邮箱 + 密码注册，默认角色学生（可后续由管理员调整）。</p>
      </div>
      <form className="space-y-3" onSubmit={handleSubmit}>
        <div className="space-y-1 text-sm">
          <label className="text-slate-700">姓名 / 昵称</label>
          <input
            type="text"
            placeholder="张三"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
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
        <div className="space-y-1 text-sm">
          <label className="text-slate-700">密码</label>
          <input
            type="password"
            placeholder="******"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        {success ? <p className="text-xs text-emerald-600">{success}</p> : null}
        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
          {loading ? '注册中...' : '注册'}
        </button>
      </form>
      <p className="text-xs text-slate-500">
        注册即表示同意
        <span> </span>
        <a href="/terms" className="text-brand-600 underline">
          使用条款
        </a>
        和
        <span> </span>
        <a href="/privacy" className="text-brand-600 underline">
          隐私说明
        </a>
        。注册时将通过触发器自动创建档案，如开启邮件验证，请查看邮箱激活链接。
      </p>
    </div>
  )
}


