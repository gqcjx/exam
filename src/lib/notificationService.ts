import { createNotification, createNotificationsForUsers, type NotificationType } from '../api/notifications'
import { supabase } from './supabaseClient'
import { isSupabaseReady } from './env'

// 通知考试即将开始
export async function notifyExamStarting(paperId: string, paperTitle: string, startTime: Date) {
  if (!isSupabaseReady) return

  // 获取所有学生用户
  const { data: students } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('role', 'student')

  if (!students || students.length === 0) return

  const userIds = students.map((s) => s.user_id)
  const timeUntilStart = Math.ceil((startTime.getTime() - Date.now()) / 1000 / 60)

  await createNotificationsForUsers(
    userIds,
    'exam_starting',
    `考试即将开始：${paperTitle}`,
    `考试将在 ${timeUntilStart} 分钟后开始，请做好准备。`,
    paperId,
  )
}

// 通知考试即将结束
export async function notifyExamEnding(paperId: string, paperTitle: string, endTime: Date) {
  if (!isSupabaseReady) return

  // 获取已开始但未提交的学生
  const { data: answers } = await supabase
    .from('answers')
    .select('user_id')
    .eq('paper_id', paperId)

  if (!answers || answers.length === 0) return

  const userIds = [...new Set(answers.map((a) => a.user_id))]
  const timeUntilEnd = Math.ceil((endTime.getTime() - Date.now()) / 1000 / 60)

  await createNotificationsForUsers(
    userIds,
    'exam_ending',
    `考试即将结束：${paperTitle}`,
    `考试将在 ${timeUntilEnd} 分钟后结束，请尽快提交。`,
    paperId,
  )
}

// 通知成绩已发布
export async function notifyGradePublished(paperId: string, paperTitle: string, userId: string) {
  if (!isSupabaseReady) return

  await createNotification(
    userId,
    'grade_published',
    `成绩已发布：${paperTitle}`,
    '您的考试成绩已发布，可以查看详细成绩和解析。',
    paperId,
  )
}

// 通知批阅完成
export async function notifyGradingCompleted(paperId: string, paperTitle: string, userId: string) {
  if (!isSupabaseReady) return

  await createNotification(
    userId,
    'grading_completed',
    `批阅完成：${paperTitle}`,
    '您的简答题已批阅完成，可以查看成绩和评语。',
    paperId,
  )
}

// 通知试卷已发布
export async function notifyPaperPublished(paperId: string, paperTitle: string) {
  if (!isSupabaseReady) return

  // 获取所有学生用户
  const { data: students } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('role', 'student')

  if (!students || students.length === 0) return

  const userIds = students.map((s) => s.user_id)

  await createNotificationsForUsers(
    userIds,
    'paper_published',
    `新试卷已发布：${paperTitle}`,
    '有新的试卷可以参加，请前往查看。',
    paperId,
  )
}

// 检查并发送即将开始的考试通知（应该在定时任务中调用）
export async function checkAndNotifyUpcomingExams() {
  if (!isSupabaseReady) return

  const now = new Date()
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000) // 1小时后

  // 查找1小时内即将开始的考试
  const { data: papers } = await supabase
    .from('papers')
    .select('id, title, start_time')
    .eq('published', true)
    .gte('start_time', now.toISOString())
    .lte('start_time', oneHourLater.toISOString())

  if (!papers || papers.length === 0) return

  for (const paper of papers) {
    await notifyExamStarting(paper.id, paper.title, new Date(paper.start_time))
  }
}

// 检查并发送即将结束的考试通知
export async function checkAndNotifyEndingExams() {
  if (!isSupabaseReady) return

  const now = new Date()
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000) // 1小时后

  // 查找1小时内即将结束的考试
  const { data: papers } = await supabase
    .from('papers')
    .select('id, title, end_time')
    .eq('published', true)
    .gte('end_time', now.toISOString())
    .lte('end_time', oneHourLater.toISOString())

  if (!papers || papers.length === 0) return

  for (const paper of papers) {
    await notifyExamEnding(paper.id, paper.title, new Date(paper.end_time))
  }
}
