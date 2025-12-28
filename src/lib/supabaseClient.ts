import { createClient } from '@supabase/supabase-js'

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

// 检测是否在 Netlify 环境
const isNetlify = typeof window !== 'undefined' && 
  (window.location.hostname.includes('netlify.app') || 
   window.location.hostname.includes('netlify.com'))

// 自定义 fetch 函数，在 Netlify 环境下使用代理
const customFetch = isNetlify && supabaseUrl
  ? async (url: string, options?: RequestInit) => {
      // 如果是 Supabase API 请求，通过 Netlify Function 代理
      if (url.startsWith(supabaseUrl)) {
        const apiPath = url.replace(supabaseUrl, '').replace(/^\//, '')
        const proxyUrl = `/.netlify/functions/supabase-proxy/${apiPath}`
        
        // 保留原始 headers
        const headers = new Headers(options?.headers)
        
        // 确保包含 apikey
        if (!headers.has('apikey') && supabaseAnonKey) {
          headers.set('apikey', supabaseAnonKey)
        }
        
        return fetch(proxyUrl, {
          ...options,
          headers,
        })
      }
      
      // 非 Supabase 请求，使用原始 fetch
      return fetch(url, options)
    }
  : undefined

// 仍然导出实例以避免类型为 null，若未配置会使用占位值，运行时请求会失败并提示配置环境变量
export const supabase = createClient(
  supabaseUrl || 'http://localhost',
  supabaseAnonKey || 'public-anon-key-placeholder',
  {
    global: {
      fetch: customFetch,
    },
  }
)

