import { QueryClient } from '@tanstack/react-query'

// 清除可能损坏的缓存
function clearCorruptedCache() {
  try {
    // 清除所有查询缓存
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      const dbName = 'REACT_QUERY_OFFLINE_CACHE'
      const request = indexedDB.deleteDatabase(dbName)
      request.onsuccess = () => {
        console.log('Cleared React Query cache')
      }
      request.onerror = () => {
        console.warn('Failed to clear React Query cache')
      }
    }
  } catch (error) {
    console.warn('Error clearing cache:', error)
  }
}

// 在应用启动时清除可能损坏的缓存
if (typeof window !== 'undefined') {
  // 只在首次加载时清除
  const cacheCleared = sessionStorage.getItem('react-query-cache-cleared')
  if (!cacheCleared) {
    clearCorruptedCache()
    sessionStorage.setItem('react-query-cache-cleared', 'true')
  }
}

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
        
        // 深度检查对象结构，如果发现 undefined 的 name 属性，返回新数据
        if (typeof oldData === 'object' && typeof newData === 'object') {
          try {
            // 检查是否有 undefined 的 name 属性
            const checkForUndefinedName = (obj: any, path = ''): boolean => {
              if (obj === null || obj === undefined) return false
              if (typeof obj !== 'object') return false
              
              for (const key in obj) {
                if (key === 'name' && obj[key] === undefined) {
                  console.warn(`Found undefined name at path: ${path}`)
                  return true
                }
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                  if (checkForUndefinedName(obj[key], `${path}.${key}`)) {
                    return true
                  }
                }
              }
              return false
            }
            
            if (checkForUndefinedName(oldData)) {
              return newData
            }
          } catch (error) {
            // 如果检查过程中出错，返回新数据
            return newData
          }
        }
        
        // 否则使用默认的结构共享
        return newData
      },
    },
  },
})

