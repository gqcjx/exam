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

// 批量解析学校、年级、班级名称到ID（优化版本：使用缓存）
function resolveSchoolGradeClassBatch(
  students: StudentImportRow[],
  schoolsMap: Map<string, string>, // name -> id
  gradesMap: Map<string, string>, // name -> id
  classesMap: Map<string, string>, // "school_id:grade_id:name" -> id
): void {
  for (const student of students) {
    if (student.school_id && student.grade_id && student.class_id) {
      // 已经解析过了，跳过
      continue
    }

    let school_id = student.school_id || null
    let grade_id = student.grade_id || null
    let class_id = student.class_id || null

    if (student.school && !school_id) {
      const schoolName = student.school.trim()
      school_id = schoolsMap.get(schoolName) || null
    }

    if (student.grade && !grade_id) {
      const gradeName = student.grade.trim()
      grade_id = gradesMap.get(gradeName) || null
    }

    if (student.class && school_id && grade_id && !class_id) {
      const className = student.class.trim()
      const classKey = `${school_id}:${grade_id}:${className}`
      class_id = classesMap.get(classKey) || null
    }

    student.school_id = school_id || undefined
    student.grade_id = grade_id || undefined
    student.class_id = class_id || undefined
  }
}

// 批量检查学生是否已存在（优化版本：一次性查询所有邮箱和手机号）
async function checkStudentsExistsBatch(
  students: StudentImportRow[],
): Promise<Set<string>> {
  // 收集所有需要检查的邮箱和手机号
  const emails = new Set<string>()
  const phones = new Set<string>()
  
  for (const student of students) {
    if (student.email) {
      emails.add(student.email.trim().toLowerCase())
    }
    if (student.phone) {
      const cleanedPhone = student.phone.replace(/\D/g, '')
      if (cleanedPhone.length === 11) {
        phones.add(cleanedPhone)
      }
    }
  }

  const existingSet = new Set<string>() // 存储已存在的标识（email 或 phone）

  // 批量查询邮箱（通过 profiles.email）
  if (emails.size > 0) {
    const emailArray = Array.from(emails)
    // 分批查询，每批最多100个
    for (let i = 0; i < emailArray.length; i += 100) {
      const batch = emailArray.slice(i, i + 100)
      const { data } = await supabase
        .from('profiles')
        .select('email')
        .eq('role', 'student')
        .in('email', batch)
      
      if (data) {
        data.forEach(p => {
          if (p.email) {
            existingSet.add(p.email.toLowerCase())
          }
        })
      }
    }
  }

  // 批量查询手机号
  if (phones.size > 0) {
    const phoneArray = Array.from(phones)
    // 分批查询，每批最多100个
    for (let i = 0; i < phoneArray.length; i += 100) {
      const batch = phoneArray.slice(i, i + 100)
      const { data } = await supabase
        .from('profiles')
        .select('phone')
        .eq('role', 'student')
        .in('phone', batch)
      
      if (data) {
        data.forEach(p => {
          if (p.phone) {
            existingSet.add(p.phone)
          }
        })
      }
    }
  }

  return existingSet
}

// 批量加载所有相关班级的学生姓名（优化版本）
async function loadClassNamesBatch(classIds: Set<string>): Promise<Map<string, Set<string>>> {
  const classNamesMap = new Map<string, Set<string>>() // class_id -> Set<name>

  if (classIds.size === 0) {
    return classNamesMap
  }

  const classIdArray = Array.from(classIds)
  // 分批查询，每批最多100个班级
  for (let i = 0; i < classIdArray.length; i += 100) {
    const batch = classIdArray.slice(i, i + 100)
    const { data } = await supabase
      .from('profiles')
      .select('class_id, name')
      .eq('role', 'student')
      .in('class_id', batch)
      .not('name', 'is', null)

    if (data) {
      data.forEach(s => {
        if (s.class_id && s.name) {
          const names = classNamesMap.get(s.class_id) || new Set<string>()
          names.add(s.name)
          classNamesMap.set(s.class_id, names)
        }
      })
    }
  }

  return classNamesMap
}

// 处理同名学生：在同班同名的情况下，添加后缀（A, AA, AAA...）
// 优化版本：使用预加载的班级姓名数据
function handleDuplicateNameBatch(
  name: string,
  class_id: string | null,
  classNamesMap: Map<string, Set<string>>, // 预加载的班级姓名数据
  currentBatchNames: Map<string, Set<string>>, // 本次导入批次中已使用的姓名（按班级分组）
): string {
  if (!class_id) {
    // 如果没有班级，也记录到批次中（使用空字符串作为key）
    const batchNames = currentBatchNames.get('') || new Set<string>()
    if (batchNames.has(name)) {
      const suffixPattern = /^(.+?)(A+)$/
      let maxSuffixLength = 0
      for (const existingName of batchNames) {
        if (existingName === name) {
          maxSuffixLength = Math.max(maxSuffixLength, 0)
        } else {
          const match = existingName.match(suffixPattern)
          if (match && match[1] === name) {
            maxSuffixLength = Math.max(maxSuffixLength, match[2].length)
          }
        }
      }
      const newSuffix = 'A'.repeat(maxSuffixLength + 1)
      name = `${name}${newSuffix}`
    }
    batchNames.add(name)
    currentBatchNames.set('', batchNames)
    return name
  }

  const baseName = name.trim()
  const allNames = new Set<string>()
  
  // 添加数据库中已存在的姓名
  const existingNames = classNamesMap.get(class_id)
  if (existingNames) {
    existingNames.forEach(n => allNames.add(n))
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
  onProgress?: (current: number, total: number) => void,
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

  // ========== 性能优化：批量预加载数据 ==========
  
  // 1. 预加载所有配置数据（学校、年级、班级）
  console.log('开始预加载配置数据...')
  const [schools, grades, allClasses] = await Promise.all([
    getSchools(false), // 获取所有学校（包括禁用的）
    getGrades(false), // 获取所有年级（包括禁用的）
    getClasses(undefined, undefined, false), // 获取所有班级（包括禁用的）
  ])

  // 构建查找映射
  const schoolsMap = new Map<string, string>() // name -> id
  schools.forEach(s => schoolsMap.set(s.name.trim(), s.id))

  const gradesMap = new Map<string, string>() // name -> id
  grades.forEach(g => gradesMap.set(g.name.trim(), g.id))

  const classesMap = new Map<string, string>() // "school_id:grade_id:name" -> id
  allClasses.forEach(c => {
    const key = `${c.school_id}:${c.grade_id}:${c.name.trim()}`
    classesMap.set(key, c.id)
  })

  // 2. 批量解析学校、年级、班级
  console.log('批量解析学校、年级、班级...')
  resolveSchoolGradeClassBatch(students, schoolsMap, gradesMap, classesMap)

  // 3. 批量检查已存在的学生
  console.log('批量检查已存在的学生...')
  const existingSet = await checkStudentsExistsBatch(students)

  // 4. 收集所有需要查询的班级ID
  const classIds = new Set<string>()
  students.forEach(s => {
    if (s.class_id) {
      classIds.add(s.class_id)
    }
  })

  // 5. 批量加载所有相关班级的学生姓名
  console.log('批量加载班级学生姓名...')
  const classNamesMap = await loadClassNamesBatch(classIds)

  // ========== 开始处理每个学生 ==========
  
  // 用于跟踪本次导入批次中已使用的姓名（按班级分组）
  const currentBatchNames = new Map<string, Set<string>>()

  // 准备创建用户的任务列表
  interface CreateUserTask {
    student: StudentImportRow
    email: string
    finalName: string
    school_id: string | null
    grade_id: string | null
    class_id: string | null
  }

  const createUserTasks: CreateUserTask[] = []
  let processedCount = 0

  for (const student of students) {
    processedCount++
    // 更新进度
    if (onProgress) {
      onProgress(processedCount, students.length)
    }

    try {
      let school_id = student.school_id || null
      let grade_id = student.grade_id || null
      let class_id = student.class_id || null

      // 权限检查：如果是班主任，只能导入自己管理的班级的学生
      if (currentUserRole === 'teacher' && currentUserClassIds && currentUserClassIds.length > 0) {
        if (!class_id || !currentUserClassIds.includes(class_id)) {
          failed++
          errors.push(`${student.name}: 只能导入自己管理的班级的学生`)
          continue
        }
      }

      // 权限检查：如果是教师（非管理员），只能导入自己学校的学生
      if (currentUserRole === 'teacher' && currentUserSchoolId) {
        if (!school_id || school_id !== currentUserSchoolId) {
          failed++
          errors.push(`${student.name}: 只能导入自己学校的学生`)
          continue
        }
      }

      // 检查学生是否已存在（通过邮箱或手机号），如果存在则跳过
      const studentEmail = student.email?.trim().toLowerCase()
      const studentPhone = student.phone ? student.phone.replace(/\D/g, '') : null
      const exists = (studentEmail && existingSet.has(studentEmail)) || 
                     (studentPhone && existingSet.has(studentPhone))
      
      if (exists) {
        failed++
        errors.push(`${student.name}: 学生已存在（邮箱或手机号重复），已跳过`)
        continue
      }

      // 处理同名：同班同名时添加后缀
      let finalName = student.name.trim()
      if (!finalName) {
        failed++
        errors.push(`${student.name}: 姓名为空`)
        continue
      }

      finalName = handleDuplicateNameBatch(finalName, class_id, classNamesMap, currentBatchNames)

      // 生成邮箱（如果没有提供邮箱）
      const email = student.email || `${Math.random().toString(36).substring(2, 9)}@gfce.com`

      if (!email || !email.trim()) {
        failed++
        errors.push(`${student.name}: 邮箱为空`)
        continue
      }

      // 添加到创建任务列表
      createUserTasks.push({
        student,
        email: email.trim(),
        finalName: finalName.trim(),
        school_id,
        grade_id,
        class_id,
      })

    } catch (err: any) {
      failed++
      errors.push(`${student.name}: ${err?.message || '预处理失败'}`)
      console.error(`Error preprocessing student ${student.name}:`, err)
    }
  }

  // ========== 并发创建用户（限制并发数为5） ==========
  console.log(`开始创建 ${createUserTasks.length} 个用户...`)
  const CONCURRENT_LIMIT = 5
  let taskIndex = 0

  const createUserPromises: Promise<void>[] = []
  
  for (let i = 0; i < CONCURRENT_LIMIT && i < createUserTasks.length; i++) {
    createUserPromises.push(processCreateUserQueue())
  }

  async function processCreateUserQueue() {
    while (taskIndex < createUserTasks.length) {
      const currentIndex = taskIndex++
      const task = createUserTasks[currentIndex]
      
      // 更新进度
      if (onProgress) {
        onProgress(processedCount - createUserTasks.length + currentIndex + 1, students.length)
      }

      try {
        const { data: createUserData, error: createUserError } = await supabase.functions.invoke('create-student', {
          body: {
            email: task.email,
            password: task.student.password || '123456',
            phone: task.student.phone ? task.student.phone.replace(/\D/g, '') : null,
            name: task.finalName,
            nickname: task.student.nickname?.trim() || null,
            school_id: task.school_id,
            grade_id: task.grade_id,
            class_id: task.class_id,
          },
        })

        if (createUserError) {
          failed++
          const errorMsg = createUserError.message || '创建账号失败'
          errors.push(`${task.student.name}: ${errorMsg}`)
          console.error(`Failed to create student ${task.student.name}:`, createUserError)
          continue
        }

        if (!createUserData || !createUserData.success) {
          failed++
          const errorMsg = createUserData?.error || '创建账号失败'
          errors.push(`${task.student.name}: ${errorMsg}`)
          console.error(`Failed to create student ${task.student.name}:`, createUserData)
          continue
        }

        success++
      } catch (invokeError: any) {
        failed++
        const errorMsg = invokeError?.message || '调用 Edge Function 失败'
        errors.push(`${task.student.name}: ${errorMsg}`)
        console.error(`Failed to invoke create-student for ${task.student.name}:`, invokeError)
      }
    }
  }

  // 等待所有创建任务完成
  await Promise.all(createUserPromises)

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
    // 表头
    ['姓名*', '昵称', '邮箱', '手机号', '学校', '年级', '班级', '密码'],
    // 示例数据
    ['张三', '小张', 'zhangsan@example.com', '13800138000', '第一中学', '高一', '1班', '123456'],
    ['李四', '小李', 'lisi@example.com', '13900139000', '第一中学', '高一', '2班', '123456'],
    ['王五', '', 'wangwu@example.com', '', '第一中学', '高一', '1班', ''],
    ['赵六', '小赵', '', '13700137000', '', '', '', ''],
    // 说明行
    ['', '', '', '', '', '', '', ''],
    ['说明：', '', '', '', '', '', '', ''],
    ['1. 姓名是必填项，其他字段为可选项', '', '', '', '', '', '', ''],
    ['2. 如果Excel中没有指定学校/年级/班级，可以在导入时设置默认值', '', '', '', '', '', '', ''],
    ['3. 如果Excel中没有指定密码，将使用默认密码', '', '', '', '', '', '', ''],
    ['4. 已存在的学生（通过邮箱或手机号判断）将被跳过', '', '', '', '', '', '', ''],
    ['5. 同班同名将自动添加后缀（A, AA, AAA...）', '', '', '', '', '', '', ''],
    ['6. 单次导入数量不能超过 6000 条', '', '', '', '', '', '', ''],
  ]

  const worksheet = XLSX.utils.aoa_to_sheet(templateData)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '学生名单')

  // 设置列宽
  worksheet['!cols'] = [
    { wch: 12 }, // 姓名
    { wch: 12 }, // 昵称
    { wch: 30 }, // 邮箱
    { wch: 15 }, // 手机号
    { wch: 18 }, // 学校
    { wch: 12 }, // 年级
    { wch: 12 }, // 班级
    { wch: 12 }, // 密码
  ]

  // 设置第一行为表头样式（通过设置单元格样式）
  const headerRange = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:H1')
  for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col })
    if (!worksheet[cellAddress]) continue
    worksheet[cellAddress].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '4472C4' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    }
  }

  // 设置说明行样式
  const noteStartRow = 5 // 从第6行开始是说明
  const dataRange = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:H10')
  for (let row = noteStartRow; row <= dataRange.e.r; row++) {
    for (let col = dataRange.s.c; col <= dataRange.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
      if (worksheet[cellAddress]) {
        worksheet[cellAddress].s = {
          font: { color: { rgb: '666666' }, sz: 10 },
          alignment: { horizontal: 'left', vertical: 'center' },
        }
      }
    }
  }

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
