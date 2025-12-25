import { supabase } from '../lib/supabaseClient'
import { isSupabaseReady } from '../lib/env'
import type { Role } from '../context/AuthContext'

export type UserRow = {
  user_id: string
  name: string | null
  role: Role
  grade: string | null
  class: string | null
  disabled: boolean | null
}

export async function listUsers(): Promise<UserRow[]> {
  if (!isSupabaseReady) return []

  const { data, error } = await supabase
    .from('profiles')
    .select('user_id,name,role,grade,class,disabled')
    .order('created_at', { ascending: false })

  if (error || !data) {
    console.warn('获取用户列表失败', error?.message)
    return []
  }

  return data as UserRow[]
}

export async function updateUser(userId: string, updates: { role?: Role; disabled?: boolean }) {
  if (!isSupabaseReady) throw new Error('Supabase 未配置')

  const payload: any = {}
  if (updates.role) payload.role = updates.role
  if (typeof updates.disabled === 'boolean') payload.disabled = updates.disabled

  const { error } = await supabase.from('profiles').update(payload).eq('user_id', userId)

  if (error) {
    throw new Error(error.message)
  }
}




