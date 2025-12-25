import { supabase } from '../lib/supabaseClient'
import { isSupabaseReady } from '../lib/env'

export interface Notification {
  id: string
  user_id: string
  type: 'exam_start' | 'exam_end' | 'grade_released' | 'manual_review_completed' | 'system'
  title: string
  content: string
  related_id?: string | null // 关联的试卷ID或其他ID
  read: boolean
  created_at: string
}

// 创建通知
export async function createNotification(
  userId: string,
  type: Notification['type'],
  title: string,
  content: string,
  relatedId?: string,
): Promise<void> {
  if (!isSupabaseReady) {
    return
  }

  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    content,
    related_id: relatedId || null,
    read: false,
  })

  if (error) {
    console.warn('创建通知失败', error.message)
  }
}

// 批量创建通知（给多个用户）
export async function createNotificationsForUsers(
  userIds: string[],
  type: Notification['type'],
  title: string,
  content: string,
  relatedId?: string,
): Promise<void> {
  if (!isSupabaseReady || userIds.length === 0) {
    return
  }

  const notifications = userIds.map((userId) => ({
    user_id: userId,
    type,
    title,
    content,
    related_id: relatedId || null,
    read: false,
  }))

  const { error } = await supabase.from('notifications').insert(notifications)

  if (error) {
    console.warn('批量创建通知失败', error.message)
  }
}

// 获取用户通知列表
export async function getUserNotifications(
  userId: string,
  options: { unreadOnly?: boolean; limit?: number } = {},
): Promise<Notification[]> {
  if (!isSupabaseReady) {
    return []
  }

  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (options.unreadOnly) {
    query = query.eq('read', false)
  }

  if (options.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query

  if (error) {
    console.warn('获取通知列表失败', error.message)
    return []
  }

  return (data || []) as Notification[]
}

// 标记通知为已读
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  if (!isSupabaseReady) {
    return
  }

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)

  if (error) {
    console.warn('标记通知已读失败', error.message)
  }
}

// 标记所有通知为已读
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  if (!isSupabaseReady) {
    return
  }

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false)

  if (error) {
    console.warn('标记所有通知已读失败', error.message)
  }
}

// 删除通知
export async function deleteNotification(notificationId: string): Promise<void> {
  if (!isSupabaseReady) {
    return
  }

  const { error } = await supabase.from('notifications').delete().eq('id', notificationId)

  if (error) {
    console.warn('删除通知失败', error.message)
  }
}

// 获取未读通知数量
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  if (!isSupabaseReady) {
    return 0
  }

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)

  if (error) {
    console.warn('获取未读通知数量失败', error.message)
    return 0
  }

  return count || 0
}
