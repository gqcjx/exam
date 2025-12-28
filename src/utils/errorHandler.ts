/**
 * 统一的错误处理工具
 * 提供统一的错误处理接口，便于错误分类、上报和用户提示
 */

import { logger } from './logger'

/**
 * 错误类型
 */
export const ErrorType = {
  /** 网络错误 */
  NETWORK: 'NETWORK',
  /** 认证错误 */
  AUTH: 'AUTH',
  /** 权限错误 */
  PERMISSION: 'PERMISSION',
  /** 数据错误 */
  DATA: 'DATA',
  /** 业务逻辑错误 */
  BUSINESS: 'BUSINESS',
  /** 未知错误 */
  UNKNOWN: 'UNKNOWN',
} as const

export type ErrorTypeValue = typeof ErrorType[keyof typeof ErrorType]

/**
 * 应用错误类
 */
export class AppError extends Error {
  public readonly type: ErrorTypeValue
  public readonly code?: string
  public readonly originalError?: Error | unknown
  public readonly userMessage?: string

  constructor(
    message: string,
    type: ErrorTypeValue = ErrorType.UNKNOWN,
    code?: string,
    originalError?: Error | unknown,
    userMessage?: string
  ) {
    super(message)
    this.name = 'AppError'
    this.type = type
    this.code = code
    this.originalError = originalError
    this.userMessage = userMessage
    // 保持错误堆栈（Node.js 环境）
    if (typeof (Error as any).captureStackTrace === 'function') {
      (Error as any).captureStackTrace(this, AppError)
    }
  }
}

/**
 * 错误信息映射（用于向用户显示友好的错误信息）
 */
const ERROR_MESSAGES: Record<string, string> = {
  [ErrorType.NETWORK]: '网络连接失败，请检查网络设置后重试',
  [ErrorType.AUTH]: '登录已过期，请重新登录',
  [ErrorType.PERMISSION]: '您没有权限执行此操作',
  [ErrorType.DATA]: '数据加载失败，请稍后重试',
  [ErrorType.BUSINESS]: '操作失败，请稍后重试',
  [ErrorType.UNKNOWN]: '发生未知错误，请稍后重试',
}

/**
 * 从错误对象中提取错误类型
 */
function extractErrorType(error: unknown): ErrorTypeValue {
  if (error instanceof AppError) {
    return error.type
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    
    // 网络错误
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('connection') ||
      message.includes('timeout') ||
      message.includes('reset')
    ) {
      return ErrorType.NETWORK
    }

    // 认证错误
    if (
      message.includes('auth') ||
      message.includes('unauthorized') ||
      message.includes('token') ||
      message.includes('session')
    ) {
      return ErrorType.AUTH
    }

    // 权限错误
    if (
      message.includes('permission') ||
      message.includes('forbidden') ||
      message.includes('access denied')
    ) {
      return ErrorType.PERMISSION
    }
  }

  return ErrorType.UNKNOWN
}

/**
 * 处理错误并返回用户友好的错误信息
 */
export function handleError(error: unknown, context?: string): AppError {
  const errorType = extractErrorType(error)
  const message = error instanceof Error ? error.message : String(error)
  const userMessage = ERROR_MESSAGES[errorType]

  const appError = new AppError(
    context ? `${context}: ${message}` : message,
    errorType,
    undefined,
    error,
    userMessage
  )

  // 记录错误日志
  logger.error(
    context ? `Error in ${context}` : 'Error occurred',
    appError,
    { type: errorType, userMessage }
  )

  return appError
}

/**
 * 获取用户友好的错误信息
 */
export function getUserErrorMessage(error: unknown): string {
  if (error instanceof AppError && error.userMessage) {
    return error.userMessage
  }

  const errorType = extractErrorType(error)
  return ERROR_MESSAGES[errorType]
}

/**
 * 判断是否为可重试的错误
 */
export function isRetryableError(error: unknown): boolean {
  const errorType = extractErrorType(error)
  return errorType === ErrorType.NETWORK
}

/**
 * 异步操作包装器，自动处理错误
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  context?: string,
  defaultValue?: T
): Promise<T | undefined> {
  try {
    return await fn()
  } catch (error) {
    handleError(error, context)
    return defaultValue
  }
}
