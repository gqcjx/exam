import { supabase } from '../lib/supabaseClient'
import { isSupabaseReady } from '../lib/env'
import { getSchools, getGrades, getClasses } from './config'
import * as XLSX from 'xlsx'

// 获取教师管理的班级ID列表
export async function getTeacherClassIds(teacherId: string): Promise<string[]> {
  if (!isSupabaseReady) {
    return []
  }

  const { data, error } = await supabase
    .from('teacher_class_relations')
    .select('class_id')
    .eq('teacher_id', teacherId)

  if (error) {
    console.warn('获取教师管理的班级失败', error.message)
    return []
  }

  return (data || []).map((item) => item.class_id)
}

export interface StudentImportRow {
  name: string
  nickname?: string
  email?: string
  phone?: string
  school?: string
  grade?: string
  class?: string
  password?: string
  // 解析后的ID
  school_id?: string
  grade_id?: string
  class_id?: string
}

// 解析学校、年级、班级名称到ID
async function resolveSchoolGradeClass(
  schoolName?: string,
  gradeName?: string,
  className?: string,
): Promise<{ school_id: string | null; grade_id: string | null; class_id: string | null }> {
  let school_id: string | null = null
  let grade_id: string | null = null
  let class_id: string | null = null

  if (schoolName) {
    const schools = await getSchools()
    const school = schools.find((s) => s.name === schoolName.trim())
    if (school) {
      school_id = school.id
    }
  }

  if (gradeName && school_id) {
    const grades = await getGrades()
    const grade = grades.find((g) => g.name === gradeName.trim())
    if (grade) {
      grade_id = grade.id
    }
  }

  if (className && school_id && grade_id) {
    const classes = await getClasses(school_id, grade_id)
    const classItem = classes.find((c) => c.name === className.trim())
    if (classItem) {
      class_id = classItem.id
    }
  }

  return { school_id, grade_id, class_id }
}

// 检查学生是否已存在（通过邮箱或手机号）
async function checkStudentExists(email?: string, phone?: string): Promise<boolean> {
  if (!email && !phone) return false

  // 检查邮箱：通过 RPC 函数或直接查询 auth.users（需要管理员权限）
  if (email) {
    // 使用 RPC 函数查找用户（如果存在）
    // 或者直接通过 profiles 表查找，然后验证邮箱
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('role', 'student')
      .limit(100) // 限制查询数量

    if (profiles && profiles.length > 0) {
      // 批量检查邮箱
      for (const profile of profiles) {
        try {
          const { data: authData } = await supabase.auth.admin.getUserById(profile.user_id)
          if (authData?.user?.email === email) return true
        } catch {
          // 忽略错误，继续检查
        }
      }
    }
  }

  // 检查手机号（通过 profiles 表）
  if (phone) {
    const cleanedPhone = phone.replace(/\D/g, '')
    // 检查标准格式和 +86 格式
    const phoneVariants = [
      cleanedPhone,
      `+86${cleanedPhone}`,
      cleanedPhone.startsWith('86') ? cleanedPhone.substring(2) : `86${cleanedPhone}`
    ]
    
    for (const phoneVariant of phoneVariants) {
      const { data } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('role', 'student')
        .or(`phone.eq.${phoneVariant}`)
        .limit(1)
        .maybeSingle()

      if (data) return true
    }
  }

  return false
}

// 处理同名学生：在同班同名的情况下，添加后缀（A, AA, AAA...）
// 同时考虑数据库中已存在的和本次导入批次中已处理的
async function handleDuplicateName(
  name: string,
  class_id: string | null,
  currentBatchNames: Map<string, Set<string>>, // 本次导入批次中已使用的姓名（按班级分组）
): Promise<string> {
  if (!class_id) return name

  const baseName = name.trim()
  
  // 获取数据库中同班所有学生姓名
  const { data: existingStudents } = await supabase
    .from('profiles')
    .select('name')
    .eq('role', 'student')
    .eq('class_id', class_id)
    .not('name', 'is', null)

  const allNames = new Set<string>()
  
  // 添加数据库中已存在的姓名
  if (existingStudents) {
    existingStudents.forEach(s => {
      if (s.name) {
        allNames.add(s.name)
      }
    })
  }

  // 添加本次导入批次中已使用的姓名（同一班级）
  const batchNames = currentBatchNames.get(class_id) || new Set<string>()
  batchNames.forEach(n => allNames.add(n))

  // 检查是否有完全同名的
  if (!allNames.has(baseName)) {
    // 没有同名，直接使用原姓名，并记录到批次中
    batchNames.add(baseName)
    currentBatchNames.set(class_id, batchNames)
    return baseName
  }

  // 查找已有的后缀模式（匹配：姓名 + A/AA/AAA...）
  const suffixPattern = /^(.+?)(A+)$/
  let maxSuffixLength = 0

  for (const existingName of allNames) {
    // 检查是否是基础姓名本身
    if (existingName === baseName) {
      maxSuffixLength = Math.max(maxSuffixLength, 0)
    } else {
      // 检查是否有后缀（A, AA, AAA...）
      const match = existingName.match(suffixPattern)
      if (match && match[1] === baseName) {
        maxSuffixLength = Math.max(maxSuffixLength, match[2].length)
      }
    }
  }

  // 生成新的后缀：如果已有同名，则生成 A；如果已有 A，则生成 AA；如果已有 AA，则生成 AAA，以此类推
  const newSuffix = 'A'.repeat(maxSuffixLength + 1)
  const finalName = `${baseName}${newSuffix}`
  
  // 记录到批次中
  batchNames.add(finalName)
  currentBatchNames.set(class_id, batchNames)
  
  return finalName
}

// 批量导入学生
export async function batchImportStudents(
  students: StudentImportRow[],
  currentUserId?: string,
  currentUserRole?: string,
  currentUserSchoolId?: string,
  currentUserClassIds?: string[],
  fileName?: string,
): Promise<{ success: number; failed: number; errors: string[]; importHistoryId?: string }> {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置')
  }

  // 权限检查：只有管理员或班主任可以导入
  if (currentUserRole !== 'admin' && currentUserRole !== 'teacher') {
    throw new Error('只有管理员或班主任可以批量导入学生')
  }

  // 检查是否为班主任（教师必须有管理的班级才能导入）
  if (currentUserRole === 'teacher') {
    if (!currentUserClassIds || currentUserClassIds.length === 0) {
      throw new Error('只有班主任可以批量导入学生，请先配置管理的班级')
    }
  }

  // 检查导入数量上限
  if (students.length > 6000) {
    throw new Error('单次导入数量不能超过 6000 条')
  }

  let success = 0
  let failed = 0
  const errors: string[] = []

  // 创建导入历史记录
  let importHistoryId: string | undefined
  if (currentUserId) {
    const { data: historyData, error: historyError } = await supabase
      .from('import_history')
      .insert({
        user_id: currentUserId,
        import_type: 'students',
        file_name: fileName || '未知文件',
        total_count: students.length,
        success_count: 0,
        failed_count: 0,
        errors: [],
      })
      .select('id')
      .single()

    if (!historyError && historyData) {
      importHistoryId = historyData.id
    }
  }

  // 用于跟踪本次导入批次中已使用的姓名（按班级分组）
  const currentBatchNames = new Map<string, Set<string>>()

  for (const student of students) {
    try {
      // 解析学校、年级、班级
      let school_id = student.school_id || null
      let grade_id = student.grade_id || null
      let class_id = student.class_id || null

      if (student.school || student.grade || student.class) {
        const resolved = await resolveSchoolGradeClass(student.school, student.grade, student.class)
        school_id = resolved.school_id || school_id
        grade_id = resolved.grade_id || grade_id
        class_id = resolved.class_id || class_id
      }

      // 如果是班主任，只能导入自己管理的班级的学生
      if (currentUserRole === 'teacher' && currentUserClassIds && currentUserClassIds.length > 0) {
        if (!class_id || !currentUserClassIds.includes(class_id)) {
          failed++
          errors.push(`${student.name}: 只能导入自己管理的班级的学生`)
          continue
        }
      }

      // 如果是教师（非管理员），只能导入自己学校的学生
      if (currentUserRole === 'teacher' && currentUserSchoolId) {
        if (!school_id || school_id !== currentUserSchoolId) {
          failed++
          errors.push(`${student.name}: 只能导入自己学校的学生`)
          continue
        }
      }

      // 检查学生是否已存在（通过邮箱或手机号），如果存在则跳过
      const exists = await checkStudentExists(student.email, student.phone)
      if (exists) {
        failed++
        errors.push(`${student.name}: 学生已存在（邮箱或手机号重复），已跳过`)
        continue
      }

      // 处理同名：同班同名时添加后缀
      let finalName = student.name.trim()
      if (class_id) {
        finalName = await handleDuplicateName(finalName, class_id, currentBatchNames)
      } else {
        // 如果没有班级，也记录到批次中（使用空字符串作为key）
        const batchNames = currentBatchNames.get('') || new Set<string>()
        if (batchNames.has(finalName)) {
          // 即使没有班级，如果本次导入中有同名，也需要添加后缀
          const suffixPattern = /^(.+?)(A+)$/
          let maxSuffixLength = 0
          for (const name of batchNames) {
            if (name === finalName) {
              maxSuffixLength = Math.max(maxSuffixLength, 0)
            } else {
              const match = name.match(suffixPattern)
              if (match && match[1] === finalName) {
                maxSuffixLength = Math.max(maxSuffixLength, match[2].length)
              }
            }
          }
          const newSuffix = 'A'.repeat(maxSuffixLength + 1)
          finalName = `${finalName}${newSuffix}`
        }
        batchNames.add(finalName)
        currentBatchNames.set('', batchNames)
      }

      // 生成临时邮箱（如果没有提供邮箱）
      const email = student.email || `temp_${Date.now()}_${Math.random().toString(36).substring(7)}@temp.local`

      // 创建用户账号
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: email,
        password: student.password || '123456', // 默认密码
        email_confirm: true,
        phone: student.phone ? `+86${student.phone.replace(/\D/g, '')}` : undefined,
      })

      if (authError || !authData.user) {
        failed++
        errors.push(`${student.name}: ${authError?.message || '创建账号失败'}`)
        continue
      }

      // 创建用户档案
      const { error: profileError } = await supabase.from('profiles').insert({
        user_id: authData.user.id,
        name: finalName,
        nickname: student.nickname?.trim() || null,
        role: 'student',
        school_id: school_id,
        grade_id: grade_id,
        class_id: class_id,
      })

      if (profileError) {
        // 如果档案创建失败，删除已创建的用户
        await supabase.auth.admin.deleteUser(authData.user.id)
        failed++
        errors.push(`${student.name}: ${profileError.message}`)
        continue
      }

      success++
    } catch (err: any) {
      failed++
      errors.push(`${student.name}: ${err?.message || '导入失败'}`)
    }
  }

  // 更新导入历史记录
  if (importHistoryId && currentUserId) {
    await supabase
      .from('import_history')
      .update({
        success_count: success,
        failed_count: failed,
        errors: errors.slice(0, 100), // 最多保存100条错误
      })
      .eq('id', importHistoryId)
  }

  return { success, failed, errors, importHistoryId }
}

// 解析Excel文件
export function parseExcelFile(file: File): Promise<StudentImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        
        // 读取第一个工作表
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        
        // 转换为JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
        
        if (jsonData.length < 2) {
          reject(new Error('Excel文件格式错误：至少需要表头和数据行'))
          return
        }

        // 解析表头
        const headers = jsonData[0].map((h: any) => String(h || '').trim())
        
        const nameIndex = headers.findIndex((h: string) => h.includes('姓名') || h.toLowerCase().includes('name'))
        const nicknameIndex = headers.findIndex((h: string) => h.includes('昵称') || h.toLowerCase().includes('nickname'))
        const emailIndex = headers.findIndex((h: string) => h.includes('邮箱') || h.toLowerCase().includes('email'))
        const phoneIndex = headers.findIndex((h: string) => h.includes('手机') || h.includes('电话') || h.toLowerCase().includes('phone'))
        const schoolIndex = headers.findIndex((h: string) => h.includes('学校') || h.toLowerCase().includes('school'))
        const gradeIndex = headers.findIndex((h: string) => h.includes('年级') || h.toLowerCase().includes('grade'))
        const classIndex = headers.findIndex((h: string) => h.includes('班级') || h.toLowerCase().includes('class'))
        const passwordIndex = headers.findIndex((h: string) => h.includes('密码') || h.toLowerCase().includes('password'))

        if (nameIndex === -1) {
          reject(new Error('Excel文件必须包含"姓名"列'))
          return
        }

        const students: StudentImportRow[] = []
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i]
          const name = row[nameIndex] ? String(row[nameIndex]).trim() : ''
          
          if (name) {
            students.push({
              name: name,
              nickname: nicknameIndex >= 0 && row[nicknameIndex] ? String(row[nicknameIndex]).trim() : undefined,
              email: emailIndex >= 0 && row[emailIndex] ? String(row[emailIndex]).trim() : undefined,
              phone: phoneIndex >= 0 && row[phoneIndex] ? String(row[phoneIndex]).trim() : undefined,
              school: schoolIndex >= 0 && row[schoolIndex] ? String(row[schoolIndex]).trim() : undefined,
              grade: gradeIndex >= 0 && row[gradeIndex] ? String(row[gradeIndex]).trim() : undefined,
              class: classIndex >= 0 && row[classIndex] ? String(row[classIndex]).trim() : undefined,
              password: passwordIndex >= 0 && row[passwordIndex] ? String(row[passwordIndex]).trim() : undefined,
            })
          }
        }

        if (students.length === 0) {
          reject(new Error('Excel文件中没有有效的学生数据'))
          return
        }

        resolve(students)
      } catch (err: any) {
        reject(new Error(err?.message || '解析Excel文件失败'))
      }
    }
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsBinaryString(file)
  })
}

// 生成导入模板Excel文件
export function generateImportTemplate(): void {
  const templateData = [
    ['姓名', '昵称', '邮箱', '手机号', '学校', '年级', '班级', '密码'],
    ['张三', '小张', 'zhangsan@example.com', '13800138000', '第一中学', '高一', '1班', '123456'],
    ['李四', '小李', 'lisi@example.com', '13900139000', '第一中学', '高一', '2班', '123456'],
  ]

  const worksheet = XLSX.utils.aoa_to_sheet(templateData)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '学生名单')

  // 设置列宽
  worksheet['!cols'] = [
    { wch: 10 }, // 姓名
    { wch: 10 }, // 昵称
    { wch: 25 }, // 邮箱
    { wch: 15 }, // 手机号
    { wch: 15 }, // 学校
    { wch: 10 }, // 年级
    { wch: 10 }, // 班级
    { wch: 10 }, // 密码
  ]

  XLSX.writeFile(workbook, '学生导入模板.xlsx')
}

// 获取导入历史记录
export async function getImportHistory(limit: number = 20): Promise<any[]> {
  if (!isSupabaseReady) {
    return []
  }

  const { data, error } = await supabase
    .from('import_history')
    .select('*')
    .eq('import_type', 'students')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.warn('获取导入历史失败', error.message)
    return []
  }

  return data || []
}
