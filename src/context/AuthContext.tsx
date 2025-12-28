/**
 * 认证上下文
 * 提供用户认证状态和权限管理
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { logger } from '../utils/logger'
import { handleError } from '../utils/errorHandler'

export type Role = 'admin' | 'teacher' | 'student' | 'parent' | null

export type Profile = {
  user_id: string
  name: string | null
  role: Role
  grade?: string | null
  class?: string | null
  disabled?: boolean | null
  school_id?: string | null
}

type AuthContextValue = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 初始 session
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        const appError = handleError(error, 'AuthContext.getSession')
        logger.warn('获取 session 失败', appError)
        setSession(null)
        setLoading(false)
      } else {
        setSession(data.session ?? null)
        setLoading(false)
        if (data.session) {
          logger.debug('Session 初始化成功', { userId: data.session.user.id })
        }
      }
    })

    // 监听 auth 状态变化
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      logger.debug('Auth state changed', { event, userId: newSession?.user?.id })
      setSession(newSession)
      setLoading(false)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    async function fetchProfile() {
      if (!session?.user) {
        setProfile(null)
        setLoading(false)
        return
      }
      setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id,name,role,grade,class,disabled,school_id')
        .eq('user_id', session.user.id)
        .single()
      if (error) {
        const appError = handleError(error, 'AuthContext.fetchProfile')
        logger.warn('获取 profile 失败', appError)
        setProfile(null)
      } else {
        // 确保返回的数据结构完整
        const profileData: Profile = {
          user_id: data?.user_id || session.user.id,
          name: data?.name || null,
          role: (data?.role as Role) || null,
          grade: data?.grade || null,
          class: data?.class || null,
          disabled: data?.disabled || false,
          school_id: data?.school_id || null,
        }
        setProfile(profileData)
      }
      setLoading(false)
    }
    fetchProfile()
  }, [session])

  const signOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      signOut,
    }),
    [session, profile, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}


