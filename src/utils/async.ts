/**
 * 异步操作工具
 * 提供重试、超时、并发控制等异步操作增强功能
 */

import { logger } from './logger'
import { isRetryableError, handleError, type AppError } from './errorHandler'

/**
 * 重试配置
 */
export interface RetryOptions {
  /** 最大重试次数 */
  maxRetries?: number
  /** 重试延迟（毫秒） */
  delay?: number
  /** 是否使用指数退避 */
  exponentialBackoff?: boolean
  /** 最大延迟时间（毫秒） */
  maxDelay?: number
  /** 重试条件函数 */
  shouldRetry?: (error: unknown, attempt: number) => boolean
}

/**
 * 默认重试配置
 */
const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  delay: 1000,
  exponentialBackoff: true,
  maxDelay: 10000,
  shouldRetry: (error) => isRetryableError(error),
}

/**
 * 计算重试延迟
 */
function calculateDelay(
  attempt: number,
  baseDelay: number,
  exponentialBackoff: boolean,
  maxDelay: number
): number {
  if (!exponentialBackoff) {
    return baseDelay
  }

  const delay = baseDelay * Math.pow(2, attempt - 1)
  return Math.min(delay, maxDelay)
}

/**
 * 带重试的异步操作
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options }
  let lastError: unknown

  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // 检查是否应该重试
      if (attempt >= opts.maxRetries || !opts.shouldRetry(error, attempt)) {
        throw error
      }

      // 计算延迟时间
      const delay = calculateDelay(
        attempt,
        opts.delay,
        opts.exponentialBackoff,
        opts.maxDelay
      )

      logger.warn(
        `操作失败（尝试 ${attempt}/${opts.maxRetries}），${delay}ms 后重试...`,
        error
      )

      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

/**
 * 超时配置
 */
export interface TimeoutOptions {
  /** 超时时间（毫秒） */
  timeout?: number
  /** 超时错误消息 */
  timeoutMessage?: string
}

/**
 * 默认超时时间（30秒）
 */
const DEFAULT_TIMEOUT = 30000

/**
 * 带超时的异步操作
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  options: TimeoutOptions = {}
): Promise<T> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT
  const timeoutMessage = options.timeoutMessage ?? `操作超时（${timeout}ms）`

  return Promise.race([
    fn(),
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(timeoutMessage))
      }, timeout)
    }),
  ])
}

/**
 * 并发控制配置
 */
export interface ConcurrencyOptions {
  /** 最大并发数 */
  concurrency?: number
}

/**
 * 默认最大并发数
 */
const DEFAULT_CONCURRENCY = 5

/**
 * 并发控制执行器
 */
export class ConcurrencyController {
  private running = 0
  private queue: Array<() => void> = []
  private readonly maxConcurrency: number

  constructor(maxConcurrency: number = DEFAULT_CONCURRENCY) {
    this.maxConcurrency = maxConcurrency
  }

  /**
   * 执行异步任务
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = async () => {
        this.running++
        try {
          const result = await fn()
          resolve(result)
        } catch (error) {
          reject(error)
        } finally {
          this.running--
          if (this.queue.length > 0) {
            const next = this.queue.shift()!
            next()
          }
        }
      }

      if (this.running < this.maxConcurrency) {
        run()
      } else {
        this.queue.push(run)
      }
    })
  }
}

/**
 * 批量执行异步任务（带并发控制）
 */
export async function batchExecute<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  options: ConcurrencyOptions = {}
): Promise<R[]> {
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY
  const controller = new ConcurrencyController(concurrency)

  const results = await Promise.all(
    items.map((item) => controller.execute(() => fn(item)))
  )

  return results
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      fn(...args)
    }, delay)
  }
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0

  return (...args: Parameters<T>) => {
    const now = Date.now()
    if (now - lastCall >= delay) {
      lastCall = now
      fn(...args)
    }
  }
}
