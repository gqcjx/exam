import { supabase } from '../lib/supabaseClient'
import { isSupabaseReady } from '../lib/env'

// 绑定关系
export async function bindChild(childEmail: string): Promise<void> {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置')
  }

  // 通过 RPC 函数查找学生
  const { data: student, error: userError } = await supabase.rpc('find_student_by_email', {
    email_text: childEmail,
  })

  if (userError || !student || student.length === 0) {
    throw new Error('未找到该学生账号，请确认邮箱是否正确')
  }

  const studentData = student[0] as { user_id: string; name: string | null; role: string }

  if (studentData.role !== 'student') {
    throw new Error('只能绑定学生账号')
  }

  const me = await supabase.auth.getUser()
  const parentId = me.data.user?.id
  if (!parentId) {
    throw new Error('未登录')
  }

  const { error } = await supabase.from('parent_child').insert({
    parent_id: parentId,
    child_id: studentData.user_id,
  })

  if (error) {
    // 如果是重复绑定，给出友好提示
    if (error.code === '23505') {
      throw new Error('该学生已经绑定，无需重复绑定')
    }
    throw new Error(error.message)
  }
}

// 获取家长名下子女列表及最近成绩概要
export async function getParentChildren() {
  if (!isSupabaseReady) return []

  const authUser = await supabase.auth.getUser()
  const parentId = authUser.data.user?.id
  if (!parentId) return []

  // 1. 获取绑定的 child_id
  const { data: relations } = await supabase
    .from('parent_child')
    .select('child_id')
    .eq('parent_id', parentId)

  if (!relations || relations.length === 0) return []

  const childIds = relations.map((r) => r.child_id)

  // 2. 获取子女 profile
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, name, grade, class')
    .in('user_id', childIds)

  // 3. 汇总每个子女的成绩（每张试卷取一次总分）
  const { data: answers } = await supabase
    .from('answers')
    .select('user_id, paper_id, score, manual_score')
    .in('user_id', childIds)

  const childScoreMap = new Map<
    string,
    {
      totalScore: number
      examCount: number
    }
  >()

  if (answers) {
    const keySet = new Set<string>()
    answers.forEach((a: any) => {
      const key = `${a.user_id}-${a.paper_id}`
      if (keySet.has(key)) return
      keySet.add(key)
      const total = (a.score || 0) + (a.manual_score || 0)
      const current = childScoreMap.get(a.user_id) || { totalScore: 0, examCount: 0 }
      current.totalScore += total
      current.examCount += 1
      childScoreMap.set(a.user_id, current)
    })
  }

  return (profiles || []).map((p: any) => {
    const stat = childScoreMap.get(p.user_id) || { totalScore: 0, examCount: 0 }
    return {
      user_id: p.user_id,
      name: p.name,
      grade: p.grade,
      class: p.class,
      examCount: stat.examCount,
      averageScore: stat.examCount ? stat.totalScore / stat.examCount : 0,
    }
  })
}

// 获取某个子女的单次试卷成绩列表
export async function getChildResults(childId: string) {
  if (!isSupabaseReady) return []

  const { data, error } = await supabase
    .from('answers')
    .select(
      `
      paper_id,
      score,
      manual_score,
      papers (title, total_score, created_at)
    `,
    )
    .eq('user_id', childId)

  if (error || !data) return []

  const map = new Map<
    string,
    {
      paper_id: string
      title: string
      total_score: number
      created_at: string
      score: number
    }
  >()

  data.forEach((a: any) => {
    const key = a.paper_id
    const total = (a.score || 0) + (a.manual_score || 0)
    const prev = map.get(key)
    if (!prev) {
      map.set(key, {
        paper_id: key,
        title: a.papers?.title || '',
        total_score: a.papers?.total_score || 0,
        created_at: a.papers?.created_at || '',
        score: total,
      })
    } else {
      prev.score += total
    }
  })

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
}


