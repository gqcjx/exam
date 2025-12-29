/**
 * 设备检测工具
 * 用于检测用户设备类型（手机、平板、桌面）
 */

/**
 * 设备类型枚举
 */
export type DeviceType = 'mobile' | 'tablet' | 'desktop'

/**
 * 检测设备类型
 * @returns 设备类型
 */
export function detectDevice(): DeviceType {
  if (typeof window === 'undefined') {
    return 'desktop' // SSR 默认返回桌面
  }

  const userAgent = navigator.userAgent.toLowerCase()
  const width = window.innerWidth

  // 检测移动设备（手机）
  const isMobile = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent) ||
    (width <= 768 && /mobile/i.test(userAgent))

  // 检测平板设备
  const isTablet = /ipad|android(?!.*mobile)|tablet|playbook|silk/i.test(userAgent) ||
    (width > 768 && width <= 1024 && /touch/i.test(userAgent))

  // 根据屏幕宽度进一步判断
  if (width <= 768) {
    return 'mobile'
  } else if (width <= 1024) {
    return isTablet ? 'tablet' : 'mobile'
  }

  // 桌面设备
  return 'desktop'
}

/**
 * 判断是否为移动设备（手机或平板）
 * @returns 是否为移动设备
 */
export function isMobileDevice(): boolean {
  const device = detectDevice()
  return device === 'mobile' || device === 'tablet'
}

/**
 * 判断是否为手机设备
 * @returns 是否为手机
 */
export function isMobile(): boolean {
  return detectDevice() === 'mobile'
}

/**
 * 判断是否为平板设备
 * @returns 是否为平板
 */
export function isTablet(): boolean {
  return detectDevice() === 'tablet'
}

/**
 * 判断是否为桌面设备
 * @returns 是否为桌面
 */
export function isDesktop(): boolean {
  return detectDevice() === 'desktop'
}

/**
 * 获取设备信息（用于调试）
 */
export function getDeviceInfo() {
  return {
    type: detectDevice(),
    userAgent: typeof window !== 'undefined' ? navigator.userAgent : '',
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
    isMobile: isMobileDevice(),
    isMobileOnly: isMobile(),
    isTablet: isTablet(),
    isDesktop: isDesktop(),
  }
}
