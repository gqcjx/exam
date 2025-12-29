/**
 * 设备感知路由组件
 * 根据设备类型和用户角色选择不同的组件
 */

import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { isMobileDevice } from '../utils/deviceDetection'

interface DeviceAwareRouteProps {
  mobileComponent: ReactNode
  desktopComponent: ReactNode
  roles?: ('student' | 'teacher' | 'admin' | 'parent')[]
  /**
   * 是否仅在登录后检测（用于登录页面等未登录状态）
   * 如果为 true，未登录时总是使用桌面端组件
   */
  requireAuth?: boolean
}

/**
 * 设备感知路由组件
 * - 如果是移动设备且用户是学生（或未指定角色），使用移动端组件
 * - 否则使用桌面端组件
 */
export function DeviceAwareRoute({ 
  mobileComponent, 
  desktopComponent, 
  roles,
  requireAuth = false 
}: DeviceAwareRouteProps) {
  const { profile } = useAuth()
  const isMobile = isMobileDevice()
  
  // 如果需要认证但用户未登录，使用桌面端组件
  if (requireAuth && !profile) {
    return <>{desktopComponent}</>
  }
  
  // 如果指定了角色，检查用户角色是否匹配
  if (roles && roles.length > 0) {
    if (!profile || !roles.includes(profile.role as any)) {
      // 角色不匹配，使用桌面端组件
      return <>{desktopComponent}</>
    }
  }
  
  // 如果是移动设备，且：
  // 1. 未指定角色（登录页面等），或
  // 2. 用户是学生
  if (isMobile && (!roles || roles.includes('student') && profile?.role === 'student')) {
    return <>{mobileComponent}</>
  }
  
  // 否则使用桌面端组件
  return <>{desktopComponent}</>
}
