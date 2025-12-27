import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { queryClient } from '../lib/queryClient'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    // 如果错误与 undefined name 相关，清除缓存
    if (error.message.includes("Cannot read properties of undefined (reading 'name')")) {
      console.warn('Detected undefined name error, clearing cache...')
      try {
        // 清除所有查询缓存
        queryClient.clear()
        
        // 清除 IndexedDB 缓存
        if (typeof window !== 'undefined' && 'indexedDB' in window) {
          const dbName = 'REACT_QUERY_OFFLINE_CACHE'
          indexedDB.deleteDatabase(dbName)
        }
        
        // 清除 sessionStorage 标记，以便下次重新清除
        sessionStorage.removeItem('react-query-cache-cleared')
        
        // 3秒后重新加载页面
        setTimeout(() => {
          window.location.reload()
        }, 3000)
      } catch (clearError) {
        console.error('Failed to clear cache:', clearError)
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="card max-w-md space-y-4">
            <h1 className="text-xl font-bold text-slate-900">出现错误</h1>
            <p className="text-sm text-slate-600">
              {this.state.error?.message.includes("Cannot read properties of undefined (reading 'name')")
                ? '检测到数据缓存问题，正在清除缓存并重新加载页面...'
                : '应用遇到了一个错误，请刷新页面重试。'}
            </p>
            {this.state.error?.message.includes("Cannot read properties of undefined (reading 'name')") && (
              <p className="text-xs text-slate-500">
                页面将在 3 秒后自动刷新
              </p>
            )}
            <button
              onClick={() => {
                queryClient.clear()
                window.location.reload()
              }}
              className="btn btn-primary w-full"
            >
              立即刷新
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
