import { supabase } from '../lib/supabaseClient'
import { isSupabaseReady } from '../lib/env'
import { getPaperWithQuestions } from './papers'
import { createPaperWithQuestions, createPaperManual } from './papers'
import type { PaperWithQuestions } from '../types'

// 获取试卷的所有版本
export async function getPaperVersions(paperId: string) {
  if (!isSupabaseReady) {
    return []
  }

  // 找到根试卷（没有parent_paper_id的，或者parent_paper_id是自己的）
  const { data: paper } = await supabase
    .from('papers')
    .select('id, parent_paper_id')
    .eq('id', paperId)
    .maybeSingle()

  if (!paper) {
    return []
  }

  const rootPaperId = paper.parent_paper_id || paper.id

  // 获取所有版本（包括根试卷）
  const { data: versions, error } = await supabase
    .from('papers')
    .select('id, title, version, created_at, published')
    .or(`id.eq.${rootPaperId},parent_paper_id.eq.${rootPaperId}`)
    .order('version', { ascending: true })

  if (error) {
    console.warn('获取试卷版本失败', error.message)
    return []
  }

  return versions || []
}

// 创建新版本（基于现有试卷）
export async function createPaperVersion(
  sourcePaperId: string,
  updates?: {
    title?: string
    startTime?: string
    endTime?: string
  },
): Promise<string> {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置')
  }

  // 获取源试卷
  const sourcePaper = await getPaperWithQuestions(sourcePaperId)
  if (!sourcePaper) {
    throw new Error('源试卷不存在')
  }

  // 创建新版本
  const sourcePaperAny = sourcePaper as any
  const newTitle = updates?.title || `${sourcePaper.title} (v${(sourcePaperAny?.version || 0) + 1})`

  if (sourcePaper.mode === 'random') {
    // 随机组卷模式：使用相同的题目
    return await createPaperWithQuestions({
      title: newTitle,
      subject: sourcePaper.subject || undefined,
      grade: sourcePaper.grade || undefined,
      durationMinutes: sourcePaper.duration_minutes,
      questions: sourcePaper.questions.map((pq) => pq.question),
      startTime: updates?.startTime || sourcePaper.start_time || undefined,
      endTime: updates?.endTime || sourcePaper.end_time || undefined,
      parentPaperId: sourcePaper.id,
    })
  } else {
    // 手动组卷模式
    return await createPaperManual({
      title: newTitle,
      subject: sourcePaper.subject || undefined,
      grade: sourcePaper.grade || undefined,
      durationMinutes: sourcePaper.duration_minutes,
      selections: sourcePaper.questions.map((pq) => ({
        question_id: pq.question.id,
        score: pq.score,
      })),
      startTime: updates?.startTime || sourcePaper.start_time || undefined,
      endTime: updates?.endTime || sourcePaper.end_time || undefined,
      parentPaperId: sourcePaper.id,
    })
  }
}

