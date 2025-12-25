export default function Privacy() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
      <h1 className="text-2xl font-bold text-slate-900">隐私保护说明</h1>
      <p className="text-sm text-slate-600">
        我们仅收集完成在线考试所需的最少信息（如账号、姓名、考试记录），用于教学统计和分析。
      </p>
      <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
        <li>学生考试数据仅对本人、其家长账号、授课教师及管理员可见。</li>
        <li>系统不会对外出售、出租或泄露您的个人信息。</li>
        <li>如需导出或删除个人数据，请联系管理员处理。</li>
      </ul>
      <p className="text-xs text-slate-500">
        后端数据存储在 Supabase 提供的云数据库中，请同时遵守其服务条款与隐私政策。
      </p>
    </div>
  )
}




