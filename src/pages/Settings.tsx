import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase, supabaseReady } from '../lib/supabaseClient'
import { getSchools, getGrades, getClasses, getSubjects, type School, type Grade, type Class, type Subject } from '../api/config'
import { isValidPhone, formatPhone, cleanPhone } from '../utils/phoneValidation'

export default function Settings() {
  const { session, profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // 基本信息
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  // 学生设置
  const [schoolId, setSchoolId] = useState<string>('')
  const [gradeId, setGradeId] = useState<string>('')
  const [classId, setClassId] = useState<string>('')

  // 老师设置
  const [teacherSchoolId, setTeacherSchoolId] = useState<string>('')
  const [subjectIds, setSubjectIds] = useState<string[]>([])

  // 选项数据
  const [schools, setSchools] = useState<School[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])

  // 加载数据
  useEffect(() => {
    if (!session?.user || !profile) return

    loadData()
  }, [session, profile])

  const loadData = async () => {
    if (!supabaseReady) return

    setLoading(true)
    try {
      // 加载选项数据
      const [schoolsData, gradesData, subjectsData] = await Promise.all([
        getSchools(),
        getGrades(),
        getSubjects(),
      ])
      setSchools(schoolsData)
      setGrades(gradesData)
      setSubjects(subjectsData)

      // 加载用户信息
      const { data: profileData } = await supabase
        .from('profiles')
        .select('name, phone, school_id, grade_id, class_id, subject_ids, role')
        .eq('user_id', session!.user.id)
        .single()

      if (profileData) {
        setName(profileData.name || '')
        // 学生不加载手机号
        if (profileData.role !== 'student') {
          setPhone(profileData.phone ? formatPhone(profileData.phone) : '')
        }
        setSchoolId(profileData.school_id || '')
        setGradeId(profileData.grade_id || '')
        setClassId(profileData.class_id || '')
        setTeacherSchoolId(profileData.school_id || '')
        setSubjectIds(profileData.subject_ids || [])
      }

      // 加载邮箱（从 auth.users）
      setEmail(session!.user.email || '')

      // 如果选择了学校，加载班级
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

  // 手机号格式化
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const cleaned = cleanPhone(value)
    if (cleaned.length <= 11) {
      setPhone(formatPhone(cleaned))
    }
  }

  // 学校变化时，加载班级
  const handleSchoolChange = async (newSchoolId: string) => {
    setSchoolId(newSchoolId)
    setClassId('') // 清空班级选择

    if (newSchoolId && gradeId) {
      try {
        const classesData = await getClasses(newSchoolId, gradeId)
        setClasses(classesData)
      } catch (err: any) {
        console.warn('加载班级失败', err)
      }
    } else {
      setClasses([])
    }
  }

  // 年级变化时，加载班级
  const handleGradeChange = async (newGradeId: string) => {
    setGradeId(newGradeId)
    setClassId('') // 清空班级选择

    if (schoolId && newGradeId) {
      try {
        const classesData = await getClasses(schoolId, newGradeId)
        setClasses(classesData)
      } catch (err: any) {
        console.warn('加载班级失败', err)
      }
    } else {
      setClasses([])
    }
  }

  // 老师学校变化
  const handleTeacherSchoolChange = (newSchoolId: string) => {
    setTeacherSchoolId(newSchoolId)
  }

  // 科目选择
  const handleSubjectToggle = (subjectId: string) => {
    setSubjectIds(prev => {
      if (prev.includes(subjectId)) {
        return prev.filter(id => id !== subjectId)
      } else {
        return [...prev, subjectId]
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!supabaseReady || !session?.user) {
      setError('系统未配置或未登录')
      return
    }

    // 验证手机号（学生不需要）
    const cleanedPhone = profile?.role !== 'student' ? cleanPhone(phone) : ''
    if (profile?.role !== 'student' && phone && !isValidPhone(cleanedPhone)) {
      setError('请输入有效的手机号（11位数字）')
      return
    }

    // 验证邮箱
    if (email && !email.includes('@')) {
      setError('请输入有效的邮箱地址')
      return
    }

    // 学生必须选择学校、年级、班级
    if (profile?.role === 'student') {
      if (!schoolId || !gradeId || !classId) {
        setError('学生必须选择学校、年级和班级')
        return
      }
    }

    // 老师必须选择学校和至少一个科目
    if (profile?.role === 'teacher') {
      if (!teacherSchoolId) {
        setError('老师必须选择学校')
        return
      }
      if (subjectIds.length === 0) {
        setError('老师必须选择至少一个科目')
        return
      }
    }

    setSaving(true)

    try {
      // 更新 profiles 表
      const profileUpdates: any = {
        name: name.trim() || null,
      }
      
      // 学生不更新手机号
      if (profile?.role !== 'student') {
        profileUpdates.phone = cleanedPhone || null
      }

      if (profile?.role === 'student') {
        profileUpdates.school_id = schoolId
        profileUpdates.grade_id = gradeId
        profileUpdates.class_id = classId
      } else if (profile?.role === 'teacher') {
        profileUpdates.school_id = teacherSchoolId
        profileUpdates.subject_ids = subjectIds
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('user_id', session.user.id)

      if (profileError) {
        throw new Error(profileError.message)
      }

      // 更新 auth.users 的手机号（学生不需要）
      if (profile?.role !== 'student' && cleanedPhone) {
        const { error: authError } = await supabase.auth.updateUser({
          phone: `+86${cleanedPhone}`,
        })
        if (authError) {
          throw new Error(authError.message)
        }
      }

      // 更新邮箱（需要验证，这里只更新 metadata，实际邮箱更新需要用户通过邮件确认）
      if (email && email !== session.user.email) {
        // 注意：Supabase 的 updateUser 更新邮箱会发送验证邮件
        // 这里我们只更新 metadata，实际邮箱更新需要用户通过邮件确认
        const { error: emailError } = await supabase.auth.updateUser({
          email: email,
        })
        if (emailError) {
          // 如果更新邮箱失败，不影响其他设置
          console.warn('更新邮箱失败（可能需要验证）', emailError.message)
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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-sm text-slate-600">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">个人设置</h1>
        <p className="mt-1 text-sm text-slate-600">管理您的个人信息和账户设置</p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        {/* 基本信息 */}
        <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">基本信息</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">真实姓名 *</label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* 学生不显示手机号字段 */}
            {profile?.role !== 'student' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">手机号</label>
                <input
                  type="tel"
                  placeholder="138 0013 8000"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  value={phone}
                  onChange={handlePhoneChange}
                  maxLength={13}
                />
                <p className="mt-1 text-xs text-slate-500">添加手机号后可以使用手机号登录</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">邮箱</label>
              <input
                type="email"
                placeholder="your@example.com"
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-500">添加邮箱后可以使用邮箱登录和找回密码</p>
            </div>
          </div>
        </div>

        {/* 学生设置 */}
        {profile?.role === 'student' && (
          <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">学生信息</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">学校 *</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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
                <label className="block text-sm font-medium text-slate-700 mb-1">年级 *</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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
                <label className="block text-sm font-medium text-slate-700 mb-1">班级 *</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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
                  <p className="mt-1 text-xs text-slate-500">请先选择学校和年级</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 老师设置 */}
        {profile?.role === 'teacher' && (
          <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">教师信息</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">学校 *</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  value={teacherSchoolId}
                  onChange={(e) => handleTeacherSchoolChange(e.target.value)}
                  required
                >
                  <option value="">请选择学校</option>
                  {schools.map(school => (
                    <option key={school.id} value={school.id}>{school.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">任教科目 *</label>
                <div className="space-y-2">
                  {subjects.map(subject => (
                    <label key={subject.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={subjectIds.includes(subject.id)}
                        onChange={() => handleSubjectToggle(subject.id)}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="text-sm text-slate-700">{subject.name}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-xs text-slate-500">请至少选择一个科目</p>
              </div>
            </div>
          </div>
        )}

        {/* 错误和成功提示 */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        {success && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
            <p className="text-sm text-emerald-600">{success}</p>
          </div>
        )}

        {/* 提交按钮 */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-brand-700 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={saving}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                保存中...
              </span>
            ) : (
              '保存设置'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
