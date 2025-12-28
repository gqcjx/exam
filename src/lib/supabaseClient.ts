import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseReady = Boolean(supabaseUrl && supabaseAnonKey)

if (!supabaseReady) {
  // 为后续集成留出提示，确保环境变量配置到位
  console.error(
    '❌ Supabase 环境变量未配置！\n' +
    '请在项目根目录创建 .env.local 文件，内容如下：\n' +
    'VITE_SUPABASE_URL=https://your-project.supabase.co\n' +
    'VITE_SUPABASE_ANON_KEY=your-anon-key\n\n' +
    '⚠️ 注意：必须使用 anon/public key（在 Supabase 控制台 Settings > API 中获取），不要使用 service_role key！'
  )
}

// Supabase 客户端配置选项
// 针对网络不稳定或连接重置问题的优化配置
const clientOptions: SupabaseClientOptions<'public'> = {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // 增加超时时间，避免连接重置
    flowType: 'pkce',
  },
  global: {
    // 添加自定义 fetch，支持重试机制
    fetch: async (url, options = {}) => {
      const maxRetries = 3
      let lastError: Error | null = null

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // 添加超时控制（30秒）
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 30000)

          const response = await fetch(url, {
            ...options,
            signal: controller.signal,
          })

          clearTimeout(timeoutId)

          // 如果是连接错误，重试
          if (!response.ok && response.status === 0) {
            throw new Error('Connection error')
          }

          return response
        } catch (error: any) {
          lastError = error

          // 如果是连接重置或网络错误，且还有重试次数，则重试
          if (
            (error.name === 'AbortError' ||
              error.message?.includes('reset') ||
              error.message?.includes('network') ||
              error.message?.includes('Failed to fetch')) &&
            attempt < maxRetries
          ) {
            // 指数退避：1s, 2s, 4s
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 4000)
            console.warn(
              `Supabase 请求失败（尝试 ${attempt}/${maxRetries}），${delay}ms 后重试...`,
              error.message
            )
            await new Promise((resolve) => setTimeout(resolve, delay))
            continue
          }

          // 如果达到最大重试次数或不是网络错误，抛出错误
          throw error
        }
      }

      throw lastError || new Error('Request failed after retries')
    },
  },
  db: {
    schema: 'public',
  },
}

// 仍然导出实例以避免类型为 null，若未配置会使用占位值，运行时请求会失败并提示配置环境变量
export const supabase = createClient(
  supabaseUrl || 'http://localhost',
  supabaseAnonKey || 'public-anon-key-placeholder',
  clientOptions
)

