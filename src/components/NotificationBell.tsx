import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getUnreadNotificationCount,
  type Notification,
} from '../api/notifications'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'

export function NotificationBell() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const [showDropdown, setShowDropdown] = useState(false)

  const userId = session?.user?.id

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unread-notification-count', userId],
    queryFn: () => (userId ? getUnreadNotificationCount(userId) : Promise.resolve(0)),
    enabled: !!userId,
    refetchInterval: 30000, // 每30秒刷新一次
  })

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: () => (userId ? getUserNotifications(userId, { limit: 20 }) : Promise.resolve([])),
    enabled: !!userId && showDropdown,
  })

  const markReadMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['unread-notification-count'] })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => (userId ? markAllNotificationsAsRead(userId) : Promise.resolve()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['unread-notification-count'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['unread-notification-count'] })
    },
  })

  if (!userId) {
    return null
  }

  return (
    <div className="relative">
      <button
        className="relative p-2 text-slate-600 hover:text-slate-900 transition-colors"
        onClick={() => setShowDropdown(!showDropdown)}
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-lg z-50 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 p-3">
              <h3 className="text-sm font-semibold text-slate-900">通知</h3>
              {notifications.some((n) => !n.read) && (
                <button
                  className="text-xs text-brand-600 hover:text-brand-700"
                  onClick={() => markAllReadMutation.mutate()}
                >
                  全部已读
                </button>
              )}
            </div>
            <div className="divide-y divide-slate-100">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">
                  暂无通知
                </div>
              ) : (
                notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkRead={() => markReadMutation.mutate(notification.id)}
                    onDelete={() => deleteMutation.mutate(notification.id)}
                  />
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function NotificationItem({
  notification,
  onMarkRead,
  onDelete,
}: {
  notification: Notification
  onMarkRead: () => void
  onDelete: () => void
}) {
  const getTypeIcon = (type: Notification['type']) => {
    switch (type) {
      case 'exam_start':
        return '📝'
      case 'exam_end':
        return '⏰'
      case 'grade_released':
        return '📊'
      case 'manual_review_completed':
        return '✅'
      default:
        return '🔔'
    }
  }

  const getTypeColor = (type: Notification['type']) => {
    switch (type) {
      case 'exam_start':
        return 'bg-blue-50 text-blue-700'
      case 'exam_end':
        return 'bg-amber-50 text-amber-700'
      case 'grade_released':
        return 'bg-emerald-50 text-emerald-700'
      case 'manual_review_completed':
        return 'bg-purple-50 text-purple-700'
      default:
        return 'bg-slate-50 text-slate-700'
    }
  }

  return (
    <div
      className={`p-3 hover:bg-slate-50 transition-colors ${
        !notification.read ? 'bg-blue-50/50' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="text-lg">{getTypeIcon(notification.type)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-900">{notification.title}</h4>
            {!notification.read && (
              <button
                className="text-xs text-brand-600 hover:text-brand-700 flex-shrink-0"
                onClick={onMarkRead}
              >
                标记已读
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-600">{notification.content}</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {new Date(notification.created_at).toLocaleString('zh-CN')}
            </span>
            {notification.related_id && (
              <Link
                to={`/result/${notification.related_id}`}
                className="text-xs text-brand-600 hover:text-brand-700"
              >
                查看详情
              </Link>
            )}
            <button
              className="text-xs text-slate-400 hover:text-red-600"
              onClick={onDelete}
            >
              删除
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
