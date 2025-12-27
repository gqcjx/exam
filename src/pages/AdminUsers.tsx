import { useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listUsers, updateUser, type UserRow } from '../api/users'
import { batchImportStudents, parseExcelFile, generateImportTemplate, type StudentImportRow } from '../api/batchImport'
import type { Role } from '../context/AuthContext'
import { useAuth } from '../context/AuthContext'

export default function AdminUsers() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all')
  const [keyword, setKeyword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: listUsers,
  })

  const mutation = useMutation({
    mutationFn: ({ userId, updates }: { userId: string; updates: { role?: Role; disabled?: boolean } }) =>
      updateUser(userId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setMessage('更新成功')
      setTimeout(() => setMessage(null), 2000)
    },
    onError: (err: any) => {
      setMessage(err?.message || '更新失败')
    },
  })

  const importMutation = useMutation({
    mutationFn: ({ students, fileName }: { students: StudentImportRow[]; fileName: string }) => {
      return batchImportStudents(
        students,
        profile?.user_id,
        profile?.role || undefined,
        profile?.school_id || undefined,
        undefined, // 管理员不需要班级限制
        fileName,
      )
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setShowImportDialog(false)
      setMessage(
        `导入完成：成功 ${result.success} 个，失败 ${result.failed} 个${
          result.errors.length > 0 ? `\n错误：${result.errors.slice(0, 5).join('; ')}` : ''
        }`,
      )
      setTimeout(() => setMessage(null), 5000)
    },
    onError: (err: any) => {
      setMessage(err?.message || '导入失败')
    },
  })

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false
      if (keyword) {
        const kw = keyword.toLowerCase()
        if (!(u.name || '').toLowerCase().includes(kw) && !(u.grade || '').includes(keyword)) {
          return false
        }
      }
      return true
    })
  }, [users, roleFilter, keyword])

  if (profile?.role !== 'admin') {
    return (
      <div className="card">
        <p className="text-sm text-slate-600">仅管理员可访问用户管理。</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">用户管理</h1>
          <p className="text-sm text-slate-600">
            查看并管理系统用户角色与账号状态（禁用后无法登录和访问受保护页面）。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-secondary"
            onClick={() => generateImportTemplate()}
          >
            <svg
              className="h-4 w-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            下载导入模板
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              setShowImportDialog(true)
              fileInputRef.current?.click()
            }}
          >
            批量导入学生
          </button>
        </div>
        <input
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          ref={fileInputRef}
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            
            // 检查文件大小（限制100MB）
            if (file.size > 100 * 1024 * 1024) {
              alert('文件大小不能超过 100MB')
              return
            }

            // 检查文件类型
            const fileExtension = file.name.split('.').pop()?.toLowerCase()
            if (!['xlsx', 'xls'].includes(fileExtension || '')) {
              alert('只支持 Excel 格式文件（.xlsx, .xls）')
              return
            }

            // 检查导入数量上限
            try {
              const students = await parseExcelFile(file)
              if (students.length === 0) {
                alert('Excel文件中没有有效数据')
                return
              }
              if (students.length > 6000) {
                alert(`导入数量不能超过 6000 条，当前文件包含 ${students.length} 条数据`)
                return
              }
              if (confirm(`确定要导入 ${students.length} 个学生吗？\n\n注意：已存在的学生（通过邮箱或手机号判断）将被跳过，同班同名将自动添加后缀（A, AA, AAA...）`)) {
                importMutation.mutate({ students, fileName: file.name })
              }
            } catch (err: any) {
              alert(err?.message || '解析Excel文件失败')
            } finally {
              e.target.value = ''
            }
          }}
        />
      </div>

      {message && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            message.includes('成功')
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
        >
          {message}
        </div>
      )}

      <div className="card flex flex-wrap items-center gap-3 text-sm">
        <select
          className="rounded-lg border border-slate-200 px-3 py-2"
          value={roleFilter === 'all' ? 'all' : roleFilter || ''}
          onChange={(e) =>
            setRoleFilter(e.target.value === 'all' ? 'all' : (e.target.value as Role | 'all'))
          }
        >
          <option value="all">全部角色</option>
          <option value="admin">管理员</option>
          <option value="teacher">教师</option>
          <option value="student">学生</option>
          <option value="parent">家长</option>
        </select>
        <input
          placeholder="按姓名/年级搜索"
          className="min-w-[200px] flex-1 rounded-lg border border-slate-200 px-3 py-2"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
      </div>

      <div className="card overflow-x-auto">
        {isLoading ? (
          <p className="text-sm text-slate-600">加载中...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate-600">暂无用户或筛选条件下无结果。</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                <th className="px-3 py-2 text-left">姓名</th>
                <th className="px-3 py-2 text-left">年级/班级</th>
                <th className="px-3 py-2 text-left">角色</th>
                <th className="px-3 py-2 text-left">状态</th>
                <th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <UserRowItem key={u.user_id} user={u} onSave={mutation.mutate} saving={mutation.isPending} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function UserRowItem({
  user,
  onSave,
  saving,
}: {
  user: UserRow
  onSave: (args: { userId: string; updates: { role?: Role; disabled?: boolean } }) => void
  saving: boolean
}) {
  const [role, setRole] = useState<Role>(user.role)
  const [disabled, setDisabled] = useState<boolean>(!!user.disabled)

  return (
    <tr className="border-b border-slate-100">
      <td className="px-3 py-2">
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900">{user.name || '未命名用户'}</span>
          <span className="text-[11px] text-slate-500">{user.user_id}</span>
        </div>
      </td>
      <td className="px-3 py-2 text-xs text-slate-600">
        {user.grade || '-'} {user.class || ''}
      </td>
      <td className="px-3 py-2">
        <select
          className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
          value={role || ''}
          onChange={(e) => setRole((e.target.value || null) as Role)}
        >
          <option value="admin">管理员</option>
          <option value="teacher">教师</option>
          <option value="student">学生</option>
          <option value="parent">家长</option>
        </select>
      </td>
      <td className="px-3 py-2 text-xs text-slate-600">
        <label className="inline-flex items-center gap-1">
          <input
            type="checkbox"
            className="h-3 w-3 rounded border-slate-300"
            checked={disabled}
            onChange={(e) => setDisabled(e.target.checked)}
          />
          <span className={disabled ? 'text-red-600' : 'text-emerald-600'}>
            {disabled ? '已禁用' : '正常'}
          </span>
        </label>
      </td>
      <td className="px-3 py-2 text-right">
        <button
          type="button"
          className="btn btn-secondary btn-xs"
          disabled={saving}
          onClick={() => onSave({ userId: user.user_id, updates: { role, disabled } })}
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </td>
    </tr>
  )
}


