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

// 删除单个用户（通过 Edge Function）
export async function deleteUser(userId: string): Promise<void> {
  if (!isSupabaseReady) throw new Error('Supabase 未配置')

  try {
    // 通过 Edge Function 删除用户（包括 profile 和 auth user）
    const { data, error } = await supabase.functions.invoke('delete-user', {
      body: { user_id: userId },
    })

    if (error) {
      throw new Error(error.message || '删除用户失败')
    }

    if (!data || !data.success) {
      throw new Error(data?.error || '删除用户失败')
    }
  } catch (err: any) {
    throw new Error(err?.message || '删除用户失败')
  }
}

// 批量删除用户
export async function batchDeleteUsers(userIds: string[]): Promise<{ success: number; failed: number; errors: string[] }> {
  if (!isSupabaseReady) throw new Error('Supabase 未配置')

  let success = 0
  let failed = 0
  const errors: string[] = []

  // 并发删除，限制并发数为 5
  const CONCURRENT_LIMIT = 5
  let index = 0

  const deletePromises: Promise<void>[] = []

  for (let i = 0; i < CONCURRENT_LIMIT && i < userIds.length; i++) {
    deletePromises.push(processDeleteQueue())
  }

  async function processDeleteQueue() {
    while (index < userIds.length) {
      const currentIndex = index++
      const userId = userIds[currentIndex]

      try {
        await deleteUser(userId)
        success++
      } catch (err: any) {
        failed++
        errors.push(`用户 ${userId}: ${err?.message || '删除失败'}`)
        console.error(`Failed to delete user ${userId}:`, err)
      }
    }
  }

  await Promise.all(deletePromises)

  return { success, failed, errors }
}




