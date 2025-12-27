import { supabase } from '../lib/supabaseClient'
import { isSupabaseReady } from '../lib/env'
import { cleanPhone, detectInputType } from '../utils/phoneValidation'

/**
 * 通过账号（手机号、邮箱或姓名）查找用户信息
 */
export async function findUserByAccount(account: string): Promise<{
  user_id: string
  email: string
  phone: string | null
  name: string | null
  role: string
} | null> {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置')
  }

  const inputType = detectInputType(account)
  
  if (inputType === 'phone') {
    const cleanedPhone = cleanPhone(account)
    const { data, error } = await supabase.rpc('find_user_by_phone', {
      phone_text: cleanedPhone,
    })

    if (error || !data || data.length === 0) {
      return null
    }

    return data[0] as any
  } else {
    // 邮箱或姓名：使用 find_user_by_account 函数（支持邮箱和姓名）
    const { data, error } = await supabase.rpc('find_user_by_account', {
      account_text: account.trim(),
    })

    if (error || !data || data.length === 0) {
      return null
    }

    return data[0] as any
  }
}

/**
 * 使用姓名登录（通过姓名找到邮箱，然后使用邮箱登录）
 */
export async function signInWithName(name: string, password: string): Promise<{
  data: { user: any; session: any } | null
  error: any
}> {
  if (!isSupabaseReady) {
    return {
      data: null,
      error: { message: 'Supabase 未配置' },
    }
  }

  // 先通过姓名找到对应的邮箱
  const userInfo = await findUserByAccount(name)
  
  if (!userInfo || !userInfo.email) {
    return {
      data: null,
      error: { message: '未找到该姓名对应的账号' },
    }
  }

  // 使用邮箱登录
  const result = await supabase.auth.signInWithPassword({
    email: userInfo.email,
    password,
  })

  return {
    data: result.data ? { user: result.data.user, session: result.data.session } : null,
    error: result.error,
  }
}

/**
 * 使用手机号登录（通过邮箱登录，因为 Supabase 的 signInWithPassword 只支持邮箱）
 * 注意：学生不支持手机号登录
 */
export async function signInWithPhone(phone: string, password: string): Promise<{
  data: { user: any; session: any } | null
  error: any
}> {
  if (!isSupabaseReady) {
    return {
      data: null,
      error: { message: 'Supabase 未配置' },
    }
  }

  // 先通过手机号找到对应的邮箱和角色
  const userInfo = await findUserByAccount(phone)
  
  if (!userInfo || !userInfo.email) {
    return {
      data: null,
      error: { message: '未找到该手机号对应的账号' },
    }
  }

  // 检查用户角色，学生不支持手机号登录
  if (userInfo.role === 'student') {
    return {
      data: null,
      error: { message: '学生账号不支持手机号登录，请使用邮箱登录' },
    }
  }

  // 使用邮箱登录
  const result = await supabase.auth.signInWithPassword({
    email: userInfo.email,
    password,
  })

  return {
    data: result.data ? { user: result.data.user, session: result.data.session } : null,
    error: result.error,
  }
}
