/**
 * 移动端布局组件
 * 用于包装移动端页面，提供统一的样式和结构
 */

import type { ReactNode } from 'react'

interface MobileLayoutProps {
  children: ReactNode
  className?: string
}

export function MobileLayout({ children, className = '' }: MobileLayoutProps) {
  return (
    <div className={`min-h-screen bg-[#f5f5f5] ${className}`}>
      {children}
    </div>
  )
}
