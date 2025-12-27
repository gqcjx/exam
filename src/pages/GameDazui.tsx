import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase, supabaseReady } from '../lib/supabaseClient'

export default function GameDazui() {
  const { session, profile, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    // 等待认证加载完成
    if (loading) return

    // 检查是否已登录
    if (!session || !profile) {
      navigate('/login', { replace: true, state: { from: '/game/dazui' } })
      return
    }

    // 检查是否是学生
    if (profile.role !== 'student') {
      navigate('/unauthorized', { replace: true })
      return
    }

    // 检查 Supabase 是否配置
    if (!supabaseReady) {
      alert('系统配置错误，无法启动游戏')
      navigate('/dashboard', { replace: true })
      return
    }

    // 获取 Supabase 配置
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      alert('系统配置错误，无法启动游戏')
      navigate('/dashboard', { replace: true })
      return
    }

    // 获取当前 session 的 access token
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) {
        alert('认证失败，请重新登录')
        navigate('/login', { replace: true })
        return
      }

      // 构建游戏 URL，传递 token 和配置
      // 根据 basename 决定路径
      const basename = window.location.pathname.startsWith('/exam') ? '/exam' : ''
      const returnUrl = `${basename}/dashboard`
      const gameUrl = `${basename}/dazui/index.html?token=${encodeURIComponent(session.access_token)}&supabase_url=${encodeURIComponent(supabaseUrl)}&supabase_key=${encodeURIComponent(supabaseKey)}&return_url=${encodeURIComponent(returnUrl)}`
      
      // 跳转到游戏页面
      window.location.href = gameUrl
    })
  }, [session, profile, loading, navigate])

  // 显示加载中
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto"></div>
        <p className="text-slate-600">正在启动游戏...</p>
      </div>
    </div>
  )
}
