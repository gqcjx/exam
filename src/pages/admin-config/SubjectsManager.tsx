import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAllSubjects, createSubject, updateSubject, deleteSubject, type Subject } from '../../api/config'

interface SubjectsManagerProps {
    onMessage: (msg: string) => void
}

export function SubjectsManager({ onMessage }: SubjectsManagerProps) {
    const queryClient = useQueryClient()
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState<Subject | null>(null)

    const { data: subjects = [], isLoading } = useQuery({
        queryKey: ['all-subjects'],
        queryFn: getAllSubjects,
    })

    const createMutation = useMutation({
        mutationFn: createSubject,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['all-subjects'] })
            queryClient.invalidateQueries({ queryKey: ['subjects'] })
            setShowForm(false)
            onMessage('创建成功')
        },
        onError: (err: any) => {
            onMessage(err?.message || '创建失败')
        },
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Partial<Subject> }) =>
            updateSubject(id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['all-subjects'] })
            queryClient.invalidateQueries({ queryKey: ['subjects'] })
            setEditing(null)
            onMessage('更新成功')
        },
        onError: (err: any) => {
            onMessage(err?.message || '更新失败')
        },
    })

    const deleteMutation = useMutation({
        mutationFn: deleteSubject,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['all-subjects'] })
            queryClient.invalidateQueries({ queryKey: ['subjects'] })
            onMessage('删除成功')
        },
        onError: (err: any) => {
            onMessage(err?.message || '删除失败')
        },
    })

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">学科管理</h2>
                <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                        setEditing(null)
                        setShowForm(true)
                    }}
                >
                    添加学科
                </button>
            </div>

            {showForm && (
                <SubjectForm
                    subject={editing}
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
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">学科名称</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">代码</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">显示顺序</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">状态</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {subjects.map((subject) => (
                                <tr key={subject.id}>
                                    <td className="px-4 py-3 text-sm text-slate-900">{subject.name}</td>
                                    <td className="px-4 py-3 text-sm text-slate-600">{subject.code || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-slate-600">{subject.display_order}</td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`rounded-full px-2 py-1 text-xs font-semibold ${subject.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                                }`}
                                        >
                                            {subject.enabled ? '启用' : '禁用'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                className="text-sm text-brand-600 hover:text-brand-700"
                                                onClick={() => {
                                                    setEditing(subject)
                                                    setShowForm(true)
                                                }}
                                            >
                                                编辑
                                            </button>
                                            <button
                                                className="text-sm text-red-600 hover:text-red-700"
                                                onClick={() => {
                                                    if (confirm(`确定要删除学科"${subject.name}"吗？`)) {
                                                        deleteMutation.mutate(subject.id)
                                                    }
                                                }}
                                                disabled={deleteMutation.isPending}
                                            >
                                                删除
                                            </button>
                                            <button
                                                className="text-sm text-slate-600 hover:text-slate-700"
                                                onClick={() => {
                                                    updateMutation.mutate({ id: subject.id, updates: { enabled: !subject.enabled } })
                                                }}
                                            >
                                                {subject.enabled ? '禁用' : '启用'}
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

function SubjectForm({
    subject,
    onSubmit,
    onCancel,
    isLoading,
}: {
    subject: Subject | null
    onSubmit: (data: { name: string; code?: string; display_order?: number }) => void
    onCancel: () => void
    isLoading: boolean
}) {
    const [name, setName] = useState(subject?.name || '')
    const [code, setCode] = useState(subject?.code || '')
    const [displayOrder, setDisplayOrder] = useState(subject?.display_order || 0)

    return (
        <div className="card bg-slate-50 space-y-3 p-4 border border-slate-200 rounded-xl">
            <h3 className="text-sm font-semibold text-slate-900">{subject ? '编辑学科' : '添加学科'}</h3>
            <div className="grid grid-cols-3 gap-3">
                <div>
                    <label className="block text-xs text-slate-600 mb-1">学科名称 *</label>
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
                    <label className="block text-xs text-slate-600 mb-1">显示顺序</label>
                    <input
                        type="number"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={displayOrder}
                        onChange={(e) => setDisplayOrder(Number(e.target.value))}
                    />
                </div>
            </div>
            <div className="flex gap-2">
                <button
                    className="btn btn-primary btn-sm"
                    onClick={() => onSubmit({ name, code: code || undefined, display_order: displayOrder })}
                    disabled={isLoading || !name.trim()}
                >
                    {subject ? '更新' : '创建'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={onCancel} disabled={isLoading}>
                    取消
                </button>
            </div>
        </div>
    )
}
