/**
 * 移动端设置页面
 * 统一移动端设计风格
 */

import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase, supabaseReady } from '../../lib/supabaseClient'
import { getSchools, getGrades, getClasses, getSubjects, type School, type Grade, type Class, type Subject } from '../../api/config'
import { isValidPhone, formatPhone, cleanPhone } from '../../utils/phoneValidation'

export default function SettingsMobile() {
  const { session, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // 基本信息
  const [realName, setRealName] = useState('')
  const [nickname, setNickname] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  // 学生设置
  const [schoolId, setSchoolId] = useState<string>('')
  const [gradeId, setGradeId] = useState<string>('')
  const [classId, setClassId] = useState<string>('')

  // 选项数据
  const [schools, setSchools] = useState<School[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [classes, setClasses] = useState<Class[]>([])

  // 加载数据
  useEffect(() => {
    if (!session?.user || !profile) return
    loadData()
  }, [session, profile])

  const loadData = async () => {
    if (!supabaseReady) return

    setLoading(true)
    try {
      const [schoolsData, gradesData] = await Promise.all([
        getSchools(),
        getGrades(),
      ])
      setSchools(schoolsData)
      setGrades(gradesData)

      const { data: profileData } = await supabase
        .from('profiles')
        .select('name, nickname, phone, school_id, grade_id, class_id, role')
        .eq('user_id', session!.user.id)
        .single()

      if (profileData) {
        setRealName(profileData.name || '')
        setNickname(profileData.nickname || '')
        if (profileData.role !== 'student') {
          setPhone(profileData.phone ? formatPhone(profileData.phone) : '')
        }
        setSchoolId(profileData.school_id || '')
        setGradeId(profileData.grade_id || '')
        setClassId(profileData.class_id || '')
      }

      setEmail(session!.user.email || '')

      if (profileData?.school_id && profileData?.grade_id) {
        const classesData = await getClasses(profileData.school_id, profileData.grade_id)
        setClasses(classesData)
      }
    } catch (err: any) {
      setError(err?.message || '加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const cleaned = cleanPhone(value)
    if (cleaned.length <= 11) {
      setPhone(formatPhone(cleaned))
    }
  }

  const handleSchoolChange = async (value: string) => {
    setSchoolId(value)
    setClassId('')
    if (value && gradeId) {
      try {
        const classesData = await getClasses(value, gradeId)
        setClasses(classesData)
      } catch (err) {
        console.error('加载班级失败', err)
      }
    } else {
      setClasses([])
    }
  }

  const handleGradeChange = async (value: string) => {
    setGradeId(value)
    setClassId('')
    if (value && schoolId) {
      try {
        const classesData = await getClasses(schoolId, value)
        setClasses(classesData)
      } catch (err) {
        console.error('加载班级失败', err)
      }
    } else {
      setClasses([])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session?.user || !supabaseReady) return

    setError(null)
    setSaving(true)

    try {
      const cleanedPhone = phone ? cleanPhone(phone) : ''

      if (profile?.role !== 'student' && cleanedPhone && !isValidPhone(cleanedPhone)) {
        setError('请输入有效的手机号')
        setSaving(false)
        return
      }

      const { error: profileError } = await supabase.rpc('safe_update_profile', {
        p_user_id: session!.user.id,
        p_name: realName.trim() || null,
        p_nickname: nickname.trim() || null,
        p_school_id: profile?.role === 'student' ? schoolId : null,
        p_grade_id: profile?.role === 'student' ? gradeId : null,
        p_class_id: profile?.role === 'student' ? classId : null,
        p_subject_ids: null,
      })

      if (profileError) {
        throw new Error(profileError.message)
      }

      if (profile?.role !== 'student' && cleanedPhone) {
        const { error: phoneError } = await supabase
          .from('profiles')
          .update({ phone: cleanedPhone })
          .eq('user_id', session!.user.id)
        
        if (phoneError) {
          throw new Error(phoneError.message)
        }
      }

      setSuccess('设置已保存！')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err?.message || '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2E8B57] border-t-transparent mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] pb-20">
      {/* 顶部欢迎栏（参照个人主页） */}
      <div className="bg-gradient-to-r from-[#2E8B57] to-[#3da86a] text-white px-6 pt-12 pb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <i className="fas fa-cog text-xl"></i>
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                个人设置
              </h2>
              <p className="text-sm opacity-90">管理您的个人信息</p>
            </div>
          </div>
          <Link to="/dashboard" className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors">
            <i className="fas fa-home"></i>
          </Link>
        </div>
      </div>

      {/* 设置表单 */}
      <form className="px-4 py-6 space-y-4" onSubmit={handleSubmit}>
        {/* 基本信息 */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-100">
            <i className="fas fa-user text-[#2E8B57] mr-2"></i>基本信息
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                姓名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="请输入真实姓名"
                className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#2E8B57] focus:ring-2 focus:ring-[#2E8B57]/20"
                value={realName}
                onChange={(e) => setRealName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">昵称</label>
              <input
                type="text"
                placeholder="请输入昵称（可选）"
                className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#2E8B57] focus:ring-2 focus:ring-[#2E8B57]/20"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>
            {profile?.role !== 'student' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">手机号</label>
                <input
                  type="tel"
                  placeholder="138 0013 8000"
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#2E8B57] focus:ring-2 focus:ring-[#2E8B57]/20"
                  value={phone}
                  onChange={handlePhoneChange}
                  maxLength={13}
                />
                <p className="mt-1.5 text-xs text-gray-500">添加手机号后可以使用手机号登录</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">邮箱</label>
              <input
                type="email"
                placeholder="your@example.com"
                className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#2E8B57] focus:ring-2 focus:ring-[#2E8B57]/20"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled
              />
              <p className="mt-1.5 text-xs text-gray-500">邮箱不可修改</p>
            </div>
          </div>
        </div>

        {/* 学生信息 */}
        {profile?.role === 'student' && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-100">
              <i className="fas fa-graduation-cap text-[#2E8B57] mr-2"></i>学生信息
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  学校 <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#2E8B57] focus:ring-2 focus:ring-[#2E8B57]/20"
                  value={schoolId}
                  onChange={(e) => handleSchoolChange(e.target.value)}
                  required
                >
                  <option value="">请选择学校</option>
                  {schools.map(school => (
                    <option key={school.id} value={school.id}>{school.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  年级 <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#2E8B57] focus:ring-2 focus:ring-[#2E8B57]/20"
                  value={gradeId}
                  onChange={(e) => handleGradeChange(e.target.value)}
                  required
                >
                  <option value="">请选择年级</option>
                  {grades.map(grade => (
                    <option key={grade.id} value={grade.id}>{grade.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  班级 <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#2E8B57] focus:ring-2 focus:ring-[#2E8B57]/20 disabled:bg-gray-50 disabled:text-gray-500"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  required
                  disabled={!schoolId || !gradeId}
                >
                  <option value="">请选择班级</option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
                {(!schoolId || !gradeId) && (
                  <p className="mt-1.5 text-xs text-gray-500">请先选择学校和年级</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 错误和成功提示 */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        {success && (
          <div className="bg-green-50 border-l-4 border-green-500 rounded-lg p-3">
            <p className="text-sm text-green-600">{success}</p>
          </div>
        )}

        {/* 提交按钮 */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            className="flex-1 py-3 bg-[#2E8B57] text-white rounded-lg font-semibold hover:bg-[#3da86a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={saving}
          >
            {saving ? (
              <span className="flex items-center justify-center">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2"></span>
                保存中...
              </span>
            ) : (
              '保存设置'
            )}
          </button>
        </div>

        {/* 退出登录 */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <button
            type="button"
            onClick={async () => {
              if (confirm('确定要退出登录吗？')) {
                await signOut()
                navigate('/login')
              }
            }}
            className="w-full py-3 text-red-600 font-medium hover:bg-red-50 rounded-lg transition-colors"
          >
            <i className="fas fa-sign-out-alt mr-2"></i>退出登录
          </button>
        </div>
      </form>

      {/* 底部导航栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg border-t border-gray-200 flex justify-around items-center py-3 z-50">
        <Link to="/dashboard" className="flex flex-col items-center">
          <i className="fas fa-home text-gray-400 text-xl"></i>
          <span className="text-xs text-gray-500 mt-1">首页</span>
        </Link>
        <Link to="/wrong-questions" className="flex flex-col items-center">
          <i className="fas fa-book text-gray-400 text-xl"></i>
          <span className="text-xs text-gray-500 mt-1">错题本</span>
        </Link>
        <Link to="/ranking" className="flex flex-col items-center">
          <i className="fas fa-trophy text-gray-400 text-xl"></i>
          <span className="text-xs text-gray-500 mt-1">排行榜</span>
        </Link>
        <Link to="/settings" className="flex flex-col items-center">
          <i className="fas fa-cog text-[#2E8B57] text-xl"></i>
          <span className="text-xs text-[#2E8B57] mt-1">设置</span>
        </Link>
      </div>
    </div>
  )
}
