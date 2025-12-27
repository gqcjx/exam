import { supabase } from '../lib/supabaseClient'
import { isSupabaseReady } from '../lib/env'

export interface InviteCode {
  id: string
  code: string
  role: 'teacher' | 'admin'
  created_by: string | null
  used_by: string | null
  used_at: string | null
  expires_at: string
  created_at: string
}

// 生成邀请码
export async function generateInviteCode(role: 'teacher' | 'admin'): Promise<string> {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置')
  }

  // 调用数据库函数生成邀请码
  const { data, error } = await supabase.rpc('generate_invite_code', { length: 8 })

  if (error || !data) {
    throw new Error(error?.message || '生成邀请码失败')
  }

  const code = data as string

  // 创建邀请码记录（有效期10天）
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 10)

  const { error: insertError } = await supabase.from('invite_codes').insert({
    code,
    role,
    expires_at: expiresAt.toISOString(),
  })

  if (insertError) {
    throw new Error(insertError.message)
  }

  return code
}

// 验证邀请码
export async function verifyInviteCode(code: string, role: 'teacher' | 'admin'): Promise<boolean> {
  if (!isSupabaseReady) {
    return false
  }

  const { data, error } = await supabase.rpc('verify_invite_code', {
    code_text: code,
    role_text: role,
  })

  if (error) {
    console.warn('验证邀请码失败', error.message)
    return false
  }

  return data as boolean
}

// 使用邀请码
export async function useInviteCode(code: string, userId: string): Promise<boolean> {
  if (!isSupabaseReady) {
    return false
  }

  const { data, error } = await supabase.rpc('use_invite_code', {
    code_text: code,
    user_id_param: userId,
  })

  if (error) {
    console.warn('使用邀请码失败', error.message)
    return false
  }

  return data as boolean
}

// 获取邀请码列表（管理员）
export async function getInviteCodes(): Promise<InviteCode[]> {
  if (!isSupabaseReady) {
    return []
  }

  const { data, error } = await supabase
    .from('invite_codes')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('获取邀请码列表失败', error.message)
    return []
  }

  return (data || []) as InviteCode[]
}

// 删除邀请码（管理员）
export async function deleteInviteCode(id: string): Promise<void> {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置')
  }

  const { error } = await supabase.from('invite_codes').delete().eq('id', id)

  if (error) {
    throw new Error(error.message)
  }
}
