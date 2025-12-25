import { supabase } from '../lib/supabaseClient'
import { isSupabaseReady } from '../lib/env'

// ============================================
// 学科配置
// ============================================

export interface Subject {
  id: string
  name: string
  code?: string
  display_order: number
  enabled: boolean
  created_at: string
  updated_at: string
}

// 获取所有启用的学科
export async function getSubjects(enabledOnly: boolean = true): Promise<Subject[]> {
  if (!isSupabaseReady) {
    // 返回默认学科（兼容模式）
    return [
      { id: '1', name: '数学', code: 'MATH', display_order: 1, enabled: true, created_at: '', updated_at: '' },
      { id: '2', name: '语文', code: 'CHINESE', display_order: 2, enabled: true, created_at: '', updated_at: '' },
      { id: '3', name: '英语', code: 'ENGLISH', display_order: 3, enabled: true, created_at: '', updated_at: '' },
      { id: '4', name: '物理', code: 'PHYSICS', display_order: 4, enabled: true, created_at: '', updated_at: '' },
      { id: '5', name: '化学', code: 'CHEMISTRY', display_order: 5, enabled: true, created_at: '', updated_at: '' },
      { id: '6', name: '科学', code: 'SCIENCE', display_order: 6, enabled: true, created_at: '', updated_at: '' },
    ]
  }

  let query = supabase.from('subjects').select('*').order('display_order', { ascending: true })
  
  if (enabledOnly) {
    query = query.eq('enabled', true)
  }

  const { data, error } = await query

  if (error) {
    console.warn('获取学科列表失败', error.message)
    return []
  }

  return (data || []) as Subject[]
}

// 获取所有学科（包括禁用的）
export async function getAllSubjects(): Promise<Subject[]> {
  return getSubjects(false)
}

// 创建学科
export async function createSubject(subject: { name: string; code?: string; display_order?: number }): Promise<Subject> {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置')
  }

  const { data, error } = await supabase
    .from('subjects')
    .insert({
      name: subject.name.trim(),
      code: subject.code?.trim() || null,
      display_order: subject.display_order || 0,
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as Subject
}

// 更新学科
export async function updateSubject(id: string, updates: Partial<Subject>): Promise<void> {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置')
  }

  const { error } = await supabase
    .from('subjects')
    .update(updates)
    .eq('id', id)

  if (error) {
    throw new Error(error.message)
  }
}

// 删除学科
export async function deleteSubject(id: string): Promise<void> {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置')
  }

  const { error } = await supabase
    .from('subjects')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(error.message)
  }
}

// ============================================
// 年级配置
// ============================================

export interface Grade {
  id: string
  name: string
  code?: string
  level?: number
  display_order: number
  enabled: boolean
  created_at: string
  updated_at: string
}

// 获取所有启用的年级
export async function getGrades(enabledOnly: boolean = true): Promise<Grade[]> {
  if (!isSupabaseReady) {
    // 返回默认年级（兼容模式）
    return [
      { id: '1', name: '七年级', code: 'GRADE_7', level: 7, display_order: 7, enabled: true, created_at: '', updated_at: '' },
      { id: '2', name: '八年级', code: 'GRADE_8', level: 8, display_order: 8, enabled: true, created_at: '', updated_at: '' },
      { id: '3', name: '九年级', code: 'GRADE_9', level: 9, display_order: 9, enabled: true, created_at: '', updated_at: '' },
    ]
  }

  let query = supabase
    .from('grades')
    .select('*')
    .order('level', { ascending: true, nullsLast: true })
    .order('display_order', { ascending: true })

  if (enabledOnly) {
    query = query.eq('enabled', true)
  }

  const { data, error } = await query

  if (error) {
    console.warn('获取年级列表失败', error.message)
    return []
  }

  return (data || []) as Grade[]
}

// 获取所有年级（包括禁用的）
export async function getAllGrades(): Promise<Grade[]> {
  return getGrades(false)
}

// 创建年级
export async function createGrade(grade: {
  name: string
  code?: string
  level?: number
  display_order?: number
}): Promise<Grade> {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置')
  }

  const { data, error } = await supabase
    .from('grades')
    .insert({
      name: grade.name.trim(),
      code: grade.code?.trim() || null,
      level: grade.level || null,
      display_order: grade.display_order || 0,
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as Grade
}

// 更新年级
export async function updateGrade(id: string, updates: Partial<Grade>): Promise<void> {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置')
  }

  const { error } = await supabase
    .from('grades')
    .update(updates)
    .eq('id', id)

  if (error) {
    throw new Error(error.message)
  }
}

// 删除年级
export async function deleteGrade(id: string): Promise<void> {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置')
  }

  const { error } = await supabase
    .from('grades')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(error.message)
  }
}

// ============================================
// 学校配置
// ============================================

export interface School {
  id: string
  name: string
  code?: string
  address?: string
  phone?: string
  enabled: boolean
  created_at: string
  updated_at: string
}

// 获取所有启用的学校
export async function getSchools(enabledOnly: boolean = true): Promise<School[]> {
  if (!isSupabaseReady) {
    return []
  }

  let query = supabase.from('schools').select('*').order('name', { ascending: true })

  if (enabledOnly) {
    query = query.eq('enabled', true)
  }

  const { data, error } = await query

  if (error) {
    console.warn('获取学校列表失败', error.message)
    return []
  }

  return (data || []) as School[]
}

// 获取所有学校（包括禁用的）
export async function getAllSchools(): Promise<School[]> {
  return getSchools(false)
}

// 创建学校
export async function createSchool(school: {
  name: string
  code?: string
  address?: string
  phone?: string
}): Promise<School> {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置')
  }

  const { data, error } = await supabase
    .from('schools')
    .insert({
      name: school.name.trim(),
      code: school.code?.trim() || null,
      address: school.address?.trim() || null,
      phone: school.phone?.trim() || null,
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as School
}

// 更新学校
export async function updateSchool(id: string, updates: Partial<School>): Promise<void> {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置')
  }

  const { error } = await supabase
    .from('schools')
    .update(updates)
    .eq('id', id)

  if (error) {
    throw new Error(error.message)
  }
}

// 删除学校
export async function deleteSchool(id: string): Promise<void> {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置')
  }

  const { error } = await supabase
    .from('schools')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(error.message)
  }
}

// ============================================
// 班级配置
// ============================================

export interface Class {
  id: string
  school_id: string
  grade_id: string
  name: string
  code?: string
  enabled: boolean
  created_at: string
  updated_at: string
  school?: School
  grade?: Grade
}

// 获取所有启用的班级
export async function getClasses(
  schoolId?: string,
  gradeId?: string,
  enabledOnly: boolean = true,
): Promise<Class[]> {
  if (!isSupabaseReady) {
    return []
  }

  let query = supabase
    .from('classes')
    .select('*, school:schools(*), grade:grades(*)')
    .order('name', { ascending: true })

  if (schoolId) {
    query = query.eq('school_id', schoolId)
  }

  if (gradeId) {
    query = query.eq('grade_id', gradeId)
  }

  if (enabledOnly) {
    query = query.eq('enabled', true)
  }

  const { data, error } = await query

  if (error) {
    console.warn('获取班级列表失败', error.message)
    return []
  }

  return (data || []) as Class[]
}

// 创建班级
export async function createClass(classData: {
  school_id: string
  grade_id: string
  name: string
  code?: string
}): Promise<Class> {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置')
  }

  const { data, error } = await supabase
    .from('classes')
    .insert({
      school_id: classData.school_id,
      grade_id: classData.grade_id,
      name: classData.name.trim(),
      code: classData.code?.trim() || null,
    })
    .select('*, school:schools(*), grade:grades(*)')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as Class
}

// 更新班级
export async function updateClass(id: string, updates: Partial<Class>): Promise<void> {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置')
  }

  const { error } = await supabase
    .from('classes')
    .update(updates)
    .eq('id', id)

  if (error) {
    throw new Error(error.message)
  }
}

// 删除班级
export async function deleteClass(id: string): Promise<void> {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置')
  }

  const { error } = await supabase
    .from('classes')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(error.message)
  }
}

