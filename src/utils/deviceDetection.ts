/**
 * 设备检测工具
 * 用于判断用户是否使用移动设备（手机/平板）
 */

/**
 * 检测是否为移动设备（手机或平板）
 * @param forceMobile 强制返回移动设备（用于测试）
 * @returns {boolean} 如果是移动设备返回 true，否则返回 false
 */
export function isMobileDevice(forceMobile?: boolean): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  // 测试模式：通过 URL 参数强制启用移动端界面
  // 使用方法：在 URL 后添加 ?mobile=true 或 ?mobile=1
  const urlParams = new URLSearchParams(window.location.search)
  const urlMobileParam = urlParams.get('mobile')
  if (urlMobileParam === 'true' || urlMobileParam === '1') {
    return true
  }

  // 测试模式：通过 localStorage 强制启用移动端界面
  // 使用方法：在浏览器控制台执行 localStorage.setItem('forceMobile', 'true')
  const localStorageMobile = localStorage.getItem('forceMobile')
  if (localStorageMobile === 'true' || localStorageMobile === '1') {
    return true
  }

  // 如果明确指定 forceMobile 参数，直接返回
  if (forceMobile === true) {
    return true
  }

  // 检测 User Agent
  const userAgent = window.navigator.userAgent.toLowerCase()
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i
  const isMobileUA = mobileRegex.test(userAgent)

  // 检测屏幕宽度（移动设备通常小于 768px）
  const isMobileScreen = window.innerWidth < 768

  // 检测触摸支持（移动设备通常支持触摸）
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0

  // 综合判断：如果满足以下任一条件，则认为是移动设备
  // 1. User Agent 匹配移动设备
  // 2. 屏幕宽度小于 768px 且支持触摸
  return isMobileUA || (isMobileScreen && isTouchDevice)
}

/**
 * 检测是否为平板设备
 * @returns {boolean} 如果是平板设备返回 true，否则返回 false
 */
export function isTabletDevice(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const userAgent = window.navigator.userAgent.toLowerCase()
  const tabletRegex = /ipad|android(?!.*mobile)|tablet/i
  const isTabletUA = tabletRegex.test(userAgent)

  // 平板通常屏幕宽度在 768px - 1024px 之间
  const width = window.innerWidth
  const isTabletScreen = width >= 768 && width < 1024

  return isTabletUA || (isTabletScreen && 'ontouchstart' in window)
}

/**
 * 检测是否为手机设备
 * @returns {boolean} 如果是手机设备返回 true，否则返回 false
 */
export function isPhoneDevice(): boolean {
  return isMobileDevice() && !isTabletDevice()
}

/**
 * 获取设备类型
 * @returns {'phone' | 'tablet' | 'desktop'}
 */
export function getDeviceType(): 'phone' | 'tablet' | 'desktop' {
  if (isPhoneDevice()) {
    return 'phone'
  }
  if (isTabletDevice()) {
    return 'tablet'
  }
  return 'desktop'
}
