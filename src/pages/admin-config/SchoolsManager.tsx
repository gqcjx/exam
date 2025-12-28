import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAllSchools, createSchool, updateSchool, deleteSchool, type School } from '../../api/config'

interface SchoolsManagerProps {
    onMessage: (msg: string) => void
}

export function SchoolsManager({ onMessage }: SchoolsManagerProps) {
    const queryClient = useQueryClient()
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState<School | null>(null)

    const { data: schools = [], isLoading } = useQuery({
        queryKey: ['all-schools'],
        queryFn: getAllSchools,
    })

    const createMutation = useMutation({
        mutationFn: createSchool,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['all-schools'] })
            queryClient.invalidateQueries({ queryKey: ['schools'] })
            setShowForm(false)
            onMessage('创建成功')
        },
        onError: (err: any) => {
            onMessage(err?.message || '创建失败')
        },
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Partial<School> }) => updateSchool(id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['all-schools'] })
            queryClient.invalidateQueries({ queryKey: ['schools'] })
            setEditing(null)
            onMessage('更新成功')
        },
        onError: (err: any) => {
            onMessage(err?.message || '更新失败')
        },
    })

    const deleteMutation = useMutation({
        mutationFn: deleteSchool,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['all-schools'] })
            queryClient.invalidateQueries({ queryKey: ['schools'] })
            onMessage('删除成功')
        },
        onError: (err: any) => {
            onMessage(err?.message || '删除失败')
        },
    })

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">学校管理</h2>
                <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                        setEditing(null)
                        setShowForm(true)
                    }}
                >
                    添加学校
                </button>
            </div>

            {showForm && (
                <SchoolForm
                    school={editing}
                    onSubmit={(data) => {
                        if (editing) {
                            updateMutation.mutate({ id: editing.id, updates: data })
                        } else {
                            createMutation.mutate(data)
                        }
                    }}
                    onCancel={() => {
                        setShowForm(false)
                        setEditing(null)
                    }}
                    isLoading={createMutation.isPending || updateMutation.isPending}
                />
            )}

            {isLoading ? (
                <p className="text-sm text-slate-600">加载中...</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">学校名称</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">代码</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">地址</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">联系电话</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">状态</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {schools.map((school) => (
                                <tr key={school.id}>
                                    <td className="px-4 py-3 text-sm text-slate-900">{school.name}</td>
                                    <td className="px-4 py-3 text-sm text-slate-600">{school.code || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-slate-600">{school.address || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-slate-600">{school.phone || '-'}</td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`rounded-full px-2 py-1 text-xs font-semibold ${school.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                                }`}
                                        >
                                            {school.enabled ? '启用' : '禁用'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                className="text-sm text-brand-600 hover:text-brand-700"
                                                onClick={() => {
                                                    setEditing(school)
                                                    setShowForm(true)
                                                }}
                                            >
                                                编辑
                                            </button>
                                            <button
                                                className="text-sm text-red-600 hover:text-red-700"
                                                onClick={() => {
                                                    if (confirm(`确定要删除学校"${school.name}"吗？`)) {
                                                        deleteMutation.mutate(school.id)
                                                    }
                                                }}
                                                disabled={deleteMutation.isPending}
                                            >
                                                删除
                                            </button>
                                            <button
                                                className="text-sm text-slate-600 hover:text-slate-700"
                                                onClick={() => {
                                                    updateMutation.mutate({ id: school.id, updates: { enabled: !school.enabled } })
                                                }}
                                            >
                                                {school.enabled ? '禁用' : '启用'}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

function SchoolForm({
    school,
    onSubmit,
    onCancel,
    isLoading,
}: {
    school: School | null
    onSubmit: (data: { name: string; code?: string; address?: string; phone?: string }) => void
    onCancel: () => void
    isLoading: boolean
}) {
    const [name, setName] = useState(school?.name || '')
    const [code, setCode] = useState(school?.code || '')
    const [address, setAddress] = useState(school?.address || '')
    const [phone, setPhone] = useState(school?.phone || '')

    return (
        <div className="card bg-slate-50 space-y-3 p-4 border border-slate-200 rounded-xl">
            <h3 className="text-sm font-semibold text-slate-900">{school ? '编辑学校' : '添加学校'}</h3>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs text-slate-600 mb-1">学校名称 *</label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label className="block text-xs text-slate-600 mb-1">代码</label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs text-slate-600 mb-1">地址</label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs text-slate-600 mb-1">联系电话</label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                    />
                </div>
            </div>
            <div className="flex gap-2">
                <button
                    className="btn btn-primary btn-sm"
                    onClick={() => onSubmit({ name, code: code || undefined, address: address || undefined, phone: phone || undefined })}
                    disabled={isLoading || !name.trim()}
                >
                    {school ? '更新' : '创建'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={onCancel} disabled={isLoading}>
                    取消
                </button>
            </div>
        </div>
    )
}
