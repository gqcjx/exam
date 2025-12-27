import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { generateInviteCode, getInviteCodes, deleteInviteCode, type InviteCode } from '../api/inviteCodes'
import { useAuth } from '../context/AuthContext'

export default function AdminInviteCodes() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [message, setMessage] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<'teacher' | 'admin'>('teacher')

  const { data: codes = [], isLoading } = useQuery({
    queryKey: ['invite-codes'],
    queryFn: getInviteCodes,
  })

  const generateMutation = useMutation({
    mutationFn: (role: 'teacher' | 'admin') => generateInviteCode(role),
    onSuccess: (code) => {
      queryClient.invalidateQueries({ queryKey: ['invite-codes'] })
      setMessage(`邀请码生成成功：${code}`)
      setTimeout(() => setMessage(null), 5000)
    },
    onError: (err: any) => {
      setMessage(err?.message || '生成邀请码失败')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteInviteCode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invite-codes'] })
      setMessage('删除成功')
      setTimeout(() => setMessage(null), 2000)
    },
    onError: (err: any) => {
      setMessage(err?.message || '删除失败')
    },
  })

  if (profile?.role !== 'admin') {
    return (
      <div className="card">
        <p className="text-sm text-slate-600">仅管理员可访问邀请码管理。</p>
      </div>
    )
  }

  const handleGenerate = () => {
    generateMutation.mutate(selectedRole)
  }

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这个邀请码吗？')) {
      deleteMutation.mutate(id)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN')
  }

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date()
  }

  const isUsed = (usedBy: string | null) => {
    return usedBy !== null
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">邀请码管理</h1>
          <p className="text-sm text-slate-600">生成和管理教师/管理员邀请码（有效期10天）</p>
        </div>
      </div>

      {message && (
        <div className={`rounded-lg p-3 text-sm ${
          message.includes('成功') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
        }`}>
          {message}
        </div>
      )}

      {/* 生成邀请码 */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">生成新邀请码</h2>
        <div className="flex flex-wrap gap-3">
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as 'teacher' | 'admin')}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="teacher">教师</option>
            <option value="admin">管理员</option>
          </select>
          <button
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            className="btn btn-primary"
          >
            {generateMutation.isPending ? '生成中...' : '生成邀请码'}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          邀请码有效期为 10 天，使用后自动失效
        </p>
      </div>

      {/* 邀请码列表 */}
      <div className="card">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">邀请码列表</h2>
        {isLoading ? (
          <p className="text-sm text-slate-600">加载中...</p>
        ) : codes.length === 0 ? (
          <p className="text-sm text-slate-600">暂无邀请码</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-3 py-2 text-left text-slate-700">邀请码</th>
                  <th className="px-3 py-2 text-left text-slate-700">角色</th>
                  <th className="px-3 py-2 text-left text-slate-700">状态</th>
                  <th className="px-3 py-2 text-left text-slate-700">创建时间</th>
                  <th className="px-3 py-2 text-left text-slate-700">过期时间</th>
                  <th className="px-3 py-2 text-left text-slate-700">使用时间</th>
                  <th className="px-3 py-2 text-left text-slate-700">操作</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((code) => (
                  <tr key={code.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-mono font-semibold">{code.code}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-1 text-xs ${
                        code.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {code.role === 'admin' ? '管理员' : '教师'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {isUsed(code.used_by) ? (
                        <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">已使用</span>
                      ) : isExpired(code.expires_at) ? (
                        <span className="rounded bg-red-100 px-2 py-1 text-xs text-red-700">已过期</span>
                      ) : (
                        <span className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700">可用</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{formatDate(code.created_at)}</td>
                    <td className="px-3 py-2 text-slate-600">{formatDate(code.expires_at)}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {code.used_at ? formatDate(code.used_at) : '-'}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => handleDelete(code.id)}
                        disabled={deleteMutation.isPending}
                        className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

