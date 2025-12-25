import { supabase } from '../lib/supabaseClient'
import { isSupabaseReady } from '../lib/env'

export interface Tag {
  id: string
  name: string
  color?: string
  created_at: string
}

// 获取所有标签
export async function getAllTags(): Promise<Tag[]> {
  if (!isSupabaseReady) {
    return []
  }

  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    console.warn('获取标签列表失败', error.message)
    return []
  }

  return (data || []) as Tag[]
}

// 创建标签
export async function createTag(name: string, color?: string): Promise<Tag> {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置')
  }

  const { data, error } = await supabase
    .from('tags')
    .insert({ name: name.trim(), color })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as Tag
}

// 更新标签
export async function updateTag(tagId: string, updates: { name?: string; color?: string }): Promise<void> {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置')
  }

  const { error } = await supabase
    .from('tags')
    .update(updates)
    .eq('id', tagId)

  if (error) {
    throw new Error(error.message)
  }
}

// 删除标签
export async function deleteTag(tagId: string): Promise<void> {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置')
  }

  const { error } = await supabase
    .from('tags')
    .delete()
    .eq('id', tagId)

  if (error) {
    throw new Error(error.message)
  }
}

// 获取题目的标签使用统计
export async function getTagUsageStats(): Promise<Record<string, number>> {
  if (!isSupabaseReady) {
    return {}
  }

  const { data, error } = await supabase
    .from('questions')
    .select('tags')

  if (error) {
    console.warn('获取标签统计失败', error.message)
    return {}
  }

  const stats: Record<string, number> = {}
  data?.forEach((q: any) => {
    if (q.tags && Array.isArray(q.tags)) {
      q.tags.forEach((tag: string) => {
        stats[tag] = (stats[tag] || 0) + 1
      })
    }
  })

  return stats
}

