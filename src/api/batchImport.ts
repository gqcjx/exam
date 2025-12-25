import { supabase } from '../lib/supabaseClient'
import { isSupabaseReady } from '../lib/env'

export interface StudentImportRow {
  email: string
  name: string
  grade?: string
  class?: string
  password?: string
}

// 批量导入学生
export async function batchImportStudents(
  students: StudentImportRow[],
): Promise<{ success: number; failed: number; errors: string[] }> {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置')
  }

  let success = 0
  let failed = 0
  const errors: string[] = []

  for (const student of students) {
    try {
      // 创建用户账号
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: student.email,
        password: student.password || '123456', // 默认密码
        email_confirm: true,
      })

      if (authError || !authData.user) {
        failed++
        errors.push(`${student.email}: ${authError?.message || '创建账号失败'}`)
        continue
      }

      // 创建用户档案
      const { error: profileError } = await supabase.from('profiles').insert({
        user_id: authData.user.id,
        name: student.name,
        role: 'student',
        grade: student.grade || null,
        class: student.class || null,
      })

      if (profileError) {
        // 如果档案创建失败，删除已创建的用户
        await supabase.auth.admin.deleteUser(authData.user.id)
        failed++
        errors.push(`${student.email}: ${profileError.message}`)
        continue
      }

      success++
    } catch (err: any) {
      failed++
      errors.push(`${student.email}: ${err?.message || '导入失败'}`)
    }
  }

  return { success, failed, errors }
}

// 解析CSV文件
export function parseCSVFile(file: File): Promise<StudentImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const lines = text.split('\n').filter((line) => line.trim())
        if (lines.length < 2) {
          reject(new Error('CSV文件格式错误：至少需要表头和数据行'))
          return
        }

        const headers = lines[0].split(',').map((h) => h.trim())
        const emailIndex = headers.findIndex((h) => h.includes('邮箱') || h.includes('email'))
        const nameIndex = headers.findIndex((h) => h.includes('姓名') || h.includes('name'))
        const gradeIndex = headers.findIndex((h) => h.includes('年级') || h.includes('grade'))
        const classIndex = headers.findIndex((h) => h.includes('班级') || h.includes('class'))
        const passwordIndex = headers.findIndex((h) => h.includes('密码') || h.includes('password'))

        if (emailIndex === -1 || nameIndex === -1) {
          reject(new Error('CSV文件必须包含"邮箱"和"姓名"列'))
          return
        }

        const students: StudentImportRow[] = []
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map((v) => v.trim())
          if (values[emailIndex] && values[nameIndex]) {
            students.push({
              email: values[emailIndex],
              name: values[nameIndex],
              grade: gradeIndex >= 0 ? values[gradeIndex] : undefined,
              class: classIndex >= 0 ? values[classIndex] : undefined,
              password: passwordIndex >= 0 ? values[passwordIndex] : undefined,
            })
          }
        }

        resolve(students)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsText(file, 'UTF-8')
  })
}

