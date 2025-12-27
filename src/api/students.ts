import { supabase } from '../lib/supabaseClient'
import { isSupabaseReady } from '../lib/env'

// 通过邮箱查找学生（用于家长绑定）
export async function findStudentByEmail(email: string): Promise<{ user_id: string; name: string | null } | null> {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置')
  }

  const { data, error } = await supabase.rpc('find_student_by_email', {
    email_text: email,
  })

  if (error || !data || data.length === 0) {
    return null
  }

  const student = data[0] as { user_id: string; name: string | null; role: string }
  return {
    user_id: student.user_id,
    name: student.name,
  }
}
