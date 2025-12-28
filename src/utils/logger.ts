/**
 * 统一的日志工具
 * 提供统一的日志接口，便于后续扩展（如日志上报、日志级别控制等）
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogOptions {
  /** 是否在开发环境输出 */
  devOnly?: boolean
  /** 日志标签 */
  tag?: string
  /** 是否上报到服务器 */
  report?: boolean
}

/**
 * 日志配置
 */
const LOG_CONFIG = {
  /** 是否启用日志 */
  enabled: import.meta.env.DEV || import.meta.env.MODE !== 'production',
  /** 日志级别阈值（只输出此级别及以上的日志） */
  level: (import.meta.env.DEV ? 'debug' : 'warn') as LogLevel,
}

/**
 * 日志级别权重
 */
const LOG_LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

/**
 * 检查是否应该输出日志
 */
function shouldLog(level: LogLevel): boolean {
  if (!LOG_CONFIG.enabled) return false
  return LOG_LEVEL_WEIGHT[level] >= LOG_LEVEL_WEIGHT[LOG_CONFIG.level]
}

/**
 * 格式化日志消息
 */
function formatMessage(level: LogLevel, message: string, tag?: string): string {
  const timestamp = new Date().toISOString()
  const prefix = tag ? `[${tag}]` : ''
  return `${timestamp} [${level.toUpperCase()}] ${prefix} ${message}`
}

/**
 * 基础日志函数
 */
function log(level: LogLevel, message: string, ...args: any[]): void {
  if (!shouldLog(level)) return

  const formattedMessage = formatMessage(level, message)
  
  switch (level) {
    case 'debug':
      console.debug(formattedMessage, ...args)
      break
    case 'info':
      console.info(formattedMessage, ...args)
      break
    case 'warn':
      console.warn(formattedMessage, ...args)
      break
    case 'error':
      console.error(formattedMessage, ...args)
      break
  }
}

/**
 * 日志工具对象
 */
export const logger = {
  /**
   * 调试日志（仅在开发环境输出）
   */
  debug: (message: string, ...args: any[]) => {
    if (import.meta.env.DEV) {
      log('debug', message, ...args)
    }
  },

  /**
   * 信息日志
   */
  info: (message: string, ...args: any[]) => {
    log('info', message, ...args)
  },

  /**
   * 警告日志
   */
  warn: (message: string, ...args: any[]) => {
    log('warn', message, ...args)
  },

  /**
   * 错误日志
   */
  error: (message: string, error?: Error | unknown, ...args: any[]) => {
    if (error instanceof Error) {
      log('error', message, error, error.stack, ...args)
    } else {
      log('error', message, error, ...args)
    }
  },
}

/**
 * 创建带标签的日志器
 */
export function createLogger(tag: string) {
  return {
    debug: (message: string, ...args: any[]) => {
      if (import.meta.env.DEV) {
        log('debug', message, ...args)
      }
    },
    info: (message: string, ...args: any[]) => {
      log('info', message, ...args)
    },
    warn: (message: string, ...args: any[]) => {
      log('warn', message, ...args)
    },
    error: (message: string, error?: Error | unknown, ...args: any[]) => {
      if (error instanceof Error) {
        log('error', message, error, error.stack, ...args)
      } else {
        log('error', message, error, ...args)
      }
    },
  }
}
