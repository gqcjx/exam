import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
      // 确保数据结构一致，避免缓存中的旧数据导致错误
      structuralSharing: (oldData, newData) => {
        // 如果新数据是 null 或 undefined，返回新数据
        if (!newData) return newData
        // 如果旧数据是 null 或 undefined，返回新数据
        if (!oldData) return newData
        // 如果数据结构不同，返回新数据
        if (Array.isArray(oldData) !== Array.isArray(newData)) return newData
        if (typeof oldData !== typeof newData) return newData
        // 否则使用默认的结构共享
        return newData
      },
      // 添加错误处理
      onError: (error) => {
        console.warn('Query error:', error)
      },
    },
  },
})

