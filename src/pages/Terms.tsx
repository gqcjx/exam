export default function Terms() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
      <h1 className="text-2xl font-bold text-slate-900">使用条款</h1>
      <p className="text-sm text-slate-600">
        本系统用于教学场景下的在线考试与练习，请在遵守学校及法律法规的前提下使用。
      </p>
      <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
        <li>不得使用本系统进行任何违法、违规活动。</li>
        <li>考试期间请遵守监考要求，禁止恶意刷分、攻击系统等行为。</li>
        <li>管理员与教师应妥善管理试卷与学生信息，避免泄露。</li>
      </ul>
      <p className="text-xs text-slate-500">
        如继续使用本系统，即视为已阅读并同意本使用条款。
      </p>
    </div>
  )
}




