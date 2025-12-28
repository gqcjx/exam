import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { isSupabaseReady } from '../lib/env'
import { SubjectsManager } from './admin-config/SubjectsManager'
import { GradesManager } from './admin-config/GradesManager'
import { SchoolsManager } from './admin-config/SchoolsManager'
import { ClassesManager } from './admin-config/ClassesManager'

export default function AdminConfig() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState<'subjects' | 'grades' | 'schools' | 'classes'>('subjects')
  const [message, setMessage] = useState<string | null>(null)

  const handleMessage = (msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(null), 3000)
  }

  if (!isSupabaseReady) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-bold text-slate-900">系统配置</h1>
        <div className="card bg-amber-50 border-amber-200 p-4 rounded-xl">
          <p className="text-sm text-amber-700">Supabase 未配置，无法使用此功能</p>
        </div>
      </div>
    )
  }

  if (profile?.role !== 'admin' && profile?.role !== 'teacher') {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-bold text-slate-900">系统配置</h1>
        <div className="card bg-slate-50 border-slate-200 p-4 rounded-xl">
          <p className="text-sm text-slate-600">仅管理员和教师可访问系统配置。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 leading-tight">系统配置</h1>
        <p className="text-sm text-slate-500 mt-1">集中管理学科、年级、学校和班级的基础配置信息</p>
      </div>

      {message && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 px-4 py-3 rounded-lg text-sm animate-in fade-in slide-in-from-top-2 duration-300">
          {message}
        </div>
      )}

      {/* 标签页导航 */}
      <div className="flex flex-wrap gap-1 p-1 bg-slate-100/50 rounded-xl w-fit">
        {[
          { id: 'subjects', label: '学科管理' },
          { id: 'grades', label: '年级管理' },
          { id: 'schools', label: '学校管理' },
          { id: 'classes', label: '班级管理' },
        ].map((tab) => (
          <button
            key={tab.id}
            className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${activeTab === tab.id
                ? 'bg-white text-brand-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            onClick={() => setActiveTab(tab.id as any)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 内容区域 */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 overflow-hidden">
        {activeTab === 'subjects' && <SubjectsManager onMessage={handleMessage} />}
        {activeTab === 'grades' && <GradesManager onMessage={handleMessage} />}
        {activeTab === 'schools' && <SchoolsManager onMessage={handleMessage} />}
        {activeTab === 'classes' && <ClassesManager onMessage={handleMessage} />}
      </div>
    </div>
  )
}
