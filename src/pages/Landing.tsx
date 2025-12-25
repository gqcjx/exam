import { type ComponentType } from 'react'
import {
  BookOpen,
  ChartPie,
  CheckCircle2,
  GraduationCap,
  Layout,
  ShieldCheck,
  Smartphone,
  Timer,
  Users,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const featureCards = [
  {
    title: '智能题库与组卷',
    desc: '按学科/年级/难度/题型筛选，支持手动或随机组卷，并可重复发布版本。',
    icon: BookOpen,
  },
  {
    title: '多题型在线答题',
    desc: '单选、多选、判断、填空、简答全覆盖，自动保存草稿，移动端友好。',
    icon: CheckCircle2,
  },
  {
    title: '自动批改与人工阅卷',
    desc: '客观题实时判分，填空支持模糊匹配；简答题支持教师批阅与评语。',
    icon: Timer,
  },
  {
    title: '成绩分析与家长端',
    desc: '正确率、错题分布、题型统计，家长可查看孩子成绩与解析。',
    icon: ChartPie,
  },
]

const roleFlows = [
  {
    title: '管理员',
    items: ['配置学校与年级', '管理角色与权限', '监控数据与备份'],
  },
  {
    title: '老师',
    items: ['维护题库', '组卷发布', '批阅简答与点评'],
  },
  {
    title: '学生',
    items: ['在线考试', '草稿自动保存', '提交后即时成绩/解析'],
  },
  {
    title: '家长',
    items: ['绑定孩子', '查看成绩与解析', '跟进学习建议'],
  },
]

const highlights = [
  {
    icon: ShieldCheck,
    title: '安全合规',
    desc: '基于 Supabase Auth + RLS，分角色精细化权限控制。',
  },
  {
    icon: Layout,
    title: '统一设计',
    desc: '简洁现代、移动优先，组件风格与色彩体系保持一致。',
  },
  {
    icon: Smartphone,
    title: '全端覆盖',
    desc: 'Web + GitHub Pages 部署，Capacitor 打包安卓端。',
  },
  {
    icon: GraduationCap,
    title: '教育场景优化',
    desc: '题卡导航、倒计时、进度提示、断网可恢复草稿。',
  },
]

function SectionCard({
  title,
  desc,
  icon: Icon,
}: {
  title: string
  desc: string
  icon: ComponentType<{ className?: string }>
}) {
  return (
    <div className="card flex gap-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-600">{desc}</p>
      </div>
    </div>
  )
}

export default function Landing() {
  const { session, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const isLoggedIn = !!session

  const handleSignOut = async () => {
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="relative isolate overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-100">
        <div className="absolute inset-x-0 top-[-10rem] -z-10 transform-gpu blur-3xl">
          <div className="mx-auto h-80 w-[80%] rounded-full bg-gradient-to-r from-brand-200/60 via-brand-400/30 to-brand-200/60 opacity-70" />
        </div>

        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white font-bold">
              QF
            </div>
            <div>
              <p className="text-base font-semibold text-slate-900">青锋测</p>
              <p className="text-xs text-slate-500">中小学多端考试与分析平台</p>
            </div>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            {isLoggedIn ? (
              <>
                <span className="text-sm text-slate-600">
                  {profile?.name || session?.user?.email || '已登录'}
                </span>
                <Link className="btn btn-secondary" to="/dashboard">
                  进入控制台
                </Link>
                <button className="btn btn-primary" onClick={handleSignOut}>
                  退出登录
                </button>
              </>
            ) : (
              <>
                <Link className="btn btn-secondary" to="/login">
                  登录
                </Link>
                <a className="btn btn-primary" href="#modules">
                  了解方案
                </a>
              </>
            )}
          </div>
          {/* 移动端登录状态 */}
          <div className="flex items-center gap-2 sm:hidden">
            {isLoggedIn ? (
              <>
                <Link className="btn btn-secondary text-xs px-3 py-1.5" to="/dashboard">
                  控制台
                </Link>
                <button className="btn btn-primary text-xs px-3 py-1.5" onClick={handleSignOut}>
                  退出
                </button>
              </>
            ) : (
              <Link className="btn btn-secondary text-xs px-3 py-1.5" to="/login">
                登录
              </Link>
            )}
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 pb-24">
          <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-700 shadow-sm ring-1 ring-brand-100">
                全角色 · 多题型 · 自动批改 · 家长端
              </span>
              <h1 className="text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
                江西青锋测，打造统一、简洁、好用的中小学在线考试平台
              </h1>
              <p className="text-base leading-7 text-slate-600">
                支持管理员、老师、学生、家长的全链路体验：题库、组卷、在线答题、自动批改、人工阅卷、成绩分析与家长查看，移动优先且安卓可打包。
              </p>
              <div className="flex flex-wrap gap-3">
                <a className="btn btn-primary" href="#roles">
                  查看核心流程
                </a>
                <a className="btn btn-secondary" href="#highlights">
                  设计亮点
                </a>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: '题型支持', value: '单/多选 · 判断 · 填空 · 简答' },
                  { label: '安全', value: 'Supabase Auth + RLS' },
                  { label: '终端', value: 'Web / GitHub Pages / Capacitor 安卓' },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100">
                    <p className="text-xs text-slate-500">{item.label}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="card relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-100/50 via-white to-brand-200/40" />
                <div className="relative space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-800">考试示意</div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      自动保存草稿
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">数学单元测验 · 七年级</p>
                        <p className="text-xs text-slate-500">总分 100 · 时长 45 分钟</p>
                      </div>
                      <div className="rounded-full bg-slate-900 px-4 py-1 text-xs font-semibold text-white">
                        34:21
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>题卡</span>
                          <span>10/30</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {Array.from({ length: 12 }).map((_, idx) => (
                            <span
                              key={idx}
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-700"
                            >
                              {idx + 1}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-slate-600">当前题目（多选）</div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
                          已知三角形 ABC 中，∠A=∠B，以下说法正确的是？
                        </div>
                        <div className="space-y-2 text-sm">
                          {['两边相等', '两高相等', '两角平分线相等', '对边相等'].map((opt) => (
                            <label
                              key={opt}
                              className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 text-slate-700"
                            >
                              <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" />
                              {opt}
                            </label>
                          ))}
                        </div>
                        <div className="flex gap-2 text-xs">
                          <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
                            自动判分
                          </span>
                          <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-700">
                            支持解析
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-white px-3 py-1 font-semibold text-slate-700 shadow-sm ring-1 ring-slate-100">
                      断网可恢复
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 font-semibold text-slate-700 shadow-sm ring-1 ring-slate-100">
                      交卷自动校验
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 font-semibold text-slate-700 shadow-sm ring-1 ring-slate-100">
                      支持计时/禁切屏（可扩展）
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="modules" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-brand-700">核心模块</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">功能总览</h2>
              </div>
              <a className="text-sm font-semibold text-brand-700 hover:underline" href="#roles">
                查看流程
              </a>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {featureCards.map((item) => (
                <SectionCard key={item.title} title={item.title} desc={item.desc} icon={item.icon} />
              ))}
            </div>
          </section>

          <section id="roles" className="space-y-6">
            <div>
              <p className="text-sm font-semibold text-brand-700">角色流程</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">按角色的使用路径</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {roleFlows.map((role) => (
                <div key={role.title} className="card h-full">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">{role.title}</h3>
                    <Users className="h-4 w-4 text-brand-600" />
                  </div>
                  <ul className="mt-3 space-y-2 text-sm text-slate-600">
                    {role.items.map((step) => (
                      <li key={step} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-600" />
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section id="highlights" className="space-y-6">
            <div>
              <p className="text-sm font-semibold text-brand-700">设计亮点</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">统一的风格与体验</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {highlights.map((item) => (
                <SectionCard key={item.title} title={item.title} desc={item.desc} icon={item.icon} />
              ))}
            </div>
            <div className="card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-brand-700">部署与移动端</p>
                <h3 className="mt-2 text-lg font-bold text-slate-900">GitHub Pages + Supabase + Capacitor</h3>
                <p className="mt-2 text-sm text-slate-600">
                  前端托管在 GitHub Pages，可配置自定义域名；后端使用 Supabase（Auth、Postgres、Storage、Edge
                  Functions）；安卓端采用 Capacitor 打包，保持与 Web 同步的 UI 风格与交互。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-brand-50 px-4 py-2 text-xs font-semibold text-brand-700 ring-1 ring-brand-100">
                  CI/CD 自动构建
                </span>
                <span className="rounded-full bg-brand-50 px-4 py-2 text-xs font-semibold text-brand-700 ring-1 ring-brand-100">
                  统一组件主题
                </span>
                <span className="rounded-full bg-brand-50 px-4 py-2 text-xs font-semibold text-brand-700 ring-1 ring-brand-100">
                  适配手机/平板/桌面
                </span>
              </div>
            </div>
          </section>
        </main>
      </div>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>青锋测 · 简洁统一的中小学考试与成绩平台</span>
          <span>Supabase 全栈 · GitHub Pages · Capacitor 安卓</span>
        </div>
      </footer>
    </div>
  )
}




