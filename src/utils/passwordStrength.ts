export type PasswordStrength = 'weak' | 'medium' | 'strong' | 'very-strong'

export interface PasswordStrengthResult {
  strength: PasswordStrength
  score: number // 0-4
  feedback: string[]
  meetsRequirements: boolean
}

/**
 * 检测密码强度
 * @param password 密码
 * @returns 密码强度结果
 */
export function checkPasswordStrength(password: string): PasswordStrengthResult {
  if (!password) {
    return {
      strength: 'weak',
      score: 0,
      feedback: [],
      meetsRequirements: false,
    }
  }

  const feedback: string[] = []
  let score = 0

  // 长度检查
  if (password.length < 6) {
    feedback.push('密码长度至少6个字符')
    return {
      strength: 'weak',
      score: 0,
      feedback,
      meetsRequirements: false,
    }
  }
  if (password.length >= 6) score += 1
  if (password.length >= 12) score += 1

  // 字符类型检查
  const hasLower = /[a-z]/.test(password)
  const hasUpper = /[A-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSpecial = /[^a-zA-Z0-9]/.test(password)

  const typeCount = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length

  if (hasLower) score += 0.5
  if (hasUpper) score += 0.5
  if (hasNumber) score += 0.5
  if (hasSpecial) score += 0.5

  // 反馈信息
  if (!hasLower) feedback.push('建议包含小写字母')
  if (!hasUpper) feedback.push('建议包含大写字母')
  if (!hasNumber) feedback.push('建议包含数字')
  if (!hasSpecial) feedback.push('建议包含特殊符号')

  // 判断强度
  let strength: PasswordStrength = 'weak'
  if (score < 2) {
    strength = 'weak'
  } else if (score < 3) {
    strength = 'medium'
  } else if (score < 4) {
    strength = 'strong'
  } else {
    strength = 'very-strong'
  }

  // 必须包含至少两种类型
  const meetsRequirements = typeCount >= 2 && password.length >= 6 && password.length <= 32

  return {
    strength,
    score: Math.min(4, Math.floor(score)),
    feedback: meetsRequirements ? [] : feedback,
    meetsRequirements,
  }
}

/**
 * 获取密码强度显示文本
 */
export function getPasswordStrengthText(strength: PasswordStrength): string {
  const texts: Record<PasswordStrength, string> = {
    weak: '弱',
    medium: '中',
    strong: '强',
    'very-strong': '很强',
  }
  return texts[strength]
}

/**
 * 获取密码强度颜色
 */
export function getPasswordStrengthColor(strength: PasswordStrength): string {
  const colors: Record<PasswordStrength, string> = {
    weak: 'bg-red-500',
    medium: 'bg-yellow-500',
    strong: 'bg-green-500',
    'very-strong': 'bg-emerald-600',
  }
  return colors[strength]
}
