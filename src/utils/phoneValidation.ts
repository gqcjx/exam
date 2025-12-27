/**
 * 验证手机号格式（中国大陆）
 * @param phone 手机号
 * @returns 是否为有效手机号
 */
export function isValidPhone(phone: string): boolean {
  // 中国大陆手机号：11位数字，以1开头，第二位为3-9
  const phoneRegex = /^1[3-9]\d{9}$/
  return phoneRegex.test(phone.replace(/\s+/g, ''))
}

/**
 * 格式化手机号（添加空格）
 * @param phone 手机号
 * @returns 格式化后的手机号
 */
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\s+/g, '')
  if (cleaned.length <= 3) return cleaned
  if (cleaned.length <= 7) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`
  return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7, 11)}`
}

/**
 * 清理手机号（移除空格和特殊字符）
 * @param phone 手机号
 * @returns 清理后的手机号
 */
export function cleanPhone(phone: string): string {
  return phone.replace(/\s+/g, '').replace(/[^\d]/g, '')
}

/**
 * 判断输入是手机号还是邮箱
 * @param input 输入内容
 * @returns 'phone' | 'email' | 'unknown'
 */
export function detectInputType(input: string): 'phone' | 'email' | 'unknown' {
  const cleaned = cleanPhone(input)
  if (isValidPhone(cleaned)) {
    return 'phone'
  }
  if (input.includes('@') && input.includes('.')) {
    return 'email'
  }
  return 'unknown'
}
